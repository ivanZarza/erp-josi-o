import "server-only";
/**
 * Lógica de Caja y ventas. Las ventas mandan en el TPV (docs/specs/general/07_integraciones.md §7):
 * mientras no esté conectado, el gerente mete a mano las cifras de cada jornada (origen MANUAL).
 * Cuando llegue el TPV, sus jornadas entrarán con origen TPV y no se podrán tocar a mano.
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import type { Prisma } from "@/generated/prisma/client";
import { JornadaEsquema, CierreEsquema, ValidarCierreEsquema } from "./esquemas";

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

export async function crearCierre(ctx: Contexto, entrada: unknown) {
  const d = CierreEsquema.parse(entrada);
  comprobarCentro(ctx, d.centroId);
  const prisma = await db();
  const fecha = aFecha(d.fecha);
  const jornada = await prisma.jornadaVenta.findUnique({ where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId: d.centroId, fecha } }, include: { pagos: true } });
  const efectivoJornada = jornada?.pagos.find((p) => p.forma === "EFECTIVO");
  const tarjetaJornada = jornada?.pagos.find((p) => p.forma === "TARJETA");
  const efectivoTeorico = d.efectivoTeorico ?? (efectivoJornada ? Number(efectivoJornada.importe) : undefined);
  if (efectivoTeorico === undefined) throw new ErrorCaja("No hay ventas en efectivo de ese día: mete antes la jornada o escribe el efectivo teórico.");
  const descuadre = redondear(d.efectivoContado - efectivoTeorico);
  const tarjetaTeorico = tarjetaJornada ? Number(tarjetaJornada.importe) : null;
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
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CierreCaja", entidadId: c.id, accion: existe ? "rehacer" : "crear", antes: existe ? { descuadre: Number(existe.descuadre), estado: existe.estado } : undefined, despues: { efectivoTeorico, efectivoContado: d.efectivoContado, descuadre } });
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
}

/** Ventas por centro y día (sin comprobar permisos: quien llama ya filtró los centros). */
export async function ventasPorCentroYDia(tenantId: string, centroIds: string[], desde: Date, hasta: Date): Promise<VentaDia[]> {
  const prisma = await db();
  const filas = await prisma.jornadaVenta.findMany({
    where: { tenantId, centroId: { in: centroIds }, fecha: { gte: desde, lt: hasta } },
    select: { centroId: true, fecha: true, ventaNeta: true, cuotaIva: true, comensales: true, tickets: true },
    orderBy: { fecha: "asc" },
  });
  return filas.map((f) => ({ centroId: f.centroId, fecha: f.fecha, ventaNeta: Number(f.ventaNeta), cuotaIva: Number(f.cuotaIva), comensales: f.comensales, tickets: f.tickets }));
}

/** Nombres de los usuarios que cerraron o validaron (para pintar listados). */
export async function nombresUsuarios(ctx: Contexto, ids: (string | null)[]) {
  const prisma = await db();
  const lista = ids.filter((x): x is string => !!x);
  const usuarios = await prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id, id: { in: lista } }, select: { id: true, nombre: true } });
  return new Map(usuarios.map((u) => [u.id, u.nombre]));
}
