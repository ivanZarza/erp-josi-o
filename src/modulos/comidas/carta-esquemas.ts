/** Validación (zod) de Carta y escandallos. Los números admiten coma decimal española. */
import { z } from "zod";

function aNumeroEs(v: unknown): unknown {
  if (typeof v !== "string") return v;
  let s = v.trim().replace(/\s|€|%/g, "");
  if (s === "") return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

const numero = (msg: string) => z.preprocess(aNumeroEs, z.number({ error: msg }).finite({ error: msg }));
const numeroOpcional = (msg: string) => z.preprocess(aNumeroEs, z.number({ error: msg }).finite({ error: msg }).optional());
const texto = (msg: string) => z.string({ error: msg }).trim().min(1, { error: msg });
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const fechaOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Fecha no válida" }).optional(),
);
const casilla = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const esquemaPlato = z.object({
  marcaId: texto("Elige la marca"),
  nombre: texto("Escribe el nombre del plato"),
  nombreEn: textoOpcional,
  descripcion: textoOpcional,
  descripcionEn: textoOpcional,
  precio: numero("Precio no válido").pipe(z.number().min(0, { error: "El precio no puede ser negativo" })),
  iva: numero("IVA no válido").pipe(z.number().min(0).max(21, { error: "IVA no válido" })),
  etiquetas: textoOpcional,
});

export const esquemaIngrediente = z.object({
  platoId: texto("Falta el plato"),
  productoId: texto("Elige el ingrediente"),
  cantidad: numero("Cantidad no válida").pipe(z.number().positive({ error: "La cantidad tiene que ser mayor que 0" })),
  mermaPct: numeroOpcional("Merma no válida").pipe(z.number().min(0).max(95, { error: "La merma va de 0 a 95 %" }).optional()),
});

export const esquemaLineaIngrediente = z.object({
  id: texto("Falta la línea"),
  cantidad: numero("Cantidad no válida").pipe(z.number().positive({ error: "La cantidad tiene que ser mayor que 0" })),
  mermaPct: numeroOpcional("Merma no válida").pipe(z.number().min(0).max(95, { error: "La merma va de 0 a 95 %" }).optional()),
});

export const esquemaPrecioCentro = z.object({
  platoId: texto("Falta el plato"),
  centroId: texto("Falta el local"),
  precio: numeroOpcional("Precio no válido").pipe(z.number().min(0).optional()),
  disponible: casilla,
});

export const esquemaCarta = z
  .object({
    marcaId: texto("Elige la marca"),
    nombre: texto("Escribe el nombre de la carta"),
    tipo: z.enum(["PERMANENTE", "TEMPORAL"], { error: "Tipo de carta no válido" }),
    desde: fechaOpcional,
    hasta: fechaOpcional,
  })
  .refine((c) => c.tipo === "PERMANENTE" || (c.desde && c.hasta), { error: "Una carta temporal necesita fecha de inicio y de fin" })
  .refine((c) => !c.desde || !c.hasta || c.desde <= c.hasta, { error: "La fecha de fin es anterior a la de inicio" });

export const esquemaSeccion = z.object({
  cartaId: texto("Falta la carta"),
  nombre: texto("Escribe el nombre de la sección"),
  nombreEn: textoOpcional,
});

export const esquemaObjetivo = z.object({
  marcaId: texto("Falta la marca"),
  objetivoCostePct: numero("Objetivo no válido").pipe(z.number().min(1).max(100, { error: "El objetivo va de 1 a 100 %" })),
});

export const esquemaRecargo = z.object({
  centroId: texto("Falta el local"),
  importe: numero("Importe no válido").pipe(z.number().min(0, { error: "El importe no puede ser negativo" })),
  iva: numero("IVA no válido").pipe(z.number().min(0).max(21)),
  activo: casilla,
});
