import { z } from "zod";

export function leerFormulario(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && v.trim() !== "") o[k] = v.trim();
  return o;
}

const casilla = z.string().optional().transform((v) => v === "on" || v === "true" || v === "1");
const dinero = z.coerce.number().min(0, "El importe no puede ser negativo").max(1_000_000);

export const TIPOS_EVENTO = ["EMPRESA", "CELEBRACION", "NAVIDAD", "CATERING", "OTRO"] as const;
export const ESTADOS_EVENTO = ["NUEVA", "CONTACTADA", "PRESUPUESTO", "ACEPTADA", "CELEBRADA", "PERDIDA"] as const;

export const esquemaSolicitud = z.object({
  tipo: z.enum(TIPOS_EVENTO),
  nombreContacto: z.string().trim().min(1, "Falta el nombre de contacto").max(120),
  empresa: z.string().trim().max(120).optional(),
  telefono: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Correo no válido").optional(),
  personas: z.coerce.number().int().min(1, "Indica cuántas personas").max(2000),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  presupuestoCliente: dinero.optional(),
  marcaId: z.string().optional(),
  centroId: z.string().optional(),
  espacioId: z.string().optional(),
  recomiendame: casilla,
  origen: z.enum(["MANUAL", "WEB", "CORREO", "TELEFONO", "RESERVA"]).default("MANUAL"),
  notas: z.string().trim().max(4000).optional(),
}).refine((d) => d.telefono || d.email, { message: "Hace falta un teléfono o un correo", path: ["telefono"] });
export type DatosSolicitud = z.infer<typeof esquemaSolicitud>;

export const esquemaCambioEstado = z.object({
  id: z.string().min(1),
  estado: z.enum(ESTADOS_EVENTO),
  nota: z.string().trim().max(1000).optional(),
}).refine((d) => d.estado !== "PERDIDA" || !!d.nota, { message: "Indica el motivo de la pérdida", path: ["nota"] });

export const esquemaAsignacion = z.object({
  id: z.string().min(1),
  centroId: z.string().optional(),
  espacioId: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const esquemaMenu = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(1, "Falta el nombre del menú").max(80),
  marcaId: z.string().optional(),
  precioPersona: z.coerce.number().positive("Falta el precio por persona").max(10000),
  iva: z.coerce.number().min(0).max(21).default(10),
  minPersonas: z.coerce.number().int().min(1).default(1),
  descripcion: z.string().trim().max(500).optional(),
  platos: z.string().trim().max(4000).optional(),
});

/** Presupuesto nuevo: menú + extras (líneas «concepto;cantidad;precio» una por renglón). */
export const esquemaPresupuesto = z.object({
  solicitudId: z.string().min(1),
  menuId: z.string().optional(),
  personas: z.coerce.number().int().min(1).optional(),
  extras: z.string().trim().max(4000).optional(),
  condiciones: z.string().trim().max(4000).optional(),
  senal: dinero.optional(),
});

export const esquemaEstadoPresupuesto = z.object({
  id: z.string().min(1),
  estado: z.enum(["ENVIADO", "ACEPTADO", "RECHAZADO"]),
});
