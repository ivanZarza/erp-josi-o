/**
 * Crea el local «Raza Pruebas» y ejecuta las partes en orden.
 * Se usa desde prisma/seed.ts (al final) y desde prisma/seed-pruebas-raza.ts (sobre una base ya cargada).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "../../../src/generated/prisma/client";
import type { ContextoSemilla } from "../index";
import { CODIGO_PRUEBAS, type CartaRaza, type ContextoPruebas, type SembrarParte } from "./contexto";
import { sembrar as cocina } from "./cocina";
import { sembrar as bebidas } from "./bebidas";
import { sembrar as personal } from "./personal";
import { sembrar as sala } from "./sala";
import { sembrar as caja } from "./caja";
import { sembrar as contabilidad } from "./contabilidad";
import { sembrar as almacenes } from "./almacenes";

/** Orden obligatorio: las partes de la segunda ola usan lo creado por la primera. */
export const PARTES: Record<string, SembrarParte> = {
  cocina, // ola 1: catálogo de cocina, platos y escandallos, obrador
  bebidas, // ola 1: vinos de la carta + resto de bebidas
  personal, // ola 1: plantilla, cuadrantes, fichajes, nóminas
  sala, // ola 1: reservas, clientes, eventos, calidad
  contabilidad, // ola 2: facturas, gastos, nóminas en contabilidad
  caja, // ola 2: ventas y cierres (usa platos y bebidas) y cuadro de mando; va la última para que los indicadores incluyan los gastos
  almacenes, // ubica en su almacén los movimientos sin almacén y añade traspasos de ejemplo
};

const MODULOS_LOCAL = ["bebidas", "comidas", "caja", "personal", "contabilidad", "cuadro", "calidad", "reservas", "eventos", "clientes", "webs"];

export async function sembrarPruebasRaza(prisma: PrismaClient, base: ContextoSemilla, solo?: string[]) {
  let centro = await prisma.centro.findFirst({ where: { tenantId: base.tenantId, codigo: CODIGO_PRUEBAS } });
  if (!centro) {
    const edificio = await prisma.edificio.create({
      data: { tenantId: base.tenantId, direccion: "C/ de las Pruebas 1", cp: "28001", ciudad: "Madrid", comunidad: "Madrid" },
    });
    centro = await prisma.centro.create({
      data: {
        tenantId: base.tenantId, codigo: CODIGO_PRUEBAS, nombre: "Raza Pruebas", tipo: "LOCAL", estado: "ABIERTO",
        marcaId: base.marcas.RAZA, sociedadId: base.sociedades.IHA, edificioId: edificio.id,
        telefono: "+34910000000", email: "pruebas@erp.local", horaCorte: "05:00",
        datos: { nota: "Local inventado para probar el ERP con la carta real de Raza Madrid (10/2026)" },
      },
    });
    await prisma.centroModulo.createMany({ data: MODULOS_LOCAL.map((modulo) => ({ centroId: centro!.id, modulo })) });
    await prisma.almacen.createMany({
      data: ["Cámara", "Congelador", "Seco", "Bodega", "Barra"].map((nombre) => ({ centroId: centro!.id, nombre })),
    });
  }
  const almacenes = await prisma.almacen.findMany({ where: { centroId: centro.id } });
  const carta = JSON.parse(readFileSync(join(__dirname, "..", "datos", "carta-raza-2026-10.json"), "utf8")) as CartaRaza;
  const ctx: ContextoPruebas = {
    ...base,
    centros: { ...base.centros, [CODIGO_PRUEBAS]: centro.id },
    centroPruebas: centro.id,
    almacenesPruebas: Object.fromEntries(almacenes.map((a) => [a.nombre, a.id])),
    carta,
    hoy: new Date(),
  };
  for (const [nombre, parte] of Object.entries(PARTES)) {
    if (solo && !solo.includes(nombre)) continue;
    await parte(prisma, ctx);
    console.log(`Raza Pruebas, parte ${nombre}: hecha`);
  }
}
