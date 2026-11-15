import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";

export function leerFormulario(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && v.trim() !== "") o[k] = v.trim();
  return o;
}

const casilla = z.string().optional().transform((v) => v === "on" || v === "true" || v === "1");
/** Importe en euros, opcional (admite «1.234,50»). */
const dineroOpcional = (mensaje = "Importe no válido") => numeroEsOpcional(mensaje).pipe(z.number().min(0, "El importe no puede ser negativo").max(1_000_000).optional());
const entero = (mensaje = "Número no válido") => numeroEs(mensaje).pipe(z.number().int(mensaje));

export const TIPOS_EVENTO = ["EMPRESA", "CELEBRACION", "NAVIDAD", "CATERING", "OTRO"] as const;
export const ESTADOS_EVENTO = ["NUEVA", "CONTACTADA", "PRESUPUESTO", "ACEPTADA", "CELEBRADA", "PERDIDA"] as const;

export const esquemaSolicitud = z.object({
  tipo: z.enum(TIPOS_EVENTO),
  nombreContacto: z.string().trim().min(1, "Falta el nombre de contacto").max(120),
  empresa: z.string().trim().max(120).optional(),
  telefono: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Correo no válido").optional(),
  personas: entero("Indica cuántas personas").pipe(z.number().min(1, "Indica cuántas personas").max(2000, "Como máximo 2.000 personas")),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  presupuestoCliente: dineroOpcional("Lo que quiere gastar no es un importe válido"),
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
  precioPersona: numeroEs("Precio por persona no válido").pipe(z.number().positive("Falta el precio por persona").max(10000)),
  iva: numeroEs("IVA no válido").pipe(z.number().min(0, "El IVA va de 0 a 21").max(21, "El IVA va de 0 a 21")).default(10),
  minPersonas: entero("Mínimo de personas no válido").pipe(z.number().min(1)).default(1),
  descripcion: z.string().trim().max(500).optional(),
  platos: z.string().trim().max(4000).optional(),
});

/** Presupuesto nuevo: menú + extras (líneas «concepto;cantidad;precio» una por renglón). */
export const esquemaPresupuesto = z.object({
  solicitudId: z.string().min(1),
  menuId: z.string().optional(),
  personas: numeroEsOpcional("Personas no válidas").pipe(z.number().int("Las personas van sin decimales").min(1).optional()),
  extras: z.string().trim().max(4000).optional(),
  condiciones: z.string().trim().max(4000).optional(),
  senal: dineroOpcional("Señal no válida"),
});

export const esquemaEstadoPresupuesto = z.object({
  id: z.string().min(1),
  estado: z.enum(["ENVIADO", "ACEPTADO", "RECHAZADO"]),
});
