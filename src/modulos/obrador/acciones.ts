"use server";
/** Acciones de servidor del Obrador. La lógica está en servicio.ts. */
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
async function ejecutar(form: FormData, fn: () => Promise<unknown>, destino?: (r: unknown) => string | null) {
  const volver = String(form.get("volver") || "/obrador").split("?")[0];
  let error: string | null = null;
  let resultado: unknown;
  try {
    resultado = await fn();
  } catch (e) {
    if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos";
    else if (e instanceof s.ErrorObrador) error = e.message;
    else throw e;
  }
  revalidatePath("/obrador", "layout");
  if (error) redirect(`${volver}?error=${encodeURIComponent(error)}`);
  const ir = destino?.(resultado);
  if (ir) redirect(ir);
}

export async function crearReceta(form: FormData) {
  const ctx = await exigir("obrador", "obrador:recetas:editar");
  await ejecutar(form, () => s.crearReceta(ctx, datos(form)), (id) => `/obrador/recetas/${id}`);
}

export async function actualizarReceta(form: FormData) {
  const ctx = await exigir("obrador", "obrador:recetas:editar");
  await ejecutar(form, () => s.actualizarReceta(ctx, datos(form), form.getAll("alergenosPropios").map(String)));
}

export async function cambiarActivoReceta(form: FormData) {
  const ctx = await exigir("obrador", "obrador:recetas:editar");
  await ejecutar(form, () => s.cambiarActivoReceta(ctx, String(form.get("id")), form.get("activo") === "true"));
}

export async function anadirLineaReceta(form: FormData) {
  const ctx = await exigir("obrador", "obrador:recetas:editar");
  await ejecutar(form, () => s.anadirLineaReceta(ctx, datos(form)));
}

export async function actualizarLineaReceta(form: FormData) {
  const ctx = await exigir("obrador", "obrador:recetas:editar");
  await ejecutar(form, () => s.actualizarLineaReceta(ctx, datos(form)));
}

export async function quitarLineaReceta(form: FormData) {
  const ctx = await exigir("obrador", "obrador:recetas:editar");
  await ejecutar(form, () => s.quitarLineaReceta(ctx, String(form.get("id"))));
}

export async function planificarOrden(form: FormData) {
  const ctx = await exigir("obrador", "obrador:produccion:crear");
  await ejecutar(form, () => s.planificarOrden(ctx, datos(form)));
}

export async function cerrarOrden(form: FormData) {
  const ctx = await exigir("obrador", "obrador:produccion:crear");
  await ejecutar(form, () => s.cerrarOrden(ctx, datos(form)));
}

export async function anularOrden(form: FormData) {
  const ctx = await exigir("obrador", "obrador:produccion:crear");
  await ejecutar(form, () => s.anularOrden(ctx, String(form.get("id"))));
}

export async function retirarLote(form: FormData) {
  const ctx = await exigir("obrador", "obrador:lotes:retirar");
  await ejecutar(form, () => s.retirarLote(ctx, datos(form)));
}

export async function aplicarTarifa(form: FormData) {
  const ctx = await exigir("obrador", "obrador:tarifas:editar");
  await ejecutar(form, () => s.aplicarTarifa(ctx, datos(form)));
}

export async function recalcularTarifas(form: FormData) {
  const ctx = await exigir("obrador", "obrador:tarifas:editar");
  await ejecutar(form, () => s.recalcularTodasLasTarifas(ctx, String(form.get("obradorId"))));
}
