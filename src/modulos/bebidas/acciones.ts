"use server";
/** Acciones de servidor de Bebidas (ficha de vino). La lógica está en servicio.ts. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import { ErrorBebidas, guardarFichaVino as guardar } from "./servicio";

export async function guardarFichaVino(form: FormData) {
  const ctx = await exigir("bebidas", "bebidas:productos:editar");
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  const volver = String(form.get("volver") || "/bebidas/bodega").split("?")[0];
  let error: string | null = null;
  try {
    await guardar(ctx, o);
  } catch (e) {
    if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos";
    else if (e instanceof ErrorBebidas) error = e.message;
    else throw e;
  }
  revalidatePath("/bebidas", "layout");
  redirect(error ? `${volver}?error=${encodeURIComponent(error)}` : `${volver}?guardado=1`);
}
