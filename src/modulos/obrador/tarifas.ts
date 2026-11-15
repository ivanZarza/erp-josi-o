import "server-only";
/**
 * Tarifas del obrador a los locales: cálculo del precio y recálculo cuando cambia el coste.
 * Archivo aparte y sin dependencias de otros módulos para que lo pueda llamar cualquiera que cambie
 * el coste de un producto (producción en el Obrador, recepción de compras en el núcleo…).
 *
 * Regla: la tarifa «A coste» o «Coste + %» se escribe en ProductoCentro.precioVenta del local y se
 * guarda en ObradorTarifa.precioAplicado. Si al recalcular el precio del local ya no es el último que
 * escribió el obrador, es que alguien lo cambió a mano (Stock → Productos, «Tarifa al centro»): se
 * respeta ese precio y la tarifa pasa a «Precio fijo» con él, para que el Obrador enseñe la verdad.
 */
import { auditar, emitir } from "@/kernel/eventos";
import type { Tx } from "@/nucleo/movimientos";
import { redondear } from "@/modulos/comidas/carta-alergenos";

export function precioSegunModo(modo: string, coste: number, porcentaje: number | null, precioFijo: number | null): number {
  if (modo === "PRECIO_FIJO") return precioFijo ?? 0;
  if (modo === "COSTE_MAS_PORCENTAJE") return coste * (1 + (porcentaje ?? 0) / 100);
  return coste;
}

const DIFERENCIA = 0.00005; // los precios se guardan con 4 decimales

/**
 * Recalcula ProductoCentro.precioVenta de las tarifas «A coste» y «Coste + %» de un producto con su
 * coste medio actual. Llamar dentro de la transacción que cambia el coste. Devuelve cuántas tarifas
 * ha recalculado (sin contar las que pasan a precio fijo por un cambio a mano).
 */
export async function recalcularTarifasProducto(tx: Tx, tenantId: string, productoId: string, usuarioId?: string) {
  const [producto, tarifas] = await Promise.all([
    tx.producto.findFirst({ where: { id: productoId, tenantId } }),
    tx.obradorTarifa.findMany({ where: { tenantId, productoId, modo: { not: "PRECIO_FIJO" } } }),
  ]);
  if (!producto || tarifas.length === 0) return 0;
  const coste = Number(producto.costeUnitario);
  const actuales = await tx.productoCentro.findMany({ where: { productoId, centroId: { in: tarifas.map((t) => t.centroId) } } });
  const enLocal = new Map(actuales.map((a) => [a.centroId, a.precioVenta != null ? Number(a.precioVenta) : null]));
  let recalculadas = 0;
  const aMano: { centroId: string; precio: number }[] = [];
  const cambios: { centroId: string; antes: number | null; despues: number }[] = [];
  for (const t of tarifas) {
    const actual = enLocal.get(t.centroId) ?? null;
    const aplicado = t.precioAplicado != null ? Number(t.precioAplicado) : null;
    if (actual != null && aplicado != null && Math.abs(actual - aplicado) > DIFERENCIA) {
      // cambiado a mano en el local: se respeta y la tarifa pasa a precio fijo
      await tx.obradorTarifa.update({ where: { id: t.id }, data: { modo: "PRECIO_FIJO", porcentaje: null, precioFijo: actual, precioAplicado: actual, actualizadoPor: usuarioId } });
      aMano.push({ centroId: t.centroId, precio: actual });
      continue;
    }
    const precio = redondear(precioSegunModo(t.modo, coste, t.porcentaje != null ? Number(t.porcentaje) : null, null));
    await tx.productoCentro.upsert({
      where: { productoId_centroId: { productoId, centroId: t.centroId } },
      create: { productoId, centroId: t.centroId, precioVenta: precio },
      update: { precioVenta: precio },
    });
    await tx.obradorTarifa.update({ where: { id: t.id }, data: { precioAplicado: precio } });
    if (actual == null || Math.abs(actual - precio) > DIFERENCIA) cambios.push({ centroId: t.centroId, antes: actual, despues: precio });
    recalculadas++;
  }
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "Producto",
    entidadId: productoId,
    accion: "recalcular tarifas a locales",
    despues: { coste, recalculadas, cambios, pasanAPrecioFijo: aMano },
  });
  if (cambios.length > 0) await emitir(tx, tenantId, "obrador.tarifa.cambiada", { productoId, centros: cambios.map((c) => c.centroId), motivo: "coste" });
  return recalculadas;
}
