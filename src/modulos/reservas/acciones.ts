"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import * as s from "./servicio";
import { ErrorClientes } from "@/modulos/clientes/servicio";
import { ErrorEventos } from "@/modulos/eventos/servicio";
import {
  leerFormulario, esquemaReserva, esquemaCambioEstado, esquemaCambioMesa, esquemaTurno, esquemaAjustes, esquemaEspacio, esquemaMesa, esquemaPosiciones,
} from "./esquemas";

function mensaje(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Datos no válidos";
  if (e instanceof s.ErrorReservas) return e.message;
  if (e instanceof ErrorClientes || e instanceof ErrorEventos) return e.message;
  console.error(e);
  return "No se ha podido guardar. Inténtalo de nuevo.";
}
const conError = (ruta: string, e: unknown) => `${ruta}${ruta.includes("?") ? "&" : "?"}error=${encodeURIComponent(mensaje(e))}`;
const volverA = (form: FormData, porDefecto: string) => {
  const v = String(form.get("volver") ?? "");
  return v.startsWith("/reservas") ? v : porDefecto;
};

export async function crearReservaAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:gestionar");
  let destino: string;
  try {
    const d = esquemaReserva.parse(leerFormulario(form));
    const r = await s.crearReserva(ctx, d);
    destino =
      r.tipo === "evento"
        ? `/eventos/${r.id}?ok=${encodeURIComponent(`Grupo grande: se ha creado la solicitud de evento ${r.numero}`)}`
        : `/reservas?fecha=${d.fecha}&ok=${encodeURIComponent(r.sinMesa ? "Reserva guardada sin mesa: asígnala en sala" : "Reserva guardada")}`;
  } catch (e) {
    destino = conError("/reservas/nueva", e);
  }
  revalidatePath("/reservas");
  redirect(destino);
}

export async function cambiarEstadoReservaAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:gestionar");
  const volver = volverA(form, "/reservas");
  let destino = volver;
  try {
    await s.cambiarEstadoReserva(ctx, esquemaCambioEstado.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(volver, e);
  }
  revalidatePath("/reservas");
  redirect(destino);
}

export async function cambiarMesaAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:gestionar");
  const volver = volverA(form, "/reservas");
  let destino = volver;
  try {
    await s.cambiarMesaReserva(ctx, esquemaCambioMesa.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError(volver, e);
  }
  revalidatePath("/reservas");
  redirect(destino);
}

/** Se llama desde el plano (componente de cliente) con la lista de posiciones cambiadas. */
export async function guardarPosicionesAccion(cambios: { id: string; x: number; y: number }[]): Promise<{ ok: boolean; mensaje: string }> {
  const ctx = await exigir("reservas", "reservas:planos:editar");
  const r = esquemaPosiciones.safeParse(cambios);
  if (!r.success) return { ok: false, mensaje: "Posiciones no válidas" };
  const n = await s.guardarPosiciones(ctx, r.data);
  revalidatePath("/reservas/plano");
  return { ok: true, mensaje: `${n} mesas guardadas` };
}

export async function guardarTurnoAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:reglas:editar");
  let destino = "/reservas/reglas?ok=Turno%20guardado";
  try {
    await s.guardarTurno(ctx, esquemaTurno.parse({ ...leerFormulario(form), dias: form.getAll("dias").map(String) }));
  } catch (e) {
    destino = conError("/reservas/reglas", e);
  }
  revalidatePath("/reservas/reglas");
  redirect(destino);
}

export async function activarTurnoAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:reglas:editar");
  await s.activarTurno(ctx, String(form.get("id") ?? ""), form.get("activo") === "1");
  revalidatePath("/reservas/reglas");
}

export async function guardarAjustesAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:reglas:editar");
  let destino = "/reservas/reglas?ok=Reglas%20guardadas";
  try {
    await s.guardarAjustes(ctx, esquemaAjustes.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError("/reservas/reglas", e);
  }
  revalidatePath("/reservas/reglas");
  redirect(destino);
}

export async function guardarEspacioAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:planos:editar");
  let destino = "/reservas/mesas?ok=Espacio%20guardado";
  try {
    await s.guardarEspacio(ctx, esquemaEspacio.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError("/reservas/mesas", e);
  }
  revalidatePath("/reservas/mesas");
  redirect(destino);
}

export async function guardarMesaAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:planos:editar");
  let destino = "/reservas/mesas?ok=Mesa%20guardada";
  try {
    await s.guardarMesa(ctx, esquemaMesa.parse(leerFormulario(form)));
  } catch (e) {
    destino = conError("/reservas/mesas", e);
  }
  revalidatePath("/reservas/mesas");
  revalidatePath("/reservas/plano");
  redirect(destino);
}

export async function activarMesaAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:planos:editar");
  await s.activarMesa(ctx, String(form.get("id") ?? ""), form.get("activo") === "1");
  revalidatePath("/reservas/mesas");
  revalidatePath("/reservas/plano");
}

export async function activarEspacioAccion(form: FormData) {
  const ctx = await exigir("reservas", "reservas:planos:editar");
  await s.activarEspacio(ctx, String(form.get("id") ?? ""), form.get("activo") === "1");
  revalidatePath("/reservas/mesas");
  revalidatePath("/reservas/plano");
}
