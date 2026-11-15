/** Validación (zod) de los formularios de Caja y ventas. */
import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";
import { leerNumero } from "@/kernel/formato";

const opcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
// Números escritos a mano: «6,5», «1.234,5», «1.500» o «6.5» (numeroEs / numeroEsOpcional del núcleo)
const importe = (mensaje: string) => numeroEs(mensaje).pipe(z.number().min(0, mensaje));
const importeOpcional = numeroEsOpcional("Importe no válido").pipe(z.number().min(0, "Los importes no pueden ser negativos").optional());
const entero = (mensaje: string) => numeroEs(mensaje).pipe(z.number().int(mensaje).min(0, mensaje));

export const FORMAS_COBRO = ["EFECTIVO", "TARJETA", "BIZUM", "VALE", "CREDITO", "OTRA"] as const;
export const NOMBRE_FORMA_COBRO: Record<(typeof FORMAS_COBRO)[number], string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  BIZUM: "Bizum",
  VALE: "Vales y tarjetas regalo",
  CREDITO: "A cuenta (crédito)",
  OTRA: "Otras",
};

export const JornadaEsquema = z.object({
  centroId: z.string().min(1, "Elige el local"),
  fecha: fechaISO,
  ventaNeta: importe("La venta neta no es válida"),
  cuotaIva: importeOpcional,
  ventaComida: importeOpcional,
  ventaCena: importeOpcional,
  comensales: entero("Los comensales no son válidos"),
  tickets: entero("Los tickets no son válidos"),
  descuentos: importeOpcional,
  invitaciones: importeOpcional,
  anulaciones: importeOpcional,
  notas: opcional,
  pagos: z.array(z.object({ forma: z.enum(FORMAS_COBRO), importe: z.number({ message: "Un cobro por forma de pago no es un número válido" }).finite("Un cobro por forma de pago no es un número válido").min(0, "Los cobros no pueden ser negativos") })),
});
export type JornadaDatos = z.infer<typeof JornadaEsquema>;

export const CierreEsquema = z.object({
  centroId: z.string().min(1, "Elige el local"),
  fecha: fechaISO,
  efectivoTeorico: importeOpcional, // si no se da, se toma el efectivo de la jornada
  efectivoContado: importe("El efectivo contado no es válido"),
  tarjetaBanco: importeOpcional,
  fondoCaja: importeOpcional,
  motivo: opcional,
});
export type CierreDatos = z.infer<typeof CierreEsquema>;

export const ValidarCierreEsquema = z.object({
  id: z.string().min(1),
  decision: z.enum(["VALIDADO", "RECHAZADO"]),
  comentario: opcional,
});

export function objetoDeFormulario(form: FormData) {
  const o: Record<string, unknown> = {};
  const pagos: { forma: string; importe: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (k.startsWith("pago_")) {
      // un cobro mal escrito llega como NaN y el esquema lo rechaza (no se pierde en silencio)
      if (String(v).trim() !== "") {
        const n = leerNumero(String(v));
        pagos.push({ forma: k.slice(5), importe: typeof n === "number" ? n : Number.NaN });
      }
      continue;
    }
    // los números se leen en el esquema (numeroEs), que entiende la coma
    o[k] = v;
  }
  o.pagos = pagos;
  return o;
}

// ---------- tickets ----------

export const LINEAS_FORMULARIO = 10;

export const TicketFormEsquema = z.object({
  centroId: z.string().min(1, "Elige el local"),
  mesa: opcional,
  comensales: entero("Los comensales no son válidos"),
  empleadoId: opcional,
  camarero: opcional,
  estado: z.enum(["ABIERTO", "COBRADO"]),
  descuentoPct: numeroEsOpcional("Descuento no válido").pipe(z.number().min(0, "Descuento no válido").max(100, "Descuento no válido").optional()),
  forma: z.enum(FORMAS_COBRO).default("TARJETA"),
  propina: importeOpcional,
  forma2: z.preprocess((v) => (v === "" ? undefined : v), z.enum(FORMAS_COBRO).optional()),
  importe2: importeOpcional,
  notas: opcional,
  lineas: z
    .array(z.object({ platoId: z.string().min(1), formatoId: z.string().nullable(), cantidad: z.number({ message: "Una cantidad no es un número válido" }).positive("La cantidad tiene que ser mayor que cero"), invitacion: z.boolean() }))
    .min(1, "Añade al menos una línea"),
});
export type TicketFormDatos = z.infer<typeof TicketFormEsquema>;

export const AnadirLineasEsquema = TicketFormEsquema.pick({ lineas: true }).extend({ id: z.string().min(1) });

export const CobrarEsquema = z.object({
  id: z.string().min(1),
  forma: z.enum(FORMAS_COBRO).default("TARJETA"),
  propina: importeOpcional,
  forma2: z.preprocess((v) => (v === "" ? undefined : v), z.enum(FORMAS_COBRO).optional()),
  importe2: importeOpcional,
});

export const AnularEsquema = z.object({ id: z.string().min(1), motivo: z.string().trim().min(3, "Explica por qué se anula") });

/** Lee las filas «linea_N_articulo» (platoId|formatoId), «linea_N_cantidad» y «linea_N_invitacion». */
function lineasDeFormulario(form: FormData) {
  const lineas: { platoId: string; formatoId: string | null; cantidad: number; invitacion: boolean }[] = [];
  for (let i = 0; i < 40; i++) {
    const art = String(form.get(`linea_${i}_articulo`) ?? "");
    if (!art) continue;
    const [platoId, formatoId] = art.split("|");
    const texto = String(form.get(`linea_${i}_cantidad`) ?? "").trim();
    const leido = texto === "" ? 1 : leerNumero(texto);
    const cant = typeof leido === "number" ? leido : Number.NaN;
    lineas.push({ platoId, formatoId: formatoId || null, cantidad: cant, invitacion: form.get(`linea_${i}_invitacion`) === "on" });
  }
  return lineas;
}

export function ticketDeFormulario(form: FormData) {
  const o = objetoDeFormulario(form);
  o.lineas = lineasDeFormulario(form);
  return o;
}

// ---------- apertura de caja y movimientos de efectivo ----------

export const AperturaEsquema = z.object({
  centroId: z.string().min(1, "Elige el local"),
  fecha: fechaISO,
  fondoInicial: importe("El fondo inicial no es válido"),
  notas: opcional,
});

export const MovimientoCajaEsquema = z.object({
  centroId: z.string().min(1, "Elige el local"),
  fecha: fechaISO,
  tipo: z.enum(["RETIRADA", "PAGO", "ENTRADA"]),
  importe: numeroEs("Importe no válido").pipe(z.number().positive("El importe tiene que ser mayor que cero")),
  concepto: z.string().trim().min(3, "Explica el movimiento (a quién, para qué)"),
});

export const NOMBRE_MOVIMIENTO_CAJA = { RETIRADA: "Retirada", PAGO: "Pago con dinero de caja", ENTRADA: "Entrada de cambio" } as const;

// ---------- importar del TPV ----------

export const ImportarTpvEsquema = z.object({
  centroId: z.string().min(1, "Elige el local"),
  formato: z.enum(["csv", "json"]),
  texto: z.string().trim().min(10, "Pega el contenido del archivo o elige uno"),
});
