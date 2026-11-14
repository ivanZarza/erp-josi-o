"use server";
import { revalidatePath } from "next/cache";
import { contexto } from "@/kernel/contexto";
import { crearSesion } from "@/kernel/sesion";

/** Cambia el centro activo del selector (solo entre los centros que el usuario puede ver). */
export async function cambiarCentro(form: FormData) {
  const ctx = await contexto();
  const id = String(form.get("centroId") ?? "");
  const valido = id === "" || ctx.centros.some((c) => c.id === id);
  await crearSesion({ usuarioId: ctx.usuario.id, tenantId: ctx.tenant.id, centroId: valido && id ? id : null });
  revalidatePath("/", "layout");
}
