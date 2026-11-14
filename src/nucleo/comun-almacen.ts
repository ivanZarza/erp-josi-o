import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Utilidades comunes del motor de almacén (Bebidas y Comidas).
 * Ver docs/specs/nucleo/stock-y-pedidos.md.
 */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Áreas que tienen almacén propio en el backoffice. */
export type AreaAlmacen = "BEBIDAS" | "COMIDAS";
export const AREAS_ALMACEN: AreaAlmacen[] = ["BEBIDAS", "COMIDAS"];

/** Id del módulo (y prefijo de permisos y rutas) de cada área. */
export function moduloDeArea(area: AreaAlmacen): "bebidas" | "comidas" {
  return area === "BEBIDAS" ? "bebidas" : "comidas";
}

/** Umbral de descuadre de inventario (en € y en valor absoluto) por encima del cual el cierre necesita aprobación. */
export const UMBRAL_APROBACION_INVENTARIO = 500;

/** Error de negocio: su mensaje se enseña tal cual al usuario. */
export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

/** Redondeo de cantidades (3 decimales, como la base). */
export function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
/** Redondeo de costes unitarios (4 decimales, como la base). */
export function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
/** Redondeo de importes (céntimos). */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Decimal de Prisma (o nulo) a número. */
export function num(v: { toString(): string } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lee un número escrito a la española: «1,5», «1.500,25», «12». Devuelve null si está vacío o no es número.
 * Si lleva coma, el punto se toma como separador de miles; si no lleva coma, el punto es decimal.
 */
export function leerNumeroES(texto: unknown): number | null {
  if (texto === null || texto === undefined) return null;
  let s = String(texto).trim().replace(/\s/g, "").replace(/€/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Centros de los que se puede pedir (obradores y almacenes centrales de la cadena). */
export async function centrosQueSirven(tx: Tx, tenantId: string) {
  return tx.centro.findMany({
    where: { tenantId, tipo: { in: ["OBRADOR", "ALMACEN"] }, estado: { not: "CERRADO" } },
    select: { id: true, codigo: true, nombre: true, tipo: true },
    orderBy: { nombre: "asc" },
  });
}
