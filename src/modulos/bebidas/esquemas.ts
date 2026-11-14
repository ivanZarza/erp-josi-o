/** Validación (zod) de Bebidas: ficha de vino. Los números admiten coma decimal española. */
import { z } from "zod";

function aNumeroEs(v: unknown): unknown {
  if (typeof v !== "string") return v;
  let s = v.trim().replace(/\s|cl/gi, "");
  if (s === "") return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
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
