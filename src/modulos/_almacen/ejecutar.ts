import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ErrorNegocio } from "@/nucleo/comun-almacen";

/**
 * Envoltorio de las acciones de servidor de Bebidas, Comidas y Proveedores:
 * ejecuta, refresca las rutas y vuelve a la página con ?ok=… o ?error=… (el mensaje se ve en un Aviso).
 * Los errores de negocio y de validación se enseñan; los demás se relanzan.
 */
export function rutaSegura(v: unknown, porDefecto: string): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : porDefecto;
}

export function conParametro(ruta: string, clave: string, valor: string): string {
  const [base, query = ""] = ruta.split("?");
  const p = new URLSearchParams(query);
  p.delete("ok");
  p.delete("error");
  p.set(clave, valor);
  return `${base}?${p.toString()}`;
}

export function mensajeDeError(e: unknown): string | null {
  if (e instanceof ErrorNegocio) return e.message;
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join(" ");
  return null;
}

export async function ejecutar(
  o: { volver: string; revalidar: string[] },
  fn: () => Promise<{ ok?: string; ir?: string } | void>,
): Promise<never> {
  let destino: string;
  try {
    const r = (await fn()) ?? {};
    destino = r.ir ?? (r.ok ? conParametro(o.volver, "ok", r.ok) : o.volver);
  } catch (e) {
    const m = mensajeDeError(e);
    if (m === null) throw e;
    destino = conParametro(o.volver, "error", m);
  }
  for (const r of o.revalidar) revalidatePath(r, "layout");
  redirect(destino);
}
