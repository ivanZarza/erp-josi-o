"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import * as s from "./servicio";
import {
  leerFormulario, esquemaCliente, esquemaConsentimiento, esquemaRespuestaEncuesta, esquemaSeguimientoEncuesta,
  esquemaTarjeta, esquemaCanje, esquemaAnulacion,
} from "./esquemas";

/** Mensaje legible de un error de validación o de negocio. */
function mensaje(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof s.ErrorClientes) return e.message;
  console.error(e);
  return "No se ha podido guardar. Inténtalo de nuevo.";
}
const conError = (ruta: string, e: unknown) => `${ruta}${ruta.includes("?") ? "&" : "?"}error=${encodeURIComponent(mensaje(e))}`;

export async function crearClienteAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:editar");
  let destino: string;
  try {
    const id = await s.crearCliente(ctx, esquemaCliente.parse(leerFormulario(form)));
    destino = `/clientes/${id}`;
  } catch (e) {
    destino = conError("/clientes/nuevo", e);
  }
  revalidatePath("/clientes");
  redirect(destino);
}

export async function actualizarClienteAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:editar");
  const id = String(form.get("id") ?? "");
  let destino = `/clientes/${id}?ok=guardado`;
  try {
    await s.actualizarCliente(ctx, id, esquemaCliente.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(`/clientes/${id}`, e);
  }
  revalidatePath(`/clientes/${id}`);
  redirect(destino);
}

export async function cambiarConsentimientoAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:editar");
  const d = esquemaConsentimiento.parse(leerFormulario(form));
  await s.cambiarConsentimiento(ctx, d);
  revalidatePath(`/clientes/${d.clienteId}`);
}

export async function suprimirClienteAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:editar");
  const id = String(form.get("id") ?? "");
  if (form.get("confirmar") !== "on") redirect(`/clientes/${id}?error=${encodeURIComponent("Marca la casilla para confirmar la supresión")}`);
  await s.suprimirDatosCliente(ctx, id);
  revalidatePath("/clientes");
  redirect("/clientes?ok=suprimido");
}

export async function responderEncuestaAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:editar");
  let destino = "/clientes/encuestas";
  try {
    await s.responderEncuesta(ctx, esquemaRespuestaEncuesta.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(destino, e);
  }
  revalidatePath("/clientes/encuestas");
  redirect(destino);
}

export async function gestionarEncuestaAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:editar");
  let destino = "/clientes/encuestas";
  try {
    await s.gestionarEncuesta(ctx, esquemaSeguimientoEncuesta.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(destino, e);
  }
  revalidatePath("/clientes/encuestas");
  redirect(destino);
}

export async function emitirTarjetaAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:tarjetas:gestionar");
  let destino: string;
  try {
    const t = await s.emitirTarjeta(ctx, esquemaTarjeta.parse(leerFormulario(form)));
    destino = `/clientes/tarjetas-regalo?ok=${encodeURIComponent(`Tarjeta ${t.codigo} emitida`)}`;
  } catch (e) {
    destino = conError("/clientes/tarjetas-regalo", e);
  }
  revalidatePath("/clientes/tarjetas-regalo");
  redirect(destino);
}

export async function canjearTarjetaAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:tarjetas:gestionar");
  let destino = "/clientes/tarjetas-regalo?ok=Canje%20registrado";
  try {
    await s.canjearTarjeta(ctx, esquemaCanje.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError("/clientes/tarjetas-regalo", e);
  }
  revalidatePath("/clientes/tarjetas-regalo");
  redirect(destino);
}

export async function anularTarjetaAccion(form: FormData) {
  const ctx = await exigir("clientes", "clientes:tarjetas:gestionar");
  let destino = "/clientes/tarjetas-regalo?ok=Tarjeta%20anulada";
  try {
    await s.anularTarjeta(ctx, esquemaAnulacion.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError("/clientes/tarjetas-regalo", e);
  }
  revalidatePath("/clientes/tarjetas-regalo");
  redirect(destino);
}
