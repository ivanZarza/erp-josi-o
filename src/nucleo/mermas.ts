import "server-only";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { numero } from "@/kernel/formato";
import { registrarMovimientos, stockDe } from "./movimientos";
import { ErrorNegocio, num, r2, r3, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Mermas: roturas, caducidades, desperdicio, invitaciones… Restan stock con un movimiento MERMA
 * (documento MER-…) valorado al coste medio del producto, con el motivo obligatorio.
 */
export const MOTIVOS_MERMA = ["Rotura", "Caducidad", "Desperdicio", "Invitación", "Consumo de personal", "Error de cocina o barra", "Otro"] as const;

export async function registrarMerma(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  d: { centroId: string; almacenId?: string | null; productoId: string; cantidad: number; motivo: string; nota?: string | null },
) {
  if (!(d.cantidad > 0)) throw new ErrorNegocio("La cantidad de la merma tiene que ser mayor que 0.");
  if (!d.motivo.trim()) throw new ErrorNegocio("El motivo de la merma es obligatorio.");
  const [producto, centro] = await Promise.all([
    tx.producto.findFirst({ where: { id: d.productoId, tenantId, area } }),
    tx.centro.findFirst({ where: { id: d.centroId, tenantId } }),
  ]);
  if (!producto) throw new ErrorNegocio("El producto no es de esta área.");
  if (!centro) throw new ErrorNegocio("El centro no existe.");
  // con almacén elegido, se mira lo que hay en ese almacén; si no, en todo el centro (el motor reparte la salida)
  const almacen = d.almacenId ? await tx.almacen.findFirst({ where: { id: d.almacenId, centroId: d.centroId, activo: true } }) : null;
  if (d.almacenId && !almacen) throw new ErrorNegocio("El almacén elegido no es de ese centro.");
  const hay = await stockDe(tx, tenantId, d.centroId, d.productoId, almacen ? almacen.id : undefined);
  const cantidad = r3(d.cantidad);
  if (cantidad > hay) throw new ErrorNegocio(`No se puede dar de baja más de lo que hay: en ${almacen ? `${almacen.nombre} de ` : ""}${centro.nombre} quedan ${numero(hay, 3)}.`);
  const documento = await siguienteNumero(tx, tenantId, "MER");
  const coste = num(producto.costeUnitario);
  const motivo = d.nota?.trim() ? `${d.motivo}: ${d.nota.trim()}` : d.motivo;
  await registrarMovimientos(tx, [
    { tenantId, centroId: d.centroId, ...(almacen ? { almacenId: almacen.id } : {}), productoId: d.productoId, tipo: "MERMA", cantidad: -cantidad, costeUnitario: coste, documento, motivo, usuarioId },
  ]);
  await auditar(tx, { tenantId, usuarioId, entidad: "MovimientoStock", entidadId: documento, accion: "merma", despues: { ...d, coste, valor: r2(cantidad * coste) } });
  await emitir(tx, tenantId, "almacen.merma.registrada", { documento, area, centroId: d.centroId, productoId: d.productoId, cantidad, valor: r2(cantidad * coste), motivo: d.motivo });
  return documento;
}
