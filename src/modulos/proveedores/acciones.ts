"use server";
import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { ejecutar, rutaSegura } from "@/modulos/_almacen/ejecutar";
import { EsquemaProveedor } from "./esquemas";
import { crearProveedor, editarProveedor, cambiarActivoProveedor } from "./servicio";

function leer(form: FormData) {
  return EsquemaProveedor.parse({
    nombre: form.get("nombre") ?? "",
    cif: form.get("cif") ?? "",
    contacto: form.get("contacto") ?? "",
    telefono: form.get("telefono") ?? "",
    email: form.get("email") ?? "",
    areas: form.getAll("areas").map(String),
    diasReparto: form.get("diasReparto") ?? "",
    pedidoMinimo: form.get("pedidoMinimo") ?? "",
    notas: form.get("notas") ?? "",
  });
}

export async function accionCrearProveedor(form: FormData) {
  const ctx = await exigir("proveedores", "proveedores:editar");
  const volver = rutaSegura(form.get("volver"), "/proveedores/nuevo");
  return ejecutar({ volver, revalidar: ["/proveedores"] }, async () => {
    const d = leer(form);
    const prisma = await db();
    const p = await prisma.$transaction((tx) => crearProveedor(tx, ctx.tenant.id, ctx.usuario.id, d));
    return { ir: `/proveedores?ok=${encodeURIComponent(`Proveedor «${p.nombre}» dado de alta.`)}` };
  });
}

export async function accionEditarProveedor(form: FormData) {
  const ctx = await exigir("proveedores", "proveedores:editar");
  const volver = rutaSegura(form.get("volver"), "/proveedores");
  return ejecutar({ volver, revalidar: ["/proveedores", "/bebidas", "/comidas"] }, async () => {
    const d = leer(form);
    const prisma = await db();
    await prisma.$transaction((tx) => editarProveedor(tx, ctx.tenant.id, ctx.usuario.id, String(form.get("id")), d));
    return { ok: `Proveedor «${d.nombre}» guardado.` };
  });
}

export async function accionActivarProveedor(form: FormData) {
  const ctx = await exigir("proveedores", "proveedores:editar");
  const volver = rutaSegura(form.get("volver"), "/proveedores");
  const activo = form.get("activo") === "1";
  return ejecutar({ volver, revalidar: ["/proveedores"] }, async () => {
    const prisma = await db();
    await prisma.$transaction((tx) => cambiarActivoProveedor(tx, ctx.tenant.id, ctx.usuario.id, String(form.get("id")), activo));
    return { ok: activo ? "Proveedor activado." : "Proveedor desactivado. Sigue en el historial de compras." };
  });
}
