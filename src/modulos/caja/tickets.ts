/**
 * Tickets con líneas de Caja: cálculo de importes, guardado (uno o miles a la vez), anulaciones y la
 * jornada de venta calculada desde los tickets. Sin "server-only": lo usan la pantalla de Caja (a través
 * de servicio.ts), la importación del TPV y la semilla de Raza Pruebas, con la MISMA lógica.
 * Las líneas descuentan stock con descontarStockVentas (src/nucleo/consumo-ventas.ts).
 * Ver docs/specs/modulos/caja/README.md.
 */
import type { Prisma } from "../../generated/prisma/client";
import type { Tx } from "../../nucleo/motor-movimientos";
import { cargarEscandallos, costesProductos, consumoDeVenta, descontarStockVentas, type EscandalloVenta, type LineaVendida } from "../../nucleo/consumo-ventas";
import { insertarPorLotes, UMBRAL_LOTE_RAPIDO } from "../../nucleo/insertar-lotes";

export class ErrorTicket extends Error {}

export type FormaCobro = "EFECTIVO" | "TARJETA" | "BIZUM" | "VALE" | "CREDITO" | "OTRA";
export type EstadoTicket = "ABIERTO" | "COBRADO" | "ANULADO";
export type Origen = "MANUAL" | "TPV";

export interface LineaTicketNueva {
  platoId?: string | null;
  formatoId?: string | null;
  /** Texto del ticket; si no se da, nombre del plato y del formato. */
  concepto?: string;
  cantidad: number;
  /** PVP unitario con IVA; si no se da, el de la carta en ese local (formato incluido). */
  precio?: number;
  iva?: number;
  descuento?: number; // importe con IVA
  invitacion?: boolean;
  /** Línea que ya llega anulada (del TPV o de la semilla): no mueve stock. */
  anulada?: { motivo: string; por?: string | null; en?: Date } | null;
  momento?: Date;
}

export interface CobroNuevo {
  forma: FormaCobro;
  importe: number; // con IVA, sin propina. Negativo en un único cobro = «el total del ticket» (CSV del TPV)
  propina?: number;
  momento?: Date;
}

export interface TicketNuevo {
  id?: string;
  centroId: string;
  numero: string;
  abiertoEn: Date;
  cobradoEn?: Date | null;
  /** Día de negocio «AAAA-MM-DD»; si no se da, sale de abiertoEn y la hora de corte del centro. */
  fecha?: string;
  mesa?: string | null;
  comensales: number;
  empleadoId?: string | null;
  camarero?: string | null;
  estado: EstadoTicket;
  anulacion?: { motivo: string; por?: string | null; en?: Date } | null;
  lineas: LineaTicketNueva[];
  cobros: CobroNuevo[];
  origen?: Origen;
  externoId?: string | null;
  reservaId?: string | null;
  notas?: string | null;
  creadoPor?: string | null;
}

// ---------------------------------------------------------------------------------------------
// Utilidades de fecha y redondeo
// ---------------------------------------------------------------------------------------------

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

const formatoMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Fecha y hora de Madrid de un instante: { dia: «AAAA-MM-DD», minutos desde medianoche }. */
export function horaMadrid(d: Date): { dia: string; minutos: number } {
  const p = Object.fromEntries(formatoMadrid.formatToParts(d).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** Día de negocio de un instante: antes de la hora de corte cuenta para el día anterior. */
export function diaDeNegocio(d: Date, horaCorte = "05:00"): string {
  const [h, m] = horaCorte.split(":").map(Number);
  const { dia, minutos } = horaMadrid(d);
  if (minutos >= h * 60 + (m || 0)) return dia;
  return new Date(Date.parse(`${dia}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Comida hasta las 17:00 (hora de Madrid); cena desde entonces (y hasta la hora de corte). */
export function turnoDe(d: Date, horaCorte = "05:00"): "COMIDA" | "CENA" {
  const [h] = horaCorte.split(":").map(Number);
  const { minutos } = horaMadrid(d);
  return minutos >= h * 60 && minutos < 17 * 60 ? "COMIDA" : "CENA";
}

export const aFechaDia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ---------------------------------------------------------------------------------------------
// Importes
// ---------------------------------------------------------------------------------------------

export interface ImportesLinea {
  bruto: number; // cantidad × precio, con IVA
  total: number; // con IVA (0 si invitación o anulada)
  base: number; // sin IVA
  descuentoNeto: number;
  invitacionNeta: number;
  anulacionNeta: number;
}

/** Importes de una línea. Invitación: no se cobra; anulada: no se cobra ni cuenta como venta. */
export function importesLinea(l: { cantidad: number; precio: number; iva: number; descuento: number; invitacion: boolean; anulada: boolean }): ImportesLinea {
  const bruto = r2(l.cantidad * l.precio);
  const div = 1 + l.iva / 100;
  const descuento = Math.min(Math.max(l.descuento, 0), bruto);
  if (l.anulada) return { bruto, total: 0, base: 0, descuentoNeto: 0, invitacionNeta: 0, anulacionNeta: r2((bruto - descuento) / div) };
  if (l.invitacion) return { bruto, total: 0, base: 0, descuentoNeto: 0, invitacionNeta: r2(bruto / div), anulacionNeta: 0 };
  const total = r2(bruto - descuento);
  return { bruto, total, base: r2(total / div), descuentoNeto: r2(descuento / div), invitacionNeta: 0, anulacionNeta: 0 };
}

export interface TotalesTicket {
  base: number;
  cuotaIva: number;
  total: number;
  descuentos: number;
  invitaciones: number;
  anulaciones: number;
}

export function totalesTicket(lineas: ImportesLinea[]): TotalesTicket {
  const s = (f: (x: ImportesLinea) => number) => r2(lineas.reduce((a, l) => a + f(l), 0));
  const total = s((l) => l.total);
  const base = s((l) => l.base);
  return { base, cuotaIva: r2(total - base), total, descuentos: s((l) => l.descuentoNeto), invitaciones: s((l) => l.invitacionNeta), anulaciones: s((l) => l.anulacionNeta) };
}

/** Precio de venta en un local: el ajuste del local para el plato (o su primer formato) o el de la marca. */
export function precioEnLocal(esc: EscandalloVenta, formatoId: string | null | undefined, ajusteLocal: number | null | undefined): number {
  if (esc.formatos.length === 0 || !formatoId) return ajusteLocal ?? esc.precio;
  const i = esc.formatos.findIndex((f) => f.id === formatoId);
  if (i < 0) throw new ErrorTicket(`El formato no es de «${esc.nombre}».`);
  return i === 0 && ajusteLocal != null ? ajusteLocal : esc.formatos[i].precio;
}

export function conceptoLinea(esc: EscandalloVenta, formatoId: string | null | undefined): string {
  const f = formatoId ? esc.formatos.find((x) => x.id === formatoId) : undefined;
  return f ? `${esc.nombre} · ${f.nombre}` : esc.nombre;
}

// ---------------------------------------------------------------------------------------------
// Guardar tickets (uno o miles)
// ---------------------------------------------------------------------------------------------

function nuevoId(): string {
  return globalThis.crypto.randomUUID();
}

async function lotes<T>(filas: T[], n: number, fn: (l: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += n) await fn(filas.slice(i, i + n));
}

/**
 * Guarda tickets con sus líneas y cobros, descuenta el stock de lo pedido y recalcula las jornadas
 * afectadas. Todo por lotes: las mismas consultas para un ticket que para los de 8 semanas.
 * - Las líneas que llegan anuladas, y los tickets anulados, no mueven stock (salió y volvió).
 * - Un ticket cobrado tiene que cuadrar: suma de cobros = total (tolerancia de 1 céntimo por línea).
 */
export async function guardarTickets(tx: Tx, tenantId: string, tickets: TicketNuevo[], opciones: { usuarioId?: string | null; escandallos?: Map<string, EscandalloVenta>; costes?: Map<string, number> } = {}) {
  if (tickets.length === 0) return { ids: [] as string[], movimientos: 0 };
  const centroIds = Array.from(new Set(tickets.map((t) => t.centroId)));
  const platoIds = Array.from(new Set(tickets.flatMap((t) => t.lineas.map((l) => l.platoId).filter((x): x is string => !!x))));
  const [centros, escandallos, ajustes] = await Promise.all([
    tx.centro.findMany({ where: { tenantId, id: { in: centroIds } }, select: { id: true, horaCorte: true } }),
    opciones.escandallos && platoIds.every((p) => opciones.escandallos!.has(p)) ? Promise.resolve(opciones.escandallos) : cargarEscandallos(tx, tenantId, platoIds),
    platoIds.length ? tx.cartaPlatoPrecio.findMany({ where: { platoId: { in: platoIds }, centroId: { in: centroIds } }, select: { platoId: true, centroId: true, precio: true, disponible: true } }) : Promise.resolve([]),
  ]);
  const corte = new Map(centros.map((c) => [c.id, c.horaCorte ?? "05:00"]));
  for (const id of centroIds) if (!corte.has(id)) throw new ErrorTicket("Local no encontrado.");
  const ajuste = new Map(ajustes.map((a) => [`${a.platoId}|${a.centroId}`, a]));
  const costes =
    opciones.costes ??
    (await costesProductos(
      tx,
      tenantId,
      Array.from(escandallos.values()).flatMap((e) => [...e.ingredientes.map((i) => i.productoId), ...e.formatos.map((f) => f.productoId).filter((x): x is string => !!x)]),
    ));

  const filasTicket: Prisma.TicketCreateManyInput[] = [];
  const filasLinea: Prisma.TicketLineaCreateManyInput[] = [];
  const filasCobro: Prisma.TicketCobroCreateManyInput[] = [];
  const vendidas: LineaVendida[] = [];
  const claveJornada = new Set<string>();

  for (const t of tickets) {
    const id = t.id ?? nuevoId();
    const horaCorte = corte.get(t.centroId)!;
    const fecha = t.fecha ?? diaDeNegocio(t.abiertoEn, horaCorte);
    claveJornada.add(`${t.centroId}|${fecha}`);
    if (t.comensales < 0) throw new ErrorTicket("Los comensales no pueden ser negativos.");
    const importes: ImportesLinea[] = [];
    let costeTicket = 0;
    t.lineas.forEach((l, i) => {
      if (!(l.cantidad > 0)) throw new ErrorTicket("La cantidad de cada línea tiene que ser mayor que cero.");
      const esc = l.platoId ? escandallos.get(l.platoId) : undefined;
      if (l.platoId && !esc) throw new ErrorTicket("Hay una línea con un plato que no existe.");
      const aj = esc ? ajuste.get(`${esc.platoId}|${t.centroId}`) : undefined;
      if (esc && aj && !aj.disponible && t.origen !== "TPV") throw new ErrorTicket(`«${esc.nombre}» no se sirve en este local.`);
      if (!esc && l.precio === undefined) throw new ErrorTicket("Una línea sin plato de la carta necesita precio.");
      const precio = l.precio ?? precioEnLocal(esc!, l.formatoId, aj?.precio != null ? Number(aj.precio) : null);
      const iva = l.iva ?? esc?.iva ?? 10;
      const anulada = !!l.anulada || t.estado === "ANULADO";
      const imp = importesLinea({ cantidad: l.cantidad, precio, iva, descuento: l.descuento ?? 0, invitacion: !!l.invitacion, anulada: !!l.anulada });
      importes.push(imp);
      const momento = l.momento ?? t.abiertoEn;
      // coste teórico de lo servido (las invitaciones también se sirven); lo anulado no cuenta
      let coste = 0;
      if (esc && !anulada) {
        for (const c of consumoDeVenta(esc, l.formatoId, l.cantidad)) coste += c.cantidad * (costes.get(c.productoId) ?? 0);
        vendidas.push({ centroId: t.centroId, platoId: esc.platoId, formatoId: l.formatoId ?? null, cantidad: l.cantidad, sentido: "venta", fecha: momento, documento: t.numero, documentoId: id, motivo: `Venta: ticket ${t.numero}${t.mesa ? ` · mesa ${t.mesa}` : ""}`, usuarioId: opciones.usuarioId ?? t.creadoPor ?? null });
      }
      coste = r4(coste);
      costeTicket += coste;
      filasLinea.push({
        id: nuevoId(),
        ticketId: id,
        orden: i + 1,
        momento,
        platoId: esc?.platoId ?? null,
        formatoId: esc && l.formatoId ? l.formatoId : null,
        concepto: l.concepto ?? (esc ? conceptoLinea(esc, l.formatoId) : "Sin concepto"),
        cantidad: r3(l.cantidad),
        precio,
        iva,
        descuento: r2(l.descuento ?? 0),
        invitacion: !!l.invitacion,
        total: imp.total,
        base: imp.base,
        costeTeorico: coste,
        anulada: !!l.anulada,
        motivoAnulacion: l.anulada?.motivo ?? null,
        anuladaPor: l.anulada?.por ?? null,
        anuladaEn: l.anulada ? (l.anulada.en ?? momento) : null,
      });
    });
    const tot = totalesTicket(importes);
    if (t.cobros.length === 1 && t.cobros[0].importe < 0) t.cobros[0] = { ...t.cobros[0], importe: tot.total };
    const propina = r2(t.cobros.reduce((s, c) => s + (c.propina ?? 0), 0));
    const cobrado = r2(t.cobros.reduce((s, c) => s + c.importe, 0));
    if (t.estado === "COBRADO" && Math.abs(cobrado - tot.total) > Math.max(0.01, 0.01 * t.lineas.length))
      throw new ErrorTicket(`Ticket ${t.numero}: lo cobrado (${cobrado}) no cuadra con el total (${tot.total}).`);
    if (t.estado === "ABIERTO" && t.cobros.length) throw new ErrorTicket(`Ticket ${t.numero}: un ticket abierto no lleva cobros.`);
    filasTicket.push({
      id,
      tenantId,
      centroId: t.centroId,
      fecha: aFechaDia(fecha),
      numero: t.numero,
      abiertoEn: t.abiertoEn,
      cobradoEn: t.estado === "COBRADO" ? (t.cobradoEn ?? t.abiertoEn) : null,
      turno: turnoDe(t.abiertoEn, horaCorte),
      mesa: t.mesa ?? null,
      comensales: t.comensales,
      empleadoId: t.empleadoId ?? null,
      camarero: t.camarero ?? null,
      estado: t.estado,
      ...tot,
      // un ticket anulado entero: todo lo que llevaba cuenta como anulado
      ...(t.estado === "ANULADO" ? { anulaciones: r2(importes.reduce((s, x) => s + x.anulacionNeta + x.base, 0)) } : {}),
      propina,
      costeTeorico: t.estado === "ANULADO" ? 0 : r4(costeTicket),
      origen: t.origen ?? "MANUAL",
      externoId: t.externoId ?? null,
      reservaId: t.reservaId ?? null,
      motivoAnulacion: t.anulacion?.motivo ?? null,
      anuladoPor: t.anulacion?.por ?? null,
      anuladoEn: t.estado === "ANULADO" ? (t.anulacion?.en ?? t.abiertoEn) : null,
      notas: t.notas ?? null,
      creadoPor: t.creadoPor ?? opciones.usuarioId ?? null,
      createdAt: t.abiertoEn,
    });
    for (const c of t.cobros) filasCobro.push({ id: nuevoId(), ticketId: id, forma: c.forma, importe: r2(c.importe), propina: r2(c.propina ?? 0), momento: c.momento ?? t.cobradoEn ?? t.abiertoEn });
  }

  await lotes(filasTicket, 1000, (l) => tx.ticket.createMany({ data: l }));
  // las líneas pueden ser decenas de miles (importación grande o la carga de la semilla): inserción rápida
  if (filasLinea.length < UMBRAL_LOTE_RAPIDO) await tx.ticketLinea.createMany({ data: filasLinea });
  else
    await insertarPorLotes(
      tx,
      "TicketLinea",
      [["id", "text"], ["ticketId", "text"], ["orden", "int"], ["momento", "timestamp"], ["platoId", "text"], ["formatoId", "text"], ["concepto", "text"], ["cantidad", "numeric"], ["precio", "numeric"], ["iva", "numeric"], ["descuento", "numeric"], ["invitacion", "boolean"], ["total", "numeric"], ["base", "numeric"], ["costeTeorico", "numeric"], ["anulada", "boolean"], ["motivoAnulacion", "text"], ["anuladaPor", "text"], ["anuladaEn", "timestamp"]],
      filasLinea as Record<string, unknown>[],
    );
  await lotes(filasCobro, 3000, (l) => tx.ticketCobro.createMany({ data: l }));
  const r = await descontarStockVentas(tx, tenantId, vendidas, { escandallos, costes });
  await recalcularJornadas(
    tx,
    tenantId,
    Array.from(claveJornada).map((k) => {
      const [centroId, fecha] = k.split("|");
      return { centroId, fecha };
    }),
  );
  return { ids: filasTicket.map((t) => t.id as string), movimientos: r.movimientos };
}

// ---------------------------------------------------------------------------------------------
// Cambios en un ticket: añadir líneas, cobrar, anular una línea o el ticket entero
// ---------------------------------------------------------------------------------------------

async function ticketDe(tx: Tx, tenantId: string, ticketId: string) {
  const t = await tx.ticket.findFirst({ where: { id: ticketId, tenantId }, include: { lineas: { orderBy: { orden: "asc" } }, cobros: true } });
  if (!t) throw new ErrorTicket("Ticket no encontrado.");
  return t;
}

/** Vuelve a sumar las líneas del ticket y guarda sus totales. */
async function actualizarTotales(tx: Tx, ticketId: string) {
  const t = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { lineas: true, cobros: true } });
  const imp = t.lineas.map((l) =>
    importesLinea({ cantidad: Number(l.cantidad), precio: Number(l.precio), iva: Number(l.iva), descuento: Number(l.descuento), invitacion: l.invitacion, anulada: l.anulada }),
  );
  const tot = totalesTicket(imp);
  await tx.ticket.update({
    where: { id: ticketId },
    data: {
      ...tot,
      ...(t.estado === "ANULADO" ? { anulaciones: r2(imp.reduce((s, x) => s + x.anulacionNeta + x.base, 0)) } : {}),
      costeTeorico: t.estado === "ANULADO" ? 0 : r4(t.lineas.filter((l) => !l.anulada).reduce((s, l) => s + Number(l.costeTeorico), 0)),
      propina: r2(t.cobros.reduce((s, c) => s + Number(c.propina), 0)),
    },
  });
}

/** Añade líneas a un ticket abierto (bajan el stock en ese momento). */
export async function anadirLineas(tx: Tx, tenantId: string, ticketId: string, lineas: LineaTicketNueva[], usuarioId?: string | null) {
  const t = await ticketDe(tx, tenantId, ticketId);
  if (t.estado !== "ABIERTO") throw new ErrorTicket("Solo se pueden añadir líneas a un ticket abierto.");
  const platoIds = lineas.map((l) => l.platoId).filter((x): x is string => !!x);
  const [escandallos, ajustes] = await Promise.all([cargarEscandallos(tx, tenantId, platoIds), tx.cartaPlatoPrecio.findMany({ where: { platoId: { in: platoIds }, centroId: t.centroId } })]);
  const ajuste = new Map(ajustes.map((a) => [a.platoId, a]));
  const vendidas: LineaVendida[] = [];
  const filas: Prisma.TicketLineaCreateManyInput[] = [];
  const ahora = new Date();
  lineas.forEach((l, i) => {
    if (!(l.cantidad > 0)) throw new ErrorTicket("La cantidad tiene que ser mayor que cero.");
    const esc = l.platoId ? escandallos.get(l.platoId) : undefined;
    if (!esc) throw new ErrorTicket("Elige un plato de la carta.");
    const aj = ajuste.get(esc.platoId);
    if (aj && !aj.disponible) throw new ErrorTicket(`«${esc.nombre}» no se sirve en este local.`);
    const precio = l.precio ?? precioEnLocal(esc, l.formatoId, aj?.precio != null ? Number(aj.precio) : null);
    const imp = importesLinea({ cantidad: l.cantidad, precio, iva: esc.iva, descuento: l.descuento ?? 0, invitacion: !!l.invitacion, anulada: false });
    const id = nuevoId();
    vendidas.push({ centroId: t.centroId, platoId: esc.platoId, formatoId: l.formatoId ?? null, cantidad: l.cantidad, sentido: "venta", fecha: l.momento ?? ahora, documento: t.numero, documentoId: t.id, motivo: `Venta: ticket ${t.numero}${t.mesa ? ` · mesa ${t.mesa}` : ""}`, usuarioId });
    filas.push({ id, ticketId: t.id, orden: t.lineas.length + i + 1, momento: l.momento ?? ahora, platoId: esc.platoId, formatoId: l.formatoId ?? null, concepto: l.concepto ?? conceptoLinea(esc, l.formatoId), cantidad: r3(l.cantidad), precio, iva: esc.iva, descuento: r2(l.descuento ?? 0), invitacion: !!l.invitacion, total: imp.total, base: imp.base });
  });
  const r = await descontarStockVentas(tx, tenantId, vendidas, { escandallos });
  filas.forEach((f, i) => (f.costeTeorico = r.costes[i]));
  await tx.ticketLinea.createMany({ data: filas });
  await actualizarTotales(tx, t.id);
  await recalcularJornadas(tx, tenantId, [{ centroId: t.centroId, fecha: t.fecha.toISOString().slice(0, 10) }]);
  return t;
}

/** Cobra un ticket abierto (uno o varios cobros; la suma tiene que ser el total). */
export async function cobrarTicket(tx: Tx, tenantId: string, ticketId: string, cobros: CobroNuevo[]) {
  const t = await ticketDe(tx, tenantId, ticketId);
  if (t.estado !== "ABIERTO") throw new ErrorTicket("Ese ticket no está abierto.");
  const total = Number(t.total);
  const cobrado = r2(cobros.reduce((s, c) => s + c.importe, 0));
  if (Math.abs(cobrado - total) > 0.01) throw new ErrorTicket(`Lo cobrado (${cobrado}) no cuadra con el total del ticket (${total}).`);
  const ahora = new Date();
  await tx.ticketCobro.createMany({ data: cobros.filter((c) => c.importe > 0 || (c.propina ?? 0) > 0).map((c) => ({ ticketId: t.id, forma: c.forma, importe: r2(c.importe), propina: r2(c.propina ?? 0), momento: c.momento ?? ahora })) });
  await tx.ticket.update({ where: { id: t.id }, data: { estado: "COBRADO", cobradoEn: ahora } });
  await actualizarTotales(tx, t.id);
  await recalcularJornadas(tx, tenantId, [{ centroId: t.centroId, fecha: t.fecha.toISOString().slice(0, 10) }]);
  return t;
}

/** Anula una línea de un ticket abierto: devuelve su stock. */
export async function anularLinea(tx: Tx, tenantId: string, lineaId: string, motivo: string, usuarioId?: string | null) {
  const linea = await tx.ticketLinea.findFirst({ where: { id: lineaId, ticket: { tenantId } }, include: { ticket: true } });
  if (!linea) throw new ErrorTicket("Línea no encontrada.");
  if (linea.anulada) throw new ErrorTicket("Esa línea ya está anulada.");
  if (linea.ticket.estado !== "ABIERTO") throw new ErrorTicket("Solo se anulan líneas de un ticket abierto. Si ya está cobrado, anula el ticket entero y vuelve a hacerlo.");
  if (!motivo.trim()) throw new ErrorTicket("Explica por qué se anula.");
  const t = linea.ticket;
  if (linea.platoId)
    await descontarStockVentas(tx, tenantId, [
      { centroId: t.centroId, platoId: linea.platoId, formatoId: linea.formatoId, cantidad: Number(linea.cantidad), sentido: "anulacion", fecha: new Date(), documento: t.numero, documentoId: t.id, motivo: `Anulación de línea: ticket ${t.numero} · ${motivo}`, usuarioId },
    ]);
  await tx.ticketLinea.update({ where: { id: linea.id }, data: { anulada: true, motivoAnulacion: motivo, anuladaPor: usuarioId ?? null, anuladaEn: new Date(), total: 0, base: 0, costeTeorico: 0 } });
  await actualizarTotales(tx, t.id);
  await recalcularJornadas(tx, tenantId, [{ centroId: t.centroId, fecha: t.fecha.toISOString().slice(0, 10) }]);
  return { ticket: t, linea };
}

/** Anula un ticket entero (abierto o cobrado): devuelve el stock de todas sus líneas y sale de la venta. */
export async function anularTicket(tx: Tx, tenantId: string, ticketId: string, motivo: string, usuarioId?: string | null) {
  const t = await ticketDe(tx, tenantId, ticketId);
  if (t.estado === "ANULADO") throw new ErrorTicket("Ese ticket ya está anulado.");
  if (!motivo.trim()) throw new ErrorTicket("Explica por qué se anula.");
  const ahora = new Date();
  const vivas = t.lineas.filter((l) => !l.anulada && l.platoId);
  await descontarStockVentas(
    tx,
    tenantId,
    vivas.map((l) => ({ centroId: t.centroId, platoId: l.platoId!, formatoId: l.formatoId, cantidad: Number(l.cantidad), sentido: "anulacion" as const, fecha: ahora, documento: t.numero, documentoId: t.id, motivo: `Ticket anulado ${t.numero} · ${motivo}`, usuarioId })),
  );
  await tx.ticket.update({ where: { id: t.id }, data: { estado: "ANULADO", motivoAnulacion: motivo, anuladoPor: usuarioId ?? null, anuladoEn: ahora } });
  await actualizarTotales(tx, t.id);
  await recalcularJornadas(tx, tenantId, [{ centroId: t.centroId, fecha: t.fecha.toISOString().slice(0, 10) }]);
  return t;
}

// ---------------------------------------------------------------------------------------------
// Jornada de venta calculada desde los tickets
// ---------------------------------------------------------------------------------------------

export interface TicketParaJornada {
  estado: EstadoTicket;
  turno: "COMIDA" | "CENA";
  comensales: number;
  base: number;
  cuotaIva: number;
  descuentos: number;
  invitaciones: number;
  anulaciones: number;
  costeTeorico: number;
  origen: Origen;
  cobros: { forma: FormaCobro; importe: number; propina: number }[];
}

export interface JornadaCalculada {
  ventaNeta: number;
  cuotaIva: number;
  ventaComida: number;
  ventaCena: number;
  comensales: number;
  tickets: number;
  descuentos: number;
  invitaciones: number;
  anulaciones: number;
  propinas: number;
  costeTeorico: number;
  origen: Origen;
  pagos: { forma: FormaCobro; importe: number; propina: number }[];
}

/**
 * Totales de una jornada a partir de sus tickets. Cuentan los cobrados; los anulados solo suman en
 * «anulaciones»; los abiertos aún no son venta. Importes de venta sin IVA; cobros con IVA.
 */
export function calcularJornada(tickets: TicketParaJornada[]): JornadaCalculada {
  const cobrados = tickets.filter((t) => t.estado === "COBRADO");
  const s = (xs: TicketParaJornada[], f: (t: TicketParaJornada) => number) => r2(xs.reduce((a, t) => a + f(t), 0));
  const pagos = new Map<FormaCobro, { importe: number; propina: number }>();
  for (const t of cobrados)
    for (const c of t.cobros) {
      const p = pagos.get(c.forma) ?? { importe: 0, propina: 0 };
      p.importe = r2(p.importe + c.importe);
      p.propina = r2(p.propina + c.propina);
      pagos.set(c.forma, p);
    }
  return {
    ventaNeta: s(cobrados, (t) => t.base),
    cuotaIva: s(cobrados, (t) => t.cuotaIva),
    ventaComida: s(cobrados.filter((t) => t.turno === "COMIDA"), (t) => t.base),
    ventaCena: s(cobrados.filter((t) => t.turno === "CENA"), (t) => t.base),
    comensales: cobrados.reduce((a, t) => a + t.comensales, 0),
    tickets: cobrados.length,
    descuentos: s(cobrados, (t) => t.descuentos),
    invitaciones: s(cobrados, (t) => t.invitaciones),
    anulaciones: s(tickets.filter((t) => t.estado !== "ABIERTO"), (t) => t.anulaciones),
    propinas: s(cobrados, (t) => t.cobros.reduce((a, c) => a + c.propina, 0)),
    costeTeorico: s(cobrados, (t) => t.costeTeorico),
    origen: tickets.some((t) => t.origen === "TPV") ? "TPV" : "MANUAL",
    pagos: Array.from(pagos, ([forma, p]) => ({ forma, ...p })),
  };
}

/** Recalcula y guarda la jornada de cada local y día a partir de sus tickets (por lotes). */
export async function recalcularJornadas(tx: Tx, tenantId: string, claves: { centroId: string; fecha: string }[]) {
  if (claves.length === 0) return;
  const centroIds = Array.from(new Set(claves.map((c) => c.centroId)));
  const fechas = Array.from(new Set(claves.map((c) => c.fecha))).map(aFechaDia);
  const pedidas = new Set(claves.map((c) => `${c.centroId}|${c.fecha}`));
  const [tickets, existentes] = await Promise.all([
    tx.ticket.findMany({
      where: { tenantId, centroId: { in: centroIds }, fecha: { in: fechas } },
      select: { centroId: true, fecha: true, estado: true, turno: true, comensales: true, base: true, cuotaIva: true, descuentos: true, invitaciones: true, anulaciones: true, costeTeorico: true, origen: true, cobros: { select: { forma: true, importe: true, propina: true } } },
    }),
    tx.jornadaVenta.findMany({ where: { tenantId, centroId: { in: centroIds }, fecha: { in: fechas } }, select: { id: true, centroId: true, fecha: true } }),
  ]);
  const porClave = new Map<string, TicketParaJornada[]>();
  for (const t of tickets) {
    const k = `${t.centroId}|${t.fecha.toISOString().slice(0, 10)}`;
    if (!pedidas.has(k)) continue;
    const lista = porClave.get(k) ?? [];
    lista.push({
      estado: t.estado,
      turno: t.turno,
      comensales: t.comensales,
      base: Number(t.base),
      cuotaIva: Number(t.cuotaIva),
      descuentos: Number(t.descuentos),
      invitaciones: Number(t.invitaciones),
      anulaciones: Number(t.anulaciones),
      costeTeorico: Number(t.costeTeorico),
      origen: t.origen,
      cobros: t.cobros.map((c) => ({ forma: c.forma, importe: Number(c.importe), propina: Number(c.propina) })),
    });
    porClave.set(k, lista);
  }
  const yaHay = new Map(existentes.map((j) => [`${j.centroId}|${j.fecha.toISOString().slice(0, 10)}`, j.id]));
  const nuevas: Prisma.JornadaVentaCreateManyInput[] = [];
  const pagosNuevos: Prisma.JornadaVentaPagoCreateManyInput[] = [];
  for (const [k, lista] of porClave) {
    const [centroId, fecha] = k.split("|");
    const j = calcularJornada(lista);
    const datos = {
      ventaNeta: j.ventaNeta,
      cuotaIva: j.cuotaIva,
      ventaComida: j.ventaComida,
      ventaCena: j.ventaCena,
      comensales: j.comensales,
      tickets: j.tickets,
      descuentos: j.descuentos,
      invitaciones: j.invitaciones,
      anulaciones: j.anulaciones,
      propinas: j.propinas,
      costeTeorico: j.costeTeorico,
      desdeTickets: true,
      origen: j.origen,
      notas: `Calculada desde ${lista.length} tickets (${j.tickets} cobrados${lista.some((t) => t.estado === "ABIERTO") ? `, ${lista.filter((t) => t.estado === "ABIERTO").length} abiertos` : ""}${lista.some((t) => t.estado === "ANULADO") ? `, ${lista.filter((t) => t.estado === "ANULADO").length} anulados` : ""}).`,
    };
    const pagos = j.pagos.filter((p) => p.importe !== 0 || p.propina !== 0);
    const id = yaHay.get(k);
    if (id) {
      await tx.jornadaVenta.update({ where: { id }, data: datos });
      await tx.jornadaVentaPago.deleteMany({ where: { jornadaId: id } });
      if (pagos.length) await tx.jornadaVentaPago.createMany({ data: pagos.map((p) => ({ jornadaId: id, ...p })) });
    } else {
      const nueva = nuevoId();
      nuevas.push({ id: nueva, tenantId, centroId, fecha: aFechaDia(fecha), ...datos });
      for (const p of pagos) pagosNuevos.push({ jornadaId: nueva, ...p });
    }
  }
  await lotes(nuevas, 500, (l) => tx.jornadaVenta.createMany({ data: l }));
  await lotes(pagosNuevos, 2000, (l) => tx.jornadaVentaPago.createMany({ data: l }));
}
