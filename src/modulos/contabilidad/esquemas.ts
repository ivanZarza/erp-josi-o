/** Validación (zod) de los formularios de Contabilidad. */
import { z } from "zod";

const texto = (max = 200) => z.string().trim().max(max);
const opcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const fechaOpcional = z.preprocess((v) => (v === "" || v === null ? undefined : v), fechaISO.optional());
const importe = z.coerce.number({ message: "Importe no válido" }).finite();

export const TIPOS_IVA = [21, 10, 4, 0] as const;

export const LineaFacturaEsquema = z.object({
  concepto: texto(300).min(1, "Falta el concepto de una línea"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor que cero"),
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
  categoriaId: opcional,
  notas: opcional,
  lineas: z.array(LineaFacturaEsquema).min(1, "La factura necesita al menos una línea"),
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
  base: importe,
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

export const ExportarEsquema = z.object({
  sociedadId: z.string().min(1, "Elige la sociedad"),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido"),
});

/** Lee las líneas de un formulario con campos linea_<campo>_<n> (filas vacías se ignoran). */
export function lineasDeFormulario(form: FormData, maximo = 20) {
  const lineas: Record<string, unknown>[] = [];
  for (let i = 0; i < maximo; i++) {
    const concepto = String(form.get(`linea_concepto_${i}`) ?? "").trim();
    const precio = String(form.get(`linea_precio_${i}`) ?? "").trim();
    if (!concepto && !precio) continue;
    lineas.push({
      concepto,
      cantidad: decimalEs(form.get(`linea_cantidad_${i}`) || "1"),
      precio: decimalEs(precio),
      tipoIva: form.get(`linea_iva_${i}`) ?? "21",
      categoriaId: form.get(`linea_categoria_${i}`) ?? "",
    });
  }
  return lineas;
}

/** Acepta «1.234,56», «1234,56» o «1234.56». */
export function decimalEs(v: FormDataEntryValue | null): string {
  const s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (s.includes(",")) return s.replace(/\./g, "").replace(",", ".");
  return s;
}

export function objetoDeFormulario(form: FormData, camposDecimales: string[] = []) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("linea_") || k.startsWith("$ACTION")) continue;
    o[k] = camposDecimales.includes(k) ? decimalEs(v) : v;
  }
  return o;
}
