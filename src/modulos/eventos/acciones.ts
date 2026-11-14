"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import * as s from "./servicio";
import { leerFormulario, esquemaSolicitud, esquemaCambioEstado, esquemaAsignacion, esquemaMenu, esquemaPresupuesto, esquemaEstadoPresupuesto } from "./esquemas";

function mensaje(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof s.ErrorEventos) return e.message;
  console.error(e);
  return "No se ha podido guardar. Inténtalo de nuevo.";
}
const conError = (ruta: string, e: unknown) => `${ruta}${ruta.includes("?") ? "&" : "?"}error=${encodeURIComponent(mensaje(e))}`;

export async function crearSolicitudAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:gestionar");
  let destino: string;
  try {
    const sol = await s.crearSolicitud(ctx, esquemaSolicitud.parse(leerFormulario(form)));
    destino = `/eventos/${sol.id}`;
  } catch (e) {
    destino = conError("/eventos/nueva", e);
  }
  revalidatePath("/eventos");
  redirect(destino);
}

export async function cambiarEstadoAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:gestionar");
  const id = String(form.get("id") ?? "");
  const volver = String(form.get("volver") ?? `/eventos/${id}`);
  let destino = volver;
  try {
    await s.cambiarEstado(ctx, esquemaCambioEstado.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(volver, e);
  }
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
  redirect(destino);
}

export async function asignarLocalAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:gestionar");
  const id = String(form.get("id") ?? "");
  let destino = `/eventos/${id}`;
  try {
    await s.asignarLocal(ctx, esquemaAsignacion.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(destino, e);
  }
  revalidatePath(`/eventos/${id}`);
  redirect(destino);
}

export async function crearPresupuestoAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:gestionar");
  const id = String(form.get("solicitudId") ?? "");
  let destino = `/eventos/${id}`;
  try {
    await s.crearPresupuesto(ctx, esquemaPresupuesto.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(destino, e);
  }
  revalidatePath(`/eventos/${id}`);
  redirect(destino);
}

export async function cambiarEstadoPresupuestoAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:gestionar");
  const solicitudId = String(form.get("solicitudId") ?? "");
  let destino = `/eventos/${solicitudId}`;
  try {
    await s.cambiarEstadoPresupuesto(ctx, esquemaEstadoPresupuesto.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(destino, e);
  }
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${solicitudId}`);
  redirect(destino);
}

export async function guardarMenuAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:menus:editar");
  let destino = "/eventos/menus?ok=Men%C3%BA%20guardado";
  try {
    await s.guardarMenu(ctx, esquemaMenu.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError("/eventos/menus", e);
  }
  revalidatePath("/eventos/menus");
  redirect(destino);
}

export async function activarMenuAccion(form: FormData) {
  const ctx = await exigir("eventos", "eventos:menus:editar");
  await s.activarMenu(ctx, String(form.get("id") ?? ""), form.get("activo") === "1");
  revalidatePath("/eventos/menus");
}
