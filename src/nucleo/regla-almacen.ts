/**
 * Regla del almacén por defecto (núcleo de stock). Sin "server-only" a propósito: la usan también
 * las semillas (prisma/semillas/pruebas-raza/almacenes.ts) para ubicar los movimientos antiguos.
 *
 * Orden para decidir en qué almacén entra o sale un producto de un centro:
 * 1. El almacén puesto a mano en ProductoCentro.almacenId (ajustes del producto en ese centro).
 * 2. Si no, la regla por área y familia, buscando por nombre entre los almacenes activos del centro:
 *    - Bebidas: cervezas, refrescos, aguas, zumos y cafetería → Barra (si no hay, Bodega);
 *      el resto (vinos, licores…) → Bodega (si no hay, Barra).
 *    - Comidas: congelados y helados → Congelador (si no hay, Cámara);
 *      carnes, pescados, verduras, lácteos, elaborados… (refrigerados) → Cámara;
 *      seco y despensa → Seco.
 *    - Consumibles → Seco.
 *    Si el centro no tiene ninguno de esos, el primer almacén activo (por nombre).
 * 3. Si el centro no tiene almacenes: sin almacén («Sin ubicar»).
 * Ver docs/specs/nucleo/stock-y-pedidos.md §Almacenes.
 */

/** Nombre normalizado para comparar: minúsculas y sin tildes. */
export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface ProductoParaRegla {
  area: "BEBIDAS" | "COMIDAS" | "CONSUMIBLES";
  nombre: string;
  familia: string | null;
}

export interface AlmacenParaRegla {
  id: string;
  nombre: string;
}

/** Nombres de almacén preferidos para un producto, de más a menos preferido. */
export function preferenciasAlmacen(p: ProductoParaRegla): string[] {
  const fam = normalizarNombre(p.familia ?? "");
  const nom = normalizarNombre(p.nombre);
  if (p.area === "BEBIDAS") {
    if (/cervez|refresc|agua|zumo|cafe|infusion|\bte\b/.test(fam)) return ["barra", "bodega"];
    return ["bodega", "barra"];
  }
  if (p.area === "COMIDAS") {
    if (/congel|helad/.test(fam) || /congelad|helado/.test(nom)) return ["congelador", "camara"];
    if (/seco|despensa|conserva|ultramarino/.test(fam)) return ["seco", "camara"];
    return ["camara", "congelador", "seco"];
  }
  return ["seco"];
}

/** Elige el almacén por la regla entre los almacenes activos del centro (null si el centro no tiene). */
export function almacenPorRegla(p: ProductoParaRegla, almacenes: AlmacenParaRegla[]): string | null {
  if (almacenes.length === 0) return null;
  for (const pref of preferenciasAlmacen(p)) {
    const a = almacenes.find((x) => normalizarNombre(x.nombre).includes(pref));
    if (a) return a.id;
  }
  return [...almacenes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))[0].id;
}
