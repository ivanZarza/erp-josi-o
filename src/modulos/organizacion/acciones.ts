"use server";
/**
 * Acciones de servidor de Organización. Cada una: exigir permiso → validar con zod → servicio →
 * revalidar y volver. Los errores vuelven a la página como ?error=… (sin datos personales).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { guardarUsuariosDeCentro } from "@/modulos/usuarios/servicio";
import { casilla, conAviso, conError, ErrorNegocio, lista, mensajeError, texto } from "./errores";
import { CambioEstado, DatosCentro, DatosMarca, DatosSociedad, DIAS, HorarioCentro, leerEspacios, NuevoLocal, PlantillaMarca } from "./esquemas";
import * as servicio from "./servicio";

/** Solo se vuelve a rutas propias (evita redirecciones a otros sitios). */
function rutaVuelta(form: FormData, porDefecto: string): string {
  const v = texto(form, "volver");
  return v && /^\/(organizacion|ajustes)(\/|$|\?)/.test(v) ? v : porDefecto;
}

async function intentar(rutaError: string, fn: () => Promise<void>) {
  let error: string | null = null;
  try {
    await fn();
  } catch (e) {
    error = mensajeError(e);
  }
  if (error) redirect(conError(rutaError, error));
}

function leerDireccion(form: FormData) {
  const edificioId = texto(form, "edificioId");
  return edificioId
    ? { edificioId }
    : { direccion: texto(form, "direccion"), cp: texto(form, "cp"), ciudad: texto(form, "ciudad"), provincia: texto(form, "provincia"), comunidad: texto(form, "comunidad") };
}

// ----------------------------------- Asistente de apertura -----------------------------------

export async function crearLocalAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:centros:abrir");
  let id = "";
  await intentar("/organizacion/nuevo-local", async () => {
    const razonSocial = texto(form, "sociedadRazon");
    const cifNuevo = texto(form, "sociedadCif");
    // sociedad nueva: si se escribe uno de los dos datos, hacen falta los dos (nada se ignora en silencio)
    if (!texto(form, "sociedadId") && (razonSocial || cifNuevo)) {
      if (!razonSocial) throw new ErrorNegocio("Has escrito un CIF pero falta la razón social de la sociedad nueva");
      if (!cifNuevo) throw new ErrorNegocio("Falta el CIF de la sociedad nueva (escribe «PENDIENTE» si aún no lo sabes)");
    }
    const datos = NuevoLocal.parse({
      marcaId: texto(form, "marcaId"),
      marcaNueva: texto(form, "marcaId") ? undefined : texto(form, "marcaNueva"),
      sociedadId: texto(form, "sociedadId"),
      sociedadNueva: !texto(form, "sociedadId") && razonSocial ? { razonSocial, cif: cifNuevo ?? "" } : undefined,
      origen: texto(form, "origen") ?? "vacio",
      centroOrigenId: texto(form, "centroOrigenId"),
      codigo: texto(form, "codigo") ?? "",
      nombre: texto(form, "nombre") ?? "",
      tipo: texto(form, "tipo") ?? "LOCAL",
      telefono: texto(form, "telefono"),
      email: texto(form, "email"),
      aperturaEn: texto(form, "aperturaEn"),
      direccion: leerDireccion(form),
    });
    id = await servicio.crearLocal(ctx, datos);
  });
  revalidatePath("/organizacion");
  redirect(`/organizacion/nuevo-local/${id}?paso=horario`);
}

export async function copiarProductosAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:centros:abrir");
  const id = texto(form, "centroId") ?? "";
  const volver = rutaVuelta(form, `/organizacion/nuevo-local/${id}?paso=productos`);
  let n = 0;
  await intentar(volver, async () => {
    const origen = texto(form, "origenId");
    if (!origen) throw new ErrorNegocio("Elige el local del que copiar");
    n = await servicio.copiarProductosDe(ctx, id, origen);
  });
  revalidatePath(volver);
  redirect(conAviso(volver, `Copiados los ajustes de ${n} productos`));
}

export async function guardarUsuariosCentroAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:centros:abrir");
  if (!ctx.puede("ajustes:usuarios:editar")) redirect("/sin-permiso");
  const id = texto(form, "centroId") ?? "";
  const volver = rutaVuelta(form, `/organizacion/nuevo-local/${id}?paso=usuarios`);
  await intentar(volver, () => guardarUsuariosDeCentro(ctx, id, lista(form, "usuarios")));
  revalidatePath(volver);
  redirect(conAviso(volver, "Usuarios guardados"));
}

// ----------------------------------------- Centros -----------------------------------------

export async function guardarDatosCentroAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:centros:editar");
  const id = texto(form, "centroId") ?? "";
  const volver = rutaVuelta(form, `/organizacion/centros/${id}`);
  await intentar(volver, async () => {
    const d = DatosCentro.parse({
      codigo: texto(form, "codigo") ?? "",
      nombre: texto(form, "nombre") ?? "",
      tipo: texto(form, "tipo") ?? "LOCAL",
      marcaId: texto(form, "marcaId"),
      sociedadId: texto(form, "sociedadId"),
      telefono: texto(form, "telefono"),
      email: texto(form, "email"),
      horaCorte: texto(form, "horaCorte") ?? "05:00",
      aperturaEn: texto(form, "aperturaEn"),
      direccion: leerDireccion(form),
    });
    await servicio.actualizarCentro(ctx, id, d);
  });
  revalidatePath("/organizacion", "layout");
  redirect(conAviso(volver, "Datos guardados"));
}

export async function guardarHorarioAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:centros:editar");
  const id = texto(form, "centroId") ?? "";
  const volver = rutaVuelta(form, `/organizacion/centros/${id}?pestana=horario`);
  await intentar(volver, async () => {
    const horario = Object.fromEntries(DIAS.map((d) => [d, texto(form, `dia-${d}`) ?? ""]));
    const h = HorarioCentro.parse({
      horaCorte: texto(form, "horaCorte") ?? "05:00",
      horario,
      festivos: texto(form, "festivos") ?? "",
      espacios: leerEspacios(texto(form, "espacios") ?? ""),
      servicios: lista(form, "servicios"),
    });
    await servicio.guardarHorario(ctx, id, h);
  });
  revalidatePath("/organizacion", "layout");
  redirect(conAviso(volver, "Horario guardado"));
}

export async function guardarAreasAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:centros:editar");
  if (!ctx.puede("ajustes:modulos:editar") && !ctx.puede("organizacion:centros:abrir")) redirect("/sin-permiso");
  const id = texto(form, "centroId") ?? "";
  const volver = rutaVuelta(form, `/organizacion/centros/${id}?pestana=areas`);
  await intentar(volver, () => servicio.guardarAreasCentro(ctx, id, lista(form, "areas")));
  revalidatePath("/", "layout");
  redirect(conAviso(volver, "Áreas guardadas"));
}

/** Abrir (desde preparación) pide «abrir»; cerrar, reabrir o temporada piden «cerrar». */
export async function cambiarEstadoAccion(form: FormData) {
  const id = texto(form, "centroId") ?? "";
  const estado = texto(form, "estado") ?? "";
  const ctx = await exigir("organizacion", "organizacion:ver");
  const volver = rutaVuelta(form, `/organizacion/centros/${id}`);
  const deDonde = texto(form, "desde");
  const permiso = deDonde === "PREPARACION" && estado === "ABIERTO" ? "organizacion:centros:abrir" : "organizacion:centros:cerrar";
  if (!ctx.puede(permiso)) redirect("/sin-permiso");
  await intentar(volver, async () => {
    const d = CambioEstado.parse({ estado, motivo: texto(form, "motivo") });
    if (d.estado === "CERRADO" && !casilla(form, "confirmar")) throw new ErrorNegocio("Marca la casilla para confirmar el cierre definitivo");
    await servicio.cambiarEstadoCentro(ctx, id, d.estado, d.motivo);
  });
  revalidatePath("/", "layout");
  redirect(conAviso(estado === "ABIERTO" && deDonde === "PREPARACION" ? `/organizacion/centros/${id}` : volver, `Estado cambiado a «${servicio.NOMBRE_ESTADO[estado as keyof typeof servicio.NOMBRE_ESTADO] ?? estado}»`));
}

// ----------------------------------------- Marcas -----------------------------------------

export async function guardarMarcaAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:marcas:editar");
  const id = texto(form, "marcaId") ?? null;
  const volver = id ? `/organizacion/marcas/${id}` : "/organizacion/marcas";
  let nuevoId = id ?? "";
  await intentar(volver, async () => {
    const d = DatosMarca.parse({
      nombre: texto(form, "nombre") ?? "",
      concepto: texto(form, "concepto"),
      lema: texto(form, "lema"),
      web: texto(form, "web"),
      instagram: texto(form, "instagram"),
      colorPrincipal: texto(form, "colorPrincipal"),
      colorFondo: texto(form, "colorFondo"),
    });
    nuevoId = await servicio.guardarMarca(ctx, id, d);
  });
  revalidatePath("/organizacion", "layout");
  redirect(conAviso(`/organizacion/marcas/${nuevoId}`, "Marca guardada"));
}

export async function guardarPlantillaAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:plantillas:editar");
  const id = texto(form, "marcaId") ?? "";
  const volver = `/organizacion/marcas/${id}`;
  await intentar(volver, async () => {
    const horario = Object.fromEntries(DIAS.map((d) => [d, texto(form, `dia-${d}`) ?? ""]));
    const p = PlantillaMarca.parse({
      centroModeloId: texto(form, "centroModeloId"),
      areas: lista(form, "areas"),
      horario,
      horaCorte: texto(form, "horaCorte"),
      notas: texto(form, "notas"),
    });
    await servicio.guardarPlantillaMarca(ctx, id, p);
  });
  revalidatePath(volver);
  redirect(conAviso(volver, "Plantilla guardada"));
}

export async function activarMarcaAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:marcas:editar");
  const id = texto(form, "marcaId") ?? "";
  const volver = rutaVuelta(form, "/organizacion/marcas");
  await intentar(volver, () => servicio.activarMarca(ctx, id, casilla(form, "activo")));
  revalidatePath("/organizacion", "layout");
  redirect(volver);
}

// ---------------------------------------- Sociedades ----------------------------------------

export async function guardarSociedadAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:sociedades:editar");
  const id = texto(form, "sociedadId") ?? null;
  const volver = id ? `/organizacion/sociedades/${id}` : "/organizacion/sociedades";
  let nuevoId = id ?? "";
  await intentar(volver, async () => {
    const d = DatosSociedad.parse({
      razonSocial: texto(form, "razonSocial") ?? "",
      cif: texto(form, "cif") ?? "",
      domicilio: texto(form, "domicilio"),
      email: texto(form, "email"),
      iban: texto(form, "iban"),
    });
    nuevoId = await servicio.guardarSociedad(ctx, id, d);
  });
  revalidatePath("/organizacion", "layout");
  redirect(conAviso(`/organizacion/sociedades/${nuevoId}`, "Sociedad guardada"));
}

export async function activarSociedadAccion(form: FormData) {
  const ctx = await exigir("organizacion", "organizacion:sociedades:editar");
  const id = texto(form, "sociedadId") ?? "";
  const volver = rutaVuelta(form, "/organizacion/sociedades");
  await intentar(volver, () => servicio.activarSociedad(ctx, id, casilla(form, "activo")));
  revalidatePath("/organizacion", "layout");
  redirect(volver);
}
