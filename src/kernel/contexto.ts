import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { db } from "./db";
import { leerSesion } from "./sesion";
import { leerPermisosGuardados, tienePermiso } from "./permisos";
import { MODULOS, moduloPorId } from "./registro";
import type { ManifiestoModulo } from "./tipos-modulo";

export interface CentroResumen {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "LOCAL" | "OBRADOR" | "ALMACEN";
  marca: string | null;
  modulos: string[]; // áreas activas en el centro
}

export interface Contexto {
  usuario: { id: string; nombre: string; email: string; rol: string; permisos: string[] | null };
  tenant: { id: string; nombre: string };
  contratados: string[]; // ids de módulos contratados por la cadena (incluye núcleo)
  centros: CentroResumen[]; // centros que ve el usuario
  centroActivo: CentroResumen | null; // null = «todos mis centros»
  puede: (clave: string) => boolean;
  tieneModulo: (id: string) => boolean;
}

/** Contexto de la petición. Si no hay sesión válida, manda al acceso. */
export const contexto = cache(async (): Promise<Contexto> => {
  const sesion = await leerSesion();
  if (!sesion) redirect("/acceso");
  const prisma = await db();
  const usuario = await prisma.usuario.findFirst({
    where: { id: sesion.usuarioId, tenantId: sesion.tenantId, activo: true },
    include: { tenant: { include: { modulos: true } }, centros: true },
  });
  if (!usuario || !usuario.tenant.activo) redirect("/acceso");

  const contratadosBD = usuario.tenant.modulos.filter((m) => m.activo && (!m.hasta || m.hasta > new Date())).map((m) => m.modulo);
  const nucleo = MODULOS.filter((m) => m.nucleo && (!m.visibleSi || m.visibleSi.some((v) => contratadosBD.includes(v)))).map((m) => m.id);
  const contratados = Array.from(new Set([...nucleo, ...contratadosBD]));

  const centrosBD = await prisma.centro.findMany({
    where: {
      tenantId: usuario.tenantId,
      // Los locales en preparación no salen en el selector ni en pedidos hasta abrirse (se gestionan en Organización)
      estado: { notIn: ["CERRADO", "PREPARACION"] },
      ...(usuario.todosCentros || usuario.rol === "admin" ? {} : { id: { in: usuario.centros.map((c) => c.centroId) } }),
    },
    include: { marca: true, modulos: true },
    orderBy: [{ tipo: "desc" }, { nombre: "asc" }],
  });
  const centros: CentroResumen[] = centrosBD.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    tipo: c.tipo,
    marca: c.marca?.nombre ?? null,
    // si el centro no tiene áreas propias configuradas, hereda todas las contratadas que encajen con su tipo
    modulos:
      c.modulos.length > 0
        ? c.modulos.filter((m) => m.activo).map((m) => m.modulo)
        : contratados.filter((id) => {
            const man = moduloPorId(id);
            return !man?.tiposCentro || man.tiposCentro.includes(c.tipo);
          }),
  }));
  const centroActivo = centros.find((c) => c.id === sesion.centroId) ?? (centros.length === 1 ? centros[0] : null);

  // lista (aunque esté vacía) = permisos a medida; null = los de su rol (kernel/permisos.ts)
  const permisos = leerPermisosGuardados(usuario.permisos);
  return {
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, permisos },
    tenant: { id: usuario.tenant.id, nombre: usuario.tenant.nombre },
    contratados,
    centros,
    centroActivo,
    puede: (clave) => tienePermiso(usuario.rol, permisos, clave),
    tieneModulo: (id) => contratados.includes(id),
  };
});

/** Para el principio de cada página o acción de un módulo: módulo contratado + permiso. */
export async function exigir(moduloId: string, permiso?: string): Promise<Contexto> {
  const ctx = await contexto();
  if (!ctx.tieneModulo(moduloId)) notFound();
  if (permiso && !ctx.puede(permiso)) redirect("/sin-permiso");
  return ctx;
}

/** Ids de centros sobre los que se filtran los datos (el activo, o todos los del usuario). */
export function centrosFiltro(ctx: Contexto): string[] {
  return ctx.centroActivo ? [ctx.centroActivo.id] : ctx.centros.map((c) => c.id);
}

/** Módulos que ve el usuario en el menú (contratados + con algún permiso). */
export function modulosVisibles(ctx: Contexto): ManifiestoModulo[] {
  return MODULOS.filter((m) => ctx.tieneModulo(m.id))
    .map((m) => ({ ...m, menu: m.menu.filter((e) => ctx.puede(e.permiso)) }))
    .filter((m) => m.menu.length > 0);
}
