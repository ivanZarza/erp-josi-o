"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/kernel/db";
import { crearSesion, cerrarSesion } from "@/kernel/sesion";

const Datos = z.object({ email: z.string().email().toLowerCase().trim(), password: z.string().min(1) });

export async function entrar(form: FormData) {
  const p = Datos.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!p.success) redirect("/acceso?error=1");
  const prisma = await db();
  // Un correo puede existir en varias cadenas: se entra en la primera activa (el selector de cadena vendrá con Plataforma)
  const usuario = await prisma.usuario.findFirst({ where: { email: p.data.email, activo: true, tenant: { activo: true } } });
  const ok = usuario ? await bcrypt.compare(p.data.password, usuario.passwordHash) : false;
  if (!usuario || !ok) redirect("/acceso?error=1");
  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });
  await crearSesion({ usuarioId: usuario.id, tenantId: usuario.tenantId, centroId: null });
  redirect("/");
}

export async function salir() {
  await cerrarSesion();
  redirect("/acceso");
}
