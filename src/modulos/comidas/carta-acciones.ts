"use server";
/** Acciones de servidor de Carta y escandallos. La lógica está en carta-servicio.ts. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import * as s from "./carta-servicio";

const BASE = "/comidas/carta";

function datos(form: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

/** Ejecuta, refresca y, si hay error de negocio o de validación, vuelve a la página con el mensaje. */
async function ejecutar(form: FormData, fn: () => Promise<string | void>) {
  const volver = String(form.get("volver") || BASE);
  let error: string | null = null;
  let destino: string | void = undefined;
  try {
    destino = await fn();
  } catch (e) {
    if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos";
    else if (e instanceof s.ErrorCarta) error = e.message;
    else throw e;
  }
  revalidatePath(BASE, "layout");
  if (error) redirect(`${volver.split("?")[0]}?error=${encodeURIComponent(error)}`);
  if (destino) redirect(destino);
}

const editar = () => exigir("comidas", "comidas:carta:editar");

export async function crearPlato(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, async () => `${BASE}/platos/${await s.crearPlato(ctx, datos(form))}`);
}

export async function actualizarPlato(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.actualizarPlato(ctx, String(form.get("id")), datos(form)));
}

export async function cambiarActivoPlato(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.cambiarActivoPlato(ctx, String(form.get("id")), form.get("activo") === "true"));
}

export async function fijarAlergenosPlato(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () =>
    s.fijarAlergenosPlato(ctx, String(form.get("id")), form.getAll("alergenos").map(String), form.getAll("trazas").map(String), form.get("revisados") === "on"),
  );
}

export async function heredarAlergenosPlato(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.heredarAlergenosPlato(ctx, String(form.get("id"))));
}

export async function anadirIngrediente(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.anadirIngrediente(ctx, datos(form)));
}

export async function actualizarIngrediente(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.actualizarIngrediente(ctx, datos(form)));
}

export async function quitarIngrediente(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, async () => {
    await s.quitarIngrediente(ctx, String(form.get("id")));
  });
}

export async function fijarPrecioCentro(form: FormData) {
  const ctx = await exigir("comidas", "comidas:carta:editar");
  await ejecutar(form, () => s.fijarPrecioCentro(ctx, datos(form)));
}

export async function fijarObjetivoMarca(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.fijarObjetivoMarca(ctx, datos(form)));
}

export async function crearCarta(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, async () => {
    await s.crearCarta(ctx, datos(form));
  });
}

export async function actualizarCarta(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.actualizarCarta(ctx, String(form.get("id")), datos(form)));
}

export async function cambiarActivoCarta(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.cambiarActivoCarta(ctx, String(form.get("id")), form.get("activo") === "true"));
}

export async function crearSeccion(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.crearSeccion(ctx, datos(form)));
}

export async function quitarSeccion(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.quitarSeccion(ctx, String(form.get("id"))));
}

export async function anadirPlatoSeccion(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.anadirPlatoSeccion(ctx, String(form.get("seccionId")), String(form.get("platoId"))));
}

export async function quitarPlatoSeccion(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.quitarPlatoSeccion(ctx, String(form.get("id"))));
}

export async function fijarRecargo(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.fijarRecargo(ctx, datos(form)));
}

export async function guardarAlergenosProducto(form: FormData) {
  const ctx = await editar();
  await ejecutar(form, () => s.guardarAlergenosProducto(ctx, String(form.get("productoId")), form.getAll("alergenos").map(String), form.getAll("trazas").map(String)));
}
