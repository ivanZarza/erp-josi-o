/** Validación (zod) de Bebidas: ficha de vino. Los números admiten coma decimal española. */
import { z } from "zod";
import { leerNumero } from "@/kernel/formato";

/** «75», «75 cl», «37,5», «1.500» → número (misma lectura que el resto del ERP: leerNumero). Vacío → sin dato. */
function aNumeroEs(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim().replace(/\s|cl/gi, "");
  if (s === "") return undefined;
  const n = leerNumero(s);
  return typeof n === "number" ? n : Number.NaN;
}
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(2000).optional());

export const esquemaFichaVino = z.object({
  productoId: z.string({ error: "Falta el producto" }).min(1, { error: "Falta el producto" }),
  bodega: textoOpcional,
  denominacion: textoOpcional,
  uva: textoOpcional,
  anada: z.preprocess(aNumeroEs, z.number({ error: "Añada no válida" }).int({ error: "La añada es un año: 2019" }).min(1900, { error: "Añada no válida" }).max(2100, { error: "Añada no válida" }).optional()),
  capacidadCl: z.preprocess(aNumeroEs, z.number({ error: "Capacidad no válida" }).min(5, { error: "La capacidad va en centilitros: 75" }).max(2000, { error: "Capacidad no válida" }).optional()),
  tipo: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["TINTO", "BLANCO", "ROSADO", "ESPUMOSO", "GENEROSO", "DULCE"], { error: "Tipo de vino no válido" }).optional()),
  crianza: textoOpcional,
  notasCata: textoOpcional,
  maridaje: textoOpcional,
  argumentoVenta: textoOpcional,
});
