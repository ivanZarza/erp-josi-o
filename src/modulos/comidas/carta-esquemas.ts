/** Validación (zod) de Carta y escandallos. Los números se leen con numeroEs (de @/kernel/esquemas): «6,5», «1.234,5», «1.500» o «6.5». */
import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";

/** Vacío = sin dato (para que un número obligatorio en blanco dé su mensaje y no se lea como 0). */
const vacioASinDato = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const numero = (msg: string) => z.preprocess(vacioASinDato, numeroEs(msg));
const numeroOpcional = (msg: string) => numeroEsOpcional(msg);
const texto = (msg: string) => z.string({ error: msg }).trim().min(1, { error: msg });
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const fechaOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Fecha no válida" }).optional(),
);
const casilla = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const area = z.enum(["COMIDAS", "BEBIDAS"], { error: "Área no válida" });

export const esquemaPlato = z.object({
  marcaId: texto("Elige la marca"),
  area: area.optional(),
  centroId: textoOpcional, // vacío = de toda la marca

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
    centroId: textoOpcional, // vacío = de toda la marca
    nombre: texto("Escribe el nombre de la carta"),
    tipo: z.enum(["PERMANENTE", "TEMPORAL"], { error: "Tipo de carta no válido" }),
    desde: fechaOpcional,
    hasta: fechaOpcional,
  })
  .refine((c) => c.tipo === "PERMANENTE" || (c.desde && c.hasta), { error: "Una carta temporal necesita fecha de inicio y de fin" })
  .refine((c) => !c.desde || !c.hasta || c.desde <= c.hasta, { error: "La fecha de fin es anterior a la de inicio" });

export const esquemaSeccion = z.object({
  cartaId: texto("Falta la carta"),
  area,
  nombre: texto("Escribe el nombre de la sección"),
  nombreEn: textoOpcional,
});

/** Objetivo de coste de una marca para un área. En Bebidas, vacío = usar el de Comidas. */
export const esquemaObjetivo = z
  .object({
    marcaId: texto("Falta la marca"),
    area: area.default("COMIDAS"),
    objetivoCostePct: numeroOpcional("Objetivo no válido").pipe(z.number().min(1, { error: "El objetivo va de 1 a 100 %" }).max(100, { error: "El objetivo va de 1 a 100 %" }).optional()),
  })
  .refine((o) => o.area === "BEBIDAS" || o.objetivoCostePct !== undefined, { error: "Escribe el objetivo de coste (%)" });

export const esquemaRecargo = z.object({
  centroId: texto("Falta el local"),
  importe: numero("Importe no válido").pipe(z.number().min(0, { error: "El importe no puede ser negativo" })),
  iva: numero("IVA no válido").pipe(z.number().min(0).max(21)),
  activo: casilla,
  /** Plato con el escandallo de lo que se sirve (opcional): con él, cada cobro baja el stock. */
  platoId: textoOpcional,
});

/** Formato de venta: cantidad = parte del escandallo (o unidades del producto elegido); o centilitros si el vino tiene capacidad. */
export const esquemaFormato = z
  .object({
    platoId: texto("Falta el plato"),
    nombre: texto("Escribe el formato: botella, copa, mágnum…"),
    precio: numero("Precio no válido").pipe(z.number().min(0, { error: "El precio no puede ser negativo" })),
    cantidad: numeroOpcional("Cantidad no válida").pipe(z.number().positive({ error: "La cantidad tiene que ser mayor que 0" }).optional()),
    centilitros: numeroOpcional("Centilitros no válidos").pipe(z.number().positive({ error: "Los centilitros tienen que ser más de 0" }).optional()),
    productoId: textoOpcional,
  })
  .refine((f) => f.cantidad !== undefined || f.centilitros !== undefined, { error: "Pon la cantidad del escandallo o los centilitros" });

export const esquemaFormatoCambio = z.object({
  id: texto("Falta el formato"),
  precio: numero("Precio no válido").pipe(z.number().min(0, { error: "El precio no puede ser negativo" })),
  cantidad: numero("Cantidad no válida").pipe(z.number().positive({ error: "La cantidad tiene que ser mayor que 0" })),
});
