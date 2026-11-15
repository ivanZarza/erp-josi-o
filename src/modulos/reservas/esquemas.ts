import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";

export function leerFormulario(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && v.trim() !== "") o[k] = v.trim();
  return o;
}

const casilla = z.string().optional().transform((v) => v === "on" || v === "true" || v === "1");
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (hh:mm)");
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
/** Número entero escrito en el formulario (admite «1.500» y coma). */
const entero = (mensaje = "Número no válido") => numeroEs(mensaje).pipe(z.number().int(mensaje));

export const ESTADOS_RESERVA = ["SOLICITADA", "CONFIRMADA", "LLEGADA", "SENTADA", "TERMINADA", "CANCELADA", "NO_PRESENTADA"] as const;
export const ORIGENES_RESERVA = ["MANUAL", "TELEFONO", "WEB", "COVERMANAGER"] as const;

export const esquemaReserva = z.object({
  centroId: z.string().min(1, "Elige el local"),
  fecha: dia,
  hora,
  personas: entero("Indica cuántas personas").pipe(z.number().min(1, "Indica cuántas personas").max(500, "Como máximo 500 personas")),
  nombre: z.string().trim().min(1, "Falta el nombre").max(120),
  telefono: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Correo no válido").optional(),
  espacioId: z.string().optional(),
  mesaId: z.string().optional(), // vacío = asignar automáticamente
  sinMesa: casilla, // guardar aunque no haya mesa libre (se asigna luego en sala)
  origen: z.enum(ORIGENES_RESERVA).default("MANUAL"),
  notas: z.string().trim().max(1000).optional(),
  alergias: z.string().trim().max(500).optional(),
  consentimientoReserva: casilla,
  consentimientoCorreo: casilla,
  consentimientoWhatsapp: casilla,
}).refine((d) => d.telefono || d.email, { message: "Hace falta un teléfono o un correo", path: ["telefono"] });
export type DatosReserva = z.infer<typeof esquemaReserva>;

export const esquemaCambioEstado = z.object({
  id: z.string().min(1),
  estado: z.enum(ESTADOS_RESERVA),
  nota: z.string().trim().max(500).optional(),
});

export const esquemaCambioMesa = z.object({
  id: z.string().min(1),
  mesaId: z.string().optional(), // vacío = asignar automáticamente
});

export const esquemaTurno = z.object({
  id: z.string().optional(),
  centroId: z.string().min(1),
  nombre: z.string().trim().min(1, "Falta el nombre del turno").max(40),
  dias: z.array(entero().pipe(z.number().min(1).max(7))).min(1, "Marca algún día"),
  horaInicio: hora,
  horaFin: hora,
  duracionMin: entero("Duración no válida").pipe(z.number().min(15, "La duración mínima es de 15 minutos").max(480, "La duración máxima es de 480 minutos")),
  intervaloMin: entero().refine((v) => [15, 30, 60].includes(v), "La franja es de 15, 30 o 60 minutos"),
  maxCubiertosFranja: entero("Cubiertos no válidos").pipe(z.number().min(1, "Al menos 1 cubierto por franja").max(1000)),
}).refine((d) => d.horaFin >= d.horaInicio, { message: "La última entrada no puede ser antes de la primera", path: ["horaFin"] });

/** Una fila de «duración según personas»: hasta N personas, M minutos. Las dos vacías = fila sin usar. */
const filaDuracion = z
  .object({
    hasta: numeroEsOpcional("Personas no válidas").pipe(z.number().int("Las personas van sin decimales").min(1, "Las personas empiezan en 1").max(500).optional()),
    minutos: numeroEsOpcional("Minutos no válidos").pipe(z.number().int("Los minutos van sin decimales").min(15, "La duración mínima es de 15 minutos").max(480, "La duración máxima es de 480 minutos").optional()),
  })
  .refine((f) => (f.hasta === undefined) === (f.minutos === undefined), { message: "En la duración según personas, rellena las dos casillas de cada fila" });

export const esquemaAjustes = z.object({
  centroId: z.string().min(1),
  grupoMaximo: entero("Grupo máximo no válido").pipe(z.number().min(1).max(500)),
  antelacionMinutos: entero("Antelación no válida").pipe(z.number().min(0).max(10080)),
  elegirMesaInternet: casilla,
  duraciones: z
    .array(filaDuracion)
    .transform((filas) => filas.filter((f): f is { hasta: number; minutos: number } => f.hasta !== undefined && f.minutos !== undefined).sort((a, b) => a.hasta - b.hasta))
    .refine((filas) => new Set(filas.map((f) => f.hasta)).size === filas.length, { message: "En la duración según personas hay dos filas con las mismas personas" }),
});

export const esquemaEspacio = z.object({
  id: z.string().optional(),
  centroId: z.string().min(1),
  nombre: z.string().trim().min(1, "Falta el nombre").max(60),
  tipo: z.enum(["SALA", "TERRAZA", "RESERVADO", "BARRA"]),
  aforo: entero("Aforo no válido").pipe(z.number().min(0).max(2000)),
  ancho: entero("Ancho no válido").pipe(z.number().min(200, "El ancho mínimo del plano es 200").max(3000)).default(800),
  alto: entero("Alto no válido").pipe(z.number().min(200, "El alto mínimo del plano es 200").max(3000)).default(500),
});

export const esquemaMesa = z.object({
  id: z.string().optional(),
  espacioId: z.string().min(1, "Elige el espacio"),
  nombre: z.string().trim().min(1, "Falta el nombre o número").max(20),
  capacidadMin: entero("Mínimo de personas no válido").pipe(z.number().min(1).max(100)),
  capacidadMax: entero("Máximo de personas no válido").pipe(z.number().min(1).max(100)),
  forma: z.enum(["CUADRADA", "REDONDA", "RECTANGULAR"]),
  combinable: casilla,
  reservableInternet: casilla,
  especial: z.string().trim().max(80).optional(),
}).refine((d) => d.capacidadMax >= d.capacidadMin, { message: "La capacidad máxima no puede ser menor que la mínima", path: ["capacidadMax"] });

export const esquemaPosiciones = z
  .array(z.object({ id: z.string().min(1), x: z.number().int().min(0).max(3000), y: z.number().int().min(0).max(3000) }))
  .max(500);
