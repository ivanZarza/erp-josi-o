import "server-only";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { numero } from "@/kernel/formato";
import { registrarMovimientos, resolutorAlmacen, type NuevoMovimiento } from "./movimientos";
import { stockEnCentro } from "./stock";
import { ErrorNegocio, num, r2, r3, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Traspasos entre almacenes del MISMO centro (p. ej. Bodega → Barra al reponer).
 * Cada línea son dos movimientos TRASPASO con el mismo documento TRA-…: − en el almacén de origen
 * y + en el de destino, al coste medio del producto. El stock del centro no cambia.
 * No se puede traspasar más de lo que hay en el almacén de origen.
 * El origen puede ser el stock «Sin ubicar» del centro (origenId null): así se coloca en su almacén lo que
 * entró antes de que el centro tuviera almacenes. El destino siempre es un almacén.
 */

export interface LineaTraspaso {
  productoId: string;
  cantidad: number;
}

export async function registrarTraspaso(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  d: { centroId: string; origenId: string | null; destinoId: string; lineas: LineaTraspaso[]; nota?: string | null },
) {
  if (d.origenId === d.destinoId) throw new ErrorNegocio("El almacén de origen y el de destino tienen que ser distintos.");
  const [centro, almacenes] = await Promise.all([
    tx.centro.findFirst({ where: { id: d.centroId, tenantId } }),
    tx.almacen.findMany({ where: { id: { in: [d.origenId, d.destinoId].filter((x): x is string => !!x) }, centroId: d.centroId, activo: true } }),
  ]);
  if (!centro) throw new ErrorNegocio("El centro no existe.");
  // origen null = «Sin ubicar» del centro
  const origen = d.origenId === null ? { id: null, nombre: "Sin ubicar" } : almacenes.find((a) => a.id === d.origenId);
  const destino = almacenes.find((a) => a.id === d.destinoId);
  if (!origen || !destino) throw new ErrorNegocio("Los dos almacenes tienen que ser de ese centro y estar activos.");

  const m = new Map<string, number>();
  for (const l of d.lineas) if (l.cantidad > 0) m.set(l.productoId, r3((m.get(l.productoId) ?? 0) + l.cantidad));
  if (m.size === 0) throw new ErrorNegocio("Escribe cuánto pasas de algún producto.");
  const productos = await tx.producto.findMany({ where: { id: { in: Array.from(m.keys()) }, tenantId, area }, select: { id: true, nombre: true, costeUnitario: true } });
  if (productos.length !== m.size) throw new ErrorNegocio("Hay productos que no existen o no son de esta área.");

  const hay = await stockEnCentro(tx, tenantId, area, d.centroId, d.origenId);
  const faltan = productos.filter((p) => (m.get(p.id) ?? 0) > (hay.get(p.id) ?? 0));
  if (faltan.length > 0) {
    throw new ErrorNegocio(
      `En ${origen.nombre} no hay bastante: ${faltan
        .slice(0, 3)
        .map((p) => `${p.nombre} (hay ${numero(Math.max(0, hay.get(p.id) ?? 0), 3)})`)
        .join("; ")}${faltan.length > 3 ? "…" : ""}.`,
    );
  }

  const documento = await siguienteNumero(tx, tenantId, "TRA");
  const motivo = `${origen.nombre} → ${destino.nombre}${d.nota?.trim() ? `: ${d.nota.trim()}` : ""}`;
  const movs: NuevoMovimiento[] = [];
  let valor = 0;
  for (const p of productos) {
    const cantidad = m.get(p.id)!;
    const coste = num(p.costeUnitario);
    valor += cantidad * coste;
    const comun = { tenantId, centroId: d.centroId, productoId: p.id, tipo: "TRASPASO" as const, costeUnitario: coste, documento, motivo, usuarioId };
    movs.push({ ...comun, almacenId: origen.id, cantidad: -cantidad });
    movs.push({ ...comun, almacenId: destino.id, cantidad });
  }
  await registrarMovimientos(tx, movs);
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "MovimientoStock",
    entidadId: documento,
    accion: "traspaso",
    despues: { centroId: d.centroId, origen: origen.nombre, destino: destino.nombre, lineas: Array.from(m, ([productoId, cantidad]) => ({ productoId, cantidad })), valor: r2(valor) },
  });
  await emitir(tx, tenantId, "almacen.traspaso.hecho", { documento, area, centroId: d.centroId, origenId: origen.id, destinoId: destino.id, lineas: m.size });
  return { documento, lineas: m.size };
}

/**
 * Productos que se pueden pasar de un almacén a otro: los que tienen stock en el origen, con lo que hay
 * en origen y en destino y una propuesta para reponer el destino si ese es su almacén por defecto y hay
 * máximo (hasta el máximo) o mínimo (hasta el mínimo) en el centro. origenId null = «Sin ubicar».
 */
export async function catalogoTraspaso(tx: Tx, tenantId: string, area: AreaAlmacen, centroId: string, origenId: string | null, destinoId: string) {
  const [enOrigen, enDestino, total] = await Promise.all([
    stockEnCentro(tx, tenantId, area, centroId, origenId),
    stockEnCentro(tx, tenantId, area, centroId, destinoId),
    stockEnCentro(tx, tenantId, area, centroId),
  ]);
  const ids = Array.from(enOrigen).filter(([, v]) => v > 0).map(([k]) => k);
  if (ids.length === 0) return [];
  const [productos, ajustes, { resolver }] = await Promise.all([
    tx.producto.findMany({ where: { id: { in: ids }, tenantId, area }, include: { familia: true }, orderBy: [{ familia: { orden: "asc" } }, { nombre: "asc" }] }),
    tx.productoCentro.findMany({ where: { centroId, productoId: { in: ids } } }),
    resolutorAlmacen(tx, [centroId], ids),
  ]);
  const aj = new Map(ajustes.map((a) => [a.productoId, a]));
  return productos.map((p) => {
    const origen = enOrigen.get(p.id) ?? 0;
    const destino = enDestino.get(p.id) ?? 0;
    const a = aj.get(p.id);
    const objetivo = a?.maximo != null ? num(a.maximo) : a?.minimo != null ? num(a.minimo) : null;
    // solo se propone reponer si el destino es su sitio y el centro tiene marcado hasta dónde
    const propuesta = objetivo !== null && resolver(centroId, p.id) === destinoId ? r3(Math.max(0, Math.min(origen, objetivo - destino))) : 0;
    return {
      id: p.id,
      referencia: p.referencia,
      nombre: p.nombre,
      unidad: p.unidad,
      familia: p.familia?.nombre ?? "Sin familia",
      enOrigen: r3(origen),
      enDestino: r3(destino),
      enCentro: r3(total.get(p.id) ?? 0),
      propuesta,
    };
  });
}

/** Traspasos hechos (agrupados por documento), los más recientes primero. */
export async function listarTraspasos(tx: Tx, tenantId: string, area: AreaAlmacen, centroIds: string[], limite = 50) {
  if (centroIds.length === 0) return [];
  const movs = await tx.movimientoStock.findMany({
    where: { tenantId, centroId: { in: centroIds }, tipo: "TRASPASO", producto: { area } },
    include: { producto: { select: { nombre: true, referencia: true, unidad: true } }, centro: { select: { nombre: true } }, almacen: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: limite * 20,
  });
  const docs = new Map<
    string,
    { documento: string; fecha: Date; centro: string; origen: string; destino: string; motivo: string | null; usuarioId: string | null; valor: number; lineas: { producto: string; referencia: string; unidad: string; cantidad: number }[] }
  >();
  for (const m of movs) {
    const k = m.documento ?? m.id;
    if (!docs.has(k)) docs.set(k, { documento: k, fecha: m.createdAt, centro: m.centro.nombre, origen: "—", destino: "—", motivo: m.motivo, usuarioId: m.usuarioId, valor: 0, lineas: [] });
    const d = docs.get(k)!;
    const cant = num(m.cantidad);
    if (cant < 0) d.origen = m.almacen?.nombre ?? "Sin ubicar";
    else {
      d.destino = m.almacen?.nombre ?? "Sin ubicar";
      d.valor = r2(d.valor + cant * num(m.costeUnitario));
      d.lineas.push({ producto: m.producto.nombre, referencia: m.producto.referencia, unidad: m.producto.unidad, cantidad: cant });
    }
  }
  return Array.from(docs.values()).slice(0, limite);
}
