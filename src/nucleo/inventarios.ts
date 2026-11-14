import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { registrarMovimientos, type NuevoMovimiento } from "./movimientos";
import { stockEnCentro } from "./stock";
import { ErrorNegocio, UMBRAL_APROBACION_INVENTARIO, num, r2, r3, r4, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Inventarios (motor común de Bebidas y Comidas).
 * ABIERTO (se guarda el stock teórico al crearlo; se cuenta y se guarda el recuento cuantas veces haga falta)
 * → al terminar: si el descuadre total en € (valor absoluto) supera 500 €, PENDIENTE_APROBACION
 *   y lo cierra quien tenga el permiso «cerrar inventarios»; si no, se cierra directamente
 * → CERRADO: un movimiento AJUSTE_INVENTARIO por cada línea contada con diferencia (contado − teórico).
 * Las líneas sin contar no se ajustan.
 */

export async function crearInventario(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, d: { centroId: string; nombre?: string | null }) {
  const centro = await tx.centro.findFirst({ where: { id: d.centroId, tenantId } });
  if (!centro) throw new ErrorNegocio("El centro no existe.");
  const abierto = await tx.inventario.findFirst({ where: { tenantId, area, centroId: d.centroId, estado: { in: ["ABIERTO", "PENDIENTE_APROBACION"] } } });
  if (abierto) throw new ErrorNegocio(`Ya hay un inventario sin cerrar en ${centro.nombre} (${abierto.numero}). Termínalo antes de empezar otro.`);
  const stock = await stockEnCentro(tx, tenantId, area, d.centroId);
  const productos = await tx.producto.findMany({
    where: { tenantId, area, OR: [{ activo: true }, { id: { in: Array.from(stock.keys()) } }] },
    select: { id: true, costeUnitario: true, activo: true },
  });
  // en un local solo se cuenta lo que tiene stock o mínimo propio; en obrador y almacén, todo lo activo
  const conMinimo = new Set(
    (await tx.productoCentro.findMany({ where: { centroId: d.centroId, minimo: { gt: 0 } }, select: { productoId: true } })).map((x) => x.productoId),
  );
  const lineas = productos.filter((p) => (stock.get(p.id) ?? 0) !== 0 || (p.activo && (centro.tipo !== "LOCAL" || conMinimo.has(p.id))));
  if (lineas.length === 0) throw new ErrorNegocio("No hay productos que contar en este centro.");
  const numero = await siguienteNumero(tx, tenantId, "INV");
  const inv = await tx.inventario.create({
    data: {
      tenantId,
      numero,
      area,
      centroId: d.centroId,
      nombre: d.nombre?.trim() || nombrePorDefecto(),
      estado: "ABIERTO",
      creadoPor: usuarioId,
      lineas: { create: lineas.map((p) => ({ productoId: p.id, teorico: new Prisma.Decimal(r3(stock.get(p.id) ?? 0)), coste: new Prisma.Decimal(r4(num(p.costeUnitario))) })) },
    },
  });
  await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: inv.id, accion: "crear", despues: { numero, centroId: d.centroId, lineas: lineas.length } });
  return inv;
}

/** «Semana 45 · 2026» (semana ISO). */
export function nombrePorDefecto(hoy = new Date()): string {
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
  return `Semana ${semana} · ${d.getUTCFullYear()}`;
}

async function inventarioDe(tx: Tx, tenantId: string, area: AreaAlmacen, id: string) {
  const inv = await tx.inventario.findFirst({ where: { id, tenantId, area }, include: { lineas: true } });
  if (!inv) throw new ErrorNegocio("El inventario no existe.");
  return inv;
}

/** Guarda el recuento (se puede guardar muchas veces). null = sin contar. */
export async function guardarRecuento(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, contados: Map<string, number | null>) {
  const inv = await inventarioDe(tx, tenantId, area, id);
  if (inv.estado !== "ABIERTO") throw new ErrorNegocio("El inventario ya no está abierto: no se puede cambiar el recuento.");
  let cambios = 0;
  for (const l of inv.lineas) {
    if (!contados.has(l.id)) continue;
    const v = contados.get(l.id);
    if (v !== null && v !== undefined && v < 0) throw new ErrorNegocio("Una cantidad contada no puede ser negativa.");
    const nuevo = v === null || v === undefined ? null : r3(v);
    const antes = l.contado === null ? null : num(l.contado);
    if (nuevo === antes) continue;
    cambios++;
    await tx.inventarioLinea.update({ where: { id: l.id }, data: { contado: nuevo === null ? null : new Prisma.Decimal(nuevo) } });
  }
  if (cambios > 0) await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: id, accion: "recuento", despues: { lineasCambiadas: cambios } });
  return cambios;
}

export interface CuentasInventario {
  lineas: number;
  contadas: number;
  conDiferencia: number;
  diferenciaUnidades: number;
  diferenciaEuros: number; // con signo
  descuadreEuros: number; // suma de valores absolutos
}

export function cuentasInventario(lineas: { teorico: unknown; contado: unknown; coste: unknown }[]): CuentasInventario {
  let contadas = 0;
  let conDiferencia = 0;
  let unidades = 0;
  let eurosNeto = 0;
  let descuadre = 0;
  for (const l of lineas) {
    if (l.contado === null || l.contado === undefined) continue;
    contadas++;
    const dif = r3(num(l.contado as never) - num(l.teorico as never));
    if (dif === 0) continue;
    conDiferencia++;
    unidades += dif;
    const e = dif * num(l.coste as never);
    eurosNeto += e;
    descuadre += Math.abs(e);
  }
  return { lineas: lineas.length, contadas, conDiferencia, diferenciaUnidades: r3(unidades), diferenciaEuros: r2(eurosNeto), descuadreEuros: r2(descuadre) };
}

async function aplicar(tx: Tx, tenantId: string, usuarioId: string, inv: Awaited<ReturnType<typeof inventarioDe>>) {
  const movs: NuevoMovimiento[] = [];
  for (const l of inv.lineas) {
    if (l.contado === null) continue;
    const dif = r3(num(l.contado) - num(l.teorico));
    if (dif === 0) continue;
    movs.push({
      tenantId,
      centroId: inv.centroId,
      productoId: l.productoId,
      tipo: "AJUSTE_INVENTARIO",
      cantidad: dif,
      costeUnitario: num(l.coste),
      documento: inv.numero,
      documentoId: inv.id,
      motivo: `Inventario ${inv.nombre}`,
      usuarioId,
    });
  }
  await registrarMovimientos(tx, movs);
  const cuentas = cuentasInventario(inv.lineas);
  await tx.inventario.update({ where: { id: inv.id }, data: { estado: "CERRADO", cerradoPor: usuarioId, cerradoEn: new Date() } });
  await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: inv.id, accion: "cerrar", despues: { ...cuentas } });
  await emitir(tx, tenantId, "almacen.inventario.cerrado", { inventarioId: inv.id, numero: inv.numero, area: inv.area, centroId: inv.centroId, diferenciaEuros: cuentas.diferenciaEuros });
  return cuentas;
}

/**
 * Terminar el recuento. Si el descuadre supera el umbral, queda pendiente de aprobación;
 * si no, se cierra y se regulariza el stock.
 */
export async function terminarInventario(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string) {
  const inv = await inventarioDe(tx, tenantId, area, id);
  if (inv.estado !== "ABIERTO") throw new ErrorNegocio("El inventario no está abierto.");
  const cuentas = cuentasInventario(inv.lineas);
  if (cuentas.contadas === 0) throw new ErrorNegocio("No se ha contado nada todavía.");
  if (cuentas.descuadreEuros > UMBRAL_APROBACION_INVENTARIO) {
    await tx.inventario.update({ where: { id }, data: { estado: "PENDIENTE_APROBACION" } });
    await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: id, accion: "pedir-aprobacion", despues: { ...cuentas } });
    await emitir(tx, tenantId, "almacen.inventario.pendiente", { inventarioId: id, numero: inv.numero, area, centroId: inv.centroId, descuadreEuros: cuentas.descuadreEuros });
    return { estado: "PENDIENTE_APROBACION" as const, cuentas };
  }
  await aplicar(tx, tenantId, usuarioId, inv);
  return { estado: "CERRADO" as const, cuentas };
}

/** Aprobar y cerrar un inventario con descuadre grande (solo con permiso de cerrar inventarios). */
export async function aprobarInventario(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string) {
  const inv = await inventarioDe(tx, tenantId, area, id);
  if (inv.estado !== "PENDIENTE_APROBACION") throw new ErrorNegocio("Este inventario no está pendiente de aprobación.");
  return aplicar(tx, tenantId, usuarioId, inv);
}

/** Devolver a recuento (por ejemplo, para volver a contar las líneas con más diferencia). */
export async function reabrirInventario(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string) {
  const inv = await inventarioDe(tx, tenantId, area, id);
  if (inv.estado !== "PENDIENTE_APROBACION") throw new ErrorNegocio("Solo se devuelve a recuento un inventario pendiente de aprobación.");
  await tx.inventario.update({ where: { id }, data: { estado: "ABIERTO" } });
  await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: id, accion: "reabrir" });
}

export async function listarInventarios(tx: Tx, tenantId: string, area: AreaAlmacen, centroIds: string[]) {
  return tx.inventario.findMany({
    where: { tenantId, area, centroId: { in: centroIds } },
    include: { centro: { select: { nombre: true, codigo: true } }, lineas: { select: { teorico: true, contado: true, coste: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function leerInventario(tx: Tx, tenantId: string, area: AreaAlmacen, id: string) {
  return tx.inventario.findFirst({
    where: { id, tenantId, area },
    include: {
      centro: { select: { id: true, nombre: true, codigo: true } },
      lineas: { include: { producto: { include: { familia: true } } } },
    },
  });
}

/** Movimientos del centro y del área hechos después de abrir el inventario (avisan de que el teórico ya no es exacto). */
export async function movimientosDesdeApertura(tx: Tx, tenantId: string, area: AreaAlmacen, inv: { id: string; centroId: string; createdAt: Date }) {
  return tx.movimientoStock.count({
    where: { tenantId, centroId: inv.centroId, createdAt: { gt: inv.createdAt }, producto: { area }, NOT: { documentoId: inv.id } },
  });
}
