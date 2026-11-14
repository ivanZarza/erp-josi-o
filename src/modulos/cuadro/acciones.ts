"use server";
/** Acciones de servidor del Cuadro de mando. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import { ErrorCuadro, guardarPresupuesto, copiarPresupuestoMesAnterior, recalcularIndicadoresMes, mesValido } from "./servicio";
import { objetoDeFormulario } from "./esquemas";

async function ejecutar(ruta: string, fn: () => Promise<string>) {
  let error: string | null = null;
  let ok = "Guardado.";
  try {
    ok = await fn();
  } catch (e) {
    if (e instanceof ErrorCuadro) error = e.message;
    else if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos.";
    else throw e;
  }
  revalidatePath(ruta.split("?")[0]);
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok)}`}`);
}

export async function accionGuardarPresupuesto(form: FormData) {
  const ctx = await exigir("cuadro", "cuadro:presupuestos:editar");
  const mes = mesValido(String(form.get("mes") ?? ""));
  await ejecutar(`/cuadro/presupuestos?mes=${mes}`, async () => {
    await guardarPresupuesto(ctx, objetoDeFormulario(form));
    return "Presupuesto guardado.";
  });
}

export async function accionCopiarPresupuesto(form: FormData) {
  const ctx = await exigir("cuadro", "cuadro:presupuestos:editar");
  const mes = mesValido(String(form.get("mes") ?? ""));
  await ejecutar(`/cuadro/presupuestos?mes=${mes}`, async () => {
    const n = await copiarPresupuestoMesAnterior(ctx, mes);
    return n ? `Copiado el presupuesto del mes anterior a ${n} centros.` : "No había presupuestos del mes anterior que copiar.";
  });
}

export async function accionRecalcularIndicadores(form: FormData) {
  const ctx = await exigir("cuadro", "cuadro:ver");
  const mes = mesValido(String(form.get("mes") ?? ""));
  await ejecutar(`/cuadro/diario?mes=${mes}`, async () => {
    const n = await recalcularIndicadoresMes(ctx, mes);
    return `Indicadores recalculados: ${n} días de centro.`;
  });
}
