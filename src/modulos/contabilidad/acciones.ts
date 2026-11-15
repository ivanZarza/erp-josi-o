"use server";
/** Acciones de servidor de Contabilidad: validan permiso, llaman al servicio y vuelven a la página. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { exigir } from "@/kernel/contexto";
import {
  ErrorContable,
  crearFacturaRecibida,
  validarFacturaRecibida,
  pagarFacturaRecibida,
  anularFacturaRecibida,
  crearFacturaEmitida,
  marcarEmitidaFuera,
  cobrarFacturaEmitida,
  anularFacturaEmitida,
  crearGasto,
  pagarGasto,
  anularGasto,
  copiarGastosFijos,
  crearCategoriasBasicas,
  crearCategoria,
  alternarCategoria,
} from "./servicio";
import { lineasDeFormulario, objetoDeFormulario } from "./esquemas";

type Resultado = string | { mensaje: string; ruta: string } | void;

/** Ejecuta y vuelve a la página con ?ok= o ?error= (los errores de validación se enseñan en español). */
async function ejecutar(ruta: string, fn: () => Promise<Resultado>) {
  let error: string | null = null;
  let ok = "Guardado.";
  let destino = ruta;
  try {
    const r = await fn();
    if (typeof r === "string") ok = r;
    else if (r) {
      ok = r.mensaje;
      destino = r.ruta;
    }
  } catch (e) {
    if (e instanceof ErrorContable) error = e.message;
    else if (e instanceof ZodError) error = e.issues[0]?.message ?? "Datos no válidos.";
    else throw e;
  }
  const final = error ? ruta : destino;
  revalidatePath(final.split("?")[0]);
  redirect(`${final}${final.includes("?") ? "&" : "?"}${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok)}`}`);
}

const id = (form: FormData) => String(form.get("id") ?? "");
const volver = (form: FormData, porDefecto: string) => {
  const v = String(form.get("volver") ?? "");
  return v.startsWith("/contabilidad") ? v : porDefecto;
};

// ---------- facturas recibidas ----------

export async function accionCrearFacturaRecibida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar("/contabilidad/recibidas/nueva", async () => {
    const f = await crearFacturaRecibida(ctx, { ...objetoDeFormulario(form), lineas: lineasDeFormulario(form) });
    return { ruta: "/contabilidad/recibidas", mensaje: `Factura ${f.numero} registrada, pendiente de revisar.` };
  });
}

export async function accionValidarFacturaRecibida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar(volver(form, "/contabilidad/recibidas"), async () => {
    await validarFacturaRecibida(ctx, id(form));
    return "Factura validada.";
  });
}

export async function accionPagarFacturaRecibida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar(volver(form, "/contabilidad/recibidas"), async () => {
    await pagarFacturaRecibida(ctx, objetoDeFormulario(form));
    return "Factura marcada como pagada.";
  });
}

export async function accionAnularFacturaRecibida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar(volver(form, "/contabilidad/recibidas"), async () => {
    await anularFacturaRecibida(ctx, id(form));
    return "Factura anulada.";
  });
}

// ---------- facturas emitidas (preparadas) ----------

export async function accionCrearFacturaEmitida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar("/contabilidad/emitidas/nueva", async () => {
    const f = await crearFacturaEmitida(ctx, { ...objetoDeFormulario(form), lineas: lineasDeFormulario(form) });
    return { ruta: "/contabilidad/emitidas", mensaje: `Factura preparada (${f.referencia}). Emítela en el programa certificado y apunta aquí su número.` };
  });
}

export async function accionMarcarEmitidaFuera(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar(volver(form, "/contabilidad/emitidas"), async () => {
    await marcarEmitidaFuera(ctx, objetoDeFormulario(form));
    return "Número oficial apuntado.";
  });
}

export async function accionCobrarFacturaEmitida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar(volver(form, "/contabilidad/emitidas"), async () => {
    await cobrarFacturaEmitida(ctx, objetoDeFormulario(form));
    return "Cobro registrado.";
  });
}

export async function accionAnularFacturaEmitida(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  await ejecutar(volver(form, "/contabilidad/emitidas"), async () => {
    await anularFacturaEmitida(ctx, id(form));
    return "Factura preparada anulada.";
  });
}

// ---------- gastos ----------

export async function accionCrearGasto(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  await ejecutar(volver(form, "/contabilidad/gastos"), async () => {
    await crearGasto(ctx, objetoDeFormulario(form));
    return "Gasto registrado.";
  });
}

export async function accionPagarGasto(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  await ejecutar(volver(form, "/contabilidad/gastos"), async () => {
    await pagarGasto(ctx, objetoDeFormulario(form));
    return "Gasto marcado como pagado.";
  });
}

export async function accionAnularGasto(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  await ejecutar(volver(form, "/contabilidad/gastos"), async () => {
    await anularGasto(ctx, id(form));
    return "Gasto anulado.";
  });
}

export async function accionCopiarGastosFijos(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  const mes = String(form.get("mes") ?? "");
  await ejecutar(`/contabilidad/gastos?mes=${mes}`, async () => {
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErrorContable("Mes no válido.");
    const n = await copiarGastosFijos(ctx, mes);
    return n ? `Copiados ${n} gastos fijos del mes anterior.` : "No había gastos fijos nuevos que copiar.";
  });
}

// ---------- categorías ----------

export async function accionCrearCategoriasBasicas() {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  await ejecutar("/contabilidad/categorias", async () => {
    await crearCategoriasBasicas(ctx);
    return "Categorías básicas creadas.";
  });
}

export async function accionCrearCategoria(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  await ejecutar("/contabilidad/categorias", async () => {
    await crearCategoria(ctx, objetoDeFormulario(form));
    return "Categoría creada.";
  });
}

export async function accionAlternarCategoria(form: FormData) {
  const ctx = await exigir("contabilidad", "contabilidad:gastos:editar");
  await ejecutar("/contabilidad/categorias", async () => {
    await alternarCategoria(ctx, id(form));
    return "Categoría actualizada.";
  });
}
