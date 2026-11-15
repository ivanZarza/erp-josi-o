/** Qué ayuda corresponde a una ruta real (sin depender del contenido, para usarlo en cliente y en pruebas). */
import type { AyudaArea } from "./tipos";

/** "/bebidas/bodega/[id]" encaja con "/bebidas/bodega/abc123". */
function encaja(patron: string, ruta: string): boolean {
  const p = patron.split("/");
  const r = ruta.split("/");
  return p.length === r.length && p.every((s, i) => (s.startsWith("[") && s.endsWith("]") ? r[i] !== "" : s === r[i]));
}

/** Clave de la ayuda que corresponde a una ruta real del navegador, o null. */
export function claveAyuda(ruta: string, ayuda: AyudaArea): string | null {
  const limpia = ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta;
  if (ayuda[limpia]) return limpia;
  // las rutas fijas ganan a las que tienen parámetros ("/bebidas/compras/nueva" antes que "[id]")
  const candidatas = Object.keys(ayuda).filter((k) => encaja(k, limpia));
  candidatas.sort((a, b) => (a.match(/\[/g)?.length ?? 0) - (b.match(/\[/g)?.length ?? 0));
  return candidatas[0] ?? null;
}
