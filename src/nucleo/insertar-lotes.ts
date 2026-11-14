/**
 * Inserción rápida de muchas filas (núcleo). `createMany` de Prisma gasta unos 0,3 ms por fila preparando la
 * consulta: con decenas de miles de filas (la carga de 8 semanas de tickets o una importación grande del TPV)
 * son decenas de segundos. Aquí cada lote es UNA consulta `INSERT … SELECT * FROM unnest(…)` con una lista por
 * columna. Las mismas filas que con createMany: quien llama da todos los valores (también id y createdAt).
 * Sin "server-only": lo usan también las semillas.
 */
import type { Tx } from "./motor-movimientos";

export type TipoColumna = "text" | "int" | "numeric" | "boolean" | "timestamp" | `enum:${string}`;

const tipoArray = (t: TipoColumna) => (t === "timestamp" ? "timestamp(3)[]" : t === "int" ? "integer[]" : t.startsWith("enum:") ? `"${t.slice(5)}"[]` : `${t}[]`);

function valor(v: unknown, t: TipoColumna): unknown {
  if (v === undefined || v === null) return null;
  if (t === "timestamp") return (v instanceof Date ? v : new Date(String(v))).toISOString(); // UTC, como lo guarda Prisma
  if (t === "numeric") return typeof v === "number" ? v : Number(String(v));
  if (t === "int") return Number(v);
  if (t === "boolean") return Boolean(v);
  return String(v);
}

/** Si hay menos filas que esto, mejor createMany (el camino normal de Prisma). */
export const UMBRAL_LOTE_RAPIDO = 1000;

export async function insertarPorLotes(tx: Tx, tabla: string, columnas: [string, TipoColumna][], filas: Record<string, unknown>[], lote = 5000) {
  const sql = `INSERT INTO "${tabla}" (${columnas.map(([c]) => `"${c}"`).join(", ")}) SELECT * FROM unnest(${columnas.map(([, t], i) => `$${i + 1}::${tipoArray(t)}`).join(", ")})`;
  for (let i = 0; i < filas.length; i += lote) {
    const parte = filas.slice(i, i + lote);
    await tx.$executeRawUnsafe(sql, ...columnas.map(([c, t]) => parte.map((f) => valor(f[c], t))));
  }
}
