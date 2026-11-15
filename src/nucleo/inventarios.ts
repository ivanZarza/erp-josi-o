import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { registrarMovimientos, resolutorAlmacen, type NuevoMovimiento } from "./movimientos";
import { stockEnCentro } from "./stock";
import { hoyMadrid } from "@/kernel/fechas";
import { ErrorNegocio, UMBRAL_APROBACION_INVENTARIO, num, r2, r3, r4, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Inventarios (motor común de Bebidas y Comidas).
 * ABIERTO (se guarda el stock teórico al crearlo; se cuenta y se guarda el recuento cuantas veces haga falta)
 * → al terminar: si el descuadre total en € (valor absoluto) supera 500 €, PENDIENTE_APROBACION
 *   y lo cierra quien tenga el permiso «cerrar inventarios»; si no, se cierra directamente
 * → CERRADO: un movimiento AJUSTE_INVENTARIO por cada línea contada con diferencia (contado − teórico).
 * Las líneas sin contar no se ajustan.
 *
 * Almacenes: un inventario puede ser de todo el centro o de un solo almacén (p. ej. contar la Barra sola).
 * - De un almacén: el teórico es el stock de ese almacén, salen los productos con stock allí o que lo
 *   tienen como almacén por defecto, y el ajuste se apunta en ese almacén.
 * - De todo el centro: el teórico es el total del centro; el ajuste lo reparte el motor (las sobras
 *   entran en el almacén por defecto; las faltas salen del por defecto y, si no basta, de los demás).
 * No puede haber a la vez dos inventarios sin cerrar del mismo almacén, ni uno del centro con otro de un almacén.
 * Uno sin cerrar se puede CANCELAR (cancelarInventario): no ajusta stock y deja empezar otro.
 */

export async function crearInventario(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, d: { centroId: string; almacenId?: string | null; nombre?: string | null }) {
  const centro = await tx.centro.findFirst({ where: { id: d.centroId, tenantId } });
  if (!centro) throw new ErrorNegocio("El centro no existe.");
  const almacen = d.almacenId ? await tx.almacen.findFirst({ where: { id: d.almacenId, centroId: d.centroId, activo: true } }) : null;
  if (d.almacenId && !almacen) throw new ErrorNegocio("El almacén elegido no es de ese centro.");
  const abierto = await tx.inventario.findFirst({
    where: {
      tenantId,
      area,
      centroId: d.centroId,
      estado: { in: ["ABIERTO", "PENDIENTE_APROBACION"] },
      // choca con uno de todo el centro, o con uno del mismo almacén (si este es de un almacén)
      ...(almacen ? { OR: [{ almacenId: null }, { almacenId: almacen.id }] } : {}),
    },
    include: { almacen: { select: { nombre: true } } },
  });
  if (abierto) {
    const de = abierto.almacen ? `${abierto.almacen.nombre} de ${centro.nombre}` : centro.nombre;
    throw new ErrorNegocio(`Ya hay un inventario sin cerrar en ${de} (${abierto.numero}). Termínalo antes de empezar otro.`);
  }
  const stock = await stockEnCentro(tx, tenantId, area, d.centroId, almacen ? almacen.id : undefined);
  const productos = await tx.producto.findMany({
    where: { tenantId, area, OR: [{ activo: true }, { id: { in: Array.from(stock.keys()) } }] },
    select: { id: true, costeUnitario: true, activo: true },
  });
  // en un local solo se cuenta lo que tiene stock o mínimo propio; en obrador y almacén, todo lo activo
  const conMinimo = new Set(
    (await tx.productoCentro.findMany({ where: { centroId: d.centroId, minimo: { gt: 0 } }, select: { productoId: true } })).map((x) => x.productoId),
  );
  let lineas = productos.filter((p) => (stock.get(p.id) ?? 0) !== 0 || (p.activo && (centro.tipo !== "LOCAL" || conMinimo.has(p.id))));
  if (almacen) {
    // de un almacén: lo que tiene stock allí o lo que debería estar allí (almacén por defecto)
    const { resolver } = await resolutorAlmacen(tx, [d.centroId], lineas.map((p) => p.id));
    lineas = lineas.filter((p) => (stock.get(p.id) ?? 0) !== 0 || resolver(d.centroId, p.id) === almacen.id);
  }
  if (lineas.length === 0) throw new ErrorNegocio(`No hay productos que contar en ${almacen ? `${almacen.nombre} de ` : ""}${centro.nombre}.`);
  const numero = await siguienteNumero(tx, tenantId, "INV");
  const inv = await tx.inventario.create({
    data: {
      tenantId,
      numero,
      area,
      centroId: d.centroId,
      almacenId: almacen?.id ?? null,
      nombre: nombreInventario(d.nombre?.trim() || nombrePorDefecto(), almacen?.nombre),
      estado: "ABIERTO",
      creadoPor: usuarioId,
      lineas: { create: lineas.map((p) => ({ productoId: p.id, teorico: new Prisma.Decimal(r3(stock.get(p.id) ?? 0)), coste: new Prisma.Decimal(r4(num(p.costeUnitario))) })) },
    },
  });
  await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: inv.id, accion: "crear", despues: { numero, centroId: d.centroId, almacenId: almacen?.id ?? null, lineas: lineas.length } });
  return inv;
}

/** Un inventario de un almacén lleva delante el nombre del almacén («Barra · Semana 45 · 2026»). */
function nombreInventario(nombre: string, almacen?: string): string {
  if (!almacen || nombre.toLowerCase().includes(almacen.toLowerCase())) return nombre;
  return `${almacen} · ${nombre}`;
}

/** «Semana 45 · 2026» (semana ISO del día de hoy en Madrid). */
export function nombrePorDefecto(hoy = new Date()): string {
  const [anio, mes, diaMes] = hoyMadrid(0, hoy).split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, diaMes));
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
      // inventario de un almacén: el ajuste va a ese almacén; de todo el centro: lo reparte el motor
      ...(inv.almacenId ? { almacenId: inv.almacenId } : {}),
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

/**
 * Cancelar un inventario sin cerrar (contando o pendiente de aprobación): no ajusta nada de stock y deja libre
 * el centro (o el almacén) para empezar otro. Se conserva con lo contado, para el historial.
 * Contando: quien puede hacer inventarios. Pendiente de aprobación: solo quien puede cerrarlos (lo mira la acción).
 */
export async function cancelarInventario(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, motivo?: string | null) {
  const inv = await inventarioDe(tx, tenantId, area, id);
  if (inv.estado !== "ABIERTO" && inv.estado !== "PENDIENTE_APROBACION") throw new ErrorNegocio("Solo se cancela un inventario que no esté cerrado.");
  await tx.inventario.update({ where: { id }, data: { estado: "CANCELADO", cerradoPor: usuarioId, cerradoEn: new Date() } });
  await auditar(tx, { tenantId, usuarioId, entidad: "Inventario", entidadId: id, accion: "cancelar", antes: { estado: inv.estado }, despues: { motivo: motivo?.trim() || null, ...cuentasInventario(inv.lineas) } });
  await emitir(tx, tenantId, "almacen.inventario.cancelado", { inventarioId: id, numero: inv.numero, area, centroId: inv.centroId });
}

export async function listarInventarios(tx: Tx, tenantId: string, area: AreaAlmacen, centroIds: string[]) {
  return tx.inventario.findMany({
    where: { tenantId, area, centroId: { in: centroIds } },
    include: { centro: { select: { nombre: true, codigo: true } }, almacen: { select: { nombre: true } }, lineas: { select: { teorico: true, contado: true, coste: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function leerInventario(tx: Tx, tenantId: string, area: AreaAlmacen, id: string) {
  return tx.inventario.findFirst({
    where: { id, tenantId, area },
    include: {
      centro: { select: { id: true, nombre: true, codigo: true } },
      almacen: { select: { id: true, nombre: true } },
      lineas: { include: { producto: { include: { familia: true } } } },
    },
  });
}

/** Movimientos del centro y del área hechos después de abrir el inventario (avisan de que el teórico ya no es exacto). */
export async function movimientosDesdeApertura(tx: Tx, tenantId: string, area: AreaAlmacen, inv: { id: string; centroId: string; almacenId?: string | null; createdAt: Date }) {
  return tx.movimientoStock.count({
    where: { tenantId, centroId: inv.centroId, ...(inv.almacenId ? { almacenId: inv.almacenId } : { tipo: { not: "TRASPASO" as const } }), createdAt: { gt: inv.createdAt }, producto: { area }, OR: [{ documentoId: null }, { documentoId: { not: inv.id } }] },
  });
}
