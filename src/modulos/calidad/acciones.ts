"use server";
/** Acciones de servidor de Calidad. La lógica está en servicio.ts. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import * as s from "./servicio";

function datos(form: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

/** Ejecuta, refresca y, si hay error de negocio o de validación, vuelve a la página con el mensaje. */
async function ejecutar(form: FormData, fn: () => Promise<unknown>, aviso?: (r: unknown) => string | null) {
  const volver = String(form.get("volver") || "/calidad").split("?")[0];
  let error: string | null = null;
  let r: unknown;
  try {
    r = await fn();
  } catch (e) {
    if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos";
    else if (e instanceof s.ErrorCalidad) error = e.message;
    else throw e;
  }
  revalidatePath("/calidad", "layout");
  if (error) redirect(`${volver}?error=${encodeURIComponent(error)}`);
  const texto = aviso?.(r);
  if (texto) redirect(`${volver}?aviso=${encodeURIComponent(texto)}`);
}

export async function registrarLista(form: FormData) {
  const ctx = await exigir("calidad", "calidad:registrar");
  await ejecutar(form, () => s.registrarLista(ctx, form));
}

export async function crearPlantilla(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.crearPlantilla(ctx, datos(form)));
}

export async function cambiarActivoPlantilla(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.cambiarActivoPlantilla(ctx, String(form.get("id")), form.get("activo") === "true"));
}

export async function anadirPunto(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.anadirPunto(ctx, datos(form)));
}

export async function cambiarActivoPunto(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.cambiarActivoPunto(ctx, String(form.get("id")), form.get("activo") === "true"));
}

export async function crearEquipo(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.crearEquipo(ctx, datos(form)));
}

export async function desactivarEquipo(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.cambiarActivoEquipo(ctx, String(form.get("id")), false));
}

export async function reactivarEquipo(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.cambiarActivoEquipo(ctx, String(form.get("id")), true), () => "Equipo dado de alta otra vez.");
}

export async function registrarTemperatura(form: FormData) {
  const ctx = await exigir("calidad", "calidad:registrar");
  await ejecutar(form, () => s.registrarTemperatura(ctx, datos(form)), (fuera) => (fuera ? "Temperatura fuera de rango: se ha abierto una incidencia." : null));
}

export async function crearIncidencia(form: FormData) {
  const ctx = await exigir("calidad", "calidad:registrar");
  await ejecutar(form, () => s.crearIncidencia(ctx, datos(form)));
}

export async function gestionarIncidencia(form: FormData) {
  const ctx = await exigir("calidad", "calidad:incidencias:gestionar");
  await ejecutar(form, () => s.gestionarIncidencia(ctx, datos(form)));
}

export async function crearMantenimiento(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.crearMantenimiento(ctx, datos(form)));
}

export async function marcarMantenimientoHecho(form: FormData) {
  const ctx = await exigir("calidad", "calidad:registrar");
  await ejecutar(form, () => s.marcarMantenimientoHecho(ctx, datos(form)));
}

export async function desactivarMantenimiento(form: FormData) {
  const ctx = await exigir("calidad", "calidad:editar");
  await ejecutar(form, () => s.desactivarMantenimiento(ctx, String(form.get("id"))));
}
