/** Validación de los formularios de Organización (zod). */
import { z } from "zod";

const opcional = <T extends z.ZodTypeAny>(e: T) => e.optional();

/** Teléfono SIEMPRE internacional (+34…). Admite espacios y guiones; 9 cifras españolas → +34. */
export const telefono = z
  .string()
  .transform((v) => v.replace(/[\s.\-()]/g, ""))
  .transform((v) => (/^[6789]\d{8}$/.test(v) ? `+34${v}` : v.startsWith("0034") ? `+${v.slice(2)}` : v))
  .refine((v) => /^\+\d{8,15}$/.test(v), "Teléfono no válido: escríbelo con prefijo, por ejemplo +34 911 34 11 60");

export const correo = z.string().trim().toLowerCase().pipe(z.email("Correo no válido"));

export const codigoCentro = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{0,11}$/, "Código no válido: letras, números y guiones, máximo 12 (por ejemplo VA-AYA)");

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (HH:MM)");
const fechaTexto = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .transform((v) => new Date(`${v}T12:00:00`));

export const TIPOS_CENTRO = ["LOCAL", "OBRADOR", "ALMACEN"] as const;
export const ESTADOS_CENTRO = ["PREPARACION", "ABIERTO", "TEMPORADA", "CERRADO_TEMPORAL", "CERRADO"] as const;

/** Dirección: o un edificio existente (comparte con otro local) o una dirección nueva. */
export const Direccion = z
  .object({
    edificioId: opcional(z.string()),
    direccion: opcional(z.string().trim().min(3, "Dirección demasiado corta")),
    cp: opcional(z.string().trim().regex(/^\d{5}$/, "Código postal de 5 cifras")),
    ciudad: opcional(z.string().trim().min(2)),
    provincia: opcional(z.string().trim()),
    comunidad: opcional(z.string().trim()),
  })
  .refine((d) => d.edificioId || (d.direccion && d.ciudad), "Indica la dirección y la ciudad, o elige un edificio existente");

export const DatosCentro = z.object({
  codigo: codigoCentro,
  nombre: z.string().trim().min(2, "Falta el nombre"),
  tipo: z.enum(TIPOS_CENTRO),
  marcaId: opcional(z.string()),
  sociedadId: opcional(z.string()),
  telefono: opcional(telefono),
  email: opcional(correo),
  horaCorte: hora.default("05:00"),
  aperturaEn: opcional(fechaTexto),
  direccion: Direccion,
});
export type DatosCentro = z.infer<typeof DatosCentro>;

/** Paso 1 y 2 del asistente de apertura. */
export const NuevoLocal = z
  .object({
    marcaId: opcional(z.string()),
    marcaNueva: opcional(z.string().trim().min(2, "Nombre de marca demasiado corto")),
    sociedadId: opcional(z.string()),
    sociedadNueva: opcional(z.object({ razonSocial: z.string().trim().min(3, "Falta la razón social"), cif: z.lazy(() => cif) })),
    origen: z.enum(["plantilla", "copiar", "vacio"]),
    centroOrigenId: opcional(z.string()),
    codigo: codigoCentro,
    nombre: z.string().trim().min(2, "Falta el nombre del local"),
    tipo: z.enum(TIPOS_CENTRO).default("LOCAL"),
    telefono: opcional(telefono),
    email: opcional(correo),
    aperturaEn: opcional(fechaTexto),
    direccion: Direccion,
  })
  .refine((d) => d.marcaId || d.marcaNueva || d.tipo !== "LOCAL", "Elige una marca o escribe el nombre de una nueva")
  .refine((d) => d.origen !== "copiar" || d.centroOrigenId, "Elige el local del que copiar");
export type NuevoLocal = z.infer<typeof NuevoLocal>;

export const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
export const NOMBRE_DIA: Record<(typeof DIAS)[number], string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export const SERVICIOS = [
  ["parking", "Parking"],
  ["aparcacoches", "Aparcacoches"],
  ["accesible", "Accesible"],
  ["celiacos", "Opciones para celíacos"],
  ["perros", "Admite perros"],
  ["terraza-climatizada", "Terraza climatizada"],
  ["animacion-infantil", "Animación infantil"],
] as const;

/** Tramos de un día: «13:00-16:00, 20:00-00:30» o «cerrado» o vacío. */
const tramos = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || /^cerrado$/i.test(v) || v.split(",").every((t) => /^\s*([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d\s*$/.test(t)),
    "Horario no válido: usa tramos como 13:00-16:00, 20:00-00:30 o «cerrado»",
  );

export const Espacio = z.object({
  nombre: z.string().trim().min(1),
  sentados: z.number().int().min(0),
  dePie: z.number().int().min(0),
});

export const HorarioCentro = z.object({
  horaCorte: hora,
  horario: z.partialRecord(z.enum(DIAS), tramos),
  festivos: z.string().trim().max(2000).default(""),
  espacios: z.array(Espacio).max(50),
  servicios: z.array(z.string()).max(SERVICIOS.length),
});
export type HorarioCentro = z.infer<typeof HorarioCentro>;

/** «Sala principal, 60, 20» → { nombre, sentados, dePie } (una línea por espacio). */
export function leerEspacios(textoEspacios: string): z.infer<typeof Espacio>[] {
  return textoEspacios
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [nombre, s, p] = l.split(/[,;|]/).map((x) => x.trim());
      return { nombre: nombre ?? "", sentados: Number(s || 0), dePie: Number(p || 0) };
    });
}

const colorHex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color no válido (formato #RRGGBB)");

export const DatosMarca = z.object({
  nombre: z.string().trim().min(2, "Falta el nombre"),
  concepto: opcional(z.string().trim().max(300)),
  lema: opcional(z.string().trim().max(200)),
  web: opcional(z.string().trim().toLowerCase().regex(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/, "Web no válida (por ejemplo razamadrid.com)")),
  instagram: opcional(z.string().trim().regex(/^@?[A-Za-z0-9._]{1,30}$/, "Instagram no válido (por ejemplo @razamadrid)").transform((v) => (v.startsWith("@") ? v : `@${v}`))),
  colorPrincipal: opcional(colorHex),
  colorFondo: opcional(colorHex),
});
export type DatosMarca = z.infer<typeof DatosMarca>;

/** Plantilla de marca: lo que hereda un local nuevo de la marca (lo que hoy se puede copiar). */
export const PlantillaMarca = z.object({
  centroModeloId: opcional(z.string()), // local modelo: de él se copian ajustes de productos (mínimos y activos)
  areas: z.array(z.string()), // áreas activas por defecto en un local de la marca
  horario: z.partialRecord(z.enum(DIAS), tramos).optional(), // horario tipo
  horaCorte: opcional(hora),
  notas: opcional(z.string().trim().max(2000)),
});
export type PlantillaMarca = z.infer<typeof PlantillaMarca>;

/** CIF/NIF español (forma, no dígito de control). */
export const cif = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .refine((v) => /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v) || /^[0-9XYZ]\d{7}[A-Z]$/.test(v), "CIF no válido (por ejemplo B88600374)");

export const DatosSociedad = z.object({
  razonSocial: z.string().trim().min(3, "Falta la razón social"),
  cif,
  domicilio: opcional(z.string().trim()),
  email: opcional(correo),
  iban: opcional(
    z
      .string()
      .toUpperCase()
      .transform((v) => v.replace(/\s/g, ""))
      .refine((v) => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v), "IBAN no válido"),
  ),
});
export type DatosSociedad = z.infer<typeof DatosSociedad>;

export const CambioEstado = z.object({
  estado: z.enum(ESTADOS_CENTRO),
  motivo: opcional(z.string().trim().max(500)),
});
