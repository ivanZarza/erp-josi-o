import "server-only";
import { stockActual } from "./movimientos";
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
 */

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
  total: number;
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
  filtros: { texto?: string; familiaId?: string; estado?: EstadoStock | "AVISOS"; proveedorId?: string } = {},
): Promise<FilaStock[]> {
  if (centros.length === 0) return [];
  const ids = centros.map((c) => c.id);
  const texto = filtros.texto?.trim();
  const [productos, stock, ajustes] = await Promise.all([
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
    stockActual(tx, tenantId, area, ids),
    tx.productoCentro.findMany({ where: { centroId: { in: ids }, producto: { tenantId, area } } }),
  ]);

  const stockPor = new Map<string, number>();
  for (const s of stock) stockPor.set(`${s.productoId}|${s.centroId}`, s.stock);
  const ajustePor = new Map(ajustes.map((a) => [`${a.productoId}|${a.centroId}`, a]));

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
      porCentro.push({
        centro: c,
        stock: s,
        minimo,
        maximo: aj?.maximo != null ? num(aj.maximo) : null,
        precioVenta: aj?.precioVenta != null ? num(aj.precioVenta) : null,
        activoEnCentro: aj ? aj.activo : true,
        estado: estadoDe(s, minimo),
      });
    }
    // productos desactivados solo si aún tienen stock
    const total = r3(porCentro.reduce((a, x) => a + x.stock, 0));
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

/** Stock disponible de varios productos en un centro (para servir pedidos y proponer cantidades). */
export async function stockEnCentro(tx: Tx, tenantId: string, area: AreaAlmacen, centroId: string): Promise<Map<string, number>> {
  const filas = await stockActual(tx, tenantId, area, [centroId]);
  return new Map(filas.map((f) => [f.productoId, r3(f.stock)]));
}

/** Movimientos del área con filtros (pantalla Movimientos). */
export async function listarMovimientos(
  tx: Tx,
  tenantId: string,
  area: AreaAlmacen,
  centroIds: string[],
  filtros: { tipo?: string; productoId?: string; texto?: string; desde?: Date; hasta?: Date; limite?: number } = {},
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
      ...(filtros.productoId ? { productoId: filtros.productoId } : {}),
      ...(filtros.desde || filtros.hasta ? { createdAt: { ...(filtros.desde ? { gte: filtros.desde } : {}), ...(filtros.hasta ? { lt: filtros.hasta } : {}) } } : {}),
    },
    include: { producto: { select: { nombre: true, referencia: true, unidad: true } }, centro: { select: { nombre: true, codigo: true } } },
    orderBy: { createdAt: "desc" },
    take: filtros.limite ?? 300,
  });
}
