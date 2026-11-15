/** Validación (zod) del Obrador. Los números se leen con numeroEs (de @/kernel/esquemas): «6,5», «1.234,5», «1.500» o «6.5». */
import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";

/** Vacío = sin dato (para que un número obligatorio en blanco dé su mensaje y no se lea como 0). */
const vacioASinDato = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const numero = (msg: string) => z.preprocess(vacioASinDato, numeroEs(msg));
const numeroOpcional = (msg: string) => numeroEsOpcional(msg);
const texto = (msg: string) => z.string({ error: msg }).trim().min(1, { error: msg });
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const fecha = (msg: string) => z.string({ error: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: msg });

export const esquemaReceta = z
  .object({
    centroId: texto("Elige el obrador"),
    productoId: textoOpcional, // elaborado existente
    nombreProducto: textoOpcional, // o uno nuevo
    unidad: z.enum(["UD", "KG", "L", "RACION"], { error: "Unidad no válida" }).default("KG"),
    nombre: texto("Escribe el nombre de la receta"),
    rendimiento: numero("Rendimiento no válido").pipe(z.number().positive({ error: "El rendimiento tiene que ser mayor que 0" })),
    vidaUtilDias: numero("Vida útil no válida").pipe(z.number().int({ error: "La vida útil va en días enteros" }).min(0).max(730)),
    conservacion: textoOpcional,
    pasos: textoOpcional,
    tiempoMinutos: numeroOpcional("Tiempo no válido").pipe(z.number().int().min(0).optional()),
  })
  .refine((r) => r.productoId || r.nombreProducto, { error: "Elige el elaborado de salida o escribe el nombre de uno nuevo" });

export const esquemaRecetaEdicion = z.object({
  id: texto("Falta la receta"),
  nombre: texto("Escribe el nombre de la receta"),
  rendimiento: numero("Rendimiento no válido").pipe(z.number().positive({ error: "El rendimiento tiene que ser mayor que 0" })),
  vidaUtilDias: numero("Vida útil no válida").pipe(z.number().int({ error: "La vida útil va en días enteros" }).min(0).max(730)),
  conservacion: textoOpcional,
  pasos: textoOpcional,
  tiempoMinutos: numeroOpcional("Tiempo no válido").pipe(z.number().int().min(0).optional()),
});

export const esquemaLineaReceta = z.object({
  recetaId: texto("Falta la receta"),
  productoId: texto("Elige el ingrediente"),
  cantidad: numero("Cantidad no válida").pipe(z.number().positive({ error: "La cantidad tiene que ser mayor que 0" })),
  mermaPct: numeroOpcional("Merma no válida").pipe(z.number().min(0).max(95, { error: "La merma va de 0 a 95 %" }).optional()),
});

export const esquemaEdicionLinea = z.object({
  id: texto("Falta la línea"),
  cantidad: numero("Cantidad no válida").pipe(z.number().positive({ error: "La cantidad tiene que ser mayor que 0" })),
  mermaPct: numeroOpcional("Merma no válida").pipe(z.number().min(0).max(95, { error: "La merma va de 0 a 95 %" }).optional()),
});

export const esquemaOrden = z.object({
  recetaId: texto("Elige la receta"),
  fecha: fecha("Elige el día de producción"),
  tandas: numero("Número de tandas no válido").pipe(z.number().positive({ error: "Las tandas tienen que ser más de 0" })),
  notas: textoOpcional,
});

export const esquemaCierre = z.object({
  id: texto("Falta la orden"),
  cantidadReal: numero("Cantidad producida no válida").pipe(z.number().positive({ error: "La cantidad producida tiene que ser mayor que 0" })),
  forzar: z.preprocess((v) => v === "on", z.boolean()),
});

export const esquemaTarifa = z
  .object({
    obradorId: texto("Falta el obrador"),
    productoId: texto("Elige el artículo"),
    ambito: texto("Elige a qué locales se aplica"), // TODOS | MARCA:<id> | CENTRO:<id>
    modo: z.enum(["COSTE", "COSTE_MAS_PORCENTAJE", "PRECIO_FIJO"], { error: "Modo de tarifa no válido" }),
    valor: numeroOpcional("Valor no válido").pipe(z.number().min(0, { error: "El valor no puede ser negativo" }).optional()),
  })
  .refine((t) => t.modo === "COSTE" || t.valor !== undefined, { error: "Indica el porcentaje o el precio fijo" });

export const esquemaRetirada = z.object({
  id: texto("Falta el lote"),
  motivo: texto("Escribe el motivo de la retirada"),
  /** Lo que queda del lote en el obrador y se tira: sale del stock como merma (vacío o 0 = nada). */
  cantidadBaja: numeroOpcional("Cantidad a dar de baja no válida").pipe(z.number().min(0, { error: "La cantidad a dar de baja no puede ser negativa" }).optional()),
});
