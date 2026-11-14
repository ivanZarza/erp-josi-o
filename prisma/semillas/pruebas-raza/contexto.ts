/**
 * Local de pruebas «Raza Pruebas» (RZ-PRU) con la carta real de Raza Madrid (octubre 2026).
 * Contrato común para todas las partes: cada parte exporta `sembrar(prisma, ctx)` y busca
 * lo que crearon las partes anteriores por código o nombre (no por ids fijos).
 * Datos inventados salvo la carta (platos, vinos, precios y menús), que es la publicada.
 */
import type { PrismaClient } from "../../../src/generated/prisma/client";
import type { ContextoSemilla } from "../index";

export interface PlatoCarta {
  seccion: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  unidad: string | null;
  alergenos: string[] | null;
  notas?: string | null;
}
export interface VinoCarta {
  seccion: string;
  subseccion: string | null;
  nombre: string;
  bodega: string | null;
  do: string | null;
  uva: string | null;
  anada: string | null;
  formato: string | null;
  precio: number | null;
  precio_copa: number | null;
}
export interface MenuCarta {
  nombre: string;
  precio: number | null;
  contenido: string[];
}
export interface CartaRaza {
  marca: string;
  local: string;
  fuente: string[];
  fecha: string;
  comida: PlatoCarta[];
  bebidas: VinoCarta[];
  menus: MenuCarta[];
}

export interface ContextoPruebas extends ContextoSemilla {
  /** Id del centro RZ-PRU (también en ctx.centros["RZ-PRU"]). */
  centroPruebas: string;
  /** Almacenes del local de pruebas por nombre: Cámara, Congelador, Seco, Bodega, Barra. */
  almacenesPruebas: Record<string, string>;
  carta: CartaRaza;
  /** Fecha «hoy» de los datos (todas las partes generan historia hacia atrás desde aquí). */
  hoy: Date;
}

export type SembrarParte = (prisma: PrismaClient, ctx: ContextoPruebas) => Promise<void>;

export const CODIGO_PRUEBAS = "RZ-PRU";
/** Prefijo de referencias de productos creados por estas semillas. */
export const PREFIJO = { comida: "RZC-", bebida: "RZB-", obrador: "RZO-" } as const;
