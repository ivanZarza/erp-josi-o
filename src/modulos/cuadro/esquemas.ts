/** Validación (zod) de los formularios del Cuadro de mando. */
import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";

const opcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());
// Números escritos a mano: «6,5», «1.234,5», «1.500» o «6.5» (numeroEs / numeroEsOpcional del núcleo)
const importeOpcional = numeroEsOpcional("Importe no válido").pipe(z.number().min(0, "Importe no válido").optional());

export const PresupuestoEsquema = z.object({
  centroId: z.string().min(1),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes no válido"),
  ventas: numeroEs("La venta presupuestada no es válida").pipe(z.number().min(0, "La venta presupuestada no es válida")),
  mercancia: importeOpcional,
  personal: importeOpcional,
  gastos: importeOpcional,
  notas: opcional,
});

/** Campos del formulario; los números los lee el esquema (numeroEs), que entiende la coma. */
export function objetoDeFormulario(form: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("$ACTION")) continue;
    o[k] = v;
  }
  return o;
}
