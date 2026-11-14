import "server-only";
import { db } from "@/kernel/db";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { buscarOCrearCliente } from "@/modulos/clientes/servicio";
import type { DatosSolicitud } from "./esquemas";

/**
 * Lógica del módulo Eventos. Exporta para otros módulos:
 * `crearSolicitudDesdeReserva` (Reservas: grupos grandes).
 */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
export type EstadoEvento = "NUEVA" | "CONTACTADA" | "PRESUPUESTO" | "ACEPTADA" | "CELEBRADA" | "PERDIDA";
export type TipoEvento = "EMPRESA" | "CELEBRACION" | "NAVIDAD" | "CATERING" | "OTRO";

export class ErrorEventos extends Error {}

export const NOMBRE_ESTADO: Record<EstadoEvento, string> = {
  NUEVA: "Nueva",
  CONTACTADA: "Contactada",
  PRESUPUESTO: "Presupuesto enviado",
  ACEPTADA: "Aceptada",
  CELEBRADA: "Celebrada",
  PERDIDA: "Perdida",
};
export const NOMBRE_TIPO: Record<TipoEvento, string> = {
  EMPRESA: "Empresa",
  CELEBRACION: "Celebración",
  NAVIDAD: "Navidad",
  CATERING: "Catering",
  OTRO: "Otro",
};
export const ORDEN_EMBUDO: EstadoEvento[] = ["NUEVA", "CONTACTADA", "PRESUPUESTO", "ACEPTADA", "CELEBRADA"];

/** Paso al que se puede ir desde cada estado (además de «perdida»). */
const SIGUIENTES: Record<EstadoEvento, EstadoEvento[]> = {
  NUEVA: ["CONTACTADA", "PRESUPUESTO", "PERDIDA"],
  CONTACTADA: ["PRESUPUESTO", "PERDIDA"],
  PRESUPUESTO: ["ACEPTADA", "CONTACTADA", "PERDIDA"],
  ACEPTADA: ["CELEBRADA", "PERDIDA"],
  CELEBRADA: [],
  PERDIDA: ["NUEVA"],
};
export function estadosSiguientes(e: EstadoEvento) {
  return SIGUIENTES[e];
}

const fechaDia = (s?: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

// ---------------------------------------------------------------- uso desde otros módulos

/** Reservas: una reserva de más de N personas se convierte en solicitud de evento. */
export async function crearSolicitudDesdeReserva(
  tx: Tx,
  tenantId: string,
  d: { nombre: string; telefono?: string | null; email?: string | null; personas: number; fecha: string; hora: string; centroId: string; espacioId?: string | null; clienteId?: string | null; notas?: string | null; reservaId?: string; usuarioId?: string },
) {
  const centro = await tx.centro.findFirst({ where: { tenantId, id: d.centroId }, select: { marcaId: true } });
  const numero = await siguienteNumero(tx, tenantId, "EV");
  const s = await tx.eventoSolicitud.create({
    data: {
      tenantId, numero, tipo: "CELEBRACION", estado: "NUEVA", nombreContacto: d.nombre, telefono: d.telefono, email: d.email,
      clienteId: d.clienteId ?? null, personas: d.personas, fecha: fechaDia(d.fecha), hora: d.hora, centroId: d.centroId,
      marcaId: centro?.marcaId ?? null, espacioId: d.espacioId ?? null, origen: "RESERVA", reservaId: d.reservaId, notas: d.notas,
      historial: { create: { hasta: "NUEVA", nota: `Reserva de ${d.personas} personas pasada a Eventos`, usuarioId: d.usuarioId } },
    },
  });
  await emitir(tx, tenantId, "eventos.solicitud.creada", { solicitudId: s.id, numero, origen: "RESERVA" });
  return s;
}

// ---------------------------------------------------------------- solicitudes

function filtroCentros(ctx: Contexto): Prisma.EventoSolicitudWhereInput {
  // Las solicitudes sin local (recomiéndame) las ve todo el que tenga el módulo.
  return { OR: [{ centroId: null }, { centroId: { in: centrosFiltro(ctx) } }] };
}

export async function crearSolicitud(ctx: Contexto, d: DatosSolicitud) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    let marcaId = d.marcaId ?? null;
    if (d.centroId) {
      const c = await tx.centro.findFirst({ where: { tenantId: ctx.tenant.id, id: d.centroId } });
      if (!c) throw new ErrorEventos("Local no válido");
      marcaId = marcaId ?? c.marcaId;
    }
    const clienteId = ctx.tieneModulo("clientes")
      ? await buscarOCrearCliente(tx, ctx.tenant.id, { nombre: d.nombreContacto, telefono: d.telefono, email: d.email, origen: "EVENTO" }, [], ctx.usuario.id)
      : null;
    const numero = await siguienteNumero(tx, ctx.tenant.id, "EV");
    const s = await tx.eventoSolicitud.create({
      data: {
        tenantId: ctx.tenant.id, numero, tipo: d.tipo, nombreContacto: d.nombreContacto, empresa: d.empresa, telefono: d.telefono, email: d.email,
        clienteId, personas: d.personas, fecha: fechaDia(d.fecha), hora: d.hora,
        presupuestoCliente: d.presupuestoCliente !== undefined ? new Prisma.Decimal(d.presupuestoCliente) : null,
        marcaId, centroId: d.centroId ?? null, espacioId: d.espacioId ?? null, recomiendame: d.recomiendame, origen: d.origen, notas: d.notas,
        responsableId: ctx.usuario.id,
        historial: { create: { hasta: "NUEVA", usuarioId: ctx.usuario.id } },
      },
    });
    await emitir(tx, ctx.tenant.id, "eventos.solicitud.creada", { solicitudId: s.id, numero, origen: d.origen });
    return s;
  });
}

export async function listarSolicitudes(ctx: Contexto, f: { estado?: string; tipo?: string; q?: string }) {
  const prisma = await db();
  const where: Prisma.EventoSolicitudWhereInput = {
    tenantId: ctx.tenant.id,
    AND: [
      filtroCentros(ctx),
      ...(f.q
        ? [{ OR: [{ nombreContacto: { contains: f.q, mode: "insensitive" as const } }, { empresa: { contains: f.q, mode: "insensitive" as const } }, { numero: { contains: f.q.toUpperCase() } }] }]
        : []),
    ],
    ...(f.estado ? { estado: f.estado as EstadoEvento } : {}),
    ...(f.tipo ? { tipo: f.tipo as TipoEvento } : {}),
  };
  const [solicitudes, porEstado] = await Promise.all([
    prisma.eventoSolicitud.findMany({
      where,
      orderBy: [{ fecha: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      include: { presupuestos: { orderBy: { version: "desc" }, take: 1 }, historial: { orderBy: { createdAt: "desc" }, take: 5 } },
      take: 300,
    }),
    prisma.eventoSolicitud.groupBy({ by: ["estado"], where: { tenantId: ctx.tenant.id, ...filtroCentros(ctx) }, _count: { _all: true }, _sum: { personas: true } }),
  ]);
  const embudo = Object.fromEntries(porEstado.map((g) => [g.estado, { n: g._count._all, personas: g._sum.personas ?? 0 }])) as Partial<Record<EstadoEvento, { n: number; personas: number }>>;
  return { solicitudes, embudo };
}

export async function detalleSolicitud(ctx: Contexto, id: string) {
  const prisma = await db();
  return prisma.eventoSolicitud.findFirst({
    where: { tenantId: ctx.tenant.id, id, ...filtroCentros(ctx) },
    include: {
      presupuestos: { orderBy: { version: "desc" }, include: { lineas: { orderBy: { orden: "asc" } } } },
      historial: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function cambiarEstado(ctx: Contexto, d: { id: string; estado: EstadoEvento; nota?: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const s = await tx.eventoSolicitud.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id, ...filtroCentros(ctx) } });
    if (!s) throw new ErrorEventos("Solicitud no encontrada");
    if (!SIGUIENTES[s.estado].includes(d.estado)) throw new ErrorEventos(`No se puede pasar de «${NOMBRE_ESTADO[s.estado]}» a «${NOMBRE_ESTADO[d.estado]}»`);
    await tx.eventoSolicitud.update({
      where: { id: s.id },
      data: { estado: d.estado, motivoPerdida: d.estado === "PERDIDA" ? d.nota : d.estado === "NUEVA" ? null : s.motivoPerdida },
    });
    await tx.eventoHistorial.create({ data: { solicitudId: s.id, desde: s.estado, hasta: d.estado, nota: d.nota, usuarioId: ctx.usuario.id } });
    if (d.estado === "ACEPTADA") await emitir(tx, ctx.tenant.id, "eventos.solicitud.aceptada", { solicitudId: s.id, centroId: s.centroId, espacioId: s.espacioId, fecha: s.fecha, personas: s.personas });
  });
}

export async function asignarLocal(ctx: Contexto, d: { id: string; centroId?: string; espacioId?: string; fecha?: string; hora?: string }) {
  const prisma = await db();
  const s = await prisma.eventoSolicitud.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id, ...filtroCentros(ctx) } });
  if (!s) throw new ErrorEventos("Solicitud no encontrada");
  let marcaId = s.marcaId;
  if (d.centroId) {
    const c = await prisma.centro.findFirst({ where: { tenantId: ctx.tenant.id, id: d.centroId } });
    if (!c) throw new ErrorEventos("Local no válido");
    marcaId = c.marcaId ?? marcaId;
  }
  await prisma.eventoSolicitud.update({
    where: { id: s.id },
    data: {
      centroId: d.centroId ?? null, espacioId: d.espacioId ?? null, marcaId,
      ...(d.fecha ? { fecha: fechaDia(d.fecha) } : {}), ...(d.hora ? { hora: d.hora } : {}),
    },
  });
}

// ---------------------------------------------------------------- presupuestos

/** «Copa de bienvenida;40;6,50» → línea. Admite coma decimal. */
function leerExtras(texto?: string) {
  if (!texto) return [];
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [concepto, cantidad, precio] = l.split(";").map((x) => x.trim());
      const n = Number((cantidad ?? "1").replace(",", "."));
      const p = Number((precio ?? "").replace(",", "."));
      if (!concepto || !Number.isFinite(n) || !Number.isFinite(p)) throw new ErrorEventos(`Línea de extra no válida: «${l}». Formato: concepto;cantidad;precio`);
      return { concepto, cantidad: n, precio: p };
    });
}

export async function crearPresupuesto(ctx: Contexto, d: { solicitudId: string; menuId?: string; personas?: number; extras?: string; condiciones?: string; senal?: number }) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const s = await tx.eventoSolicitud.findFirst({ where: { tenantId: ctx.tenant.id, id: d.solicitudId, ...filtroCentros(ctx) } });
    if (!s) throw new ErrorEventos("Solicitud no encontrada");
    if (s.estado === "CELEBRADA" || s.estado === "PERDIDA") throw new ErrorEventos("La solicitud está cerrada");
    const lineas: { menuId?: string; concepto: string; cantidad: number; precio: number; iva: number }[] = [];
    if (d.menuId) {
      const m = await tx.eventoMenu.findFirst({ where: { tenantId: ctx.tenant.id, id: d.menuId, activo: true } });
      if (!m) throw new ErrorEventos("Menú no encontrado");
      const personas = d.personas ?? s.personas;
      if (personas < m.minPersonas) throw new ErrorEventos(`El menú «${m.nombre}» es para ${m.minPersonas} personas como mínimo`);
      lineas.push({ menuId: m.id, concepto: `Menú «${m.nombre}»`, cantidad: personas, precio: Number(m.precioPersona), iva: Number(m.iva) });
    }
    for (const e of leerExtras(d.extras)) lineas.push({ ...e, iva: 10 });
    if (lineas.length === 0) throw new ErrorEventos("Elige un menú o añade alguna línea");

    const version = (await tx.eventoPresupuesto.count({ where: { solicitudId: s.id } })) + 1;
    const numero = await siguienteNumero(tx, ctx.tenant.id, "PRE");
    const conImporte = lineas.map((l, i) => {
      const importe = new Prisma.Decimal(l.cantidad).times(l.precio).toDecimalPlaces(2);
      return { ...l, importe, orden: i };
    });
    const total = conImporte.reduce((a, l) => a.plus(l.importe), new Prisma.Decimal(0));
    const p = await tx.eventoPresupuesto.create({
      data: {
        tenantId: ctx.tenant.id, solicitudId: s.id, numero, version, condiciones: d.condiciones,
        senal: d.senal !== undefined ? new Prisma.Decimal(d.senal) : null, total, creadoPor: ctx.usuario.id,
        lineas: {
          create: conImporte.map((l) => ({
            menuId: l.menuId, concepto: l.concepto, cantidad: new Prisma.Decimal(l.cantidad), precio: new Prisma.Decimal(l.precio), iva: new Prisma.Decimal(l.iva), importe: l.importe, orden: l.orden,
          })),
        },
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "EventoPresupuesto", entidadId: p.id, accion: "crear", despues: { numero, version, total: total.toString() } });
    return p;
  });
}

export async function cambiarEstadoPresupuesto(ctx: Contexto, d: { id: string; estado: "ENVIADO" | "ACEPTADO" | "RECHAZADO" }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const p = await tx.eventoPresupuesto.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id }, include: { solicitud: true } });
    if (!p) throw new ErrorEventos("Presupuesto no encontrado");
    await tx.eventoPresupuesto.update({
      where: { id: p.id },
      data: { estado: d.estado, ...(d.estado === "ENVIADO" ? { enviadoEn: new Date() } : {}), ...(d.estado === "ACEPTADO" ? { aceptadoEn: new Date() } : {}) },
    });
    const s = p.solicitud;
    const nuevo: EstadoEvento | null =
      d.estado === "ENVIADO" && (s.estado === "NUEVA" || s.estado === "CONTACTADA") ? "PRESUPUESTO" : d.estado === "ACEPTADO" && s.estado !== "CELEBRADA" ? "ACEPTADA" : null;
    if (nuevo && nuevo !== s.estado) {
      await tx.eventoSolicitud.update({ where: { id: s.id }, data: { estado: nuevo } });
      await tx.eventoHistorial.create({ data: { solicitudId: s.id, desde: s.estado, hasta: nuevo, nota: `Presupuesto ${p.numero} ${d.estado === "ENVIADO" ? "enviado" : "aceptado"}`, usuarioId: ctx.usuario.id } });
    }
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "EventoPresupuesto", entidadId: p.id, accion: d.estado.toLowerCase(), antes: { estado: p.estado }, despues: { estado: d.estado } });
  });
}

// ---------------------------------------------------------------- menús de grupo

export async function listarMenus(ctx: Contexto, incluirInactivos = false) {
  const prisma = await db();
  return prisma.eventoMenu.findMany({
    where: { tenantId: ctx.tenant.id, ...(incluirInactivos ? {} : { activo: true }) },
    orderBy: [{ activo: "desc" }, { marcaId: "asc" }, { precioPersona: "asc" }],
  });
}

export async function guardarMenu(ctx: Contexto, d: { id?: string; nombre: string; marcaId?: string; precioPersona: number; iva: number; minPersonas: number; descripcion?: string; platos?: string }) {
  const prisma = await db();
  const datos = {
    nombre: d.nombre, marcaId: d.marcaId ?? null, precioPersona: new Prisma.Decimal(d.precioPersona), iva: new Prisma.Decimal(d.iva),
    minPersonas: d.minPersonas, descripcion: d.descripcion ?? null, platos: d.platos ?? null,
  };
  await prisma.$transaction(async (tx) => {
    if (d.id) {
      const antes = await tx.eventoMenu.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id } });
      if (!antes) throw new ErrorEventos("Menú no encontrado");
      await tx.eventoMenu.update({ where: { id: d.id }, data: datos });
      if (!antes.precioPersona.equals(datos.precioPersona))
        await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "EventoMenu", entidadId: d.id, accion: "cambiar_precio", antes: { precio: antes.precioPersona.toString() }, despues: { precio: datos.precioPersona.toString() } });
    } else {
      const m = await tx.eventoMenu.create({ data: { tenantId: ctx.tenant.id, ...datos } });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "EventoMenu", entidadId: m.id, accion: "crear", despues: { nombre: m.nombre, precio: datos.precioPersona.toString() } });
    }
  });
}

export async function activarMenu(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await prisma.eventoMenu.updateMany({ where: { tenantId: ctx.tenant.id, id }, data: { activo } });
}

// ---------------------------------------------------------------- datos auxiliares

export async function marcasYLocales(ctx: Contexto) {
  const prisma = await db();
  const [marcas, locales] = await Promise.all([
    prisma.marca.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, tipo: "LOCAL", estado: { not: "CERRADO" }, id: { in: ctx.centros.map((c) => c.id) } }, select: { id: true, nombre: true, marcaId: true }, orderBy: { nombre: "asc" } }),
  ]);
  return { marcas, locales };
}
