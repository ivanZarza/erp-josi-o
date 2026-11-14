"use server";
/** Acciones de servidor de Caja y ventas. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import { ErrorNegocio } from "@/nucleo/comun-almacen";
import {
  ErrorCaja,
  ErrorTicket,
  guardarJornada,
  crearCierre,
  validarCierre,
  registrarTicket,
  anadirLineasTicket,
  cobrarTicketManual,
  anularLineaTicket,
  anularTicketManual,
  abrirCaja,
  apuntarMovimientoCaja,
  importarTextoTpv,
} from "./servicio";
import { objetoDeFormulario, ticketDeFormulario } from "./esquemas";

async function ejecutar(ruta: string, fn: () => Promise<string>) {
  let error: string | null = null;
  let ok = "Guardado.";
  try {
    ok = await fn();
  } catch (e) {
    if (e instanceof ErrorCaja || e instanceof ErrorTicket || e instanceof ErrorNegocio) error = e.message;
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

// ---------- tickets ----------

export async function accionRegistrarTicket(form: FormData) {
  const ctx = await exigir("caja", "caja:tickets:crear");
  await ejecutar(volver(form, "/caja/tickets"), async () => {
    const numero = await registrarTicket(ctx, ticketDeFormulario(form));
    return `Ticket ${numero} guardado. El stock de lo pedido ya ha bajado.`;
  });
}

export async function accionAnadirLineas(form: FormData) {
  const ctx = await exigir("caja", "caja:tickets:crear");
  await ejecutar(volver(form, "/caja/tickets"), async () => {
    await anadirLineasTicket(ctx, ticketDeFormulario(form));
    return "Líneas añadidas al ticket.";
  });
}

export async function accionCobrarTicket(form: FormData) {
  const ctx = await exigir("caja", "caja:tickets:crear");
  await ejecutar(volver(form, "/caja/tickets"), async () => {
    await cobrarTicketManual(ctx, objetoDeFormulario(form));
    return "Ticket cobrado.";
  });
}

export async function accionAnularLinea(form: FormData) {
  const ctx = await exigir("caja", "caja:tickets:anular");
  await ejecutar(volver(form, "/caja/tickets"), async () => {
    await anularLineaTicket(ctx, objetoDeFormulario(form));
    return "Línea anulada: su stock ha vuelto al almacén.";
  });
}

export async function accionAnularTicket(form: FormData) {
  const ctx = await exigir("caja", "caja:tickets:anular");
  await ejecutar(volver(form, "/caja/tickets"), async () => {
    await anularTicketManual(ctx, objetoDeFormulario(form));
    return "Ticket anulado: el stock de sus líneas ha vuelto al almacén.";
  });
}

export async function accionImportarTpv(form: FormData) {
  const ctx = await exigir("caja", "caja:tpv:importar");
  const archivo = form.get("archivo");
  if (archivo instanceof File && archivo.size > 0) form.set("texto", await archivo.text());
  await ejecutar(volver(form, "/caja/tickets"), async () => {
    const r = await importarTextoTpv(ctx, objetoDeFormulario(form));
    const partes = [`${r.importados} tickets importados.`];
    if (r.sinEnlace.length) partes.push(`Sin enlazar con la carta (no bajan stock): ${r.sinEnlace.slice(0, 8).join(", ")}${r.sinEnlace.length > 8 ? "…" : ""}.`);
    if (r.avisos.length) partes.push(`Avisos: ${r.avisos.slice(0, 5).join(" ")}${r.avisos.length > 5 ? "…" : ""}`);
    if (r.importados === 0) throw new ErrorCaja(partes.join(" "));
    return partes.join(" ");
  });
}

// ---------- apertura de caja y movimientos ----------

export async function accionAbrirCaja(form: FormData) {
  const ctx = await exigir("caja", "caja:cierres:crear");
  await ejecutar(volver(form, "/caja/cierres"), async () => {
    await abrirCaja(ctx, objetoDeFormulario(form));
    return "Caja abierta con su fondo inicial.";
  });
}

export async function accionMovimientoCaja(form: FormData) {
  const ctx = await exigir("caja", "caja:cierres:crear");
  await ejecutar(volver(form, "/caja/cierres"), async () => {
    await apuntarMovimientoCaja(ctx, objetoDeFormulario(form));
    return "Movimiento de caja apuntado.";
  });
}
