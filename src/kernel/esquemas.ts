/** Piezas de zod comunes. Los números de los formularios se aceptan con coma o con punto (ver leerNumero). */
import { z } from "zod";
import { leerNumero } from "./formato";

/** Número escrito en un formulario: z.coerce.number() que entiende «6,5» y «1.234,5». */
export const numeroEs = (mensaje = "Número no válido") =>
  // vacío no es 0: z.coerce convertiría "" en 0 y daría por bueno un campo obligatorio sin rellenar
  z.preprocess((v) => (v === "" || v === null || v === undefined ? Number.NaN : leerNumero(v)), z.coerce.number({ message: mensaje }).finite(mensaje));

/** Igual, pero vacío = sin dato. */
export const numeroEsOpcional = (mensaje = "Número no válido") =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : leerNumero(v)), z.coerce.number({ message: mensaje }).finite(mensaje).optional());
