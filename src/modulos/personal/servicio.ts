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
import { calcularJornadas, type Jornada } from "./jornadas";
import { prepararNominasMes, guardarNominas, horasExtraDeJornadas } from "./nominas";
export { calcularJornadas, type Jornada };

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

/**
 * Contrato en vigor un día: el más reciente cuyas fechas cubren ese día (inicio ≤ día ≤ fin).
 * Mandan las fechas, no el campo `activo` (que solo marca el último contrato sin cerrar): un contrato
 * finalizado con fecha futura sigue en vigor hasta esa fecha y uno nuevo no lo está hasta su inicio.
 * Los anulados antes de empezar (baja antes de su inicio) quedan con fin anterior al inicio y no cubren ningún día.
 * Es la única regla: la usan la lista, la ficha, los avisos, el cuadrante, los costes y las nóminas.
 */
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

/** ¿Ve el usuario todos los centros de la cadena? (para tocar lo que es común a todos). */
export async function veTodaLaCadena(ctx: Contexto): Promise<boolean> {
  const prisma = await db();
  const total = await prisma.centro.count({ where: { tenantId: ctx.tenant.id } });
  return ctx.centros.length >= total;
}

/** Retira un turno tipo. Los comunes a toda la cadena (sin centro) solo los retira quien ve todos los centros. */
export async function desactivarTurnoTipo(ctx: Contexto, id: string) {
  const prisma = await db();
  const t = await prisma.turnoTipo.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!t) throw new ErrorPersonal("Turno tipo no encontrado.");
  if (t.centroId) exigirCentro(ctx, t.centroId);
  else if (!(await veTodaLaCadena(ctx))) throw new ErrorPersonal("Este turno tipo es común a todos los centros de la cadena: solo lo puede retirar quien ve todos los centros.");
  await prisma.turnoTipo.update({ where: { id: t.id }, data: { activo: false } });
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
    usuarioId: d.usuarioId ?? null,
    notas: d.notas ?? null,
  };
}

/**
 * Usuarios de acceso (Ajustes → Usuarios) que se pueden enlazar a una ficha: los activos de la cadena
 * que no están ya enlazados a otro empleado activo. Incluye el que ya tenga la ficha.
 */
export async function usuariosParaEnlazar(ctx: Contexto, empleadoId?: string) {
  const prisma = await db();
  const [usuarios, enlazados] = await Promise.all([
    prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, nombre: true, email: true, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.empleado.findMany({ where: { tenantId: ctx.tenant.id, activo: true, usuarioId: { not: null }, ...(empleadoId ? { id: { not: empleadoId } } : {}) }, select: { usuarioId: true } }),
  ]);
  const ocupados = new Set(enlazados.map((x) => x.usuarioId));
  const propio = empleadoId ? (await prisma.empleado.findFirst({ where: { id: empleadoId, tenantId: ctx.tenant.id }, select: { usuarioId: true } }))?.usuarioId : null;
  return usuarios.filter((u) => u.id === propio || (u.activo && !ocupados.has(u.id)));
}

/** Comprueba que el usuario que se enlaza es de la cadena, está activo y no es de otro empleado activo. */
async function comprobarUsuarioEnlazable(tx: Tx, ctx: Contexto, usuarioId: string | null | undefined, empleadoId?: string, actual?: string | null) {
  if (!usuarioId || usuarioId === actual) return;
  const u = await tx.usuario.findFirst({ where: { id: usuarioId, tenantId: ctx.tenant.id } });
  if (!u) throw new ErrorPersonal("Usuario de acceso no encontrado.");
  if (!u.activo) throw new ErrorPersonal(`El usuario ${u.email} está desactivado: actívalo antes en Ajustes → Usuarios.`);
  const otro = await tx.empleado.findFirst({ where: { tenantId: ctx.tenant.id, usuarioId, activo: true, ...(empleadoId ? { id: { not: empleadoId } } : {}) } });
  if (otro) throw new ErrorPersonal(`El usuario ${u.email} ya está enlazado a ${nombreCompleto(otro)} (${otro.codigo}).`);
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
    await comprobarUsuarioEnlazable(tx, ctx, d.usuarioId);
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
    await comprobarUsuarioEnlazable(tx, ctx, d.usuarioId, id, antes.usuarioId);
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

/**
 * Baja: desactiva (nunca borra), finaliza el contrato en vigor, anula los que empezaban después,
 * quita los turnos posteriores y desactiva al momento su usuario de acceso (si tiene uno enlazado).
 */
export async function bajaEmpleado(ctx: Contexto, id: string, d: { fecha: string; motivo: string }): Promise<{ usuarioDesactivado: boolean }> {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, id);
    if (!e.activo) throw new ErrorPersonal("El empleado ya está de baja.");
    if (d.fecha < diaISO(e.fechaAlta)) throw new ErrorPersonal("La fecha de baja es anterior al alta.");
    const fecha = aDia(d.fecha);
    await tx.empleado.update({ where: { id }, data: { activo: false, fechaBaja: fecha, motivoBaja: d.motivo } });
    await tx.contrato.updateMany({ where: { empleadoId: id, activo: true }, data: { activo: false, motivoFin: `Baja: ${d.motivo}` } });
    await tx.contrato.updateMany({ where: { empleadoId: id, OR: [{ fechaFin: null }, { fechaFin: { gt: fecha } }], fechaInicio: { lte: fecha } }, data: { fechaFin: fecha } });
    // contratos que aún no habían empezado: quedan anulados (fin el día antes de su inicio: no cubren ningún día)
    const futuros = await tx.contrato.findMany({ where: { empleadoId: id, fechaInicio: { gt: fecha } } });
    for (const c of futuros) {
      await tx.contrato.update({ where: { id: c.id }, data: { activo: false, fechaFin: aDia(sumarDias(diaISO(c.fechaInicio), -1)), motivoFin: `Anulado por la baja: ${d.motivo}` } });
    }
    const quitados = await tx.asignacionTurno.deleteMany({ where: { empleadoId: id, fecha: { gt: fecha } } });
    await tx.ausencia.updateMany({ where: { empleadoId: id, estado: "PEDIDA" }, data: { estado: "ANULADA", motivoRechazo: "Baja del empleado" } });
    // su usuario de acceso se desactiva al momento (la tabla es del núcleo; se deja auditado)
    let usuarioDesactivado = false;
    if (e.usuarioId) {
      const u = await tx.usuario.findFirst({ where: { id: e.usuarioId, tenantId: ctx.tenant.id } });
      if (u?.activo) {
        await tx.usuario.update({ where: { id: u.id }, data: { activo: false } });
        await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Usuario", entidadId: u.id, accion: "DESACTIVAR", antes: { activo: true }, despues: { activo: false, motivo: `Baja del empleado ${e.codigo}` } });
        usuarioDesactivado = true;
      }
    }
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Empleado", entidadId: id, accion: "BAJA", despues: { fecha: d.fecha, motivo: d.motivo, turnosQuitados: quitados.count, contratosAnulados: futuros.length, usuarioDesactivado } });
    // Aviso para otros módulos (la gestoría, para el finiquito, cuando esté conectada). Hoy nadie lo escucha:
    // por eso el usuario se desactiva aquí mismo.
    await emitir(tx, ctx.tenant.id, "personal.empleado.baja", { empleadoId: id, codigo: e.codigo, usuarioId: e.usuarioId, fecha: d.fecha, motivo: d.motivo, sociedadId: e.sociedadId });
    return { usuarioDesactivado };
  });
}

/**
 * Reingreso de un empleado dado de baja (por ejemplo, un fijo discontinuo al empezar la temporada).
 * La fecha de alta pasa a ser la del reingreso (manda en nóminas, vacaciones y altas del mes), pero la
 * primera alta se guarda en `fechaAntiguedad` para no perder la antigüedad. La baja anterior queda en la auditoría.
 * Su usuario de acceso no se reactiva solo: se hace en Ajustes → Usuarios.
 */
export async function reactivarEmpleado(ctx: Contexto, id: string, fecha: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const e = await empleadoAccesible(tx, ctx, id);
    if (e.activo) throw new ErrorPersonal("El empleado ya está activo.");
    if (e.fechaBaja && fecha <= diaISO(e.fechaBaja)) throw new ErrorPersonal("La fecha de reingreso tiene que ser posterior a la de la baja.");
    if (e.dni) {
      const dup = await tx.empleado.findFirst({ where: { tenantId: ctx.tenant.id, dni: e.dni, activo: true, id: { not: id } } });
      if (dup) throw new ErrorPersonal(`Ya hay un empleado activo con el DNI ${e.dni} (${dup.codigo}).`);
    }
    const antiguedad = e.fechaAntiguedad ?? e.fechaAlta;
    await tx.empleado.update({ where: { id }, data: { activo: true, fechaBaja: null, motivoBaja: null, fechaAlta: aDia(fecha), fechaAntiguedad: antiguedad } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Empleado", entidadId: id, accion: "REINGRESO", antes: { fechaAlta: diaISO(e.fechaAlta), fechaBaja: e.fechaBaja ? diaISO(e.fechaBaja) : null, motivoBaja: e.motivoBaja }, despues: { fecha, antiguedad: diaISO(antiguedad) } });
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
      pagasAnuales: d.pagasAnuales ?? 14,
      pagasProrrateadas: d.pagasProrrateadas ?? true,
      irpfPorcentaje: d.irpfPorcentaje ?? null,
      fechaInicio: aDia(d.fechaInicio),
      fechaFin: d.fechaFin ? aDia(d.fechaFin) : null,
      finPeriodoPrueba: d.finPeriodoPrueba ? aDia(d.finPeriodoPrueba) : null,
      notas: d.notas ?? null,
      creadoPor: ctx.usuario.id,
    },
  });
  // los complementos fijos (pluses) pasan del contrato anterior al nuevo
  const complementosPrevios = await tx.complementoSalarial.findMany({ where: { contratoId: { in: previos.map((p) => p.id) }, activo: true } });
  if (complementosPrevios.length) {
    await tx.complementoSalarial.createMany({ data: complementosPrevios.map((k) => ({ tenantId: k.tenantId, contratoId: c.id, concepto: k.concepto, nombre: k.nombre, importeMensual: k.importeMensual, cotiza: k.cotiza, tributa: k.tributa })) });
  }
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

/**
 * Contratos que vencen en 30 días, periodos de prueba, certificados y documentos que caducan, y
 * personas activas sin contrato en vigor hoy. «En vigor» = contratoVigente (por fechas), igual que la lista.
 */
export async function avisosPersonal(ctx: Contexto, dias = DIAS_AVISO): Promise<AvisoPersonal[]> {
  const prisma = await db();
  const hoy = hoyMadrid();
  const limite = aDia(sumarDias(hoy, dias));
  const hoyD = aDia(hoy);
  const empleados = await prisma.empleado.findMany({
    where: { tenantId: ctx.tenant.id, activo: true, centroPrincipalId: { in: centrosFiltro(ctx) } },
    include: {
      contratos: true,
      certificados: { where: { activo: true, caducaEn: { not: null, lte: limite } } },
      documentos: { where: { activo: true, caducaEn: { not: null, lte: limite } } },
    },
  });
  const avisos: AvisoPersonal[] = [];
  for (const e of empleados) {
    const base = { empleadoId: e.id, empleado: nombreCompleto(e), centroId: e.centroPrincipalId };
    const vigente = contratoVigente(e.contratos, hoy);
    // el próximo contrato que empieza después de hoy (renovación ya firmada o primer contrato)
    const siguiente = e.contratos.filter((c) => c.fechaInicio > hoyD && (!c.fechaFin || c.fechaFin >= c.fechaInicio)).sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())[0];
    if (!vigente) {
      const vencido = e.contratos.find((c) => c.activo && c.fechaFin && c.fechaFin < hoyD);
      if (vencido) avisos.push({ ...base, tipo: "CONTRATO_VENCIDO", tono: "error", texto: "Contrato vencido sin renovar ni finalizar", fecha: vencido.fechaFin });
      else if (siguiente) avisos.push({ ...base, tipo: "SIN_CONTRATO", tono: "aviso", texto: "Sin contrato en vigor hasta que empiece el nuevo", fecha: siguiente.fechaInicio });
      else avisos.push({ ...base, tipo: "SIN_CONTRATO", tono: "error", texto: "Sin contrato en vigor", fecha: null });
    } else if (vigente.fechaFin && vigente.fechaFin <= limite) {
      // si ya hay un contrato que empieza al día siguiente, no hay hueco: no se avisa
      const renovado = siguiente && diaISO(siguiente.fechaInicio) <= sumarDias(diaISO(vigente.fechaFin), 1);
      if (!renovado) avisos.push({ ...base, tipo: "CONTRATO_VENCE", tono: "aviso", texto: "El contrato vence", fecha: vigente.fechaFin });
    }
    for (const c of [vigente, siguiente]) {
      if (c?.finPeriodoPrueba && c.finPeriodoPrueba >= hoyD && c.finPeriodoPrueba <= limite) avisos.push({ ...base, tipo: "PERIODO_PRUEBA", tono: "aviso", texto: "Termina el periodo de prueba", fecha: c.finPeriodoPrueba });
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
    // para los avisos de la semana: el contrato del lunes (o, si empieza a mitad de semana, el del domingo)
    const contrato = contratoVigente(e.contratos, lunes) ?? contratoVigente(e.contratos, dias[6]);
    // el coste, día a día con el contrato en vigor ese día (un cambio de contrato a mitad de semana cuenta)
    const costeDia = dias.map((dia) => costeHoraContrato(contratoVigente(e.contratos, dia)));
    const celdas: CeldaCuadrante[] = dias.map((dia, i) => {
      const a = e.asignaciones.find((x) => diaISO(x.fecha) === dia);
      const aus = e.ausencias.find((x) => diaISO(x.desde) <= dia && diaISO(x.hasta) >= dia);
      const propia = a && a.centroId === centroId ? a : null;
      if (propia) {
        const h = horasTurno(propia);
        totalesDia[i].horas += h;
        totalesDia[i].coste += h * (costeDia[i] ?? 0);
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
      costeHora: costeHoraContrato(contrato),
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

/**
 * Si la semana ya estaba publicada, deja constancia del cambio (evento personal.cuadrante.cambiado).
 * Hoy nadie lo escucha: el aviso a la plantilla (portal, WhatsApp) está pendiente; la ayuda lo dice.
 */
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
    // el portal ya enseña las semanas publicadas (turnosEmpleado). El evento queda para el aviso por WhatsApp (pendiente: hoy nadie lo escucha)
    await emitir(tx, ctx.tenant.id, "personal.cuadrante.publicado", { centroId, lunes });
  });
}

/**
 * Turnos de un empleado (para su ficha y su portal), con si su semana está publicada en ese centro.
 * `soloPublicados`: el portal solo enseña las semanas publicadas (los borradores aún pueden cambiar).
 */
export async function turnosEmpleado(ctx: Contexto, empleadoId: string, desde: string, dias = 14, opciones: { soloPublicados?: boolean } = {}) {
  const prisma = await db();
  const centros = await mapaCentros(ctx);
  const lista = await prisma.asignacionTurno.findMany({
    where: { tenantId: ctx.tenant.id, empleadoId, fecha: { gte: aDia(desde), lte: aDia(sumarDias(desde, dias - 1)) } },
    orderBy: { fecha: "asc" },
  });
  const semanas = lista.length
    ? await prisma.cuadranteSemana.findMany({ where: { tenantId: ctx.tenant.id, estado: "PUBLICADO", centroId: { in: Array.from(new Set(lista.map((a) => a.centroId))) }, lunes: { in: Array.from(new Set(lista.map((a) => lunesDe(diaISO(a.fecha))))).map(aDia) } } })
    : [];
  const publicadas = new Set(semanas.map((x) => `${x.centroId}|${diaISO(x.lunes)}`));
  return lista
    .map((a) => ({ ...a, dia: diaISO(a.fecha), horas: horasTurno(a), centro: centros.get(a.centroId)?.nombre ?? "—", publicado: publicadas.has(`${a.centroId}|${lunesDe(diaISO(a.fecha))}`) }))
    .filter((a) => !opciones.soloPublicados || a.publicado);
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

/**
 * Fichar ahora. Quién puede fichar por quién:
 * - MOVIL (portal, `propio`): cada uno lo suyo.
 * - TABLETA del local: la persona escribe su PIN. Si no tiene PIN, solo puede ficharle quien tenga
 *   «Corregir fichajes» (el encargado), y queda auditado.
 * - PANTALLA (ficha del empleado, «Fichar ahora»): fichar por otro, solo con «Corregir fichajes»; auditado.
 */
export async function fichar(ctx: Contexto, d: { empleadoId: string; centroId: string; tipo: "ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA"; origen?: string; pin?: string; propio?: boolean }) {
  const prisma = await db();
  const e = await prisma.empleado.findFirst({ where: { id: d.empleadoId, tenantId: ctx.tenant.id, activo: true }, include: { centros: true } });
  if (!e) throw new ErrorPersonal("Empleado no encontrado o de baja.");
  if (!d.propio) exigirCentro(ctx, d.centroId);
  const puede = e.centroPrincipalId === d.centroId || e.centros.some((c) => c.centroId === d.centroId);
  if (!puede) throw new ErrorPersonal("Ese centro no está entre los suyos.");
  const encargado = ctx.puede("personal:fichajes:corregir");
  let porOtro = false;
  if (!d.propio) {
    if (d.origen === "TABLETA") {
      if (e.pin) {
        if (e.pin !== d.pin) throw new ErrorPersonal("PIN incorrecto.");
      } else if (!encargado) {
        throw new ErrorPersonal("Esta persona no tiene PIN para fichar: ponlo en su ficha (o que la fiche su encargado).");
      } else porOtro = true;
    } else {
      if (!encargado) throw new ErrorPersonal("Fichar por otra persona necesita el permiso «Corregir fichajes».");
      porOtro = true;
    }
  }
  const est = await estadoFichaje(ctx, e.id);
  if (!est.permitidos.includes(d.tipo)) {
    throw new ErrorPersonal(`Ahora no se puede fichar «${d.tipo.toLowerCase().replace("_", " ")}». Lo siguiente es: ${est.permitidos.map((p) => p.toLowerCase().replace("_", " ")).join(" o ")}.`);
  }
  await prisma.$transaction(async (tx) => {
    const f = await tx.fichaje.create({ data: { tenantId: ctx.tenant.id, empleadoId: e.id, centroId: d.centroId, tipo: d.tipo, momento: new Date(), origen: d.origen ?? "PANTALLA", creadoPor: ctx.usuario.id } });
    if (porOtro) await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Fichaje", entidadId: f.id, accion: "FICHAR_POR_OTRO", despues: { empleadoId: e.id, tipo: d.tipo, origen: f.origen, momento: f.momento.toISOString() } });
  });
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

// calcularJornadas y Jornada viven en jornadas.ts (puro: lo usa también el cálculo de nóminas de la semilla)

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

/** Candidatos que siguen dentro de plazo (los caducados no se enseñan aunque aún no se hayan borrado). */
function candidatoEnPlazo(): Prisma.CandidatoWhereInput {
  return { OR: [{ borrarEn: null }, { borrarEn: { gte: aDia(hoyMadrid()) } }, { estado: "CONTRATADO" }] };
}

export async function listarOfertas(ctx: Contexto, estado?: string) {
  const prisma = await db();
  return prisma.ofertaEmpleo.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, ...(estado ? { estado: estado as never } : {}) },
    include: { puesto: true, candidatos: { where: candidatoEnPlazo(), orderBy: { createdAt: "desc" } } },
    orderBy: [{ estado: "asc" }, { publicadaEn: "desc" }],
  });
}

/**
 * Candidatos de unos centros: los de su bolsa o sus ofertas. Los antiguos de la bolsa sin centro
 * (de antes de guardar el centro) se siguen viendo en todos los centros hasta que se borren.
 */
function candidatoDeCentros(ids: string[]): Prisma.CandidatoWhereInput {
  return { OR: [{ centroId: { in: ids } }, { centroId: null, oferta: { centroId: { in: ids } } }, { centroId: null, ofertaId: null }] };
}

/** Bolsa (candidatos sin oferta) de los centros que ve el usuario. */
export async function bolsaCandidatos(ctx: Contexto) {
  const prisma = await db();
  return prisma.candidato.findMany({ where: { tenantId: ctx.tenant.id, ofertaId: null, estado: { notIn: ["CONTRATADO"] }, AND: [candidatoDeCentros(centrosFiltro(ctx)), candidatoEnPlazo()] }, orderBy: { createdAt: "desc" } });
}

/** Candidatos de los centros del usuario que ya han pasado su fecha de borrado (RGPD). */
export async function candidatosCaducados(ctx: Contexto): Promise<number> {
  const prisma = await db();
  return prisma.candidato.count({ where: { tenantId: ctx.tenant.id, ...candidatoDeCentros(ctx.centros.map((c) => c.id)), borrarEn: { lt: aDia(hoyMadrid()) }, empleadoId: null, estado: { not: "CONTRATADO" } } });
}

/**
 * Borra los datos de los candidatos que han pasado su fecha (`borrarEn`), de los centros del usuario
 * (protección de datos). Los contratados no se tocan: sus datos ya están en su ficha de empleado.
 * Se ejecuta sola al guardar un candidato y con el botón de Selección. Queda auditado (sin datos personales).
 */
export async function borrarCandidatosCaducados(ctx: Contexto): Promise<number> {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const r = await tx.candidato.deleteMany({ where: { tenantId: ctx.tenant.id, ...candidatoDeCentros(ctx.centros.map((c) => c.id)), borrarEn: { lt: aDia(hoyMadrid()) }, empleadoId: null, estado: { not: "CONTRATADO" } } });
    if (r.count) await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Candidato", entidadId: "caducados", accion: "BORRAR_CADUCADOS", despues: { borrados: r.count, hasta: hoyMadrid() } });
    return r.count;
  });
}

/** Candidato de la cadena cuyo centro (el de su oferta o el de la bolsa) ve el usuario. */
async function candidatoAccesible(ctx: Contexto, id: string) {
  const prisma = await db();
  const c = await prisma.candidato.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { oferta: true } });
  if (!c) throw new ErrorPersonal("Candidato no encontrado.");
  const centro = c.oferta?.centroId ?? c.centroId;
  if (centro) exigirCentro(ctx, centro);
  return c;
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

/** Candidato nuevo: a una oferta abierta de un centro del usuario o a la bolsa de un centro suyo. */
export async function crearCandidato(ctx: Contexto, d: { ofertaId?: string; centroId?: string; nombre: string; apellidos?: string; email?: string; telefono?: string; origen?: string; notas?: string; consentimiento: boolean }) {
  const prisma = await db();
  let centroId: string;
  if (d.ofertaId) {
    const o = await prisma.ofertaEmpleo.findFirst({ where: { id: d.ofertaId, tenantId: ctx.tenant.id } });
    if (!o) throw new ErrorPersonal("Oferta no encontrada.");
    exigirCentro(ctx, o.centroId);
    if (o.estado !== "ABIERTA") throw new ErrorPersonal("La oferta no está abierta: reábrela o apunta al candidato en la bolsa.");
    centroId = o.centroId;
  } else {
    const c = d.centroId ?? ctx.centroActivo?.id;
    if (!c) throw new ErrorPersonal("Elige el centro de la bolsa.");
    exigirCentro(ctx, c);
    centroId = c;
  }
  if (!d.email && !d.telefono) throw new ErrorPersonal("Indica al menos el teléfono o el correo del candidato.");
  await borrarCandidatosCaducados(ctx);
  // RGPD: con consentimiento se guarda un año; sin él, hasta que se cierre el proceso (90 días).
  const borrarEn = aDia(sumarDias(hoyMadrid(), d.consentimiento ? 365 : 90));
  await prisma.candidato.create({
    data: { tenantId: ctx.tenant.id, ofertaId: d.ofertaId, centroId, nombre: d.nombre, apellidos: d.apellidos, email: d.email, telefono: d.telefono, origen: d.origen, notas: d.notas, consentimientoEn: d.consentimiento ? new Date() : null, borrarEn },
  });
}

export async function cambiarEstadoCandidato(ctx: Contexto, d: { candidatoId: string; estado: string; notas?: string }) {
  const prisma = await db();
  const c = await candidatoAccesible(ctx, d.candidatoId);
  if (c.estado === "CONTRATADO") throw new ErrorPersonal("El candidato ya está contratado.");
  if (d.estado === "CONTRATADO") throw new ErrorPersonal("Para contratar usa «Contratar»: crea su ficha de empleado.");
  await prisma.candidato.update({ where: { id: c.id }, data: { estado: d.estado as never, ...(d.notas ? { notas: [c.notas, d.notas].filter(Boolean).join("\n") } : {}) } });
}

/** Contratar: pasa los datos del candidato a una ficha de empleado nueva sin volver a escribirlos. */
export async function contratarCandidato(ctx: Contexto, d: { candidatoId: string; centroPrincipalId: string; puestoId?: string; fechaAlta: string }) {
  const prisma = await db();
  const c = await candidatoAccesible(ctx, d.candidatoId);
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
 * Variables del mes para la gestoría, por sociedad: horas previstas y reales, horas del contrato
 * (jornada semanal × días en alta / 7, de referencia), horas extra (la misma regla que la nómina:
 * horasExtraDeJornadas), días de ausencia por tipo, altas y bajas.
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
    const altaISO = diaISO(e.fechaAlta);
    const bajaISO = e.fechaBaja ? diaISO(e.fechaBaja) : null;
    const desdeE = altaISO > ini ? altaISO : ini;
    const hastaE = bajaISO && bajaISO < fin ? bajaISO : fin;
    const suyas = jornadas.filter((j) => j.empleadoId === e.id);
    const horasReales = suyas.reduce((s, j) => s + j.horas, 0);
    const horasPrevistas = e.asignaciones.reduce((s, a) => s + horasTurno(a), 0);
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
      // la misma regla que la nómina (nominas.ts): lo fichado por encima del turno del cuadrante, día a día
      horasExtra: horasExtraDeJornadas(suyas.filter((j) => j.dia >= desdeE && j.dia <= hastaE), e.asignaciones.map((a) => ({ dia: diaISO(a.fecha), turno: a }))),
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

// =====================================================================
// Nóminas (cálculo de ejemplo en nominas.ts; la oficial la hace la gestoría)
// =====================================================================

/** Nóminas de un mes en los centros visibles (o en uno), con empleado y conceptos. */
export async function listarNominas(ctx: Contexto, f: { mes: string; centroId?: string }) {
  const prisma = await db();
  const centros = f.centroId ? centrosFiltro(ctx).filter((c) => c === f.centroId) : centrosFiltro(ctx);
  return prisma.nomina.findMany({
    where: { tenantId: ctx.tenant.id, periodo: f.mes, centroId: { in: centros } },
    include: { empleado: { select: { id: true, codigo: true, nombre: true, apellidos: true, dni: true, nss: true, iban: true } }, lineas: { orderBy: { orden: "asc" } } },
    orderBy: [{ centroId: "asc" }, { empleado: { apellidos: "asc" } }],
  });
}
export type NominaListado = Awaited<ReturnType<typeof listarNominas>>[number];

/** Nóminas de un empleado (las 24 últimas), sin conceptos. */
export async function nominasEmpleado(ctx: Contexto, empleadoId: string) {
  const prisma = await db();
  await empleadoAccesible(prisma, ctx, empleadoId);
  return prisma.nomina.findMany({ where: { tenantId: ctx.tenant.id, empleadoId, centroId: { in: centrosFiltro(ctx) } }, orderBy: { periodo: "desc" }, take: 24 });
}

/** Meses que ya tienen nóminas (para el selector), del más reciente al más antiguo. */
export async function mesesConNominas(ctx: Contexto): Promise<string[]> {
  const prisma = await db();
  const filas = await prisma.nomina.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) } }, distinct: ["periodo"], select: { periodo: true }, orderBy: { periodo: "desc" } });
  return filas.map((f) => f.periodo);
}

/**
 * Calcula (o recalcula) las nóminas de un mes en BORRADOR para un centro o todos los visibles.
 * Las cerradas o pagadas no se tocan. Devuelve cuántas se han calculado, bloqueadas y sin contrato.
 */
export async function calcularNominasMes(ctx: Contexto, mes: string, centroId?: string) {
  if (centroId) exigirCentro(ctx, centroId);
  const centros = centroId ? [centroId] : centrosFiltro(ctx);
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const { nominas, sinContrato } = await prepararNominasMes(tx, ctx.tenant.id, centros, mes);
    const r = await guardarNominas(tx, ctx.tenant.id, nominas, { estado: "BORRADOR", usuarioId: ctx.usuario.id });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Nomina", entidadId: mes, accion: "CALCULAR", despues: { mes, centros, ...r, sinContrato: sinContrato.length } });
    return { ...r, sinContrato: sinContrato.length };
  }, { timeout: 60_000 });
}

/** Cambia de estado las nóminas de un mes: BORRADOR → CERRADA, o CERRADA → PAGADA (con fecha de pago). */
export async function cambiarEstadoNominas(ctx: Contexto, d: { mes: string; centroId?: string; ids?: string[]; a: "CERRADA" | "PAGADA"; fechaPago?: string }) {
  const prisma = await db();
  const centros = d.centroId ? centrosFiltro(ctx).filter((c) => c === d.centroId) : centrosFiltro(ctx);
  const desde = d.a === "CERRADA" ? "BORRADOR" : "CERRADA";
  return prisma.$transaction(async (tx) => {
    const where = { tenantId: ctx.tenant.id, periodo: d.mes, centroId: { in: centros }, estado: desde as "BORRADOR" | "CERRADA", ...(d.ids?.length ? { id: { in: d.ids } } : {}) };
    const afectadas = await tx.nomina.findMany({ where, select: { id: true, costeEmpresa: true, neto: true, centroId: true } });
    if (afectadas.length === 0) throw new ErrorPersonal(d.a === "CERRADA" ? "No hay nóminas en borrador que cerrar." : "No hay nóminas cerradas pendientes de pago.");
    await tx.nomina.updateMany({
      where: { id: { in: afectadas.map((n) => n.id) } },
      data: d.a === "CERRADA" ? { estado: "CERRADA", cerradaEn: new Date(), cerradaPor: ctx.usuario.id } : { estado: "PAGADA", fechaPago: aDia(d.fechaPago ?? hoyMadrid()) },
    });
    const total = afectadas.reduce((t, n) => ({ coste: t.coste + aNumero(n.costeEmpresa), neto: t.neto + aNumero(n.neto) }), { coste: 0, neto: 0 });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Nomina", entidadId: d.mes, accion: d.a === "CERRADA" ? "CERRAR" : "PAGAR", despues: { mes: d.mes, nominas: afectadas.length, ...total, fechaPago: d.fechaPago ?? null } });
    // aviso para Contabilidad y el Cuadro de mando: hoy nadie lo escucha (leen costeNominasPorCentroYMes cuando lo necesitan)
    if (d.a === "CERRADA") {
      for (const centroId of Array.from(new Set(afectadas.map((n) => n.centroId)))) {
        const delCentro = afectadas.filter((n) => n.centroId === centroId);
        await emitir(tx, ctx.tenant.id, "personal.nominas.cerradas", { mes: d.mes, centroId, nominas: delCentro.length, costeEmpresa: Math.round(delCentro.reduce((t, n) => t + aNumero(n.costeEmpresa), 0) * 100) / 100 });
      }
    }
    return afectadas.length;
  });
}

export interface CosteNominasCentroMes {
  centroId: string;
  mes: string; // "2026-10"
  empleados: number;
  devengado: number; // bruto
  ssEmpresa: number;
  ssTrabajador: number;
  irpf: number;
  neto: number;
  costeEmpresa: number; // devengado + SS empresa − pago delegado de IT
  borradores: number; // nóminas aún en borrador (el coste puede cambiar)
}

/**
 * Para otros módulos (Contabilidad, Cuadro de mando): coste de las nóminas por centro y mes.
 * `desdeMes` y `hastaMes` en "AAAA-MM", ambos incluidos. Incluye borradores (se indica cuántos).
 * Sin sesión: quien llama ya ha comprobado permisos y centros.
 */
export async function costeNominasPorCentroYMes(tenantId: string, centroIds: string[], desdeMes: string, hastaMes: string): Promise<CosteNominasCentroMes[]> {
  if (centroIds.length === 0) return [];
  const prisma = await db();
  const filas = await prisma.nomina.findMany({
    where: { tenantId, centroId: { in: centroIds }, periodo: { gte: desdeMes, lte: hastaMes } },
    select: { centroId: true, periodo: true, devengado: true, ssEmpresa: true, ssTrabajador: true, irpf: true, neto: true, costeEmpresa: true, estado: true },
  });
  const mapa = new Map<string, CosteNominasCentroMes>();
  for (const n of filas) {
    const k = `${n.centroId}|${n.periodo}`;
    const x = mapa.get(k) ?? { centroId: n.centroId, mes: n.periodo, empleados: 0, devengado: 0, ssEmpresa: 0, ssTrabajador: 0, irpf: 0, neto: 0, costeEmpresa: 0, borradores: 0 };
    x.empleados++;
    x.devengado += aNumero(n.devengado);
    x.ssEmpresa += aNumero(n.ssEmpresa);
    x.ssTrabajador += aNumero(n.ssTrabajador);
    x.irpf += aNumero(n.irpf);
    x.neto += aNumero(n.neto);
    x.costeEmpresa += aNumero(n.costeEmpresa);
    if (n.estado === "BORRADOR") x.borradores++;
    mapa.set(k, x);
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return Array.from(mapa.values())
    .map((x) => ({ ...x, devengado: r2(x.devengado), ssEmpresa: r2(x.ssEmpresa), ssTrabajador: r2(x.ssTrabajador), irpf: r2(x.irpf), neto: r2(x.neto), costeEmpresa: r2(x.costeEmpresa) }))
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.centroId.localeCompare(b.centroId));
}

export { partesMadrid };
