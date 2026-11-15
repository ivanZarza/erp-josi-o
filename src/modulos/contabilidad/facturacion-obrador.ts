/**
 * Facturas entre sociedades del obrador (o almacén central) a los locales, a partir de los pedidos internos.
 *
 * Sin "server-only" a propósito: la usan el servicio de Contabilidad (botón «Facturar pedidos del obrador») y
 * la semilla de Raza Pruebas. Por eso la numeración y la auditoría llegan como dependencias (`Dependencias`):
 * el servicio pasa `siguienteNumero` y `auditar` del kernel; la semilla, sus equivalentes.
 *
 * Reglas (decisiones del 15/11/2026, a confirmar por Iván):
 * 1. Una factura por obrador → local y mes, juntando todos sus pedidos del mes que aún no estén en otra factura.
 *    El mes de un pedido es el día (hora de Madrid) en que se SIRVIÓ (albarán de salida).
 * 2. Solo entran pedidos RECIBIDOS (el local confirmó lo que le llegó). Los servidos sin confirmar se enseñan
 *    en la vista previa y entran en una factura posterior del mismo mes cuando el local los confirme.
 * 3. Cantidad facturada de cada línea = la misma regla que el importe del pedido (`importePedido` de
 *    src/nucleo/pedidos.ts): lo servido más lo que llegó de más. Lo que FALTÓ al recibir se factura igual:
 *    salió del obrador y en el local quedó como merma (la pérdida es del local, que la ve en sus mermas).
 *    Lo que SOBRÓ se factura: también salió del obrador.
 * 4. Precio = el de la línea del pedido (la tarifa del obrador para ese local al servir). IVA = el del producto.
 * 5. Si obrador y local son de la MISMA sociedad no hay factura (traspaso interno): se dice en la vista previa.
 * 6. Se crea la factura emitida PREPARADA (referencia PRE-…, serie de las emitidas: la oficial la da el programa
 *    certificado, P-23) en la sociedad del obrador y su ESPEJO como factura recibida en la sociedad del local
 *    (pendiente de revisar), con categoría de mercancía por línea (comida o bebida). El Cuadro de mando no suma
 *    las facturas de mercancía (la mercancía sale del stock o de lo vendido), así que el espejo no cuenta dos veces.
 * 7. Cada pedido queda enlazado a su factura (FacturaEmitidaPedido, único por pedido): volver a facturar el mismo
 *    mes solo factura los pedidos nuevos; no duplica.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { hoyMadrid, inicioDiaMadrid } from "../../kernel/fechas";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export interface Dependencias {
  /** Siguiente número de una serie (siguienteNumero del kernel). */
  numerar: (tx: Tx, tenantId: string, serie: string) => Promise<string>;
  /** Auditoría (auditar del kernel). */
  auditar: (tx: Tx, a: { tenantId: string; usuarioId?: string; entidad: string; entidadId: string; accion: string; antes?: unknown; despues?: unknown }) => Promise<void>;
}

/** Días hasta el vencimiento de la factura entre sociedades (a confirmar por Iván). */
export const DIAS_VENCIMIENTO_ENTRE_SOCIEDADES = 30;
/** Tipos de IVA válidos (los mismos que esquemas.ts). */
const TIPOS_IVA = [21, 10, 4, 0];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(String(v)));

/** Cantidad que se factura de una línea de pedido RECIBIDO: lo servido más lo que llegó de más (ver regla 3). */
export function cantidadFacturable(l: { servida: unknown; recibida: unknown }): number {
  return r3(Math.max(num(l.servida), num(l.recibida)));
}

/** «2026-10» → instantes de inicio y fin (exclusivo) del mes en Madrid, y fecha de la factura (fin de mes, o hoy si no ha acabado). */
export function periodoMes(mes: string, ahora = new Date()) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error(`Mes no válido: ${mes}`);
  const [a, m] = mes.split("-").map(Number);
  const siguiente = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  const finMes = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const hoy = hoyMadrid(0, ahora);
  return { desde: inicioDiaMadrid(`${mes}-01`), hasta: inicioDiaMadrid(siguiente), fechaFactura: finMes < hoy ? finMes : hoy, mesAcabado: finMes < hoy };
}

export interface LineaPropuesta {
  productoId: string;
  concepto: string;
  cantidad: number;
  precio: number;
  tipoIva: number;
  base: number;
  cuotaIva: number;
  /** Código de la categoría del espejo: MERC-BEB o MERC-COM. */
  categoria: "MERC-BEB" | "MERC-COM";
}

export interface PedidoPropuesto {
  id: string;
  numero: string;
  albaran: string | null;
  servidoEn: Date;
  base: number;
  /** Faltas o sobras al recibir (para enseñarlo). */
  diferencias: number;
}

export interface Propuesta {
  origen: { id: string; nombre: string; sociedadId: string | null };
  destino: { id: string; nombre: string; sociedadId: string | null };
  sociedadOrigen: { id: string; razonSocial: string; cif: string } | null;
  sociedadDestino: { id: string; razonSocial: string; cif: string } | null;
  /** Obrador y local de la misma sociedad: traspaso interno, sin factura. */
  mismaSociedad: boolean;
  /** Algún centro sin sociedad: no se puede facturar. */
  sinSociedad: boolean;
  pedidos: PedidoPropuesto[];
  lineas: LineaPropuesta[];
  porIva: { tipo: number; base: number; cuotaIva: number }[];
  base: number;
  cuotaIva: number;
  total: number;
  /** Avisos que impiden facturar (IVA no válido…). */
  errores: string[];
}

export interface VistaFacturacion {
  mes: string;
  fechaFactura: string;
  mesAcabado: boolean;
  /** Una por obrador → local con pedidos por facturar (incluidas las de la misma sociedad, que no se facturan). */
  propuestas: Propuesta[];
  /** Pedidos servidos en el mes que el local aún no ha confirmado (no entran todavía). */
  sinConfirmar: { id: string; numero: string; albaran: string | null; origen: string; destino: string; servidoEn: Date; mismaSociedad: boolean }[];
  /** Facturas ya hechas de este mes (lo ya facturado no vuelve a entrar). */
  yaFacturadas: { id: string; referencia: string; numeroOficial: string | null; estado: string; origen: string; destino: string; pedidos: number; total: number }[];
}

/**
 * Lo que se facturaría de un mes (vista previa). `origenIds`: obradores o almacenes que puede facturar quien
 * mira (los de su ámbito); vacío = ninguno.
 */
export async function prepararFacturacionObrador(tx: Tx, tenantId: string, mes: string, origenIds: string[], ahora = new Date()): Promise<VistaFacturacion> {
  const p = periodoMes(mes, ahora);
  const vacia: VistaFacturacion = { mes, fechaFactura: p.fechaFactura, mesAcabado: p.mesAcabado, propuestas: [], sinConfirmar: [], yaFacturadas: [] };
  if (origenIds.length === 0) return vacia;
  const pedidos = await tx.pedidoInterno.findMany({
    where: { tenantId, origenId: { in: origenIds }, estado: { in: ["SERVIDO", "RECIBIDO"] }, servidoEn: { gte: p.desde, lt: p.hasta } },
    include: {
      origen: { select: { id: true, nombre: true, sociedadId: true } },
      destino: { select: { id: true, nombre: true, sociedadId: true } },
      lineas: { include: { producto: { select: { nombre: true, iva: true } } } },
    },
    orderBy: { servidoEn: "asc" },
  });
  const enlaces = await tx.facturaEmitidaPedido.findMany({ where: { tenantId, pedidoInternoId: { in: pedidos.map((x) => x.id) } }, select: { pedidoInternoId: true, facturaId: true } });
  const facturado = new Set(enlaces.map((e) => e.pedidoInternoId));
  const sociedadIds = Array.from(new Set(pedidos.flatMap((x) => [x.origen.sociedadId, x.destino.sociedadId]).filter((s): s is string => !!s)));
  const sociedades = new Map((await tx.sociedad.findMany({ where: { tenantId, id: { in: sociedadIds } }, select: { id: true, razonSocial: true, cif: true } })).map((s) => [s.id, s]));

  const grupos = new Map<string, Propuesta & { _lineas: Map<string, LineaPropuesta> }>();
  for (const x of pedidos) {
    const misma = !!x.origen.sociedadId && x.origen.sociedadId === x.destino.sociedadId;
    if (x.estado === "SERVIDO") {
      vacia.sinConfirmar.push({ id: x.id, numero: x.numero, albaran: x.albaran, origen: x.origen.nombre, destino: x.destino.nombre, servidoEn: x.servidoEn!, mismaSociedad: misma });
      continue;
    }
    if (facturado.has(x.id)) continue;
    const k = `${x.origenId}|${x.destinoId}`;
    let g = grupos.get(k);
    if (!g) {
      g = {
        origen: x.origen,
        destino: x.destino,
        sociedadOrigen: (x.origen.sociedadId && sociedades.get(x.origen.sociedadId)) || null,
        sociedadDestino: (x.destino.sociedadId && sociedades.get(x.destino.sociedadId)) || null,
        mismaSociedad: misma,
        sinSociedad: !x.origen.sociedadId || !x.destino.sociedadId,
        pedidos: [],
        lineas: [],
        porIva: [],
        base: 0,
        cuotaIva: 0,
        total: 0,
        errores: [],
        _lineas: new Map(),
      };
      grupos.set(k, g);
    }
    let basePedido = 0;
    let diferencias = 0;
    for (const l of x.lineas) {
      const cantidad = cantidadFacturable(l);
      if (num(l.recibida) !== num(l.servida)) diferencias++;
      if (cantidad <= 0) continue;
      const precio = r4(num(l.precio));
      const tipoIva = num(l.producto.iva);
      if (!TIPOS_IVA.includes(tipoIva)) g.errores.push(`«${l.producto.nombre}» tiene un IVA del ${tipoIva} %, que no es un tipo válido: corrígelo en la ficha del producto.`);
      basePedido += r2(cantidad * precio);
      const clave = `${l.productoId}|${precio}`;
      const y = g._lineas.get(clave) ?? { productoId: l.productoId, concepto: l.producto.nombre, cantidad: 0, precio, tipoIva, base: 0, cuotaIva: 0, categoria: x.area === "BEBIDAS" ? ("MERC-BEB" as const) : ("MERC-COM" as const) };
      y.cantidad = r3(y.cantidad + cantidad);
      g._lineas.set(clave, y);
    }
    g.pedidos.push({ id: x.id, numero: x.numero, albaran: x.albaran, servidoEn: x.servidoEn!, base: r2(basePedido), diferencias });
  }

  for (const g of grupos.values()) {
    g.lineas = Array.from(g._lineas.values())
      .map((l) => {
        const base = r2(l.cantidad * l.precio);
        return { ...l, base, cuotaIva: r2((base * l.tipoIva) / 100) };
      })
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.concepto.localeCompare(b.concepto, "es"));
    const porIva = new Map<number, { tipo: number; base: number; cuotaIva: number }>();
    for (const l of g.lineas) {
      const t = porIva.get(l.tipoIva) ?? { tipo: l.tipoIva, base: 0, cuotaIva: 0 };
      t.base = r2(t.base + l.base);
      t.cuotaIva = r2(t.cuotaIva + l.cuotaIva);
      porIva.set(l.tipoIva, t);
    }
    g.porIva = Array.from(porIva.values()).sort((a, b) => b.tipo - a.tipo);
    g.base = r2(g.lineas.reduce((s, l) => s + l.base, 0));
    g.cuotaIva = r2(g.lineas.reduce((s, l) => s + l.cuotaIva, 0));
    g.total = r2(g.base + g.cuotaIva);
    g.errores = Array.from(new Set(g.errores));
    if (g.sinSociedad) g.errores.push("El obrador o el local no tiene sociedad asignada (Organización): sin sociedad no se puede facturar.");
  }
  vacia.propuestas = Array.from(grupos.values())
    .map(({ _lineas, ...g }) => g)
    .sort((a, b) => a.origen.nombre.localeCompare(b.origen.nombre, "es") || a.destino.nombre.localeCompare(b.destino.nombre, "es"));

  // facturas ya hechas este mes con pedidos de estos obradores
  const yaIds = Array.from(new Set(enlaces.map((e) => e.facturaId)));
  if (yaIds.length) {
    const ya = await tx.facturaEmitida.findMany({ where: { id: { in: yaIds } }, include: { _count: { select: { pedidos: true } } }, orderBy: { referencia: "asc" } });
    const centros = new Map((await tx.centro.findMany({ where: { tenantId, id: { in: ya.map((f) => f.centroId).filter((c): c is string => !!c) } }, select: { id: true, nombre: true } })).map((c) => [c.id, c.nombre]));
    vacia.yaFacturadas = ya.map((f) => ({ id: f.id, referencia: f.referencia, numeroOficial: f.numeroOficial, estado: f.estado, origen: (f.centroId && centros.get(f.centroId)) || "—", destino: f.clienteNombre, pedidos: f._count.pedidos, total: num(f.total) }));
  }
  return vacia;
}

export interface FacturaGenerada {
  emitidaId: string;
  referencia: string;
  espejoId: string;
  espejoNumero: string;
  origen: string;
  destino: string;
  pedidos: number;
  total: number;
}

/**
 * Genera las facturas del mes (emitida PREPARADA + espejo recibido) de las propuestas que se pueden facturar.
 * Hay que llamarla dentro de una transacción. Vuelve a leer los pedidos dentro de ella: si otro usuario ya los
 * facturó, el enlace único lo impide (no duplica).
 */
export async function generarFacturasObrador(
  tx: Tx,
  tenantId: string,
  usuarioId: string | undefined,
  mes: string,
  origenIds: string[],
  deps: Dependencias,
  opciones: { destinoIds?: string[]; ahora?: Date } = {},
): Promise<{ generadas: FacturaGenerada[]; mismaSociedad: number; conErrores: string[] }> {
  const vista = await prepararFacturacionObrador(tx, tenantId, mes, origenIds, opciones.ahora);
  const categorias = await tx.categoriaContable.findMany({ where: { tenantId, grupo: "MERCANCIA", activo: true }, select: { id: true, codigo: true } });
  const categoriaDe = (codigo: string) => categorias.find((c) => c.codigo === codigo)?.id ?? categorias.find((c) => c.codigo === "MERC-COM")?.id ?? categorias[0]?.id;
  const generadas: FacturaGenerada[] = [];
  const conErrores: string[] = [];
  let mismaSociedad = 0;
  const fecha = new Date(`${vista.fechaFactura}T00:00:00.000Z`);
  const vencimiento = new Date(fecha.getTime() + DIAS_VENCIMIENTO_ENTRE_SOCIEDADES * 86_400_000);
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const nombreMes = `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

  for (const g of vista.propuestas) {
    if (opciones.destinoIds && !opciones.destinoIds.includes(g.destino.id)) continue;
    if (g.mismaSociedad) {
      mismaSociedad++;
      continue;
    }
    if (g.errores.length || !g.sociedadOrigen || !g.sociedadDestino || g.lineas.length === 0) {
      if (g.errores.length) conErrores.push(`${g.origen.nombre} → ${g.destino.nombre}: ${g.errores[0]}`);
      continue;
    }
    if (!categoriaDe("MERC-COM")) throw new Error("No hay ninguna categoría de mercancía activa en Contabilidad: crea las categorías básicas antes de facturar.");
    const listaPedidos = g.pedidos.map((x) => `${x.numero}${x.albaran ? ` (${x.albaran})` : ""}`).join(", ");
    const notas = `Pedidos internos de ${nombreMes} de ${g.origen.nombre} a ${g.destino.nombre}, a la tarifa del obrador: ${listaPedidos}. Precio entre sociedades vinculadas: a comprobar con la gestoría.`;
    const referencia = await deps.numerar(tx, tenantId, "PRE");
    const emitida = await tx.facturaEmitida.create({
      data: {
        tenantId,
        referencia,
        sociedadId: g.sociedadOrigen.id,
        centroId: g.origen.id,
        origen: "ENTRE_SOCIEDADES",
        clienteNombre: g.sociedadDestino.razonSocial,
        clienteCif: g.sociedadDestino.cif,
        sociedadDestinoId: g.sociedadDestino.id,
        fecha,
        vencimiento,
        base: g.base,
        cuotaIva: g.cuotaIva,
        total: g.total,
        estado: "PREPARADA",
        notas,
        creadoPor: usuarioId ?? null,
        lineas: { create: g.lineas.map((l, orden) => ({ concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, tipoIva: l.tipoIva, base: l.base, cuotaIva: l.cuotaIva, productoId: l.productoId, orden })) },
      },
    });
    // enlace único por pedido: si otro ya lo facturó, la restricción única hace fallar la transacción (no duplica)
    await tx.facturaEmitidaPedido.createMany({ data: g.pedidos.map((x) => ({ tenantId, facturaId: emitida.id, pedidoInternoId: x.id, base: x.base })) });
    const numero = await deps.numerar(tx, tenantId, "FR");
    const espejo = await tx.facturaRecibida.create({
      data: {
        tenantId,
        numero,
        numeroProveedor: referencia, // hasta que se apunte el número oficial (al emitirla en el programa certificado)
        proveedorNombre: g.sociedadOrigen.razonSocial,
        proveedorCif: g.sociedadOrigen.cif && g.sociedadOrigen.cif !== "PENDIENTE" ? g.sociedadOrigen.cif : null,
        sociedadId: g.sociedadDestino.id,
        centroId: g.destino.id,
        categoriaId: categoriaDe("MERC-COM"),
        fecha,
        vencimiento,
        base: g.base,
        cuotaIva: g.cuotaIva,
        total: g.total,
        estado: "PENDIENTE",
        origen: "MANUAL",
        facturaEmitidaId: emitida.id,
        notas: `Factura del obrador entre sociedades del grupo (${referencia}), generada por el ERP. ${notas}`,
        creadoPor: usuarioId ?? null,
        lineas: {
          create: g.lineas.map((l, orden) => ({ concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, tipoIva: l.tipoIva, base: l.base, cuotaIva: l.cuotaIva, categoriaId: categoriaDe(l.categoria), productoId: l.productoId, orden })),
        },
      },
    });
    await deps.auditar(tx, { tenantId, usuarioId, entidad: "FacturaEmitida", entidadId: emitida.id, accion: "facturar-pedidos-obrador", despues: { referencia, mes, pedidos: g.pedidos.map((x) => x.numero), total: g.total, espejo: numero } });
    generadas.push({ emitidaId: emitida.id, referencia, espejoId: espejo.id, espejoNumero: numero, origen: g.origen.nombre, destino: g.destino.nombre, pedidos: g.pedidos.length, total: g.total });
  }
  return { generadas, mismaSociedad, conErrores };
}
