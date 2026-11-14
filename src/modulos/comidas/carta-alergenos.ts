/**
 * Alérgenos y cálculos de escandallo comunes a Carta (Comidas) y Obrador.
 * Sin dependencias: lo usan también las semillas.
 */

/** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011, anexo II). */
export const ALERGENOS = [
  { clave: "GLUTEN", nombre: "Gluten", en: "Gluten" },
  { clave: "CRUSTACEOS", nombre: "Crustáceos", en: "Crustaceans" },
  { clave: "HUEVOS", nombre: "Huevos", en: "Eggs" },
  { clave: "PESCADO", nombre: "Pescado", en: "Fish" },
  { clave: "CACAHUETES", nombre: "Cacahuetes", en: "Peanuts" },
  { clave: "SOJA", nombre: "Soja", en: "Soy" },
  { clave: "LECHE", nombre: "Leche", en: "Milk" },
  { clave: "FRUTOS_CASCARA", nombre: "Frutos de cáscara", en: "Tree nuts" },
  { clave: "APIO", nombre: "Apio", en: "Celery" },
  { clave: "MOSTAZA", nombre: "Mostaza", en: "Mustard" },
  { clave: "SESAMO", nombre: "Sésamo", en: "Sesame" },
  { clave: "SULFITOS", nombre: "Sulfitos", en: "Sulphites" },
  { clave: "ALTRAMUCES", nombre: "Altramuces", en: "Lupin" },
  { clave: "MOLUSCOS", nombre: "Moluscos", en: "Molluscs" },
] as const;

export type ClaveAlergeno = (typeof ALERGENOS)[number]["clave"];

const CLAVES = new Set<string>(ALERGENOS.map((a) => a.clave));

export function nombreAlergeno(clave: string): string {
  return ALERGENOS.find((a) => a.clave === clave)?.nombre ?? clave;
}

/** Deja solo claves válidas, sin repetir y en el orden oficial. */
export function normalizarAlergenos(lista: Iterable<string>): string[] {
  const s = new Set(Array.from(lista).filter((c) => CLAVES.has(c)));
  return ALERGENOS.map((a) => a.clave).filter((c) => s.has(c));
}

export function unirAlergenos(...listas: Iterable<string>[]): string[] {
  const todo: string[] = [];
  for (const l of listas) todo.push(...l);
  return normalizarAlergenos(todo);
}

/** Cantidad bruta que hay que sacar del almacén para obtener la neta con esa merma (%). */
export function cantidadBruta(neta: number, mermaPct: number): number {
  const m = Math.min(Math.max(mermaPct, 0), 95) / 100;
  return neta / (1 - m);
}

/** Precio sin IVA a partir del PVP con IVA. */
export function sinIva(pvp: number, ivaPct: number): number {
  return pvp / (1 + ivaPct / 100);
}

/** % de coste de mercancía sobre el precio sin IVA (0 si no hay precio). */
export function porcentajeCoste(coste: number, pvp: number, ivaPct: number): number {
  const base = sinIva(pvp, ivaPct);
  return base > 0 ? (coste / base) * 100 : 0;
}

/** Redondeo a n decimales sin usar toFixed (para guardar, no para mostrar). */
export function redondear(v: number, decimales = 4): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}
