/**
 * Consumo de stock por las ventas (núcleo). UNA sola lógica para la pantalla de Caja, la importación
 * del TPV y las semillas: cada línea vendida descuenta los productos de su escandallo según el formato.
 *
 * - Plato sin formato: `cantidad` × escandallo del plato (cantidad bruta = neta con su merma).
 * - Formato sin producto propio (copa = 0,2): `cantidad` × `formato.cantidad` × escandallo.
 * - Formato con producto propio (mágnum): `cantidad` × `formato.cantidad` unidades de ese producto.
 *
 * Los movimientos son de tipo VENTA, en negativo al vender y en positivo al anular (devuelven el stock),
 * uno por ticket, producto y momento. El almacén lo decide el motor (almacén por defecto del producto en
 * el centro, regla-almacen.ts: vinos de la Bodega, cervezas, refrescos y café de la Barra…).
 * Sin "server-only": lo usan también las semillas (prisma/semillas/pruebas-raza/caja.ts).
 * Ver docs/specs/nucleo/stock-y-pedidos.md §Consumo por ventas.
 */
import { cantidadBruta } from "../modulos/comidas/carta-alergenos";
import { registrarMovimientos, type NuevoMovimiento, type Tx } from "./motor-movimientos";

export interface FormatoVenta {
  id: string;
  nombre: string;
  precio: number; // PVP con IVA de la marca
  cantidad: number; // parte del escandallo (0,2) o unidades del producto propio
  productoId: string | null;
}

/** Lo que hace falta de un plato para venderlo: precio, IVA, escandallo y formatos. */
export interface EscandalloVenta {
  platoId: string;
  nombre: string;
  area: "COMIDAS" | "BEBIDAS";
  precio: number; // PVP con IVA de la marca (si hay formatos, el del primero)
  iva: number;
  ingredientes: { productoId: string; bruta: number }[];
  formatos: FormatoVenta[]; // activos, por orden
}

/** Escandallos de venta de unos platos (dos consultas). */
export async function cargarEscandallos(tx: Tx, tenantId: string, platoIds: string[]): Promise<Map<string, EscandalloVenta>> {
  const ids = Array.from(new Set(platoIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const platos = await tx.cartaPlato.findMany({
    where: { tenantId, id: { in: ids } },
    select: {
      id: true,
      nombre: true,
      area: true,
      precio: true,
      iva: true,
      ingredientes: { select: { productoId: true, cantidad: true, mermaPct: true } },
      formatos: { where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, precio: true, cantidad: true, productoId: true } },
    },
  });
  return new Map(
    platos.map((p) => [
      p.id,
      {
        platoId: p.id,
        nombre: p.nombre,
        area: p.area,
        precio: Number(p.precio),
        iva: Number(p.iva),
        ingredientes: p.ingredientes.map((i) => ({ productoId: i.productoId, bruta: cantidadBruta(Number(i.cantidad), Number(i.mermaPct)) })),
        formatos: p.formatos.map((f) => ({ id: f.id, nombre: f.nombre, precio: Number(f.precio), cantidad: Number(f.cantidad), productoId: f.productoId })),
      },
    ]),
  );
}

/** Productos y cantidades que salen al vender `cantidad` unidades de un plato en un formato. */
export function consumoDeVenta(esc: EscandalloVenta, formatoId: string | null | undefined, cantidad: number): { productoId: string; cantidad: number }[] {
  const f = formatoId ? esc.formatos.find((x) => x.id === formatoId) : undefined;
  if (f?.productoId) return [{ productoId: f.productoId, cantidad: f.cantidad * cantidad }];
  const parte = f ? f.cantidad : 1;
  return esc.ingredientes.filter((i) => i.bruta > 0).map((i) => ({ productoId: i.productoId, cantidad: i.bruta * parte * cantidad }));
}

/** Coste medio actual de unos productos (una consulta). */
export async function costesProductos(tx: Tx, tenantId: string, productoIds: string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(productoIds));
  if (ids.length === 0) return new Map();
  const productos = await tx.producto.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, costeUnitario: true } });
  return new Map(productos.map((p) => [p.id, Number(p.costeUnitario)]));
}

/** Una línea de ticket que mueve stock. */
export interface LineaVendida {
  centroId: string;
  platoId: string;
  formatoId?: string | null;
  cantidad: number; // unidades vendidas (positivo)
  /** "venta": sale del stock; "anulacion": vuelve (línea o ticket anulado). */
  sentido: "venta" | "anulacion";
  fecha: Date;
  documento: string; // número del ticket
  documentoId: string; // id del ticket
  motivo: string;
  usuarioId?: string | null;
}

export interface ResultadoConsumo {
  /** Coste del escandallo de cada línea (mismo orden que la entrada), siempre positivo. */
  costes: number[];
  movimientos: number;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Descuenta (o devuelve) el stock de unas líneas vendidas. Sirve para una línea o para miles de tickets
 * a la vez: siempre son las mismas pocas consultas (escandallos, costes, almacenes, stock y escritura).
 * Se pueden pasar los escandallos ya cargados (`opciones.escandallos`) para no leerlos dos veces.
 */
export async function descontarStockVentas(
  tx: Tx,
  tenantId: string,
  lineas: LineaVendida[],
  opciones: { escandallos?: Map<string, EscandalloVenta>; costes?: Map<string, number> } = {},
): Promise<ResultadoConsumo> {
  if (lineas.length === 0) return { costes: [], movimientos: 0 };
  const faltan = lineas.map((l) => l.platoId).filter((id) => !opciones.escandallos?.has(id));
  const escandallos = new Map(opciones.escandallos ?? []);
  if (faltan.length) for (const [k, v] of await cargarEscandallos(tx, tenantId, faltan)) escandallos.set(k, v);

  const consumos = lineas.map((l) => {
    const esc = escandallos.get(l.platoId);
    return esc ? consumoDeVenta(esc, l.formatoId, l.cantidad) : [];
  });
  const productoIds = consumos.flatMap((c) => c.map((x) => x.productoId));
  const costes = opciones.costes && productoIds.every((p) => opciones.costes!.has(p)) ? opciones.costes : await costesProductos(tx, tenantId, productoIds);

  // un movimiento por ticket, producto, sentido y momento
  const grupos = new Map<string, NuevoMovimiento>();
  const costeLineas: number[] = [];
  lineas.forEach((l, i) => {
    let coste = 0;
    for (const c of consumos[i]) {
      const cu = costes.get(c.productoId) ?? 0;
      coste += c.cantidad * cu;
      const signo = l.sentido === "venta" ? -1 : 1;
      const k = `${l.documentoId}|${c.productoId}|${l.sentido}|${l.fecha.getTime()}`;
      const g = grupos.get(k);
      if (g) g.cantidad += signo * c.cantidad;
      else
        grupos.set(k, {
          tenantId,
          centroId: l.centroId,
          productoId: c.productoId,
          tipo: "VENTA",
          cantidad: signo * c.cantidad,
          costeUnitario: cu,
          documento: l.documento,
          documentoId: l.documentoId,
          motivo: l.motivo,
          usuarioId: l.usuarioId ?? undefined,
          fecha: l.fecha,
        });
    }
    costeLineas.push(r4(coste));
  });
  const movs = Array.from(grupos.values())
    .map((m) => ({ ...m, cantidad: Math.round(m.cantidad * 1000) / 1000 }))
    .filter((m) => m.cantidad !== 0);
  await registrarMovimientos(tx, movs);
  return { costes: costeLineas, movimientos: movs.length };
}

/** Plato o bebida que se puede vender en un local, con su precio en ese local y sus formatos. */
export interface PlatoVendible {
  platoId: string;
  nombre: string;
  seccion: string;
  area: "COMIDAS" | "BEBIDAS";
  iva: number;
  precio: number; // en el local (si hay formatos, el del primero)
  formatos: { id: string; nombre: string; precio: number }[];
}

/**
 * Carta que se vende en un local: las cartas activas de su marca (sin local) y las del propio local,
 * sin los platos que el local tiene como «no se sirve». Para el formulario de tickets y el enlace con el TPV.
 */
export async function platosVendibles(tx: Tx, tenantId: string, centroId: string): Promise<PlatoVendible[]> {
  const centro = await tx.centro.findFirst({ where: { id: centroId, tenantId }, select: { marcaId: true } });
  if (!centro) return [];
  const cartas = await tx.carta.findMany({
    where: { tenantId, activo: true, OR: [{ centroId }, ...(centro.marcaId ? [{ marcaId: centro.marcaId, centroId: null }] : [])] },
    select: {
      secciones: {
        // una sección quitada de la carta (activo = false) ya no se vende
        where: { activo: true },
        orderBy: { orden: "asc" },
        select: {
          nombre: true,
          area: true,
          lineas: {
            orderBy: { orden: "asc" },
            select: {
              plato: {
                select: {
                  id: true,
                  nombre: true,
                  activo: true,
                  precio: true,
                  iva: true,
                  area: true,
                  precios: { where: { centroId }, select: { precio: true, disponible: true } },
                  formatos: { where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, precio: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const vistos = new Set<string>();
  const lista: PlatoVendible[] = [];
  for (const c of cartas)
    for (const s of c.secciones)
      for (const { plato: p } of s.lineas) {
        if (!p.activo || vistos.has(p.id)) continue;
        const aj = p.precios[0];
        if (aj && !aj.disponible) continue;
        vistos.add(p.id);
        const formatos = p.formatos.map((f, i) => ({ id: f.id, nombre: f.nombre, precio: i === 0 && aj?.precio != null ? Number(aj.precio) : Number(f.precio) }));
        lista.push({ platoId: p.id, nombre: p.nombre, seccion: s.nombre, area: p.area, iva: Number(p.iva), precio: formatos[0]?.precio ?? Number(aj?.precio ?? p.precio), formatos });
      }
  return lista;
}

// ---------------------------------------------------------------------------------------------
// Recargo por comensal (pan y aperitivo)
// ---------------------------------------------------------------------------------------------

/** Concepto del recargo por comensal que se configura en Comidas → Carta → Pan y aperitivo. */
export const CONCEPTO_PAN = "Pan y aperitivo";

/** Recargo por comensal que cobra un local (importe por persona con IVA incluido). */
export interface RecargoVenta {
  id: string;
  centroId: string;
  concepto: string;
  importe: number;
  iva: number;
  /** Plato con el escandallo de lo que se sirve (si lo hay, la línea descuenta stock). */
  platoId: string | null;
}

/** Recargos activos (con importe) de unos locales, por local. Una consulta. */
export async function recargosDeVenta(tx: Tx, tenantId: string, centroIds: string[]): Promise<Map<string, RecargoVenta>> {
  const ids = Array.from(new Set(centroIds));
  if (ids.length === 0) return new Map();
  const filas = await tx.cartaRecargo.findMany({ where: { tenantId, centroId: { in: ids }, concepto: CONCEPTO_PAN, activo: true, importe: { gt: 0 } } });
  return new Map(filas.map((r) => [r.centroId, { id: r.id, centroId: r.centroId, concepto: r.concepto, importe: Number(r.importe), iva: Number(r.iva), platoId: r.platoId }]));
}
