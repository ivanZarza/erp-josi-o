import "server-only";
/**
 * Lógica del módulo Personal: plantilla, contratos, avisos, cuadrantes, fichajes,
 * ausencias, formación, selección, documentos y coste de personal.
 * Ficha: docs/specs/modulos/personal/README.md
 *
 * Reglas:
 * - Todo filtra por tenant y por los centros que ve el usuario.
 * - Nada se borra si tiene historial: los empleados se dan de baja (activo = false),
 *   los contratos se finalizan, los fichajes se anulan o corrigen (con motivo y autor).
 * - Lo que toca personal se audita (auditar) y lo que interesa a otros módulos se emite.
 */
import { db } from "@/kernel/db";
import { auditar, emitir } from "@/kernel/eventos";
import type { Contexto } from "@/kernel/contexto";
import { centrosFiltro } from "@/kernel/contexto";
import { aNumero } from "@/kernel/formato";
import type { Prisma } from "@/generated/prisma/client";
import {
  aDia,
  diaISO,
  sumarDias,
  diasEntre,
  hoyMadrid,
  lunesDe,
  horasTurno,
  limitesTurno,
  jornadaDe,
  instanteMadrid,
  partesMadrid,
  diasDelMes,
  mesSiguiente,
  type Turno,
} from "./fechas";
import type { DatosAlta, DatosContrato, DatosEmpleado, DatosAsignacion } from "./esquemas";
import { NOMBRE_AUSENCIA, NOMBRE_CERTIFICADO } from "./esquemas";

/** Error con mensaje para enseñar al usuario. */
export class ErrorPersonal extends Error {}

type Tx = Prisma.TransactionClient;

/** Semanas efectivas de trabajo al año (52 menos 30 días naturales de vacaciones). */
export const SEMANAS_EFECTIVAS = 52 - 30 / 7;
/** Tolerancia en minutos para retrasos y salidas anticipadas. */
export const TOLERANCIA_MINUTOS = 5;
/** Días antes del vencimiento a partir de los que se avisa. */
export const DIAS_AVISO = 30;

// =====================================================================
// Utilidades internas
// =====================================================================

export async function mapaCentros(ctx: Contexto) {
  const prisma = await db();
  const centros = await prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id },
    select: { id: true, codigo: true, nombre: true, tipo: true, sociedadId: true, horaCorte: true },
    orderBy: { nombre: "asc" },
  });
  return new Map(centros.map((c) => [c.id, c]));
}

export async function listarSociedades(ctx: Contexto) {
  const prisma = await db();
  return prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, orderBy: { razonSocial: "asc" } });
}

function exigirCentro(ctx: Contexto, centroId: string) {
  if (!ctx.centros.some((c) => c.id === centroId)) throw new ErrorPersonal("No tienes acceso a ese centro.");
}

/** Filtro de empleados visibles: centro principal o centros donde puede trabajar dentro de los ids dados. */
function filtroEmpleadosEn(ids: string[]): Prisma.EmpleadoWhereInput {
  return { OR: [{ centroPrincipalId: { in: ids } }, { centros: { some: { centroId: { in: ids } } } }] };
}

async function empleadoAccesible(tx: Tx, ctx: Contexto, empleadoId: string) {
  const e = await tx.empleado.findFirst({
    where: { id: empleadoId, tenantId: ctx.tenant.id, ...filtroEmpleadosEn(ctx.centros.map((c) => c.id)) },
    include: { centros: true },
  });
  if (!e) throw new ErrorPersonal("Empleado no encontrado o fuera de tus centros.");
  return e;
}

export function nombreCompleto(e: { nombre: string; apellidos: string }) {
  return `${e.nombre} ${e.apellidos}`.trim();
}

type ContratoCoste = {
  costeHora: Prisma.Decimal | null;
  salarioBrutoAnual: Prisma.Decimal | null;
  porcentajeCotizacion: Prisma.Decimal;
  jornadaSemanal: Prisma.Decimal;
};

/**
 * Coste empresa por hora de un contrato: el configurado en el contrato o, si está vacío,
 * salario bruto anual × (1 + % cotización) / (jornada semanal × semanas efectivas).
 */
export function costeHoraContrato(c: ContratoCoste | null | undefined): number | null {
  if (!c) return null;
  if (c.costeHora !== null && c.costeHora !== undefined) return aNumero(c.costeHora);
  const salario = aNumero(c.salarioBrutoAnual);
  const jornada = aNumero(c.jornadaSemanal);
  if (!salario || !jornada) return null;
  return (salario * (1 + aNumero(c.porcentajeCotizacion) / 100)) / (jornada * SEMANAS_EFECTIVAS);
}

/** Contrato en vigor un día (el más reciente que lo cubre). */
export function contratoVigente<T extends { fechaInicio: Date; fechaFin: Date | null; activo: boolean }>(contratos: T[], dia: string): T | undefined {
  const d = aDia(dia).getTime();
  return contratos
    .filter((c) => c.fechaInicio.getTime() <= d && (!c.fechaFin || c.fechaFin.getTime() >= d))
    .sort((a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime())[0];
}

// =====================================================================
// Catálogos: puestos, convenios, categorías, turnos tipo
// =====================================================================

export async function listarPuestos(ctx: Contexto, soloActivos = true) {
  const prisma = await db();
  return prisma.puesto.findMany({
    where: { tenantId: ctx.tenant.id, ...(soloActivos ? { activo: true } : {}) },
    orderBy: [{ departamento: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    include: { _count: { select: { empleados: { where: { activo: true } } } } },
  });
}

export async function crearPuesto(ctx: Contexto, d: { nombre: string; departamento: Prisma.PuestoCreateInput["departamento"] }) {
  const prisma = await db();
  const existe = await prisma.puesto.findFirst({ where: { tenantId: ctx.tenant.id, nombre: d.nombre } });
  if (existe) throw new ErrorPersonal("Ya existe un puesto con ese nombre.");
  return prisma.puesto.create({ data: { tenantId: ctx.tenant.id, nombre: d.nombre, departamento: d.departamento } });
}

export async function cambiarActivoPuesto(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await prisma.puesto.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { activo } });
}

export async function listarConvenios(ctx: Contexto) {
  const prisma = await db();
  return prisma.convenio.findMany({
    where: { tenantId: ctx.tenant.id, activo: true },
    include: { categorias: { where: { activo: true }, orderBy: { nombre: "asc" } } },
    orderBy: { nombre: "asc" },
  });
}

export async function crearConvenio(ctx: Contexto, d: { nombre: string; comunidad?: string; horasAnuales?: number; diasVacaciones?: number; descansoMinimoHoras?: number }) {
  const prisma = await db();
  const existe = await prisma.convenio.findFirst({ where: { tenantId: ctx.tenant.id, nombre: d.nombre } });
  if (existe) throw new ErrorPersonal("Ya existe un convenio con ese nombre.");
  return prisma.convenio.create({
    data: {
      tenantId: ctx.tenant.id,
      nombre: d.nombre,
      comunidad: d.comunidad,
      horasAnuales: d.horasAnuales !== undefined ? Math.round(d.horasAnuales) : undefined,
      diasVacaciones: d.diasVacaciones !== undefined ? Math.round(d.diasVacaciones) : undefined,
      descansoMinimoHoras: d.descansoMinimoHoras,
    },
  });
}

export async function crearCategoria(ctx: Contexto, d: { convenioId: string; nombre: string; nivel?: string; salarioBaseAnual?: number }) {
  const prisma = await db();
  const conv = await prisma.convenio.findFirst({ where: { id: d.convenioId, tenantId: ctx.tenant.id } });
  if (!conv) throw new ErrorPersonal("Convenio no encontrado.");
  return prisma.categoriaConvenio.create({ data: { convenioId: conv.id, nombre: d.nombre, nivel: d.nivel, salarioBaseAnual: d.salarioBaseAnual } });
}

export async function listarTurnosTipo(ctx: Contexto, centroId?: string | null) {
  const prisma = await db();
  return prisma.turnoTipo.findMany({
    where: { tenantId: ctx.tenant.id, activo: true, ...(centroId ? { OR: [{ centroId }, { centroId: null }] } : {}) },
    orderBy: [{ inicio: "asc" }, { nombre: "asc" }],
  });
}

export async function crearTurnoTipo(ctx: Contexto, d: { centroId?: string; nombre: string; inicio: string; fin: string; inicio2?: string; fin2?: string }) {
  if (d.centroId) exigirCentro(ctx, d.centroId);
  if ((d.inicio2 && !d.fin2) || (!d.inicio2 && d.fin2)) throw new ErrorPersonal("El turno partido necesita inicio y fin del segundo tramo.");
  const prisma = await db();
  return prisma.turnoTipo.create({ data: { tenantId: ctx.tenant.id, ...d } });
}

export async function desactivarTurnoTipo(ctx: Contexto, id: string) {
  const prisma = await db();
  await prisma.turnoTipo.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { activo: false } });
}

// =====================================================================
// Empleados
// =====================================================================

export interface FiltroEmpleados {
  texto?: string;
  estado?: "activos" | "bajas" | "todos";
  puestoId?: string;
  departamento?: string;
}

export async function listarEmpleados(ctx: Contexto, f: FiltroEmpleados = {}) {
  const prisma = await db();
  const t = f.texto?.trim();
  return prisma.empleado.findMany({
    where: {
      tenantId: ctx.tenant.id,
      AND: [
        filtroEmpleadosEn(centrosFiltro(ctx)),
        t ? { OR: [{ nombre: { contains: t, mode: "insensitive" } }, { apellidos: { contains: t, mode: "insensitive" } }, { dni: { contains: t, mode: "insensitive" } }, { codigo: { contains: t, mode: "insensitive" } }] } : {},
      ],
      ...(f.estado === "bajas" ? { activo: false } : f.estado === "todos" ? {} : { activo: true }),
      ...(f.puestoId ? { puestoId: f.puestoId } : {}),
      ...(f.departamento ? { puesto: { departamento: f.departamento as never } } : {}),
    },
    include: {
      puesto: true,
      categoria: { include: { convenio: true } },
      centros: true,
      contratos: { orderBy: { fechaInicio: "desc" }, include: { convenio: true, categoria: true } },
      certificados: { where: { activo: true } },
    },
    orderBy: [{ activo: "desc" }, { apellidos: "asc" }, { nombre: "asc" }],
  });
}
export type EmpleadoListado = Awaited<ReturnType<typeof listarEmpleados>>[number];

/** Empleados que pueden trabajar en un centro (principal o centros extra), activos. */
export async function empleadosDelCentro(ctx: Contexto, centroId: string) {
  exigirCentro(ctx, centroId);
  const prisma = await db();
  return prisma.empleado.findMany({
    where: { tenantId: ctx.tenant.id, activo: true, ...filtroEmpleadosEn([centroId]) },
    include: { puesto: true },
    orderBy: [{ apellidos: "asc" }],
  });
}

export async function obtenerEmpleado(ctx: Contexto, id: string) {
  const prisma = await db();
  return prisma.empleado.findFirst({
    where: { id, tenantId: ctx.tenant.id, ...filtroEmpleadosEn(ctx.centros.map((c) => c.id)) },
    include: {
      puesto: true,
      categoria: { include: { convenio: true } },
      centros: true,
      contratos: { orderBy: { fechaInicio: "desc" }, include: { convenio: true, categoria: true } },
      certificados: { orderBy: [{ activo: "desc" }, { caducaEn: "asc" }] },
      documentos: { orderBy: { createdAt: "desc" } },
      ausencias: { orderBy: { desde: "desc" }, take: 50 },
    },
  });
}
export type EmpleadoFicha = NonNullable<Awaited<ReturnType<typeof obtenerEmpleado>>>;

async function siguienteCodigoEmpleado(tx: Tx, tenantId: string): Promise<string> {
  const ultimo = await tx.empleado.findFirst({ where: { tenantId, codigo: { startsWith: "EMP-" } }, orderBy: { codigo: "desc" }, select: { codigo: true } });
  const n = ultimo ? Number(ultimo.codigo.slice(4)) || 0 : 0;
  return `EMP-${String(n + 1).padStart(4, "0")}`;
}

function datosFicha(d: DatosEmpleado) {
  return {
    nombre: d.nombre,
    apellidos: d.apellidos,
    dni: d.dni ?? null,
    nss: d.nss ?? null,
    fechaNacimiento: d.fechaNacimiento ? aDia(d.fechaNacimiento) : null,
    email: d.email ?? null,
    telefono: d.telefono ?? null,
    direccion: d.direccion ?? null,
    contactoEmergencia: d.contactoEmergencia ?? null,
    iban: d.iban ?? null,
    centroPrincipalId: d.centroPrincipalId,
    sociedadId: d.sociedadId ?? null,
    puestoId: d.puestoId ?? null,
    categoriaId: d.categoriaId ?? null,
    pin: d.pin ?? null,
    notas: d.notas ?? null,
  };
}

/** Alta de empleado (y, si se da, su primer contrato). Devuelve el id. */
export async function altaEmpleado(ctx: Contexto, d: DatosAlta, contrato?: DatosContrato): Promise<string> {
  exigirCentro(ctx, d.centroPrincipalId);
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    if (d.dni) {
      const dup = await tx.empleado.findFirst({ where: { tenantId: ctx.tenant.id, dni: d.dni, activo: true } });
      if (dup) throw new ErrorPersonal(`Ya hay un empleado activo con el DNI ${d.dni} (${dup.codigo}).`);
    }
    const codigo = await siguienteCodigoEmpleado(tx, ctx.tenant.id);
    const centrosExtra = Array.from(new Set(d.centrosExtra.filter((c) => c && c !== d.centroPrincipalId)));
    const e = await tx.empleado.create({
      data: {
        tenantId: ctx.tenant.id,
        codigo,
        ...datosFicha(d),
        fechaAlta: aDia(d.fechaAlta),
        centros: { create: centrosExtra.map((centroId) => ({ centroId })) },
      },
    });
    if (contrato) await crearContratoTx(tx, ctx, e.id, { ...contrato, sociedadId: contrato.sociedadId ?? d.sociedadId });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Empleado", entidadId: e.id, accion: "ALTA", despues: { codigo, nombre: nombreCompleto(e), centro: d.centroPrincipalId, fechaAlta: d.fechaAlta } });
    await emitir(tx, ctx.tenant.id, "personal.empleado.alta", { empleadoId: e.id, codigo, centroId: d.centroPrincipalId, sociedadId: e.sociedadId, fechaAlta: d.fechaAlta });
    return e.id;
  });
}

export async function editarEmpleado(ctx: Contexto, id: string, d: DatosEmpleado) {
  exigirCentro(ctx, d.centroPrincipalId);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const antes = await empleadoAccesible(tx, ctx, id);
    const datos = datosFicha(d);
    await tx.empleado.update({ where: { id }, data: datos });
    const extra = Array.from(new Set(d.centrosExtra.filter((c) => c && c !== d.centroPrincipalId)));
    await tx.empleadoCentro.deleteMany({ where: { empleadoId: id, centroId: { notIn: extra } } });
    for (const centroId of extra) {
      await tx.empleadoCentro.upsert({ where: { empleadoId_centroId: { empleadoId: id, centroId } }, create: { empleadoId: id, centroId }, update: {} });
    }
    const cambios: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(datos)) {
      const previo = (antes as Record<string, unknown>)[k];
      const a = previo instanceof Date ? diaISO(previo) : previo;
      const b = v instanceof Date ? diaISO(v) : v;
      if ((a ?? null) !== (b ?? null)) cambios[k] = [k === "iban" || k === "pin" ? "***" : a, k === "iban" || k === "pin" ? "***" : b];
    }
    if (Object.keys(cambios).length) {
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Empleado", entidadId: id, accion: "EDITAR", antes: Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, v[0]])), despues: Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, v[1]])) });
    }
    if (antes.centroPrincipalId !== d.centroPrincipalId || (antes.sociedadId ?? null) !== (d.sociedadId ?? null)) {
      await emitir(tx, ctx.tenant.id, "personal.empleado.traslado", { empleadoId: id, deCentro: antes.centroPrincipalId, aCentro: d.centroPrincipalId, deSociedad: antes.sociedadId, aSociedad: d.sociedadId ?? null });
    }
  });
}

/** Baja: desactiva (nunca borra), finaliza el contrato en vigor y quita los turnos posteriores. */
export async function bajaEmpleado(ctx: Contexto, id: string, d: { fecha: string; motivo: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, id);
    if (!e.activo) throw new ErrorPersonal("El empleado ya está de baja.");
    if (d.fecha < diaISO(e.fechaAlta)) throw new ErrorPersonal("La fecha de baja es anterior al alta.");
    const fecha = aDia(d.fecha);
    await tx.empleado.update({ where: { id }, data: { activo: false, fechaBaja: fecha, motivoBaja: d.motivo } });
    await tx.contrato.updateMany({ where: { empleadoId: id, activo: true }, data: { activo: false, motivoFin: `Baja: ${d.motivo}` } });
    await tx.contrato.updateMany({ where: { empleadoId: id, OR: [{ fechaFin: null }, { fechaFin: { gt: fecha } }], fechaInicio: { lte: fecha } }, data: { fechaFin: fecha } });
    const quitados = await tx.asignacionTurno.deleteMany({ where: { empleadoId: id, fecha: { gt: fecha } } });
    await tx.ausencia.updateMany({ where: { empleadoId: id, estado: "PEDIDA" }, data: { estado: "ANULADA", motivoRechazo: "Baja del empleado" } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Empleado", entidadId: id, accion: "BAJA", despues: { fecha: d.fecha, motivo: d.motivo, turnosQuitados: quitados.count } });
    // Usuarios escucha este evento para desactivar su acceso al momento; la gestoría, para el finiquito.
    await emitir(tx, ctx.tenant.id, "personal.empleado.baja", { empleadoId: id, codigo: e.codigo, usuarioId: e.usuarioId, fecha: d.fecha, motivo: d.motivo, sociedadId: e.sociedadId });
  });
}

/** Reingreso de un empleado dado de baja (por ejemplo, un fijo discontinuo al empezar la temporada). */
export async function reactivarEmpleado(ctx: Contexto, id: string, fecha: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, id);
    if (e.activo) throw new ErrorPersonal("El empleado ya está activo.");
    await tx.empleado.update({ where: { id }, data: { activo: true, fechaBaja: null, motivoBaja: null, fechaAlta: aDia(fecha) } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Empleado", entidadId: id, accion: "REINGRESO", despues: { fecha } });
    await emitir(tx, ctx.tenant.id, "personal.empleado.alta", { empleadoId: id, codigo: e.codigo, centroId: e.centroPrincipalId, sociedadId: e.sociedadId, fechaAlta: fecha, reingreso: true });
  });
}

// =====================================================================
// Contratos
// =====================================================================

async function crearContratoTx(tx: Tx, ctx: Contexto, empleadoId: string, d: DatosContrato) {
  if (d.finPeriodoPrueba && d.finPeriodoPrueba < d.fechaInicio) throw new ErrorPersonal("El fin del periodo de prueba es anterior al inicio del contrato.");
  // El contrato anterior en vigor se cierra el día antes del nuevo.
  const previos = await tx.contrato.findMany({ where: { empleadoId, activo: true } });
  const diaAntes = aDia(sumarDias(d.fechaInicio, -1));
  for (const p of previos) {
    await tx.contrato.update({
      where: { id: p.id },
      data: { activo: false, motivoFin: p.motivoFin ?? "Sustituido por un contrato nuevo", fechaFin: !p.fechaFin || p.fechaFin > diaAntes ? diaAntes : p.fechaFin },
    });
  }
  const c = await tx.contrato.create({
    data: {
      tenantId: ctx.tenant.id,
      empleadoId,
      tipo: d.tipo,
      jornadaSemanal: d.jornadaSemanal,
      convenioId: d.convenioId ?? null,
      categoriaId: d.categoriaId ?? null,
      sociedadId: d.sociedadId ?? null,
      salarioBrutoAnual: d.salarioBrutoAnual ?? null,
      porcentajeCotizacion: d.porcentajeCotizacion ?? 32,
      costeHora: d.costeHora ?? null,
      fechaInicio: aDia(d.fechaInicio),
      fechaFin: d.fechaFin ? aDia(d.fechaFin) : null,
      finPeriodoPrueba: d.finPeriodoPrueba ? aDia(d.finPeriodoPrueba) : null,
      notas: d.notas ?? null,
      creadoPor: ctx.usuario.id,
    },
  });
  if (d.categoriaId) await tx.empleado.update({ where: { id: empleadoId }, data: { categoriaId: d.categoriaId } });
  if (d.sociedadId) await tx.empleado.update({ where: { id: empleadoId }, data: { sociedadId: d.sociedadId } });
  await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Contrato", entidadId: c.id, accion: "CREAR", despues: { empleadoId, tipo: d.tipo, jornadaSemanal: d.jornadaSemanal, salarioBrutoAnual: d.salarioBrutoAnual ?? null, costeHora: d.costeHora ?? null, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin ?? null } });
  await emitir(tx, ctx.tenant.id, "personal.contrato.nuevo", { empleadoId, contratoId: c.id, tipo: d.tipo, fechaInicio: d.fechaInicio, sociedadId: d.sociedadId ?? null });
  return c;
}

export async function crearContrato(ctx: Contexto, empleadoId: string, d: DatosContrato) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, empleadoId);
    if (!e.activo) throw new ErrorPersonal("El empleado está de baja: reactívalo antes de hacerle un contrato.");
    return crearContratoTx(tx, ctx, empleadoId, { ...d, sociedadId: d.sociedadId ?? e.sociedadId ?? undefined });
  });
}

export async function finalizarContrato(ctx: Contexto, contratoId: string, d: { fecha: string; motivo: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const c = await tx.contrato.findFirst({ where: { id: contratoId, tenantId: ctx.tenant.id } });
    if (!c) throw new ErrorPersonal("Contrato no encontrado.");
    await empleadoAccesible(tx, ctx, c.empleadoId);
    if (d.fecha < diaISO(c.fechaInicio)) throw new ErrorPersonal("La fecha de fin es anterior al inicio del contrato.");
    await tx.contrato.update({ where: { id: c.id }, data: { activo: false, fechaFin: aDia(d.fecha), motivoFin: d.motivo } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Contrato", entidadId: c.id, accion: "FINALIZAR", antes: { fechaFin: c.fechaFin ? diaISO(c.fechaFin) : null }, despues: { fechaFin: d.fecha, motivo: d.motivo } });
    await emitir(tx, ctx.tenant.id, "personal.contrato.fin", { empleadoId: c.empleadoId, contratoId: c.id, fecha: d.fecha });
  });
}

// =====================================================================
// Avisos y resumen
// =====================================================================

export interface AvisoPersonal {
  tipo: "CONTRATO_VENCE" | "CONTRATO_VENCIDO" | "PERIODO_PRUEBA" | "CERTIFICADO_CADUCA" | "CERTIFICADO_CADUCADO" | "DOCUMENTO_CADUCA" | "SIN_CONTRATO";
  tono: "aviso" | "error";
  empleadoId: string;
  empleado: string;
  centroId: string;
  texto: string;
  fecha: Date | null;
}

/** Contratos que vencen en 30 días, periodos de prueba, certificados y documentos que caducan. */
export async function avisosPersonal(ctx: Contexto, dias = DIAS_AVISO): Promise<AvisoPersonal[]> {
  const prisma = await db();
  const hoy = hoyMadrid();
  const limite = aDia(sumarDias(hoy, dias));
  const hoyD = aDia(hoy);
  const empleados = await prisma.empleado.findMany({
    where: { tenantId: ctx.tenant.id, activo: true, centroPrincipalId: { in: centrosFiltro(ctx) } },
    include: {
      contratos: { where: { activo: true } },
      certificados: { where: { activo: true, caducaEn: { not: null, lte: limite } } },
      documentos: { where: { activo: true, caducaEn: { not: null, lte: limite } } },
    },
  });
  const avisos: AvisoPersonal[] = [];
  for (const e of empleados) {
    const base = { empleadoId: e.id, empleado: nombreCompleto(e), centroId: e.centroPrincipalId };
    if (e.contratos.length === 0) avisos.push({ ...base, tipo: "SIN_CONTRATO", tono: "error", texto: "Sin contrato en vigor", fecha: null });
    for (const c of e.contratos) {
      if (c.fechaFin && c.fechaFin < hoyD) avisos.push({ ...base, tipo: "CONTRATO_VENCIDO", tono: "error", texto: "Contrato vencido sin renovar ni finalizar", fecha: c.fechaFin });
      else if (c.fechaFin && c.fechaFin <= limite) avisos.push({ ...base, tipo: "CONTRATO_VENCE", tono: "aviso", texto: "El contrato vence", fecha: c.fechaFin });
      if (c.finPeriodoPrueba && c.finPeriodoPrueba >= hoyD && c.finPeriodoPrueba <= limite) avisos.push({ ...base, tipo: "PERIODO_PRUEBA", tono: "aviso", texto: "Termina el periodo de prueba", fecha: c.finPeriodoPrueba });
    }
    for (const c of e.certificados) {
      const caducado = c.caducaEn! < hoyD;
      avisos.push({ ...base, tipo: caducado ? "CERTIFICADO_CADUCADO" : "CERTIFICADO_CADUCA", tono: caducado ? "error" : "aviso", texto: `${caducado ? "Caducado" : "Caduca"}: ${c.nombre || NOMBRE_CERTIFICADO[c.tipo as keyof typeof NOMBRE_CERTIFICADO] || c.tipo}`, fecha: c.caducaEn });
    }
    for (const d of e.documentos) {
      avisos.push({ ...base, tipo: "DOCUMENTO_CADUCA", tono: d.caducaEn! < hoyD ? "error" : "aviso", texto: `${d.caducaEn! < hoyD ? "Documento caducado" : "Documento caduca"}: ${d.nombre}`, fecha: d.caducaEn });
    }
  }
  return avisos.sort((a, b) => (a.tono === b.tono ? (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0) : a.tono === "error" ? -1 : 1));
}

export async function resumenPersonal(ctx: Contexto) {
  const prisma = await db();
  const hoy = hoyMadrid();
  const mes = hoy.slice(0, 7);
  const ini = aDia(`${mes}-01`);
  const fin = aDia(`${mesSiguiente(mes)}-01`);
  const centros = centrosFiltro(ctx);
  const base = { tenantId: ctx.tenant.id, centroPrincipalId: { in: centros } };
  const [activos, altas, bajas, ausenciasHoy, pendientes, avisos, turnosHoy] = await Promise.all([
    prisma.empleado.count({ where: { ...base, activo: true } }),
    prisma.empleado.findMany({ where: { ...base, fechaAlta: { gte: ini, lt: fin } }, include: { puesto: true }, orderBy: { fechaAlta: "desc" } }),
    prisma.empleado.findMany({ where: { ...base, fechaBaja: { gte: ini, lt: fin } }, include: { puesto: true }, orderBy: { fechaBaja: "desc" } }),
    prisma.ausencia.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: centros }, estado: "APROBADA", desde: { lte: aDia(hoy) }, hasta: { gte: aDia(hoy) } }, include: { empleado: { include: { puesto: true } } } }),
    prisma.ausencia.count({ where: { tenantId: ctx.tenant.id, centroId: { in: centros }, estado: "PEDIDA" } }),
    avisosPersonal(ctx),
    prisma.asignacionTurno.count({ where: { tenantId: ctx.tenant.id, centroId: { in: centros }, fecha: aDia(hoy) } }),
  ]);
  return { hoy, mes, activos, altas, bajas, ausenciasHoy, pendientes, avisos, turnosHoy };
}

// =====================================================================
// Cuadrantes
// =====================================================================

export interface CeldaCuadrante {
  dia: string;
  asignacion: { id: string; inicio: string; fin: string; inicio2: string | null; fin2: string | null; pausaMinutos: number; notas: string | null; horas: number } | null;
  /** Turno ese día en otro centro (préstamo) */
  otroCentro: { centro: string; inicio: string; fin: string } | null;
  ausencia: { tipo: string; estado: string } | null;
}

export interface AvisoCuadrante {
  empleadoId: string;
  empleado: string;
  dia: string | null;
  tono: "aviso" | "error";
  texto: string;
}

/**
 * Comprueba las reglas legales del cuadrante de una persona:
 * - descanso entre jornadas menor que el del convenio (12 h por defecto),
 * - horas de la semana por encima de la jornada del contrato,
 * - siete días seguidos sin descanso semanal,
 * - turno un día con ausencia aprobada.
 * `turnos` incluye todos los centros (los préstamos también cuentan) y el día anterior a la semana.
 */
export function comprobarCuadrante(
  p: { empleadoId: string; empleado: string; jornadaSemanal: number | null; descansoMinimoHoras: number },
  turnos: { dia: string; turno: Turno }[],
  semana: string[],
  ausencias: { desde: string; hasta: string; tipo: string }[],
): AvisoCuadrante[] {
  const avisos: AvisoCuadrante[] = [];
  const base = { empleadoId: p.empleadoId, empleado: p.empleado };
  const orden = [...turnos].sort((a, b) => a.dia.localeCompare(b.dia));
  for (let i = 1; i < orden.length; i++) {
    const anterior = limitesTurno(orden[i - 1].dia, orden[i - 1].turno);
    const actual = limitesTurno(orden[i].dia, orden[i].turno);
    const horas = (actual.inicio.getTime() - anterior.fin.getTime()) / 3_600_000;
    if (horas < p.descansoMinimoHoras && semana.includes(orden[i].dia)) {
      avisos.push({ ...base, dia: orden[i].dia, tono: "error", texto: `Descansa solo ${formatoHoras(horas)} entre jornadas (mínimo ${formatoHoras(p.descansoMinimoHoras)})` });
    }
  }
  const enSemana = orden.filter((t) => semana.includes(t.dia));
  const total = enSemana.reduce((s, t) => s + horasTurno(t.turno), 0);
  if (p.jornadaSemanal !== null && total > p.jornadaSemanal + 0.01) {
    avisos.push({ ...base, dia: null, tono: "aviso", texto: `${formatoHoras(total)} en la semana, por encima de su contrato (${formatoHoras(p.jornadaSemanal)})` });
  }
  if (p.jornadaSemanal === null && enSemana.length > 0) avisos.push({ ...base, dia: null, tono: "error", texto: "Tiene turnos pero no tiene contrato en vigor" });
  if (enSemana.length >= 7) avisos.push({ ...base, dia: null, tono: "error", texto: "Trabaja los siete días: falta el descanso semanal" });
  for (const t of enSemana) {
    const a = ausencias.find((x) => x.desde <= t.dia && x.hasta >= t.dia);
    if (a) avisos.push({ ...base, dia: t.dia, tono: "error", texto: `Tiene turno pero está de ${(NOMBRE_AUSENCIA[a.tipo as keyof typeof NOMBRE_AUSENCIA] ?? a.tipo).toLowerCase()}` });
  }
  return avisos;
}

function formatoHoras(h: number): string {
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

/** Cuadrante de una semana de un centro: personas que pueden trabajar ahí × 7 días, con avisos y totales. */
export async function cuadranteSemana(ctx: Contexto, centroId: string, lunesISO: string) {
  exigirCentro(ctx, centroId);
  const prisma = await db();
  const lunes = lunesDe(lunesISO);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const desde = aDia(sumarDias(lunes, -1));
  const hasta = aDia(dias[6]);

  const [empleadosBase, enCentro, estado, centros] = await Promise.all([
    prisma.empleado.findMany({
      where: { tenantId: ctx.tenant.id, activo: true, ...filtroEmpleadosEn([centroId]) },
      select: { id: true },
    }),
    // también quien tiene turno esa semana en este centro aunque ya no esté asignado a él
    prisma.asignacionTurno.findMany({ where: { tenantId: ctx.tenant.id, centroId, fecha: { gte: aDia(lunes), lte: hasta } }, select: { empleadoId: true } }),
    prisma.cuadranteSemana.findUnique({ where: { centroId_lunes: { centroId, lunes: aDia(lunes) } } }),
    mapaCentros(ctx),
  ]);
  const ids = Array.from(new Set([...empleadosBase.map((e) => e.id), ...enCentro.map((a) => a.empleadoId)]));
  const empleados = await prisma.empleado.findMany({
    where: { id: { in: ids } },
    include: {
      puesto: true,
      contratos: { include: { convenio: true } },
      asignaciones: { where: { fecha: { gte: desde, lte: hasta } } },
      ausencias: { where: { estado: { in: ["APROBADA", "PEDIDA"] }, desde: { lte: hasta }, hasta: { gte: aDia(lunes) } } },
    },
  });
  empleados.sort((a, b) => (a.puesto?.departamento ?? "").localeCompare(b.puesto?.departamento ?? "") || a.apellidos.localeCompare(b.apellidos));

  const avisos: AvisoCuadrante[] = [];
  const totalesDia = dias.map(() => ({ horas: 0, coste: 0, personas: 0 }));
  const filas = empleados.map((e) => {
    const contrato = contratoVigente(e.contratos, lunes) ?? contratoVigente(e.contratos, dias[6]);
    const coste = costeHoraContrato(contrato);
    const celdas: CeldaCuadrante[] = dias.map((dia, i) => {
      const a = e.asignaciones.find((x) => diaISO(x.fecha) === dia);
      const aus = e.ausencias.find((x) => diaISO(x.desde) <= dia && diaISO(x.hasta) >= dia);
      const propia = a && a.centroId === centroId ? a : null;
      if (propia) {
        const h = horasTurno(propia);
        totalesDia[i].horas += h;
        totalesDia[i].coste += h * (coste ?? 0);
        totalesDia[i].personas += 1;
      }
      return {
        dia,
        asignacion: propia ? { id: propia.id, inicio: propia.inicio, fin: propia.fin, inicio2: propia.inicio2, fin2: propia.fin2, pausaMinutos: propia.pausaMinutos, notas: propia.notas, horas: horasTurno(propia) } : null,
        otroCentro: a && a.centroId !== centroId ? { centro: centros.get(a.centroId)?.nombre ?? "otro centro", inicio: a.inicio, fin: a.fin2 ?? a.fin } : null,
        ausencia: aus ? { tipo: aus.tipo, estado: aus.estado } : null,
      };
    });
    const horasSemana = e.asignaciones.filter((a) => dias.includes(diaISO(a.fecha))).reduce((s, a) => s + horasTurno(a), 0);
    avisos.push(
      ...comprobarCuadrante(
        { empleadoId: e.id, empleado: nombreCompleto(e), jornadaSemanal: contrato ? aNumero(contrato.jornadaSemanal) : null, descansoMinimoHoras: contrato?.convenio ? aNumero(contrato.convenio.descansoMinimoHoras) : 12 },
        e.asignaciones.map((a) => ({ dia: diaISO(a.fecha), turno: a })),
        dias,
        e.ausencias.filter((x) => x.estado === "APROBADA").map((x) => ({ desde: diaISO(x.desde), hasta: diaISO(x.hasta), tipo: x.tipo })),
      ),
    );
    return {
      empleado: { id: e.id, nombre: nombreCompleto(e), puesto: e.puesto?.nombre ?? null, departamento: e.puesto?.departamento ?? null, prestado: e.centroPrincipalId !== centroId ? centros.get(e.centroPrincipalId)?.nombre ?? null : null },
      jornadaSemanal: contrato ? aNumero(contrato.jornadaSemanal) : null,
      horasSemana,
      costeHora: coste,
      celdas,
    };
  });
  return { centroId, lunes, dias, estado: estado?.estado ?? "BORRADOR", publicadoEn: estado?.publicadoEn ?? null, filas, avisos, totalesDia };
}
export type Cuadrante = Awaited<ReturnType<typeof cuadranteSemana>>;

/** Crea o cambia el turno de una persona un día (uno por persona y día; el partido va en el mismo). */
export async function guardarAsignacion(ctx: Contexto, d: DatosAsignacion) {
  exigirCentro(ctx, d.centroId);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, d.empleadoId);
    if (!e.activo) throw new ErrorPersonal("El empleado está de baja.");
    const puede = e.centroPrincipalId === d.centroId || e.centros.some((c) => c.centroId === d.centroId);
    if (!puede) throw new ErrorPersonal("Ese empleado no tiene este centro entre los suyos: añádelo en su ficha para prestarlo.");
    if (horasTurno(d) <= 0) throw new ErrorPersonal("El turno no tiene horas de trabajo.");
    if (horasTurno(d) > 14) throw new ErrorPersonal("Un turno de más de 14 horas no es válido.");
    const existente = await tx.asignacionTurno.findUnique({ where: { empleadoId_fecha: { empleadoId: d.empleadoId, fecha: aDia(d.fecha) } } });
    if (existente && existente.centroId !== d.centroId) {
      throw new ErrorPersonal("Ese día ya tiene turno en otro centro. Quítalo allí antes.");
    }
    const datos = { inicio: d.inicio, fin: d.fin, inicio2: d.inicio2 ?? null, fin2: d.fin2 ?? null, pausaMinutos: d.pausaMinutos ?? 0, notas: d.notas ?? null };
    await tx.asignacionTurno.upsert({
      where: { empleadoId_fecha: { empleadoId: d.empleadoId, fecha: aDia(d.fecha) } },
      create: { tenantId: ctx.tenant.id, centroId: d.centroId, empleadoId: d.empleadoId, fecha: aDia(d.fecha), creadoPor: ctx.usuario.id, ...datos },
      update: datos,
    });
    await marcarCambioPublicado(tx, ctx, d.centroId, d.fecha);
  });
}

export async function quitarAsignacion(ctx: Contexto, id: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const a = await tx.asignacionTurno.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!a) throw new ErrorPersonal("Turno no encontrado.");
    exigirCentro(ctx, a.centroId);
    // un turno es una previsión: se puede quitar (los fichajes reales no se tocan)
    await tx.asignacionTurno.delete({ where: { id } });
    await marcarCambioPublicado(tx, ctx, a.centroId, diaISO(a.fecha));
  });
}

/** Si la semana ya estaba publicada, deja constancia del cambio para avisar a la plantilla. */
async function marcarCambioPublicado(tx: Tx, ctx: Contexto, centroId: string, dia: string) {
  const sem = await tx.cuadranteSemana.findUnique({ where: { centroId_lunes: { centroId, lunes: aDia(lunesDe(dia)) } } });
  if (sem?.estado === "PUBLICADO") await emitir(tx, ctx.tenant.id, "personal.cuadrante.cambiado", { centroId, lunes: lunesDe(dia), dia });
}

/** Copia los turnos de la semana anterior (sin pisar lo que ya haya, ni a quien esté de baja o ausente). */
export async function copiarSemanaAnterior(ctx: Contexto, centroId: string, lunesISO: string) {
  exigirCentro(ctx, centroId);
  const prisma = await db();
  const lunes = lunesDe(lunesISO);
  const origen = await prisma.asignacionTurno.findMany({
    where: { tenantId: ctx.tenant.id, centroId, fecha: { gte: aDia(sumarDias(lunes, -7)), lte: aDia(sumarDias(lunes, -1)) } },
    include: { empleado: { include: { ausencias: { where: { estado: "APROBADA", hasta: { gte: aDia(lunes) }, desde: { lte: aDia(sumarDias(lunes, 6)) } } } } } },
  });
  if (origen.length === 0) throw new ErrorPersonal("La semana anterior no tiene turnos en este centro.");
  let copiados = 0;
  let saltados = 0;
  await prisma.$transaction(async (tx) => {
    for (const a of origen) {
      const dia = sumarDias(diaISO(a.fecha), 7);
      const ausente = a.empleado.ausencias.some((x) => diaISO(x.desde) <= dia && diaISO(x.hasta) >= dia);
      const baja = !a.empleado.activo || (a.empleado.fechaBaja && diaISO(a.empleado.fechaBaja) < dia);
      const ya = await tx.asignacionTurno.findUnique({ where: { empleadoId_fecha: { empleadoId: a.empleadoId, fecha: aDia(dia) } } });
      if (ausente || baja || ya) {
        saltados++;
        continue;
      }
      await tx.asignacionTurno.create({
        data: { tenantId: ctx.tenant.id, centroId, empleadoId: a.empleadoId, fecha: aDia(dia), inicio: a.inicio, fin: a.fin, inicio2: a.inicio2, fin2: a.fin2, pausaMinutos: a.pausaMinutos, notas: a.notas, creadoPor: ctx.usuario.id },
      });
      copiados++;
    }
  });
  return { copiados, saltados };
}

/** Publica el cuadrante de la semana: a partir de aquí cada cambio se avisa. */
export async function publicarCuadrante(ctx: Contexto, centroId: string, lunesISO: string) {
  exigirCentro(ctx, centroId);
  const prisma = await db();
  const lunes = lunesDe(lunesISO);
  await prisma.$transaction(async (tx) => {
    await tx.cuadranteSemana.upsert({
      where: { centroId_lunes: { centroId, lunes: aDia(lunes) } },
      create: { tenantId: ctx.tenant.id, centroId, lunes: aDia(lunes), estado: "PUBLICADO", publicadoPor: ctx.usuario.id, publicadoEn: new Date() },
      update: { estado: "PUBLICADO", publicadoPor: ctx.usuario.id, publicadoEn: new Date() },
    });
    // el portal del empleado y WhatsApp escucharán este evento
    await emitir(tx, ctx.tenant.id, "personal.cuadrante.publicado", { centroId, lunes });
  });
}

/** Próximos turnos de un empleado (para su ficha y su portal). */
export async function turnosEmpleado(ctx: Contexto, empleadoId: string, desde: string, dias = 14) {
  const prisma = await db();
  const centros = await mapaCentros(ctx);
  const lista = await prisma.asignacionTurno.findMany({
    where: { tenantId: ctx.tenant.id, empleadoId, fecha: { gte: aDia(desde), lte: aDia(sumarDias(desde, dias - 1)) } },
    orderBy: { fecha: "asc" },
  });
  return lista.map((a) => ({ ...a, dia: diaISO(a.fecha), horas: horasTurno(a), centro: centros.get(a.centroId)?.nombre ?? "—" }));
}

// =====================================================================
// Fichajes
// =====================================================================

const SIGUIENTE: Record<string, string[]> = {
  NADA: ["ENTRADA"],
  ENTRADA: ["INICIO_PAUSA", "SALIDA"],
  FIN_PAUSA: ["INICIO_PAUSA", "SALIDA"],
  INICIO_PAUSA: ["FIN_PAUSA"],
  SALIDA: ["ENTRADA"],
};
/** Pasadas estas horas desde la entrada sin salida, se da por olvidada y se permite volver a entrar. */
const HORAS_OLVIDO = 16;

/** Último fichaje válido y qué puede fichar ahora. */
export async function estadoFichaje(ctx: Contexto, empleadoId: string) {
  const prisma = await db();
  const ultimo = await prisma.fichaje.findFirst({ where: { tenantId: ctx.tenant.id, empleadoId, anulado: false }, orderBy: { momento: "desc" } });
  let estado = ultimo?.tipo ?? "NADA";
  let olvido = false;
  if (ultimo && estado !== "SALIDA" && Date.now() - ultimo.momento.getTime() > HORAS_OLVIDO * 3_600_000) {
    estado = "NADA";
    olvido = true;
  }
  return { ultimo, permitidos: SIGUIENTE[estado] as ("ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA")[], olvido, dentro: estado === "ENTRADA" || estado === "FIN_PAUSA", enPausa: estado === "INICIO_PAUSA" };
}

/** Fichar ahora (desde la pantalla del empleado, la tableta del local o el móvil). */
export async function fichar(ctx: Contexto, d: { empleadoId: string; centroId: string; tipo: "ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA"; origen?: string; pin?: string; propio?: boolean }) {
  const prisma = await db();
  const e = await prisma.empleado.findFirst({ where: { id: d.empleadoId, tenantId: ctx.tenant.id, activo: true }, include: { centros: true } });
  if (!e) throw new ErrorPersonal("Empleado no encontrado o de baja.");
  if (!d.propio) exigirCentro(ctx, d.centroId);
  const puede = e.centroPrincipalId === d.centroId || e.centros.some((c) => c.centroId === d.centroId);
  if (!puede) throw new ErrorPersonal("Ese centro no está entre los suyos.");
  if (d.origen === "TABLETA" && e.pin && e.pin !== d.pin) throw new ErrorPersonal("PIN incorrecto.");
  const est = await estadoFichaje(ctx, e.id);
  if (!est.permitidos.includes(d.tipo)) {
    throw new ErrorPersonal(`Ahora no se puede fichar «${d.tipo.toLowerCase().replace("_", " ")}». Lo siguiente es: ${est.permitidos.map((p) => p.toLowerCase().replace("_", " ")).join(" o ")}.`);
  }
  await prisma.fichaje.create({ data: { tenantId: ctx.tenant.id, empleadoId: e.id, centroId: d.centroId, tipo: d.tipo, momento: new Date(), origen: d.origen ?? "PANTALLA", creadoPor: ctx.usuario.id } });
}

/** Fichaje añadido a mano por el encargado (se olvidó de fichar): siempre con motivo. */
export async function anadirFichajeManual(ctx: Contexto, d: { empleadoId: string; centroId: string; tipo: "ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA"; dia: string; hora: string; motivo: string }) {
  exigirCentro(ctx, d.centroId);
  const prisma = await db();
  const momento = instanteMadrid(d.dia, d.hora);
  if (momento.getTime() > Date.now() + 60_000) throw new ErrorPersonal("No se puede fichar en el futuro.");
  await prisma.$transaction(async (tx) => {
    await empleadoAccesible(tx, ctx, d.empleadoId);
    const f = await tx.fichaje.create({
      data: { tenantId: ctx.tenant.id, empleadoId: d.empleadoId, centroId: d.centroId, tipo: d.tipo, momento, origen: "MANUAL", motivoCorreccion: d.motivo, corregidoPor: ctx.usuario.id, corregidoEn: new Date(), creadoPor: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Fichaje", entidadId: f.id, accion: "ANADIR_MANUAL", despues: { tipo: d.tipo, momento: momento.toISOString(), motivo: d.motivo } });
  });
}

/** Corrección: anula el original y crea el bueno, con motivo, autor y fecha. */
export async function corregirFichaje(ctx: Contexto, d: { fichajeId: string; tipo: "ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA"; dia: string; hora: string; motivo: string }) {
  const prisma = await db();
  const momento = instanteMadrid(d.dia, d.hora);
  if (momento.getTime() > Date.now() + 60_000) throw new ErrorPersonal("No se puede fichar en el futuro.");
  await prisma.$transaction(async (tx) => {
    const f = await tx.fichaje.findFirst({ where: { id: d.fichajeId, tenantId: ctx.tenant.id } });
    if (!f) throw new ErrorPersonal("Fichaje no encontrado.");
    if (f.anulado) throw new ErrorPersonal("Ese fichaje ya está anulado o corregido.");
    exigirCentro(ctx, f.centroId);
    const ahora = new Date();
    await tx.fichaje.update({ where: { id: f.id }, data: { anulado: true, motivoCorreccion: d.motivo, corregidoPor: ctx.usuario.id, corregidoEn: ahora } });
    const nuevo = await tx.fichaje.create({
      data: { tenantId: ctx.tenant.id, empleadoId: f.empleadoId, centroId: f.centroId, tipo: d.tipo, momento, origen: "MANUAL", corrigeAId: f.id, motivoCorreccion: d.motivo, corregidoPor: ctx.usuario.id, corregidoEn: ahora, creadoPor: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Fichaje", entidadId: nuevo.id, accion: "CORREGIR", antes: { id: f.id, tipo: f.tipo, momento: f.momento.toISOString() }, despues: { tipo: d.tipo, momento: momento.toISOString(), motivo: d.motivo } });
  });
}

export async function anularFichaje(ctx: Contexto, d: { fichajeId: string; motivo: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const f = await tx.fichaje.findFirst({ where: { id: d.fichajeId, tenantId: ctx.tenant.id } });
    if (!f) throw new ErrorPersonal("Fichaje no encontrado.");
    if (f.anulado) throw new ErrorPersonal("Ese fichaje ya está anulado.");
    exigirCentro(ctx, f.centroId);
    await tx.fichaje.update({ where: { id: f.id }, data: { anulado: true, motivoCorreccion: d.motivo, corregidoPor: ctx.usuario.id, corregidoEn: new Date() } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Fichaje", entidadId: f.id, accion: "ANULAR", antes: { tipo: f.tipo, momento: f.momento.toISOString() }, despues: { motivo: d.motivo } });
  });
}

export interface Jornada {
  empleadoId: string;
  centroId: string;
  dia: string;
  entrada: Date | null;
  salida: Date | null;
  minutosPausa: number;
  horas: number;
  incompleta: boolean;
  fichajes: { id: string; centroId: string; tipo: string; momento: Date; origen: string; anulado: boolean; motivoCorreccion: string | null; corregidoPor: string | null; corregidoEn: Date | null; corrigeAId: string | null }[];
}

/** Agrupa fichajes en jornadas (persona + día de jornada), calcula horas y pausas. */
export function calcularJornadas(fichajes: { id: string; empleadoId: string; centroId: string; tipo: string; momento: Date; origen: string; anulado: boolean; motivoCorreccion: string | null; corregidoPor: string | null; corregidoEn: Date | null; corrigeAId: string | null }[]): Jornada[] {
  const grupos = new Map<string, Jornada>();
  const orden = [...fichajes].sort((a, b) => a.momento.getTime() - b.momento.getTime());
  for (const f of orden) {
    const dia = jornadaDe(f.momento);
    const clave = `${f.empleadoId}|${dia}`;
    let j = grupos.get(clave);
    if (!j) {
      j = { empleadoId: f.empleadoId, centroId: f.centroId, dia, entrada: null, salida: null, minutosPausa: 0, horas: 0, incompleta: false, fichajes: [] };
      grupos.set(clave, j);
    }
    j.fichajes.push(f);
  }
  for (const j of grupos.values()) {
    const validos = j.fichajes.filter((f) => !f.anulado);
    let dentroDesde: Date | null = null;
    let pausaDesde: Date | null = null;
    let minutos = 0;
    for (const f of validos) {
      if (f.tipo === "ENTRADA") {
        if (!j.entrada) j.entrada = f.momento;
        dentroDesde = f.momento;
        j.centroId = f.centroId;
      } else if (f.tipo === "INICIO_PAUSA" && dentroDesde) {
        minutos += (f.momento.getTime() - dentroDesde.getTime()) / 60_000;
        dentroDesde = null;
        pausaDesde = f.momento;
      } else if (f.tipo === "FIN_PAUSA") {
        if (pausaDesde) j.minutosPausa += (f.momento.getTime() - pausaDesde.getTime()) / 60_000;
        pausaDesde = null;
        dentroDesde = f.momento;
      } else if (f.tipo === "SALIDA") {
        if (dentroDesde) minutos += (f.momento.getTime() - dentroDesde.getTime()) / 60_000;
        dentroDesde = null;
        j.salida = f.momento;
      }
    }
    j.incompleta = !j.entrada || !!dentroDesde || !!pausaDesde || !j.salida;
    j.horas = minutos / 60;
  }
  return Array.from(grupos.values());
}

/** Jornadas fichadas entre dos días (de jornada) en los centros que ve el usuario. */
export async function jornadasRango(ctx: Contexto, desde: string, hasta: string, empleadoId?: string) {
  return jornadasDe(ctx.tenant.id, empleadoId ? null : centrosFiltro(ctx), desde, hasta, empleadoId);
}

async function jornadasDe(tenantId: string, centroIds: string[] | null, desde: string, hasta: string, empleadoId?: string) {
  const prisma = await db();
  const fichajes = await prisma.fichaje.findMany({
    where: {
      tenantId,
      ...(empleadoId ? { empleadoId } : {}),
      ...(centroIds ? { centroId: { in: centroIds } } : {}),
      momento: { gte: instanteMadrid(desde, "05:00"), lt: instanteMadrid(sumarDias(hasta, 1), "05:00") },
    },
    orderBy: { momento: "asc" },
  });
  return calcularJornadas(fichajes);
}

export interface Diferencia {
  empleadoId: string;
  dia: string;
  centroId: string;
  previsto: { inicio: string; fin: string; horas: number } | null;
  real: { entrada: Date | null; salida: Date | null; horas: number } | null;
  retrasoMin: number;
  salidaAntesMin: number;
  diferenciaHoras: number;
  estado: "OK" | "RETRASO" | "SALIDA_ANTES" | "HORAS_DE_MAS" | "SIN_FICHAR" | "SIN_TURNO" | "INCOMPLETA";
}

/** Compara el cuadrante con los fichajes: retrasos, salidas antes de hora, horas de más, ausencias y fichajes sin turno. */
export async function diferenciasCuadranteFichaje(ctx: Contexto, desde: string, hasta: string): Promise<Diferencia[]> {
  const prisma = await db();
  const [asignaciones, jornadas] = await Promise.all([
    prisma.asignacionTurno.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, fecha: { gte: aDia(desde), lte: aDia(hasta) } } }),
    jornadasRango(ctx, desde, hasta),
  ]);
  const ahora = Date.now();
  const res: Diferencia[] = [];
  const usadas = new Set<string>();
  for (const a of asignaciones) {
    const dia = diaISO(a.fecha);
    const lim = limitesTurno(dia, a);
    const previsto = { inicio: a.inicio, fin: a.fin2 ?? a.fin, horas: horasTurno(a) };
    const j = jornadas.find((x) => x.empleadoId === a.empleadoId && x.dia === dia);
    if (j) usadas.add(`${j.empleadoId}|${j.dia}`);
    if (!j) {
      if (lim.inicio.getTime() + TOLERANCIA_MINUTOS * 60_000 < ahora) {
        res.push({ empleadoId: a.empleadoId, dia, centroId: a.centroId, previsto, real: null, retrasoMin: 0, salidaAntesMin: 0, diferenciaHoras: -previsto.horas, estado: "SIN_FICHAR" });
      }
      continue;
    }
    const retrasoMin = j.entrada ? Math.max(0, Math.round((j.entrada.getTime() - lim.inicio.getTime()) / 60_000)) : 0;
    const salidaAntesMin = j.salida ? Math.max(0, Math.round((lim.fin.getTime() - j.salida.getTime()) / 60_000)) : 0;
    const diferenciaHoras = j.horas - previsto.horas;
    let estado: Diferencia["estado"] = "OK";
    if (j.incompleta && lim.fin.getTime() < ahora) estado = "INCOMPLETA";
    else if (retrasoMin > TOLERANCIA_MINUTOS) estado = "RETRASO";
    else if (salidaAntesMin > TOLERANCIA_MINUTOS) estado = "SALIDA_ANTES";
    else if (diferenciaHoras * 60 > TOLERANCIA_MINUTOS * 3) estado = "HORAS_DE_MAS";
    res.push({ empleadoId: a.empleadoId, dia, centroId: a.centroId, previsto, real: { entrada: j.entrada, salida: j.salida, horas: j.horas }, retrasoMin, salidaAntesMin, diferenciaHoras, estado });
  }
  for (const j of jornadas) {
    if (usadas.has(`${j.empleadoId}|${j.dia}`)) continue;
    res.push({ empleadoId: j.empleadoId, dia: j.dia, centroId: j.centroId, previsto: null, real: { entrada: j.entrada, salida: j.salida, horas: j.horas }, retrasoMin: 0, salidaAntesMin: 0, diferenciaHoras: j.horas, estado: "SIN_TURNO" });
  }
  return res.sort((a, b) => b.dia.localeCompare(a.dia));
}

/** Empleado vinculado al usuario que ha entrado (para el portal: fichar y ver lo suyo). */
export async function empleadoDelUsuario(ctx: Contexto) {
  const prisma = await db();
  return prisma.empleado.findFirst({ where: { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, activo: true }, include: { puesto: true, centros: true } });
}

/** Nombres de los usuarios (autores de correcciones y aprobaciones). */
export async function nombresUsuarios(ctx: Contexto, ids: (string | null | undefined)[]) {
  const limpios = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (limpios.length === 0) return new Map<string, string>();
  const prisma = await db();
  const us = await prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id, id: { in: limpios } }, select: { id: true, nombre: true } });
  return new Map(us.map((u) => [u.id, u.nombre]));
}

// =====================================================================
// Ausencias
// =====================================================================

export async function listarAusencias(ctx: Contexto, f: { estado?: string; desde?: string; hasta?: string; empleadoId?: string } = {}) {
  const prisma = await db();
  return prisma.ausencia.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(f.empleadoId ? { empleadoId: f.empleadoId } : { centroId: { in: centrosFiltro(ctx) } }),
      ...(f.estado ? { estado: f.estado as never } : {}),
      ...(f.desde ? { hasta: { gte: aDia(f.desde) } } : {}),
      ...(f.hasta ? { desde: { lte: aDia(f.hasta) } } : {}),
    },
    include: { empleado: { include: { puesto: true } } },
    orderBy: [{ desde: "asc" }],
  });
}

export async function pedirAusencia(ctx: Contexto, d: { empleadoId: string; tipo: string; desde: string; hasta: string; comentario?: string; aprobarYa: boolean }) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, d.empleadoId);
    if (!e.activo) throw new ErrorPersonal("El empleado está de baja.");
    const solape = await tx.ausencia.findFirst({ where: { empleadoId: e.id, estado: { in: ["PEDIDA", "APROBADA"] }, desde: { lte: aDia(d.hasta) }, hasta: { gte: aDia(d.desde) } } });
    if (solape) throw new ErrorPersonal(`Se solapa con otra ausencia del ${diaISO(solape.desde).split("-").reverse().join("/")} al ${diaISO(solape.hasta).split("-").reverse().join("/")}.`);
    const aprobada = d.aprobarYa && ctx.puede("personal:ausencias:aprobar");
    const a = await tx.ausencia.create({
      data: {
        tenantId: ctx.tenant.id,
        empleadoId: e.id,
        centroId: e.centroPrincipalId,
        tipo: d.tipo as never,
        desde: aDia(d.desde),
        hasta: aDia(d.hasta),
        dias: diasEntre(d.desde, d.hasta),
        estado: aprobada ? "APROBADA" : "PEDIDA",
        comentario: d.comentario,
        pedidaPor: ctx.usuario.id,
        ...(aprobada ? { resueltaPor: ctx.usuario.id, resueltaEn: new Date() } : {}),
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ausencia", entidadId: a.id, accion: aprobada ? "REGISTRAR_APROBADA" : "PEDIR", despues: { tipo: d.tipo, desde: d.desde, hasta: d.hasta } });
    return a;
  });
}

/** Aprobar, rechazar (con motivo) o anular una ausencia. Devuelve cuántos turnos chocan con ella. */
export async function resolverAusencia(ctx: Contexto, d: { ausenciaId: string; decision: "APROBAR" | "RECHAZAR" | "ANULAR"; motivo?: string }) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const a = await tx.ausencia.findFirst({ where: { id: d.ausenciaId, tenantId: ctx.tenant.id } });
    if (!a) throw new ErrorPersonal("Ausencia no encontrada.");
    exigirCentro(ctx, a.centroId);
    if (d.decision !== "ANULAR" && a.estado !== "PEDIDA") throw new ErrorPersonal("Solo se pueden resolver las ausencias pedidas.");
    if (d.decision === "ANULAR" && !["PEDIDA", "APROBADA"].includes(a.estado)) throw new ErrorPersonal("Esa ausencia ya no se puede anular.");
    if (d.decision === "RECHAZAR" && !d.motivo) throw new ErrorPersonal("Indica el motivo del rechazo.");
    const estado = d.decision === "APROBAR" ? "APROBADA" : d.decision === "RECHAZAR" ? "RECHAZADA" : "ANULADA";
    await tx.ausencia.update({ where: { id: a.id }, data: { estado, resueltaPor: ctx.usuario.id, resueltaEn: new Date(), motivoRechazo: d.motivo ?? null } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Ausencia", entidadId: a.id, accion: d.decision, antes: { estado: a.estado }, despues: { estado, motivo: d.motivo ?? null } });
    if (estado === "APROBADA") await emitir(tx, ctx.tenant.id, "personal.ausencia.aprobada", { ausenciaId: a.id, empleadoId: a.empleadoId, desde: diaISO(a.desde), hasta: diaISO(a.hasta), tipo: a.tipo });
    const choques = estado === "APROBADA" ? await tx.asignacionTurno.count({ where: { empleadoId: a.empleadoId, fecha: { gte: a.desde, lte: a.hasta } } }) : 0;
    return { choques };
  });
}

/** Saldo de vacaciones del año: días del convenio (prorrateados si entró ese año) menos los aprobados o pedidos. */
export async function saldoVacaciones(ctx: Contexto, empleadoId: string, anio = Number(hoyMadrid().slice(0, 4))) {
  const prisma = await db();
  const e = await prisma.empleado.findFirst({ where: { id: empleadoId, tenantId: ctx.tenant.id }, include: { contratos: { include: { convenio: true } } } });
  if (!e) return null;
  const contrato = contratoVigente(e.contratos, hoyMadrid()) ?? e.contratos[0];
  const diasConvenio = contrato?.convenio?.diasVacaciones ?? 30;
  const ini = `${anio}-01-01`;
  const fin = `${anio}-12-31`;
  const alta = diaISO(e.fechaAlta);
  const desde = alta > ini ? alta : ini;
  const derecho = desde > fin ? 0 : Math.round((diasConvenio * diasEntre(desde, fin)) / diasEntre(ini, fin));
  const vac = await prisma.ausencia.findMany({ where: { empleadoId, tipo: "VACACIONES", estado: { in: ["APROBADA", "PEDIDA"] }, desde: { lte: aDia(fin) }, hasta: { gte: aDia(ini) } } });
  let disfrutados = 0;
  let pedidos = 0;
  for (const v of vac) {
    const a = diaISO(v.desde) < ini ? ini : diaISO(v.desde);
    const b = diaISO(v.hasta) > fin ? fin : diaISO(v.hasta);
    const n = diasEntre(a, b);
    if (v.estado === "APROBADA") disfrutados += n;
    else pedidos += n;
  }
  return { anio, derecho, disfrutados, pedidos, quedan: derecho - disfrutados - pedidos };
}

// =====================================================================
// Formación y documentos
// =====================================================================

export async function listarCertificados(ctx: Contexto, f: { estado?: "caducados" | "proximos" | "vigentes" | "todos"; tipo?: string } = {}) {
  const prisma = await db();
  const hoy = aDia(hoyMadrid());
  const limite = aDia(sumarDias(hoyMadrid(), DIAS_AVISO));
  return prisma.certificadoEmpleado.findMany({
    where: {
      tenantId: ctx.tenant.id,
      activo: true,
      empleado: { activo: true, centroPrincipalId: { in: centrosFiltro(ctx) } },
      ...(f.tipo ? { tipo: f.tipo } : {}),
      ...(f.estado === "caducados" ? { caducaEn: { lt: hoy } } : f.estado === "proximos" ? { caducaEn: { gte: hoy, lte: limite } } : f.estado === "vigentes" ? { OR: [{ caducaEn: null }, { caducaEn: { gte: hoy } }] } : {}),
    },
    include: { empleado: { include: { puesto: true } } },
    orderBy: [{ caducaEn: "asc" }],
  });
}

/** Personas activas a las que les falta un certificado obligatorio (manipulador y alérgenos en cocina, sala, barra y obrador). */
export async function faltasCertificados(ctx: Contexto) {
  const prisma = await db();
  const hoy = aDia(hoyMadrid());
  const empleados = await prisma.empleado.findMany({
    where: { tenantId: ctx.tenant.id, activo: true, centroPrincipalId: { in: centrosFiltro(ctx) }, puesto: { departamento: { in: ["COCINA", "SALA", "BARRA", "OBRADOR", "OFFICE"] } } },
    include: { puesto: true, certificados: { where: { activo: true, OR: [{ caducaEn: null }, { caducaEn: { gte: hoy } }] } } },
  });
  const obligatorios = ["MANIPULADOR", "ALERGENOS"];
  return empleados
    .map((e) => ({ empleado: e, faltan: obligatorios.filter((t) => !e.certificados.some((c) => c.tipo === t)) }))
    .filter((x) => x.faltan.length > 0);
}

export async function crearCertificado(ctx: Contexto, d: { empleadoId: string; tipo: string; nombre?: string; entidad?: string; obtenidoEn?: string; caducaEn?: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await empleadoAccesible(tx, ctx, d.empleadoId);
    if (d.obtenidoEn && d.caducaEn && d.caducaEn < d.obtenidoEn) throw new ErrorPersonal("La caducidad es anterior a la obtención.");
    const c = await tx.certificadoEmpleado.create({
      data: {
        tenantId: ctx.tenant.id,
        empleadoId: d.empleadoId,
        tipo: d.tipo,
        nombre: d.nombre ?? NOMBRE_CERTIFICADO[d.tipo as keyof typeof NOMBRE_CERTIFICADO] ?? d.tipo,
        entidad: d.entidad,
        obtenidoEn: d.obtenidoEn ? aDia(d.obtenidoEn) : null,
        caducaEn: d.caducaEn ? aDia(d.caducaEn) : null,
        creadoPor: ctx.usuario.id,
      },
    });
    // el certificado nuevo sustituye a los anteriores del mismo tipo
    if (d.tipo !== "FORMACION_INTERNA" && d.tipo !== "OTRO") {
      await tx.certificadoEmpleado.updateMany({ where: { empleadoId: d.empleadoId, tipo: d.tipo, activo: true, id: { not: c.id } }, data: { activo: false } });
    }
  });
}

export async function desactivarCertificado(ctx: Contexto, id: string) {
  const prisma = await db();
  const c = await prisma.certificadoEmpleado.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!c) throw new ErrorPersonal("Certificado no encontrado.");
  await prisma.$transaction(async (tx) => {
    await empleadoAccesible(tx, ctx, c.empleadoId);
    await tx.certificadoEmpleado.update({ where: { id }, data: { activo: false } });
  });
}

export async function registrarDocumento(ctx: Contexto, d: { empleadoId: string; tipo: string; nombre: string; caducaEn?: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await empleadoAccesible(tx, ctx, d.empleadoId);
    const doc = await tx.documentoEmpleado.create({
      data: { tenantId: ctx.tenant.id, empleadoId: d.empleadoId, tipo: d.tipo, nombre: d.nombre, caducaEn: d.caducaEn ? aDia(d.caducaEn) : null, subidoPor: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "DocumentoEmpleado", entidadId: doc.id, accion: "REGISTRAR", despues: { tipo: d.tipo, nombre: d.nombre } });
  });
}

export async function desactivarDocumento(ctx: Contexto, id: string) {
  const prisma = await db();
  const doc = await prisma.documentoEmpleado.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!doc) throw new ErrorPersonal("Documento no encontrado.");
  await prisma.$transaction(async (tx) => {
    await empleadoAccesible(tx, ctx, doc.empleadoId);
    await tx.documentoEmpleado.update({ where: { id }, data: { activo: false } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "DocumentoEmpleado", entidadId: id, accion: "RETIRAR" });
  });
}

// =====================================================================
// Selección
// =====================================================================

export async function listarOfertas(ctx: Contexto, estado?: string) {
  const prisma = await db();
  return prisma.ofertaEmpleo.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, ...(estado ? { estado: estado as never } : {}) },
    include: { puesto: true, candidatos: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ estado: "asc" }, { publicadaEn: "desc" }],
  });
}

export async function bolsaCandidatos(ctx: Contexto) {
  const prisma = await db();
  return prisma.candidato.findMany({ where: { tenantId: ctx.tenant.id, ofertaId: null, estado: { notIn: ["CONTRATADO"] } }, orderBy: { createdAt: "desc" } });
}

export async function crearOferta(ctx: Contexto, d: { centroId: string; puestoId?: string; titulo: string; descripcion?: string; tipoContrato?: string; jornada?: number; plazas: number }) {
  exigirCentro(ctx, d.centroId);
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const o = await tx.ofertaEmpleo.create({
      data: { tenantId: ctx.tenant.id, centroId: d.centroId, puestoId: d.puestoId, titulo: d.titulo, descripcion: d.descripcion, tipoContrato: d.tipoContrato as never, jornada: d.jornada, plazas: d.plazas, creadoPor: ctx.usuario.id },
    });
    // el módulo Webs la publicará en «Trabaja con nosotros»
    await emitir(tx, ctx.tenant.id, "personal.oferta.publicada", { ofertaId: o.id, centroId: d.centroId, titulo: d.titulo });
    return o;
  });
}

export async function cambiarEstadoOferta(ctx: Contexto, id: string, estado: "ABIERTA" | "CUBIERTA" | "CERRADA") {
  const prisma = await db();
  const o = await prisma.ofertaEmpleo.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!o) throw new ErrorPersonal("Oferta no encontrada.");
  exigirCentro(ctx, o.centroId);
  await prisma.$transaction(async (tx) => {
    await tx.ofertaEmpleo.update({ where: { id }, data: { estado, cerradaEn: estado === "ABIERTA" ? null : new Date() } });
    if (estado !== "ABIERTA") await emitir(tx, ctx.tenant.id, "personal.oferta.cerrada", { ofertaId: id });
  });
}

export async function crearCandidato(ctx: Contexto, d: { ofertaId?: string; nombre: string; apellidos?: string; email?: string; telefono?: string; origen?: string; notas?: string; consentimiento: boolean }) {
  const prisma = await db();
  if (d.ofertaId) {
    const o = await prisma.ofertaEmpleo.findFirst({ where: { id: d.ofertaId, tenantId: ctx.tenant.id } });
    if (!o) throw new ErrorPersonal("Oferta no encontrada.");
  }
  if (!d.email && !d.telefono) throw new ErrorPersonal("Indica al menos el teléfono o el correo del candidato.");
  // RGPD: con consentimiento se guarda un año; sin él, hasta que se cierre el proceso (90 días).
  const borrarEn = aDia(sumarDias(hoyMadrid(), d.consentimiento ? 365 : 90));
  await prisma.candidato.create({
    data: { tenantId: ctx.tenant.id, ofertaId: d.ofertaId, nombre: d.nombre, apellidos: d.apellidos, email: d.email, telefono: d.telefono, origen: d.origen, notas: d.notas, consentimientoEn: d.consentimiento ? new Date() : null, borrarEn },
  });
}

export async function cambiarEstadoCandidato(ctx: Contexto, d: { candidatoId: string; estado: string; notas?: string }) {
  const prisma = await db();
  const c = await prisma.candidato.findFirst({ where: { id: d.candidatoId, tenantId: ctx.tenant.id } });
  if (!c) throw new ErrorPersonal("Candidato no encontrado.");
  if (c.estado === "CONTRATADO") throw new ErrorPersonal("El candidato ya está contratado.");
  if (d.estado === "CONTRATADO") throw new ErrorPersonal("Para contratar usa «Contratar»: crea su ficha de empleado.");
  await prisma.candidato.update({ where: { id: c.id }, data: { estado: d.estado as never, ...(d.notas ? { notas: [c.notas, d.notas].filter(Boolean).join("\n") } : {}) } });
}

/** Contratar: pasa los datos del candidato a una ficha de empleado nueva sin volver a escribirlos. */
export async function contratarCandidato(ctx: Contexto, d: { candidatoId: string; centroPrincipalId: string; puestoId?: string; fechaAlta: string }) {
  const prisma = await db();
  const c = await prisma.candidato.findFirst({ where: { id: d.candidatoId, tenantId: ctx.tenant.id }, include: { oferta: true } });
  if (!c) throw new ErrorPersonal("Candidato no encontrado.");
  if (c.empleadoId) throw new ErrorPersonal("Este candidato ya tiene ficha de empleado.");
  const empleadoId = await altaEmpleado(ctx, {
    nombre: c.nombre,
    apellidos: c.apellidos ?? "",
    email: c.email ?? undefined,
    telefono: c.telefono ?? undefined,
    centroPrincipalId: d.centroPrincipalId,
    centrosExtra: [],
    puestoId: d.puestoId ?? c.oferta?.puestoId ?? undefined,
    fechaAlta: d.fechaAlta,
    conContrato: false,
    notas: `Contratado desde selección${c.oferta ? ` (oferta «${c.oferta.titulo}»)` : ""}.`,
  } as DatosAlta);
  await prisma.$transaction(async (tx) => {
    await tx.candidato.update({ where: { id: c.id }, data: { estado: "CONTRATADO", empleadoId } });
    if (c.ofertaId && c.oferta) {
      const contratados = await tx.candidato.count({ where: { ofertaId: c.ofertaId, estado: "CONTRATADO" } });
      if (contratados >= c.oferta.plazas) await tx.ofertaEmpleo.update({ where: { id: c.ofertaId }, data: { estado: "CUBIERTA", cerradaEn: new Date() } });
    }
  });
  return empleadoId;
}

// =====================================================================
// Coste de personal y exportación a la gestoría
// =====================================================================

export interface CosteDia {
  centroId: string;
  dia: string;
  horasPrevistas: number;
  costePrevisto: number;
  horasReales: number;
  costeReal: number;
  sinCoste: number; // horas fichadas de personas sin coste/hora conocido
  /** Lo fichado y, para los turnos sin fichaje, lo del cuadrante (lo que usa el Cuadro de mando). */
  horas: number;
  coste: number;
}

/**
 * Coste de personal por centro y día = horas × coste/hora del contrato en vigor ese día.
 * Previsto: del cuadrante. Real: de los fichajes. Los préstamos cuentan en el centro donde se trabaja.
 */
async function calcularCostes(tenantId: string, centros: string[], desde: string, hasta: string): Promise<CosteDia[]> {
  const prisma = await db();
  const [asignaciones, jornadas] = await Promise.all([
    prisma.asignacionTurno.findMany({ where: { tenantId, centroId: { in: centros }, fecha: { gte: aDia(desde), lte: aDia(hasta) } } }),
    jornadasDe(tenantId, centros, desde, hasta),
  ]);
  const ids = Array.from(new Set([...asignaciones.map((a) => a.empleadoId), ...jornadas.map((j) => j.empleadoId)]));
  const contratos = await prisma.contrato.findMany({ where: { tenantId, empleadoId: { in: ids } } });
  const porEmpleado = new Map<string, typeof contratos>();
  for (const c of contratos) porEmpleado.set(c.empleadoId, [...(porEmpleado.get(c.empleadoId) ?? []), c]);
  const coste = (empleadoId: string, dia: string) => costeHoraContrato(contratoVigente(porEmpleado.get(empleadoId) ?? [], dia));

  const mapa = new Map<string, CosteDia>();
  const fila = (centroId: string, dia: string) => {
    const k = `${centroId}|${dia}`;
    let f = mapa.get(k);
    if (!f) {
      f = { centroId, dia, horasPrevistas: 0, costePrevisto: 0, horasReales: 0, costeReal: 0, sinCoste: 0, horas: 0, coste: 0 };
      mapa.set(k, f);
    }
    return f;
  };
  const fichadas = new Set(jornadas.map((j) => `${j.empleadoId}|${j.dia}`));
  for (const a of asignaciones) {
    const dia = diaISO(a.fecha);
    const h = horasTurno(a);
    const ch = coste(a.empleadoId, dia) ?? 0;
    const f = fila(a.centroId, dia);
    f.horasPrevistas += h;
    f.costePrevisto += h * ch;
    if (!fichadas.has(`${a.empleadoId}|${dia}`)) {
      f.horas += h;
      f.coste += h * ch;
    }
  }
  for (const j of jornadas) {
    if (!centros.includes(j.centroId)) continue;
    const ch = coste(j.empleadoId, j.dia);
    const f = fila(j.centroId, j.dia);
    f.horasReales += j.horas;
    f.costeReal += j.horas * (ch ?? 0);
    f.horas += j.horas;
    f.coste += j.horas * (ch ?? 0);
    if (ch === null) f.sinCoste += j.horas;
  }
  return Array.from(mapa.values()).sort((a, b) => a.dia.localeCompare(b.dia) || a.centroId.localeCompare(b.centroId));
}

export async function costePersonal(ctx: Contexto, desde: string, hasta: string): Promise<CosteDia[]> {
  return calcularCostes(ctx.tenant.id, centrosFiltro(ctx), desde, hasta);
}

/**
 * Para otros módulos (Cuadro de mando): coste de personal por centro y día.
 * Horas reales de los fichajes y, para los turnos sin fichaje, las del cuadrante; × coste/hora del contrato
 * en vigor ese día. Los préstamos se imputan al centro donde se trabaja. `desde` y `hasta` incluidos
 * (se toma su día en hora de Madrid). Sin sesión: quien llama ya ha comprobado permisos y centros.
 */
export async function costePersonalPorCentroYDia(tenantId: string, centroIds: string[], desde: Date, hasta: Date): Promise<{ centroId: string; dia: string; horas: number; coste: number }[]> {
  if (centroIds.length === 0) return [];
  const filas = await calcularCostes(tenantId, centroIds, partesMadrid(desde).dia, partesMadrid(hasta).dia);
  return filas.filter((f) => f.horas > 0).map((f) => ({ centroId: f.centroId, dia: f.dia, horas: Math.round(f.horas * 100) / 100, coste: Math.round(f.coste * 100) / 100 }));
}

export interface FilaNomina {
  sociedad: string;
  cif: string;
  codigo: string;
  empleado: string;
  dni: string;
  nss: string;
  centro: string;
  tipoContrato: string;
  jornadaSemanal: number;
  horasPrevistas: number;
  horasReales: number;
  horasContrato: number;
  horasExtra: number;
  ausencias: Record<string, number>;
  alta: string;
  baja: string;
}

/**
 * Variables del mes para la gestoría, por sociedad: horas previstas y reales, horas por encima
 * del contrato (jornada semanal × días del mes / 7), días de ausencia por tipo, altas y bajas.
 */
export async function variablesNomina(ctx: Contexto, mes: string, sociedadId?: string): Promise<FilaNomina[]> {
  const prisma = await db();
  const dias = diasDelMes(mes);
  const ini = dias[0];
  const fin = dias[dias.length - 1];
  const [centros, sociedades] = await Promise.all([mapaCentros(ctx), listarSociedades(ctx)]);
  const socMap = new Map(sociedades.map((s) => [s.id, s]));
  const empleados = await prisma.empleado.findMany({
    where: {
      tenantId: ctx.tenant.id,
      centroPrincipalId: { in: centrosFiltro(ctx) },
      fechaAlta: { lte: aDia(fin) },
      OR: [{ fechaBaja: null }, { fechaBaja: { gte: aDia(ini) } }],
    },
    include: {
      contratos: true,
      asignaciones: { where: { fecha: { gte: aDia(ini), lte: aDia(fin) } } },
      ausencias: { where: { estado: "APROBADA", desde: { lte: aDia(fin) }, hasta: { gte: aDia(ini) } } },
    },
    orderBy: [{ apellidos: "asc" }],
  });
  const fichajes = await prisma.fichaje.findMany({
    where: { tenantId: ctx.tenant.id, empleadoId: { in: empleados.map((e) => e.id) }, momento: { gte: instanteMadrid(ini, "05:00"), lt: instanteMadrid(sumarDias(fin, 1), "05:00") } },
  });
  const jornadas = calcularJornadas(fichajes);
  const filas: FilaNomina[] = [];
  for (const e of empleados) {
    const contrato = contratoVigente(e.contratos, fin) ?? contratoVigente(e.contratos, ini) ?? e.contratos[0];
    const socId = contrato?.sociedadId ?? e.sociedadId ?? centros.get(e.centroPrincipalId)?.sociedadId ?? null;
    if (sociedadId && socId !== sociedadId) continue;
    const soc = socId ? socMap.get(socId) : undefined;
    const horasReales = jornadas.filter((j) => j.empleadoId === e.id).reduce((s, j) => s + j.horas, 0);
    const horasPrevistas = e.asignaciones.reduce((s, a) => s + horasTurno(a), 0);
    const altaISO = diaISO(e.fechaAlta);
    const bajaISO = e.fechaBaja ? diaISO(e.fechaBaja) : null;
    const desdeE = altaISO > ini ? altaISO : ini;
    const hastaE = bajaISO && bajaISO < fin ? bajaISO : fin;
    const jornada = contrato ? aNumero(contrato.jornadaSemanal) : 0;
    const horasContrato = (jornada * Math.max(0, diasEntre(desdeE, hastaE))) / 7;
    const ausencias: Record<string, number> = {};
    for (const a of e.ausencias) {
      const a1 = diaISO(a.desde) < ini ? ini : diaISO(a.desde);
      const a2 = diaISO(a.hasta) > fin ? fin : diaISO(a.hasta);
      ausencias[a.tipo] = (ausencias[a.tipo] ?? 0) + diasEntre(a1, a2);
    }
    filas.push({
      sociedad: soc?.razonSocial ?? "Sin sociedad",
      cif: soc?.cif ?? "",
      codigo: e.codigo,
      empleado: nombreCompleto(e),
      dni: e.dni ?? "",
      nss: e.nss ?? "",
      centro: centros.get(e.centroPrincipalId)?.nombre ?? "",
      tipoContrato: contrato?.tipo ?? "",
      jornadaSemanal: jornada,
      horasPrevistas,
      horasReales,
      horasContrato,
      horasExtra: Math.max(0, horasReales - horasContrato),
      ausencias,
      alta: altaISO >= ini && altaISO <= fin ? altaISO : "",
      baja: bajaISO && bajaISO >= ini && bajaISO <= fin ? bajaISO : "",
    });
  }
  return filas.sort((a, b) => a.sociedad.localeCompare(b.sociedad) || a.empleado.localeCompare(b.empleado));
}

/** Número para el CSV de la gestoría: sin separador de miles y con coma decimal (Excel en español). */
function numeroCSV(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r).replace(".", ",");
}

function celdaCSV(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV (separado por «;», UTF-8 con BOM) con las variables del mes por sociedad. */
export function csvNomina(filas: FilaNomina[]): string {
  const tipos = Object.keys(NOMBRE_AUSENCIA) as (keyof typeof NOMBRE_AUSENCIA)[];
  const cab = ["Sociedad", "CIF", "Código", "Empleado", "DNI", "NSS", "Centro", "Contrato", "Jornada semanal", "Horas contrato mes", "Horas cuadrante", "Horas fichadas", "Horas extra", ...tipos.map((t) => `Días ${NOMBRE_AUSENCIA[t].toLowerCase()}`), "Alta en el mes", "Baja en el mes"];
  const fechaES = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");
  const lineas = filas.map((f) =>
    [
      f.sociedad,
      f.cif,
      f.codigo,
      f.empleado,
      f.dni,
      f.nss,
      f.centro,
      f.tipoContrato,
      numeroCSV(f.jornadaSemanal),
      numeroCSV(f.horasContrato),
      numeroCSV(f.horasPrevistas),
      numeroCSV(f.horasReales),
      numeroCSV(f.horasExtra),
      ...tipos.map((t) => String(f.ausencias[t] ?? 0)),
      fechaES(f.alta),
      fechaES(f.baja),
    ]
      .map(celdaCSV)
      .join(";"),
  );
  return "﻿" + [cab.map(celdaCSV).join(";"), ...lineas].join("\r\n") + "\r\n";
}

export { partesMadrid };
