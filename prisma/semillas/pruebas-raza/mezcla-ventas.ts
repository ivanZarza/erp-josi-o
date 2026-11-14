/**
 * Mezcla de ventas de Raza Pruebas: UNA sola definición de lo que se vende, para que lo que compran las
 * partes de cocina y bebidas cuadre con lo que venden los tickets de la parte de caja.
 *
 * - CUBIERTOS: cubiertos previstos por día de la semana (la media de las reservas del local).
 * - POR_COMENSAL: unidades de cada grupo de la carta por comensal (lo que pide la mesa media en caja.ts).
 * - Pesos dentro de cada grupo: los platos de comida con la previsión por 100 cubiertos de cocina.ts; las
 *   bebidas con las ventas por semana de bebidas.ts; los vinos por sección (Ribera y Rioja de crianza los que
 *   más) y precio (se piden más los de precio bajo y medio).
 * cocina.ts y bebidas.ts usan `previsionPorComensal` para planificar compras y pedidos (no escriben consumo);
 * caja.ts elige los platos de cada mesa con los mismos grupos y pesos, mirando el stock.
 */

/** Cubiertos previstos por día de la semana (0 domingo … 6 sábado). */
export const CUBIERTOS: Record<number, number> = { 0: 140, 1: 70, 2: 88, 3: 103, 4: 145, 5: 195, 6: 230 };
export const CUBIERTOS_SEMANA = Object.values(CUBIERTOS).reduce((s, x) => s + x, 0);

export type Grupo = "pan" | "entrante" | "corte" | "principal" | "guarnicion" | "postre" | "vino" | "copaVino" | "generoso" | "agua" | "cerveza" | "vermut" | "copa" | "cafe" | "dulce" | "demanda";

/** Grupo de venta de una sección de la carta (y del formato, para las copas de vino). */
export function grupoDe(seccion: string, formato?: string | null): Grupo | null {
  const s = seccion.toLowerCase();
  if (s === "servicio") return "pan";
  if (s.startsWith("de la huerta") || s.startsWith("entrantes")) return "entrante";
  if (s.startsWith("raza selección")) return "corte";
  if (s === "pastas" || s === "pescados" || s === "otras especialidades") return "principal";
  if (s === "guarniciones") return "guarnicion";
  if (s === "postres") return "postre";
  if (s.startsWith("generosos")) return "generoso";
  if (s.startsWith("vinos dulces")) return "dulce";
  if (s.startsWith("aguas")) return "agua";
  if (s === "cervezas") return "cerveza";
  if (s === "vermut") return "vermut";
  if (s.startsWith("copas")) return "copa";
  if (s.startsWith("cafés")) return "cafe";
  if (s.startsWith("proyecto")) return "demanda";
  if (/^(blancos|tintos|rosados|espumosos|formato)/.test(s)) return formato === "Copa" ? "copaVino" : "vino";
  return null;
}

/**
 * Unidades por comensal de cada grupo. Una parrilla de carne madurada: pan y aperitivo a todos, casi un
 * entrante y un corte por persona, una botella de vino cada 2,8 personas, cafés y alguna copa.
 */
export const POR_COMENSAL: Record<Grupo, number> = {
  pan: 1,
  entrante: 0.85,
  corte: 0.62,
  principal: 0.13,
  guarnicion: 0.5,
  postre: 0.55,
  vino: 0.34,
  copaVino: 0.1,
  generoso: 0.03,
  dulce: 0.02,
  agua: 0.47,
  cerveza: 0.28,
  vermut: 0.03,
  cafe: 0.62,
  copa: 0.14,
  demanda: 0,
};

/** Peso de cada sección de vinos (Ribera y Rioja de crianza son los que más salen). */
const PESO_VINO: [RegExp, number][] = [
  [/^Tintos Ribera del Duero · Crianza/, 30], [/^Tintos Rioja · Crianza/, 25], [/^Tintos de la tierra/, 10], [/^Blancos · Rueda/, 7], [/^Blancos · Rías/, 5],
  [/^Blancos · Otras/, 2], [/^Blancos · De Castilla/, 1.5], [/^Tintos Ribera del Duero · Reservas/, 5], [/^Tintos Rioja · Grandes/, 3], [/^Tintos Toro/, 3],
  [/^Rosados/, 1.5], [/^Espumosos · Corpinnat/, 1.5], [/^Espumosos · A.O.C./, 1], [/^Tintos internacionales/, 1], [/^Formato magnum/, 0.8],
];

export interface ArticuloMezcla {
  /** Clave con la que se busca después (por ejemplo «nombre|formato»). */
  clave: string;
  seccion: string;
  formato: string | null;
  precio: number;
  /** El plato tiene varios formatos (botella y mágnum de Malleolus o Mauro). */
  variosFormatos?: boolean;
  /** Peso propio (previsión de cocina o ventas por semana de bebidas); si no, el de los vinos o 1. */
  peso?: number;
}

/** Peso de un artículo dentro de su grupo. */
export function pesoArticulo(a: ArticuloMezcla, grupo: Grupo): number {
  if (grupo === "vino" || grupo === "copaVino") {
    if (grupo === "vino" && a.formato === "Mágnum" && a.variosFormatos) return 0.3;
    const sec = PESO_VINO.find(([re]) => re.test(a.seccion))?.[1] ?? 0.5;
    const precio = grupo === "copaVino" ? a.precio * 4.5 : a.precio; // la copa, por el precio de su botella
    return sec * Math.pow(30 / Math.max(28, precio), 1.6);
  }
  return a.peso ?? 1;
}

/** Unidades previstas por comensal de cada artículo: lo del grupo repartido por pesos. */
export function previsionPorComensal(articulos: ArticuloMezcla[]): Map<string, number> {
  const porGrupo = new Map<Grupo, { a: ArticuloMezcla; w: number }[]>();
  for (const a of articulos) {
    const g = grupoDe(a.seccion, a.formato);
    if (!g || !(a.precio > 0)) continue;
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), { a, w: pesoArticulo(a, g) }]);
  }
  const mapa = new Map<string, number>();
  for (const [g, lista] of porGrupo) {
    const total = lista.reduce((s, x) => s + x.w, 0);
    for (const { a, w } of lista) mapa.set(a.clave, total > 0 ? (POR_COMENSAL[g] * w) / total : 0);
  }
  return mapa;
}
