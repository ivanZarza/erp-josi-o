import "server-only";
import type { AreaProducto } from "@/generated/prisma/client";
import { ErrorNegocio } from "./comun-almacen";
import { registrarMovimientos as registrarMotor, resolutorAlmacen, ErrorMovimiento, type Tx, type NuevoMovimiento } from "./motor-movimientos";

/**
 * Motor común de stock (núcleo). Regla de oro: el stock es la SUMA de movimientos.
 * La lógica está en motor-movimientos.ts (sin "server-only", para las semillas); aquí se reexporta.
 */
export { resolutorAlmacen };
export type { Tx, NuevoMovimiento };

export async function registrarMovimientos(tx: Tx, movs: NuevoMovimiento[]) {
  try {
    await registrarMotor(tx, movs);
  } catch (e) {
    if (e instanceof ErrorMovimiento) throw new ErrorNegocio(e.message);
    throw e;
  }
}

export interface LineaStock {
  productoId: string;
  centroId: string;
  stock: number;
}

/** Stock actual por producto y centro (suma de movimientos), filtrado por área y centros (y almacén si se pide). */
export async function stockActual(tx: Tx, tenantId: string, area: AreaProducto, centroIds: string[], almacenId?: string | null): Promise<LineaStock[]> {
  if (centroIds.length === 0) return [];
  const filas = await tx.movimientoStock.groupBy({
    by: ["productoId", "centroId"],
    where: { tenantId, centroId: { in: centroIds }, producto: { area }, ...(almacenId !== undefined ? { almacenId } : {}) },
    _sum: { cantidad: true },
  });
  return filas.map((f) => ({ productoId: f.productoId, centroId: f.centroId, stock: Number(f._sum.cantidad ?? 0) }));
}

export interface LineaStockAlmacen extends LineaStock {
  almacenId: string | null;
}

/** Stock por producto, centro y almacén (null = «Sin ubicar»). */
export async function stockPorAlmacen(tx: Tx, tenantId: string, area: AreaProducto, centroIds: string[]): Promise<LineaStockAlmacen[]> {
  if (centroIds.length === 0) return [];
  const filas = await tx.movimientoStock.groupBy({
    by: ["productoId", "centroId", "almacenId"],
    where: { tenantId, centroId: { in: centroIds }, producto: { area } },
    _sum: { cantidad: true },
  });
  return filas.map((f) => ({ productoId: f.productoId, centroId: f.centroId, almacenId: f.almacenId, stock: Number(f._sum.cantidad ?? 0) }));
}

/** Stock de un producto en un centro (o solo en un almacén del centro). */
export async function stockDe(tx: Tx, tenantId: string, centroId: string, productoId: string, almacenId?: string | null): Promise<number> {
  const r = await tx.movimientoStock.aggregate({ where: { tenantId, centroId, productoId, ...(almacenId !== undefined ? { almacenId } : {}) }, _sum: { cantidad: true } });
  return Number(r._sum.cantidad ?? 0);
}
