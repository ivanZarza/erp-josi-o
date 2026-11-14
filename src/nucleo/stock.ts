import "server-only";
import { stockActual, stockPorAlmacen, resolutorAlmacen } from "./movimientos";
import { normalizarNombre } from "./regla-almacen";
import { num, r2, r3, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Listado de stock por centro (motor común de Bebidas y Comidas).
 * Stock = suma de movimientos. Valor = stock × coste medio del producto.
 *
 * Mínimo que se aplica en cada centro:
 * 1. El de ProductoCentro.minimo si está puesto para ese centro.
 * 2. Si no, en obradores y almacenes, el mínimo general del producto (Producto.stockMinimo).
 * 3. En los locales sin mínimo propio no hay mínimo (no se avisa): así se evitan las 51 alertas
 *    sin sentido de BODEGA 360 (mínimo de 6 para todo y en todas partes).
 *
 * Almacenes: cada centro desglosa su stock por almacén (Bodega, Barra, Cámara…) y «Sin ubicar»
 * (movimientos antiguos sin almacén). El mínimo y el estado se miran siempre con el total del centro.
 * Con el filtro de almacén (por nombre, p. ej. «Barra», o SIN_UBICAR) las cifras de la fila
 * (stock y valor) son las de ese almacén y solo salen los productos que tienen stock allí o que
 * tienen ese almacén como almacén por defecto.
 */

/** Valor del filtro de almacén para el stock «Sin ubicar». */
export const SIN_UBICAR = "SIN_UBICAR";

export interface StockEnAlmacen {
  id: string | null; // null = sin ubicar
  nombre: string;
  stock: number;
  porDefecto: boolean;
}

export type EstadoStock = "OK" | "BAJO" | "SIN";

export interface CentroBasico {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "LOCAL" | "OBRADOR" | "ALMACEN";
}

export interface StockEnCentro {
  centro: CentroBasico;
  stock: number;
  minimo: number | null;
  maximo: number | null;
  precioVenta: number | null;
  activoEnCentro: boolean;
  estado: EstadoStock;
  /** Desglose por almacén (los que tienen stock o son el de por defecto) y «Sin ubicar» si hay. */
  almacenes: StockEnAlmacen[];
  /** Almacén por defecto que manda (puesto a mano o por la regla). */
  almacenDefectoId: string | null;
  /** Almacén puesto a mano en los ajustes del producto en este centro (null = regla por familia). */
  almacenManualId: string | null;
  /** Stock en el almacén filtrado (null si no hay filtro). */
  enFiltro: number | null;
}

export interface FilaStock {
  producto: {
    id: string;
    referencia: string;
    nombre: string;
    unidad: string;
    coste: number;
    activo: boolean;
    sinCoste: boolean;
    stockMinimoGeneral: number;
    familiaId: string | null;
    familia: string | null;
    proveedorId: string | null;
    proveedor: string | null;
    codigoBarras: string | null;
  };
  total: number; // con filtro de almacén: lo que hay en ese almacén
  totalCentros: number; // siempre: lo que hay en los centros (todos los almacenes)
  valor: number;
  minimoTotal: number | null;
  estado: EstadoStock;
  porCentro: StockEnCentro[];
}

const GRAVEDAD: Record<EstadoStock, number> = { OK: 0, BAJO: 1, SIN: 2 };

export function estadoDe(stock: number, minimo: number | null): EstadoStock {
  if (stock <= 0) return "SIN";
  if (minimo !== null && minimo > 0 && stock < minimo) return "BAJO";
  return "OK";
}

export async function listadoStock(
  tx: Tx,
  tenantId: string,
  area: AreaAlmacen,
  centros: CentroBasico[],
  filtros: { texto?: string; familiaId?: string; estado?: EstadoStock | "AVISOS"; proveedorId?: string; almacen?: string } = {},
): Promise<FilaStock[]> {
  if (centros.length === 0) return [];
  const ids = centros.map((c) => c.id);
  const texto = filtros.texto?.trim();
  const filtroAlmacen = filtros.almacen ? (filtros.almacen === SIN_UBICAR ? SIN_UBICAR : normalizarNombre(filtros.almacen)) : null;
  const [productos, stockAlm, ajustes, almacenes] = await Promise.all([
    tx.producto.findMany({
      where: {
        tenantId,
        area,
        ...(filtros.familiaId ? { familiaId: filtros.familiaId } : {}),
        ...(filtros.proveedorId ? { proveedorId: filtros.proveedorId } : {}),
        ...(texto ? { OR: [{ nombre: { contains: texto, mode: "insensitive" } }, { referencia: { contains: texto, mode: "insensitive" } }, { codigoBarras: { contains: texto } }] } : {}),
      },
      include: { familia: true, proveedor: { select: { nombre: true } } },
      orderBy: [{ familia: { orden: "asc" } }, { nombre: "asc" }],
    }),
    stockPorAlmacen(tx, tenantId, area, ids),
    tx.productoCentro.findMany({ where: { centroId: { in: ids }, producto: { tenantId, area } } }),
    tx.almacen.findMany({ where: { centroId: { in: ids } }, select: { id: true, nombre: true, centroId: true, activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  const stockPor = new Map<string, number>();
  const almPor = new Map<string, Map<string | null, number>>();
  for (const s of stockAlm) {
    const k = `${s.productoId}|${s.centroId}`;
    stockPor.set(k, (stockPor.get(k) ?? 0) + s.stock);
    if (!almPor.has(k)) almPor.set(k, new Map());
    almPor.get(k)!.set(s.almacenId, s.stock);
  }
  const ajustePor = new Map(ajustes.map((a) => [`${a.productoId}|${a.centroId}`, a]));
  const almacenesCentro = new Map<string, typeof almacenes>();
  for (const a of almacenes) almacenesCentro.set(a.centroId, [...(almacenesCentro.get(a.centroId) ?? []), a]);
  const nombreAlmacen = new Map(almacenes.map((a) => [a.id, a.nombre]));
  const { resolver } = await resolutorAlmacen(tx, ids, productos.map((p) => p.id));
  const casaFiltro = (almacenId: string | null) =>
    filtroAlmacen === SIN_UBICAR ? almacenId === null : almacenId !== null && normalizarNombre(nombreAlmacen.get(almacenId) ?? "") === filtroAlmacen;

  const filas: FilaStock[] = [];
  for (const p of productos) {
    const porCentro: StockEnCentro[] = [];
    for (const c of centros) {
      const clave = `${p.id}|${c.id}`;
      const s = r3(stockPor.get(clave) ?? 0);
      const aj = ajustePor.get(clave);
      const minimo = aj?.minimo != null ? num(aj.minimo) : c.tipo !== "LOCAL" ? num(p.stockMinimo) : null;
      // en un local sin stock y sin mínimo el producto no se controla: no se enseña
      const controlado = s !== 0 || (minimo !== null && minimo > 0) || c.tipo !== "LOCAL";
      if (!controlado) continue;
      const defecto = resolver(c.id, p.id);
      const enAlm = almPor.get(clave) ?? new Map<string | null, number>();
      const desglose: StockEnAlmacen[] = (almacenesCentro.get(c.id) ?? [])
        .filter((a) => r3(enAlm.get(a.id) ?? 0) !== 0 || a.id === defecto)
        .map((a) => ({ id: a.id, nombre: a.nombre + (a.activo ? "" : " (desactivado)"), stock: r3(enAlm.get(a.id) ?? 0), porDefecto: a.id === defecto }));
      const sinUbicar = r3(enAlm.get(null) ?? 0);
      if (sinUbicar !== 0) desglose.push({ id: null, nombre: "Sin ubicar", stock: sinUbicar, porDefecto: false });
      let enFiltro: number | null = null;
      if (filtroAlmacen) {
        const casan = Array.from(new Set([...Array.from(enAlm.entries()).filter(([, v]) => r3(v) !== 0).map(([k]) => k), ...(defecto ? [defecto] : [])].filter(casaFiltro)));
        if (casan.length === 0) continue;
        enFiltro = r3(casan.reduce((a, id) => a + (enAlm.get(id) ?? 0), 0));
      }
      porCentro.push({
        centro: c,
        stock: s,
        minimo,
        maximo: aj?.maximo != null ? num(aj.maximo) : null,
        precioVenta: aj?.precioVenta != null ? num(aj.precioVenta) : null,
        activoEnCentro: aj ? aj.activo : true,
        estado: estadoDe(s, minimo),
        almacenes: desglose,
        almacenDefectoId: defecto,
        almacenManualId: aj?.almacenId ?? null,
        enFiltro,
      });
    }
    // productos desactivados solo si aún tienen stock
    const totalCentros = r3(porCentro.reduce((a, x) => a + x.stock, 0));
    const total = filtroAlmacen ? r3(porCentro.reduce((a, x) => a + (x.enFiltro ?? 0), 0)) : totalCentros;
    if (!p.activo && total === 0) continue;
    if (porCentro.length === 0) continue;
    const minimos = porCentro.filter((x) => x.minimo !== null).map((x) => x.minimo as number);
    const estado = porCentro.reduce<EstadoStock>((peor, x) => (GRAVEDAD[x.estado] > GRAVEDAD[peor] ? x.estado : peor), "OK");
    const fila: FilaStock = {
      producto: {
        id: p.id,
        referencia: p.referencia,
        nombre: p.nombre,
        unidad: p.unidad,
        coste: num(p.costeUnitario),
        activo: p.activo,
        sinCoste: p.sinCoste,
        stockMinimoGeneral: num(p.stockMinimo),
        familiaId: p.familiaId,
        familia: p.familia?.nombre ?? null,
        proveedorId: p.proveedorId,
        proveedor: p.proveedor?.nombre ?? null,
        codigoBarras: p.codigoBarras,
      },
      total,
      totalCentros,
      valor: r2(total * num(p.costeUnitario)),
      minimoTotal: minimos.length ? r3(minimos.reduce((a, b) => a + b, 0)) : null,
      estado,
      porCentro,
    };
    if (filtros.estado === "AVISOS" && estado === "OK") continue;
    if (filtros.estado && filtros.estado !== "AVISOS" && estado !== filtros.estado) continue;
    filas.push(fila);
  }
  return filas;
}

export interface ResumenStock {
  referencias: number;
  unidades: number;
  valor: number;
  bajoMinimo: number;
  sinStock: number;
}

export function resumirStock(filas: FilaStock[]): ResumenStock {
  return {
    referencias: filas.length,
    unidades: r3(filas.reduce((a, f) => a + Math.max(0, f.total), 0)),
    valor: r2(filas.reduce((a, f) => a + f.valor, 0)),
    bajoMinimo: filas.filter((f) => f.estado === "BAJO").length,
    sinStock: filas.filter((f) => f.estado === "SIN").length,
  };
}

/** Stock disponible de varios productos en un centro, o solo en un almacén suyo (para servir pedidos, inventarios y proponer cantidades). */
export async function stockEnCentro(tx: Tx, tenantId: string, area: AreaAlmacen, centroId: string, almacenId?: string | null): Promise<Map<string, number>> {
  const filas = await stockActual(tx, tenantId, area, [centroId], almacenId);
  return new Map(filas.map((f) => [f.productoId, r3(f.stock)]));
}

/** Almacenes activos de unos centros (para los selectores de las pantallas). */
export async function almacenesDeCentros(tx: Tx, centroIds: string[], { conInactivos = false }: { conInactivos?: boolean } = {}) {
  if (centroIds.length === 0) return [];
  return tx.almacen.findMany({
    where: { centroId: { in: centroIds }, ...(conInactivos ? {} : { activo: true }) },
    select: { id: true, nombre: true, centroId: true, activo: true },
    orderBy: { nombre: "asc" },
  });
}

/** Movimientos del área con filtros (pantalla Movimientos). */
export async function listarMovimientos(
  tx: Tx,
  tenantId: string,
  area: AreaAlmacen,
  centroIds: string[],
  filtros: { tipo?: string; productoId?: string; texto?: string; desde?: Date; hasta?: Date; limite?: number; almacen?: string } = {},
) {
  const texto = filtros.texto?.trim();
  return tx.movimientoStock.findMany({
    where: {
      tenantId,
      centroId: { in: centroIds },
      producto: {
        area,
        ...(texto ? { OR: [{ nombre: { contains: texto, mode: "insensitive" } }, { referencia: { contains: texto, mode: "insensitive" } }] } : {}),
      },
      ...(filtros.tipo ? { tipo: filtros.tipo as never } : {}),
      ...(filtros.almacen === SIN_UBICAR ? { almacenId: null } : filtros.almacen ? { almacen: { nombre: { equals: filtros.almacen, mode: "insensitive" as const } } } : {}),
      ...(filtros.productoId ? { productoId: filtros.productoId } : {}),
      ...(filtros.desde || filtros.hasta ? { createdAt: { ...(filtros.desde ? { gte: filtros.desde } : {}), ...(filtros.hasta ? { lt: filtros.hasta } : {}) } } : {}),
    },
    include: { producto: { select: { nombre: true, referencia: true, unidad: true } }, centro: { select: { nombre: true, codigo: true } }, almacen: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: filtros.limite ?? 300,
  });
}
