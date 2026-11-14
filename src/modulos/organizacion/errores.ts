/**
 * Errores de negocio y ayudas para leer formularios. Lo usan Organización y Usuarios (núcleo).
 * Las acciones convierten el error en un aviso de la página (?error=…), sin datos personales.
 */
import { ZodError } from "zod";

export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

/** Texto para el usuario a partir de cualquier error. */
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorNegocio) return e.message;
  if (e instanceof ZodError) {
    const p = e.issues[0];
    return p ? p.message : "Datos no válidos";
  }
  const codigo = (e as { code?: string })?.code;
  if (codigo === "P2002") return "Ya existe un registro con ese dato (código, correo, CIF o nombre repetido)";
  console.error(e);
  return "No se ha podido guardar. Vuelve a intentarlo.";
}

/** Añade ?error=… (o &error=…) a una ruta. */
export function conError(ruta: string, mensaje: string): string {
  return `${ruta}${ruta.includes("?") ? "&" : "?"}error=${encodeURIComponent(mensaje)}`;
}

export function conAviso(ruta: string, mensaje: string): string {
  return `${ruta}${ruta.includes("?") ? "&" : "?"}ok=${encodeURIComponent(mensaje)}`;
}

/** Lee un campo de texto: cadena recortada o undefined si viene vacío. */
export function texto(form: FormData, clave: string): string | undefined {
  const v = form.get(clave);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Casilla marcada. */
export function casilla(form: FormData, clave: string): boolean {
  const v = form.get(clave);
  return v === "on" || v === "true" || v === "1";
}

/** Todas las casillas marcadas con el mismo nombre. */
export function lista(form: FormData, clave: string): string[] {
  return form
    .getAll(clave)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}
