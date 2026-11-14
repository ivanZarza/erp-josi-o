import { z } from "zod";
import { leerNumeroES } from "@/nucleo/comun-almacen";

/** Validación de los formularios de Bebidas y Comidas (motor común de almacén). */

export const EsquemaArea = z.enum(["BEBIDAS", "COMIDAS"]);

export const UNIDADES = ["UD", "BOTELLA", "KG", "L", "CAJA", "LATA", "BARRIL", "PAQUETE", "BANDEJA"] as const;
export const TIPOS_IVA = ["0", "4", "10", "21"] as const;

const id = z.string().trim().min(1, "Falta un dato obligatorio.").max(40);
const idOpcional = z
  .string()
  .trim()
  .max(40)
  .optional()
  .default("")
  .transform((v) => (v === "" ? null : v));
const texto = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : v));

/** Número escrito a la española («1,5»). Vacío → null. */
export const numeroOpcional = (nombre: string, { min = 0 }: { min?: number } = {}) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v, c) => {
      if (v.trim() === "") return null;
      const n = leerNumeroES(v);
      if (n === null || n < min) {
        c.addIssue({ code: "custom", message: `${nombre}: no es un número válido.` });
        return z.NEVER;
      }
      return n;
    });
const numeroObligatorio = (nombre: string, opciones?: { min?: number }) =>
  numeroOpcional(nombre, opciones).transform((v, c) => {
    if (v === null) {
      c.addIssue({ code: "custom", message: `${nombre}: es obligatorio.` });
      return z.NEVER;
    }
    return v;
  });

export const EsquemaProducto = z.object({
  referencia: z.string().trim().min(1, "La referencia es obligatoria.").max(40),
  nombre: z.string().trim().min(2, "El nombre es obligatorio.").max(150),
  familiaId: idOpcional,
  nuevaFamilia: texto(60),
  proveedorId: idOpcional,
  unidad: z.enum(UNIDADES, { message: "Unidad no válida." }),
  unidadesCompra: numeroObligatorio("Unidades por formato de compra", { min: 0.001 }),
  costeUnitario: numeroObligatorio("Coste"),
  sinCoste: z.boolean(),
  motivoSinCoste: texto(200),
  iva: z.enum(TIPOS_IVA, { message: "IVA no válido." }).transform(Number),
  stockMinimo: numeroOpcional("Mínimo").transform((v) => v ?? 0),
  codigoBarras: texto(40),
});

export const EsquemaAjusteCentro = z.object({
  productoId: id,
  centroId: id,
  activo: z.boolean(),
  minimo: numeroOpcional("Mínimo"),
  maximo: numeroOpcional("Máximo"),
  precioVenta: numeroOpcional("Tarifa al centro"),
});

export const EsquemaMerma = z.object({
  productoId: id,
  centroId: id,
  cantidad: numeroObligatorio("Cantidad", { min: 0.001 }),
  motivo: z.string().trim().min(1, "Elige el motivo de la merma.").max(60),
  nota: texto(200),
});

export const EsquemaPedidoNuevo = z.object({ origenId: id, destinoId: id, notas: texto(500) });
export const EsquemaCompraNueva = z.object({ proveedorId: id, centroId: id, notas: texto(500) });
export const EsquemaInventarioNuevo = z.object({ centroId: id, nombre: texto(80) });
export const EsquemaEnvio = z.enum(["whatsapp", "email", "telefono"]);

/**
 * Lee del formulario los campos `<prefijo><id>` como números a la española.
 * Vacío → null. Lanza ZodError si alguno no es un número válido.
 */
export function leerCantidades(form: FormData, prefijo: string, { quitarVacios = false }: { quitarVacios?: boolean } = {}): Map<string, number | null> {
  const m = new Map<string, number | null>();
  const malos: string[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith(prefijo) || typeof v !== "string") continue;
    const clave = k.slice(prefijo.length);
    if (v.trim() === "") {
      if (!quitarVacios) m.set(clave, null);
      continue;
    }
    const n = leerNumeroES(v);
    if (n === null || n < 0) malos.push(v);
    else m.set(clave, n);
  }
  if (malos.length) throw new z.ZodError([{ code: "custom", path: [prefijo], message: `Hay cantidades que no son números: ${malos.slice(0, 3).join(", ")}.`, input: malos }]);
  return m;
}
