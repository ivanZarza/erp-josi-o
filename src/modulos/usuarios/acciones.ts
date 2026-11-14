"use server";
/**
 * Acciones de servidor de Ajustes (usuarios, permisos, módulos, integraciones).
 * Cada una: exigir permiso → validar con zod → servicio → revalidar y volver.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { casilla, conAviso, conError, ErrorNegocio, lista, mensajeError, texto } from "@/modulos/organizacion/errores";
import { guardarCentrosDeModulo } from "@/modulos/organizacion/servicio";
import { moduloPorId } from "@/kernel/registro";
import { AltaUsuario, contrasena, DatosIntegracion, DatosUsuario } from "./esquemas";
import * as servicio from "./servicio";

async function intentar(rutaError: string, fn: () => Promise<void>) {
  let error: string | null = null;
  try {
    await fn();
  } catch (e) {
    error = mensajeError(e);
  }
  if (error) redirect(conError(rutaError, error));
}

function leerUsuario(form: FormData) {
  return {
    nombre: texto(form, "nombre") ?? "",
    email: texto(form, "email") ?? "",
    rol: texto(form, "rol") ?? "",
    todosCentros: casilla(form, "todosCentros"),
    centros: lista(form, "centros"),
  };
}

// ----------------------------------------- Usuarios -----------------------------------------

export async function crearUsuarioAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  let id = "";
  await intentar("/ajustes/usuarios/nuevo", async () => {
    const d = AltaUsuario.parse({ datos: leerUsuario(form), contrasena: String(form.get("contrasena") ?? "") });
    if (String(form.get("contrasena")) !== String(form.get("contrasena2"))) throw new ErrorNegocio("Las dos contraseñas no coinciden");
    id = await servicio.crearUsuario(ctx, d.datos, d.contrasena);
  });
  revalidatePath("/ajustes/usuarios");
  redirect(conAviso(`/ajustes/usuarios/${id}/permisos`, "Usuario creado. Revisa sus permisos y dale la contraseña temporal en persona."));
}

export async function actualizarUsuarioAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  const id = texto(form, "usuarioId") ?? "";
  await intentar("/ajustes/usuarios", async () => {
    await servicio.actualizarUsuario(ctx, id, DatosUsuario.parse(leerUsuario(form)));
  });
  revalidatePath("/", "layout");
  redirect(conAviso("/ajustes/usuarios", "Usuario guardado"));
}

export async function cambiarActivoUsuarioAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  const id = texto(form, "usuarioId") ?? "";
  const activo = casilla(form, "activo");
  await intentar("/ajustes/usuarios", () => servicio.cambiarActivoUsuario(ctx, id, activo));
  revalidatePath("/ajustes/usuarios");
  redirect(conAviso("/ajustes/usuarios", activo ? "Usuario activado" : "Usuario desactivado: ya no puede entrar"));
}

export async function restablecerContrasenaAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  const id = texto(form, "usuarioId") ?? "";
  await intentar("/ajustes/usuarios", async () => {
    const c = contrasena.parse(String(form.get("contrasena") ?? ""));
    await servicio.restablecerContrasena(ctx, id, c);
  });
  redirect(conAviso("/ajustes/usuarios", "Contraseña temporal cambiada"));
}

export async function guardarPermisosAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  const id = texto(form, "usuarioId") ?? "";
  const volver = `/ajustes/usuarios/${id}/permisos`;
  const usarRol = texto(form, "modo") === "rol";
  await intentar(volver, () => servicio.guardarPermisos(ctx, id, usarRol ? null : lista(form, "permisos")));
  revalidatePath("/", "layout");
  redirect(conAviso(volver, usarRol ? "Vuelve a tener los permisos de su rol" : "Permisos guardados"));
}

// ----------------------------------------- Módulos -----------------------------------------

export async function activarModuloAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:modulos:editar");
  const id = texto(form, "modulo") ?? "";
  await intentar("/ajustes/modulos", () => servicio.activarModulo(ctx, id));
  revalidatePath("/", "layout");
  redirect(conAviso("/ajustes/modulos", `${moduloPorId(id)?.nombre ?? id} activado`));
}

export async function desactivarModuloAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:modulos:editar");
  const id = texto(form, "modulo") ?? "";
  let arrastrados: string[] = [];
  await intentar("/ajustes/modulos", async () => {
    arrastrados = await servicio.desactivarModulo(ctx, id, casilla(form, "confirmar"));
  });
  revalidatePath("/", "layout");
  const extra = arrastrados.length ? ` (y también ${arrastrados.map((a) => moduloPorId(a)?.nombre ?? a).join(", ")})` : "";
  redirect(conAviso("/ajustes/modulos", `${moduloPorId(id)?.nombre ?? id} desactivado${extra}. Sus datos se conservan.`));
}

export async function guardarCentrosModuloAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:modulos:editar");
  const id = texto(form, "modulo") ?? "";
  await intentar("/ajustes/modulos", () => guardarCentrosDeModulo(ctx, id, lista(form, "centros")));
  revalidatePath("/", "layout");
  redirect(conAviso("/ajustes/modulos", `Centros de ${moduloPorId(id)?.nombre ?? id} guardados`));
}

// --------------------------------------- Integraciones ---------------------------------------

export async function guardarIntegracionAccion(form: FormData) {
  const ctx = await exigir("usuarios", "ajustes:integraciones:editar");
  await intentar("/ajustes/integraciones", async () => {
    const d = DatosIntegracion.parse({ tipo: texto(form, "tipo") ?? "", proveedor: texto(form, "proveedor"), notas: texto(form, "notas") });
    await servicio.guardarIntegracion(ctx, d);
  });
  revalidatePath("/ajustes/integraciones");
  redirect(conAviso("/ajustes/integraciones", "Integración apuntada"));
}
