import "server-only";
/**
 * Usuarios y permisos (núcleo): usuarios, ámbito de centros, permisos con casillas,
 * módulos contratados por la cadena, huecos de integración y registro de cambios.
 * Ver docs/specs/nucleo/usuarios-permisos.md y docs/specs/general/05_seguridad_permisos_api.md.
 */
import bcrypt from "bcryptjs";
import { db } from "@/kernel/db";
import { auditar } from "@/kernel/eventos";
import { MODULOS, moduloPorId } from "@/kernel/registro";
import { PERMISOS_ROL, tienePermiso, type Rol } from "@/kernel/permisos";
import type { Contexto } from "@/kernel/contexto";
import { Prisma } from "@/generated/prisma/client";
import { ErrorNegocio } from "@/modulos/organizacion/errores";
import { extenderAreaNueva } from "@/modulos/organizacion/servicio";
import type { DatosIntegracion, DatosUsuario } from "./esquemas";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------------------------

export async function listarUsuarios(ctx: Contexto, filtro?: { activos?: boolean }) {
  const prisma = await db();
  return prisma.usuario.findMany({
    where: { tenantId: ctx.tenant.id, ...(filtro?.activos !== undefined ? { activo: filtro.activos } : {}) },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      permisos: true,
      todosCentros: true,
      activo: true,
      ultimoAcceso: true,
      createdAt: true,
      centros: { select: { centro: { select: { id: true, codigo: true, nombre: true } } } },
    },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });
}

export async function obtenerUsuario(ctx: Contexto, id: string) {
  const prisma = await db();
  const u = await prisma.usuario.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { id: true, nombre: true, email: true, rol: true, permisos: true, todosCentros: true, activo: true, centros: { select: { centroId: true } } },
  });
  if (!u) throw new ErrorNegocio("Usuario no encontrado");
  return u;
}

async function comprobarCentros(tx: Tx, tenantId: string, ids: string[]) {
  if (!ids.length) return;
  const n = await tx.centro.count({ where: { tenantId, id: { in: ids } } });
  if (n !== new Set(ids).size) throw new ErrorNegocio("Algún centro no es de esta cadena");
}

/** No se puede quedar la cadena sin ningún administrador activo. */
async function quedaOtroAdmin(tx: Tx, tenantId: string, excluirId: string) {
  return (await tx.usuario.count({ where: { tenantId, rol: "admin", activo: true, id: { not: excluirId } } })) > 0;
}

function fotoUsuario(u: { nombre: string; email: string; rol: string; todosCentros: boolean; activo: boolean }, centros: string[]) {
  return { nombre: u.nombre, email: u.email, rol: u.rol, todosCentros: u.todosCentros, activo: u.activo, centros };
}

export async function crearUsuario(ctx: Contexto, d: DatosUsuario, contrasenaTemporal: string): Promise<string> {
  const prisma = await db();
  const passwordHash = await bcrypt.hash(contrasenaTemporal, 12);
  return prisma.$transaction(async (tx) => {
    if (await tx.usuario.findFirst({ where: { tenantId: ctx.tenant.id, email: d.email } })) throw new ErrorNegocio("Ya hay un usuario con ese correo");
    const centros = d.todosCentros || d.rol === "admin" ? [] : Array.from(new Set(d.centros));
    await comprobarCentros(tx, ctx.tenant.id, centros);
    const u = await tx.usuario.create({
      data: {
        tenantId: ctx.tenant.id,
        nombre: d.nombre,
        email: d.email,
        rol: d.rol,
        passwordHash,
        todosCentros: d.todosCentros || d.rol === "admin",
        centros: { create: centros.map((centroId) => ({ centroId })) },
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Usuario", entidadId: u.id, accion: "crear", despues: fotoUsuario(u, centros) });
    return u.id;
  });
}

export async function actualizarUsuario(ctx: Contexto, id: string, d: DatosUsuario) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { centros: true } });
    if (!u) throw new ErrorNegocio("Usuario no encontrado");
    if (u.rol === "admin" && d.rol !== "admin" && !(await quedaOtroAdmin(tx, ctx.tenant.id, id))) throw new ErrorNegocio("Es el único administrador: nombra otro antes de cambiarle el rol");
    if (u.rol === "admin" && d.rol !== "admin" && id === ctx.usuario.id) throw new ErrorNegocio("No puedes quitarte a ti mismo el rol de administrador");
    const repetido = await tx.usuario.findFirst({ where: { tenantId: ctx.tenant.id, email: d.email, id: { not: id } } });
    if (repetido) throw new ErrorNegocio("Ya hay otro usuario con ese correo");
    const todos = d.todosCentros || d.rol === "admin";
    const centros = todos ? [] : Array.from(new Set(d.centros));
    await comprobarCentros(tx, ctx.tenant.id, centros);
    const antesCentros = u.centros.map((c) => c.centroId);
    await tx.usuarioCentro.deleteMany({ where: { usuarioId: id, centroId: { notIn: centros } } });
    for (const centroId of centros.filter((c) => !antesCentros.includes(c))) await tx.usuarioCentro.create({ data: { usuarioId: id, centroId } });
    const nuevo = await tx.usuario.update({ where: { id }, data: { nombre: d.nombre, email: d.email, rol: d.rol, todosCentros: todos } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Usuario", entidadId: id, accion: "editar", antes: fotoUsuario(u, antesCentros), despues: fotoUsuario(nuevo, centros) });
  });
}

/** Desactivar corta la sesión al momento: kernel/contexto.ts solo deja pasar usuarios activos. */
export async function cambiarActivoUsuario(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!u) throw new ErrorNegocio("Usuario no encontrado");
    if (!activo && id === ctx.usuario.id) throw new ErrorNegocio("No puedes desactivarte a ti mismo");
    if (!activo && u.rol === "admin" && !(await quedaOtroAdmin(tx, ctx.tenant.id, id))) throw new ErrorNegocio("Es el único administrador activo");
    await tx.usuario.update({ where: { id }, data: { activo } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Usuario", entidadId: id, accion: activo ? "activar" : "desactivar", antes: { activo: u.activo }, despues: { activo } });
  });
}

export async function restablecerContrasena(ctx: Contexto, id: string, contrasenaTemporal: string) {
  const prisma = await db();
  const passwordHash = await bcrypt.hash(contrasenaTemporal, 12);
  await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!u) throw new ErrorNegocio("Usuario no encontrado");
    await tx.usuario.update({ where: { id }, data: { passwordHash } });
    // nunca se guarda la contraseña ni su huella en el historial
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Usuario", entidadId: id, accion: "contrasena" });
  });
}

/** Paso «Usuarios» del asistente: quién tiene acceso a un centro (los de «todos los centros» ya lo tienen). */
export async function guardarUsuariosDeCentro(ctx: Contexto, centroId: string, usuarioIds: string[]) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const c = await tx.centro.findFirst({ where: { id: centroId, tenantId: ctx.tenant.id } });
    if (!c) throw new ErrorNegocio("Centro no encontrado");
    const candidatos = await tx.usuario.findMany({ where: { tenantId: ctx.tenant.id, todosCentros: false, rol: { not: "admin" } }, include: { centros: { where: { centroId } } } });
    const antes = candidatos.filter((u) => u.centros.length > 0).map((u) => u.id);
    const despues = candidatos.filter((u) => usuarioIds.includes(u.id)).map((u) => u.id);
    for (const u of candidatos) {
      const tiene = u.centros.length > 0;
      const quiere = despues.includes(u.id);
      if (tiene && !quiere) await tx.usuarioCentro.deleteMany({ where: { usuarioId: u.id, centroId } });
      if (!tiene && quiere) await tx.usuarioCentro.create({ data: { usuarioId: u.id, centroId } });
    }
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Centro", entidadId: centroId, accion: "usuarios", antes, despues });
  });
}

// ---------------------------------------------------------------------------------------------
// Permisos con casillas (generados desde MODULOS; solo módulos contratados)
// ---------------------------------------------------------------------------------------------

/** Catálogo de permisos de los módulos contratados, agrupado por módulo. */
export function catalogoPermisos(ctx: Contexto) {
  return MODULOS.filter((m) => ctx.tieneModulo(m.id) && m.permisos.length > 0).map((m) => ({ id: m.id, nombre: m.nombre, permisos: m.permisos }));
}

function clavesContratadas(ctx: Contexto): Set<string> {
  return new Set(catalogoPermisos(ctx).flatMap((m) => m.permisos.map((p) => p.clave)));
}

/** Estado de cada casilla para un usuario: lo que tiene hoy (guardado o por rol). */
export function permisosEfectivos(ctx: Contexto, rol: string, guardados: string[] | null): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const clave of clavesContratadas(ctx)) r[clave] = tienePermiso(rol, guardados, clave);
  return r;
}

export function permisosDelRol(rol: string): string[] {
  return PERMISOS_ROL[rol as Rol] ?? [];
}

/**
 * Guarda las casillas en Usuario.permisos. `null` = volver a los permisos del rol.
 * Se conservan los permisos guardados de módulos no contratados (desactivar no borra).
 */
export async function guardarPermisos(ctx: Contexto, id: string, marcadas: string[] | null) {
  const validas = clavesContratadas(ctx);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!u) throw new ErrorNegocio("Usuario no encontrado");
    if (u.rol === "admin") throw new ErrorNegocio("El administrador lo puede todo: sus permisos no se cambian aquí");
    const antes = Array.isArray(u.permisos) ? (u.permisos as string[]) : null;
    let despues: string[] | null = null;
    if (marcadas) {
      const desconocida = marcadas.find((c) => !validas.has(c));
      if (desconocida) throw new ErrorNegocio(`Permiso desconocido: ${desconocida}`);
      const deOtros = (antes ?? []).filter((c) => !validas.has(c) && !c.includes("*"));
      despues = Array.from(new Set([...marcadas, ...deOtros])).sort();
    }
    await tx.usuario.update({ where: { id }, data: { permisos: despues ?? Prisma.DbNull } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Usuario", entidadId: id, accion: "permisos", antes: antes ?? { rol: u.rol }, despues: despues ?? { rol: u.rol } });
  });
}

// ---------------------------------------------------------------------------------------------
// Módulos contratados por la cadena
// ---------------------------------------------------------------------------------------------

/** Módulos (no núcleo) que dependen de `id`, directa o indirectamente. */
export function dependientesDe(id: string): string[] {
  const r = new Set<string>();
  const pendientes = [id];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    for (const m of MODULOS) if (m.requiere?.includes(actual) && !r.has(m.id)) {
      r.add(m.id);
      pendientes.push(m.id);
    }
  }
  return Array.from(r);
}

export async function estadoModulos(ctx: Contexto) {
  const prisma = await db();
  const filas = await prisma.tenantModulo.findMany({ where: { tenantId: ctx.tenant.id } });
  return MODULOS.map((m) => {
    const f = filas.find((x) => x.modulo === m.id);
    return {
      manifiesto: m,
      contratado: ctx.tieneModulo(m.id),
      fila: f ?? null,
      requiere: (m.requiere ?? []).filter((r) => moduloPorId(r)),
      dependientes: dependientesDe(m.id),
    };
  });
}

export async function activarModulo(ctx: Contexto, id: string) {
  const man = moduloPorId(id);
  if (!man) throw new ErrorNegocio("Módulo desconocido");
  if (man.nucleo) throw new ErrorNegocio("El núcleo está siempre activo");
  const falta = (man.requiere ?? []).filter((r) => !ctx.tieneModulo(r));
  if (falta.length) throw new ErrorNegocio(`${man.nombre} necesita antes: ${falta.map((r) => moduloPorId(r)?.nombre ?? r).join(", ")}`);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.tenantModulo.findUnique({ where: { tenantId_modulo: { tenantId: ctx.tenant.id, modulo: id } } });
    await tx.tenantModulo.upsert({
      where: { tenantId_modulo: { tenantId: ctx.tenant.id, modulo: id } },
      create: { tenantId: ctx.tenant.id, modulo: id, activo: true },
      update: { activo: true, hasta: null },
    });
    await extenderAreaNueva(tx, ctx.tenant.id, id);
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "TenantModulo", entidadId: id, accion: "activar", antes: antes ? { activo: antes.activo, hasta: antes.hasta } : null, despues: { activo: true } });
  });
}

/**
 * Desactiva un módulo y, si se confirma, los que dependen de él. Nunca borra datos:
 * al reactivarlo, todo vuelve a aparecer.
 */
export async function desactivarModulo(ctx: Contexto, id: string, confirmado: boolean): Promise<string[]> {
  const man = moduloPorId(id);
  if (!man) throw new ErrorNegocio("Módulo desconocido");
  if (man.nucleo) throw new ErrorNegocio("El núcleo no se puede desactivar");
  const arrastrados = dependientesDe(id).filter((d) => ctx.tieneModulo(d) && !moduloPorId(d)?.nucleo);
  if (arrastrados.length && !confirmado)
    throw new ErrorNegocio(`Al desactivar ${man.nombre} también se desactivará: ${arrastrados.map((d) => moduloPorId(d)?.nombre ?? d).join(", ")}. Marca la casilla de confirmación.`);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    for (const modulo of [id, ...arrastrados]) {
      const f = await tx.tenantModulo.findUnique({ where: { tenantId_modulo: { tenantId: ctx.tenant.id, modulo } } });
      if (!f || !f.activo) continue;
      await tx.tenantModulo.update({ where: { id: f.id }, data: { activo: false } });
      await auditar(tx, {
        tenantId: ctx.tenant.id,
        usuarioId: ctx.usuario.id,
        entidad: "TenantModulo",
        entidadId: modulo,
        accion: "desactivar",
        antes: { activo: true },
        despues: { activo: false, porDependencia: modulo !== id ? id : undefined },
      });
    }
  });
  return arrastrados;
}

// ---------------------------------------------------------------------------------------------
// Integraciones (huecos de los manifiestos)
// ---------------------------------------------------------------------------------------------

export async function listarIntegraciones(ctx: Contexto) {
  const prisma = await db();
  const filas = await prisma.integracion.findMany({ where: { tenantId: ctx.tenant.id, centroId: null } });
  return MODULOS.filter((m) => ctx.tieneModulo(m.id) && (m.integraciones?.length ?? 0) > 0).flatMap((m) =>
    m.integraciones!.map((h) => {
      const f = filas.find((x) => x.tipo === h.id) ?? null;
      const config = f?.config && typeof f.config === "object" && !Array.isArray(f.config) ? (f.config as { notas?: string }) : {};
      return { modulo: { id: m.id, nombre: m.nombre }, hueco: h, fila: f, notas: config.notas ?? "" };
    }),
  );
}

/** Apunta proveedor y notas (sin secretos). El estado sigue «no conectada» hasta que exista el conector. */
export async function guardarIntegracion(ctx: Contexto, d: DatosIntegracion) {
  const existe = MODULOS.some((m) => ctx.tieneModulo(m.id) && m.integraciones?.some((h) => h.id === d.tipo));
  if (!existe) throw new ErrorNegocio("Integración no disponible para los módulos contratados");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const f = await tx.integracion.findFirst({ where: { tenantId: ctx.tenant.id, tipo: d.tipo, centroId: null } });
    const config = { notas: d.notas ?? "" } as Prisma.InputJsonValue;
    if (f) await tx.integracion.update({ where: { id: f.id }, data: { proveedor: d.proveedor ?? null, config } });
    else await tx.integracion.create({ data: { tenantId: ctx.tenant.id, tipo: d.tipo, proveedor: d.proveedor ?? null, config } });
    await auditar(tx, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "Integracion",
      entidadId: d.tipo,
      accion: "editar",
      antes: f ? { proveedor: f.proveedor } : null,
      despues: { proveedor: d.proveedor ?? null },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Registro de cambios (Auditoria)
// ---------------------------------------------------------------------------------------------

export async function listarAuditoria(ctx: Contexto, filtro: { entidad?: string; entidadId?: string; limite?: number }) {
  const prisma = await db();
  const filas = await prisma.auditoria.findMany({
    where: { tenantId: ctx.tenant.id, ...(filtro.entidad ? { entidad: filtro.entidad } : {}), ...(filtro.entidadId ? { entidadId: filtro.entidadId } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(filtro.limite ?? 200, 500),
  });
  const ids = Array.from(new Set(filas.map((f) => f.usuarioId).filter((x): x is string => !!x)));
  const usuarios = ids.length ? await prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids } }, select: { id: true, nombre: true } }) : [];
  const entidades = await prisma.auditoria.findMany({ where: { tenantId: ctx.tenant.id }, distinct: ["entidad"], select: { entidad: true }, orderBy: { entidad: "asc" } });
  return {
    filas: filas.map((f) => ({ ...f, usuario: usuarios.find((u) => u.id === f.usuarioId)?.nombre ?? null })),
    entidades: entidades.map((e) => e.entidad),
  };
}
