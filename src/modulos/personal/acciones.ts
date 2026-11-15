"use server";
/**
 * Acciones de servidor del módulo Personal. Cada una: permiso → validación (zod) → servicio.
 * Tras guardar vuelven a la página indicada en el campo oculto «volver» con ?ok= o ?error=.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigir, type Contexto } from "@/kernel/contexto";
import * as s from "./servicio";
import * as e from "./esquemas";

type Resultado = string | { ir: string; ok?: string } | void;

function volver(form: FormData, params: Record<string, string>, ir?: string): never {
  const pedido = ir ?? String(form.get("volver") ?? "/personal");
  const base = pedido.startsWith("/personal") ? pedido : "/personal";
  const url = new URL(base, "http://local");
  url.searchParams.delete("error");
  url.searchParams.delete("ok");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  redirect(`${url.pathname}${url.search}`);
}

async function ejecutar(form: FormData, permiso: string, cuerpo: (ctx: Contexto, datos: Record<string, unknown>) => Promise<Resultado>) {
  const ctx = await exigir("personal", permiso);
  let resultado: Resultado = undefined;
  let error: string | undefined;
  try {
    resultado = await cuerpo(ctx, e.formularioAObjeto(form));
  } catch (err) {
    if (err instanceof s.ErrorPersonal) error = err.message;
    else if (err instanceof z.ZodError) error = e.mensajeError(err);
    else throw err;
  }
  revalidatePath("/personal", "layout");
  if (error) volver(form, { error });
  if (resultado && typeof resultado === "object") volver(form, resultado.ok ? { ok: resultado.ok } : {}, resultado.ir);
  volver(form, resultado ? { ok: resultado } : {});
}

const id = (d: Record<string, unknown>, campo = "id") => {
  const v = d[campo];
  if (typeof v !== "string" || !v) throw new s.ErrorPersonal("Falta el identificador.");
  return v;
};

// ---------- Empleados y contratos ----------

export async function altaEmpleadoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    const alta = e.esquemaAltaEmpleado.parse(d);
    const contrato = alta.conContrato ? e.esquemaContrato.parse({ ...d, fechaInicio: d.fechaInicio || alta.fechaAlta }) : undefined;
    const nuevo = await s.altaEmpleado(ctx, alta, contrato);
    return { ir: `/personal/empleados/${nuevo}`, ok: "Empleado dado de alta." };
  });
}

export async function editarEmpleadoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.editarEmpleado(ctx, id(d, "empleadoId"), e.esquemaEditarEmpleado.parse(d));
    return "Ficha guardada.";
  });
}

export async function bajaEmpleadoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    const r = await s.bajaEmpleado(ctx, id(d, "empleadoId"), e.esquemaBaja.parse(d));
    return `Baja registrada. Sus turnos posteriores se han quitado del cuadrante${r.usuarioDesactivado ? " y su usuario de acceso se ha desactivado" : ""}.`;
  });
}

export async function reactivarEmpleadoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    const { fecha } = e.esquemaBaja.pick({ fecha: true }).parse(d);
    await s.reactivarEmpleado(ctx, id(d, "empleadoId"), fecha);
    return "Empleado reactivado (se conserva su antigüedad). Hazle un contrato nuevo y, si tiene usuario de acceso, actívalo en Ajustes → Usuarios.";
  });
}

export async function crearContratoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.crearContrato(ctx, id(d, "empleadoId"), e.esquemaContrato.parse(d));
    return "Contrato guardado.";
  });
}

export async function finalizarContratoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.finalizarContrato(ctx, id(d, "contratoId"), e.esquemaFinContrato.parse(d));
    return "Contrato finalizado.";
  });
}

// ---------- Cuadrantes ----------

export async function guardarAsignacionAccion(form: FormData) {
  await ejecutar(form, "personal:cuadrantes:editar", async (ctx, d) => {
    await s.guardarAsignacion(ctx, e.esquemaAsignacion.parse(d));
  });
}

export async function quitarAsignacionAccion(form: FormData) {
  await ejecutar(form, "personal:cuadrantes:editar", async (ctx, d) => {
    await s.quitarAsignacion(ctx, id(d, "asignacionId"));
  });
}

export async function copiarSemanaAccion(form: FormData) {
  await ejecutar(form, "personal:cuadrantes:editar", async (ctx, d) => {
    const { centroId, lunes } = e.esquemaSemana.parse(d);
    const r = await s.copiarSemanaAnterior(ctx, centroId, lunes);
    return `Copiados ${r.copiados} turnos${r.saltados ? ` (${r.saltados} no se copian por ausencia, baja o turno ya puesto)` : ""}.`;
  });
}

export async function publicarCuadranteAccion(form: FormData) {
  await ejecutar(form, "personal:cuadrantes:editar", async (ctx, d) => {
    const { centroId, lunes } = e.esquemaSemana.parse(d);
    await s.publicarCuadrante(ctx, centroId, lunes);
    return "Cuadrante publicado.";
  });
}

export async function crearTurnoTipoAccion(form: FormData) {
  await ejecutar(form, "personal:cuadrantes:editar", async (ctx, d) => {
    await s.crearTurnoTipo(ctx, e.esquemaTurnoTipo.parse(d));
    return "Turno tipo creado.";
  });
}

export async function desactivarTurnoTipoAccion(form: FormData) {
  await ejecutar(form, "personal:cuadrantes:editar", async (ctx, d) => {
    await s.desactivarTurnoTipo(ctx, id(d, "turnoId"));
    return "Turno tipo retirado.";
  });
}

// ---------- Fichajes ----------

/** Fichar desde la tableta del local (con PIN) o desde la ficha del empleado (solo con «Corregir fichajes»): lo comprueba el servicio. */
export async function ficharAccion(form: FormData) {
  await ejecutar(form, "personal:fichajes:ver", async (ctx, d) => {
    const f = e.esquemaFichar.parse(d);
    await s.fichar(ctx, { ...f, origen: String(d.origen ?? "TABLETA") === "PANTALLA" ? "PANTALLA" : "TABLETA" });
    return `${e.NOMBRE_FICHAJE[f.tipo]} registrada.`;
  });
}

/** Fichar uno mismo desde el portal (su usuario está vinculado a su ficha). */
export async function ficharPropioAccion(form: FormData) {
  await ejecutar(form, "personal:portal:usar", async (ctx, d) => {
    const yo = await s.empleadoDelUsuario(ctx);
    if (!yo) throw new s.ErrorPersonal("Tu usuario no está vinculado a ninguna ficha de empleado. Pídeselo a RRHH.");
    const f = e.esquemaFichar.parse({ ...d, empleadoId: yo.id });
    await s.fichar(ctx, { ...f, origen: "MOVIL", propio: true });
    return `${e.NOMBRE_FICHAJE[f.tipo]} registrada.`;
  });
}

export async function fichajeManualAccion(form: FormData) {
  await ejecutar(form, "personal:fichajes:corregir", async (ctx, d) => {
    await s.anadirFichajeManual(ctx, e.esquemaFichajeManual.parse(d));
    return "Fichaje añadido.";
  });
}

export async function corregirFichajeAccion(form: FormData) {
  await ejecutar(form, "personal:fichajes:corregir", async (ctx, d) => {
    await s.corregirFichaje(ctx, e.esquemaCorreccion.parse(d));
    return "Fichaje corregido. El original queda anulado en el historial.";
  });
}

export async function anularFichajeAccion(form: FormData) {
  await ejecutar(form, "personal:fichajes:corregir", async (ctx, d) => {
    await s.anularFichaje(ctx, e.esquemaAnularFichaje.parse(d));
    return "Fichaje anulado.";
  });
}

// ---------- Ausencias ----------

export async function pedirAusenciaAccion(form: FormData) {
  await ejecutar(form, "personal:ausencias:ver", async (ctx, d) => {
    const a = await s.pedirAusencia(ctx, e.esquemaAusencia.parse(d));
    return a.estado === "APROBADA" ? "Ausencia registrada y aprobada." : "Ausencia pedida: queda pendiente de aprobar.";
  });
}

export async function pedirAusenciaPropiaAccion(form: FormData) {
  await ejecutar(form, "personal:portal:usar", async (ctx, d) => {
    const yo = await s.empleadoDelUsuario(ctx);
    if (!yo) throw new s.ErrorPersonal("Tu usuario no está vinculado a ninguna ficha de empleado.");
    await s.pedirAusencia(ctx, e.esquemaAusencia.parse({ ...d, empleadoId: yo.id, aprobarYa: false }));
    return "Petición enviada.";
  });
}

export async function resolverAusenciaAccion(form: FormData) {
  await ejecutar(form, "personal:ausencias:aprobar", async (ctx, d) => {
    const r = await s.resolverAusencia(ctx, e.esquemaResolverAusencia.parse(d));
    if (r.choques > 0) return `Aprobada. Ojo: tiene ${r.choques} turno(s) en esas fechas; cámbialos en el cuadrante.`;
    return "Hecho.";
  });
}

// ---------- Formación y documentos ----------

export async function crearCertificadoAccion(form: FormData) {
  await ejecutar(form, "personal:formacion:editar", async (ctx, d) => {
    await s.crearCertificado(ctx, e.esquemaCertificado.parse(d));
    return "Certificado guardado.";
  });
}

export async function desactivarCertificadoAccion(form: FormData) {
  await ejecutar(form, "personal:formacion:editar", async (ctx, d) => {
    await s.desactivarCertificado(ctx, id(d, "certificadoId"));
    return "Certificado retirado.";
  });
}

export async function registrarDocumentoAccion(form: FormData) {
  await ejecutar(form, "personal:documentos:ver", async (ctx, d) => {
    await s.registrarDocumento(ctx, e.esquemaDocumento.parse(d));
    return "Documento registrado (el archivo se subirá cuando esté conectado el almacén de archivos).";
  });
}

export async function desactivarDocumentoAccion(form: FormData) {
  await ejecutar(form, "personal:documentos:ver", async (ctx, d) => {
    await s.desactivarDocumento(ctx, id(d, "documentoId"));
    return "Documento retirado.";
  });
}

// ---------- Ajustes: puestos y convenios ----------

export async function crearPuestoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.crearPuesto(ctx, e.esquemaPuesto.parse(d));
    return "Puesto creado.";
  });
}

export async function cambiarPuestoAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.cambiarActivoPuesto(ctx, id(d, "puestoId"), d.activo === "true");
    return "Puesto actualizado.";
  });
}

export async function crearConvenioAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.crearConvenio(ctx, e.esquemaConvenio.parse(d));
    return "Convenio creado.";
  });
}

export async function crearCategoriaAccion(form: FormData) {
  await ejecutar(form, "personal:plantilla:editar", async (ctx, d) => {
    await s.crearCategoria(ctx, e.esquemaCategoria.parse(d));
    return "Categoría creada.";
  });
}

// ---------- Selección ----------

export async function crearOfertaAccion(form: FormData) {
  await ejecutar(form, "personal:seleccion:editar", async (ctx, d) => {
    await s.crearOferta(ctx, e.esquemaOferta.parse(d));
    return "Oferta publicada.";
  });
}

export async function estadoOfertaAccion(form: FormData) {
  await ejecutar(form, "personal:seleccion:editar", async (ctx, d) => {
    const { ofertaId, estado } = e.esquemaEstadoOferta.parse(d);
    await s.cambiarEstadoOferta(ctx, ofertaId, estado);
    return "Oferta actualizada.";
  });
}

export async function crearCandidatoAccion(form: FormData) {
  await ejecutar(form, "personal:seleccion:editar", async (ctx, d) => {
    await s.crearCandidato(ctx, e.esquemaCandidato.parse(d));
    return "Candidato guardado.";
  });
}

export async function borrarCandidatosCaducadosAccion(form: FormData) {
  await ejecutar(form, "personal:seleccion:editar", async (ctx) => {
    const n = await s.borrarCandidatosCaducados(ctx);
    return n ? `Borrados los datos de ${n} candidatos fuera de plazo.` : "No había candidatos fuera de plazo.";
  });
}

export async function estadoCandidatoAccion(form: FormData) {
  await ejecutar(form, "personal:seleccion:editar", async (ctx, d) => {
    await s.cambiarEstadoCandidato(ctx, e.esquemaEstadoCandidato.parse(d));
    return "Candidato actualizado.";
  });
}

export async function contratarCandidatoAccion(form: FormData) {
  await ejecutar(form, "personal:seleccion:editar", async (ctx, d) => {
    const ctxEdit = ctx.puede("personal:plantilla:editar");
    if (!ctxEdit) throw new s.ErrorPersonal("Para contratar necesitas permiso de altas en la plantilla.");
    const nuevo = await s.contratarCandidato(ctx, e.esquemaContratarCandidato.parse(d));
    return { ir: `/personal/empleados/${nuevo}?pestana=contratos`, ok: "Candidato contratado: completa su ficha y su contrato." };
  });
}

// ---------- Nóminas ----------

export async function calcularNominasAccion(form: FormData) {
  await ejecutar(form, "personal:nominas:gestionar", async (ctx, d) => {
    const { mes, centroId } = e.esquemaNominasMes.parse(d);
    const r = await s.calcularNominasMes(ctx, mes, centroId);
    const partes = [`${r.guardadas} nóminas calculadas en borrador`];
    if (r.bloqueadas) partes.push(`${r.bloqueadas} ya cerradas o pagadas (no se tocan)`);
    if (r.sinContrato) partes.push(`${r.sinContrato} personas sin contrato con salario (sin nómina)`);
    return partes.join(" · ") + ".";
  });
}

export async function estadoNominasAccion(form: FormData) {
  await ejecutar(form, "personal:nominas:gestionar", async (ctx, d) => {
    const datos = e.esquemaEstadoNominas.parse(d);
    const n = await s.cambiarEstadoNominas(ctx, datos);
    return datos.a === "CERRADA" ? `${n} nóminas cerradas.` : `${n} nóminas marcadas como pagadas.`;
  });
}
