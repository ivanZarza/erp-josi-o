import "server-only";
import type { PrismaClient, AreaProducto, TipoMovimiento } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

/**
 * Motor común de stock (núcleo). Regla de oro: el stock es la SUMA de movimientos.
 * Lo usan Bebidas, Comidas y Obrador. Ninguna pantalla escribe stock de otra forma.
 */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export interface NuevoMovimiento {
  tenantId: string;
  centroId: string;
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number; // con signo: + entra, − sale
  costeUnitario: number;
  documento?: string;
  documentoId?: string;
  motivo?: string;
  usuarioId?: string;
}

export async function registrarMovimientos(tx: Tx, movs: NuevoMovimiento[]) {
  if (movs.length === 0) return;
  await tx.movimientoStock.createMany({
    data: movs.map((m) => ({
      ...m,
      cantidad: new Prisma.Decimal(m.cantidad),
      costeUnitario: new Prisma.Decimal(m.costeUnitario),
    })),
  });
}

export interface LineaStock {
  productoId: string;
  centroId: string;
  stock: number;
}

/** Stock actual por producto y centro (suma de movimientos), filtrado por área y centros. */
export async function stockActual(tx: Tx, tenantId: string, area: AreaProducto, centroIds: string[]): Promise<LineaStock[]> {
  if (centroIds.length === 0) return [];
  const filas = await tx.movimientoStock.groupBy({
    by: ["productoId", "centroId"],
    where: { tenantId, centroId: { in: centroIds }, producto: { area } },
    _sum: { cantidad: true },
  });
  return filas.map((f) => ({ productoId: f.productoId, centroId: f.centroId, stock: Number(f._sum.cantidad ?? 0) }));
}

/** Stock de un producto en un centro. */
export async function stockDe(tx: Tx, tenantId: string, centroId: string, productoId: string): Promise<number> {
  const r = await tx.movimientoStock.aggregate({ where: { tenantId, centroId, productoId }, _sum: { cantidad: true } });
  return Number(r._sum.cantidad ?? 0);
}
