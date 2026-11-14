/** Validación (zod) de los formularios del Cuadro de mando. */
import { z } from "zod";

const opcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());
const importeOpcional = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number({ message: "Importe no válido" }).finite().min(0, "Importe no válido").optional());

export const PresupuestoEsquema = z.object({
  centroId: z.string().min(1),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes no válido"),
  ventas: z.coerce.number({ message: "La venta presupuestada no es válida" }).finite().min(0, "La venta presupuestada no es válida"),
  mercancia: importeOpcional,
  personal: importeOpcional,
  gastos: importeOpcional,
  notas: opcional,
});

/** Acepta «1.234,56», «1234,56» o «1234.56». */
export function decimalEs(v: FormDataEntryValue | null): string {
  const s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (s.includes(",")) return s.replace(/\./g, "").replace(",", ".");
  return s;
}

export function objetoDeFormulario(form: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("$ACTION")) continue;
    o[k] = ["ventas", "mercancia", "personal", "gastos"].includes(k) ? decimalEs(v) : v;
  }
  return o;
}
