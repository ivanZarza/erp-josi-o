/**
 * Coste medio ponderado de un producto (núcleo). Una sola regla para todo lo que mete mercancía con
 * precio nuevo (recepción de compras y producción del obrador).
 * Ver docs/specs/nucleo/stock-y-pedidos.md («Coste medio»).
 *
 * - Hay UN coste por producto en toda la cadena (Producto.costeUnitario), así que el stock que pesa
 *   es el de TODA la cadena (todos los centros y almacenes), no solo el del centro que recibe.
 * - coste nuevo = (stock × coste actual + entra × precio) / (stock + entra)
 * - Si antes no había stock (0 o negativo) o el producto no tenía coste (0), el coste nuevo es el precio
 *   de la entrada: no se mezcla con un coste que no existe.
 */
import type { Tx } from "./motor-movimientos";

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Cálculo puro (sin base de datos). */
export function costeMedioPonderado(stockAntes: number, costeAntes: number, entra: number, precio: number): number {
  if (stockAntes <= 0 || costeAntes <= 0 || stockAntes + entra <= 0) return r4(precio);
  return r4((stockAntes * costeAntes + entra * precio) / (stockAntes + entra));
}

/**
 * Coste medio tras una entrada, mirando el stock de toda la cadena ANTES de registrarla.
 * Devuelve también el stock y el coste de antes (para la auditoría).
 */
export async function costeMedioTrasEntrada(tx: Tx, tenantId: string, productoId: string, entra: number, precio: number) {
  const [prod, ag] = await Promise.all([
    tx.producto.findFirstOrThrow({ where: { id: productoId, tenantId }, select: { costeUnitario: true } }),
    tx.movimientoStock.aggregate({ where: { tenantId, productoId }, _sum: { cantidad: true } }),
  ]);
  const stockAntes = Number(ag._sum.cantidad ?? 0);
  const costeAntes = Number(prod.costeUnitario);
  return { stockAntes, costeAntes, costeNuevo: costeMedioPonderado(stockAntes, costeAntes, entra, precio) };
}
