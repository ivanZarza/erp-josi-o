import "server-only";
/**
 * Calidad: listas APPCC, temperaturas, incidencias y mantenimiento preventivo.
 * Ver docs/specs/modulos/calidad/README.md
 *
 * Exporta para otros módulos: crearIncidenciaAutomatica (p. ej. Obrador al retirar un lote).
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { numero as formatoNumero } from "@/kernel/formato";
import type { Tx } from "@/nucleo/movimientos";
import {
  esquemaEquipo,
  esquemaGestionIncidencia,
  esquemaHecho,
  esquemaIncidencia,
  esquemaMantenimiento,
  esquemaPlantilla,
  esquemaPunto,
  esquemaTemperatura,
} from "./esquemas";

export class ErrorCalidad extends Error {}

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_CORTE = 5; // la jornada termina a las 05:00 (Centro.horaCorte por defecto)

function fechaDeTexto(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
function textoDeFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Jornada actual en Madrid: antes de las 05:00 sigue contando el día anterior. */
export function jornadaHoy(): string {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(ahora);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  const dia = `${v("year")}-${v("month")}-${v("day")}`;
  if (Number(v("hour")) < HORA_CORTE) return textoDeFecha(new Date(fechaDeTexto(dia).getTime() - DIA_MS));
  return dia;
}

function exigirCentro(ctx: Contexto, centroId: string) {
  const c = ctx.centros.find((x) => x.id === centroId);
  if (!c) throw new ErrorCalidad("No tienes acceso a ese centro");
  return c;
}

function nombreCentro(ctx: Contexto, id: string) {
  return ctx.centros.find((c) => c.id === id)?.nombre ?? "—";
}

// ---------------------------------------------------------------------------
// Incidencias automáticas (APPCC, temperatura, lotes)
// ---------------------------------------------------------------------------

export async function crearIncidenciaAutomatica(
  tx: Tx,
  d: { tenantId: string; centroId: string; tipo: "SEGURIDAD_ALIMENTARIA" | "TEMPERATURA" | "AVERIA" | "OTRA"; titulo: string; descripcion?: string; origen: string; origenId?: string; usuarioId?: string; usuarioNombre?: string; prioridad?: "BAJA" | "MEDIA" | "ALTA" },
) {
  const numero = await siguienteNumero(tx, d.tenantId, "INC");
  const inc = await tx.calidadIncidencia.create({
    data: {
      tenantId: d.tenantId,
      centroId: d.centroId,
      numero,
      tipo: d.tipo,
      titulo: d.titulo,
      descripcion: d.descripcion,
      prioridad: d.prioridad ?? "ALTA",
      origen: d.origen,
      origenId: d.origenId,
      plazo: fechaDeTexto(textoDeFecha(new Date(Date.now() + DIA_MS))),
      creadoPor: d.usuarioId,
      creadoNombre: d.usuarioNombre,
    },
  });
  await emitir(tx, d.tenantId, "calidad.incidencia.creada", { id: inc.id, numero, tipo: d.tipo, centroId: d.centroId, origen: d.origen });
  return inc;
}

// ---------------------------------------------------------------------------
// Listas APPCC
// ---------------------------------------------------------------------------

export async function tareasDeHoy(ctx: Contexto) {
  const prisma = await db();
  const ids = centrosFiltro(ctx);
  const hoy = jornadaHoy();
  const [plantillas, ejecuciones] = await Promise.all([
    prisma.calidadPlantilla.findMany({
      where: { tenantId: ctx.tenant.id, activo: true, OR: [{ centroId: null }, { centroId: { in: ids } }] },
      include: { puntos: { where: { activo: true }, orderBy: { orden: "asc" } } },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    }),
    prisma.calidadEjecucion.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, fecha: fechaDeTexto(hoy) }, include: { respuestas: true } }),
  ]);
  const filas = [];
  for (const centroId of ids) {
    for (const p of plantillas) {
      if (p.centroId && p.centroId !== centroId) continue;
      const ej = ejecuciones.find((e) => e.plantillaId === p.id && e.centroId === centroId) ?? null;
      filas.push({ clave: `${centroId}:${p.id}`, centroId, centro: nombreCentro(ctx, centroId), plantilla: p, ejecucion: ej });
    }
  }
  return { hoy, filas };
}

export async function registrarLista(ctx: Contexto, form: FormData) {
  const plantillaId = String(form.get("plantillaId") ?? "");
  const centroId = String(form.get("centroId") ?? "");
  const observaciones = String(form.get("observaciones") ?? "").trim() || null;
  exigirCentro(ctx, centroId);
  const prisma = await db();
  const plantilla = await prisma.calidadPlantilla.findFirst({
    where: { id: plantillaId, tenantId: ctx.tenant.id, activo: true },
    include: { puntos: { where: { activo: true }, orderBy: { orden: "asc" } } },
  });
  if (!plantilla) throw new ErrorCalidad("La lista no existe");
  if (plantilla.centroId && plantilla.centroId !== centroId) throw new ErrorCalidad("Esa lista no es de este centro");
  const hoy = fechaDeTexto(jornadaHoy());
  const ya = await prisma.calidadEjecucion.findUnique({ where: { plantillaId_centroId_fecha: { plantillaId, centroId, fecha: hoy } } });
  if (ya) throw new ErrorCalidad("Esta lista ya está hecha hoy en este centro");

  const respuestas = plantilla.puntos.map((p) => ({
    puntoId: p.id,
    texto: p.texto,
    correcto: form.get(`ok_${p.id}`) === "on",
    valor: String(form.get(`valor_${p.id}`) ?? "").trim() || null,
  }));
  const faltaValor = plantilla.puntos.find((p) => p.pideValor && !respuestas.find((r) => r.puntoId === p.id)?.valor);
  if (faltaValor) throw new ErrorCalidad(`Falta el dato de «${faltaValor.texto}»`);
  const fallos = respuestas.filter((r) => !r.correcto);
  if (fallos.length > 0 && !observaciones) throw new ErrorCalidad("Hay puntos sin marcar como correctos: explica en observaciones qué pasa y qué se ha hecho");

  await prisma.$transaction(async (tx) => {
    const ej = await tx.calidadEjecucion.create({
      data: {
        tenantId: ctx.tenant.id,
        centroId,
        plantillaId,
        fecha: hoy,
        todoCorrecto: fallos.length === 0,
        observaciones,
        realizadoPor: ctx.usuario.id,
        realizadoNombre: ctx.usuario.nombre,
        respuestas: { create: respuestas },
      },
    });
    if (fallos.length > 0)
      await crearIncidenciaAutomatica(tx, {
        tenantId: ctx.tenant.id,
        centroId,
        tipo: "SEGURIDAD_ALIMENTARIA",
        titulo: `${plantilla.nombre}: ${fallos.length} punto(s) no conformes`,
        descripcion: `${fallos.map((f) => `- ${f.texto}`).join("\n")}\n\nObservaciones: ${observaciones}`,
        origen: "APPCC",
        origenId: ej.id,
        usuarioId: ctx.usuario.id,
        usuarioNombre: ctx.usuario.nombre,
        prioridad: "MEDIA",
      });
  });
}

export async function historialListas(ctx: Contexto, dias = 7) {
  const prisma = await db();
  const desde = fechaDeTexto(textoDeFecha(new Date(fechaDeTexto(jornadaHoy()).getTime() - dias * DIA_MS)));
  const ejecuciones = await prisma.calidadEjecucion.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, fecha: { gte: desde } },
    include: { plantilla: { select: { nombre: true, tipo: true } }, respuestas: true },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
  });
  return ejecuciones.map((e) => ({ ...e, centro: nombreCentro(ctx, e.centroId) }));
}

export async function listarPlantillas(ctx: Contexto) {
  const prisma = await db();
  const ids = ctx.centros.map((c) => c.id);
  const plantillas = await prisma.calidadPlantilla.findMany({
    where: { tenantId: ctx.tenant.id, OR: [{ centroId: null }, { centroId: { in: ids } }] },
    include: { puntos: { orderBy: { orden: "asc" } }, _count: { select: { ejecuciones: true } } },
    orderBy: [{ activo: "desc" }, { orden: "asc" }, { nombre: "asc" }],
  });
  return plantillas.map((p) => ({ ...p, centro: p.centroId ? nombreCentro(ctx, p.centroId) : "Todos los centros" }));
}

export async function crearPlantilla(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaPlantilla.parse(datos);
  if (d.centroId) exigirCentro(ctx, d.centroId);
  const prisma = await db();
  const ultimo = await prisma.calidadPlantilla.aggregate({ where: { tenantId: ctx.tenant.id }, _max: { orden: true } });
  await prisma.calidadPlantilla.create({ data: { tenantId: ctx.tenant.id, centroId: d.centroId ?? null, nombre: d.nombre, tipo: d.tipo, orden: (ultimo._max.orden ?? 0) + 1 } });
}

async function plantillaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const p = await tx.calidadPlantilla.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!p) throw new ErrorCalidad("La lista no existe");
  if (p.centroId) exigirCentro(ctx, p.centroId);
  return p;
}

export async function cambiarActivoPlantilla(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await plantillaDeLaCadena(prisma, ctx, id);
  await prisma.calidadPlantilla.update({ where: { id }, data: { activo } });
}

export async function anadirPunto(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaPunto.parse(datos);
  const prisma = await db();
  await plantillaDeLaCadena(prisma, ctx, d.plantillaId);
  const ultimo = await prisma.calidadPlantillaPunto.aggregate({ where: { plantillaId: d.plantillaId }, _max: { orden: true } });
  await prisma.calidadPlantillaPunto.create({ data: { plantillaId: d.plantillaId, texto: d.texto, pideValor: d.pideValor, orden: (ultimo._max.orden ?? 0) + 1 } });
}

export async function cambiarActivoPunto(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  const p = await prisma.calidadPlantillaPunto.findFirst({ where: { id, plantilla: { tenantId: ctx.tenant.id } } });
  if (!p) throw new ErrorCalidad("El punto no existe");
  await plantillaDeLaCadena(prisma, ctx, p.plantillaId);
  // no se borra: las listas ya hechas lo citan
  await prisma.calidadPlantillaPunto.update({ where: { id }, data: { activo } });
}

// ---------------------------------------------------------------------------
// Temperaturas
// ---------------------------------------------------------------------------

export async function listarEquipos(ctx: Contexto) {
  const prisma = await db();
  const equipos = await prisma.calidadEquipo.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, activo: true },
    include: { registros: { orderBy: { createdAt: "desc" }, take: 10 } },
    orderBy: [{ centroId: "asc" }, { nombre: "asc" }],
  });
  const hace24h = new Date(Date.now() - DIA_MS);
  return equipos.map((e) => {
    const ultimo = e.registros[0] ?? null;
    return {
      ...e,
      minimo: Number(e.minimo),
      maximo: Number(e.maximo),
      centro: nombreCentro(ctx, e.centroId),
      ultimo: ultimo ? { temperatura: Number(ultimo.temperatura), fueraDeRango: ultimo.fueraDeRango, createdAt: ultimo.createdAt, registradoNombre: ultimo.registradoNombre } : null,
      sinRegistroHoy: !ultimo || ultimo.createdAt < hace24h,
      alarmas24h: e.registros.filter((r) => r.fueraDeRango && r.createdAt >= hace24h).length,
    };
  });
}

export async function crearEquipo(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaEquipo.parse(datos);
  exigirCentro(ctx, d.centroId);
  const prisma = await db();
  await prisma.calidadEquipo.create({ data: { tenantId: ctx.tenant.id, centroId: d.centroId, nombre: d.nombre, tipo: d.tipo, minimo: d.minimo, maximo: d.maximo } });
}

export async function desactivarEquipo(ctx: Contexto, id: string) {
  const prisma = await db();
  const e = await prisma.calidadEquipo.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!e) throw new ErrorCalidad("El equipo no existe");
  exigirCentro(ctx, e.centroId);
  await prisma.calidadEquipo.update({ where: { id }, data: { activo: false } });
}

/** Registra una lectura. Fuera de rango → alarma: incidencia automática y aviso a otros módulos. */
export async function registrarTemperatura(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaTemperatura.parse(datos);
  const prisma = await db();
  const e = await prisma.calidadEquipo.findFirst({ where: { id: d.equipoId, tenantId: ctx.tenant.id, activo: true } });
  if (!e) throw new ErrorCalidad("El equipo no existe");
  exigirCentro(ctx, e.centroId);
  const fuera = d.temperatura < Number(e.minimo) || d.temperatura > Number(e.maximo);
  if (fuera && !d.accionCorrectora) throw new ErrorCalidad("Temperatura fuera de rango: escribe la acción correctora (qué se ha hecho)");
  await prisma.$transaction(async (tx) => {
    const r = await tx.calidadTemperatura.create({
      data: {
        tenantId: ctx.tenant.id,
        centroId: e.centroId,
        equipoId: e.id,
        temperatura: d.temperatura,
        fueraDeRango: fuera,
        accionCorrectora: d.accionCorrectora,
        registradoPor: ctx.usuario.id,
        registradoNombre: ctx.usuario.nombre,
      },
    });
    if (fuera) {
      await crearIncidenciaAutomatica(tx, {
        tenantId: ctx.tenant.id,
        centroId: e.centroId,
        tipo: "TEMPERATURA",
        titulo: `${e.nombre}: ${formatoNumero(d.temperatura, 1)} °C fuera de rango`,
        descripcion: `Rango permitido de ${formatoNumero(e.minimo, 1)} a ${formatoNumero(e.maximo, 1)} °C.\nAcción correctora: ${d.accionCorrectora}`,
        origen: "TEMPERATURA",
        origenId: r.id,
        usuarioId: ctx.usuario.id,
        usuarioNombre: ctx.usuario.nombre,
      });
      await emitir(tx, ctx.tenant.id, "calidad.temperatura.fuera_rango", { equipoId: e.id, centroId: e.centroId, temperatura: d.temperatura });
    }
  });
  return fuera;
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export async function responsablesPosibles(ctx: Contexto) {
  const prisma = await db();
  return prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
}

export async function listarIncidencias(ctx: Contexto, estado?: string) {
  const prisma = await db();
  const abiertas = ["ABIERTA", "EN_CURSO"] as const;
  const incidencias = await prisma.calidadIncidencia.findMany({
    where: {
      tenantId: ctx.tenant.id,
      centroId: { in: centrosFiltro(ctx) },
      ...(estado === "PENDIENTES" || !estado ? { estado: { in: [...abiertas] } } : estado === "TODAS" ? {} : { estado: estado as "RESUELTA" | "ANULADA" }),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });
  const hoy = jornadaHoy();
  return incidencias.map((i) => ({
    ...i,
    centro: nombreCentro(ctx, i.centroId),
    vencida: !!i.plazo && (i.estado === "ABIERTA" || i.estado === "EN_CURSO") && textoDeFecha(i.plazo) < hoy,
  }));
}

export async function crearIncidencia(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaIncidencia.parse(datos);
  exigirCentro(ctx, d.centroId);
  const prisma = await db();
  const responsable = d.responsableId ? await prisma.usuario.findFirst({ where: { id: d.responsableId, tenantId: ctx.tenant.id } }) : null;
  await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumero(tx, ctx.tenant.id, "INC");
    const inc = await tx.calidadIncidencia.create({
      data: {
        tenantId: ctx.tenant.id,
        centroId: d.centroId,
        numero,
        tipo: d.tipo,
        titulo: d.titulo,
        descripcion: d.descripcion,
        prioridad: d.prioridad,
        responsableId: responsable?.id,
        responsableNombre: responsable?.nombre,
        plazo: d.plazo ? fechaDeTexto(d.plazo) : null,
        creadoPor: ctx.usuario.id,
        creadoNombre: ctx.usuario.nombre,
      },
    });
    await emitir(tx, ctx.tenant.id, "calidad.incidencia.creada", { id: inc.id, numero, tipo: d.tipo, centroId: d.centroId, origen: "MANUAL" });
  });
}

export async function gestionarIncidencia(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaGestionIncidencia.parse(datos);
  const prisma = await db();
  const inc = await prisma.calidadIncidencia.findFirst({ where: { id: d.id, tenantId: ctx.tenant.id } });
  if (!inc) throw new ErrorCalidad("La incidencia no existe");
  exigirCentro(ctx, inc.centroId);
  if (d.estado === "RESUELTA" && !d.solucion) throw new ErrorCalidad("Para dar por resuelta la incidencia escribe la solución");
  const responsable = d.responsableId ? await prisma.usuario.findFirst({ where: { id: d.responsableId, tenantId: ctx.tenant.id } }) : null;
  await prisma.calidadIncidencia.update({
    where: { id: inc.id },
    data: {
      estado: d.estado,
      prioridad: d.prioridad,
      responsableId: responsable?.id ?? null,
      responsableNombre: responsable?.nombre ?? null,
      plazo: d.plazo ? fechaDeTexto(d.plazo) : null,
      solucion: d.solucion ?? null,
      resueltaEn: d.estado === "RESUELTA" ? (inc.resueltaEn ?? new Date()) : null,
    },
  });
  if (inc.estado !== d.estado)
    await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CalidadIncidencia", entidadId: inc.id, accion: "cambiar estado", antes: { estado: inc.estado }, despues: { estado: d.estado } });
}

// ---------------------------------------------------------------------------
// Mantenimiento preventivo
// ---------------------------------------------------------------------------

export async function listarMantenimiento(ctx: Contexto) {
  const prisma = await db();
  const tareas = await prisma.calidadMantenimiento.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, activo: true },
    include: { hechos: { orderBy: { fecha: "desc" }, take: 5 } },
    orderBy: { proximaVez: "asc" },
  });
  const hoy = jornadaHoy();
  return tareas.map((t) => {
    const prox = textoDeFecha(t.proximaVez);
    const dias = Math.round((fechaDeTexto(prox).getTime() - fechaDeTexto(hoy).getTime()) / DIA_MS);
    return { ...t, centro: nombreCentro(ctx, t.centroId), diasParaProxima: dias, vencida: dias < 0, proxima: prox };
  });
}

export async function crearMantenimiento(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaMantenimiento.parse(datos);
  exigirCentro(ctx, d.centroId);
  const prisma = await db();
  await prisma.calidadMantenimiento.create({
    data: { tenantId: ctx.tenant.id, centroId: d.centroId, nombre: d.nombre, equipo: d.equipo, empresa: d.empresa, cadaDias: d.cadaDias, proximaVez: fechaDeTexto(d.proximaVez), notas: d.notas },
  });
}

export async function marcarMantenimientoHecho(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaHecho.parse(datos);
  const prisma = await db();
  const t = await prisma.calidadMantenimiento.findFirst({ where: { id: d.tareaId, tenantId: ctx.tenant.id } });
  if (!t) throw new ErrorCalidad("La tarea no existe");
  exigirCentro(ctx, t.centroId);
  const fecha = fechaDeTexto(d.fecha);
  await prisma.$transaction(async (tx) => {
    await tx.calidadMantenimientoHecho.create({ data: { tareaId: t.id, fecha, coste: d.coste, nota: d.nota, realizadoPor: ctx.usuario.id, realizadoNombre: ctx.usuario.nombre } });
    await tx.calidadMantenimiento.update({ where: { id: t.id }, data: { ultimaVez: fecha, proximaVez: new Date(fecha.getTime() + t.cadaDias * DIA_MS) } });
    if (d.coste) await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CalidadMantenimiento", entidadId: t.id, accion: "mantenimiento hecho", despues: { fecha: d.fecha, coste: d.coste } });
  });
}

export async function desactivarMantenimiento(ctx: Contexto, id: string) {
  const prisma = await db();
  const t = await prisma.calidadMantenimiento.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!t) throw new ErrorCalidad("La tarea no existe");
  exigirCentro(ctx, t.centroId);
  await prisma.calidadMantenimiento.update({ where: { id }, data: { activo: false } });
}

// ---------------------------------------------------------------------------
// Indicadores para la cabecera de Calidad
// ---------------------------------------------------------------------------

export async function indicadoresCalidad(ctx: Contexto) {
  const prisma = await db();
  const ids = centrosFiltro(ctx);
  const hace24h = new Date(Date.now() - DIA_MS);
  const [incidencias, alarmas, mantenimientoVencido] = await Promise.all([
    prisma.calidadIncidencia.count({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, estado: { in: ["ABIERTA", "EN_CURSO"] } } }),
    prisma.calidadTemperatura.count({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, fueraDeRango: true, createdAt: { gte: hace24h } } }),
    prisma.calidadMantenimiento.count({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, activo: true, proximaVez: { lt: fechaDeTexto(jornadaHoy()) } } }),
  ]);
  return { incidencias, alarmas, mantenimientoVencido };
}
