import "server-only";
import { hoyMadrid } from "@/kernel/fechas";
import { db } from "@/kernel/db";
import { auditar } from "@/kernel/eventos";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { DatosCliente } from "./esquemas";

/**
 * Lógica del módulo Clientes. Otros módulos (Reservas, Eventos) usan solo lo que se exporta aquí:
 * `buscarOCrearCliente`, `registrarVisita`, `normalizarTelefono`, `resumenCliente`.
 */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
export type TipoConsentimiento = "RESERVA" | "CORREO" | "WHATSAPP";

export class ErrorClientes extends Error {}

/** Teléfono siempre internacional: «600 11 22 33» → «+34600112233». */
export function normalizarTelefono(t?: string | null): string | null {
  if (!t) return null;
  let n = t.replace(/[\s.\-()]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (/^[6789]\d{8}$/.test(n)) n = "+34" + n;
  return n || null;
}

function normalizarEmail(e?: string | null): string | null {
  return e ? e.trim().toLowerCase() : null;
}

export { hoyMadrid } from "@/kernel/fechas";
/** «aaaa-mm-dd» → fecha a medianoche UTC (como se guardan los campos de día). */
const diaBD = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Otro cliente activo con el mismo teléfono o correo (el cliente es único en el grupo). */
async function comprobarRepetido(tx: Tx, tenantId: string, telefono: string | null, email: string | null, excluirId?: string) {
  const otro = { tenantId, activo: true, ...(excluirId ? { id: { not: excluirId } } : {}) };
  if (telefono && (await tx.cliente.findFirst({ where: { ...otro, telefono }, select: { id: true } }))) throw new ErrorClientes("Ya hay un cliente con ese teléfono");
  if (email && (await tx.cliente.findFirst({ where: { ...otro, email }, select: { id: true } }))) throw new ErrorClientes("Ya hay un cliente con ese correo");
}

// ---------------------------------------------------------------- uso desde otros módulos

/**
 * Busca el cliente del grupo por teléfono o correo; si no existe, lo crea.
 * Rellena lo que falte (correo, alergias) y guarda los consentimientos que lleguen.
 */
export async function buscarOCrearCliente(
  tx: Tx,
  tenantId: string,
  datos: { nombre: string; telefono?: string | null; email?: string | null; alergias?: string | null; origen?: string },
  consentimientos: { tipo: TipoConsentimiento; otorgado: boolean; marcaId?: string | null; texto?: string }[] = [],
  usuarioId?: string,
): Promise<string> {
  const telefono = normalizarTelefono(datos.telefono);
  const email = normalizarEmail(datos.email);
  let cliente =
    (telefono ? await tx.cliente.findFirst({ where: { tenantId, telefono, activo: true } }) : null) ??
    (email ? await tx.cliente.findFirst({ where: { tenantId, email, activo: true } }) : null);
  if (!cliente) {
    const [nombre, ...resto] = datos.nombre.trim().split(/\s+/);
    cliente = await tx.cliente.create({
      data: { tenantId, nombre, apellidos: resto.join(" ") || null, telefono, email, alergias: datos.alergias || null, origen: datos.origen ?? "MANUAL" },
    });
  } else {
    const cambios: Prisma.ClienteUpdateInput = {};
    if (!cliente.email && email) cambios.email = email;
    if (!cliente.telefono && telefono) cambios.telefono = telefono;
    if (datos.alergias && !(cliente.alergias ?? "").includes(datos.alergias)) cambios.alergias = [cliente.alergias, datos.alergias].filter(Boolean).join(" · ");
    if (Object.keys(cambios).length) await tx.cliente.update({ where: { id: cliente.id }, data: cambios });
  }
  for (const c of consentimientos)
    await tx.clienteConsentimiento.create({
      data: { tenantId, clienteId: cliente.id, tipo: c.tipo, otorgado: c.otorgado, marcaId: c.marcaId ?? null, texto: c.texto, origen: datos.origen ?? "MANUAL", usuarioId },
    });
  return cliente.id;
}

/** Apunta una visita (al terminar una reserva) y deja preparada la encuesta. */
export async function registrarVisita(
  tx: Tx,
  tenantId: string,
  v: { clienteId: string; centroId: string; fecha: Date; personas: number; reservaId?: string; importe?: number; origen?: string },
) {
  const ya = v.reservaId ? await tx.clienteVisita.findFirst({ where: { tenantId, reservaId: v.reservaId } }) : null;
  if (ya) return ya.id;
  const visita = await tx.clienteVisita.create({
    data: {
      tenantId, clienteId: v.clienteId, centroId: v.centroId, fecha: v.fecha, personas: v.personas, reservaId: v.reservaId,
      importe: v.importe !== undefined ? new Prisma.Decimal(v.importe) : null, origen: v.origen ?? "RESERVA",
    },
  });
  await tx.cliente.update({ where: { id: v.clienteId }, data: { visitas: { increment: 1 }, ultimaVisita: v.fecha } });
  // Encuesta tras la visita: se envía al día siguiente (WhatsApp/correo, pendiente de integración)
  await tx.clienteEncuesta.create({ data: { tenantId, clienteId: v.clienteId, centroId: v.centroId, visitaId: visita.id, reservaId: v.reservaId } });
  return visita.id;
}

/** Resumen corto para mostrar en una reserva o un evento. */
export async function resumenCliente(tenantId: string, clienteId: string) {
  const prisma = await db();
  return prisma.cliente.findFirst({
    where: { tenantId, id: clienteId },
    select: { id: true, nombre: true, apellidos: true, visitas: true, ultimaVisita: true, alergias: true, preferencias: true, etiquetas: true },
  });
}

// ---------------------------------------------------------------- fichas

export async function listarClientes(ctx: Contexto, filtro: { q?: string; etiqueta?: string; take?: number }) {
  const prisma = await db();
  const q = filtro.q?.trim();
  const where: Prisma.ClienteWhereInput = {
    tenantId: ctx.tenant.id,
    activo: true,
    ...(filtro.etiqueta ? { etiquetas: { has: filtro.etiqueta } } : {}),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { apellidos: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { telefono: { contains: q.replace(/\s/g, "") } },
          ],
        }
      : {}),
  };
  const [total, clientes] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: [{ ultimaVisita: { sort: "desc", nulls: "last" } }, { nombre: "asc" }],
      take: filtro.take ?? 100,
      include: { consentimientos: { orderBy: { fecha: "desc" } } },
    }),
  ]);
  return { total, clientes: clientes.map((c) => ({ ...c, vigentes: consentimientosVigentes(c.consentimientos) })) };
}

/** Consentimiento vigente por tipo (para todo el grupo): el último registrado. */
export function consentimientosVigentes(lista: { tipo: string; otorgado: boolean; fecha: Date; marcaId: string | null }[]) {
  const r: Record<TipoConsentimiento, { otorgado: boolean; fecha: Date } | null> = { RESERVA: null, CORREO: null, WHATSAPP: null };
  for (const c of [...lista].sort((a, b) => b.fecha.getTime() - a.fecha.getTime())) {
    if (c.marcaId) continue;
    const t = c.tipo as TipoConsentimiento;
    if (!r[t]) r[t] = { otorgado: c.otorgado, fecha: c.fecha };
  }
  return r;
}

export async function fichaCliente(ctx: Contexto, id: string) {
  const prisma = await db();
  const c = await prisma.cliente.findFirst({
    where: { tenantId: ctx.tenant.id, id },
    include: {
      consentimientos: { orderBy: { fecha: "desc" } },
      visitasLista: { orderBy: { fecha: "desc" }, take: 50 },
      encuestas: { orderBy: { enviadaEn: "desc" }, take: 20 },
    },
  });
  if (!c) return null;
  const centros = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, nombre: true } });
  const nombreCentro = Object.fromEntries(centros.map((x) => [x.id, x.nombre]));
  return { ...c, vigentes: consentimientosVigentes(c.consentimientos), nombreCentro };
}

export async function crearCliente(ctx: Contexto, d: DatosCliente) {
  const prisma = await db();
  const telefono = normalizarTelefono(d.telefono);
  const email = normalizarEmail(d.email);
  await comprobarRepetido(prisma, ctx.tenant.id, telefono, email);
  const c = await prisma.cliente.create({
    data: {
      tenantId: ctx.tenant.id, nombre: d.nombre, apellidos: d.apellidos, telefono, email,
      fechaNacimiento: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
      preferencias: d.preferencias, alergias: d.alergias, notas: d.notas, etiquetas: d.etiquetas,
    },
  });
  return c.id;
}

export async function actualizarCliente(ctx: Contexto, id: string, d: DatosCliente) {
  const prisma = await db();
  const telefono = normalizarTelefono(d.telefono);
  const email = normalizarEmail(d.email);
  await comprobarRepetido(prisma, ctx.tenant.id, telefono, email, id);
  const r = await prisma.cliente.updateMany({
    where: { tenantId: ctx.tenant.id, id, activo: true },
    data: {
      nombre: d.nombre, apellidos: d.apellidos ?? null, telefono, email,
      fechaNacimiento: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
      preferencias: d.preferencias ?? null, alergias: d.alergias ?? null, notas: d.notas ?? null, etiquetas: d.etiquetas,
    },
  });
  if (r.count === 0) throw new ErrorClientes("Cliente no encontrado");
}

export async function cambiarConsentimiento(
  ctx: Contexto,
  d: { clienteId: string; tipo: TipoConsentimiento; otorgado: boolean; marcaId?: string; texto?: string },
) {
  const prisma = await db();
  const c = await prisma.cliente.findFirst({ where: { tenantId: ctx.tenant.id, id: d.clienteId } });
  if (!c) throw new ErrorClientes("Cliente no encontrado");
  await prisma.clienteConsentimiento.create({
    data: { tenantId: ctx.tenant.id, clienteId: c.id, tipo: d.tipo, otorgado: d.otorgado, marcaId: d.marcaId ?? null, texto: d.texto ?? "Cambio registrado en el backoffice", origen: "MANUAL", usuarioId: ctx.usuario.id },
  });
}

/** Derecho de supresión (RGPD): se borran los datos personales y se conserva la historia anónima. */
export async function suprimirDatosCliente(ctx: Contexto, id: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const c = await tx.cliente.findFirst({ where: { tenantId: ctx.tenant.id, id } });
    if (!c) throw new ErrorClientes("Cliente no encontrado");
    await tx.cliente.update({
      where: { id },
      data: { nombre: "Cliente suprimido", apellidos: null, telefono: null, email: null, fechaNacimiento: null, preferencias: null, alergias: null, notas: null, etiquetas: [], activo: false },
    });
    for (const tipo of ["RESERVA", "CORREO", "WHATSAPP"] as const)
      await tx.clienteConsentimiento.create({ data: { tenantId: ctx.tenant.id, clienteId: id, tipo, otorgado: false, texto: "Supresión de datos (RGPD)", usuarioId: ctx.usuario.id } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Cliente", entidadId: id, accion: "suprimir_datos", antes: { nombre: c.nombre, email: c.email, telefono: c.telefono } });
  });
}

/** CSV con separador «;» (Excel en español) y fechas dd/mm/aaaa. */
export async function exportarClientesCsv(ctx: Contexto): Promise<string> {
  const prisma = await db();
  const clientes = await prisma.cliente.findMany({
    where: { tenantId: ctx.tenant.id, activo: true },
    include: { consentimientos: true },
    orderBy: { nombre: "asc" },
  });
  const f = (d: Date | null) => (d ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" }).format(d) : "");
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ["Nombre", "Apellidos", "Teléfono", "Correo", "Etiquetas", "Visitas", "Última visita", "Alergias", "Consentimiento reserva", "Consentimiento correo", "Consentimiento WhatsApp"];
  const filas = clientes.map((c) => {
    const v = consentimientosVigentes(c.consentimientos);
    const si = (x: { otorgado: boolean; fecha: Date } | null) => (x ? `${x.otorgado ? "Sí" : "No"} (${f(x.fecha)})` : "Sin dato");
    return [c.nombre, c.apellidos, c.telefono, c.email, c.etiquetas.join(", "), c.visitas, f(c.ultimaVisita), c.alergias, si(v.RESERVA), si(v.CORREO), si(v.WHATSAPP)].map(celda).join(";");
  });
  // Exportar datos personales queda registrado (RGPD)
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Cliente", entidadId: "*", accion: "exportar_csv", despues: { filas: clientes.length } });
  return "\uFEFF" + [cab.join(";"), ...filas].join("\r\n");
}

export async function etiquetasUsadas(ctx: Contexto): Promise<string[]> {
  const prisma = await db();
  const filas = await prisma.cliente.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, select: { etiquetas: true } });
  return Array.from(new Set(filas.flatMap((f) => f.etiquetas))).sort();
}

// ---------------------------------------------------------------- encuestas

export const NOTA_RESENA = 4; // 4 o 5 → invitar a dejar reseña en Google
export const NOTA_AVISO = 2; // 1 o 2 → aviso a gerencia

export async function listarEncuestas(ctx: Contexto, estado?: string) {
  const prisma = await db();
  const encuestas = await prisma.clienteEncuesta.findMany({
    where: {
      tenantId: ctx.tenant.id,
      centroId: { in: centrosFiltro(ctx) },
      ...(estado ? { estado: estado as "PENDIENTE" | "RESPONDIDA" | "GESTIONADA" } : {}),
    },
    include: { cliente: { select: { id: true, nombre: true, apellidos: true, telefono: true } } },
    orderBy: { enviadaEn: "desc" },
    take: 200,
  });
  const respondidas = await prisma.clienteEncuesta.aggregate({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, nota: { not: null } },
    _avg: { nota: true },
    _count: { nota: true },
  });
  return { encuestas, media: respondidas._avg.nota, respuestas: respondidas._count.nota };
}

export async function responderEncuesta(ctx: Contexto, d: { id: string; nota: number; comentario?: string }) {
  const prisma = await db();
  const e = await prisma.clienteEncuesta.findFirst({ where: { tenantId: ctx.tenant.id, id: d.id, centroId: { in: centrosFiltro(ctx) } } });
  if (!e) throw new ErrorClientes("Encuesta no encontrada");
  await prisma.clienteEncuesta.update({
    where: { id: e.id },
    data: {
      nota: d.nota, comentario: d.comentario ?? null, estado: "RESPONDIDA", respondidaEn: new Date(),
      invitadoResena: d.nota >= NOTA_RESENA, avisoGerencia: d.nota <= NOTA_AVISO,
    },
  });
}

export async function gestionarEncuesta(ctx: Contexto, d: { id: string; seguimiento: string }) {
  const prisma = await db();
  const r = await prisma.clienteEncuesta.updateMany({
    where: { tenantId: ctx.tenant.id, id: d.id, centroId: { in: centrosFiltro(ctx) } },
    data: { seguimiento: d.seguimiento, estado: "GESTIONADA" },
  });
  if (r.count === 0) throw new ErrorClientes("Encuesta no encontrada");
}

// ---------------------------------------------------------------- tarjetas regalo

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

export function generarCodigoTarjeta(prefijo = "GR"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const c = Array.from(bytes, (b) => LETRAS[b % LETRAS.length]).join("");
  return `${prefijo}-${c.slice(0, 4)}-${c.slice(4)}`;
}

export async function listarTarjetas(ctx: Contexto, filtro: { q?: string; estado?: string }) {
  const prisma = await db();
  await caducarTarjetas(ctx.tenant.id);
  return prisma.tarjetaRegalo.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(filtro.estado ? { estado: filtro.estado as "ACTIVA" | "AGOTADA" | "CADUCADA" | "ANULADA" } : {}),
      ...(filtro.q
        ? { OR: [{ codigo: { contains: filtro.q.toUpperCase() } }, { compradorNombre: { contains: filtro.q, mode: "insensitive" } }, { destinatario: { contains: filtro.q, mode: "insensitive" } }] }
        : {}),
    },
    include: { movimientos: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Marca como caducadas las tarjetas activas con la fecha pasada (valen hasta el final del día de caducidad, hora de Madrid). */
async function caducarTarjetas(tenantId: string) {
  const prisma = await db();
  const hoy = diaBD(hoyMadrid());
  await prisma.tarjetaRegalo.updateMany({ where: { tenantId, estado: "ACTIVA", caducidad: { lt: hoy } }, data: { estado: "CADUCADA" } });
}

export async function emitirTarjeta(
  ctx: Contexto,
  d: { importe: number; caducidad: string; marcaId?: string; compradorNombre?: string; compradorEmail?: string; destinatario?: string; mensaje?: string; origen?: string },
) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    let codigo = generarCodigoTarjeta();
    while (await tx.tarjetaRegalo.findFirst({ where: { tenantId: ctx.tenant.id, codigo } })) codigo = generarCodigoTarjeta();
    const importe = new Prisma.Decimal(d.importe);
    const t = await tx.tarjetaRegalo.create({
      data: {
        tenantId: ctx.tenant.id, codigo, importeInicial: importe, saldo: importe, caducidad: diaBD(d.caducidad), marcaId: d.marcaId ?? null,
        compradorNombre: d.compradorNombre, compradorEmail: normalizarEmail(d.compradorEmail), destinatario: d.destinatario, mensaje: d.mensaje, origen: d.origen ?? "MANUAL",
      },
    });
    await tx.tarjetaRegaloMovimiento.create({ data: { tarjetaId: t.id, tipo: "EMISION", importe, saldoTras: importe, usuarioId: ctx.usuario.id } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "TarjetaRegalo", entidadId: t.id, accion: "emitir", despues: { codigo, importe: d.importe } });
    return t;
  });
}

export async function canjearTarjeta(ctx: Contexto, d: { tarjetaId: string; importe: number; centroId?: string; nota?: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const t = await tx.tarjetaRegalo.findFirst({ where: { tenantId: ctx.tenant.id, id: d.tarjetaId } });
    if (!t) throw new ErrorClientes("Tarjeta no encontrada");
    if (t.estado !== "ACTIVA") throw new ErrorClientes("La tarjeta no está activa");
    if (t.caducidad < diaBD(hoyMadrid())) throw new ErrorClientes("La tarjeta está caducada");
    const importe = new Prisma.Decimal(d.importe);
    if (importe.gt(t.saldo)) throw new ErrorClientes("El importe supera el saldo de la tarjeta");
    const centroId = d.centroId ?? ctx.centroActivo?.id ?? null;
    if (centroId && !ctx.centros.some((c) => c.id === centroId)) throw new ErrorClientes("No tienes acceso a ese local");
    if (t.marcaId) {
      // Una tarjeta de una marca solo se canjea en sus locales: hay que decir en cuál
      if (!centroId) throw new ErrorClientes("Esta tarjeta solo vale en los locales de su marca: elige el local donde se canjea");
      const centro = await tx.centro.findFirst({ where: { tenantId: ctx.tenant.id, id: centroId }, select: { marcaId: true } });
      if (centro?.marcaId !== t.marcaId) throw new ErrorClientes("Esta tarjeta solo vale en los locales de su marca");
    }
    const saldo = t.saldo.minus(importe);
    await tx.tarjetaRegalo.update({ where: { id: t.id }, data: { saldo, estado: saldo.lte(0) ? "AGOTADA" : "ACTIVA" } });
    await tx.tarjetaRegaloMovimiento.create({ data: { tarjetaId: t.id, tipo: "CANJE", importe: importe.neg(), saldoTras: saldo, centroId, nota: d.nota, usuarioId: ctx.usuario.id } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "TarjetaRegalo", entidadId: t.id, accion: "canjear", antes: { saldo: t.saldo }, despues: { saldo, centroId } });
  });
}

export async function anularTarjeta(ctx: Contexto, d: { tarjetaId: string; nota: string }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const t = await tx.tarjetaRegalo.findFirst({ where: { tenantId: ctx.tenant.id, id: d.tarjetaId } });
    if (!t) throw new ErrorClientes("Tarjeta no encontrada");
    if (t.estado === "ANULADA") throw new ErrorClientes("La tarjeta ya está anulada");
    await tx.tarjetaRegalo.update({ where: { id: t.id }, data: { estado: "ANULADA", saldo: 0 } });
    await tx.tarjetaRegaloMovimiento.create({ data: { tarjetaId: t.id, tipo: "ANULACION", importe: t.saldo.neg(), saldoTras: 0, nota: d.nota, usuarioId: ctx.usuario.id } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "TarjetaRegalo", entidadId: t.id, accion: "anular", antes: { saldo: t.saldo, estado: t.estado }, despues: { saldo: 0, motivo: d.nota } });
  });
}

/** Marcas de la cadena (núcleo) para los selectores. */
export async function marcasDeLaCadena(tenantId: string) {
  const prisma = await db();
  return prisma.marca.findMany({ where: { tenantId, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
}
