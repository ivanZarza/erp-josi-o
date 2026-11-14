import { z } from "zod";

/** FormData → objeto plano (las casillas marcadas llegan como "on"). Los campos vacíos se quitan. */
export function leerFormulario(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && v.trim() !== "") o[k] = v.trim();
  return o;
}

const texto = z.string().trim().max(500);
const casilla = z.string().optional().transform((v) => v === "on" || v === "true" || v === "1");

export const esquemaCliente = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre").max(120),
  apellidos: texto.optional(),
  telefono: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Correo no válido").optional(),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferencias: texto.optional(),
  alergias: texto.optional(),
  notas: z.string().trim().max(2000).optional(),
  etiquetas: z
    .string()
    .optional()
    .transform((v) => (v ? Array.from(new Set(v.split(",").map((e) => e.trim()).filter(Boolean))) : [])),
});
export type DatosCliente = z.infer<typeof esquemaCliente>;

export const esquemaConsentimiento = z.object({
  clienteId: z.string().min(1),
  tipo: z.enum(["RESERVA", "CORREO", "WHATSAPP"]),
  otorgado: casilla,
  marcaId: z.string().optional(),
  texto: texto.optional(),
});

export const esquemaRespuestaEncuesta = z.object({
  id: z.string().min(1),
  nota: z.coerce.number().int().min(1, "La nota va de 1 a 5").max(5, "La nota va de 1 a 5"),
  comentario: z.string().trim().max(2000).optional(),
});

export const esquemaSeguimientoEncuesta = z.object({
  id: z.string().min(1),
  seguimiento: z.string().trim().min(1, "Escribe qué se ha hecho").max(2000),
});

export const esquemaTarjeta = z.object({
  importe: z.coerce.number().positive("El importe debe ser mayor que 0").max(5000),
  caducidad: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Falta la caducidad"),
  marcaId: z.string().optional(),
  compradorNombre: texto.optional(),
  compradorEmail: z.string().trim().email("Correo no válido").optional(),
  destinatario: texto.optional(),
  mensaje: texto.optional(),
});

export const esquemaCanje = z.object({
  tarjetaId: z.string().min(1),
  importe: z.coerce.number().positive("El importe debe ser mayor que 0"),
  centroId: z.string().optional(),
  nota: texto.optional(),
});

export const esquemaAnulacion = z.object({
  tarjetaId: z.string().min(1),
  nota: z.string().trim().min(1, "Indica el motivo").max(500),
});
