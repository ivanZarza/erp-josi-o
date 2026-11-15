import "server-only";
/**
 * Obrador: recetas de producción, órdenes, lotes con trazabilidad y tarifas a locales.
 * Ver docs/specs/modulos/obrador/README.md
 *
 * Exporta para otros módulos:
 *  - productosElaboradosIds: qué productos del catálogo son elaborados del obrador (Carta los marca así)
 *  - recalcularTarifasProducto (en ./tarifas.ts): vuelve a calcular los precios a locales cuando cambia
 *    el coste. Se puede llamar desde compras al recibir (dentro de su transacción).
 *
 * Eventos que emite (obrador.produccion.cerrada, obrador.lote.retirado, obrador.tarifa.cambiada): se
 * guardan en EventoInterno, pero hoy ningún módulo los procesa (pendiente). La factura entre sociedades
 * al servir un pedido tampoco existe todavía.
 */
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { registrarMovimientos, stockDe, type NuevoMovimiento, type Tx } from "@/nucleo/movimientos";
import { cantidadBruta, redondear, unirAlergenos } from "@/modulos/comidas/carta-alergenos";
import { alergenosDeProductos, costeYAlergenosEscandallo, fijarAlergenosProducto } from "@/modulos/comidas/carta-servicio";
import { crearIncidenciaAutomatica } from "@/modulos/calidad/servicio";
import { registrarMerma } from "@/nucleo/mermas";
import { costeMedioTrasEntrada } from "@/nucleo/coste-medio";
import { hoyMadrid, inicioDiaMadrid } from "@/kernel/fechas";

export { hoyMadrid, inicioDiaMadrid };
import { precioSegunModo, recalcularTarifasProducto } from "./tarifas";
import {
  esquemaCierre,
  esquemaEdicionLinea,
  esquemaLineaReceta,
  esquemaOrden,
  esquemaReceta,
  esquemaRecetaEdicion,
  esquemaRetirada,
  esquemaTarifa,
} from "./esquemas";

export class ErrorObrador extends Error {}

const FAMILIA_ELABORADOS = "Elaborados del obrador";
const DIA_MS = 24 * 60 * 60 * 1000;

function fechaDeTexto(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

// ---------------------------------------------------------------------------
// Para otros módulos
// ---------------------------------------------------------------------------

export async function productosElaboradosIds(tx: Tx, tenantId: string): Promise<Set<string>> {
  const r = await tx.obradorReceta.findMany({ where: { tenantId }, select: { productoId: true } });
  return new Set(r.map((x) => x.productoId));
}

// ---------------------------------------------------------------------------
// Ámbito: solo centros tipo OBRADOR
// ---------------------------------------------------------------------------

/** Obradores que se ven ahora (el elegido arriba si es un obrador, o todos los del usuario). */
export function obradoresVisibles(ctx: Contexto) {
  const ids = new Set(centrosFiltro(ctx));
  return ctx.centros.filter((c) => c.tipo === "OBRADOR" && ids.has(c.id));
}

function exigirObrador(ctx: Contexto, centroId: string) {
  const c = ctx.centros.find((x) => x.id === centroId && x.tipo === "OBRADOR");
  if (!c) throw new ErrorObrador("Ese centro no es un obrador o no tienes acceso");
  return c;
}

// ---------------------------------------------------------------------------
// Recetas
// ---------------------------------------------------------------------------

async function calcularReceta(tx: Tx, tenantId: string, receta: { rendimiento: unknown; alergenosPropios: string[]; lineas: { id: string; productoId: string; cantidad: unknown; mermaPct: unknown }[] }) {
  const calc = await costeYAlergenosEscandallo(tx, tenantId, receta.lineas);
  const rendimiento = Number(receta.rendimiento);
  return {
    ...calc,
    costeUnidad: rendimiento > 0 ? calc.costeMedio / rendimiento : 0,
    alergenosTotales: unirAlergenos(calc.alergenos, receta.alergenosPropios),
  };
}

export async function listarRecetas(ctx: Contexto, opciones: { incluirInactivas?: boolean } = {}) {
  const prisma = await db();
  const obradores = obradoresVisibles(ctx);
  const recetas = await prisma.obradorReceta.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: obradores.map((o) => o.id) }, ...(opciones.incluirInactivas ? {} : { activo: true }) },
    include: { lineas: { orderBy: { orden: "asc" } } },
    orderBy: { nombre: "asc" },
  });
  const productos = await prisma.producto.findMany({
    where: { tenantId: ctx.tenant.id, id: { in: recetas.map((r) => r.productoId) } },
    select: { id: true, nombre: true, referencia: true, unidad: true, costeUnitario: true },
  });
  const prod = new Map(productos.map((p) => [p.id, p]));
  const salida = [];
  for (const r of recetas) {
    const calc = await calcularReceta(prisma, ctx.tenant.id, r);
    const p = prod.get(r.productoId);
    salida.push({
      ...r,
      rendimiento: Number(r.rendimiento),
      producto: p?.nombre ?? "—",
      referencia: p?.referencia ?? "",
      unidad: p?.unidad ?? "UD",
      costeMedioActual: Number(p?.costeUnitario ?? 0),
      obrador: obradores.find((o) => o.id === r.centroId)?.nombre ?? "—",
      calc,
    });
  }
  return salida;
}

export async function fichaReceta(ctx: Contexto, id: string) {
  const lista = await listarRecetas(ctx, { incluirInactivas: true });
  return lista.find((r) => r.id === id) ?? null;
}

/** Ingredientes que se pueden usar en una receta (Comidas y Bebidas activos). */
export async function catalogoParaRecetas(ctx: Contexto) {
  const prisma = await db();
  const [productos, elaborados] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId: ctx.tenant.id, activo: true, area: { in: ["COMIDAS", "BEBIDAS"] } },
      orderBy: [{ area: "desc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, referencia: true, unidad: true, area: true, costeUnitario: true },
    }),
    productosElaboradosIds(prisma, ctx.tenant.id),
  ]);
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    referencia: p.referencia,
    unidad: p.unidad,
    coste: Number(p.costeUnitario),
    grupo: elaborados.has(p.id) ? "Elaborados del obrador" : p.area === "COMIDAS" ? "Comidas" : "Bebidas",
    elaborado: elaborados.has(p.id),
  }));
}

/** Escribe en la ficha de alérgenos del elaborado (Carta) la suma de sus ingredientes y los propios. */
async function sincronizarAlergenosElaborado(tx: Tx, tenantId: string, recetaId: string) {
  const r = await tx.obradorReceta.findUnique({ where: { id: recetaId }, include: { lineas: true } });
  if (!r) return;
  const alerg = await alergenosDeProductos(tx, tenantId, r.lineas.map((l) => l.productoId));
  const alergenos = unirAlergenos(r.alergenosPropios, ...r.lineas.map((l) => alerg.get(l.productoId)?.alergenos ?? []));
  const trazas = unirAlergenos(...r.lineas.map((l) => alerg.get(l.productoId)?.trazas ?? []));
  await fijarAlergenosProducto(tx, tenantId, r.productoId, alergenos, trazas);
}

async function recetaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const r = await tx.obradorReceta.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!r) throw new ErrorObrador("La receta no existe");
  exigirObrador(ctx, r.centroId);
  return r;
}

export async function crearReceta(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaReceta.parse(datos);
  exigirObrador(ctx, d.centroId);
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    let productoId = d.productoId;
    if (productoId) {
      const p = await tx.producto.findFirst({ where: { id: productoId, tenantId: ctx.tenant.id } });
      if (!p) throw new ErrorObrador("El elaborado no existe");
      const ya = await tx.obradorReceta.findFirst({ where: { tenantId: ctx.tenant.id, productoId } });
      if (ya) throw new ErrorObrador(`Ese elaborado ya tiene receta: «${ya.nombre}»`);
    } else {
      const familia = await tx.familiaProducto.upsert({
        where: { tenantId_area_nombre: { tenantId: ctx.tenant.id, area: "COMIDAS", nombre: FAMILIA_ELABORADOS } },
        create: { tenantId: ctx.tenant.id, area: "COMIDAS", nombre: FAMILIA_ELABORADOS, orden: 99 },
        update: {},
      });
      const referencia = await siguienteNumero(tx, ctx.tenant.id, "OB-EL", 4);
      const p = await tx.producto.create({
        data: { tenantId: ctx.tenant.id, area: "COMIDAS", familiaId: familia.id, referencia, nombre: d.nombreProducto!, unidad: d.unidad, iva: 10 },
      });
      productoId = p.id;
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Producto", entidadId: p.id, accion: "crear elaborado", despues: { referencia, nombre: p.nombre } });
    }
    const r = await tx.obradorReceta.create({
      data: {
        tenantId: ctx.tenant.id,
        centroId: d.centroId,
        productoId,
        nombre: d.nombre,
        rendimiento: d.rendimiento,
        vidaUtilDias: d.vidaUtilDias,
        conservacion: d.conservacion,
        pasos: d.pasos,
        tiempoMinutos: d.tiempoMinutos,
        alergenosPropios: [],
      },
    });
    return r.id;
  });
}

export async function actualizarReceta(ctx: Contexto, datos: Record<string, unknown>, alergenosPropios: string[]) {
  const d = esquemaRecetaEdicion.parse(datos);
  const prisma = await db();
  await recetaDeLaCadena(prisma, ctx, d.id);
  await prisma.$transaction(async (tx) => {
    await tx.obradorReceta.update({
      where: { id: d.id },
      data: {
        nombre: d.nombre,
        rendimiento: d.rendimiento,
        vidaUtilDias: d.vidaUtilDias,
        conservacion: d.conservacion ?? null,
        pasos: d.pasos ?? null,
        tiempoMinutos: d.tiempoMinutos ?? null,
        alergenosPropios: unirAlergenos(alergenosPropios),
      },
    });
    await sincronizarAlergenosElaborado(tx, ctx.tenant.id, d.id);
  });
}

export async function cambiarActivoReceta(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await recetaDeLaCadena(prisma, ctx, id);
  await prisma.obradorReceta.update({ where: { id }, data: { activo } });
}

export async function anadirLineaReceta(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaLineaReceta.parse(datos);
  const prisma = await db();
  const r = await recetaDeLaCadena(prisma, ctx, d.recetaId);
  if (d.productoId === r.productoId) throw new ErrorObrador("Un elaborado no puede ser ingrediente de sí mismo");
  const p = await prisma.producto.findFirst({ where: { id: d.productoId, tenantId: ctx.tenant.id } });
  if (!p) throw new ErrorObrador("El ingrediente no existe");
  await prisma.$transaction(async (tx) => {
    const ultimo = await tx.obradorRecetaLinea.aggregate({ where: { recetaId: d.recetaId }, _max: { orden: true } });
    await tx.obradorRecetaLinea.create({ data: { recetaId: d.recetaId, productoId: d.productoId, cantidad: d.cantidad, mermaPct: d.mermaPct ?? 0, orden: (ultimo._max.orden ?? 0) + 1 } });
    await sincronizarAlergenosElaborado(tx, ctx.tenant.id, d.recetaId);
  });
}

async function lineaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const l = await tx.obradorRecetaLinea.findFirst({ where: { id, receta: { tenantId: ctx.tenant.id } }, include: { receta: true } });
  if (!l) throw new ErrorObrador("La línea no existe");
  exigirObrador(ctx, l.receta.centroId);
  return l;
}

export async function actualizarLineaReceta(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaEdicionLinea.parse(datos);
  const prisma = await db();
  await lineaDeLaCadena(prisma, ctx, d.id);
  await prisma.obradorRecetaLinea.update({ where: { id: d.id }, data: { cantidad: d.cantidad, mermaPct: d.mermaPct ?? 0 } });
}

export async function quitarLineaReceta(ctx: Contexto, id: string) {
  const prisma = await db();
  const l = await lineaDeLaCadena(prisma, ctx, id);
  await prisma.$transaction(async (tx) => {
    await tx.obradorRecetaLinea.delete({ where: { id } });
    await sincronizarAlergenosElaborado(tx, ctx.tenant.id, l.recetaId);
  });
}

// ---------------------------------------------------------------------------
// Órdenes de producción
// ---------------------------------------------------------------------------

export async function listarOrdenes(ctx: Contexto, filtro: { estado?: string; desde?: string; hasta?: string } = {}) {
  const prisma = await db();
  const obradores = obradoresVisibles(ctx);
  const ordenes = await prisma.obradorOrden.findMany({
    where: {
      tenantId: ctx.tenant.id,
      centroId: { in: obradores.map((o) => o.id) },
      ...(filtro.estado ? { estado: filtro.estado as "PLANIFICADA" | "CERRADA" | "ANULADA" } : {}),
      ...(filtro.desde || filtro.hasta
        ? { fecha: { ...(filtro.desde ? { gte: fechaDeTexto(filtro.desde) } : {}), ...(filtro.hasta ? { lte: fechaDeTexto(filtro.hasta) } : {}) } }
        : {}),
    },
    include: { receta: { include: { lineas: { orderBy: { orden: "asc" } } } }, lote: true },
    orderBy: [{ fecha: "desc" }, { numero: "desc" }],
    take: 200,
  });
  const ids = Array.from(new Set(ordenes.flatMap((o) => [o.receta.productoId, ...o.receta.lineas.map((l) => l.productoId)])));
  const productos = await prisma.producto.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids } }, select: { id: true, nombre: true, unidad: true, costeUnitario: true } });
  const prod = new Map(productos.map((p) => [p.id, p]));
  return ordenes.map((o) => {
    const tandas = Number(o.tandas);
    const consumo = o.receta.lineas.map((l) => {
      const p = prod.get(l.productoId);
      const bruta = cantidadBruta(Number(l.cantidad), Number(l.mermaPct)) * tandas;
      return { productoId: l.productoId, producto: p?.nombre ?? "—", unidad: p?.unidad ?? "UD", bruta, coste: bruta * Number(p?.costeUnitario ?? 0) };
    });
    const elaborado = prod.get(o.receta.productoId);
    return {
      ...o,
      tandas,
      cantidadPrevista: Number(o.cantidadPrevista),
      cantidadReal: o.cantidadReal != null ? Number(o.cantidadReal) : null,
      costeTotal: o.costeTotal != null ? Number(o.costeTotal) : null,
      costeUnitario: o.costeUnitario != null ? Number(o.costeUnitario) : null,
      elaborado: elaborado?.nombre ?? "—",
      unidad: elaborado?.unidad ?? "UD",
      obrador: obradores.find((x) => x.id === o.centroId)?.nombre ?? "—",
      consumo,
      costeEstimado: consumo.reduce((s, c) => s + c.coste, 0),
    };
  });
}

export async function planificarOrden(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaOrden.parse(datos);
  const prisma = await db();
  const r = await recetaDeLaCadena(prisma, ctx, d.recetaId);
  if (!r.activo) throw new ErrorObrador("La receta está desactivada");
  await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumero(tx, ctx.tenant.id, "OP");
    await tx.obradorOrden.create({
      data: {
        tenantId: ctx.tenant.id,
        centroId: r.centroId,
        numero,
        recetaId: r.id,
        fecha: fechaDeTexto(d.fecha),
        tandas: d.tandas,
        cantidadPrevista: redondear(Number(r.rendimiento) * d.tandas, 3),
        notas: d.notas,
        creadoPor: ctx.usuario.id,
      },
    });
  });
}

export async function anularOrden(ctx: Contexto, id: string) {
  const prisma = await db();
  const o = await prisma.obradorOrden.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!o) throw new ErrorObrador("La orden no existe");
  exigirObrador(ctx, o.centroId);
  if (o.estado !== "PLANIFICADA") throw new ErrorObrador("Solo se puede anular una orden planificada");
  await prisma.obradorOrden.update({ where: { id }, data: { estado: "ANULADA" } });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "ObradorOrden", entidadId: id, accion: "anular" });
}

/**
 * Cierra la orden: saca los ingredientes (PRODUCCION_CONSUMO), mete el elaborado (PRODUCCION_ENTRADA)
 * con su lote y caducidad, calcula el coste del elaborado, actualiza su precio medio y las tarifas a locales.
 */
export async function cerrarOrden(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaCierre.parse(datos);
  const prisma = await db();
  const orden = await prisma.obradorOrden.findFirst({ where: { id: d.id, tenantId: ctx.tenant.id }, include: { receta: { include: { lineas: true } } } });
  if (!orden) throw new ErrorObrador("La orden no existe");
  exigirObrador(ctx, orden.centroId);
  if (orden.estado !== "PLANIFICADA") throw new ErrorObrador("La orden ya está cerrada o anulada");
  if (orden.receta.lineas.length === 0) throw new ErrorObrador("La receta no tiene ingredientes");

  const t = ctx.tenant.id;
  const centroId = orden.centroId;
  const tandas = Number(orden.tandas);

  return prisma.$transaction(
    async (tx) => {
      const ids = orden.receta.lineas.map((l) => l.productoId);
      const productos = await tx.producto.findMany({ where: { tenantId: t, id: { in: [...ids, orden.receta.productoId] } } });
      const prod = new Map(productos.map((p) => [p.id, p]));

      // Consumo bruto por ingrediente (agrupado por si un producto se repite)
      const consumo = new Map<string, number>();
      for (const l of orden.receta.lineas) consumo.set(l.productoId, (consumo.get(l.productoId) ?? 0) + cantidadBruta(Number(l.cantidad), Number(l.mermaPct)) * tandas);

      const faltan: string[] = [];
      for (const [productoId, cantidad] of consumo) {
        const stock = await stockDe(tx, t, centroId, productoId);
        if (stock + 1e-9 < cantidad) faltan.push(`${prod.get(productoId)?.nombre ?? productoId} (hay ${redondear(stock, 3)}, hacen falta ${redondear(cantidad, 3)})`);
      }
      if (faltan.length > 0 && !d.forzar) throw new ErrorObrador(`Falta stock: ${faltan.join("; ")}. Marca «Cerrar aunque falte stock» si el recuento no está al día.`);

      const loteCodigo = await siguienteNumero(tx, t, "LOTE");
      const movs: NuevoMovimiento[] = [];
      let costeTotal = 0;
      const ingredientes: { productoId: string; cantidad: number; costeUnitario: number }[] = [];
      for (const [productoId, cantidad] of consumo) {
        const cu = Number(prod.get(productoId)?.costeUnitario ?? 0);
        costeTotal += cantidad * cu;
        ingredientes.push({ productoId, cantidad: redondear(cantidad, 4), costeUnitario: cu });
        movs.push({
          tenantId: t,
          centroId,
          productoId,
          tipo: "PRODUCCION_CONSUMO",
          cantidad: -redondear(cantidad, 3),
          costeUnitario: cu,
          documento: orden.numero,
          documentoId: orden.id,
          motivo: `Producción ${loteCodigo}`,
          usuarioId: ctx.usuario.id,
        });
      }
      const costeUnitario = costeTotal / d.cantidadReal;

      // Coste medio del elaborado: la misma regla que las compras (stock de toda la cadena, src/nucleo/coste-medio.ts)
      const elaborado = prod.get(orden.receta.productoId)!;
      const { costeNuevo: nuevoMedio } = await costeMedioTrasEntrada(tx, t, elaborado.id, d.cantidadReal, costeUnitario);

      movs.push({
        tenantId: t,
        centroId,
        productoId: elaborado.id,
        tipo: "PRODUCCION_ENTRADA",
        cantidad: d.cantidadReal,
        costeUnitario: redondear(costeUnitario),
        documento: orden.numero,
        documentoId: orden.id,
        motivo: `Lote ${loteCodigo}`,
        usuarioId: ctx.usuario.id,
      });
      await registrarMovimientos(tx, movs);

      const alerg = await alergenosDeProductos(tx, t, [elaborado.id]);
      const ahora = new Date();
      await tx.obradorLote.create({
        data: {
          tenantId: t,
          centroId,
          codigo: loteCodigo,
          ordenId: orden.id,
          productoId: elaborado.id,
          cantidad: d.cantidadReal,
          costeUnitario: redondear(costeUnitario),
          elaboradoEn: ahora,
          caducaEn: new Date(ahora.getTime() + orden.receta.vidaUtilDias * DIA_MS),
          alergenos: unirAlergenos(alerg.get(elaborado.id)?.alergenos ?? [], orden.receta.alergenosPropios),
          conservacion: orden.receta.conservacion,
          ingredientes: { create: ingredientes.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, costeUnitario: i.costeUnitario })) },
        },
      });
      await tx.obradorOrden.update({
        where: { id: orden.id },
        data: {
          estado: "CERRADA",
          cantidadReal: d.cantidadReal,
          costeTotal: redondear(costeTotal),
          costeUnitario: redondear(costeUnitario),
          cerradoPor: ctx.usuario.id,
          cerradoEn: ahora,
        },
      });
      await tx.producto.update({ where: { id: elaborado.id }, data: { costeUnitario: new Prisma.Decimal(redondear(nuevoMedio)) } });
      await recalcularTarifasProducto(tx, t, elaborado.id, ctx.usuario.id);

      await auditar(tx, {
        tenantId: t,
        usuarioId: ctx.usuario.id,
        entidad: "ObradorOrden",
        entidadId: orden.id,
        accion: "cerrar producción",
        despues: { lote: loteCodigo, cantidad: d.cantidadReal, costeTotal: redondear(costeTotal, 2), costeUnitario: redondear(costeUnitario), faltaStock: faltan },
      });
      await emitir(tx, t, "obrador.produccion.cerrada", { ordenId: orden.id, lote: loteCodigo, productoId: elaborado.id, cantidad: d.cantidadReal, centroId });
      return loteCodigo;
    },
    { timeout: 20000 },
  );
}

// ---------------------------------------------------------------------------
// Lotes
// ---------------------------------------------------------------------------

export async function listarLotes(ctx: Contexto, filtro: { estado?: string; q?: string } = {}) {
  const prisma = await db();
  const obradores = obradoresVisibles(ctx);
  const ahora = new Date();
  const lotes = await prisma.obradorLote.findMany({
    where: {
      tenantId: ctx.tenant.id,
      centroId: { in: obradores.map((o) => o.id) },
      ...(filtro.estado === "RETIRADO" ? { estado: "RETIRADO" } : {}),
      ...(filtro.estado === "VIGENTE" ? { estado: "ACTIVO", caducaEn: { gte: ahora } } : {}),
      ...(filtro.estado === "CADUCADO" ? { estado: "ACTIVO", caducaEn: { lt: ahora } } : {}),
      ...(filtro.q ? { codigo: { contains: filtro.q, mode: "insensitive" } } : {}),
    },
    include: { ingredientes: true, orden: { select: { numero: true } } },
    orderBy: { elaboradoEn: "desc" },
    take: 300,
  });
  const ids = Array.from(new Set(lotes.flatMap((l) => [l.productoId, ...l.ingredientes.map((i) => i.productoId)])));
  const productos = await prisma.producto.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids } }, select: { id: true, nombre: true, unidad: true, referencia: true } });
  const prod = new Map(productos.map((p) => [p.id, p]));
  // Stock de cada elaborado en su obrador (para proponer cuánto dar de baja al retirar un lote)
  const stockObrador =
    lotes.length === 0
      ? []
      : await prisma.movimientoStock.groupBy({
          by: ["centroId", "productoId"],
          where: { tenantId: ctx.tenant.id, centroId: { in: obradores.map((o) => o.id) }, productoId: { in: Array.from(new Set(lotes.map((l) => l.productoId))) } },
          _sum: { cantidad: true },
        });
  const stockDeElaborado = (centroId: string, productoId: string) =>
    Math.max(0, Number(stockObrador.find((x) => x.centroId === centroId && x.productoId === productoId)?._sum.cantidad ?? 0));

  // Trazabilidad hacia delante (aproximada): pedidos servidos del mismo producto desde ese obrador
  // entre la elaboración y la caducidad del lote. El pedido interno aún no guarda el lote.
  const servidos =
    lotes.length === 0
      ? []
      : await prisma.pedidoInternoLinea.findMany({
          where: {
            productoId: { in: Array.from(new Set(lotes.map((l) => l.productoId))) },
            pedido: {
              tenantId: ctx.tenant.id,
              origenId: { in: obradores.map((o) => o.id) },
              estado: { in: ["SERVIDO", "RECIBIDO"] },
              servidoEn: { gte: new Date(Math.min(...lotes.map((l) => l.elaboradoEn.getTime()))) },
            },
          },
          include: { pedido: { select: { numero: true, origenId: true, servidoEn: true, destino: { select: { nombre: true } } } } },
        });
  return lotes.map((l) => {
    const destinos = servidos
      .filter((x) => x.productoId === l.productoId && x.pedido.origenId === l.centroId && x.pedido.servidoEn && x.pedido.servidoEn >= l.elaboradoEn && x.pedido.servidoEn <= l.caducaEn)
      .map((x) => ({ id: x.id, pedido: x.pedido.numero, local: x.pedido.destino.nombre, servidoEn: x.pedido.servidoEn, cantidad: Number(x.servida ?? x.pedida) }));
    const stockEnObrador = stockDeElaborado(l.centroId, l.productoId);
    // lo que puede quedar del lote en el obrador: lo producido menos lo servido después, sin pasar del stock
    const quedaPosible = redondear(Math.max(0, Math.min(stockEnObrador, Number(l.cantidad) - destinos.reduce((s, d) => s + d.cantidad, 0))), 3);
    return {
    ...l,
    destinos,
    stockEnObrador,
    quedaPosible,
    cantidad: Number(l.cantidad),
    costeUnitario: Number(l.costeUnitario),
    producto: prod.get(l.productoId)?.nombre ?? "—",
    unidad: prod.get(l.productoId)?.unidad ?? "UD",
    caducado: l.caducaEn < ahora,
    diasParaCaducar: Math.floor((l.caducaEn.getTime() - ahora.getTime()) / DIA_MS),
    obrador: obradores.find((o) => o.id === l.centroId)?.nombre ?? "—",
    ingredientesDetalle: l.ingredientes.map((i) => ({
      producto: prod.get(i.productoId)?.nombre ?? "—",
      referencia: prod.get(i.productoId)?.referencia ?? "",
      unidad: prod.get(i.productoId)?.unidad ?? "UD",
      cantidad: Number(i.cantidad),
      costeUnitario: Number(i.costeUnitario),
    })),
    };
  });
}

export async function lotePorId(ctx: Contexto, id: string) {
  const prisma = await db();
  const lote = await prisma.obradorLote.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { orden: { include: { receta: true } } } });
  if (!lote || !ctx.centros.some((c) => c.id === lote.centroId)) return null;
  const [producto, centro] = await Promise.all([
    prisma.producto.findFirst({ where: { id: lote.productoId, tenantId: ctx.tenant.id }, select: { nombre: true, referencia: true, unidad: true } }),
    prisma.centro.findFirst({ where: { id: lote.centroId, tenantId: ctx.tenant.id }, select: { nombre: true, edificio: { select: { direccion: true, ciudad: true } } } }),
  ]);
  return { lote, producto, centro, tenant: ctx.tenant.nombre };
}

export async function retirarLote(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaRetirada.parse(datos);
  const prisma = await db();
  const lote = await prisma.obradorLote.findFirst({ where: { id: d.id, tenantId: ctx.tenant.id } });
  if (!lote) throw new ErrorObrador("El lote no existe");
  exigirObrador(ctx, lote.centroId);
  if (lote.estado === "RETIRADO") throw new ErrorObrador("El lote ya está retirado");
  const baja = redondear(d.cantidadBaja ?? 0, 3);
  if (baja > Number(lote.cantidad) + 1e-9) throw new ErrorObrador(`No se puede dar de baja más de lo que se produjo en el lote (${redondear(Number(lote.cantidad), 3)})`);
  await prisma.$transaction(async (tx) => {
    await tx.obradorLote.update({ where: { id: lote.id }, data: { estado: "RETIRADO", retiradoMotivo: d.motivo, retiradoEn: new Date() } });
    // Lo que queda del lote en el obrador sale del stock como merma (documento MER, al coste medio).
    // Lo que ya se sirvió a los locales lo tiene que dar de baja cada local (incidencia de Calidad).
    let merma: string | null = null;
    if (baja > 0) {
      const producto = await tx.producto.findFirst({ where: { id: lote.productoId, tenantId: ctx.tenant.id }, select: { area: true } });
      if (!producto || (producto.area !== "COMIDAS" && producto.area !== "BEBIDAS")) throw new ErrorObrador("El elaborado del lote no es de Comidas ni de Bebidas");
      merma = await registrarMerma(tx, ctx.tenant.id, ctx.usuario.id, producto.area, {
        centroId: lote.centroId,
        productoId: lote.productoId,
        cantidad: baja,
        motivo: "Retirada de lote",
        nota: `${lote.codigo}: ${d.motivo}`,
      });
    }
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "ObradorLote", entidadId: lote.id, accion: "retirar lote", despues: { codigo: lote.codigo, motivo: d.motivo, bajaEnObrador: baja, merma } });
    // Queda guardado como evento interno (hoy no lo procesa ningún módulo: pendiente) y, si está Calidad,
    // se abre una incidencia de seguridad alimentaria para revisar los locales que lo recibieron.
    await emitir(tx, ctx.tenant.id, "obrador.lote.retirado", { loteId: lote.id, codigo: lote.codigo, productoId: lote.productoId, motivo: d.motivo, centroId: lote.centroId, bajaEnObrador: baja });
    if (ctx.tieneModulo("calidad")) {
      const producto = await tx.producto.findFirst({ where: { id: lote.productoId, tenantId: ctx.tenant.id }, select: { nombre: true } });
      await crearIncidenciaAutomatica(tx, {
        tenantId: ctx.tenant.id,
        centroId: lote.centroId,
        tipo: "SEGURIDAD_ALIMENTARIA",
        titulo: `Retirada del lote ${lote.codigo} (${producto?.nombre ?? "elaborado"})`,
        descripcion: `Motivo: ${d.motivo}\n${baja > 0 ? `En el obrador se han dado de baja ${baja} (merma ${merma}).` : "En el obrador no se ha dado de baja stock."}\nComprobar en los locales que lo recibieron que se ha retirado y destruido, y registrar allí la merma.`,
        origen: "LOTE",
        origenId: lote.id,
        usuarioId: ctx.usuario.id,
        usuarioNombre: ctx.usuario.nombre,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Tarifas a locales
// ---------------------------------------------------------------------------

export { precioSegunModo, recalcularTarifasProducto };

export async function localesDestino(ctx: Contexto) {
  const prisma = await db();
  return prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, tipo: "LOCAL", estado: { not: "CERRADO" } },
    include: { marca: { select: { id: true, nombre: true } } },
    orderBy: [{ marcaId: "asc" }, { nombre: "asc" }],
  });
}

/** Catálogo de venta del obrador con la tarifa de cada local. */
export async function listarTarifas(ctx: Contexto, obradorId: string) {
  exigirObrador(ctx, obradorId);
  const prisma = await db();
  const t = ctx.tenant.id;
  const [recetas, tarifas, locales] = await Promise.all([
    prisma.obradorReceta.findMany({ where: { tenantId: t, centroId: obradorId, activo: true }, select: { productoId: true } }),
    prisma.obradorTarifa.findMany({ where: { tenantId: t, obradorId } }),
    localesDestino(ctx),
  ]);
  const elaborados = new Set(recetas.map((r) => r.productoId));
  const ids = Array.from(new Set([...elaborados, ...tarifas.map((x) => x.productoId)]));
  const [productos, ajustes] = await Promise.all([
    prisma.producto.findMany({ where: { tenantId: t, id: { in: ids } }, include: { familia: { select: { nombre: true } } }, orderBy: { nombre: "asc" } }),
    prisma.productoCentro.findMany({ where: { productoId: { in: ids }, centroId: { in: locales.map((l) => l.id) } } }),
  ]);
  return productos.map((p) => {
    const coste = Number(p.costeUnitario);
    const filas = locales.map((l) => {
      const tar = tarifas.find((x) => x.productoId === p.id && x.centroId === l.id);
      const aj = ajustes.find((x) => x.productoId === p.id && x.centroId === l.id);
      const precio = aj?.precioVenta != null ? Number(aj.precioVenta) : null;
      return {
        centroId: l.id,
        local: l.nombre,
        marca: l.marca?.nombre ?? "—",
        modo: tar?.modo ?? null,
        porcentaje: tar?.porcentaje != null ? Number(tar.porcentaje) : null,
        precioFijo: tar?.precioFijo != null ? Number(tar.precioFijo) : null,
        precio,
        // precio del local distinto del último que escribió la tarifa: lo cambiaron a mano (Stock → Productos)
        cambiadoAMano: !!tar && tar.precioAplicado != null && precio != null && Math.abs(precio - Number(tar.precioAplicado)) > 0.00005,
        margenPct: precio != null && precio > 0 && coste > 0 ? ((precio - coste) / precio) * 100 : null,
      };
    });
    const conPrecio = filas.filter((f) => f.precio != null).map((f) => f.precio as number);
    const modos = Array.from(new Set(filas.map((f) => f.modo).filter(Boolean)));
    return {
      productoId: p.id,
      nombre: p.nombre,
      referencia: p.referencia,
      unidad: p.unidad,
      familia: p.familia?.nombre ?? "—",
      tipo: elaborados.has(p.id) ? "Elaborado" : "Reventa",
      coste,
      filas,
      locales: conPrecio.length,
      minimo: conPrecio.length ? Math.min(...conPrecio) : null,
      maximo: conPrecio.length ? Math.max(...conPrecio) : null,
      modos,
    };
  });
}

/** Aplica un modo de tarifa a todos los locales, a los de una marca o a uno solo. */
export async function aplicarTarifa(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaTarifa.parse(datos);
  exigirObrador(ctx, d.obradorId);
  const prisma = await db();
  const t = ctx.tenant.id;
  const producto = await prisma.producto.findFirst({ where: { id: d.productoId, tenantId: t } });
  if (!producto) throw new ErrorObrador("El artículo no existe");
  const locales = await localesDestino(ctx);
  const destino =
    d.ambito === "TODOS"
      ? locales
      : d.ambito.startsWith("MARCA:")
        ? locales.filter((l) => l.marcaId === d.ambito.slice(6))
        : locales.filter((l) => l.id === d.ambito.slice(7));
  if (destino.length === 0) throw new ErrorObrador("No hay locales en ese ámbito");
  const coste = Number(producto.costeUnitario);
  const porcentaje = d.modo === "COSTE_MAS_PORCENTAJE" ? (d.valor ?? 0) : null;
  const precioFijo = d.modo === "PRECIO_FIJO" ? (d.valor ?? 0) : null;
  const precio = redondear(precioSegunModo(d.modo, coste, porcentaje, precioFijo));
  if (precio <= 0) throw new ErrorObrador("El precio resultante es 0: el artículo no tiene coste todavía. Usa precio fijo o produce un lote antes.");

  await prisma.$transaction(
    async (tx) => {
      for (const l of destino) {
        await tx.obradorTarifa.upsert({
          where: { tenantId_productoId_centroId: { tenantId: t, productoId: producto.id, centroId: l.id } },
          create: { tenantId: t, obradorId: d.obradorId, productoId: producto.id, centroId: l.id, modo: d.modo, porcentaje, precioFijo, precioAplicado: precio, actualizadoPor: ctx.usuario.id },
          update: { obradorId: d.obradorId, modo: d.modo, porcentaje, precioFijo, precioAplicado: precio, actualizadoPor: ctx.usuario.id },
        });
        await tx.productoCentro.upsert({
          where: { productoId_centroId: { productoId: producto.id, centroId: l.id } },
          create: { productoId: producto.id, centroId: l.id, precioVenta: precio },
          update: { precioVenta: precio },
        });
      }
      await auditar(tx, {
        tenantId: t,
        usuarioId: ctx.usuario.id,
        entidad: "ObradorTarifa",
        entidadId: producto.id,
        accion: "aplicar tarifa a locales",
        despues: { ambito: d.ambito, modo: d.modo, porcentaje, precioFijo, precio, locales: destino.length },
      });
      await emitir(tx, t, "obrador.tarifa.cambiada", { productoId: producto.id, centros: destino.map((l) => l.id), precio });
    },
    { timeout: 20000 },
  );
}

export async function recalcularTodasLasTarifas(ctx: Contexto, obradorId: string) {
  exigirObrador(ctx, obradorId);
  const prisma = await db();
  const productos = await prisma.obradorTarifa.findMany({ where: { tenantId: ctx.tenant.id, obradorId }, distinct: ["productoId"], select: { productoId: true } });
  let n = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const p of productos) n += await recalcularTarifasProducto(tx, ctx.tenant.id, p.productoId, ctx.usuario.id);
    },
    { timeout: 30000 },
  );
  return n;
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export async function resumenObrador(ctx: Contexto) {
  const prisma = await db();
  const t = ctx.tenant.id;
  const obradores = obradoresVisibles(ctx).map((o) => o.id);
  const hoy = hoyMadrid();
  const ahora = new Date();
  const enTresDias = new Date(ahora.getTime() + 3 * DIA_MS);
  const inicioMes = inicioDiaMadrid(`${hoy.slice(0, 7)}-01`); // día 1 a las 00:00 de Madrid

  const [ordenesHoy, lotesCaducan, lineasMes, pendientes] = await Promise.all([
    listarOrdenes(ctx, { desde: hoy, hasta: hoy }),
    listarLotes(ctx, {}).then((ls) => ls.filter((l) => l.estado === "ACTIVO" && l.caducaEn <= enTresDias && l.caducaEn >= new Date(ahora.getTime() - 2 * DIA_MS))),
    prisma.pedidoInternoLinea.findMany({
      where: { pedido: { tenantId: t, origenId: { in: obradores }, estado: { in: ["SERVIDO", "RECIBIDO"] }, servidoEn: { gte: inicioMes } } },
      include: { pedido: { select: { id: true, destinoId: true, destino: { select: { nombre: true } } } }, producto: { select: { costeUnitario: true } } },
    }),
    prisma.pedidoInterno.count({ where: { tenantId: t, origenId: { in: obradores }, estado: "PENDIENTE" } }),
  ]);

  // Coste de lo servido = el de la salida del obrador (movimiento SALIDA_PEDIDO, valorado al coste medio
  // del día en que se sirvió), no el coste medio de hoy.
  const salidas = lineasMes.length
    ? await prisma.movimientoStock.groupBy({
        by: ["documentoId", "productoId"],
        where: { tenantId: t, tipo: "SALIDA_PEDIDO", centroId: { in: obradores }, documentoId: { in: Array.from(new Set(lineasMes.map((l) => l.pedido.id))) } },
        _sum: { cantidad: true },
        _max: { costeUnitario: true },
      })
    : [];
  const costeServido = new Map(salidas.map((x) => [`${x.documentoId}:${x.productoId}`, Number(x._max.costeUnitario ?? 0)]));

  let venta = 0;
  let coste = 0;
  const porLocal = new Map<string, { local: string; importe: number; lineas: number }>();
  for (const l of lineasMes) {
    const cantidad = Number(l.servida ?? l.pedida);
    const costeUnidad = costeServido.get(`${l.pedido.id}:${l.productoId}`) ?? Number(l.producto.costeUnitario);
    const precio = l.precio != null ? Number(l.precio) : costeUnidad;
    venta += cantidad * precio;
    coste += cantidad * costeUnidad;
    const x = porLocal.get(l.pedido.destinoId) ?? { local: l.pedido.destino.nombre, importe: 0, lineas: 0 };
    x.importe += cantidad * precio;
    x.lineas += 1;
    porLocal.set(l.pedido.destinoId, x);
  }
  return {
    hoy,
    ordenesHoy,
    lotesCaducan,
    venta,
    margen: venta - coste,
    porLocal: Array.from(porLocal.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.importe - a.importe),
    pedidosPendientes: pendientes,
  };
}
