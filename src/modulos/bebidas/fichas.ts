import "server-only";
/**
 * Fichas de vino (tabla FichaVino de prisma/schema/bebidas.prisma). Sin dependencias de otros módulos:
 * la usa la Carta para pasar de centilitros a parte de botella y mostrar la capacidad.
 */
import type { Tx } from "@/nucleo/movimientos";

export const TIPOS_VINO = [
  { clave: "TINTO", nombre: "Tinto", plural: "Tintos" },
  { clave: "BLANCO", nombre: "Blanco", plural: "Blancos" },
  { clave: "ROSADO", nombre: "Rosado", plural: "Rosados" },
  { clave: "ESPUMOSO", nombre: "Espumoso", plural: "Espumosos" },
  { clave: "GENEROSO", nombre: "Generoso", plural: "Generosos" },
  { clave: "DULCE", nombre: "Dulce", plural: "Dulces" },
] as const;
export type ClaveTipoVino = (typeof TIPOS_VINO)[number]["clave"];

export const CRIANZAS = ["Joven", "Roble", "Crianza", "Reserva", "Gran reserva", "Sobre lías", "Biológica", "Oxidativa"];

export function nombreTipoVino(tipo: string | null | undefined): string {
  return TIPOS_VINO.find((t) => t.clave === tipo)?.nombre ?? "Sin tipo";
}

export interface DatosFichaVino {
  productoId: string;
  bodega: string | null;
  denominacion: string | null;
  uva: string | null;
  anada: number | null;
  capacidadCl: number;
  tipo: ClaveTipoVino | null;
  crianza: string | null;
  notasCata: string | null;
  maridaje: string | null;
  argumentoVenta: string | null;
}

/** Fichas de vino de una lista de productos (productoId → ficha). */
export async function fichasDeProductos(tx: Tx, tenantId: string, productoIds: string[]): Promise<Map<string, DatosFichaVino>> {
  const mapa = new Map<string, DatosFichaVino>();
  if (productoIds.length === 0) return mapa;
  const filas = await tx.fichaVino.findMany({ where: { tenantId, productoId: { in: productoIds } } });
  for (const f of filas)
    mapa.set(f.productoId, {
      productoId: f.productoId,
      bodega: f.bodega,
      denominacion: f.denominacion,
      uva: f.uva,
      anada: f.anada,
      capacidadCl: Number(f.capacidadCl),
      tipo: f.tipo,
      crianza: f.crianza,
      notasCata: f.notasCata,
      maridaje: f.maridaje,
      argumentoVenta: f.argumentoVenta,
    });
  return mapa;
}
