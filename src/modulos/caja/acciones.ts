"use server";
/** Acciones de servidor de Caja y ventas. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import { ErrorCaja, guardarJornada, crearCierre, validarCierre } from "./servicio";
import { objetoDeFormulario } from "./esquemas";

async function ejecutar(ruta: string, fn: () => Promise<string>) {
  let error: string | null = null;
  let ok = "Guardado.";
  try {
    ok = await fn();
  } catch (e) {
    if (e instanceof ErrorCaja) error = e.message;
    else if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos.";
    else throw e;
  }
  revalidatePath(ruta.split("?")[0]);
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok)}`}`);
}

const volver = (form: FormData, porDefecto: string) => {
  const v = String(form.get("volver") ?? "");
  return v.startsWith("/caja") ? v : porDefecto;
};

export async function accionGuardarJornada(form: FormData) {
  const ctx = await exigir("caja", "caja:ventas:editar");
  await ejecutar(volver(form, "/caja"), async () => {
    await guardarJornada(ctx, objetoDeFormulario(form));
    return "Ventas del día guardadas.";
  });
}

export async function accionCrearCierre(form: FormData) {
  const ctx = await exigir("caja", "caja:cierres:crear");
  await ejecutar(volver(form, "/caja/cierres"), async () => {
    await crearCierre(ctx, objetoDeFormulario(form));
    return "Cierre de caja guardado, pendiente de validar.";
  });
}

export async function accionValidarCierre(form: FormData) {
  const ctx = await exigir("caja", "caja:cierres:validar");
  await ejecutar(volver(form, "/caja/cierres"), async () => {
    await validarCierre(ctx, objetoDeFormulario(form));
    return form.get("decision") === "RECHAZADO" ? "Cierre rechazado: el local tendrá que revisarlo." : "Cierre validado.";
  });
}
