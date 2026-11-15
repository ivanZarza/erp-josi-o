"use server";
/**
 * Acciones de servidor de Carta y escandallos (Comidas y Bebidas). La lógica está en carta-servicio.ts.
 * El permiso se pide según el área del dato que se toca (lo dice la base, no el formulario):
 * platos y secciones de comida → comidas:carta:editar; de bebidas → bebidas:carta:editar.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { contexto, exigir, type Contexto } from "@/kernel/contexto";
import * as s from "./carta-servicio";

const BASES = ["/comidas/carta", "/bebidas/carta", "/bebidas/bodega"];

function datos(form: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

/** Ejecuta, refresca y, si hay error de negocio o de validación, vuelve a la página con el mensaje. */
async function ejecutar(form: FormData, fn: () => Promise<string | void>) {
  const volver = String(form.get("volver") || BASES[0]);
  let error: string | null = null;
  let destino: string | void = undefined;
  try {
    destino = await fn();
  } catch (e) {
    if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos";
    else if (e instanceof s.ErrorCarta) error = e.message;
    else throw e;
  }
  for (const b of BASES) revalidatePath(b, "layout");
  if (error) redirect(`${volver.split("?")[0]}?error=${encodeURIComponent(error)}`);
  if (destino) redirect(destino);
}

const moduloDe = (area: s.AreaCarta) => (area === "BEBIDAS" ? "bebidas" : "comidas");
const baseDe = (area: s.AreaCarta) => (area === "BEBIDAS" ? "/bebidas/carta" : "/comidas/carta");

/** Permiso de edición del área indicada. */
function editarArea(area: s.AreaCarta) {
  const m = moduloDe(area);
  return exigir(m, `${m}:carta:editar`);
}

/** Permiso de edición según el área del dato guardado en la base. */
async function editarDato(tipo: Parameters<typeof s.areaDe>[1], id: string): Promise<Contexto> {
  const ctx = await contexto();
  const area = (await s.areaDe(ctx, tipo, id)) ?? "COMIDAS";
  return editarArea(area);
}

/** Cartas y objetivos de marca: los editan Comidas o Bebidas (cada uno sus secciones). */
async function editarCualquiera(): Promise<Contexto> {
  const ctx = await contexto();
  if (ctx.tieneModulo("comidas") && ctx.puede("comidas:carta:editar")) return ctx;
  if (ctx.tieneModulo("bebidas") && ctx.puede("bebidas:carta:editar")) return ctx;
  redirect("/sin-permiso");
}

function areaDelFormulario(form: FormData): s.AreaCarta {
  return form.get("area") === "BEBIDAS" ? "BEBIDAS" : "COMIDAS";
}

export async function crearPlato(form: FormData) {
  const area = areaDelFormulario(form);
  const ctx = await editarArea(area);
  await ejecutar(form, async () => `${baseDe(area)}/platos/${await s.crearPlato(ctx, { ...datos(form), area })}`);
}

export async function actualizarPlato(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("id")));
  await ejecutar(form, () => s.actualizarPlato(ctx, String(form.get("id")), datos(form)));
}

export async function cambiarActivoPlato(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("id")));
  await ejecutar(form, () => s.cambiarActivoPlato(ctx, String(form.get("id")), form.get("activo") === "true"));
}

export async function fijarAlergenosPlato(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("id")));
  await ejecutar(form, () =>
    s.fijarAlergenosPlato(ctx, String(form.get("id")), form.getAll("alergenos").map(String), form.getAll("trazas").map(String), form.get("revisados") === "on"),
  );
}

export async function heredarAlergenosPlato(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("id")));
  await ejecutar(form, () => s.heredarAlergenosPlato(ctx, String(form.get("id"))));
}

export async function anadirIngrediente(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("platoId")));
  await ejecutar(form, () => s.anadirIngrediente(ctx, datos(form)));
}

export async function actualizarIngrediente(form: FormData) {
  const ctx = await editarDato("ingrediente", String(form.get("id")));
  await ejecutar(form, () => s.actualizarIngrediente(ctx, datos(form)));
}

export async function quitarIngrediente(form: FormData) {
  const ctx = await editarDato("ingrediente", String(form.get("id")));
  await ejecutar(form, async () => {
    await s.quitarIngrediente(ctx, String(form.get("id")));
  });
}

export async function anadirFormato(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("platoId")));
  await ejecutar(form, () => s.anadirFormato(ctx, datos(form)));
}

export async function actualizarFormato(form: FormData) {
  const ctx = await editarDato("formato", String(form.get("id")));
  await ejecutar(form, () => s.actualizarFormato(ctx, datos(form)));
}

export async function quitarFormato(form: FormData) {
  const ctx = await editarDato("formato", String(form.get("id")));
  await ejecutar(form, () => s.quitarFormato(ctx, String(form.get("id"))));
}

export async function formatoPrincipal(form: FormData) {
  const ctx = await editarDato("formato", String(form.get("id")));
  await ejecutar(form, () => s.formatoPrincipal(ctx, String(form.get("id"))));
}

export async function fijarPrecioCentro(form: FormData) {
  const ctx = await editarDato("plato", String(form.get("platoId")));
  await ejecutar(form, () => s.fijarPrecioCentro(ctx, datos(form)));
}

export async function fijarObjetivoMarca(form: FormData) {
  // el objetivo de cada área lo cambia quien edita la carta de esa área
  const area = areaDelFormulario(form);
  const ctx = await editarArea(area);
  await ejecutar(form, () => s.fijarObjetivoMarca(ctx, { ...datos(form), area }));
}

export async function crearCarta(form: FormData) {
  const ctx = await editarCualquiera();
  await ejecutar(form, async () => {
    await s.crearCarta(ctx, datos(form));
  });
}

export async function actualizarCarta(form: FormData) {
  const ctx = await editarCualquiera();
  await ejecutar(form, () => s.actualizarCarta(ctx, String(form.get("id")), datos(form)));
}

export async function cambiarActivoCarta(form: FormData) {
  // el área es la de la pantalla desde la que se pulsa; tiene que poder editarla (el servicio mira la otra)
  const ctx = await editarArea(areaDelFormulario(form));
  await ejecutar(form, () => s.cambiarActivoCarta(ctx, String(form.get("id")), form.get("activo") === "true", areaDelFormulario(form), form.get("confirmar") === "on"));
}

export async function crearSeccion(form: FormData) {
  const area = areaDelFormulario(form);
  const ctx = await editarArea(area);
  await ejecutar(form, () => s.crearSeccion(ctx, { ...datos(form), area }));
}

export async function quitarSeccion(form: FormData) {
  const ctx = await editarDato("seccion", String(form.get("id")));
  await ejecutar(form, () => s.quitarSeccion(ctx, String(form.get("id")), form.get("confirmar") === "on"));
}

export async function recuperarSeccion(form: FormData) {
  const ctx = await editarDato("seccion", String(form.get("id")));
  await ejecutar(form, () => s.recuperarSeccion(ctx, String(form.get("id"))));
}

export async function anadirPlatoSeccion(form: FormData) {
  const ctx = await editarDato("seccion", String(form.get("seccionId")));
  await ejecutar(form, () => s.anadirPlatoSeccion(ctx, String(form.get("seccionId")), String(form.get("platoId"))));
}

export async function quitarPlatoSeccion(form: FormData) {
  const ctx = await editarDato("linea", String(form.get("id")));
  await ejecutar(form, () => s.quitarPlatoSeccion(ctx, String(form.get("id"))));
}

export async function fijarRecargo(form: FormData) {
  const ctx = await editarArea("COMIDAS");
  await ejecutar(form, () => s.fijarRecargo(ctx, datos(form)));
}

export async function guardarAlergenosProducto(form: FormData) {
  const ctx = await editarArea("COMIDAS");
  await ejecutar(form, () => s.guardarAlergenosProducto(ctx, String(form.get("productoId")), form.getAll("alergenos").map(String), form.getAll("trazas").map(String)));
}
