/**
 * Comprueba que todas las pantallas (page.tsx de src/app) tienen ayuda en src/ayuda y que no sobra ninguna.
 * Uso: npm run ayuda:comprobar  (sale con error si falta algo)
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AYUDA } from "../src/ayuda";

function pantallas(dir: string, base = ""): string[] {
  const res: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      // los grupos "(backoffice)" no forman parte de la dirección
      const tramo = nombre.startsWith("(") ? "" : `/${nombre}`;
      res.push(...pantallas(ruta, base + tramo));
    } else if (nombre === "page.tsx") res.push(base || "/");
  }
  return res;
}

const todas = pantallas(join(__dirname, "../src/app")).filter((r) => r !== "/ayuda").sort();
const faltan = todas.filter((r) => !AYUDA[r]);
const sobran = Object.keys(AYUDA).filter((k) => !todas.includes(k));
const flojas = Object.entries(AYUDA)
  .filter(([, p]) => !p.secciones.length || p.secciones.some((s) => !s.campos.length))
  .map(([k]) => k);

console.log(`Pantallas: ${todas.length} · con ayuda: ${todas.length - faltan.length}`);
if (faltan.length) console.log(`Sin ayuda (${faltan.length}):\n  ${faltan.join("\n  ")}`);
if (sobran.length) console.log(`Ayuda de pantallas que no existen (${sobran.length}):\n  ${sobran.join("\n  ")}`);
if (flojas.length) console.log(`Ayuda sin campos (${flojas.length}):\n  ${flojas.join("\n  ")}`);
if (faltan.length || sobran.length || flojas.length) process.exit(1);
console.log("Todas las pantallas tienen ayuda.");
