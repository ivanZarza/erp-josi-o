import "server-only";
import { hoyMadrid } from "@/kernel/fechas";
import { db } from "@/kernel/db";
import { emitir } from "@/kernel/eventos";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { buscarOCrearCliente, registrarVisita, type TipoConsentimiento } from "@/modulos/clientes/servicio";
import { crearSolicitudDesdeReserva } from "@/modulos/eventos/servicio";
import type { DatosReserva } from "./esquemas";

/**
 * Lógica del módulo Reservas. Exporta para otros módulos:
 * `espaciosDeCentros` y `reservasDeEspacio` (Eventos: disponibilidad de reservados).
 */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
export type EstadoReserva = "SOLICITADA" | "CONFIRMADA" | "LLEGADA" | "SENTADA" | "TERMINADA" | "CANCELADA" | "NO_PRESENTADA";

export class ErrorReservas extends Error {}

export const NOMBRE_ESTADO: Record<EstadoReserva, string> = {
  SOLICITADA: "Solicitada",
  CONFIRMADA: "Confirmada",
  LLEGADA: "Ha llegado",
  SENTADA: "Sentada",
  TERMINADA: "Terminada",
  CANCELADA: "Cancelada",
  NO_PRESENTADA: "No presentada",
};
export const NOMBRE_ORIGEN: Record<string, string> = { MANUAL: "Manual", TELEFONO: "Teléfono", WEB: "Web", COVERMANAGER: "CoverManager" };
export const NOMBRE_TIPO_ESPACIO: Record<string, string> = { SALA: "Sala", TERRAZA: "Terraza", RESERVADO: "Reservado", BARRA: "Barra" };

/** Botones de cambio de estado que se ofrecen desde cada estado. */
const SIGUIENTES: Record<EstadoReserva, EstadoReserva[]> = {
  SOLICITADA: ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA: ["LLEGADA", "SENTADA", "NO_PRESENTADA", "CANCELADA"],
  LLEGADA: ["SENTADA", "CANCELADA"],
  SENTADA: ["TERMINADA"],
  TERMINADA: [],
  CANCELADA: ["CONFIRMADA"],
  NO_PRESENTADA: ["LLEGADA", "CONFIRMADA"],
};
export function estadosSiguientes(e: EstadoReserva) {
  return SIGUIENTES[e];
}

/** Estados que ocupan mesa. */
const OCUPAN: EstadoReserva[] = ["SOLICITADA", "CONFIRMADA", "LLEGADA", "SENTADA"];
/** Estados que no ocupan mesa ni cuentan cubiertos (si se vuelve de ellos, hay que comprobar sitio). */
const LIBERAN: EstadoReserva[] = ["CANCELADA", "NO_PRESENTADA"];

/**
 * Estado con el que nace una reserva según su origen. Las que llegan de la web nacen «Solicitada»
 * (el local aún no ha hablado con el cliente y tiene que confirmarlas); las apuntadas en el local,
 * por teléfono o que llegan de CoverManager (que ya las confirma al cliente) nacen «Confirmada».
 * La mesa y los cubiertos se reservan igual en los dos casos.
 */
export function estadoInicial(origen: string): EstadoReserva {
  return origen === "WEB" ? "SOLICITADA" : "CONFIRMADA";
}
/** Estados que cuentan para el ritmo de entradas (cubiertos por franja). */
const CUENTAN_FRANJA: EstadoReserva[] = ["SOLICITADA", "CONFIRMADA", "LLEGADA", "SENTADA", "TERMINADA"];

// ---------------------------------------------------------------- fechas y horas

export const aMin = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + b;
};
export const deMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export { hoyMadrid } from "@/kernel/fechas";
export function horaMadrid(): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
export const fechaDia = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const diaTexto = (d: Date) => d.toISOString().slice(0, 10);
/** 1 = lunes … 7 = domingo */
export const diaSemana = (s: string) => ((fechaDia(s).getUTCDay() + 6) % 7) + 1;
export function sumarDias(s: string, n: number) {
  return diaTexto(new Date(fechaDia(s).getTime() + n * 86_400_000));
}

// ---------------------------------------------------------------- reglas

export async function ajustesDe(tx: Tx, tenantId: string, centroId: string) {
  return (
    (await tx.reservaAjustes.findUnique({ where: { centroId } })) ??
    (await tx.reservaAjustes.create({ data: { tenantId, centroId } }))
  );
}

type Turno = { id: string; nombre: string; dias: number[]; horaInicio: string; horaFin: string; duracionMin: number; intervaloMin: number; maxCubiertosFranja: number };

export function turnoDe(turnos: Turno[], fecha: string, hora: string): Turno | null {
  const d = diaSemana(fecha);
  const m = aMin(hora);
  return turnos.find((t) => t.dias.includes(d) && m >= aMin(t.horaInicio) && m <= aMin(t.horaFin)) ?? null;
}

/** Inicio de la franja de entradas a la que pertenece una hora. */
function inicioFranja(t: Turno, hora: string) {
  const base = aMin(t.horaInicio);
  return base + Math.floor((aMin(hora) - base) / t.intervaloMin) * t.intervaloMin;
}

/** Tabla «hasta N personas → M minutos» guardada en los ajustes, ordenada de menos a más personas. */
export function tablaDuraciones(valor: unknown): { hasta: number; minutos: number }[] {
  if (!valor || typeof valor !== "object") return [];
  return Object.entries(valor as Record<string, unknown>)
    .map(([k, v]) => ({ hasta: Number(k), minutos: Number(v) }))
    .filter((x) => Number.isInteger(x.hasta) && x.hasta > 0 && Number.isFinite(x.minutos) && x.minutos > 0)
    .sort((a, b) => a.hasta - b.hasta);
}

function duracionPara(ajustes: { duracionPorPersonas: unknown }, turno: Turno | null, personas: number) {
  const tabla = (ajustes.duracionPorPersonas ?? null) as Record<string, number> | null;
  if (tabla) {
    const claves = Object.keys(tabla).map(Number).sort((a, b) => a - b);
    const k = claves.find((c) => personas <= c) ?? claves[claves.length - 1];
    if (k !== undefined && tabla[String(k)]) return tabla[String(k)];
  }
  return turno?.duracionMin ?? 90;
}

/** Cubiertos ya reservados en cada franja del día (para la regla de ritmo de entradas). */
export async function ocupacionFranjas(tx: Tx, tenantId: string, centroId: string, fecha: string) {
  const [turnos, reservas] = await Promise.all([
    tx.reservaTurno.findMany({ where: { tenantId, centroId, activo: true }, orderBy: { horaInicio: "asc" } }),
    tx.reserva.findMany({ where: { tenantId, centroId, fecha: fechaDia(fecha), estado: { in: CUENTAN_FRANJA } }, select: { hora: true, personas: true } }),
  ]);
  const d = diaSemana(fecha);
  return turnos
    .filter((t) => t.dias.includes(d))
    .map((t) => {
      const franjas: { hora: string; cubiertos: number; maximo: number }[] = [];
      for (let m = aMin(t.horaInicio); m <= aMin(t.horaFin); m += t.intervaloMin) franjas.push({ hora: deMin(m), cubiertos: 0, maximo: t.maxCubiertosFranja });
      for (const r of reservas) {
        if (turnoDe([t], fecha, r.hora)?.id !== t.id) continue;
        const f = franjas.find((x) => x.hora === deMin(inicioFranja(t, r.hora)));
        if (f) f.cubiertos += r.personas;
      }
      return { turno: t, franjas };
    });
}

/** Ocupación por franjas de un local y día (para la pantalla de nueva reserva). */
export async function franjasDelDia(ctx: Contexto, centroId: string, fecha: string) {
  if (!ctx.centros.some((c) => c.id === centroId)) return [];
  return ocupacionFranjas(await db(), ctx.tenant.id, centroId, fecha);
}

async function comprobarFranja(tx: Tx, tenantId: string, centroId: string, fecha: string, hora: string, personas: number, excluirId?: string) {
  const turnos = await tx.reservaTurno.findMany({ where: { tenantId, centroId, activo: true } });
  if (turnos.length === 0) return null; // local sin turnos configurados: no se limita
  const t = turnoDe(turnos, fecha, hora);
  if (!t) throw new ErrorReservas(`A las ${hora} no hay turno abierto ese día. Revisa «Turnos y reglas».`);
  const ini = inicioFranja(t, hora);
  const reservas = await tx.reserva.findMany({
    where: { tenantId, centroId, fecha: fechaDia(fecha), estado: { in: CUENTAN_FRANJA }, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { hora: true, personas: true },
  });
  const usados = reservas.filter((r) => turnoDe([t], fecha, r.hora) && inicioFranja(t, r.hora) === ini).reduce((a, r) => a + r.personas, 0);
  if (usados + personas > t.maxCubiertosFranja)
    throw new ErrorReservas(`La franja de las ${deMin(ini)} ya tiene ${usados} de ${t.maxCubiertosFranja} cubiertos. Prueba otra hora.`);
  return t;
}

// ---------------------------------------------------------------- mesas

type MesaLibre = { id: string; nombre: string; espacioId: string; capacidadMin: number; capacidadMax: number; combinable: boolean };

/** Mesas sin reserva que se solape con [hora, hora + duración). */
export async function mesasLibres(tx: Tx, tenantId: string, centroId: string, fecha: string, hora: string, duracionMin: number, excluirReservaId?: string): Promise<MesaLibre[]> {
  const [mesas, reservas] = await Promise.all([
    tx.reservaMesa.findMany({ where: { tenantId, centroId, activo: true, espacio: { activo: true } }, orderBy: { nombre: "asc" } }),
    tx.reserva.findMany({
      where: { tenantId, centroId, fecha: fechaDia(fecha), estado: { in: OCUPAN }, ...(excluirReservaId ? { id: { not: excluirReservaId } } : {}) },
      include: { mesas: true },
    }),
  ]);
  const ini = aMin(hora);
  const fin = ini + duracionMin;
  const ocupadas = new Set<string>();
  for (const r of reservas) {
    const a = aMin(r.hora);
    if (a < fin && ini < a + r.duracionMin) for (const m of r.mesas) ocupadas.add(m.mesaId);
  }
  return mesas.filter((m) => !ocupadas.has(m.id));
}

/**
 * Mejor mesa para el grupo: la libre más pequeña donde quepan (y no se desperdicie una grande);
 * si no hay, dos mesas combinables del mismo espacio.
 */
export function elegirMesas(libres: MesaLibre[], personas: number, espacioId?: string | null): string[] | null {
  const candidatas = espacioId ? libres.filter((m) => m.espacioId === espacioId) : libres;
  const una = candidatas
    .filter((m) => m.capacidadMin <= personas && personas <= m.capacidadMax)
    .sort((a, b) => a.capacidadMax - b.capacidadMax || a.nombre.localeCompare(b.nombre, "es", { numeric: true }))[0];
  if (una) return [una.id];
  const comb = candidatas.filter((m) => m.combinable);
  let mejor: [MesaLibre, MesaLibre] | null = null;
  for (let i = 0; i < comb.length; i++)
    for (let j = i + 1; j < comb.length; j++) {
      const [a, b] = [comb[i], comb[j]];
      if (a.espacioId !== b.espacioId) continue;
      const cap = a.capacidadMax + b.capacidadMax;
      if (cap < personas) continue;
      if (!mejor || cap < mejor[0].capacidadMax + mejor[1].capacidadMax) mejor = [a, b];
    }
  return mejor ? mejor.map((m) => m.id) : null;
}

// ---------------------------------------------------------------- reservas

export type ResultadoReserva = { tipo: "reserva"; id: string; sinMesa: boolean; estado: EstadoReserva } | { tipo: "evento"; id: string; numero: string };

export async function crearReserva(ctx: Contexto, d: DatosReserva): Promise<ResultadoReserva> {
  if (!centrosFiltro(ctx).includes(d.centroId) && !ctx.centros.some((c) => c.id === d.centroId)) throw new ErrorReservas("No tienes acceso a ese local");
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const tenantId = ctx.tenant.id;
    const ajustes = await ajustesDe(tx, tenantId, d.centroId);
    if (d.espacioId) {
      const zona = await tx.reservaEspacio.findFirst({ where: { tenantId, id: d.espacioId, centroId: d.centroId, activo: true }, select: { id: true } });
      if (!zona) throw new ErrorReservas("La zona elegida no es de ese local");
    }

    const consentimientos: { tipo: TipoConsentimiento; otorgado: boolean }[] = [
      { tipo: "RESERVA", otorgado: d.consentimientoReserva },
      ...(d.consentimientoCorreo ? [{ tipo: "CORREO" as const, otorgado: true }] : []),
      ...(d.consentimientoWhatsapp ? [{ tipo: "WHATSAPP" as const, otorgado: true }] : []),
    ];
    const clienteId = ctx.tieneModulo("clientes")
      ? await buscarOCrearCliente(tx, tenantId, { nombre: d.nombre, telefono: d.telefono, email: d.email, alergias: d.alergias, origen: "RESERVA" }, consentimientos, ctx.usuario.id)
      : null;

    // Grupo grande → solicitud de evento
    if (d.personas > ajustes.grupoMaximo) {
      if (!ctx.tieneModulo("eventos"))
        throw new ErrorReservas(`Los grupos de más de ${ajustes.grupoMaximo} personas se gestionan como evento, pero el módulo Eventos no está contratado.`);
      const s = await crearSolicitudDesdeReserva(tx, tenantId, {
        nombre: d.nombre, telefono: d.telefono, email: d.email, personas: d.personas, fecha: d.fecha, hora: d.hora, centroId: d.centroId,
        espacioId: d.espacioId, clienteId, notas: [d.notas, d.alergias ? `Alergias: ${d.alergias}` : null].filter(Boolean).join("\n") || null, usuarioId: ctx.usuario.id,
      });
      return { tipo: "evento", id: s.id, numero: s.numero };
    }

    const turno = await comprobarFranja(tx, tenantId, d.centroId, d.fecha, d.hora, d.personas);
    const duracion = duracionPara(ajustes, turno, d.personas);
    const libres = await mesasLibres(tx, tenantId, d.centroId, d.fecha, d.hora, duracion);
    let mesas: string[] | null;
    if (d.mesaId) {
      const m = libres.find((x) => x.id === d.mesaId);
      if (!m) throw new ErrorReservas("Esa mesa ya está ocupada a esa hora");
      if (d.personas > m.capacidadMax) throw new ErrorReservas(`En la mesa ${m.nombre} caben ${m.capacidadMax} como máximo`);
      mesas = [m.id];
    } else {
      mesas = elegirMesas(libres, d.personas, d.espacioId);
    }
    if (!mesas && !d.sinMesa) throw new ErrorReservas("No queda mesa libre para ese grupo a esa hora. Marca «guardar sin mesa» si quieres apuntarla igualmente.");

    const estado = estadoInicial(d.origen);
    const r = await tx.reserva.create({
      data: {
        tenantId, centroId: d.centroId, clienteId, nombre: d.nombre, telefono: d.telefono, email: d.email?.toLowerCase(), personas: d.personas,
        fecha: fechaDia(d.fecha), hora: d.hora, duracionMin: duracion, espacioId: d.espacioId ?? null, estado, origen: d.origen,
        notas: d.notas, alergias: d.alergias, creadoPor: ctx.usuario.id,
        mesas: mesas ? { create: mesas.map((mesaId) => ({ mesaId })) } : undefined,
        historial: { create: { hasta: estado, nota: mesas ? null : "Sin mesa asignada", usuarioId: ctx.usuario.id } },
      },
    });
    await emitir(tx, tenantId, "reservas.reserva.creada", { reservaId: r.id, centroId: d.centroId, fecha: d.fecha, hora: d.hora, personas: d.personas });
    return { tipo: "reserva", id: r.id, sinMesa: !mesas, estado };
  });
}

export async function cambiarEstadoReserva(ctx: Contexto, d: { id: string; estado: EstadoReserva; nota?: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const r = await tx.reserva.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id, centroId: { in: centrosFiltro(ctx) } } });
    if (!r) throw new ErrorReservas("Reserva no encontrada");
    if (!SIGUIENTES[r.estado].includes(d.estado)) throw new ErrorReservas(`No se puede pasar de «${NOMBRE_ESTADO[r.estado]}» a «${NOMBRE_ESTADO[d.estado]}»`);
    let nota = d.nota;
    if (LIBERAN.includes(r.estado) && OCUPAN.includes(d.estado)) nota = [nota, await recuperarSitio(tx, ctx.tenant.id, r, d.estado)].filter(Boolean).join(" · ") || undefined;
    await tx.reserva.update({ where: { id: r.id }, data: { estado: d.estado } });
    await tx.reservaHistorial.create({ data: { reservaId: r.id, desde: r.estado, hasta: d.estado, nota, usuarioId: ctx.usuario.id } });
    if (d.estado === "TERMINADA" && r.clienteId && ctx.tieneModulo("clientes"))
      await registrarVisita(tx, ctx.tenant.id, { clienteId: r.clienteId, centroId: r.centroId, fecha: fechaDia(diaTexto(r.fecha)), personas: r.personas, reservaId: r.id });
    if (d.estado === "NO_PRESENTADA" || d.estado === "CANCELADA")
      await emitir(tx, ctx.tenant.id, `reservas.reserva.${d.estado === "CANCELADA" ? "cancelada" : "no_presentada"}`, { reservaId: r.id, clienteId: r.clienteId });
  });
}

/**
 * Una reserva cancelada o no presentada que vuelve a «Confirmada» o «Ha llegado» necesita sitio otra vez:
 * - Confirmada: la franja tiene que admitir sus cubiertos y tiene que haber mesa (la suya si sigue libre,
 *   si no, otra libre donde quepa). Si no hay, no se deja.
 * - Ha llegado (el cliente está en la puerta): se conserva su mesa si está libre o se busca otra;
 *   si no queda ninguna, pasa sin mesa para asignarla en sala.
 * Devuelve la nota para el historial si ha cambiado la mesa.
 */
async function recuperarSitio(
  tx: Tx,
  tenantId: string,
  r: { id: string; centroId: string; fecha: Date; hora: string; duracionMin: number; personas: number; espacioId: string | null },
  destino: EstadoReserva,
): Promise<string | null> {
  const fecha = diaTexto(r.fecha);
  if (destino === "CONFIRMADA") await comprobarFranja(tx, tenantId, r.centroId, fecha, r.hora, r.personas, r.id);
  const [libres, actuales] = await Promise.all([
    mesasLibres(tx, tenantId, r.centroId, fecha, r.hora, r.duracionMin, r.id),
    tx.reservaMesaAsignada.findMany({ where: { reservaId: r.id }, select: { mesaId: true } }),
  ]);
  const libresIds = new Set(libres.map((m) => m.id));
  if (actuales.length > 0 && actuales.every((m) => libresIds.has(m.mesaId))) return null; // su mesa sigue libre
  const nuevas = elegirMesas(libres, r.personas, r.espacioId);
  if (!nuevas && destino === "CONFIRMADA")
    throw new ErrorReservas(
      actuales.length > 0
        ? "Su mesa ya está ocupada a esa hora y no queda otra libre para ese grupo: no se puede volver a confirmar"
        : "No queda mesa libre para ese grupo a esa hora: no se puede volver a confirmar",
    );
  await tx.reservaMesaAsignada.deleteMany({ where: { reservaId: r.id } });
  if (!nuevas) return "Sin mesa libre: asígnala en sala";
  await tx.reservaMesaAsignada.createMany({ data: nuevas.map((mesaId) => ({ reservaId: r.id, mesaId })) });
  return actuales.length > 0 ? "Su mesa estaba ocupada: se le asigna otra" : "Mesa asignada automáticamente";
}

export async function cambiarMesaReserva(ctx: Contexto, d: { id: string; mesaId?: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const r = await tx.reserva.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id, centroId: { in: centrosFiltro(ctx) } } });
    if (!r) throw new ErrorReservas("Reserva no encontrada");
    const libres = await mesasLibres(tx, ctx.tenant.id, r.centroId, diaTexto(r.fecha), r.hora, r.duracionMin, r.id);
    let mesas: string[] | null;
    if (d.mesaId) {
      const m = libres.find((x) => x.id === d.mesaId);
      if (!m) throw new ErrorReservas("Esa mesa está ocupada a esa hora");
      if (r.personas > m.capacidadMax) throw new ErrorReservas(`En la mesa ${m.nombre} caben ${m.capacidadMax} como máximo y la reserva es de ${r.personas}`);
      mesas = [m.id];
    } else mesas = elegirMesas(libres, r.personas, r.espacioId);
    if (!mesas) throw new ErrorReservas("No hay mesa libre para ese grupo a esa hora");
    await tx.reservaMesaAsignada.deleteMany({ where: { reservaId: r.id } });
    await tx.reservaMesaAsignada.createMany({ data: mesas.map((mesaId) => ({ reservaId: r.id, mesaId })) });
    await tx.reservaHistorial.create({ data: { reservaId: r.id, desde: r.estado, hasta: r.estado, nota: "Cambio de mesa", usuarioId: ctx.usuario.id } });
  });
}

export async function reservasDelDia(ctx: Contexto, fecha: string) {
  const prisma = await db();
  const reservas = await prisma.reserva.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, fecha: fechaDia(fecha) },
    include: { mesas: { include: { mesa: { include: { espacio: true } } } }, historial: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ hora: "asc" }, { nombre: "asc" }],
  });
  const espacioIds = Array.from(new Set(reservas.map((r) => r.espacioId).filter((x): x is string => !!x)));
  const espacios = espacioIds.length ? await prisma.reservaEspacio.findMany({ where: { tenantId: ctx.tenant.id, id: { in: espacioIds } }, select: { id: true, nombre: true } }) : [];
  const nombreEspacio = Object.fromEntries(espacios.map((e) => [e.id, e.nombre]));
  return { reservas, nombreEspacio };
}

/** Mesas activas de los locales que ve el usuario (para los selectores de mesa). */
export async function mesasDeMisCentros(ctx: Contexto) {
  const prisma = await db();
  return prisma.reservaMesa.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, activo: true, espacio: { activo: true } },
    select: { id: true, nombre: true, centroId: true, capacidadMax: true, espacio: { select: { nombre: true } } },
    orderBy: [{ espacio: { orden: "asc" } }, { nombre: "asc" }],
  });
}

// ---------------------------------------------------------------- plano

export type EstadoMesaPlano = "libre" | "reservada" | "llegada" | "sentada";

export async function planoDelCentro(ctx: Contexto, centroId: string, fecha: string, hora: string) {
  if (!centrosFiltro(ctx).includes(centroId)) throw new ErrorReservas("No tienes acceso a ese local");
  const prisma = await db();
  const [espacios, reservas] = await Promise.all([
    prisma.reservaEspacio.findMany({ where: { tenantId: ctx.tenant.id, centroId, activo: true }, include: { mesas: { where: { activo: true }, orderBy: { nombre: "asc" } } }, orderBy: { orden: "asc" } }),
    prisma.reserva.findMany({ where: { tenantId: ctx.tenant.id, centroId, fecha: fechaDia(fecha), estado: { in: OCUPAN } }, include: { mesas: true } }),
  ]);
  const m = aMin(hora);
  const porMesa = new Map<string, { estado: EstadoMesaPlano; nombre: string; personas: number; hora: string }>();
  for (const r of reservas) {
    const a = aMin(r.hora);
    if (!(a <= m && m < a + r.duracionMin)) continue;
    const estado: EstadoMesaPlano = r.estado === "SENTADA" ? "sentada" : r.estado === "LLEGADA" ? "llegada" : "reservada";
    for (const x of r.mesas) porMesa.set(x.mesaId, { estado, nombre: r.nombre, personas: r.personas, hora: r.hora });
  }
  return espacios.map((e) => ({
    id: e.id, nombre: e.nombre, tipo: e.tipo, aforo: e.aforo, ancho: e.ancho, alto: e.alto,
    mesas: e.mesas.map((x) => ({
      id: x.id, nombre: x.nombre, x: x.x, y: x.y, ancho: x.ancho, alto: x.alto, forma: x.forma, capacidadMin: x.capacidadMin, capacidadMax: x.capacidadMax,
      combinable: x.combinable, especial: x.especial, estado: porMesa.get(x.id)?.estado ?? ("libre" as EstadoMesaPlano), reserva: porMesa.get(x.id) ?? null,
    })),
  }));
}

export async function guardarPosiciones(ctx: Contexto, cambios: { id: string; x: number; y: number }[]) {
  const prisma = await db();
  const ids = cambios.map((c) => c.id);
  const mesas = await prisma.reservaMesa.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids }, centroId: { in: centrosFiltro(ctx) } }, select: { id: true } });
  const validas = new Set(mesas.map((m) => m.id));
  await prisma.$transaction(cambios.filter((c) => validas.has(c.id)).map((c) => prisma.reservaMesa.update({ where: { id: c.id }, data: { x: c.x, y: c.y } })));
  return validas.size;
}

// ---------------------------------------------------------------- espacios y mesas

export async function espaciosYMesas(ctx: Contexto, centroId: string) {
  const prisma = await db();
  return prisma.reservaEspacio.findMany({
    where: { tenantId: ctx.tenant.id, centroId },
    include: { mesas: { orderBy: [{ activo: "desc" }, { nombre: "asc" }] } },
    orderBy: [{ activo: "desc" }, { orden: "asc" }],
  });
}

export async function guardarEspacio(ctx: Contexto, d: { id?: string; centroId: string; nombre: string; tipo: "SALA" | "TERRAZA" | "RESERVADO" | "BARRA"; aforo: number; ancho: number; alto: number }) {
  if (!centrosFiltro(ctx).includes(d.centroId)) throw new ErrorReservas("No tienes acceso a ese local");
  const prisma = await db();
  const datos = { nombre: d.nombre, tipo: d.tipo, aforo: d.aforo, ancho: d.ancho, alto: d.alto };
  if (d.id) {
    const r = await prisma.reservaEspacio.updateMany({ where: { tenantId: ctx.tenant.id, id: d.id, centroId: d.centroId }, data: datos });
    if (r.count === 0) throw new ErrorReservas("Espacio no encontrado");
  } else {
    const orden = await prisma.reservaEspacio.count({ where: { tenantId: ctx.tenant.id, centroId: d.centroId } });
    await prisma.reservaEspacio.create({ data: { tenantId: ctx.tenant.id, centroId: d.centroId, orden, ...datos } });
  }
}

export async function guardarMesa(
  ctx: Contexto,
  d: { id?: string; espacioId: string; nombre: string; capacidadMin: number; capacidadMax: number; forma: "CUADRADA" | "REDONDA" | "RECTANGULAR"; combinable: boolean; reservableInternet: boolean; especial?: string },
) {
  const prisma = await db();
  const e = await prisma.reservaEspacio.findFirst({ where: { tenantId: ctx.tenant.id, id: d.espacioId, centroId: { in: centrosFiltro(ctx) } } });
  if (!e) throw new ErrorReservas("Espacio no encontrado");
  const tam = d.forma === "RECTANGULAR" ? { ancho: 110, alto: 60 } : d.capacidadMax > 4 ? { ancho: 80, alto: 80 } : { ancho: 60, alto: 60 };
  const datos = { nombre: d.nombre, capacidadMin: d.capacidadMin, capacidadMax: d.capacidadMax, forma: d.forma, combinable: d.combinable, reservableInternet: d.reservableInternet, especial: d.especial ?? null };
  if (d.id) {
    const r = await prisma.reservaMesa.updateMany({ where: { tenantId: ctx.tenant.id, id: d.id, centroId: e.centroId }, data: { ...datos, espacioId: e.id, ...tam } });
    if (r.count === 0) throw new ErrorReservas("Mesa no encontrada");
  } else {
    const n = await prisma.reservaMesa.count({ where: { espacioId: e.id } });
    await prisma.reservaMesa.create({ data: { tenantId: ctx.tenant.id, centroId: e.centroId, espacioId: e.id, x: 20 + (n % 8) * 95, y: 20 + Math.floor(n / 8) * 95, ...tam, ...datos } });
  }
}

/** Reservas vivas (solicitada, confirmada, ha llegado, sentada) de hoy en adelante que cumplen el filtro. */
async function reservasFuturas(tx: Tx, tenantId: string, filtro: { mesaId: string } | { espacioId: string }) {
  return tx.reserva.findMany({
    where: {
      tenantId,
      fecha: { gte: fechaDia(hoyMadrid()) },
      estado: { in: OCUPAN },
      ...("mesaId" in filtro
        ? { mesas: { some: { mesaId: filtro.mesaId } } }
        : { OR: [{ espacioId: filtro.espacioId }, { mesas: { some: { mesa: { espacioId: filtro.espacioId } } } }] }),
    },
    select: { fecha: true, hora: true, nombre: true },
    orderBy: [{ fecha: "asc" }, { hora: "asc" }],
  });
}

function textoReservasFuturas(lista: { fecha: Date; hora: string; nombre: string }[]) {
  const p = lista[0];
  const [a, m, d] = diaTexto(p.fecha).split("-");
  return `${lista.length} ${lista.length === 1 ? "reserva" : "reservas"} de hoy en adelante (la primera, ${d}/${m}/${a} a las ${p.hora}, ${p.nombre})`;
}

/**
 * Las mesas y espacios con reservas no se borran: se desactivan. No se deja desactivar
 * si tienen reservas vivas de hoy en adelante: primero hay que cambiarlas de mesa o de zona.
 */
export async function activarMesa(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  const m = await prisma.reservaMesa.findFirst({ where: { tenantId: ctx.tenant.id, id, centroId: { in: centrosFiltro(ctx) } } });
  if (!m) throw new ErrorReservas("Mesa no encontrada");
  if (!activo) {
    const futuras = await reservasFuturas(prisma, ctx.tenant.id, { mesaId: m.id });
    if (futuras.length > 0) throw new ErrorReservas(`La mesa ${m.nombre} tiene ${textoReservasFuturas(futuras)}. Cámbialas de mesa antes de desactivarla.`);
  }
  await prisma.reservaMesa.update({ where: { id: m.id }, data: { activo } });
}
export async function activarEspacio(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  const e = await prisma.reservaEspacio.findFirst({ where: { tenantId: ctx.tenant.id, id, centroId: { in: centrosFiltro(ctx) } } });
  if (!e) throw new ErrorReservas("Espacio no encontrado");
  if (!activo) {
    const futuras = await reservasFuturas(prisma, ctx.tenant.id, { espacioId: e.id });
    if (futuras.length > 0) throw new ErrorReservas(`«${e.nombre}» tiene ${textoReservasFuturas(futuras)}. Cámbialas de mesa o de zona antes de desactivarlo.`);
  }
  await prisma.reservaEspacio.update({ where: { id: e.id }, data: { activo } });
}

// ---------------------------------------------------------------- turnos y ajustes

export async function turnosYAjustes(ctx: Contexto, centroId: string) {
  const prisma = await db();
  const [turnos, ajustes] = await Promise.all([
    prisma.reservaTurno.findMany({ where: { tenantId: ctx.tenant.id, centroId }, orderBy: [{ activo: "desc" }, { horaInicio: "asc" }] }),
    ajustesDe(prisma, ctx.tenant.id, centroId),
  ]);
  return { turnos, ajustes };
}

export async function guardarTurno(
  ctx: Contexto,
  d: { id?: string; centroId: string; nombre: string; dias: number[]; horaInicio: string; horaFin: string; duracionMin: number; intervaloMin: number; maxCubiertosFranja: number },
) {
  if (!centrosFiltro(ctx).includes(d.centroId)) throw new ErrorReservas("No tienes acceso a ese local");
  const prisma = await db();
  const { id, ...datos } = d;
  datos.dias = Array.from(new Set(datos.dias)).sort();
  if (id) {
    const r = await prisma.reservaTurno.updateMany({ where: { tenantId: ctx.tenant.id, id, centroId: d.centroId }, data: datos });
    if (r.count === 0) throw new ErrorReservas("Turno no encontrado");
  } else await prisma.reservaTurno.create({ data: { tenantId: ctx.tenant.id, ...datos } });
}

export async function activarTurno(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await prisma.reservaTurno.updateMany({ where: { tenantId: ctx.tenant.id, id, centroId: { in: centrosFiltro(ctx) } }, data: { activo } });
}

export async function guardarAjustes(
  ctx: Contexto,
  d: { centroId: string; grupoMaximo: number; antelacionMinutos: number; elegirMesaInternet: boolean; duraciones: { hasta: number; minutos: number }[] },
) {
  if (!centrosFiltro(ctx).includes(d.centroId)) throw new ErrorReservas("No tienes acceso a ese local");
  const prisma = await db();
  const { centroId, duraciones, ...resto } = d;
  // Sin filas = se usa la duración de mesa del turno (Prisma.DbNull deja la columna vacía)
  const duracionPorPersonas = duraciones.length ? Object.fromEntries(duraciones.map((x) => [String(x.hasta), x.minutos])) : Prisma.DbNull;
  const datos = { ...resto, duracionPorPersonas };
  await prisma.reservaAjustes.upsert({ where: { centroId }, create: { tenantId: ctx.tenant.id, centroId, ...datos }, update: datos });
}

// ---------------------------------------------------------------- para otros módulos

/** Eventos: espacios (sobre todo reservados) de unos locales. */
export async function espaciosDeCentros(tenantId: string, centroIds: string[]) {
  const prisma = await db();
  return prisma.reservaEspacio.findMany({
    where: { tenantId, centroId: { in: centroIds }, activo: true },
    select: { id: true, centroId: true, nombre: true, tipo: true, aforo: true },
    orderBy: [{ centroId: "asc" }, { orden: "asc" }],
  });
}

/** Eventos: reservas que ya ocupan mesas de un espacio ese día (para ver si el reservado está libre). */
export async function reservasDeEspacio(tenantId: string, espacioId: string, fecha: string) {
  const prisma = await db();
  return prisma.reserva.findMany({
    where: { tenantId, fecha: fechaDia(fecha), estado: { in: OCUPAN }, OR: [{ espacioId }, { mesas: { some: { mesa: { espacioId } } } }] },
    select: { id: true, nombre: true, hora: true, personas: true, estado: true },
    orderBy: { hora: "asc" },
  });
}
