import "server-only";
/**
 * Carta y escandallos (sección del módulo Comidas). Lógica de negocio.
 * Ver docs/specs/modulos/comidas/carta-escandallos.md
 *
 * Exporta para otros módulos:
 *  - alergenosDeProductos / fijarAlergenosProducto (Obrador hereda y publica alérgenos de sus elaborados)
 *  - costeYAlergenosEscandallo (cálculo común de coste por ingredientes)
 */
import { db } from "@/kernel/db";
import type { Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import type { Tx } from "@/nucleo/movimientos";
import { productosElaboradosIds } from "@/modulos/obrador/servicio";
import { cantidadBruta, normalizarAlergenos, porcentajeCoste, unirAlergenos } from "./carta-alergenos";
import {
  esquemaCarta,
  esquemaIngrediente,
  esquemaLineaIngrediente,
  esquemaObjetivo,
  esquemaPlato,
  esquemaPrecioCentro,
  esquemaRecargo,
  esquemaSeccion,
} from "./carta-esquemas";

export class ErrorCarta extends Error {}

const OBJETIVO_POR_DEFECTO = 30;

function fechaDeTexto(s?: string): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

function hoyMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Alérgenos por producto (los usa también Obrador)
// ---------------------------------------------------------------------------

export async function alergenosDeProductos(tx: Tx, tenantId: string, productoIds: string[]) {
  const mapa = new Map<string, { alergenos: string[]; trazas: string[] }>();
  if (productoIds.length === 0) return mapa;
  const filas = await tx.cartaAlergenoProducto.findMany({ where: { tenantId, productoId: { in: productoIds } } });
  for (const f of filas) mapa.set(f.productoId, { alergenos: f.alergenos, trazas: f.trazas });
  return mapa;
}

export async function fijarAlergenosProducto(tx: Tx, tenantId: string, productoId: string, alergenos: string[], trazas: string[] = []) {
  const a = normalizarAlergenos(alergenos);
  const t = normalizarAlergenos(trazas).filter((x) => !a.includes(x));
  await tx.cartaAlergenoProducto.upsert({
    where: { tenantId_productoId: { tenantId, productoId } },
    create: { tenantId, productoId, alergenos: a, trazas: t },
    update: { alergenos: a, trazas: t },
  });
}

// ---------------------------------------------------------------------------
// Cálculo de escandallo
// ---------------------------------------------------------------------------

export interface LineaEscandallo {
  id: string;
  productoId: string;
  producto: string;
  referencia: string;
  unidad: string;
  elaborado: boolean;
  cantidad: number; // neta
  mermaPct: number;
  bruta: number;
  costeMedio: number; // €/unidad
  costeUltimo: number; // €/unidad
  importeMedio: number;
  importeUltimo: number;
  alergenos: string[];
  trazas: string[];
}

/** Último coste de entrada (compra o producción) de cada producto; si no hay, el medio. */
async function ultimosCostes(tx: Tx, tenantId: string, productoIds: string[]) {
  const mapa = new Map<string, number>();
  if (productoIds.length === 0) return mapa;
  const movs = await tx.movimientoStock.findMany({
    where: { tenantId, productoId: { in: productoIds }, tipo: { in: ["ENTRADA_COMPRA", "PRODUCCION_ENTRADA", "CARGA_INICIAL"] } },
    orderBy: { createdAt: "desc" },
    distinct: ["productoId"],
    select: { productoId: true, costeUnitario: true },
  });
  for (const m of movs) mapa.set(m.productoId, Number(m.costeUnitario));
  return mapa;
}

/** Coste y alérgenos de una lista de ingredientes (neta + merma). */
export async function costeYAlergenosEscandallo(
  tx: Tx,
  tenantId: string,
  lineas: { id: string; productoId: string; cantidad: unknown; mermaPct: unknown }[],
) {
  const ids = Array.from(new Set(lineas.map((l) => l.productoId)));
  const [productos, ultimos, alerg, elaborados] = await Promise.all([
    tx.producto.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, nombre: true, referencia: true, unidad: true, costeUnitario: true } }),
    ultimosCostes(tx, tenantId, ids),
    alergenosDeProductos(tx, tenantId, ids),
    productosElaboradosIds(tx, tenantId),
  ]);
  const prod = new Map(productos.map((p) => [p.id, p]));
  const filas: LineaEscandallo[] = lineas.map((l) => {
    const p = prod.get(l.productoId);
    const cantidad = Number(l.cantidad);
    const mermaPct = Number(l.mermaPct ?? 0);
    const bruta = cantidadBruta(cantidad, mermaPct);
    const costeMedio = Number(p?.costeUnitario ?? 0);
    const costeUltimo = ultimos.get(l.productoId) ?? costeMedio;
    const a = alerg.get(l.productoId);
    return {
      id: l.id,
      productoId: l.productoId,
      producto: p?.nombre ?? "(producto borrado)",
      referencia: p?.referencia ?? "",
      unidad: p?.unidad ?? "UD",
      elaborado: elaborados.has(l.productoId),
      cantidad,
      mermaPct,
      bruta,
      costeMedio,
      costeUltimo,
      importeMedio: bruta * costeMedio,
      importeUltimo: bruta * costeUltimo,
      alergenos: a?.alergenos ?? [],
      trazas: a?.trazas ?? [],
    };
  });
  return {
    lineas: filas,
    costeMedio: filas.reduce((s, f) => s + f.importeMedio, 0),
    costeUltimo: filas.reduce((s, f) => s + f.importeUltimo, 0),
    alergenos: unirAlergenos(...filas.map((f) => f.alergenos)),
    trazas: unirAlergenos(...filas.map((f) => f.trazas)),
    sinCoste: filas.filter((f) => f.costeMedio <= 0).map((f) => f.producto),
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function marcasDeLaCadena(ctx: Contexto) {
  const prisma = await db();
  const [marcas, objetivos] = await Promise.all([
    prisma.marca.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.cartaObjetivoMarca.findMany({ where: { tenantId: ctx.tenant.id } }),
  ]);
  const obj = new Map(objetivos.map((o) => [o.marcaId, Number(o.objetivoCostePct)]));
  return marcas.map((m) => ({ ...m, objetivo: obj.get(m.id) ?? OBJETIVO_POR_DEFECTO }));
}

/** Marca del centro elegido arriba (para filtrar la carta), o null. */
export async function marcaDelCentroActivo(ctx: Contexto): Promise<string | null> {
  if (!ctx.centroActivo) return null;
  const prisma = await db();
  const c = await prisma.centro.findFirst({ where: { id: ctx.centroActivo.id, tenantId: ctx.tenant.id }, select: { marcaId: true } });
  return c?.marcaId ?? null;
}

export async function localesDeMarca(ctx: Contexto, marcaId: string) {
  const prisma = await db();
  return prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, marcaId, tipo: "LOCAL", estado: { not: "CERRADO" } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, codigo: true },
  });
}

/** Catálogo de ingredientes para el escandallo: Comidas y Bebidas (los elaborados del obrador son productos de Comidas). */
export async function catalogoIngredientes(ctx: Contexto) {
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
  }));
}

export interface ResumenPlato {
  id: string;
  marcaId: string;
  marca: string;
  nombre: string;
  nombreEn: string | null;
  descripcion: string | null;
  descripcionEn: string | null;
  precio: number; // de la marca
  precioLocal: number | null; // del centro activo, si lo cambia
  disponibleLocal: boolean;
  iva: number;
  coste: number;
  costeUltimo: number;
  pctCoste: number;
  objetivo: number;
  sobreObjetivo: boolean;
  alergenos: string[];
  trazas: string[];
  alergenosHeredados: string[];
  faltanAlergenos: string[]; // heredados del escandallo que no están declarados
  alergenosRevisados: boolean;
  etiquetas: string[];
  ingredientes: LineaEscandallo[];
  sinCoste: string[];
  activo: boolean;
  enCartas: string[];
}

export async function listarPlatos(ctx: Contexto, filtro: { marcaId?: string | null; q?: string; incluirInactivos?: boolean; soloIds?: string[] }) {
  const prisma = await db();
  const t = ctx.tenant.id;
  const [platos, marcas] = await Promise.all([
    prisma.cartaPlato.findMany({
      where: {
        tenantId: t,
        ...(filtro.marcaId ? { marcaId: filtro.marcaId } : {}),
        ...(filtro.incluirInactivos ? {} : { activo: true }),
        ...(filtro.q ? { OR: [{ nombre: { contains: filtro.q, mode: "insensitive" } }, { nombreEn: { contains: filtro.q, mode: "insensitive" } }] } : {}),
        ...(filtro.soloIds ? { id: { in: filtro.soloIds } } : {}),
      },
      include: { ingredientes: { orderBy: { orden: "asc" } }, precios: true, lineas: { include: { seccion: { include: { carta: { select: { nombre: true } } } } } } },
      orderBy: [{ marcaId: "asc" }, { nombre: "asc" }],
    }),
    marcasDeLaCadena(ctx),
  ]);
  const marcaMapa = new Map(marcas.map((m) => [m.id, m]));
  const centroId = ctx.centroActivo?.id;

  // Un solo cálculo con todas las líneas de todos los platos
  const todas = platos.flatMap((p) => p.ingredientes.map((i) => ({ id: i.id, productoId: i.productoId, cantidad: i.cantidad, mermaPct: i.mermaPct })));
  const calc = await costeYAlergenosEscandallo(prisma, t, todas);
  const porLinea = new Map(calc.lineas.map((l) => [l.id, l]));

  return platos.map<ResumenPlato>((p) => {
    const lineas = p.ingredientes.map((i) => porLinea.get(i.id)!).filter(Boolean);
    const coste = lineas.reduce((s, l) => s + l.importeMedio, 0);
    const costeUltimo = lineas.reduce((s, l) => s + l.importeUltimo, 0);
    const m = marcaMapa.get(p.marcaId);
    const ajuste = centroId ? p.precios.find((x) => x.centroId === centroId) : undefined;
    const precioLocal = ajuste?.precio != null ? Number(ajuste.precio) : null;
    const precio = Number(p.precio);
    const iva = Number(p.iva);
    const pct = porcentajeCoste(coste, precioLocal ?? precio, iva);
    const objetivo = m?.objetivo ?? OBJETIVO_POR_DEFECTO;
    const heredados = unirAlergenos(...lineas.map((l) => l.alergenos));
    return {
      id: p.id,
      marcaId: p.marcaId,
      marca: m?.nombre ?? "—",
      nombre: p.nombre,
      nombreEn: p.nombreEn,
      descripcion: p.descripcion,
      descripcionEn: p.descripcionEn,
      precio,
      precioLocal,
      disponibleLocal: ajuste ? ajuste.disponible : true,
      iva,
      coste,
      costeUltimo,
      pctCoste: pct,
      objetivo,
      sobreObjetivo: coste > 0 && pct > objetivo,
      alergenos: p.alergenos,
      trazas: p.trazas,
      alergenosHeredados: heredados,
      faltanAlergenos: heredados.filter((a) => !p.alergenos.includes(a)),
      alergenosRevisados: p.alergenosRevisados,
      etiquetas: p.etiquetas,
      ingredientes: lineas,
      sinCoste: lineas.filter((l) => l.costeMedio <= 0).map((l) => l.producto),
      activo: p.activo,
      enCartas: Array.from(new Set(p.lineas.map((l) => l.seccion.carta.nombre))),
    };
  });
}

export async function fichaPlato(ctx: Contexto, id: string) {
  const [plato] = await listarPlatos(ctx, { soloIds: [id], incluirInactivos: true });
  if (!plato) return null;
  const prisma = await db();
  const [precios, locales] = await Promise.all([
    prisma.cartaPlatoPrecio.findMany({ where: { platoId: id } }),
    localesDeMarca(ctx, plato.marcaId),
  ]);
  const ajustes = new Map(precios.map((p) => [p.centroId, p]));
  const porLocal = locales.map((l) => {
    const a = ajustes.get(l.id);
    const precio = a?.precio != null ? Number(a.precio) : plato.precio;
    return {
      ...l,
      precioPropio: a?.precio != null ? Number(a.precio) : null,
      precio,
      disponible: a ? a.disponible : true,
      pctCoste: porcentajeCoste(plato.coste, precio, plato.iva),
    };
  });
  return { plato, porLocal };
}

export async function listarCartas(ctx: Contexto, marcaId?: string | null) {
  const prisma = await db();
  const [cartas, marcas] = await Promise.all([
    prisma.carta.findMany({
      where: { tenantId: ctx.tenant.id, ...(marcaId ? { marcaId } : {}) },
      include: {
        secciones: {
          orderBy: { orden: "asc" },
          include: { lineas: { orderBy: { orden: "asc" }, include: { plato: { select: { id: true, nombre: true, precio: true, activo: true, alergenos: true } } } } },
        },
      },
      orderBy: [{ activo: "desc" }, { tipo: "asc" }, { nombre: "asc" }],
    }),
    marcasDeLaCadena(ctx),
  ]);
  const nombres = new Map(marcas.map((m) => [m.id, m.nombre]));
  const hoy = hoyMadrid();
  return cartas.map((c) => {
    const desde = c.desde ? c.desde.toISOString().slice(0, 10) : null;
    const hasta = c.hasta ? c.hasta.toISOString().slice(0, 10) : null;
    const vigente = c.activo && (c.tipo === "PERMANENTE" || ((!desde || desde <= hoy) && (!hasta || hasta >= hoy)));
    const proxima = c.activo && c.tipo === "TEMPORAL" && !!desde && desde > hoy;
    return {
      ...c,
      marca: nombres.get(c.marcaId) ?? "—",
      vigente,
      proxima,
      totalPlatos: c.secciones.reduce((s, x) => s + x.lineas.length, 0),
    };
  });
}

export async function listarRecargos(ctx: Contexto) {
  const prisma = await db();
  const locales = await prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, tipo: "LOCAL", estado: { not: "CERRADO" }, id: { in: ctx.centroActivo ? [ctx.centroActivo.id] : ctx.centros.map((c) => c.id) } },
    include: { marca: { select: { nombre: true } } },
    orderBy: [{ marcaId: "asc" }, { nombre: "asc" }],
  });
  const recargos = await prisma.cartaRecargo.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: locales.map((l) => l.id) }, concepto: "Pan y aperitivo" } });
  const mapa = new Map(recargos.map((r) => [r.centroId, r]));
  return locales.map((l) => {
    const r = mapa.get(l.id);
    return { centroId: l.id, local: l.nombre, codigo: l.codigo, marca: l.marca?.nombre ?? "—", importe: r ? Number(r.importe) : null, iva: r ? Number(r.iva) : 10, activo: r?.activo ?? false, actualizado: r?.updatedAt ?? null };
  });
}

/** Productos de Comidas con sus alérgenos declarados (para revisar los de los ingredientes). */
export async function productosConAlergenos(ctx: Contexto, q?: string) {
  const prisma = await db();
  const [productos, elaborados] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId: ctx.tenant.id, area: "COMIDAS", activo: true, ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {}) },
      include: { familia: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    productosElaboradosIds(prisma, ctx.tenant.id),
  ]);
  const alerg = await alergenosDeProductos(prisma, ctx.tenant.id, productos.map((p) => p.id));
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    referencia: p.referencia,
    familia: p.familia?.nombre ?? "—",
    elaborado: elaborados.has(p.id),
    declarado: alerg.has(p.id),
    alergenos: alerg.get(p.id)?.alergenos ?? [],
    trazas: alerg.get(p.id)?.trazas ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

async function platoDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const p = await tx.cartaPlato.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!p) throw new ErrorCarta("El plato no existe");
  return p;
}

async function comprobarMarca(tx: Tx, ctx: Contexto, marcaId: string) {
  const m = await tx.marca.findFirst({ where: { id: marcaId, tenantId: ctx.tenant.id } });
  if (!m) throw new ErrorCarta("La marca no existe");
}

function etiquetasDeTexto(s?: string): string[] {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function crearPlato(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaPlato.parse(datos);
  const prisma = await db();
  await comprobarMarca(prisma, ctx, d.marcaId);
  const p = await prisma.cartaPlato.create({
    data: {
      tenantId: ctx.tenant.id,
      marcaId: d.marcaId,
      nombre: d.nombre,
      nombreEn: d.nombreEn,
      descripcion: d.descripcion,
      descripcionEn: d.descripcionEn,
      precio: d.precio,
      iva: d.iva,
      etiquetas: etiquetasDeTexto(d.etiquetas),
      alergenos: [],
      trazas: [],
    },
  });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaPlato", entidadId: p.id, accion: "crear", despues: { nombre: p.nombre, precio: d.precio } });
  return p.id;
}

export async function actualizarPlato(ctx: Contexto, id: string, datos: Record<string, unknown>) {
  const d = esquemaPlato.parse(datos);
  const prisma = await db();
  const antes = await platoDeLaCadena(prisma, ctx, id);
  await comprobarMarca(prisma, ctx, d.marcaId);
  await prisma.cartaPlato.update({
    where: { id },
    data: {
      marcaId: d.marcaId,
      nombre: d.nombre,
      nombreEn: d.nombreEn ?? null,
      descripcion: d.descripcion ?? null,
      descripcionEn: d.descripcionEn ?? null,
      precio: d.precio,
      iva: d.iva,
      etiquetas: etiquetasDeTexto(d.etiquetas),
    },
  });
  if (Number(antes.precio) !== d.precio || Number(antes.iva) !== d.iva)
    await auditar(prisma, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "CartaPlato",
      entidadId: id,
      accion: "cambiar precio",
      antes: { precio: Number(antes.precio), iva: Number(antes.iva) },
      despues: { precio: d.precio, iva: d.iva },
    });
}

export async function cambiarActivoPlato(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await platoDeLaCadena(prisma, ctx, id);
  await prisma.cartaPlato.update({ where: { id }, data: { activo } });
}

export async function fijarAlergenosPlato(ctx: Contexto, id: string, alergenos: string[], trazas: string[], revisados: boolean) {
  const prisma = await db();
  const antes = await platoDeLaCadena(prisma, ctx, id);
  const a = normalizarAlergenos(alergenos);
  const t = normalizarAlergenos(trazas).filter((x) => !a.includes(x));
  await prisma.cartaPlato.update({ where: { id }, data: { alergenos: a, trazas: t, alergenosRevisados: revisados } });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaPlato",
    entidadId: id,
    accion: "alérgenos",
    antes: { alergenos: antes.alergenos, trazas: antes.trazas, revisados: antes.alergenosRevisados },
    despues: { alergenos: a, trazas: t, revisados },
  });
}

/** Copia al plato los alérgenos y trazas que vienen de sus ingredientes (queda pendiente de revisar). */
export async function heredarAlergenosPlato(ctx: Contexto, id: string) {
  const prisma = await db();
  const plato = await platoDeLaCadena(prisma, ctx, id);
  const lineas = await prisma.cartaPlatoIngrediente.findMany({ where: { platoId: id } });
  const calc = await costeYAlergenosEscandallo(prisma, ctx.tenant.id, lineas);
  const alergenos = unirAlergenos(plato.alergenos, calc.alergenos);
  const trazas = unirAlergenos(plato.trazas, calc.trazas).filter((x) => !alergenos.includes(x));
  await prisma.cartaPlato.update({ where: { id }, data: { alergenos, trazas, alergenosRevisados: false } });
}

export async function anadirIngrediente(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaIngrediente.parse(datos);
  const prisma = await db();
  await platoDeLaCadena(prisma, ctx, d.platoId);
  const prod = await prisma.producto.findFirst({ where: { id: d.productoId, tenantId: ctx.tenant.id } });
  if (!prod) throw new ErrorCarta("El ingrediente no existe en el catálogo");
  const ultimo = await prisma.cartaPlatoIngrediente.aggregate({ where: { platoId: d.platoId }, _max: { orden: true } });
  await prisma.cartaPlatoIngrediente.create({
    data: { platoId: d.platoId, productoId: d.productoId, cantidad: d.cantidad, mermaPct: d.mermaPct ?? 0, orden: (ultimo._max.orden ?? 0) + 1 },
  });
  // un ingrediente nuevo puede traer alérgenos: el plato vuelve a estar pendiente de revisar
  await prisma.cartaPlato.update({ where: { id: d.platoId }, data: { alergenosRevisados: false } });
}

async function lineaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const l = await tx.cartaPlatoIngrediente.findFirst({ where: { id, plato: { tenantId: ctx.tenant.id } } });
  if (!l) throw new ErrorCarta("La línea del escandallo no existe");
  return l;
}

export async function actualizarIngrediente(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaLineaIngrediente.parse(datos);
  const prisma = await db();
  await lineaDeLaCadena(prisma, ctx, d.id);
  await prisma.cartaPlatoIngrediente.update({ where: { id: d.id }, data: { cantidad: d.cantidad, mermaPct: d.mermaPct ?? 0 } });
}

export async function quitarIngrediente(ctx: Contexto, id: string) {
  const prisma = await db();
  const l = await lineaDeLaCadena(prisma, ctx, id);
  await prisma.cartaPlatoIngrediente.delete({ where: { id: l.id } });
  return l.platoId;
}

export async function fijarPrecioCentro(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaPrecioCentro.parse(datos);
  const prisma = await db();
  const plato = await platoDeLaCadena(prisma, ctx, d.platoId);
  const centro = await prisma.centro.findFirst({ where: { id: d.centroId, tenantId: ctx.tenant.id, marcaId: plato.marcaId } });
  if (!centro) throw new ErrorCarta("El local no es de la marca del plato");
  const antes = await prisma.cartaPlatoPrecio.findUnique({ where: { platoId_centroId: { platoId: d.platoId, centroId: d.centroId } } });
  await prisma.cartaPlatoPrecio.upsert({
    where: { platoId_centroId: { platoId: d.platoId, centroId: d.centroId } },
    create: { platoId: d.platoId, centroId: d.centroId, precio: d.precio ?? null, disponible: d.disponible },
    update: { precio: d.precio ?? null, disponible: d.disponible },
  });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaPlatoPrecio",
    entidadId: `${d.platoId}:${d.centroId}`,
    accion: "precio por local",
    antes: antes ? { precio: antes.precio ? Number(antes.precio) : null, disponible: antes.disponible } : null,
    despues: { precio: d.precio ?? null, disponible: d.disponible },
  });
}

export async function fijarObjetivoMarca(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaObjetivo.parse(datos);
  const prisma = await db();
  await comprobarMarca(prisma, ctx, d.marcaId);
  await prisma.cartaObjetivoMarca.upsert({
    where: { tenantId_marcaId: { tenantId: ctx.tenant.id, marcaId: d.marcaId } },
    create: { tenantId: ctx.tenant.id, marcaId: d.marcaId, objetivoCostePct: d.objetivoCostePct },
    update: { objetivoCostePct: d.objetivoCostePct },
  });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaObjetivoMarca", entidadId: d.marcaId, accion: "objetivo de coste", despues: { pct: d.objetivoCostePct } });
}

export async function crearCarta(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaCarta.parse(datos);
  const prisma = await db();
  await comprobarMarca(prisma, ctx, d.marcaId);
  const c = await prisma.carta.create({
    data: { tenantId: ctx.tenant.id, marcaId: d.marcaId, nombre: d.nombre, tipo: d.tipo, desde: fechaDeTexto(d.desde), hasta: fechaDeTexto(d.hasta) },
  });
  return c.id;
}

async function cartaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const c = await tx.carta.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!c) throw new ErrorCarta("La carta no existe");
  return c;
}

export async function actualizarCarta(ctx: Contexto, id: string, datos: Record<string, unknown>) {
  const d = esquemaCarta.parse(datos);
  const prisma = await db();
  await cartaDeLaCadena(prisma, ctx, id);
  await prisma.carta.update({ where: { id }, data: { nombre: d.nombre, tipo: d.tipo, desde: fechaDeTexto(d.desde), hasta: fechaDeTexto(d.hasta) } });
}

export async function cambiarActivoCarta(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await cartaDeLaCadena(prisma, ctx, id);
  await prisma.carta.update({ where: { id }, data: { activo } });
}

export async function crearSeccion(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaSeccion.parse(datos);
  const prisma = await db();
  await cartaDeLaCadena(prisma, ctx, d.cartaId);
  const ultimo = await prisma.cartaSeccion.aggregate({ where: { cartaId: d.cartaId }, _max: { orden: true } });
  await prisma.cartaSeccion.create({ data: { cartaId: d.cartaId, nombre: d.nombre, nombreEn: d.nombreEn, orden: (ultimo._max.orden ?? 0) + 1 } });
}

async function seccionDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const s = await tx.cartaSeccion.findFirst({ where: { id, carta: { tenantId: ctx.tenant.id } }, include: { carta: true } });
  if (!s) throw new ErrorCarta("La sección no existe");
  return s;
}

export async function quitarSeccion(ctx: Contexto, id: string) {
  const prisma = await db();
  const s = await seccionDeLaCadena(prisma, ctx, id);
  await prisma.cartaSeccion.delete({ where: { id: s.id } }); // borra sus enlaces a platos; los platos se quedan
}

export async function anadirPlatoSeccion(ctx: Contexto, seccionId: string, platoId: string) {
  const prisma = await db();
  const s = await seccionDeLaCadena(prisma, ctx, seccionId);
  const plato = await platoDeLaCadena(prisma, ctx, platoId);
  if (plato.marcaId !== s.carta.marcaId) throw new ErrorCarta("El plato es de otra marca");
  const existe = await prisma.cartaLinea.findUnique({ where: { seccionId_platoId: { seccionId, platoId } } });
  if (existe) throw new ErrorCarta("El plato ya está en esa sección");
  const ultimo = await prisma.cartaLinea.aggregate({ where: { seccionId }, _max: { orden: true } });
  await prisma.cartaLinea.create({ data: { seccionId, platoId, orden: (ultimo._max.orden ?? 0) + 1 } });
}

export async function quitarPlatoSeccion(ctx: Contexto, lineaId: string) {
  const prisma = await db();
  const l = await prisma.cartaLinea.findFirst({ where: { id: lineaId, seccion: { carta: { tenantId: ctx.tenant.id } } } });
  if (!l) throw new ErrorCarta("La línea no existe");
  await prisma.cartaLinea.delete({ where: { id: l.id } });
}

export async function fijarRecargo(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaRecargo.parse(datos);
  const prisma = await db();
  if (!ctx.centros.some((c) => c.id === d.centroId)) throw new ErrorCarta("No tienes acceso a ese local");
  const antes = await prisma.cartaRecargo.findUnique({ where: { tenantId_centroId_concepto: { tenantId: ctx.tenant.id, centroId: d.centroId, concepto: "Pan y aperitivo" } } });
  await prisma.cartaRecargo.upsert({
    where: { tenantId_centroId_concepto: { tenantId: ctx.tenant.id, centroId: d.centroId, concepto: "Pan y aperitivo" } },
    create: { tenantId: ctx.tenant.id, centroId: d.centroId, concepto: "Pan y aperitivo", importe: d.importe, iva: d.iva, activo: d.activo },
    update: { importe: d.importe, iva: d.iva, activo: d.activo },
  });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaRecargo",
    entidadId: d.centroId,
    accion: "recargo pan y aperitivo",
    antes: antes ? { importe: Number(antes.importe), activo: antes.activo } : null,
    despues: { importe: d.importe, activo: d.activo },
  });
}

export async function guardarAlergenosProducto(ctx: Contexto, productoId: string, alergenos: string[], trazas: string[]) {
  const prisma = await db();
  const p = await prisma.producto.findFirst({ where: { id: productoId, tenantId: ctx.tenant.id } });
  if (!p) throw new ErrorCarta("El producto no existe");
  await fijarAlergenosProducto(prisma, ctx.tenant.id, productoId, alergenos, trazas);
  // los platos que lo llevan quedan pendientes de revisar
  await prisma.cartaPlato.updateMany({ where: { tenantId: ctx.tenant.id, ingredientes: { some: { productoId } } }, data: { alergenosRevisados: false } });
}
