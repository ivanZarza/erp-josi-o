/** Validación (zod) de los formularios de Contabilidad. */
import { z } from "zod";
import { numeroEs } from "@/kernel/esquemas";

const texto = (max = 200) => z.string().trim().max(max);
const opcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const fechaOpcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), fechaISO.optional());
// Números escritos a mano: «6,5», «1.234,5», «1.500» o «6.5» (numeroEs del núcleo)
const importe = numeroEs("Importe no válido");

export const TIPOS_IVA = [21, 10, 4, 0] as const;

export const LineaFacturaEsquema = z.object({
  concepto: texto(300).min(1, "Falta el concepto de una línea"),
  cantidad: numeroEs("Cantidad no válida").pipe(z.number().positive("La cantidad debe ser mayor que cero")),
  precio: importe,
  tipoIva: z.coerce.number().refine((v) => (TIPOS_IVA as readonly number[]).includes(v), "Tipo de IVA no válido"),
  categoriaId: opcional,
});
export type LineaFactura = z.infer<typeof LineaFacturaEsquema>;

export const FacturaRecibidaEsquema = z.object({
  sociedadId: z.string().min(1, "Elige la sociedad"),
  centroId: opcional,
  proveedorId: opcional,
  proveedorNombre: opcional,
  proveedorCif: opcional,
  numeroProveedor: texto(60).min(1, "Falta el número de factura del proveedor"),
  fecha: fechaISO,
  vencimiento: fechaOpcional,
  // obligatoria: sin categoría la factura no se puede llevar ni al Cuadro de mando ni a la cuenta de la gestoría
  categoriaId: z.string({ message: "Elige la categoría de la factura (se usa en las líneas que no tengan la suya)" }).min(1, "Elige la categoría de la factura (se usa en las líneas que no tengan la suya)"),
  // albaranes (compras recibidas) que factura: una factura semanal o mensual junta varios; cada albarán en una sola factura
  albaranIds: z.array(z.string().min(1)).default([]),
  // antiguo: un solo albarán (se sigue aceptando)
  pedidoCompraId: opcional,
  notas: opcional,
  // vacías = se copian las líneas de los albaranes enlazados (con su producto)
  lineas: z.array(LineaFacturaEsquema),
});
export type FacturaRecibidaDatos = z.infer<typeof FacturaRecibidaEsquema>;

export const FacturaEmitidaEsquema = z.object({
  sociedadId: z.string().min(1, "Elige la sociedad"),
  centroId: opcional,
  origen: z.enum(["EVENTO", "CATERING", "ENTRE_SOCIEDADES", "OTRO"]),
  clienteNombre: texto(200).min(1, "Falta el cliente"),
  clienteCif: opcional,
  sociedadDestinoId: opcional,
  fecha: fechaISO,
  vencimiento: fechaOpcional,
  notas: opcional,
  lineas: z.array(LineaFacturaEsquema).min(1, "La factura necesita al menos una línea"),
});
export type FacturaEmitidaDatos = z.infer<typeof FacturaEmitidaEsquema>;

export const EmitidaFueraEsquema = z.object({
  id: z.string().min(1),
  numeroOficial: texto(60).min(1, "Falta el número que dio el programa certificado"),
  programaEmisor: texto(100).min(1, "Indica en qué programa se emitió"),
});

export const GastoEsquema = z.object({
  sociedadId: z.string().min(1, "Elige la sociedad"),
  centroId: opcional,
  categoriaId: z.string().min(1, "Elige la categoría"),
  fecha: fechaISO,
  vencimiento: fechaOpcional,
  concepto: texto(300).min(1, "Falta el concepto"),
  proveedorNombre: opcional,
  base: importe.pipe(z.number().positive("El importe sin IVA tiene que ser mayor que cero (los abonos y devoluciones no se apuntan como gasto)")),
  tipoIva: z.coerce.number().refine((v) => (TIPOS_IVA as readonly number[]).includes(v), "Tipo de IVA no válido"),
  recurrente: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  notas: opcional,
});
export type GastoDatos = z.infer<typeof GastoEsquema>;

export const PagoEsquema = z.object({
  id: z.string().min(1),
  fecha: fechaISO,
  forma: z.enum(["TRANSFERENCIA", "DOMICILIACION", "TARJETA", "EFECTIVO", "OTRA"]),
  referencia: opcional,
});
export type PagoDatos = z.infer<typeof PagoEsquema>;

export const CategoriaEsquema = z.object({
  codigo: texto(20).min(1, "Falta el código").transform((v) => v.toUpperCase()),
  nombre: texto(100).min(1, "Falta el nombre"),
  grupo: z.enum(["MERCANCIA", "PERSONAL", "GASTO_FIJO", "GASTO_VARIABLE", "INGRESO"]),
  cuentaGestoria: opcional,
});
export type CategoriaDatos = z.infer<typeof CategoriaEsquema>;

export const FacturarObradorEsquema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido"),
  // vacío = todos los locales con pedidos por facturar
  destinoIds: z.array(z.string().min(1)).default([]),
});

export const ExportarEsquema = z.object({
  sociedadId: z.string().min(1, "Elige la sociedad"),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido"),
});

/** Lee las líneas de un formulario con campos linea_<campo>_<n> (filas vacías se ignoran). Los números los lee el esquema. */
export function lineasDeFormulario(form: FormData, maximo = 20) {
  const lineas: Record<string, unknown>[] = [];
  for (let i = 0; i < maximo; i++) {
    const concepto = String(form.get(`linea_concepto_${i}`) ?? "").trim();
    const precio = String(form.get(`linea_precio_${i}`) ?? "").trim();
    if (!concepto && !precio) continue;
    lineas.push({
      concepto,
      cantidad: String(form.get(`linea_cantidad_${i}`) ?? "").trim() || "1",
      precio,
      tipoIva: form.get(`linea_iva_${i}`) ?? "21",
      categoriaId: form.get(`linea_categoria_${i}`) ?? "",
    });
  }
  return lineas;
}

/** Campos del formulario (sin las líneas). Los números se leen en el esquema con numeroEs, que entiende la coma. */
export function objetoDeFormulario(form: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("linea_") || k.startsWith("$ACTION")) continue;
    o[k] = v;
  }
  return o;
}
