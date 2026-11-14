import { z } from "zod";

/**
 * Teléfono SIEMPRE en formato internacional (+34…), para que el enlace de WhatsApp funcione.
 * - Quita espacios, guiones, puntos y paréntesis; «0034…» pasa a «+34…».
 * - Un número español de 9 cifras escrito sin prefijo (6…, 7…, 8…, 9…) se completa con +34.
 * - Se rechaza el fallo de BODEGA 360: «+638202002» (móvil español con + pero sin el 34).
 */
export function normalizarTelefono(texto: string): { ok: true; valor: string | null } | { ok: false; error: string } {
  let s = texto.trim().replace(/[\s\-.()]/g, "");
  if (s === "") return { ok: true, valor: null };
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^[6789]\d{8}$/.test(s)) s = `+34${s}`;
  if (!s.startsWith("+")) return { ok: false, error: "El teléfono tiene que ir en formato internacional, empezando por + y el prefijo del país (+34 en España)." };
  if (/^\+[6789]\d{8}$/.test(s)) return { ok: false, error: `Parece un número español sin el 34: escribe +34${s.slice(1)}.` };
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return { ok: false, error: "El teléfono no es válido: + , prefijo del país y entre 8 y 15 cifras." };
  if (s.startsWith("+34") && s.length !== 12) return { ok: false, error: "Un teléfono español lleva +34 y 9 cifras." };
  return { ok: true, valor: s };
}

const textoOpcional = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const EsquemaProveedor = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del proveedor.").max(150),
  cif: textoOpcional,
  contacto: textoOpcional,
  telefono: z
    .string()
    .optional()
    .default("")
    .transform((v, c) => {
      const r = normalizarTelefono(v);
      if (!r.ok) {
        c.addIssue({ code: "custom", message: r.error });
        return z.NEVER;
      }
      return r.valor;
    }),
  email: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || z.email().safeParse(v).success, "El correo no es válido.")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  areas: z.array(z.enum(["BEBIDAS", "COMIDAS", "CONSUMIBLES"])).default([]),
  diasReparto: textoOpcional,
  pedidoMinimo: z
    .string()
    .optional()
    .default("")
    .transform((v, c) => {
      const s = v.trim().replace(/\s|€/g, "");
      if (s === "") return null;
      const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
      if (!Number.isFinite(n) || n < 0) {
        c.addIssue({ code: "custom", message: "El pedido mínimo no es un importe válido." });
        return z.NEVER;
      }
      return n;
    }),
  notas: textoOpcional,
});

export type DatosProveedor = z.infer<typeof EsquemaProveedor>;
