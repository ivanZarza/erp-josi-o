/**
 * Motor de movimientos de stock (núcleo), sin "server-only" para que lo usen también las semillas
 * (prisma/semillas/pruebas-raza/caja.ts registra las ventas con la misma lógica que la aplicación).
 * Desde la aplicación se importa a través de src/nucleo/movimientos.ts.
 */
import type { PrismaClient, TipoMovimiento } from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";
import { almacenPorRegla } from "./regla-almacen";
import { insertarPorLotes, UMBRAL_LOTE_RAPIDO } from "./insertar-lotes";

/** Error de negocio: su mensaje se enseña tal cual (lo vuelve a lanzar comun-almacen como ErrorNegocio). */
export class ErrorMovimiento extends Error {}

/**
 * Motor común de stock (núcleo). Regla de oro: el stock es la SUMA de movimientos.
 * Lo usan Bebidas, Comidas y Obrador. Ninguna pantalla escribe stock de otra forma.
 *
 * Cada movimiento lleva el almacén del centro (Bodega, Barra, Cámara…). Si quien lo registra no lo dice:
 * - las entradas (+) van al almacén por defecto del producto en ese centro (regla-almacen.ts);
 * - las salidas (−) salen primero del almacén por defecto y, si allí no hay bastante, de los demás
 *   almacenes que tengan stock (y del stock «Sin ubicar»); lo que falte se apunta en el de por defecto.
 * Así ningún almacén se queda en negativo mientras el centro tenga stock.
 */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export interface NuevoMovimiento {
  tenantId: string;
  centroId: string;
  /** Almacén del centro. Sin poner (undefined) = el motor lo decide; null = «Sin ubicar» a propósito. */
  almacenId?: string | null;
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number; // con signo: + entra, − sale
  costeUnitario: number;
  documento?: string;
  documentoId?: string;
  motivo?: string;
  usuarioId?: string;
  /** Momento del movimiento (por defecto, ahora). Lo usan las ventas importadas del TPV con su hora. */
  fecha?: Date;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const SIN = ""; // clave del stock «Sin ubicar»

/**
 * Resolutor del almacén por defecto para unos centros y productos (una consulta por tabla).
 * Devuelve una función (centroId, productoId) → almacenId | null.
 */
export async function resolutorAlmacen(tx: Tx, centroIds: string[], productoIds: string[]) {
  const [almacenes, productos, ajustes] = await Promise.all([
    tx.almacen.findMany({ where: { centroId: { in: centroIds }, activo: true }, select: { id: true, nombre: true, centroId: true } }),
    tx.producto.findMany({ where: { id: { in: productoIds } }, select: { id: true, area: true, nombre: true, familia: { select: { nombre: true } } } }),
    tx.productoCentro.findMany({ where: { centroId: { in: centroIds }, productoId: { in: productoIds }, almacenId: { not: null } }, select: { productoId: true, centroId: true, almacenId: true } }),
  ]);
  const porCentro = new Map<string, { id: string; nombre: string }[]>();
  for (const a of almacenes) porCentro.set(a.centroId, [...(porCentro.get(a.centroId) ?? []), a]);
  const prod = new Map(productos.map((p) => [p.id, p]));
  const manual = new Map(ajustes.map((a) => [`${a.productoId}|${a.centroId}`, a.almacenId as string]));
  const cache = new Map<string, string | null>();
  const resolver = (centroId: string, productoId: string): string | null => {
    const k = `${productoId}|${centroId}`;
    if (cache.has(k)) return cache.get(k)!;
    const lista = porCentro.get(centroId) ?? [];
    const m = manual.get(k);
    const p = prod.get(productoId);
    const id = m && lista.some((a) => a.id === m) ? m : p ? almacenPorRegla({ area: p.area, nombre: p.nombre, familia: p.familia?.nombre ?? null }, lista) : (lista[0]?.id ?? null);
    cache.set(k, id);
    return id;
  };
  return { resolver, almacenesDe: (centroId: string) => porCentro.get(centroId) ?? [] };
}

export async function registrarMovimientos(tx: Tx, movs: NuevoMovimiento[]) {
  if (movs.length === 0) return;
  const centroIds = Array.from(new Set(movs.map((m) => m.centroId)));
  const productoIds = Array.from(new Set(movs.map((m) => m.productoId)));
  const { resolver, almacenesDe } = await resolutorAlmacen(tx, centroIds, productoIds);

  // los almacenes que vengan puestos tienen que ser del centro del movimiento
  for (const m of movs) {
    if (m.almacenId && !almacenesDe(m.centroId).some((a) => a.id === m.almacenId)) {
      throw new ErrorMovimiento("El almacén elegido no es de ese centro o está desactivado.");
    }
  }

  // stock por almacén de las salidas sin almacén (para repartirlas sin dejar almacenes en negativo)
  const salidas = movs.filter((m) => m.almacenId === undefined && m.cantidad < 0);
  const stock = new Map<string, Map<string, number>>(); // producto|centro → almacén ("" = sin ubicar) → stock
  if (salidas.length > 0) {
    const filas = await tx.movimientoStock.groupBy({
      by: ["centroId", "productoId", "almacenId"],
      where: { tenantId: salidas[0].tenantId, centroId: { in: Array.from(new Set(salidas.map((m) => m.centroId))) }, productoId: { in: Array.from(new Set(salidas.map((m) => m.productoId))) } },
      _sum: { cantidad: true },
    });
    for (const f of filas) {
      const k = `${f.productoId}|${f.centroId}`;
      if (!stock.has(k)) stock.set(k, new Map());
      stock.get(k)!.set(f.almacenId ?? SIN, Number(f._sum.cantidad ?? 0));
    }
  }
  const mover = (k: string, almacen: string, cantidad: number) => {
    if (!stock.has(k)) stock.set(k, new Map());
    const s = stock.get(k)!;
    s.set(almacen, r3((s.get(almacen) ?? 0) + cantidad));
  };

  const data: Prisma.MovimientoStockCreateManyInput[] = [];
  const crear = (m: NuevoMovimiento, almacenId: string | null, cantidad: number) =>
    data.push({
      tenantId: m.tenantId,
      centroId: m.centroId,
      almacenId,
      productoId: m.productoId,
      tipo: m.tipo,
      cantidad: r3(cantidad),
      costeUnitario: Math.round(m.costeUnitario * 10000) / 10000,
      documento: m.documento,
      documentoId: m.documentoId,
      motivo: m.motivo,
      usuarioId: m.usuarioId,
      ...(m.fecha ? { createdAt: m.fecha } : {}),
    });

  for (const m of movs) {
    const k = `${m.productoId}|${m.centroId}`;
    if (m.almacenId !== undefined) {
      crear(m, m.almacenId, m.cantidad);
      mover(k, m.almacenId ?? SIN, m.cantidad);
      continue;
    }
    const defecto = resolver(m.centroId, m.productoId);
    if (m.cantidad >= 0 || defecto === null) {
      crear(m, defecto, m.cantidad);
      mover(k, defecto ?? SIN, m.cantidad);
      continue;
    }
    // salida: primero el almacén por defecto, luego los demás con más stock, luego «Sin ubicar»
    let falta = r3(-m.cantidad);
    const s = stock.get(k) ?? new Map<string, number>();
    const orden = [defecto, ...Array.from(s.entries()).filter(([a, v]) => a !== defecto && a !== SIN && v > 0).sort((a, b) => b[1] - a[1]).map(([a]) => a), SIN];
    const partes: [string, number][] = [];
    for (const a of orden) {
      if (falta <= 0) break;
      const hay = s.get(a) ?? 0;
      if (hay <= 0) continue;
      const sale = r3(Math.min(hay, falta));
      partes.push([a, sale]);
      falta = r3(falta - sale);
    }
    if (falta > 0) {
      const enDefecto = partes.find((p) => p[0] === defecto);
      if (enDefecto) enDefecto[1] = r3(enDefecto[1] + falta);
      else partes.push([defecto, falta]);
    }
    for (const [a, sale] of partes) {
      crear(m, a === SIN ? null : a, -sale);
      mover(k, a, -sale);
    }
  }
  // por lotes: una venta grande (o la carga de la semilla) puede dar decenas de miles de filas
  if (data.length < UMBRAL_LOTE_RAPIDO) {
    await tx.movimientoStock.createMany({ data });
    return;
  }
  const ahora = new Date();
  await insertarPorLotes(
    tx,
    "MovimientoStock",
    [["id", "text"], ["tenantId", "text"], ["centroId", "text"], ["almacenId", "text"], ["productoId", "text"], ["tipo", "enum:TipoMovimiento"], ["cantidad", "numeric"], ["costeUnitario", "numeric"], ["documento", "text"], ["documentoId", "text"], ["motivo", "text"], ["usuarioId", "text"], ["createdAt", "timestamp"]],
    data.map((d) => ({ ...d, id: globalThis.crypto.randomUUID(), createdAt: d.createdAt ?? ahora })),
  );
}
