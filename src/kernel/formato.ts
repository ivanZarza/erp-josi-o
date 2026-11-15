/** Formato español en toda la app: 26.157,46 € · 1.842 · 08/11/2026 (specs/06_diseno.md §1) */
type Num = number | string | { toString(): string } | null | undefined;

function aNumero(v: Num): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export function euros(v: Num, decimales = 2): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: "always" }).format(aNumero(v));
}

export function numero(v: Num, maxDecimales = 2): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: maxDecimales, useGrouping: "always" }).format(aNumero(v));
}

export function porcentaje(v: Num, decimales = 1): string {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: decimales }).format(aNumero(v) / 100);
}

export function fecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(d));
}

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(d));
}

export { aNumero };

/** Valor inicial de una casilla de número: «6,5», «1500» (sin separador de miles, para que se pueda editar). */
export function numeroCampo(v: Num): string {
  if (v === null || v === undefined || v === "") return "";
  return String(aNumero(v)).replace(".", ",");
}

/**
 * Lee un número escrito a mano en formato español o con punto: «6,5», «1.234,5», «1.500» (mil quinientos), «6.5».
 * Devuelve el texto tal cual si no es un número, para que zod dé su mensaje de error.
 */
export function leerNumero(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().replace(/\s/g, "").replace(/€|%/g, "");
  if (t === "") return v;
  let normal = t;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : v;
}
