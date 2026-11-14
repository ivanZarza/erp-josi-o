/**
 * Semillas de cada módulo (solo desarrollo). Cada módulo crea prisma/semillas/<modulo>.ts
 * con `export async function sembrar(prisma, ctx)` y se añade aquí.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import { sembrar as sembrarComidas } from "./comidas";
import { sembrar as sembrarCaja } from "./caja";
import { sembrar as sembrarContabilidad } from "./contabilidad";
import { sembrar as sembrarCuadro } from "./cuadro";
import { sembrar as sembrarClientes } from "./clientes";
import { sembrar as sembrarReservas } from "./reservas";
import { sembrar as sembrarEventos } from "./eventos";
import { sembrar as sembrarPersonal } from "./personal";
import { sembrar as sembrarObrador } from "./obrador";
import { sembrar as sembrarCalidad } from "./calidad";
import { sembrar as sembrarCarta } from "./carta";

export interface ContextoSemilla {
  tenantId: string;
  centros: Record<string, string>; // código del centro → id (VA-AYA, OB…)
  sociedades: Record<string, string>;
  marcas: Record<string, string>;
  familias: Record<string, string>; // "B|Vinos tintos", "C|Carnes" → id
  proveedores: Record<string, string>; // nombre → id
}

export type Sembrar = (prisma: PrismaClient, ctx: ContextoSemilla) => Promise<void>;

export const SEMILLAS_MODULOS: Record<string, Sembrar> = {
  comidas: sembrarComidas,
  caja: sembrarCaja,
  contabilidad: sembrarContabilidad,
  cuadro: sembrarCuadro, // después de caja
  clientes: sembrarClientes, // antes de reservas y eventos
  reservas: sembrarReservas,
  eventos: sembrarEventos, // usa espacios de reservas y clientes
  personal: sembrarPersonal,
  obrador: sembrarObrador, // después de comidas
  calidad: sembrarCalidad,
  carta: sembrarCarta, // después de obrador
};
