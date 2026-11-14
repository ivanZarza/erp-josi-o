/** Validación (zod) de los formularios de Caja y ventas. */
import { z } from "zod";

const opcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const importe = (mensaje: string) => z.coerce.number({ message: mensaje }).finite(mensaje).min(0, mensaje);
const importeOpcional = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().finite().min(0).optional());
const entero = (mensaje: string) => z.coerce.number({ message: mensaje }).int(mensaje).min(0, mensaje);

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
  pagos: z.array(z.object({ forma: z.enum(FORMAS_COBRO), importe: z.number().finite().min(0) })),
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

/** Acepta «1.234,56», «1234,56» o «1234.56». */
export function decimalEs(v: FormDataEntryValue | null): string {
  const s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (s.includes(",")) return s.replace(/\./g, "").replace(",", ".");
  return s;
}

const DECIMALES = ["ventaNeta", "cuotaIva", "ventaComida", "ventaCena", "descuentos", "invitaciones", "anulaciones", "efectivoTeorico", "efectivoContado", "tarjetaBanco", "fondoCaja"];

export function objetoDeFormulario(form: FormData) {
  const o: Record<string, unknown> = {};
  const pagos: { forma: string; importe: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (k.startsWith("pago_")) {
      const s = decimalEs(v);
      if (s !== "") pagos.push({ forma: k.slice(5), importe: Number(s) });
      continue;
    }
    o[k] = DECIMALES.includes(k) ? decimalEs(v) : v;
  }
  o.pagos = pagos;
  return o;
}
