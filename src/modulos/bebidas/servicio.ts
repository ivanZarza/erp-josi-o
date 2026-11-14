import "server-only";
/**
 * Bebidas · lógica propia del módulo (lo de stock, pedidos y compras va en el núcleo).
 *  - Ficha de vino de cada producto (tabla FichaVino, prisma/schema/bebidas.prisma).
 *  - Vista «Bodega»: vinos con D.O., añada, stock, coste, precio en carta, % de coste y precio por copa.
 * Ver docs/specs/modulos/bebidas/README.md y docs/specs/nucleo/catalogo.md §5 y §8.
 *
 * Usa de Carta (Comidas) lo que exporta: ventaDeProductos (en qué bebidas y formatos se vende cada vino).
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { porcentajeCoste } from "@/modulos/comidas/carta-alergenos";
import { ventaDeProductos, type VentaProducto } from "@/modulos/comidas/carta-servicio";
import { fichasDeProductos, TIPOS_VINO, type DatosFichaVino } from "./fichas";
import { esquemaFichaVino } from "./esquemas";

export class ErrorBebidas extends Error {}

/** Familias que son vino aunque el producto aún no tenga ficha. */
const FAMILIA_DE_VINO = /vino|espumos|champ|cava|generos|dulce|jerez|oporto/i;

export interface FilaBodega {
  productoId: string;
  referencia: string;
  nombre: string;
  familia: string;
  activo: boolean;
  ficha: DatosFichaVino | null;
  stock: number;
  stockPorCentro: { centro: string; stock: number }[];
  coste: number; // € por botella (precio medio)
  ventas: VentaProducto[];
  /** Precio en carta de la botella entera (formato que vende 1 unidad) */
  precioBotella: number | null;
  pctCoste: number | null;
  precioCopa: number | null;
  copaCl: number | null;
}

function resumenVentas(coste: number, ficha: DatosFichaVino | null, ventas: VentaProducto[]) {
  const botella = ventas.find((v) => Math.abs(v.cantidad - 1) < 0.01);
  const copa = ventas.find((v) => /copa/i.test(v.formato)) ?? ventas.find((v) => v.cantidad < 0.5);
  return {
    precioBotella: botella?.precio ?? null,
    pctCoste: botella && botella.precio > 0 && coste > 0 ? porcentajeCoste(coste, botella.precio, botella.iva) : null,
    precioCopa: copa?.precio ?? null,
    copaCl: copa && ficha ? copa.cantidad * ficha.capacidadCl : null,
  };
}

async function stockDe(ctx: Contexto, productoIds: string[]) {
  const prisma = await db();
  const centros = centrosFiltro(ctx);
  const filas = productoIds.length
    ? await prisma.movimientoStock.groupBy({ by: ["productoId", "centroId"], where: { tenantId: ctx.tenant.id, centroId: { in: centros }, productoId: { in: productoIds } }, _sum: { cantidad: true } })
    : [];
  const nombres = new Map(ctx.centros.map((c) => [c.id, c.nombre]));
  const mapa = new Map<string, { total: number; porCentro: { centro: string; stock: number }[] }>();
  for (const f of filas) {
    const n = Math.round(Number(f._sum.cantidad ?? 0) * 1000) / 1000;
    if (n === 0) continue;
    const m = mapa.get(f.productoId) ?? { total: 0, porCentro: [] };
    m.total += n;
    m.porCentro.push({ centro: nombres.get(f.centroId) ?? "—", stock: n });
    mapa.set(f.productoId, m);
  }
  return mapa;
}

export interface FiltroBodega {
  q?: string;
  tipo?: string; // clave de TIPOS_VINO o «SIN» (sin ficha o sin tipo)
  denominacion?: string;
  soloCarta?: boolean;
}

/** Vinos de la cadena (con ficha o de una familia de vino), con su stock en los centros que se ven arriba. */
export async function listarBodega(ctx: Contexto, filtro: FiltroBodega = {}) {
  const prisma = await db();
  const t = ctx.tenant.id;
  const [conFicha, familias] = await Promise.all([
    prisma.fichaVino.findMany({ where: { tenantId: t }, select: { productoId: true } }),
    prisma.familiaProducto.findMany({ where: { tenantId: t, area: "BEBIDAS" }, select: { id: true, nombre: true } }),
  ]);
  const familiasVino = familias.filter((f) => FAMILIA_DE_VINO.test(f.nombre)).map((f) => f.id);
  const productos = await prisma.producto.findMany({
    where: {
      tenantId: t,
      area: "BEBIDAS",
      activo: true,
      OR: [{ id: { in: conFicha.map((f) => f.productoId) } }, { familiaId: { in: familiasVino } }],
      ...(filtro.q ? { nombre: { contains: filtro.q, mode: "insensitive" as const } } : {}),
    },
    include: { familia: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });
  const ids = productos.map((p) => p.id);
  const [fichas, stock, ventas] = await Promise.all([fichasDeProductos(prisma, t, ids), stockDe(ctx, ids), ventaDeProductos(ctx, ids)]);
  const orden = (tipo: string | null | undefined) => {
    const i = TIPOS_VINO.findIndex((x) => x.clave === tipo);
    return i < 0 ? 99 : i;
  };
  const filas = productos.map<FilaBodega>((p) => {
    const ficha = fichas.get(p.id) ?? null;
    const v = ventas.get(p.id) ?? [];
    const coste = Number(p.costeUnitario);
    const s = stock.get(p.id);
    return {
      productoId: p.id,
      referencia: p.referencia,
      nombre: p.nombre,
      familia: p.familia?.nombre ?? "—",
      activo: p.activo,
      ficha,
      stock: s?.total ?? 0,
      stockPorCentro: s?.porCentro ?? [],
      coste,
      ventas: v,
      ...resumenVentas(coste, ficha, v),
    };
  });
  const todas = filas
    .filter((f) => !filtro.soloCarta || f.ventas.length > 0)
    .sort((a, b) => orden(a.ficha?.tipo) - orden(b.ficha?.tipo) || (a.ficha?.denominacion ?? "~").localeCompare(b.ficha?.denominacion ?? "~", "es") || a.nombre.localeCompare(b.nombre, "es"));
  const denominaciones = Array.from(new Set(todas.map((f) => f.ficha?.denominacion).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "es"));
  // cuántos de cada tipo (antes de filtrar por tipo y D.O., para las tarjetas de entrada)
  const porTipo = new Map<string, number>();
  for (const f of todas) porTipo.set(f.ficha?.tipo ?? "SIN", (porTipo.get(f.ficha?.tipo ?? "SIN") ?? 0) + 1);
  const vinos = todas.filter((f) => (!filtro.tipo || (f.ficha?.tipo ?? "SIN") === filtro.tipo) && (!filtro.denominacion || f.ficha?.denominacion === filtro.denominacion));
  return { vinos, total: todas.length, porTipo, denominaciones };
}

/** Productos de Bebidas sin ficha de vino (para crearle una a mano: un vermut, un vino de otra familia…). */
export async function productosSinFicha(ctx: Contexto) {
  const prisma = await db();
  const conFicha = await prisma.fichaVino.findMany({ where: { tenantId: ctx.tenant.id }, select: { productoId: true } });
  return prisma.producto.findMany({
    where: { tenantId: ctx.tenant.id, area: "BEBIDAS", activo: true, id: { notIn: conFicha.map((f) => f.productoId) } },
    select: { id: true, nombre: true, referencia: true },
    orderBy: { nombre: "asc" },
  });
}

/** Ficha de vino de un producto de Bebidas, con su stock y dónde se vende en la carta. */
export async function fichaVinoProducto(ctx: Contexto, productoId: string) {
  const prisma = await db();
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, tenantId: ctx.tenant.id, area: "BEBIDAS" },
    include: { familia: { select: { nombre: true } }, proveedor: { select: { nombre: true } } },
  });
  if (!producto) return null;
  const [fichas, stock, ventas] = await Promise.all([fichasDeProductos(prisma, ctx.tenant.id, [productoId]), stockDe(ctx, [productoId]), ventaDeProductos(ctx, [productoId])]);
  const ficha = fichas.get(productoId) ?? null;
  const coste = Number(producto.costeUnitario);
  const v = ventas.get(productoId) ?? [];
  return {
    producto: { id: producto.id, nombre: producto.nombre, referencia: producto.referencia, familia: producto.familia?.nombre ?? "—", proveedor: producto.proveedor?.nombre ?? null, unidad: producto.unidad, coste },
    ficha,
    stock: stock.get(productoId)?.total ?? 0,
    stockPorCentro: stock.get(productoId)?.porCentro ?? [],
    ventas: v.map((x) => ({ ...x, coste: coste * x.cantidad, pctCoste: x.precio > 0 && coste > 0 ? porcentajeCoste(coste * x.cantidad, x.precio, x.iva) : null, centilitros: ficha ? x.cantidad * ficha.capacidadCl : null })),
    ...resumenVentas(coste, ficha, v),
  };
}

export async function guardarFichaVino(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaFichaVino.parse(datos);
  const prisma = await db();
  const p = await prisma.producto.findFirst({ where: { id: d.productoId, tenantId: ctx.tenant.id, area: "BEBIDAS" } });
  if (!p) throw new ErrorBebidas("El producto no existe o no es de Bebidas");
  const campos = {
    bodega: d.bodega ?? null,
    denominacion: d.denominacion ?? null,
    uva: d.uva ?? null,
    anada: d.anada ?? null,
    capacidadCl: d.capacidadCl ?? 75,
    tipo: d.tipo ?? null,
    crianza: d.crianza ?? null,
    notasCata: d.notasCata ?? null,
    maridaje: d.maridaje ?? null,
    argumentoVenta: d.argumentoVenta ?? null,
  };
  await prisma.fichaVino.upsert({
    where: { tenantId_productoId: { tenantId: ctx.tenant.id, productoId: d.productoId } },
    create: { tenantId: ctx.tenant.id, productoId: d.productoId, ...campos },
    update: campos,
  });
}
