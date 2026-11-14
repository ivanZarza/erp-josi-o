/**
 * Raza Pruebas · almacenes (va la ÚLTIMA en PARTES, después de cocina, bebidas y caja).
 *
 * 1. Ubica los movimientos de stock sin almacén de RZ-PRU y del obrador (OB) con la regla del almacén
 *    por defecto (src/nucleo/regla-almacen.ts y ProductoCentro.almacenId si está puesto): vinos a la
 *    Bodega, cervezas/refrescos/café a la Barra, refrigerados a la Cámara, congelados al Congelador,
 *    seco al Seco. Con updateMany por lotes (unos segundos para ~20.000 movimientos).
 *    Como todo lo de un producto va al mismo almacén, el stock de cada almacén cuadra con el del centro.
 * 2. Añade 3 traspasos de ejemplo Bodega → Barra en RZ-PRU (vinos que se abren por copas), con su
 *    documento TRA-… Si ya hay traspasos en RZ-PRU, no los repite.
 * Se puede ejecutar varias veces: solo toca lo que siga sin almacén.
 */
import type { PrismaClient } from "../../../src/generated/prisma/client";
import { almacenPorRegla } from "../../../src/nucleo/regla-almacen";
import type { ContextoPruebas } from "./contexto";

const LOTE = 400;

function lotes<T>(xs: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += n) r.push(xs.slice(i, i + n));
  return r;
}

async function ubicarCentro(prisma: PrismaClient, tenantId: string, centroId: string) {
  const [almacenes, sueltos, ajustes] = await Promise.all([
    prisma.almacen.findMany({ where: { centroId, activo: true }, select: { id: true, nombre: true } }),
    prisma.movimientoStock.groupBy({ by: ["productoId"], where: { tenantId, centroId, almacenId: null } }),
    prisma.productoCentro.findMany({ where: { centroId, almacenId: { not: null } }, select: { productoId: true, almacenId: true } }),
  ]);
  if (almacenes.length === 0 || sueltos.length === 0) return 0;
  const productos = await prisma.producto.findMany({
    where: { id: { in: sueltos.map((s) => s.productoId) } },
    select: { id: true, area: true, nombre: true, familia: { select: { nombre: true } } },
  });
  const manual = new Map(ajustes.map((a) => [a.productoId, a.almacenId as string]));
  const porAlmacen = new Map<string, string[]>();
  for (const p of productos) {
    const m = manual.get(p.id);
    const destino = m && almacenes.some((a) => a.id === m) ? m : almacenPorRegla({ area: p.area, nombre: p.nombre, familia: p.familia?.nombre ?? null }, almacenes);
    if (!destino) continue;
    porAlmacen.set(destino, [...(porAlmacen.get(destino) ?? []), p.id]);
  }
  let total = 0;
  for (const [almacenId, ids] of porAlmacen) {
    for (const l of lotes(ids, LOTE)) {
      const r = await prisma.movimientoStock.updateMany({ where: { tenantId, centroId, almacenId: null, productoId: { in: l } }, data: { almacenId } });
      total += r.count;
    }
  }
  return total;
}

async function traspasosEjemplo(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const centroId = ctx.centroPruebas;
  const bodega = ctx.almacenesPruebas["Bodega"];
  const barra = ctx.almacenesPruebas["Barra"];
  if (!bodega || !barra) return 0;
  const ya = await prisma.movimientoStock.count({ where: { tenantId: t, centroId, tipo: "TRASPASO" } });
  if (ya > 0) return 0;

  // vinos con stock en la Bodega (los que más hay primero)
  const stock = await prisma.movimientoStock.groupBy({
    by: ["productoId"],
    where: { tenantId: t, centroId, almacenId: bodega, producto: { area: "BEBIDAS" } },
    _sum: { cantidad: true },
  });
  const conStock = stock.map((s) => ({ productoId: s.productoId, hay: Number(s._sum.cantidad ?? 0) })).filter((s) => s.hay >= 4);
  const productos = await prisma.producto.findMany({ where: { id: { in: conStock.map((s) => s.productoId) }, familia: { nombre: { startsWith: "Vinos" } } }, select: { id: true, costeUnitario: true } });
  const coste = new Map(productos.map((p) => [p.id, Number(p.costeUnitario)]));
  const vinos = conStock.filter((s) => coste.has(s.productoId)).sort((a, b) => b.hay - a.hay).slice(0, 12);
  if (vinos.length === 0) return 0;

  const usuario = await prisma.usuario.findFirst({ where: { tenantId: t, activo: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const anio = new Date().getFullYear();
  const notas = ["Reposición del fin de semana", "Vinos por copas", "Reposición para la cena de grupo"];
  let hechos = 0;
  for (let i = 0; i < 3; i++) {
    const grupo = vinos.filter((_, j) => j % 3 === i).slice(0, 4);
    if (grupo.length === 0) continue;
    const c = await prisma.contador.upsert({
      where: { tenantId_serie_anio: { tenantId: t, serie: "TRA", anio } },
      create: { tenantId: t, serie: "TRA", anio, valor: 1 },
      update: { valor: { increment: 1 } },
    });
    const documento = `TRA-${anio}-${String(c.valor).padStart(6, "0")}`;
    const fecha = new Date(ctx.hoy.getTime() - (6 - i * 2) * 86_400_000);
    fecha.setHours(11 + i, 30, 0, 0);
    const motivo = `Bodega → Barra: ${notas[i]}`;
    await prisma.movimientoStock.createMany({
      data: grupo.flatMap((v, k) => {
        const cantidad = Math.min(2 + ((i + k) % 3), Math.floor(v.hay / 2));
        const comun = { tenantId: t, centroId, productoId: v.productoId, tipo: "TRASPASO" as const, costeUnitario: coste.get(v.productoId) ?? 0, documento, motivo, usuarioId: usuario?.id, createdAt: fecha };
        return [
          { ...comun, almacenId: bodega, cantidad: -cantidad },
          { ...comun, almacenId: barra, cantidad },
        ];
      }),
    });
    hechos++;
  }
  return hechos;
}

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const centros = [ctx.centroPruebas, ctx.centros["OB"]].filter(Boolean) as string[];
  for (const c of centros) {
    const n = await ubicarCentro(prisma, ctx.tenantId, c);
    if (n > 0) console.log(`  almacenes: ${n} movimientos ubicados en ${c === ctx.centroPruebas ? "RZ-PRU" : "OB"}`);
  }
  const t = await traspasosEjemplo(prisma, ctx);
  if (t > 0) console.log(`  almacenes: ${t} traspasos Bodega → Barra de ejemplo`);
}
