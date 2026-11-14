import { z } from "zod";

export function leerFormulario(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && v.trim() !== "") o[k] = v.trim();
  return o;
}

const casilla = z.string().optional().transform((v) => v === "on" || v === "true" || v === "1");
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (hh:mm)");
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

export const ESTADOS_RESERVA = ["SOLICITADA", "CONFIRMADA", "LLEGADA", "SENTADA", "TERMINADA", "CANCELADA", "NO_PRESENTADA"] as const;
export const ORIGENES_RESERVA = ["MANUAL", "TELEFONO", "WEB", "COVERMANAGER"] as const;

export const esquemaReserva = z.object({
  centroId: z.string().min(1, "Elige el local"),
  fecha: dia,
  hora,
  personas: z.coerce.number().int().min(1, "Indica cuántas personas").max(500),
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
  dias: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Marca algún día"),
  horaInicio: hora,
  horaFin: hora,
  duracionMin: z.coerce.number().int().min(15).max(480),
  intervaloMin: z.coerce.number().int().refine((v) => [15, 30, 60].includes(v), "La franja es de 15, 30 o 60 minutos"),
  maxCubiertosFranja: z.coerce.number().int().min(1).max(1000),
}).refine((d) => d.horaFin >= d.horaInicio, { message: "La última entrada no puede ser antes de la primera", path: ["horaFin"] });

export const esquemaAjustes = z.object({
  centroId: z.string().min(1),
  grupoMaximo: z.coerce.number().int().min(1).max(500),
  antelacionMinutos: z.coerce.number().int().min(0).max(10080),
  elegirMesaInternet: casilla,
});

export const esquemaEspacio = z.object({
  id: z.string().optional(),
  centroId: z.string().min(1),
  nombre: z.string().trim().min(1, "Falta el nombre").max(60),
  tipo: z.enum(["SALA", "TERRAZA", "RESERVADO", "BARRA"]),
  aforo: z.coerce.number().int().min(0).max(2000),
  ancho: z.coerce.number().int().min(200).max(3000).default(800),
  alto: z.coerce.number().int().min(200).max(3000).default(500),
});

export const esquemaMesa = z.object({
  id: z.string().optional(),
  espacioId: z.string().min(1, "Elige el espacio"),
  nombre: z.string().trim().min(1, "Falta el nombre o número").max(20),
  capacidadMin: z.coerce.number().int().min(1).max(100),
  capacidadMax: z.coerce.number().int().min(1).max(100),
  forma: z.enum(["CUADRADA", "REDONDA", "RECTANGULAR"]),
  combinable: casilla,
  reservableInternet: casilla,
  especial: z.string().trim().max(80).optional(),
}).refine((d) => d.capacidadMax >= d.capacidadMin, { message: "La capacidad máxima no puede ser menor que la mínima", path: ["capacidadMax"] });

export const esquemaPosiciones = z
  .array(z.object({ id: z.string().min(1), x: z.number().int().min(0).max(3000), y: z.number().int().min(0).max(3000) }))
  .max(500);
