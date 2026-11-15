import "server-only";
/**
 * Lógica de Caja y ventas. Las ventas mandan en el TPV (docs/specs/general/07_integraciones.md §7).
 * - Tickets con líneas (importados del TPV o apuntados en la pantalla): cada línea descuenta stock por
 *   el escandallo y el formato (tickets.ts → src/nucleo/consumo-ventas.ts) y la jornada se calcula sola.
 * - Locales sin tickets: el gerente mete a mano las cifras de cada jornada (origen MANUAL).
 * - Apertura de caja con fondo inicial, retiradas y pagos con dinero de caja; el cierre hace el arqueo.
 * - Venta por plato y consumo teórico frente a real.
 */
import { db } from "@/kernel/db";
import { euros, fecha as fechaTexto } from "@/kernel/formato";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import type { Prisma } from "@/generated/prisma/client";
import { cargarEscandallos, platosVendibles } from "@/nucleo/consumo-ventas";
import { normalizarNombre } from "@/nucleo/regla-almacen";
import { ImportacionTpvEsquema, leerCsvTpv, leerFechaTpv, type TicketTpv } from "@/integraciones/tpv/formato";
import {
  JornadaEsquema,
  CierreEsquema,
  ValidarCierreEsquema,
  TicketFormEsquema,
  AnadirLineasEsquema,
  CobrarEsquema,
  AnularEsquema,
  AperturaEsquema,
  MovimientoCajaEsquema,
  ImportarTpvEsquema,
} from "./esquemas";
import { listarEmpleados } from "@/modulos/personal/servicio";
import { ErrorTicket, guardarTickets, anadirLineas, cobrarTicket, anularLinea, anularTicket, diaDeNegocio, type TicketNuevo, type CobroNuevo, type LineaTicketNueva } from "./tickets";

/** Error que se enseña tal cual al usuario. */
export class ErrorCaja extends Error {}

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** «2026-11-08» → medianoche UTC (columnas @db.Date). */
export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aFecha(iso).getTime() + dias * 86400000).toISOString().slice(0, 10);
}

/** Centros del filtro actual que tienen Caja (solo locales). */
export function centrosCaja(ctx: Contexto) {
  const ids = centrosFiltro(ctx);
  return ctx.centros.filter((c) => ids.includes(c.id) && c.tipo === "LOCAL" && c.modulos.includes("caja"));
}

function comprobarCentro(ctx: Contexto, centroId: string) {
  if (!centrosCaja(ctx).some((c) => c.id === centroId)) throw new ErrorCaja("No puedes registrar ventas de ese local (o no tiene Caja activada).");
}

// ---------- jornadas ----------

export async function listarJornadas(ctx: Contexto, desdeISO: string, hastaISO: string) {
  const prisma = await db();
  const ids = centrosCaja(ctx).map((c) => c.id);
  return prisma.jornadaVenta.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: ids }, fecha: { gte: aFecha(desdeISO), lte: aFecha(hastaISO) } },
    include: { pagos: true },
    orderBy: [{ fecha: "desc" }, { centroId: "asc" }],
  });
}

export async function jornadaDe(ctx: Contexto, centroId: string, fechaISO: string) {
  comprobarCentro(ctx, centroId);
  const prisma = await db();
  return prisma.jornadaVenta.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId, fecha: aFecha(fechaISO) } }, include: { pagos: true } });
}

/** Crea o corrige la jornada metida a mano. Las que vienen del TPV no se tocan. */
export async function guardarJornada(ctx: Contexto, entrada: unknown) {
  const d = JornadaEsquema.parse(entrada);
  comprobarCentro(ctx, d.centroId);
  if (d.fecha > hoyISO()) throw new ErrorCaja("No se pueden meter ventas de un día que aún no ha llegado.");
  const prisma = await db();
  const fecha = aFecha(d.fecha);
  const anterior = await prisma.jornadaVenta.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } }, include: { pagos: true } });
  if (anterior?.desdeTickets) throw new ErrorCaja("Esta jornada se calcula sola desde los tickets: corrige el ticket que esté mal (anular línea o ticket).");
  if (anterior?.origen === "TPV") throw new ErrorCaja("Esta jornada viene del TPV y no se puede cambiar a mano.");
  const cobrado = redondear(d.pagos.reduce((s, p) => s + p.importe, 0));
  const ventaConIva = redondear(d.ventaNeta + (d.cuotaIva ?? 0));
  if (cobrado > 0 && d.cuotaIva !== undefined && Math.abs(cobrado - ventaConIva) > 1)
    throw new ErrorCaja(`Lo cobrado por formas de pago (${cobrado}) no cuadra con la venta con IVA (${ventaConIva}). Revisa las cifras.`);
  const datos = {
    ventaNeta: d.ventaNeta,
    cuotaIva: d.cuotaIva ?? 0,
    ventaComida: d.ventaComida ?? null,
    ventaCena: d.ventaCena ?? null,
    comensales: d.comensales,
    tickets: d.tickets,
    descuentos: d.descuentos ?? 0,
    invitaciones: d.invitaciones ?? 0,
    anulaciones: d.anulaciones ?? 0,
    notas: d.notas ?? null,
  };
  await prisma.$transaction(async (tx) => {
    const j = await tx.jornadaVenta.upsert({
      where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } },
      create: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha, origen: "MANUAL", creadoPor: ctx.usuario.id, ...datos },
      update: datos,
    });
    await tx.jornadaVentaPago.deleteMany({ where: { jornadaId: j.id } });
    const pagos = d.pagos.filter((p) => p.importe > 0);
    if (pagos.length) await tx.jornadaVentaPago.createMany({ data: pagos.map((p) => ({ jornadaId: j.id, forma: p.forma, importe: p.importe })) });
    await auditar(tx, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "JornadaVenta",
      entidadId: j.id,
      accion: anterior ? "corregir" : "crear",
      antes: anterior ? { ventaNeta: Number(anterior.ventaNeta), comensales: anterior.comensales, tickets: anterior.tickets } : undefined,
      despues: { ventaNeta: d.ventaNeta, comensales: d.comensales, tickets: d.tickets, pagos },
    });
  });
}

/** Locales con caja a los que les falta meter la jornada de una fecha. */
export async function jornadasQueFaltan(ctx: Contexto, fechaISO: string) {
  const prisma = await db();
  const centros = centrosCaja(ctx);
  const hechas = await prisma.jornadaVenta.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: centros.map((c) => c.id) }, fecha: aFecha(fechaISO) }, select: { centroId: true } });
  const ya = new Set(hechas.map((h) => h.centroId));
  return centros.filter((c) => !ya.has(c.id));
}

// ---------- cierres de caja ----------

export async function listarCierres(ctx: Contexto, filtro: { estado?: string; desde?: string; hasta?: string } = {}) {
  const prisma = await db();
  const ids = centrosCaja(ctx).map((c) => c.id);
  const where: Prisma.CierreCajaWhereInput = { tenantId: ctx.tenant.id, centroId: { in: ids } };
  if (filtro.estado) where.estado = filtro.estado as Prisma.CierreCajaWhereInput["estado"];
  if (filtro.desde || filtro.hasta) where.fecha = { ...(filtro.desde ? { gte: aFecha(filtro.desde) } : {}), ...(filtro.hasta ? { lte: aFecha(filtro.hasta) } : {}) };
  return prisma.cierreCaja.findMany({ where, orderBy: [{ fecha: "desc" }, { centroId: "asc" }], take: 300 });
}

/**
 * Arqueo de un día: lo que debería haber en el cajón al cerrar.
 * Efectivo teórico = fondo inicial (apertura) + cobros en efectivo + entradas de cambio − retiradas − pagos con caja.
 * Tarjeta teórica = cobros con tarjeta + propinas con tarjeta (el banco liquida las dos juntas).
 * Las propinas en efectivo van al bote del personal, no al cajón.
 */
export async function arqueo(ctx: Contexto, centroId: string, fechaISO: string) {
  comprobarCentro(ctx, centroId);
  const prisma = await db();
  const fecha = aFecha(fechaISO);
  const [jornada, apertura] = await Promise.all([
    prisma.jornadaVenta.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId, fecha } }, include: { pagos: true } }),
    prisma.aperturaCaja.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId, fecha } }, include: { movimientos: { orderBy: { momento: "asc" } } } }),
  ]);
  const pago = (f: string) => jornada?.pagos.find((p) => p.forma === f);
  const suma = (tipo: string) => redondear((apertura?.movimientos ?? []).filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.importe), 0));
  const efectivoVentas = pago("EFECTIVO") ? Number(pago("EFECTIVO")!.importe) : jornada ? 0 : null;
  const fondoInicial = apertura ? Number(apertura.fondoInicial) : 0;
  const retiradas = suma("RETIRADA");
  const pagosCaja = suma("PAGO");
  const entradasCaja = suma("ENTRADA");
  const propinasTarjeta = pago("TARJETA") ? Number(pago("TARJETA")!.propina) : 0;
  const propinasEfectivo = pago("EFECTIVO") ? Number(pago("EFECTIVO")!.propina) : 0;
  const tarjeta = pago("TARJETA") ? Number(pago("TARJETA")!.importe) : null;
  return {
    jornada,
    apertura,
    efectivoVentas,
    fondoInicial,
    retiradas,
    pagosCaja,
    entradasCaja,
    propinasTarjeta,
    propinasEfectivo,
    efectivoTeorico: efectivoVentas === null && !apertura ? null : redondear(fondoInicial + (efectivoVentas ?? 0) + entradasCaja - retiradas - pagosCaja),
    tarjetaTeorico: tarjeta === null ? null : redondear(tarjeta + propinasTarjeta),
  };
}

export async function crearCierre(ctx: Contexto, entrada: unknown) {
  const d = CierreEsquema.parse(entrada);
  comprobarCentro(ctx, d.centroId);
  if (d.fecha > hoyISO()) throw new ErrorCaja("No se puede cerrar la caja de un día que aún no ha llegado.");
  const prisma = await db();
  const fecha = aFecha(d.fecha);
  const a = await arqueo(ctx, d.centroId, d.fecha);
  const efectivoTeorico = d.efectivoTeorico ?? a.efectivoTeorico ?? undefined;
  if (efectivoTeorico === undefined) throw new ErrorCaja("No hay ventas ni apertura de caja de ese día: mete antes la jornada (o los tickets) o escribe el efectivo teórico.");
  const descuadre = redondear(d.efectivoContado - efectivoTeorico);
  const tarjetaTeorico = a.tarjetaTeorico;
  const descuadreTarjeta = tarjetaTeorico !== null && d.tarjetaBanco !== undefined ? redondear(d.tarjetaBanco - tarjetaTeorico) : 0;
  if ((descuadre !== 0 || descuadreTarjeta !== 0) && !d.motivo) throw new ErrorCaja("Hay descuadre: explica el motivo.");
  const existe = await prisma.cierreCaja.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } } });
  if (existe && existe.estado === "VALIDADO") throw new ErrorCaja("Ese cierre ya está validado por finanzas y no se puede rehacer.");
  const datos = {
    efectivoTeorico,
    efectivoContado: d.efectivoContado,
    descuadre,
    tarjetaTeorico,
    tarjetaBanco: d.tarjetaBanco ?? null,
    fondoCaja: d.fondoCaja ?? 0,
    fondoInicial: a.fondoInicial,
    efectivoVentas: a.efectivoVentas,
    retiradas: a.retiradas,
    pagosCaja: a.pagosCaja,
    entradasCaja: a.entradasCaja,
    propinasTarjeta: a.propinasTarjeta,
    propinasEfectivo: a.propinasEfectivo,
    motivo: d.motivo ?? null,
    estado: "PENDIENTE" as const,
    cerradoPor: ctx.usuario.id,
    validadoPor: null,
    validadoEn: null,
    comentarioValidacion: null,
  };
  await prisma.$transaction(async (tx) => {
    const c = await tx.cierreCaja.upsert({
      where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } },
      create: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha, ...datos },
      update: datos,
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CierreCaja", entidadId: c.id, accion: existe ? "rehacer" : "crear", antes: existe ? { descuadre: Number(existe.descuadre), estado: existe.estado } : undefined, despues: { efectivoTeorico, efectivoContado: d.efectivoContado, descuadre, fondoInicial: a.fondoInicial, retiradas: a.retiradas, pagosCaja: a.pagosCaja } });
  });
}

export async function validarCierre(ctx: Contexto, entrada: unknown) {
  const d = ValidarCierreEsquema.parse(entrada);
  const prisma = await db();
  const ids = centrosCaja(ctx).map((c) => c.id);
  const c = await prisma.cierreCaja.findFirst({ where: { id: d.id, tenantId: ctx.tenant.id, centroId: { in: ids } } });
  if (!c) throw new ErrorCaja("Cierre no encontrado.");
  if (c.estado !== "PENDIENTE") throw new ErrorCaja("Ese cierre ya está revisado.");
  if (c.cerradoPor === ctx.usuario.id && ctx.usuario.rol !== "admin") throw new ErrorCaja("Quien hace el cierre no puede validarlo: lo valida otra persona (finanzas).");
  if (d.decision === "RECHAZADO" && !d.comentario) throw new ErrorCaja("Explica por qué se rechaza el cierre.");
  await prisma.$transaction(async (tx) => {
    await tx.cierreCaja.update({ where: { id: c.id }, data: { estado: d.decision, validadoPor: ctx.usuario.id, validadoEn: new Date(), comentarioValidacion: d.comentario ?? null } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CierreCaja", entidadId: c.id, accion: d.decision === "VALIDADO" ? "validar" : "rechazar", antes: { estado: c.estado }, despues: { estado: d.decision, comentario: d.comentario } });
  });
}

// ---------- para Cuadro de mando y Contabilidad (exportado) ----------

export interface VentaDia {
  centroId: string;
  fecha: Date;
  ventaNeta: number;
  cuotaIva: number;
  comensales: number;
  tickets: number;
  /** Coste del escandallo de lo vendido (solo si la jornada sale de tickets con líneas). */
  costeTeorico: number | null;
}

/** Ventas por centro y día (sin comprobar permisos: quien llama ya filtró los centros). */
export async function ventasPorCentroYDia(tenantId: string, centroIds: string[], desde: Date, hasta: Date): Promise<VentaDia[]> {
  const prisma = await db();
  const filas = await prisma.jornadaVenta.findMany({
    where: { tenantId, centroId: { in: centroIds }, fecha: { gte: desde, lt: hasta } },
    select: { centroId: true, fecha: true, ventaNeta: true, cuotaIva: true, comensales: true, tickets: true, costeTeorico: true, desdeTickets: true },
    orderBy: { fecha: "asc" },
  });
  return filas.map((f) => ({
    centroId: f.centroId,
    fecha: f.fecha,
    ventaNeta: Number(f.ventaNeta),
    cuotaIva: Number(f.cuotaIva),
    comensales: f.comensales,
    tickets: f.tickets,
    costeTeorico: f.desdeTickets && f.costeTeorico !== null ? Number(f.costeTeorico) : null,
  }));
}

/** Nombres de los usuarios que cerraron o validaron (para pintar listados). */
export async function nombresUsuarios(ctx: Contexto, ids: (string | null)[]) {
  const prisma = await db();
  const lista = ids.filter((x): x is string => !!x);
  const usuarios = await prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id, id: { in: lista } }, select: { id: true, nombre: true } });
  return new Map(usuarios.map((u) => [u.id, u.nombre]));
}

// ---------- tickets ----------

export interface FiltroTickets {
  desde: string;
  hasta: string;
  estado?: string;
  centroId?: string;
  q?: string; // trozo de la mesa, del número o del camarero
}

/**
 * Búsqueda por texto: trozo de la mesa, del número o del camarero (sin distinguir mayúsculas). El camarero
 * se busca en el nombre escrito (TPV o a mano) y, si Personal está contratado, en el nombre y apellidos
 * del empleado elegido en el ticket.
 */
async function filtroTexto(ctx: Contexto, q: string): Promise<Prisma.TicketWhereInput> {
  const o: Prisma.TicketWhereInput[] = [
    { mesa: { contains: q, mode: "insensitive" } },
    { numero: { contains: q, mode: "insensitive" } },
    { camarero: { contains: q, mode: "insensitive" } },
  ];
  if (ctx.tieneModulo("personal")) {
    const empleados = await listarEmpleados(ctx, { texto: q, estado: "todos" });
    if (empleados.length) o.push({ empleadoId: { in: empleados.map((e) => e.id) } });
  }
  return { OR: o };
}

export async function listarTickets(ctx: Contexto, f: FiltroTickets) {
  const prisma = await db();
  const ids = centrosCaja(ctx).map((c) => c.id).filter((id) => !f.centroId || id === f.centroId);
  const where: Prisma.TicketWhereInput = { tenantId: ctx.tenant.id, centroId: { in: ids }, fecha: { gte: aFecha(f.desde), lte: aFecha(f.hasta) } };
  if (f.estado === "ABIERTO" || f.estado === "COBRADO" || f.estado === "ANULADO") where.estado = f.estado;
  if (f.estado === "CON_ANULACIONES") where.OR = [{ estado: "ANULADO" }, { lineas: { some: { anulada: true } } }];
  if (f.q?.trim()) where.AND = [await filtroTexto(ctx, f.q.trim())];
  return prisma.ticket.findMany({
    where,
    include: { lineas: { orderBy: { orden: "asc" } }, cobros: { orderBy: { momento: "asc" } } },
    orderBy: [{ abiertoEn: "desc" }],
    take: 300,
  });
}

export async function resumenTickets(ctx: Contexto, f: FiltroTickets) {
  const prisma = await db();
  const ids = centrosCaja(ctx).map((c) => c.id).filter((id) => !f.centroId || id === f.centroId);
  const where: Prisma.TicketWhereInput = { tenantId: ctx.tenant.id, centroId: { in: ids }, fecha: { gte: aFecha(f.desde), lte: aFecha(f.hasta) } };
  const [porEstado, lineasAnuladas] = await Promise.all([
    prisma.ticket.groupBy({ by: ["estado"], where, _count: true, _sum: { base: true, propina: true, anulaciones: true, invitaciones: true, descuentos: true } }),
    prisma.ticketLinea.count({ where: { anulada: true, ticket: where } }),
  ]);
  const de = (e: string) => porEstado.find((x) => x.estado === e);
  return {
    cobrados: de("COBRADO")?._count ?? 0,
    abiertos: de("ABIERTO")?._count ?? 0,
    anulados: de("ANULADO")?._count ?? 0,
    venta: Number(de("COBRADO")?._sum.base ?? 0),
    propinas: Number(de("COBRADO")?._sum.propina ?? 0),
    anulaciones: porEstado.reduce((s, x) => s + Number(x._sum.anulaciones ?? 0), 0),
    invitaciones: Number(de("COBRADO")?._sum.invitaciones ?? 0),
    lineasAnuladas,
  };
}

/** Platos y bebidas que se pueden vender en un local (para el formulario de tickets). */
export async function cartaDeVenta(ctx: Contexto, centroId: string) {
  comprobarCentro(ctx, centroId);
  const prisma = await db();
  return platosVendibles(prisma, ctx.tenant.id, centroId);
}

function cobrosDe(total: number, forma: CobroNuevo["forma"], propina: number | undefined, forma2?: CobroNuevo["forma"], importe2?: number): CobroNuevo[] {
  const segundo = forma2 && importe2 ? redondear(Math.min(importe2, total)) : 0;
  const cobros: CobroNuevo[] = [{ forma, importe: redondear(total - segundo), propina: propina ?? 0 }];
  if (segundo > 0) cobros.push({ forma: forma2!, importe: segundo });
  return cobros;
}

async function numeroTicket(tx: Prisma.TransactionClient, tenantId: string) {
  return siguienteNumero(tx, tenantId, "TCK");
}

/** Apunta un ticket en la pantalla (sin TPV): baja el stock de lo pedido y recalcula la jornada. */
export async function registrarTicket(ctx: Contexto, entrada: unknown) {
  const d = TicketFormEsquema.parse(entrada);
  comprobarCentro(ctx, d.centroId);
  const prisma = await db();
  const ahora = new Date();
  // precios para aplicar el descuento por línea (con los de la carta del local)
  const carta = await platosVendibles(prisma, ctx.tenant.id, d.centroId);
  const porPlato = new Map(carta.map((p) => [p.platoId, p]));
  const lineas: LineaTicketNueva[] = d.lineas.map((l) => {
    const p = porPlato.get(l.platoId);
    if (!p) throw new ErrorCaja("Hay un plato que no está en la carta de este local.");
    const precio = l.formatoId ? (p.formatos.find((f) => f.id === l.formatoId)?.precio ?? p.precio) : p.precio;
    const descuento = d.descuentoPct && !l.invitacion ? redondear((l.cantidad * precio * d.descuentoPct) / 100) : 0;
    return { platoId: l.platoId, formatoId: l.formatoId, cantidad: l.cantidad, precio, descuento, invitacion: l.invitacion, momento: ahora };
  });
  const total = redondear(lineas.reduce((s, l) => s + (l.invitacion ? 0 : redondear(l.cantidad * l.precio!) - (l.descuento ?? 0)), 0));
  return prisma.$transaction(
    async (tx) => {
      const numero = await numeroTicket(tx, ctx.tenant.id);
      const t: TicketNuevo = {
        centroId: d.centroId,
        numero,
        abiertoEn: ahora,
        cobradoEn: d.estado === "COBRADO" ? ahora : null,
        mesa: d.mesa ?? null,
        comensales: d.comensales,
        empleadoId: d.empleadoId ?? null,
        camarero: d.camarero ?? null,
        estado: d.estado,
        lineas,
        cobros: d.estado === "COBRADO" ? cobrosDe(total, d.forma, d.propina, d.forma2, d.importe2) : [],
        origen: "MANUAL",
        notas: d.notas ?? null,
        creadoPor: ctx.usuario.id,
      };
      const r = await guardarTickets(tx, ctx.tenant.id, [t], { usuarioId: ctx.usuario.id });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ticket", entidadId: r.ids[0], accion: "crear", despues: { numero, estado: d.estado, total, lineas: d.lineas.length } });
      return { numero, jornadasSustituidas: r.jornadasSustituidas };
    },
    { timeout: 30_000 },
  );
}

export async function anadirLineasTicket(ctx: Contexto, entrada: unknown) {
  const d = AnadirLineasEsquema.parse(entrada);
  const prisma = await db();
  await comprobarTicket(ctx, d.id);
  await prisma.$transaction(async (tx) => {
    const t = await anadirLineas(tx, ctx.tenant.id, d.id, d.lineas.map((l) => ({ platoId: l.platoId, formatoId: l.formatoId, cantidad: l.cantidad, invitacion: l.invitacion })), ctx.usuario.id);
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ticket", entidadId: t.id, accion: "añadir líneas", despues: { lineas: d.lineas } });
  });
}

export async function cobrarTicketManual(ctx: Contexto, entrada: unknown) {
  const d = CobrarEsquema.parse(entrada);
  const prisma = await db();
  const t = await comprobarTicket(ctx, d.id);
  await prisma.$transaction(async (tx) => {
    await cobrarTicket(tx, ctx.tenant.id, d.id, cobrosDe(Number(t.total), d.forma, d.propina, d.forma2, d.importe2));
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ticket", entidadId: t.id, accion: "cobrar", despues: { forma: d.forma, propina: d.propina, forma2: d.forma2, importe2: d.importe2 } });
  });
}

async function comprobarTicket(ctx: Contexto, id: string) {
  const prisma = await db();
  const t = await prisma.ticket.findFirst({ where: { id, tenantId: ctx.tenant.id, centroId: { in: centrosCaja(ctx).map((c) => c.id) } } });
  if (!t) throw new ErrorCaja("Ticket no encontrado.");
  return t;
}

/** Anula una línea de un ticket abierto (devuelve su stock). */
export async function anularLineaTicket(ctx: Contexto, entrada: unknown) {
  const d = AnularEsquema.parse(entrada);
  const prisma = await db();
  const l = await prisma.ticketLinea.findFirst({ where: { id: d.id, ticket: { tenantId: ctx.tenant.id, centroId: { in: centrosCaja(ctx).map((c) => c.id) } } } });
  if (!l) throw new ErrorCaja("Línea no encontrada.");
  await prisma.$transaction(async (tx) => {
    const r = await anularLinea(tx, ctx.tenant.id, d.id, d.motivo, ctx.usuario.id);
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "TicketLinea", entidadId: d.id, accion: "anular", antes: { concepto: r.linea.concepto, cantidad: Number(r.linea.cantidad), total: Number(r.linea.total) }, despues: { motivo: d.motivo } });
  });
}

/** Anula un ticket entero (devuelve el stock de todas sus líneas). */
export async function anularTicketManual(ctx: Contexto, entrada: unknown) {
  const d = AnularEsquema.parse(entrada);
  const prisma = await db();
  await comprobarTicket(ctx, d.id);
  await prisma.$transaction(async (tx) => {
    const t = await anularTicket(tx, ctx.tenant.id, d.id, d.motivo, ctx.usuario.id);
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ticket", entidadId: t.id, accion: "anular", antes: { estado: t.estado, total: Number(t.total) }, despues: { motivo: d.motivo } });
  });
}

export { ErrorTicket };

// ---------- importar ventas del TPV (hueco preparado, sin TPV conectado) ----------

/**
 * Importa tickets en el formato propio (src/integraciones/tpv/formato.ts). Enlaza cada línea con un plato
 * de la carta del local por nombre (sin tildes ni mayúsculas) y el formato por su nombre; lo que no se
 * enlaza entra como concepto sin plato (no baja stock) y se avisa. No importa dos veces el mismo id.
 */
export async function importarVentasTpv(ctx: Contexto, centroId: string, tickets: TicketTpv[]) {
  comprobarCentro(ctx, centroId);
  const prisma = await db();
  const [carta, centro, ya] = await Promise.all([
    platosVendibles(prisma, ctx.tenant.id, centroId),
    prisma.centro.findUniqueOrThrow({ where: { id: centroId }, select: { horaCorte: true } }),
    prisma.ticket.findMany({ where: { tenantId: ctx.tenant.id, centroId, externoId: { in: tickets.map((t) => t.id) } }, select: { externoId: true } }),
  ]);
  const yaImportados = new Set(ya.map((t) => t.externoId));
  const porNombre = new Map(carta.map((p) => [normalizarNombre(p.nombre), p]));
  const porId = new Map(carta.map((p) => [p.platoId, p]));
  const sinEnlace = new Set<string>();
  const avisos: string[] = [];
  const nuevos: TicketNuevo[] = [];
  for (const t of tickets) {
    if (yaImportados.has(t.id)) {
      avisos.push(`Ticket ${t.id}: ya estaba importado.`);
      continue;
    }
    try {
      const abiertoEn = leerFechaTpv(t.abierto);
      const lineas: LineaTicketNueva[] = t.lineas.map((l) => {
        const p = (l.platoId && porId.get(l.platoId)) || (l.plato ? porNombre.get(normalizarNombre(l.plato)) : undefined);
        const f = p && l.formato ? p.formatos.find((x) => normalizarNombre(x.nombre) === normalizarNombre(l.formato!)) : p?.formatos[0];
        if (!p || (l.formato && p.formatos.length && !f)) sinEnlace.add(`${l.plato ?? l.platoId}${l.formato ? ` · ${l.formato}` : ""}`);
        const enlazado = p && !(l.formato && p.formatos.length && !f);
        if (!enlazado && l.precio === undefined) throw new Error(`«${l.plato ?? l.platoId}» no está en la carta del local y no trae precio`);
        return {
          platoId: enlazado ? p!.platoId : null,
          formatoId: enlazado ? (f?.id ?? null) : null,
          concepto: enlazado ? undefined : `${l.plato ?? l.platoId}${l.formato ? ` · ${l.formato}` : ""} (sin enlazar)`,
          cantidad: l.cantidad,
          precio: l.precio,
          descuento: l.descuento,
          invitacion: l.invitacion,
          anulada: l.anulada ? { motivo: l.motivoAnulacion || "Anulada en el TPV", en: l.hora ? leerFechaTpv(l.hora) : undefined } : null,
          momento: l.hora ? leerFechaTpv(l.hora) : abiertoEn,
        };
      });
      nuevos.push({
        centroId,
        numero: `TPV-${t.numero || t.id}`,
        abiertoEn,
        cobradoEn: t.cobrado ? leerFechaTpv(t.cobrado) : null,
        fecha: diaDeNegocio(abiertoEn, centro.horaCorte ?? "05:00"),
        mesa: t.mesa ?? null,
        comensales: t.comensales,
        camarero: t.camarero ?? null,
        estado: t.estado === "anulado" ? "ANULADO" : t.estado === "abierto" ? "ABIERTO" : "COBRADO",
        anulacion: t.estado === "anulado" ? { motivo: t.motivoAnulacion || "Anulado en el TPV" } : null,
        lineas,
        cobros: t.estado === "cobrado" ? t.cobros.map((c) => ({ forma: c.forma, importe: c.importe, propina: c.propina ?? 0 })) : [],
        origen: "TPV",
        externoId: t.id,
        creadoPor: ctx.usuario.id,
      });
    } catch (e) {
      avisos.push(`Ticket ${t.id}: ${(e as Error).message}`);
    }
  }
  if (nuevos.length === 0) return { importados: 0, avisos, sinEnlace: Array.from(sinEnlace) };
  await prisma.$transaction(
    async (tx) => {
      const r = await guardarTickets(tx, ctx.tenant.id, nuevos, { usuarioId: ctx.usuario.id });
      for (const j of r.jornadasSustituidas) avisos.push(`El ${fechaTexto(aFecha(j.fecha))} tenía ventas metidas a mano (${euros(j.ventaNeta)}): ahora manda lo de los tickets (lo de antes queda en el historial).`);
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ticket", entidadId: r.ids[0], accion: "importar TPV", despues: { centroId, tickets: nuevos.length, sinEnlace: Array.from(sinEnlace).slice(0, 50) } });
    },
    { timeout: 120_000 },
  );
  return { importados: nuevos.length, avisos, sinEnlace: Array.from(sinEnlace) };
}

/** Importa desde la pantalla: CSV sencillo o JSON del formato propio. */
export async function importarTextoTpv(ctx: Contexto, entrada: unknown) {
  const d = ImportarTpvEsquema.parse(entrada);
  let tickets: TicketTpv[];
  let errores: string[] = [];
  if (d.formato === "csv") ({ tickets, errores } = leerCsvTpv(d.texto));
  else {
    let json: unknown;
    try {
      json = JSON.parse(d.texto);
    } catch {
      throw new ErrorCaja("El JSON no se puede leer: revisa que esté completo.");
    }
    tickets = ImportacionTpvEsquema.parse(json).tickets;
  }
  if (tickets.length === 0) throw new ErrorCaja(errores[0] ?? "No hay tickets que importar.");
  const r = await importarVentasTpv(ctx, d.centroId, tickets);
  return { ...r, avisos: [...errores, ...r.avisos] };
}

// ---------- apertura de caja y movimientos de efectivo ----------

export async function abrirCaja(ctx: Contexto, entrada: unknown) {
  const d = AperturaEsquema.parse(entrada);
  comprobarCentro(ctx, d.centroId);
  if (d.fecha > hoyISO()) throw new ErrorCaja("No se puede abrir la caja de un día que aún no ha llegado.");
  const prisma = await db();
  const fecha = aFecha(d.fecha);
  const cierre = await prisma.cierreCaja.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } } });
  if (cierre) throw new ErrorCaja("Ese día ya tiene cierre de caja: no se puede cambiar la apertura.");
  await prisma.$transaction(async (tx) => {
    const antes = await tx.aperturaCaja.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } } });
    const a = await tx.aperturaCaja.upsert({
      where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } },
      create: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha, fondoInicial: d.fondoInicial, abiertaPor: ctx.usuario.id, notas: d.notas ?? null },
      update: { fondoInicial: d.fondoInicial, notas: d.notas ?? null },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "AperturaCaja", entidadId: a.id, accion: antes ? "corregir" : "abrir", antes: antes ? { fondoInicial: Number(antes.fondoInicial) } : undefined, despues: { fondoInicial: d.fondoInicial } });
  });
}

export async function apuntarMovimientoCaja(ctx: Contexto, entrada: unknown) {
  const d = MovimientoCajaEsquema.parse(entrada);
  comprobarCentro(ctx, d.centroId);
  const prisma = await db();
  const fecha = aFecha(d.fecha);
  const [apertura, cierre] = await Promise.all([
    prisma.aperturaCaja.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } } }),
    prisma.cierreCaja.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } } }),
  ]);
  if (!apertura) throw new ErrorCaja("Primero abre la caja de ese día (con el fondo inicial).");
  if (cierre) throw new ErrorCaja("Ese día ya tiene cierre de caja.");
  await prisma.$transaction(async (tx) => {
    const m = await tx.movimientoCaja.create({ data: { aperturaId: apertura.id, tipo: d.tipo, importe: d.importe, concepto: d.concepto, usuarioId: ctx.usuario.id } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "MovimientoCaja", entidadId: m.id, accion: "crear", despues: { tipo: d.tipo, importe: d.importe, concepto: d.concepto } });
  });
}

// ---------- venta por plato ----------

export interface FilaVentaPlato {
  clave: string;
  platoId: string | null;
  formatoId: string | null;
  concepto: string;
  area: "COMIDAS" | "BEBIDAS" | null;
  unidades: number;
  invitadas: number;
  importe: number; // sin IVA
  coste: number; // coste teórico (incluye lo invitado)
  /** Por día: unidades cobradas e invitadas por separado, como en la fila. */
  porDia: Map<string, { unidades: number; invitadas: number; importe: number; coste: number }>;
}

/** Lo vendido por plato y formato en un periodo (tickets cobrados, sin líneas anuladas). */
export async function ventaPorPlato(ctx: Contexto, desdeISO: string, hastaISO: string) {
  const prisma = await db();
  const ids = centrosCaja(ctx).map((c) => c.id);
  if (ids.length === 0) return [];
  const filas = await prisma.$queryRaw<{ fecha: Date; platoId: string | null; formatoId: string | null; concepto: string; invitacion: boolean; unidades: unknown; importe: unknown; coste: unknown }[]>`
    SELECT t.fecha, l."platoId", l."formatoId", MAX(l.concepto) AS concepto, l.invitacion,
           SUM(l.cantidad) AS unidades, SUM(l.base) AS importe, SUM(l."costeTeorico") AS coste
    FROM "TicketLinea" l JOIN "Ticket" t ON t.id = l."ticketId"
    WHERE t."tenantId" = ${ctx.tenant.id} AND t."centroId" = ANY(${ids}) AND t.estado::text = 'COBRADO' AND NOT l.anulada
      AND t.fecha >= ${aFecha(desdeISO)} AND t.fecha <= ${aFecha(hastaISO)}
    GROUP BY t.fecha, l."platoId", l."formatoId", l.invitacion`;
  const escandallos = await cargarEscandallos(prisma, ctx.tenant.id, filas.map((f) => f.platoId).filter((x): x is string => !!x));
  const mapa = new Map<string, FilaVentaPlato>();
  for (const f of filas) {
    const clave = `${f.platoId ?? f.concepto}|${f.formatoId ?? ""}`;
    const esc = f.platoId ? escandallos.get(f.platoId) : undefined;
    let v = mapa.get(clave);
    if (!v) {
      const formato = esc && f.formatoId ? esc.formatos.find((x) => x.id === f.formatoId)?.nombre : undefined;
      v = { clave, platoId: f.platoId, formatoId: f.formatoId, concepto: esc ? `${esc.nombre}${formato ? ` · ${formato}` : ""}` : f.concepto, area: esc?.area ?? null, unidades: 0, invitadas: 0, importe: 0, coste: 0, porDia: new Map() };
      mapa.set(clave, v);
    }
    const u = Number(f.unidades);
    if (f.invitacion) v.invitadas += u;
    else v.unidades += u;
    v.importe += Number(f.importe);
    v.coste += Number(f.coste);
    const dia = f.fecha.toISOString().slice(0, 10);
    const d = v.porDia.get(dia) ?? { unidades: 0, invitadas: 0, importe: 0, coste: 0 };
    if (f.invitacion) d.invitadas += u;
    else d.unidades += u;
    d.importe += Number(f.importe);
    d.coste += Number(f.coste);
    v.porDia.set(dia, d);
  }
  return Array.from(mapa.values()).sort((a, b) => b.importe - a.importe);
}

// ---------- consumo teórico frente a real ----------

/** Tipos de movimiento que son entradas o salidas a otros centros (no consumo del local). */
const TIPOS_ENTRADA = ["ENTRADA_COMPRA", "ENTRADA_PEDIDO", "SALIDA_PEDIDO", "CARGA_INICIAL", "PRODUCCION_ENTRADA", "PRODUCCION_CONSUMO", "TRASPASO"];

/**
 * Consumo teórico (lo que debería haber bajado por las ventas: movimientos VENTA) frente al real
 * (recuento inicial + entradas − mermas − recuento final) entre dos inventarios cerrados de todo el
 * local. Si no hay inventario anterior, desde el principio (stock 0).
 */
export async function consumoTeoricoReal(ctx: Contexto, centroId: string, area: "BEBIDAS" | "COMIDAS", inventarioId?: string) {
  comprobarCentro(ctx, centroId);
  const prisma = await db();
  const inventarios = await prisma.inventario.findMany({
    where: { tenantId: ctx.tenant.id, centroId, area, estado: "CERRADO", almacenId: null, cerradoEn: { not: null } },
    orderBy: { cerradoEn: "desc" },
    select: { id: true, numero: true, nombre: true, cerradoEn: true },
  });
  const final = (inventarioId && inventarios.find((i) => i.id === inventarioId)) || inventarios[0];
  if (!final) return { inventarios, final: null, inicial: null, filas: [] };
  const inicial = inventarios.find((i) => i.cerradoEn! < final.cerradoEn!) ?? null;
  const [lineasFin, lineasIni, movs] = await Promise.all([
    prisma.inventarioLinea.findMany({ where: { inventarioId: final.id }, include: { producto: { select: { nombre: true, unidad: true, referencia: true } } } }),
    inicial ? prisma.inventarioLinea.findMany({ where: { inventarioId: inicial.id }, select: { productoId: true, teorico: true, contado: true } }) : Promise.resolve([]),
    prisma.movimientoStock.groupBy({
      by: ["productoId", "tipo"],
      where: {
        tenantId: ctx.tenant.id,
        centroId,
        producto: { area },
        createdAt: { ...(inicial ? { gt: inicial.cerradoEn! } : {}), lte: final.cerradoEn! },
        // (con OR: un NOT sobre documentoId dejaría fuera las filas sin documento, como cargas y mermas)
        OR: [{ documentoId: null }, { documentoId: { not: final.id } }],
      },
      _sum: { cantidad: true },
    }),
  ]);
  const ini = new Map(lineasIni.map((l) => [l.productoId, Number(l.contado ?? l.teorico)]));
  const mov = new Map<string, { entradas: number; mermas: number; venta: number }>();
  for (const m of movs) {
    const x = mov.get(m.productoId) ?? { entradas: 0, mermas: 0, venta: 0 };
    const q = Number(m._sum.cantidad ?? 0);
    if (TIPOS_ENTRADA.includes(m.tipo)) x.entradas += q;
    else if (m.tipo === "MERMA") x.mermas -= q;
    else if (m.tipo === "VENTA") x.venta -= q;
    mov.set(m.productoId, x);
  }
  const filas = lineasFin
    .map((l) => {
      const m = mov.get(l.productoId) ?? { entradas: 0, mermas: 0, venta: 0 };
      const inicialQ = ini.get(l.productoId) ?? 0;
      const finalQ = Number(l.contado ?? l.teorico);
      const real = inicialQ + m.entradas - m.mermas - finalQ;
      const coste = Number(l.coste);
      return {
        productoId: l.productoId,
        producto: l.producto.nombre,
        referencia: l.producto.referencia,
        unidad: l.producto.unidad,
        inicial: inicialQ,
        entradas: m.entradas,
        mermas: m.mermas,
        final: finalQ,
        real,
        teorico: m.venta,
        diferencia: real - m.venta,
        coste,
        diferenciaEuros: redondear((real - m.venta) * coste),
      };
    })
    .filter((f) => f.real !== 0 || f.teorico !== 0)
    .sort((a, b) => Math.abs(b.diferenciaEuros) - Math.abs(a.diferenciaEuros));
  return { inventarios, final, inicial, filas };
}
