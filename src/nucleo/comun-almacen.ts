import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { leerNumero } from "@/kernel/formato";

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
 * Lee un número escrito a mano: «1,5», «1.500,25», «1.500» (mil quinientos), «6.5», «12». Devuelve null si
 * está vacío o no es número. Misma regla que el resto del ERP (leerNumero de src/kernel/formato.ts).
 */
export function leerNumeroES(texto: unknown): number | null {
  if (texto === null || texto === undefined) return null;
  const s = String(texto);
  if (s.trim() === "") return null;
  const n = leerNumero(s);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * ¿Trabaja este centro el área? Igual que el contexto (src/kernel/contexto.ts): si el centro tiene sus
 * áreas configuradas (CentroModulo), las activas; si no, hereda las contratadas por la cadena.
 */
function centroTieneArea(c: { modulos: { modulo: string; activo: boolean }[] }, modulo: string, contratados: Set<string>): boolean {
  return c.modulos.length > 0 ? c.modulos.some((m) => m.activo && m.modulo === modulo) : contratados.has(modulo);
}

/** Módulos contratados y en vigor de la cadena. */
async function modulosContratados(tx: Tx, tenantId: string): Promise<Set<string>> {
  const ahora = new Date();
  const filas = await tx.tenantModulo.findMany({ where: { tenantId, activo: true, OR: [{ hasta: null }, { hasta: { gt: ahora } }] }, select: { modulo: true } });
  return new Set(filas.map((f) => f.modulo));
}

/**
 * Centros de los que se puede pedir en un área: obradores y almacenes centrales abiertos de la cadena
 * que tienen esa área (Bebidas o Comidas) activa.
 */
export async function centrosQueSirven(tx: Tx, tenantId: string, area: AreaAlmacen) {
  const [centros, contratados] = await Promise.all([
    tx.centro.findMany({
      where: { tenantId, tipo: { in: ["OBRADOR", "ALMACEN"] }, estado: { notIn: ["CERRADO", "PREPARACION"] } },
      select: { id: true, codigo: true, nombre: true, tipo: true, modulos: { select: { modulo: true, activo: true } } },
      orderBy: { nombre: "asc" },
    }),
    modulosContratados(tx, tenantId),
  ]);
  const m = moduloDeArea(area);
  return centros.filter((c) => centroTieneArea(c, m, contratados)).map(({ modulos: _m, ...c }) => c);
}
