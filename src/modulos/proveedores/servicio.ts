import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar } from "@/kernel/eventos";
import { ErrorNegocio, type Tx } from "@/nucleo/comun-almacen";
import type { DatosProveedor } from "./esquemas";

/**
 * Proveedores (núcleo, comunes a todas las áreas). Un proveedor no se borra: se desactiva.
 * Los demás módulos pueden usar `listarProveedores` y `proveedoresDeArea`.
 */

export async function listarProveedores(tx: Tx, tenantId: string, filtros: { texto?: string; area?: string; incluirInactivos?: boolean } = {}) {
  const texto = filtros.texto?.trim();
  return tx.proveedor.findMany({
    where: {
      tenantId,
      ...(filtros.incluirInactivos ? {} : { activo: true }),
      ...(filtros.area ? { areas: { has: filtros.area as never } } : {}),
      ...(texto
        ? { OR: [{ nombre: { contains: texto, mode: "insensitive" } }, { contacto: { contains: texto, mode: "insensitive" } }, { cif: { contains: texto, mode: "insensitive" } }] }
        : {}),
    },
    include: { _count: { select: { productos: true, pedidos: true } } },
    orderBy: { nombre: "asc" },
  });
}

/** Proveedores activos que sirven un área (o sin área marcada) para los selectores de compras y productos. */
export async function proveedoresDeArea(tx: Tx, tenantId: string, area: "BEBIDAS" | "COMIDAS") {
  return tx.proveedor.findMany({
    where: { tenantId, activo: true, OR: [{ areas: { has: area } }, { areas: { isEmpty: true } }] },
    select: { id: true, nombre: true, telefono: true, contacto: true },
    orderBy: { nombre: "asc" },
  });
}

function aDatos(d: DatosProveedor) {
  return {
    nombre: d.nombre,
    cif: d.cif ?? null,
    contacto: d.contacto ?? null,
    telefono: d.telefono,
    email: d.email,
    areas: d.areas,
    diasReparto: d.diasReparto ?? null,
    pedidoMinimo: d.pedidoMinimo === null ? null : new Prisma.Decimal(d.pedidoMinimo),
    notas: d.notas ?? null,
  };
}

async function nombreLibre(tx: Tx, tenantId: string, nombre: string, salvo?: string) {
  const otro = await tx.proveedor.findFirst({ where: { tenantId, nombre: { equals: nombre, mode: "insensitive" }, ...(salvo ? { id: { not: salvo } } : {}) } });
  if (otro) throw new ErrorNegocio(`Ya existe un proveedor llamado «${otro.nombre}»${otro.activo ? "" : " (desactivado: actívalo en vez de crear otro)"}.`);
}

export async function crearProveedor(tx: Tx, tenantId: string, usuarioId: string, d: DatosProveedor) {
  await nombreLibre(tx, tenantId, d.nombre);
  const p = await tx.proveedor.create({ data: { tenantId, ...aDatos(d) } });
  await auditar(tx, { tenantId, usuarioId, entidad: "Proveedor", entidadId: p.id, accion: "crear", despues: d });
  return p;
}

export async function editarProveedor(tx: Tx, tenantId: string, usuarioId: string, id: string, d: DatosProveedor) {
  const antes = await tx.proveedor.findFirst({ where: { id, tenantId } });
  if (!antes) throw new ErrorNegocio("El proveedor no existe.");
  await nombreLibre(tx, tenantId, d.nombre, id);
  await tx.proveedor.update({ where: { id }, data: aDatos(d) });
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "Proveedor",
    entidadId: id,
    accion: "editar",
    antes: { nombre: antes.nombre, telefono: antes.telefono, email: antes.email, contacto: antes.contacto, cif: antes.cif },
    despues: d,
  });
}

export async function cambiarActivoProveedor(tx: Tx, tenantId: string, usuarioId: string, id: string, activo: boolean) {
  const p = await tx.proveedor.findFirst({ where: { id, tenantId } });
  if (!p) throw new ErrorNegocio("El proveedor no existe.");
  await tx.proveedor.update({ where: { id }, data: { activo } });
  await auditar(tx, { tenantId, usuarioId, entidad: "Proveedor", entidadId: id, accion: activo ? "activar" : "desactivar" });
}
