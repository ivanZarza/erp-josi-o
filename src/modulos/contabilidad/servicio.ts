import "server-only";
/**
 * Lógica de Contabilidad. Todo va por sociedad (lo fiscal) y, si se sabe, por centro (lo de gestión).
 * El ERP NO lleva la contabilidad oficial ni emite facturas certificadas (Verifactu, P-23):
 * registra, prepara y exporta para la gestoría.
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { fecha as fechaEs, euros, numero as numeroEs } from "@/kernel/formato";
import type { Prisma, GrupoCategoriaContable } from "@/generated/prisma/client";
import {
  FacturaRecibidaEsquema,
  FacturaEmitidaEsquema,
  GastoEsquema,
  PagoEsquema,
  CategoriaEsquema,
  EmitidaFueraEsquema,
  type LineaFactura,
} from "./esquemas";

/** Error que se enseña tal cual al usuario. */
export class ErrorContable extends Error {}

// ---------- utilidades ----------

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** «2026-11-08» → fecha a medianoche UTC (columnas @db.Date). */
export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Hoy en Madrid como «AAAA-MM-DD». */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** «2026-11» → primer día del mes y primer día del mes siguiente (UTC). */
export function rangoMes(mes: string): { desde: Date; hasta: Date } {
  const [a, m] = mes.split("-").map(Number);
  return { desde: new Date(Date.UTC(a, m - 1, 1)), hasta: new Date(Date.UTC(a, m, 1)) };
}

export function mesActual(): string {
  return hoyISO().slice(0, 7);
}

function calcularLineas(lineas: LineaFactura[]) {
  const calculadas = lineas.map((l, i) => {
    const base = redondear(l.cantidad * l.precio);
    const cuotaIva = redondear((base * l.tipoIva) / 100);
    return { ...l, base, cuotaIva, orden: i };
  });
  const base = redondear(calculadas.reduce((s, l) => s + l.base, 0));
  const cuotaIva = redondear(calculadas.reduce((s, l) => s + l.cuotaIva, 0));
  return { lineas: calculadas, base, cuotaIva, total: redondear(base + cuotaIva) };
}

// ---------- ámbito: qué sociedades y centros ve el usuario ----------

export interface Ambito {
  centroIds: string[];
  sociedadIds: string[];
  /** filtro Prisma para tablas con sociedadId y centroId opcional */
  donde: (sociedadId?: string) => { tenantId: string; sociedadId: string | { in: string[] }; OR: ({ centroId: { in: string[] } } | { centroId: null })[] };
}

export async function ambito(ctx: Contexto): Promise<Ambito> {
  const prisma = await db();
  const centroIds = centrosFiltro(ctx);
  const centros = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: centroIds } }, select: { sociedadId: true } });
  const sociedadIds = Array.from(new Set(centros.map((c) => c.sociedadId).filter((s): s is string => !!s)));
  return {
    centroIds,
    sociedadIds,
    donde: (sociedadId) => ({
      tenantId: ctx.tenant.id,
      sociedadId: sociedadId && sociedadIds.includes(sociedadId) ? sociedadId : { in: sociedadIds },
      // con un centro elegido, solo lo de ese centro; con «todos», también lo de la sociedad sin centro
      OR: [{ centroId: { in: centroIds } }, ...(ctx.centroActivo ? [] : [{ centroId: null }])],
    }),
  };
}

export async function sociedadesVisibles(ctx: Contexto) {
  const prisma = await db();
  const { sociedadIds } = await ambito(ctx);
  return prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id, id: { in: sociedadIds } }, orderBy: { razonSocial: "asc" } });
}

/** Nombres de sociedades, centros y categorías para pintar listados. */
export async function diccionarios(ctx: Contexto) {
  const prisma = await db();
  const [sociedades, centros, categorias, proveedores] = await Promise.all([
    prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, razonSocial: true, cif: true } }),
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, nombre: true, codigo: true, sociedadId: true } }),
    prisma.categoriaContable.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    prisma.proveedor.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, select: { id: true, nombre: true, cif: true }, orderBy: { nombre: "asc" } }),
  ]);
  return {
    sociedades: new Map(sociedades.map((s) => [s.id, s])),
    centros: new Map(centros.map((c) => [c.id, c])),
    categorias: new Map(categorias.map((c) => [c.id, c])),
    listaCategorias: categorias.filter((c) => c.activo),
    proveedores,
  };
}

async function comprobarSociedadCentro(ctx: Contexto, sociedadId: string, centroId?: string) {
  const a = await ambito(ctx);
  if (!a.sociedadIds.includes(sociedadId)) throw new ErrorContable("No puedes registrar en esa sociedad.");
  if (centroId) {
    if (!ctx.centros.some((c) => c.id === centroId)) throw new ErrorContable("No puedes registrar en ese centro.");
    const prisma = await db();
    const c = await prisma.centro.findFirst({ where: { id: centroId, tenantId: ctx.tenant.id }, select: { sociedadId: true } });
    if (c?.sociedadId !== sociedadId) throw new ErrorContable("Ese centro no pertenece a la sociedad elegida.");
  }
}

// ---------- categorías ----------

export const CATEGORIAS_BASICAS: { codigo: string; nombre: string; grupo: GrupoCategoriaContable }[] = [
  { codigo: "MERC-BEB", nombre: "Mercancía de bebidas", grupo: "MERCANCIA" },
  { codigo: "MERC-COM", nombre: "Mercancía de comida", grupo: "MERCANCIA" },
  { codigo: "MERC-CONS", nombre: "Consumibles y menaje", grupo: "MERCANCIA" },
  { codigo: "PERS", nombre: "Personal", grupo: "PERSONAL" },
  { codigo: "ALQ", nombre: "Alquiler", grupo: "GASTO_FIJO" },
  { codigo: "SUM", nombre: "Suministros (luz, agua, gas)", grupo: "GASTO_FIJO" },
  { codigo: "SEG", nombre: "Seguros", grupo: "GASTO_FIJO" },
  { codigo: "TEL", nombre: "Teléfono e internet", grupo: "GASTO_FIJO" },
  { codigo: "ASES", nombre: "Gestoría y asesoría", grupo: "GASTO_FIJO" },
  { codigo: "MANT", nombre: "Mantenimiento y reparaciones", grupo: "GASTO_VARIABLE" },
  { codigo: "LIMP", nombre: "Limpieza", grupo: "GASTO_VARIABLE" },
  { codigo: "PUBL", nombre: "Publicidad y marketing", grupo: "GASTO_VARIABLE" },
  { codigo: "COMI", nombre: "Comisiones bancarias y de tarjeta", grupo: "GASTO_VARIABLE" },
  { codigo: "OTROS", nombre: "Otros gastos", grupo: "GASTO_VARIABLE" },
];

export const NOMBRE_GRUPO: Record<GrupoCategoriaContable, string> = {
  MERCANCIA: "Mercancía",
  PERSONAL: "Personal",
  GASTO_FIJO: "Gasto fijo",
  GASTO_VARIABLE: "Gasto variable",
  INGRESO: "Ingreso",
};

export async function crearCategoriasBasicas(ctx: Contexto) {
  const prisma = await db();
  await prisma.categoriaContable.createMany({
    data: CATEGORIAS_BASICAS.map((c, i) => ({ ...c, tenantId: ctx.tenant.id, orden: i })),
    skipDuplicates: true,
  });
}

export async function crearCategoria(ctx: Contexto, entrada: unknown) {
  const d = CategoriaEsquema.parse(entrada);
  const prisma = await db();
  const existe = await prisma.categoriaContable.findFirst({ where: { tenantId: ctx.tenant.id, codigo: d.codigo } });
  if (existe) throw new ErrorContable(`Ya hay una categoría con el código ${d.codigo}.`);
  const max = await prisma.categoriaContable.aggregate({ where: { tenantId: ctx.tenant.id }, _max: { orden: true } });
  await prisma.categoriaContable.create({ data: { ...d, tenantId: ctx.tenant.id, orden: (max._max.orden ?? 0) + 1 } });
}

export async function alternarCategoria(ctx: Contexto, id: string) {
  const prisma = await db();
  const c = await prisma.categoriaContable.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!c) throw new ErrorContable("Categoría no encontrada.");
  await prisma.categoriaContable.update({ where: { id }, data: { activo: !c.activo } });
}

// ---------- facturas recibidas ----------

export interface FiltroFacturas {
  sociedadId?: string;
  estado?: string;
  mes?: string;
}

export async function listarFacturasRecibidas(ctx: Contexto, f: FiltroFacturas = {}) {
  const prisma = await db();
  const a = await ambito(ctx);
  const where: Prisma.FacturaRecibidaWhereInput = { ...a.donde(f.sociedadId) };
  if (f.estado) where.estado = f.estado as Prisma.FacturaRecibidaWhereInput["estado"];
  if (f.mes) {
    const r = rangoMes(f.mes);
    where.fecha = { gte: r.desde, lt: r.hasta };
  }
  return prisma.facturaRecibida.findMany({ where, include: { lineas: { orderBy: { orden: "asc" } } }, orderBy: [{ fecha: "desc" }, { numero: "desc" }], take: 500 });
}

export async function crearFacturaRecibida(ctx: Contexto, entrada: unknown) {
  const d = FacturaRecibidaEsquema.parse(entrada);
  await comprobarSociedadCentro(ctx, d.sociedadId, d.centroId);
  const prisma = await db();
  let proveedorNombre = d.proveedorNombre;
  let proveedorCif = d.proveedorCif;
  if (d.proveedorId) {
    const p = await prisma.proveedor.findFirst({ where: { id: d.proveedorId, tenantId: ctx.tenant.id } });
    if (!p) throw new ErrorContable("Proveedor no encontrado.");
    proveedorNombre = p.nombre;
    proveedorCif = proveedorCif ?? p.cif ?? undefined;
  }
  if (!proveedorNombre) throw new ErrorContable("Elige un proveedor o escribe su nombre.");
  const duplicada = await prisma.facturaRecibida.findFirst({
    where: { tenantId: ctx.tenant.id, sociedadId: d.sociedadId, numeroProveedor: d.numeroProveedor, proveedorNombre, estado: { not: "ANULADA" } },
  });
  if (duplicada) throw new ErrorContable(`Esa factura ya está registrada (${duplicada.numero}).`);
  const c = calcularLineas(d.lineas);
  return prisma.$transaction(async (tx) => {
    const numero = await siguienteNumero(tx, ctx.tenant.id, "FR");
    const f = await tx.facturaRecibida.create({
      data: {
        tenantId: ctx.tenant.id,
        numero,
        numeroProveedor: d.numeroProveedor,
        proveedorId: d.proveedorId,
        proveedorNombre,
        proveedorCif,
        sociedadId: d.sociedadId,
        centroId: d.centroId,
        categoriaId: d.categoriaId,
        fecha: aFecha(d.fecha),
        vencimiento: d.vencimiento ? aFecha(d.vencimiento) : null,
        base: c.base,
        cuotaIva: c.cuotaIva,
        total: c.total,
        notas: d.notas,
        creadoPor: ctx.usuario.id,
        lineas: {
          create: c.lineas.map((l) => ({
            concepto: l.concepto,
            cantidad: l.cantidad,
            precio: l.precio,
            tipoIva: l.tipoIva,
            base: l.base,
            cuotaIva: l.cuotaIva,
            categoriaId: l.categoriaId ?? d.categoriaId,
            orden: l.orden,
          })),
        },
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: f.id, accion: "crear", despues: { numero, total: c.total } });
    return f;
  });
}

async function facturaRecibidaDelAmbito(ctx: Contexto, id: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const f = await prisma.facturaRecibida.findFirst({ where: { id, ...a.donde() } });
  if (!f) throw new ErrorContable("Factura no encontrada.");
  return f;
}

export async function validarFacturaRecibida(ctx: Contexto, id: string) {
  const f = await facturaRecibidaDelAmbito(ctx, id);
  if (f.estado !== "PENDIENTE") throw new ErrorContable("Solo se validan facturas pendientes de revisar.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaRecibida.update({ where: { id }, data: { estado: "VALIDADA", validadaPor: ctx.usuario.id, validadaEn: new Date() } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: id, accion: "validar", antes: { estado: f.estado }, despues: { estado: "VALIDADA" } });
  });
}

export async function pagarFacturaRecibida(ctx: Contexto, entrada: unknown) {
  const d = PagoEsquema.parse(entrada);
  const f = await facturaRecibidaDelAmbito(ctx, d.id);
  if (f.estado !== "VALIDADA") throw new ErrorContable("Primero hay que validar la factura; después se marca como pagada.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaRecibida.update({ where: { id: f.id }, data: { estado: "PAGADA", pagadaEn: aFecha(d.fecha) } });
    await tx.pagoCobro.create({
      data: { tenantId: ctx.tenant.id, sociedadId: f.sociedadId, tipo: "PAGO", fecha: aFecha(d.fecha), importe: f.total, forma: d.forma, facturaRecibidaId: f.id, referencia: d.referencia, usuarioId: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: f.id, accion: "pagar", antes: { estado: f.estado }, despues: { estado: "PAGADA", fecha: d.fecha, forma: d.forma } });
  });
}

export async function anularFacturaRecibida(ctx: Contexto, id: string) {
  const f = await facturaRecibidaDelAmbito(ctx, id);
  if (f.estado === "PAGADA") throw new ErrorContable("Una factura pagada no se anula: habría que registrar un abono.");
  if (f.estado === "ANULADA") return;
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaRecibida.update({ where: { id }, data: { estado: "ANULADA" } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: id, accion: "anular", antes: { estado: f.estado }, despues: { estado: "ANULADA" } });
  });
}

// ---------- revisión de facturas recibidas: cruce con los albaranes y duplicadas ----------

export interface AvisoFactura {
  tono: "aviso" | "error";
  texto: string;
}

type FacturaParaRevisar = {
  id: string;
  numero: string;
  numeroProveedor: string;
  proveedorId: string | null;
  proveedorNombre: string;
  sociedadId: string;
  centroId: string | null;
  fecha: Date;
  total: Prisma.Decimal | number;
  estado: string;
  pedidoCompraId: string | null;
  lineas: { concepto: string; cantidad: Prisma.Decimal | number; precio: Prisma.Decimal | number; productoId: string | null }[];
};

/** Número de factura sin guiones, barras ni espacios, para comparar «FHL-26/00395» con «FHL2600395». */
const numeroLimpio = (n: string) => n.toUpperCase().replace(/[^A-Z0-9]/g, "");
const DIA_MS = 86_400_000;

/**
 * Avisos de revisión de las facturas recibidas (idea aceptada «La factura no cuadra», catalogo.md §11):
 * - Cada línea con producto se compara con las compras recibidas (núcleo) del mismo proveedor y centro desde su
 *   factura anterior (sin contar abonos) hasta la fecha de la factura; si no hay anterior, 40 días; si la factura
 *   está enlazada a una compra, solo ese albarán. Avisa de precio distinto (más de 0,5 %), producto que no está en
 *   ningún albarán y cantidad facturada distinta de la recibida (sumando todas las entregas del periodo).
 * - Posible duplicada: otra factura no anulada del mismo proveedor y sociedad con el mismo número (sin signos)
 *   o con el mismo total y fecha a menos de 3 días.
 * Devuelve los avisos por id de factura (solo las que tienen alguno).
 */
export async function revisarFacturasRecibidas(tenantId: string, facturas: FacturaParaRevisar[]): Promise<Map<string, AvisoFactura[]>> {
  const avisos = new Map<string, AvisoFactura[]>();
  const activas = facturas.filter((f) => f.estado !== "ANULADA");
  if (activas.length === 0) return avisos;
  const prisma = await db();
  const tiempos = activas.map((f) => f.fecha.getTime());
  const minF = Math.min(...tiempos);
  const maxF = Math.max(...tiempos);
  const anadir = (id: string, a: AvisoFactura) => avisos.set(id, [...(avisos.get(id) ?? []), a]);

  // 1) Posibles duplicadas
  const otras = await prisma.facturaRecibida.findMany({
    where: { tenantId, estado: { not: "ANULADA" }, proveedorNombre: { in: Array.from(new Set(activas.map((f) => f.proveedorNombre))) }, fecha: { gte: new Date(minF - 5 * DIA_MS), lte: new Date(maxF + 5 * DIA_MS) } },
    select: { id: true, numero: true, numeroProveedor: true, proveedorNombre: true, sociedadId: true, fecha: true, total: true },
  });
  for (const f of activas) {
    const igual = otras.find(
      (o) =>
        o.id !== f.id &&
        o.sociedadId === f.sociedadId &&
        o.proveedorNombre === f.proveedorNombre &&
        (numeroLimpio(o.numeroProveedor) === numeroLimpio(f.numeroProveedor) || (Number(o.total) === Number(f.total) && Math.abs(o.fecha.getTime() - f.fecha.getTime()) <= 3 * DIA_MS)),
    );
    if (igual) anadir(f.id, { tono: "error", texto: `Posible duplicada de ${igual.numero} (nº del proveedor ${igual.numeroProveedor}, ${fechaEs(igual.fecha)}, ${euros(igual.total)}). Si es la misma, anula una de las dos.` });
  }

  // 2) Cruce con las compras recibidas del núcleo. Cada factura cubre los albaranes recibidos desde la factura
  //    anterior del mismo proveedor y centro hasta su fecha (o su albarán, si está enlazada a una compra).
  const conCompras = activas.filter((f) => f.proveedorId && f.centroId && f.lineas.some((l) => l.productoId));
  if (conCompras.length) {
    const proveedorIds = Array.from(new Set(conCompras.map((f) => f.proveedorId!)));
    const centroIds = Array.from(new Set(conCompras.map((f) => f.centroId!)));
    const [compras, anteriores] = await Promise.all([
      prisma.pedidoCompraLinea.findMany({
        where: {
          productoId: { in: Array.from(new Set(conCompras.flatMap((f) => f.lineas.map((l) => l.productoId).filter((x): x is string => !!x)))) },
          pedido: { tenantId, proveedorId: { in: proveedorIds }, centroId: { in: centroIds }, estado: { in: ["RECIBIDO", "RECIBIDO_PARCIAL"] }, recibidoEn: { gte: new Date(minF - 45 * DIA_MS), lte: new Date(maxF + DIA_MS) } },
        },
        select: { productoId: true, precio: true, cantidad: true, recibida: true, pedidoId: true, pedido: { select: { proveedorId: true, centroId: true, recibidoEn: true, albaran: true, numero: true } } },
      }),
      // facturas anteriores (sin abonos) para saber desde cuándo cuenta cada factura
      prisma.facturaRecibida.findMany({
        where: { tenantId, proveedorId: { in: proveedorIds }, centroId: { in: centroIds }, estado: { not: "ANULADA" }, total: { gt: 0 }, fecha: { gte: new Date(minF - 60 * DIA_MS), lt: new Date(maxF) } },
        select: { proveedorId: true, centroId: true, fecha: true },
      }),
    ]);
    for (const f of conCompras) {
      const previa = anteriores.filter((a) => a.proveedorId === f.proveedorId && a.centroId === f.centroId && a.fecha < f.fecha).reduce<number | null>((m, a) => Math.max(m ?? 0, a.fecha.getTime()), null);
      const desde = previa !== null ? previa + DIA_MS : f.fecha.getTime() - 40 * DIA_MS;
      const hasta = f.fecha.getTime() + DIA_MS;
      const suyas = compras.filter(
        (c) =>
          c.pedido.proveedorId === f.proveedorId &&
          c.pedido.centroId === f.centroId &&
          (f.pedidoCompraId ? c.pedidoId === f.pedidoCompraId : c.pedido.recibidoEn!.getTime() >= desde && c.pedido.recibidoEn!.getTime() < hasta),
      );
      let diferencia = 0;
      const lineas: AvisoFactura[] = [];
      const facturadoPorProducto = new Map<string, { concepto: string; cantidad: number; precio: number }>();
      for (const l of f.lineas) {
        const cantidad = Number(l.cantidad);
        const precio = Number(l.precio);
        if (!l.productoId || cantidad <= 0) continue; // los abonos no se cruzan
        const mismas = suyas.filter((c) => c.productoId === l.productoId);
        if (mismas.length === 0) {
          lineas.push({ tono: "aviso", texto: `${l.concepto}: no aparece en los albaranes de compra de este proveedor desde su factura anterior.` });
          continue;
        }
        const x = facturadoPorProducto.get(l.productoId) ?? { concepto: l.concepto, cantidad: 0, precio };
        x.cantidad += cantidad;
        facturadoPorProducto.set(l.productoId, x);
        if (!mismas.some((c) => Math.abs(Number(c.precio) - precio) <= Math.max(0.01, Number(c.precio) * 0.005))) {
          const ref = mismas.reduce((m, c) => (c.pedido.recibidoEn! > m.pedido.recibidoEn! ? c : m));
          const d = redondear((precio - Number(ref.precio)) * cantidad);
          diferencia += d;
          lineas.push({ tono: "aviso", texto: `${l.concepto}: facturado a ${euros(precio, 4)} y en el albarán ${ref.pedido.albaran ?? ref.pedido.numero} a ${euros(ref.precio, 4)} (${d > 0 ? "+" : ""}${euros(d)}).` });
        }
      }
      for (const [productoId, x] of facturadoPorProducto) {
        const recibido = suyas.filter((c) => c.productoId === productoId).reduce((s, c) => s + Number(c.recibida ?? c.cantidad), 0);
        if (Math.abs(x.cantidad - recibido) > 0.0005) {
          const d = redondear((x.cantidad - recibido) * x.precio);
          diferencia += d;
          lineas.push({ tono: "aviso", texto: `${x.concepto}: facturado ${numeroEs(x.cantidad, 3)} y recibido ${numeroEs(recibido, 3)} (${d > 0 ? "+" : ""}${euros(d)}).` });
        }
      }
      if (lineas.length) {
        anadir(f.id, { tono: "error", texto: `La factura no cuadra con los albaranes${diferencia ? `: ${euros(redondear(Math.abs(diferencia)))} sin IVA ${diferencia > 0 ? "de más (para reclamar un abono)" : "de menos"}` : ""}.` });
        for (const a of lineas) anadir(f.id, a);
      }
    }
  }
  return avisos;
}

// ---------- facturas emitidas (solo preparadas: NO certificadas) ----------

export async function listarFacturasEmitidas(ctx: Contexto, f: FiltroFacturas = {}) {
  const prisma = await db();
  const a = await ambito(ctx);
  const where: Prisma.FacturaEmitidaWhereInput = { ...a.donde(f.sociedadId) };
  if (f.estado) where.estado = f.estado as Prisma.FacturaEmitidaWhereInput["estado"];
  if (f.mes) {
    const r = rangoMes(f.mes);
    where.fecha = { gte: r.desde, lt: r.hasta };
  }
  return prisma.facturaEmitida.findMany({ where, include: { lineas: { orderBy: { orden: "asc" } } }, orderBy: [{ fecha: "desc" }, { referencia: "desc" }], take: 500 });
}

export async function crearFacturaEmitida(ctx: Contexto, entrada: unknown) {
  const d = FacturaEmitidaEsquema.parse(entrada);
  await comprobarSociedadCentro(ctx, d.sociedadId, d.centroId);
  if (d.origen === "ENTRE_SOCIEDADES" && !d.sociedadDestinoId) throw new ErrorContable("Indica la sociedad del grupo que recibe la factura.");
  if (d.sociedadDestinoId === d.sociedadId) throw new ErrorContable("La sociedad que factura y la que recibe no pueden ser la misma (eso es un traspaso interno, sin factura).");
  const c = calcularLineas(d.lineas);
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    // Referencia interna de borrador: NO es un número de factura (la serie oficial la da el programa certificado)
    const referencia = await siguienteNumero(tx, ctx.tenant.id, "PRE");
    const f = await tx.facturaEmitida.create({
      data: {
        tenantId: ctx.tenant.id,
        referencia,
        sociedadId: d.sociedadId,
        centroId: d.centroId,
        origen: d.origen,
        clienteNombre: d.clienteNombre,
        clienteCif: d.clienteCif,
        sociedadDestinoId: d.sociedadDestinoId,
        fecha: aFecha(d.fecha),
        vencimiento: d.vencimiento ? aFecha(d.vencimiento) : null,
        base: c.base,
        cuotaIva: c.cuotaIva,
        total: c.total,
        estado: "PREPARADA",
        notas: d.notas,
        creadoPor: ctx.usuario.id,
        lineas: { create: c.lineas.map((l) => ({ concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, tipoIva: l.tipoIva, base: l.base, cuotaIva: l.cuotaIva, orden: l.orden })) },
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: f.id, accion: "preparar", despues: { referencia, total: c.total } });
    return f;
  });
}

async function facturaEmitidaDelAmbito(ctx: Contexto, id: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const f = await prisma.facturaEmitida.findFirst({ where: { id, ...a.donde() } });
  if (!f) throw new ErrorContable("Factura no encontrada.");
  return f;
}

/** Apunta el número oficial que dio el programa certificado. */
export async function marcarEmitidaFuera(ctx: Contexto, entrada: unknown) {
  const d = EmitidaFueraEsquema.parse(entrada);
  const f = await facturaEmitidaDelAmbito(ctx, d.id);
  if (f.estado !== "PREPARADA" && f.estado !== "BORRADOR") throw new ErrorContable("Esta factura ya no está preparada.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaEmitida.update({ where: { id: f.id }, data: { estado: "EMITIDA_FUERA", numeroOficial: d.numeroOficial, programaEmisor: d.programaEmisor } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: f.id, accion: "emitida-fuera", despues: d });
  });
}

export async function cobrarFacturaEmitida(ctx: Contexto, entrada: unknown) {
  const d = PagoEsquema.parse(entrada);
  const f = await facturaEmitidaDelAmbito(ctx, d.id);
  if (f.estado !== "EMITIDA_FUERA") throw new ErrorContable("Solo se cobra una factura ya emitida en el programa certificado.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaEmitida.update({ where: { id: f.id }, data: { estado: "COBRADA", cobradaEn: aFecha(d.fecha) } });
    await tx.pagoCobro.create({
      data: { tenantId: ctx.tenant.id, sociedadId: f.sociedadId, tipo: "COBRO", fecha: aFecha(d.fecha), importe: f.total, forma: d.forma, facturaEmitidaId: f.id, referencia: d.referencia, usuarioId: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: f.id, accion: "cobrar", despues: { fecha: d.fecha, forma: d.forma } });
  });
}

export async function anularFacturaEmitida(ctx: Contexto, id: string) {
  const f = await facturaEmitidaDelAmbito(ctx, id);
  if (f.estado !== "PREPARADA" && f.estado !== "BORRADOR") throw new ErrorContable("Una factura emitida en el programa certificado se rectifica allí, no aquí.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaEmitida.update({ where: { id }, data: { estado: "ANULADA" } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: id, accion: "anular", antes: { estado: f.estado } });
  });
}

// ---------- gastos ----------

export async function listarGastos(ctx: Contexto, f: FiltroFacturas = {}) {
  const prisma = await db();
  const a = await ambito(ctx);
  const where: Prisma.GastoContableWhereInput = { ...a.donde(f.sociedadId) };
  if (f.estado) where.estado = f.estado as Prisma.GastoContableWhereInput["estado"];
  if (f.mes) {
    const r = rangoMes(f.mes);
    where.fecha = { gte: r.desde, lt: r.hasta };
  }
  return prisma.gastoContable.findMany({ where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 500 });
}

export async function crearGasto(ctx: Contexto, entrada: unknown) {
  const d = GastoEsquema.parse(entrada);
  await comprobarSociedadCentro(ctx, d.sociedadId, d.centroId);
  const prisma = await db();
  const cat = await prisma.categoriaContable.findFirst({ where: { id: d.categoriaId, tenantId: ctx.tenant.id } });
  if (!cat) throw new ErrorContable("Categoría no encontrada.");
  const base = redondear(d.base);
  const cuotaIva = redondear((base * d.tipoIva) / 100);
  return prisma.$transaction(async (tx) => {
    const g = await tx.gastoContable.create({
      data: {
        tenantId: ctx.tenant.id,
        sociedadId: d.sociedadId,
        centroId: d.centroId,
        categoriaId: d.categoriaId,
        fecha: aFecha(d.fecha),
        vencimiento: d.vencimiento ? aFecha(d.vencimiento) : null,
        concepto: d.concepto,
        proveedorNombre: d.proveedorNombre,
        base,
        cuotaIva,
        total: redondear(base + cuotaIva),
        recurrente: d.recurrente,
        notas: d.notas,
        creadoPor: ctx.usuario.id,
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: g.id, accion: "crear", despues: { concepto: d.concepto, base } });
    return g;
  });
}

async function gastoDelAmbito(ctx: Contexto, id: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const g = await prisma.gastoContable.findFirst({ where: { id, ...a.donde() } });
  if (!g) throw new ErrorContable("Gasto no encontrado.");
  return g;
}

export async function pagarGasto(ctx: Contexto, entrada: unknown) {
  const d = PagoEsquema.parse(entrada);
  const g = await gastoDelAmbito(ctx, d.id);
  if (g.estado !== "PENDIENTE") throw new ErrorContable("Este gasto no está pendiente.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.gastoContable.update({ where: { id: g.id }, data: { estado: "PAGADO", pagadoEn: aFecha(d.fecha) } });
    await tx.pagoCobro.create({
      data: { tenantId: ctx.tenant.id, sociedadId: g.sociedadId, tipo: "PAGO", fecha: aFecha(d.fecha), importe: g.total, forma: d.forma, gastoId: g.id, referencia: d.referencia, usuarioId: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: g.id, accion: "pagar", despues: { fecha: d.fecha, forma: d.forma } });
  });
}

export async function anularGasto(ctx: Contexto, id: string) {
  const g = await gastoDelAmbito(ctx, id);
  if (g.estado === "PAGADO") throw new ErrorContable("Un gasto pagado no se anula.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.gastoContable.update({ where: { id }, data: { estado: "ANULADO" } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: id, accion: "anular", antes: { estado: g.estado } });
  });
}

/** Copia al mes indicado los gastos marcados como fijos del mes anterior (si no se copiaron ya). */
export async function copiarGastosFijos(ctx: Contexto, mes: string): Promise<number> {
  const prisma = await db();
  const a = await ambito(ctx);
  const destino = rangoMes(mes);
  const origen = { desde: new Date(Date.UTC(destino.desde.getUTCFullYear(), destino.desde.getUTCMonth() - 1, 1)), hasta: destino.desde };
  const fijos = await prisma.gastoContable.findMany({ where: { ...a.donde(), recurrente: true, estado: { not: "ANULADO" }, fecha: { gte: origen.desde, lt: origen.hasta } } });
  const yaHay = await prisma.gastoContable.findMany({ where: { ...a.donde(), recurrente: true, fecha: { gte: destino.desde, lt: destino.hasta } }, select: { concepto: true, centroId: true, sociedadId: true } });
  const clave = (g: { concepto: string; centroId: string | null; sociedadId: string }) => `${g.sociedadId}|${g.centroId}|${g.concepto}`;
  const existentes = new Set(yaHay.map(clave));
  const nuevos = fijos.filter((g) => !existentes.has(clave(g)));
  if (nuevos.length === 0) return 0;
  const desplazar = (d: Date | null) => (d ? new Date(Date.UTC(destino.desde.getUTCFullYear(), destino.desde.getUTCMonth(), Math.min(d.getUTCDate(), 28))) : null);
  await prisma.$transaction(async (tx) => {
    for (const g of nuevos) {
      const n = await tx.gastoContable.create({
        data: {
          tenantId: g.tenantId,
          sociedadId: g.sociedadId,
          centroId: g.centroId,
          categoriaId: g.categoriaId,
          fecha: desplazar(g.fecha)!,
          vencimiento: desplazar(g.vencimiento),
          concepto: g.concepto,
          proveedorNombre: g.proveedorNombre,
          base: g.base,
          cuotaIva: g.cuotaIva,
          total: g.total,
          recurrente: true,
          creadoPor: ctx.usuario.id,
          notas: `Copiado del mes anterior`,
        },
      });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: n.id, accion: "copiar-fijo", despues: { desde: g.id } });
    }
  });
  return nuevos.length;
}

// ---------- vencimientos ----------

export interface Vencimiento {
  tipo: "PAGO" | "COBRO";
  origen: "factura-recibida" | "gasto" | "factura-emitida";
  id: string;
  documento: string;
  tercero: string;
  sociedadId: string;
  centroId: string | null;
  vencimiento: Date | null;
  total: number;
  estado: string;
  vencido: boolean;
}

/** Lo pendiente de pagar o cobrar que vence hasta la fecha indicada (incluye lo ya vencido y lo que no tiene fecha). */
export async function vencimientos(ctx: Contexto, hastaISO: string, sociedadId?: string): Promise<Vencimiento[]> {
  const prisma = await db();
  const a = await ambito(ctx);
  const hasta = aFecha(hastaISO);
  const hoy = aFecha(hoyISO());
  const fechaVence = { OR: [{ vencimiento: { lte: hasta } }, { vencimiento: null }] };
  const [recibidas, gastos, emitidas] = await Promise.all([
    prisma.facturaRecibida.findMany({ where: { ...a.donde(sociedadId), estado: { in: ["PENDIENTE", "VALIDADA"] }, AND: [fechaVence] } }),
    prisma.gastoContable.findMany({ where: { ...a.donde(sociedadId), estado: "PENDIENTE", AND: [fechaVence] } }),
    prisma.facturaEmitida.findMany({ where: { ...a.donde(sociedadId), estado: "EMITIDA_FUERA", AND: [fechaVence] } }),
  ]);
  const lista: Vencimiento[] = [
    ...recibidas.map((f) => ({ tipo: "PAGO" as const, origen: "factura-recibida" as const, id: f.id, documento: `${f.numero} · ${f.numeroProveedor}`, tercero: f.proveedorNombre, sociedadId: f.sociedadId, centroId: f.centroId, vencimiento: f.vencimiento, total: Number(f.total), estado: f.estado, vencido: !!f.vencimiento && f.vencimiento < hoy })),
    ...gastos.map((g) => ({ tipo: "PAGO" as const, origen: "gasto" as const, id: g.id, documento: g.concepto, tercero: g.proveedorNombre ?? "—", sociedadId: g.sociedadId, centroId: g.centroId, vencimiento: g.vencimiento, total: Number(g.total), estado: g.estado, vencido: !!g.vencimiento && g.vencimiento < hoy })),
    ...emitidas.map((f) => ({ tipo: "COBRO" as const, origen: "factura-emitida" as const, id: f.id, documento: f.numeroOficial ?? f.referencia, tercero: f.clienteNombre, sociedadId: f.sociedadId, centroId: f.centroId, vencimiento: f.vencimiento, total: Number(f.total), estado: f.estado, vencido: !!f.vencimiento && f.vencimiento < hoy })),
  ];
  return lista.sort((x, y) => (x.vencimiento?.getTime() ?? 0) - (y.vencimiento?.getTime() ?? 0));
}

/** Fecha ISO del domingo de esta semana (fin de la semana en curso). */
export function finDeSemanaISO(): string {
  const hoy = aFecha(hoyISO());
  const dia = hoy.getUTCDay(); // 0 domingo
  const sumar = dia === 0 ? 0 : 7 - dia;
  return new Date(hoy.getTime() + sumar * 86400000).toISOString().slice(0, 10);
}

// ---------- resumen por sociedad ----------

export async function resumenPorSociedad(ctx: Contexto, mes: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const r = rangoMes(mes);
  const [porPagarFR, porPagarG, porCobrar, gastosMes, recibidasMes, pendientesRevisar] = await Promise.all([
    prisma.facturaRecibida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: { in: ["PENDIENTE", "VALIDADA"] } }, _sum: { total: true } }),
    prisma.gastoContable.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: "PENDIENTE" }, _sum: { total: true } }),
    prisma.facturaEmitida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: "EMITIDA_FUERA" }, _sum: { total: true } }),
    prisma.gastoContable.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: { not: "ANULADO" }, fecha: { gte: r.desde, lt: r.hasta } }, _sum: { base: true } }),
    prisma.facturaRecibida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: { not: "ANULADA" }, fecha: { gte: r.desde, lt: r.hasta } }, _sum: { base: true } }),
    prisma.facturaRecibida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: "PENDIENTE" }, _count: { _all: true } }),
  ]);
  const sociedades = await prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id, id: { in: a.sociedadIds } }, orderBy: { razonSocial: "asc" } });
  const v = (lista: { sociedadId: string; _sum: Record<string, unknown> }[], id: string, campo: string) => Number((lista.find((x) => x.sociedadId === id)?._sum[campo] as number | null) ?? 0);
  return sociedades.map((s) => ({
    sociedad: s,
    porPagar: redondear(v(porPagarFR, s.id, "total") + v(porPagarG, s.id, "total")),
    porCobrar: v(porCobrar, s.id, "total"),
    gastosMes: v(gastosMes, s.id, "base"),
    comprasMes: v(recibidasMes, s.id, "base"),
    pendientesRevisar: pendientesRevisar.find((x) => x.sociedadId === s.id)?._count._all ?? 0,
  }));
}

// ---------- para el Cuadro de mando (exportado) ----------

/**
 * Gastos (base sin IVA) por centro y día: gastos registrados + facturas recibidas, SOLO de categorías
 * de gasto fijo o variable. La mercancía NO entra aquí (el Cuadro la lee de las compras del núcleo) ni el
 * personal (el Cuadro lo lee de Personal): si entraran, se contarían dos veces. Un gasto enlazado a una
 * factura recibida tampoco suma (ya suma la factura).
 */
export async function gastosPorCentroYDia(tenantId: string, centroIds: string[], desde: Date, hasta: Date) {
  const prisma = await db();
  const categoriasGasto = await prisma.categoriaContable.findMany({ where: { tenantId, grupo: { in: ["GASTO_FIJO", "GASTO_VARIABLE"] } }, select: { id: true } });
  const ids = categoriasGasto.map((c) => c.id);
  const [gastos, facturas] = await Promise.all([
    prisma.gastoContable.groupBy({ by: ["centroId", "fecha"], where: { tenantId, centroId: { in: centroIds }, estado: { not: "ANULADO" }, categoriaId: { in: ids }, facturaRecibidaId: null, fecha: { gte: desde, lt: hasta } }, _sum: { base: true } }),
    prisma.facturaRecibida.groupBy({ by: ["centroId", "fecha"], where: { tenantId, centroId: { in: centroIds }, estado: { not: "ANULADA" }, categoriaId: { in: ids }, fecha: { gte: desde, lt: hasta } }, _sum: { base: true } }),
  ]);
  return [...gastos, ...facturas].map((g) => ({ centroId: g.centroId as string, fecha: g.fecha, importe: Number(g._sum.base ?? 0) }));
}

/** Detalle de los gastos de un centro en un rango (para enlazar desde el Cuadro). */
export async function detalleGastosCentro(tenantId: string, centroId: string, desde: Date, hasta: Date) {
  const prisma = await db();
  const categoriasGasto = await prisma.categoriaContable.findMany({ where: { tenantId, grupo: { in: ["GASTO_FIJO", "GASTO_VARIABLE"] } } });
  const nombres = new Map(categoriasGasto.map((c) => [c.id, c.nombre]));
  const [gastos, facturas] = await Promise.all([
    prisma.gastoContable.findMany({ where: { tenantId, centroId, estado: { not: "ANULADO" }, categoriaId: { in: Array.from(nombres.keys()) }, facturaRecibidaId: null, fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: "asc" } }),
    prisma.facturaRecibida.findMany({ where: { tenantId, centroId, estado: { not: "ANULADA" }, categoriaId: { in: Array.from(nombres.keys()) }, fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: "asc" } }),
  ]);
  return [
    ...gastos.map((g) => ({ id: g.id, fecha: g.fecha, documento: "Gasto", concepto: g.concepto, categoria: nombres.get(g.categoriaId) ?? "—", importe: Number(g.base) })),
    ...facturas.map((f) => ({ id: f.id, fecha: f.fecha, documento: f.numero, concepto: f.proveedorNombre, categoria: (f.categoriaId && nombres.get(f.categoriaId)) || "—", importe: Number(f.base) })),
  ].sort((x, y) => x.fecha.getTime() - y.fecha.getTime());
}

// ---------- exportación para la gestoría ----------

/** Importe para CSV: coma decimal y sin separador de miles (lo que leen A3, Sage y Excel en español). */
const formatoCsv = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const celda = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV de un mes y una sociedad para la gestoría: facturas recibidas (una fila por tipo de IVA),
 * gastos sin factura, facturas emitidas en programa certificado y, si se pasan, ventas diarias por centro.
 */
export async function exportarMesCsv(
  ctx: Contexto,
  sociedadId: string,
  mes: string,
  ventasDiarias?: { centroId: string; fecha: Date; ventaNeta: number; cuotaIva: number }[],
): Promise<{ nombre: string; contenido: string }> {
  const prisma = await db();
  const a = await ambito(ctx);
  if (!a.sociedadIds.includes(sociedadId)) throw new ErrorContable("No puedes exportar esa sociedad.");
  const r = rangoMes(mes);
  const d = await diccionarios(ctx);
  const soc = d.sociedades.get(sociedadId)!;
  const donde = { tenantId: ctx.tenant.id, sociedadId, fecha: { gte: r.desde, lt: r.hasta } };
  const [recibidas, gastos, emitidas] = await Promise.all([
    prisma.facturaRecibida.findMany({ where: { ...donde, estado: { not: "ANULADA" } }, include: { lineas: true }, orderBy: { fecha: "asc" } }),
    prisma.gastoContable.findMany({ where: { ...donde, estado: { not: "ANULADO" }, facturaRecibidaId: null }, orderBy: { fecha: "asc" } }),
    prisma.facturaEmitida.findMany({ where: { ...donde, estado: { in: ["EMITIDA_FUERA", "COBRADA"] } }, include: { lineas: true }, orderBy: { fecha: "asc" } }),
  ]);
  const cab = ["Tipo", "Sociedad", "CIF sociedad", "Fecha", "Documento", "Número del tercero", "Tercero", "CIF tercero", "Centro", "Categoría", "Cuenta gestoría", "Base", "Tipo IVA", "Cuota IVA", "Total", "Estado", "Vencimiento"];
  const filas: unknown[][] = [];
  const nombreCentro = (id: string | null) => (id ? (d.centros.get(id)?.nombre ?? "") : "");
  const categoria = (id: string | null | undefined) => (id ? d.categorias.get(id) : undefined);

  for (const f of recibidas) {
    const porIva = new Map<number, { base: number; cuota: number; categoriaId: string | null }>();
    for (const l of f.lineas) {
      const k = Number(l.tipoIva);
      const x = porIva.get(k) ?? { base: 0, cuota: 0, categoriaId: l.categoriaId ?? f.categoriaId };
      x.base += Number(l.base);
      x.cuota += Number(l.cuotaIva);
      porIva.set(k, x);
    }
    for (const [tipo, x] of porIva) {
      const cat = categoria(x.categoriaId);
      filas.push(["Factura recibida", soc.razonSocial, soc.cif, fechaEs(f.fecha), f.numero, f.numeroProveedor, f.proveedorNombre, f.proveedorCif, nombreCentro(f.centroId), cat?.nombre, cat?.cuentaGestoria, formatoCsv.format(redondear(x.base)), tipo, formatoCsv.format(redondear(x.cuota)), formatoCsv.format(redondear(x.base + x.cuota)), f.estado, fechaEs(f.vencimiento)]);
    }
  }
  for (const g of gastos) {
    const cat = categoria(g.categoriaId);
    const tipo = Number(g.base) ? Math.round((Number(g.cuotaIva) / Number(g.base)) * 100) : 0;
    filas.push(["Gasto", soc.razonSocial, soc.cif, fechaEs(g.fecha), g.concepto, "", g.proveedorNombre, "", nombreCentro(g.centroId), cat?.nombre, cat?.cuentaGestoria, formatoCsv.format(Number(g.base)), tipo, formatoCsv.format(Number(g.cuotaIva)), formatoCsv.format(Number(g.total)), g.estado, fechaEs(g.vencimiento)]);
  }
  for (const f of emitidas) {
    const porIva = new Map<number, { base: number; cuota: number }>();
    for (const l of f.lineas) {
      const k = Number(l.tipoIva);
      const x = porIva.get(k) ?? { base: 0, cuota: 0 };
      x.base += Number(l.base);
      x.cuota += Number(l.cuotaIva);
      porIva.set(k, x);
    }
    for (const [tipo, x] of porIva)
      filas.push(["Factura emitida (programa certificado)", soc.razonSocial, soc.cif, fechaEs(f.fecha), f.numeroOficial, f.referencia, f.clienteNombre, f.clienteCif, nombreCentro(f.centroId), "", "", formatoCsv.format(redondear(x.base)), tipo, formatoCsv.format(redondear(x.cuota)), formatoCsv.format(redondear(x.base + x.cuota)), f.estado, fechaEs(f.vencimiento)]);
  }
  for (const v of ventasDiarias ?? []) {
    filas.push(["Venta diaria (TPV)", soc.razonSocial, soc.cif, fechaEs(v.fecha), "", "", "Ventas de caja", "", nombreCentro(v.centroId), "Ventas", "", formatoCsv.format(v.ventaNeta), "", formatoCsv.format(v.cuotaIva), formatoCsv.format(redondear(v.ventaNeta + v.cuotaIva)), "", ""]);
  }
  const contenido = "﻿" + [cab, ...filas].map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
  return { nombre: `contabilidad_${soc.cif}_${mes}.csv`, contenido };
}

/** Ids de los centros de una sociedad que ve el usuario (para sumar sus ventas en la exportación). */
export async function centrosDeSociedad(ctx: Contexto, sociedadId: string): Promise<string[]> {
  const prisma = await db();
  const centros = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, sociedadId, id: { in: ctx.centros.map((c) => c.id) } }, select: { id: true } });
  return centros.map((c) => c.id);
}
