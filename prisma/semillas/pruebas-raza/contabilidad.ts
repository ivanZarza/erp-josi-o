/**
 * Parte «contabilidad» del local Raza Pruebas (RZ-PRU) y del obrador (OB).
 *
 * Crea, 8 semanas hacia atrás desde ctx.hoy (los gastos mensuales, de septiembre entero en adelante):
 *  1. Facturas recibidas de los proveedores de comida y bebida que cuadran con las compras recibidas
 *     (por proveedor: semanal, quincenal, mensual o por albarán), con líneas, IVA (4/10/21 %),
 *     vencimiento y forma de pago. Las de la última semana están «pendientes de revisar» como si las
 *     hubiera leído la IA; entre ellas hay a propósito:
 *       - una factura con un precio más alto que el del albarán y otra con precio y cantidad distintos,
 *       - una factura duplicada (el mismo PDF leído dos veces, con el número escrito distinto),
 *       - una factura de un albarán recibido a medias que cobra lo pedido, no lo recibido,
 *     y además un abono de proveedor y una factura vencida con el pago retenido.
 *  2. Gastos del local: alquiler, seguros, teléfono, limpieza, plagas, lavandería, TPV, gestoría
 *     (de la sociedad, sin centro), comisiones del datáfono y, como facturas de gasto, luz, gas,
 *     agua, campana, extintores, reparaciones, publicidad, plataforma de reservas y carbón.
 *  3. Nóminas de septiembre y octubre llevadas a contabilidad desde las nóminas reales de Personal:
 *     líquido a empleados, IRPF (modelo 111), cuota obrera y cuota de empresa de la Seguridad Social,
 *     con su pago o pendientes.
 *  4. Facturas emitidas: anticipos (señal) y facturas finales de eventos, y la factura mensual entre
 *     sociedades del obrador (sociedad del OB) al local (IHA) por los pedidos internos, con su espejo
 *     como factura recibida en la sociedad del local: la genera la MISMA función que el botón
 *     «Facturar pedidos del obrador» (generarFacturasObrador, src/modulos/contabilidad/facturacion-obrador.ts),
 *     una por mes ya cerrado, y después se apunta su número oficial y su cobro.
 *  Cada factura de mercancía queda enlazada a sus albaranes (FacturaRecibidaAlbaran: uno o varios).
 *  5. Pagos y cobros (PagoCobro) de todo lo pagado o cobrado.
 *
 * ⚠ Cifras de gastos, números de factura y CIF de clientes INVENTADOS. Las facturas de mercancía salen
 * de las compras y pedidos internos que cargaron las partes cocina y bebidas; las de personal, de las
 * nóminas de la parte personal; las de eventos, de los presupuestos aceptados de la parte sala.
 * Si ya hay facturas recibidas de RZ-PRU, la parte no hace nada (no duplica).
 */
import type { Prisma, PrismaClient, FormaPagoContable, EstadoFacturaRecibida } from "../../../src/generated/prisma/client";
import type { ContextoPruebas } from "./contexto";
import { generarFacturasObrador, type Dependencias } from "../../../src/modulos/contabilidad/facturacion-obrador";

// ===========================================================================
// Utilidades
// ===========================================================================

const DIA_MS = 86_400_000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Día en Madrid «AAAA-MM-DD» de una fecha y hora real. */
function isoMadrid(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** «AAAA-MM-DD» → medianoche UTC (columnas @db.Date). */
const aFecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const mas = (d: Date, dias: number) => new Date(d.getTime() + dias * DIA_MS);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const finDeMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)); // m de 0 a 11
/** Último día laborable (lunes a viernes) del mes. */
function ultimoLaborable(a: number, m: number): Date {
  let d = finDeMes(a, m);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = mas(d, -1);
  return d;
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

let contadorId = 0;
const sello = Date.now().toString(36);
/** Id con forma de cuid generado aquí, para enlazar filas creadas con createMany. */
function nuevoId(): string {
  contadorId++;
  return `c${sello}${contadorId.toString(36).padStart(5, "0")}${Math.random().toString(36).slice(2, 8)}`.slice(0, 25);
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

async function enLotes<T>(filas: T[], tam: number, fn: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += tam) await fn(filas.slice(i, i + tam));
}

/** Reserva n números seguidos de una serie (formato del kernel: SERIE-AAAA-000001). */
async function reservarNumeros(prisma: PrismaClient, tenantId: string, serie: string, n: number): Promise<string[]> {
  if (n === 0) return [];
  const anio = new Date().getFullYear();
  const c = await prisma.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: n },
    update: { valor: { increment: n } },
  });
  const inicio = c.valor - n + 1;
  return Array.from({ length: n }, (_, i) => `${serie}-${anio}-${String(inicio + i).padStart(6, "0")}`);
}

// ===========================================================================
// Condiciones de facturación de cada proveedor (inventadas)
// ===========================================================================

/** A = una factura por albarán · S = semanal (lunes a domingo) · Q = quincenal · M = mensual */
type Periodicidad = "A" | "S" | "Q" | "M";
interface Condiciones {
  cada: Periodicidad;
  dias: number; // vencimiento: días desde la fecha de factura
  forma: FormaPagoContable;
  prefijo: string; // de su número de factura
}

const CONDICIONES: Record<string, Condiciones> = {
  "MADURADOS DEL NORTE CARNES SELECTAS S.L.": { cada: "Q", dias: 30, forma: "TRANSFERENCIA", prefijo: "MDN" },
  "PAMPA & PRAIRIE IMPORT S.L.": { cada: "A", dias: 15, forma: "TRANSFERENCIA", prefijo: "PPI" },
  "CARNICERÍA Y CHARCUTERÍA HERMANOS LOZANO S.L.": { cada: "S", dias: 30, forma: "DOMICILIACION", prefijo: "FHL" },
  "PESCADOS Y MARISCOS LONJA CENTRO S.L.": { cada: "S", dias: 7, forma: "TRANSFERENCIA", prefijo: "LC" },
  "FRUTAS Y VERDURAS LA HUERTA DE ARANJUEZ S.L.": { cada: "S", dias: 15, forma: "DOMICILIACION", prefijo: "HA" },
  "LÁCTEOS Y HUEVOS SIERRA NORTE S.L.": { cada: "Q", dias: 30, forma: "DOMICILIACION", prefijo: "LSN" },
  "PANADERÍA OBRADOR SAN LORENZO S.L.": { cada: "M", dias: 10, forma: "DOMICILIACION", prefijo: "PSL" },
  "DESPENSA GOURMET IBERIA DISTRIBUCIÓN S.A.": { cada: "A", dias: 30, forma: "TRANSFERENCIA", prefijo: "DGI" },
  "CONGELADOS FRÍO MADRID S.L.": { cada: "Q", dias: 30, forma: "TRANSFERENCIA", prefijo: "CFM" },
  "ACEITES ALMAZARA SIERRA MÁGINA S.C.A.": { cada: "A", dias: 30, forma: "TRANSFERENCIA", prefijo: "ASM" },
  "Cafés Tostadero Castellano S.L.": { cada: "M", dias: 30, forma: "DOMICILIACION", prefijo: "CTC" },
  "Cervezas y Barriles Madrid Norte S.L.": { cada: "Q", dias: 30, forma: "DOMICILIACION", prefijo: "CBM" },
  "Distribuciones Hosteleras Arganzuela S.L.": { cada: "S", dias: 30, forma: "TRANSFERENCIA", prefijo: "DHA" },
  "Distribuidora de Vinos La Castellana S.L.": { cada: "Q", dias: 45, forma: "TRANSFERENCIA", prefijo: "VLC" },
  "Licores Selectos del Centro S.L.": { cada: "M", dias: 30, forma: "DOMICILIACION", prefijo: "LSC" },
};
/** Distribuidores de vino de BODEGA 360 y demás: factura por albarán a 30 días. */
function condicionesDe(nombre: string): Condiciones {
  const c = CONDICIONES[nombre];
  if (c) return c;
  const ini = nombre.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, " ").split(/\s+/).filter((p) => p.length > 2 && !/^(S\.?L|S\.?A|SL|SA|DEL|LAS|LOS)$/i.test(p)).map((p) => p[0].toUpperCase()).join("").slice(0, 3);
  return { cada: "A", dias: 30, forma: "TRANSFERENCIA", prefijo: ini || "FAC" };
}

/** Periodo de facturación de una recepción: clave y fecha de la factura (último día del periodo). */
function periodo(cada: Periodicidad, dia: Date, compraId: string): { clave: string; fecha: Date } {
  const a = dia.getUTCFullYear();
  const m = dia.getUTCMonth();
  if (cada === "A") return { clave: compraId, fecha: dia };
  if (cada === "S") {
    const domingo = mas(dia, (7 - dia.getUTCDay()) % 7);
    return { clave: iso(domingo), fecha: domingo };
  }
  if (cada === "Q") {
    const fin = dia.getUTCDate() <= 15 ? new Date(Date.UTC(a, m, 15)) : finDeMes(a, m);
    return { clave: iso(fin), fecha: fin };
  }
  const fin = finDeMes(a, m);
  return { clave: iso(fin), fecha: fin };
}

// ===========================================================================
// Tipos de trabajo
// ===========================================================================

interface LineaFR {
  concepto: string;
  cantidad: number;
  precio: number;
  tipoIva: number;
  categoria: string; // código de categoría
  productoId?: string | null;
}
interface FacturaFR {
  centro: "L" | "O"; // local RZ-PRU u obrador
  sociedadId: string;
  centroId: string | null;
  proveedorId: string | null;
  proveedorNombre: string;
  proveedorCif: string | null;
  numeroProveedor: string;
  categoria: string;
  fecha: Date;
  vencimiento: Date | null;
  forma: FormaPagoContable;
  lineas: LineaFR[];
  /** Albaranes (compras recibidas) que factura: uno (por albarán) o varios (semanal, quincenal, mensual). */
  albaranIds: string[];
  notas?: string | null;
  // decisiones de estado (si no, se deciden por fechas)
  estado?: EstadoFacturaRecibida;
  origen?: "MANUAL" | "LECTURA_IA" | "ELECTRONICA";
  noPagar?: boolean;
  pagadaEn?: Date | null;
}

interface GastoG {
  sociedadId: string;
  centroId: string | null;
  categoria: string;
  fecha: Date;
  vencimiento: Date | null;
  concepto: string;
  proveedorNombre: string;
  base: number;
  tipoIva: number;
  recurrente: boolean;
  forma: FormaPagoContable;
  pagadoEn: Date | null; // null = pendiente
  notas?: string;
}

// ===========================================================================
// Parte
// ===========================================================================

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const local = ctx.centroPruebas;
  const ob = ctx.centros["OB"];
  if (!ob) throw new Error("Contabilidad de Raza Pruebas: falta el obrador OB");
  if ((await prisma.facturaRecibida.count({ where: { tenantId: t, centroId: local } })) > 0) {
    console.log("  contabilidad: ya había facturas de Raza Pruebas, no se hace nada");
    return;
  }

  const hoy = aFecha(isoMadrid(ctx.hoy));
  const inicio = mas(hoy, -56); // 8 semanas
  const recientes = mas(hoy, -6); // lo de la última semana está por revisar

  // ---------- personas, sociedades y categorías ----------
  const usuarios = await prisma.usuario.findMany({ where: { tenantId: t, email: { in: ["admin@erp.local", "gerente.pruebas@erp.local", "economato@erp.local"] } }, select: { id: true, email: true } });
  const usr = (email: string) => usuarios.find((u) => u.email === email)?.id ?? null;
  const admin = usr("admin@erp.local");
  const gerente = usr("gerente.pruebas@erp.local") ?? admin;

  const centros = await prisma.centro.findMany({ where: { id: { in: [local, ob] } }, select: { id: true, sociedadId: true } });
  const socLocal = centros.find((c) => c.id === local)?.sociedadId;
  const socOB = centros.find((c) => c.id === ob)?.sociedadId;
  if (!socLocal || !socOB) throw new Error("Contabilidad de Raza Pruebas: RZ-PRU u OB sin sociedad");
  const entreSociedades = socLocal !== socOB;

  // Categorías: las 14 básicas (por si no están) y la de Seguridad Social de empresa
  const CATEGORIAS: [string, string, "MERCANCIA" | "PERSONAL" | "GASTO_FIJO" | "GASTO_VARIABLE", string | null][] = [
    ["MERC-BEB", "Mercancía de bebidas", "MERCANCIA", null], ["MERC-COM", "Mercancía de comida", "MERCANCIA", null], ["MERC-CONS", "Consumibles y menaje", "MERCANCIA", null],
    ["PERS", "Personal", "PERSONAL", null], ["ALQ", "Alquiler", "GASTO_FIJO", null], ["SUM", "Suministros (luz, agua, gas)", "GASTO_FIJO", null], ["SEG", "Seguros", "GASTO_FIJO", null],
    ["TEL", "Teléfono e internet", "GASTO_FIJO", null], ["ASES", "Gestoría y asesoría", "GASTO_FIJO", null], ["MANT", "Mantenimiento y reparaciones", "GASTO_VARIABLE", null],
    ["LIMP", "Limpieza", "GASTO_VARIABLE", null], ["PUBL", "Publicidad y marketing", "GASTO_VARIABLE", null], ["COMI", "Comisiones bancarias y de tarjeta", "GASTO_VARIABLE", null], ["OTROS", "Otros gastos", "GASTO_VARIABLE", null],
    // Nueva: separa la Seguridad Social de empresa de los sueldos (cuenta 642 del PGC: a comprobar con la gestoría)
    ["PERS-SS", "Seguridad Social a cargo de la empresa", "PERSONAL", null],
  ];
  const maxOrden = (await prisma.categoriaContable.aggregate({ where: { tenantId: t }, _max: { orden: true } }))._max.orden ?? 0;
  await prisma.categoriaContable.createMany({
    data: CATEGORIAS.map(([codigo, nombre, grupo, cuentaGestoria], i) => ({ tenantId: t, codigo, nombre, grupo, cuentaGestoria, orden: codigo === "PERS-SS" ? maxOrden + 1 : i })),
    skipDuplicates: true,
  });
  const cat = Object.fromEntries((await prisma.categoriaContable.findMany({ where: { tenantId: t }, select: { id: true, codigo: true } })).map((c) => [c.codigo, c.id]));

  const facturas: FacturaFR[] = [];
  const gastos: GastoG[] = [];

  // =========================================================================
  // 1. Facturas recibidas de mercancía (de las compras recibidas)
  // =========================================================================
  const compras = await prisma.pedidoCompra.findMany({
    where: { tenantId: t, centroId: { in: [local, ob] }, estado: { in: ["RECIBIDO", "RECIBIDO_PARCIAL"] }, recibidoEn: { not: null } },
    include: { proveedor: true, lineas: { include: { producto: { select: { id: true, nombre: true, iva: true, area: true } } } } },
    orderBy: { recibidoEn: "asc" },
  });

  type Grupo = { cond: Condiciones; fecha: Date; compras: typeof compras };
  const grupos = new Map<string, Grupo>();
  for (const c of compras) {
    const dia = aFecha(isoMadrid(c.recibidoEn!));
    if (dia < mas(inicio, -2)) continue;
    const cond = condicionesDe(c.proveedor.nombre);
    const p = periodo(cond.cada, dia, c.id);
    if (p.fecha > hoy) continue; // el periodo no ha acabado: aún sin factura (albaranes pendientes de facturar)
    const k = `${c.centroId}|${c.proveedorId}|${p.clave}`;
    const g = grupos.get(k) ?? { cond, fecha: p.fecha, compras: [] };
    g.compras.push(c);
    grupos.set(k, g);
  }

  const secuencia = new Map<string, number>();
  for (const g of Array.from(grupos.values()).sort((a, b) => a.fecha.getTime() - b.fecha.getTime())) {
    const c0 = g.compras[0];
    const prov = c0.proveedor;
    const n = (secuencia.get(prov.id) ?? 300 + (hash(prov.nombre) % 600)) + 1;
    secuencia.set(prov.id, n);
    // Líneas: un producto al mismo precio en varias entregas se suma en una línea
    const lineas = new Map<string, LineaFR>();
    for (const c of g.compras)
      for (const l of c.lineas) {
        const cantidad = Number(l.recibida ?? l.cantidad);
        if (cantidad <= 0) continue;
        const precio = r4(Number(l.precio));
        const k = `${l.productoId}|${precio}`;
        const x = lineas.get(k) ?? { concepto: l.producto.nombre, cantidad: 0, precio, tipoIva: Number(l.producto.iva), categoria: l.producto.area === "BEBIDAS" ? "MERC-BEB" : "MERC-COM", productoId: l.productoId };
        x.cantidad = Math.round((x.cantidad + cantidad) * 1000) / 1000;
        lineas.set(k, x);
      }
    if (lineas.size === 0) continue;
    const albaranes = g.compras.map((c) => `${/Albarán del proveedor: (\S+)/.exec(c.notas ?? "")?.[1] ?? "s/n"} (${c.albaran ?? c.numero})`);
    const esLocal = c0.centroId === local;
    facturas.push({
      centro: esLocal ? "L" : "O",
      sociedadId: esLocal ? socLocal : socOB,
      centroId: c0.centroId,
      proveedorId: prov.id,
      proveedorNombre: prov.nombre,
      proveedorCif: prov.cif,
      numeroProveedor: `${g.cond.prefijo}-26/${String(n).padStart(5, "0")}`,
      categoria: c0.area === "BEBIDAS" ? "MERC-BEB" : "MERC-COM",
      fecha: g.fecha,
      vencimiento: mas(g.fecha, g.cond.dias),
      forma: g.cond.forma,
      lineas: Array.from(lineas.values()).sort((a, b) => a.concepto.localeCompare(b.concepto, "es")),
      albaranIds: g.compras.map((c) => c.id),
      notas: `${albaranes.length === 1 ? "Albarán" : "Albaranes"}: ${albaranes.join(", ")}`,
    });
  }

  // ---------- casos para probar la revisión (solo en facturas de la última semana) ----------
  const ultimaDe = (nombre: string, centro: "L" | "O" = "L") =>
    facturas.filter((f) => f.proveedorNombre === nombre && f.centro === centro && f.fecha >= recientes).sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
  const casos: string[] = [];

  // a) Precio más alto que el del albarán (+5,5 % en la línea más cara)
  const pampa = ultimaDe("PAMPA & PRAIRIE IMPORT S.L.");
  if (pampa) {
    const l = pampa.lineas.reduce((m, x) => (x.cantidad * x.precio > m.cantidad * m.precio ? x : m));
    l.precio = r4(l.precio * 1.055);
    pampa.origen = "LECTURA_IA";
    casos.push(`precio más alto en ${pampa.numeroProveedor} (${l.concepto})`);
  }
  // b) Pescadería: un precio distinto y una cantidad mayor que la recibida
  const lonja = ultimaDe("PESCADOS Y MARISCOS LONJA CENTRO S.L.");
  if (lonja && lonja.lineas.length >= 2) {
    const [l1, l2] = [...lonja.lineas].sort((a, b) => b.cantidad * b.precio - a.cantidad * a.precio);
    l1.precio = r4(l1.precio + 0.9);
    l2.cantidad = Math.round((l2.cantidad + (l2.cantidad >= 5 ? 1 : 0.5)) * 1000) / 1000;
    lonja.origen = "LECTURA_IA";
    casos.push(`precio y cantidad distintos en ${lonja.numeroProveedor}`);
  }
  // c) Duplicada: el mismo PDF llegó dos veces por correo y la IA lo leyó con el número escrito distinto
  const lozano = ultimaDe("CARNICERÍA Y CHARCUTERÍA HERMANOS LOZANO S.L.");
  if (lozano) {
    lozano.origen = "LECTURA_IA";
    facturas.push({
      ...lozano,
      lineas: lozano.lineas.map((l) => ({ ...l })),
      albaranIds: [], // la copia no puede enlazar los mismos albaranes: la revisión la cruza por fechas y avisa de duplicada
      numeroProveedor: lozano.numeroProveedor.replace(/[-/]/g, ""),
      origen: "LECTURA_IA",
      notas: `${lozano.notas} · Leída del correo de facturas (reenvío del proveedor)`,
    });
    casos.push(`duplicada ${lozano.numeroProveedor}`);
  }
  // d) Albarán recibido a medias en el obrador: la factura cobra lo pedido
  const parcial = compras.find((c) => c.centroId === ob && c.estado === "RECIBIDO_PARCIAL");
  const fParcial = parcial && facturas.find((f) => f.albaranIds.length === 1 && f.albaranIds[0] === parcial.id);
  if (parcial && fParcial) {
    fParcial.lineas = parcial.lineas.map((l) => ({ concepto: l.producto.nombre, cantidad: Number(l.cantidad), precio: r4(Number(l.precio)), tipoIva: Number(l.producto.iva), categoria: "MERC-BEB", productoId: l.productoId }));
    fParcial.origen = "LECTURA_IA";
    casos.push(`cobra lo pedido y no lo recibido ${fParcial.numeroProveedor}`);
  }
  // e) Abono de la pescadería por género devuelto (se compensa en el próximo pago)
  const lonjaVieja = facturas.filter((f) => f.proveedorNombre === "PESCADOS Y MARISCOS LONJA CENTRO S.L." && f.centro === "L" && f.fecha < mas(hoy, -21))[1];
  if (lonjaVieja) {
    const l = [...lonjaVieja.lineas].sort((a, b) => b.precio - a.precio)[0];
    const devuelto = Math.min(l.cantidad, l.cantidad >= 4 ? 2 : 1);
    facturas.push({
      ...lonjaVieja,
      numeroProveedor: `${lonjaVieja.numeroProveedor.replace("LC-", "LC-AB-")}`,
      fecha: mas(lonjaVieja.fecha, 3),
      vencimiento: mas(hoy, 1),
      lineas: [{ ...l, concepto: `Abono: ${l.concepto} devuelto (no llegó en buen estado)`, cantidad: -devuelto }],
      albaranIds: [],
      estado: "VALIDADA",
      notas: `Abono de la factura ${lonjaVieja.numeroProveedor}. Se descuenta en el próximo pago al proveedor.`,
    });
    casos.push(`abono de ${lonjaVieja.numeroProveedor}`);
  }
  // f) Factura vencida con el pago retenido por una reclamación
  const despensa = facturas.filter((f) => f.proveedorNombre === "DESPENSA GOURMET IBERIA DISTRIBUCIÓN S.A." && f.centro === "L" && f.vencimiento && f.vencimiento < hoy && f.vencimiento > mas(hoy, -10))[0];
  if (despensa) {
    despensa.noPagar = true;
    despensa.notas = `${despensa.notas} · Pago retenido: falta el abono de dos latas de conserva golpeadas (reclamado el ${ddmm(mas(despensa.fecha, 2))})`;
    casos.push(`vencida y retenida ${despensa.numeroProveedor}`);
  }

  // =========================================================================
  // 2. Gastos del local (septiembre, octubre y lo que va de noviembre)
  // =========================================================================
  const meses: { a: number; m: number }[] = [];
  for (let d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1)); d <= hoy; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
    meses.push({ a: d.getUTCFullYear(), m: d.getUTCMonth() });
  const elDia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m, d));
  /** Pagado si vence hasta hoy (domiciliación o transferencia puntual). */
  const pagoSi = (vence: Date | null) => (vence && vence <= hoy ? vence : null);

  // [categoría, concepto, proveedor, base, IVA, día, días hasta vencer, forma, recurrente, centro (false = de la sociedad)]
  type Fijo = [string, string, string, number | ((i: number) => number), number, number | "fin", number, FormaPagoContable, boolean, boolean, string?];
  const FIJOS: Fijo[] = [
    ["ALQ", "Alquiler del local (C/ de las Pruebas 1)", "Patrimonio Recoletos S.L. (propietario, ejemplo)", 14000, 21, 1, 4, "TRANSFERENCIA", true, true,
      "Retención del 19 % de IRPF por alquiler de local (2.660 €, modelo 115): el ERP no tiene campo de retención; al casero se le pagan 14.280 € y la retención va a Hacienda cada trimestre. A comprobar con la gestoría."],
    ["SEG", "Seguro multirriesgo y responsabilidad civil (recibo mensual)", "Aseguradora Castellana de Hostelería (ejemplo)", 465.3, 0, 5, 0, "DOMICILIACION", true, true, "Exento de IVA; la prima lleva el impuesto sobre primas de seguro (8 %) incluido."],
    ["TEL", "Teléfono, internet y línea del datáfono", "Operadora de Telecomunicaciones (ejemplo)", 148.5, 21, 10, 10, "DOMICILIACION", true, true],
    ["OTROS", "Programa del TPV y de reservas (cuota mensual)", "Software Hostelero (ejemplo)", 119, 21, 1, 0, "DOMICILIACION", true, true],
    ["LIMP", "Limpieza profunda de cocina y cristales (contrata nocturna)", "Limpiezas Industriales Castellana (ejemplo)", 1380, 21, "fin", 30, "TRANSFERENCIA", true, true],
    ["LIMP", "Control de plagas (DDD), contrato mensual", "Sanidad Ambiental Madrid (ejemplo)", 95, 21, 15, 0, "DOMICILIACION", true, true],
    ["LIMP", "Lavandería de mantelería y uniformes", "Lavandería Industrial del Henares (ejemplo)", (i) => [742.6, 811.35, 0][i] ?? 760, 21, "fin", 30, "TRANSFERENCIA", false, true],
    ["ASES", "Gestoría laboral, fiscal y contable (Inversiones Hispano Argentinas 2021)", "Asesores Asociados Retiro S.L. (ejemplo)", 690, 21, 5, 0, "DOMICILIACION", true, false,
      "Gasto de la sociedad, sin centro: cubre los dos locales (Raza Barquillo y Raza Pruebas). No se reparte entre locales."],
    ["COMI", "Comisiones del datáfono", "Banco (ejemplo)", (i) => [1012.4, 1068.75, 0][i] ?? 1000, 0, "fin", 0, "DOMICILIACION", false, true,
      "Estimadas (≈0,45 % de las ventas con tarjeta). Deberían salir del extracto del banco o de los cierres de caja."],
  ];
  meses.forEach(({ a, m }, i) => {
    for (const [categoria, concepto, proveedor, base, iva, d, vence, forma, recurrente, conCentro, notas] of FIJOS) {
      const fecha = d === "fin" ? finDeMes(a, m) : elDia(a, m, d);
      if (fecha > hoy) continue; // lo que aún no ha llegado no se apunta
      const importe = typeof base === "function" ? base(i) : base;
      if (!importe) continue;
      const vencimiento = mas(fecha, vence);
      gastos.push({ sociedadId: socLocal, centroId: conCentro ? local : null, categoria, fecha, vencimiento, concepto: `${concepto} · ${MESES[m]}`, proveedorNombre: proveedor, base: importe, tipoIva: iva, recurrente, forma, pagadoEn: pagoSi(vencimiento), notas });
    }
  });

  // Facturas de gasto (con su factura del proveedor): suministros, mantenimiento, publicidad, carbón
  const gasto = (categoria: string, proveedor: string, cif: string, numero: string, fecha: Date, dias: number, forma: FormaPagoContable, lineas: [string, number, number, number][], notas?: string) => {
    if (fecha > hoy || fecha < mas(inicio, -20)) return;
    facturas.push({
      centro: "L", sociedadId: socLocal, centroId: local, proveedorId: null, proveedorNombre: proveedor, proveedorCif: cif, numeroProveedor: numero, categoria,
      fecha, vencimiento: mas(fecha, dias), forma, notas: notas ?? null, albaranIds: [],
      lineas: lineas.map(([concepto, cantidad, precio, tipoIva]) => ({ concepto, cantidad, precio, tipoIva, categoria })),
    });
  };
  const LUZ: [number, number, number][] = [[1386.2, 2846.55, 18], [1386.2, 3021.4, 18], [1386.2, 2934.7, 18]]; // potencia, energía, contador
  const GAS = [884.3, 962.15, 1018.6];
  meses.forEach(({ a, m }, i) => {
    const anterior = MESES[(m + 11) % 12];
    const [pot, ene, cont] = LUZ[i] ?? LUZ[0];
    const ie = r2((pot + ene) * 0.0511269632);
    gasto("SUM", "Energía Madrid Comercializadora S.L. (ejemplo)", "B00000001", `EMC${a}${String(m + 1).padStart(2, "0")}0417`, elDia(a, m, 7), 10, "DOMICILIACION",
      [[`Término de potencia (${anterior})`, 1, pot, 21], [`Energía consumida (${anterior})`, 1, ene, 21], ["Impuesto especial sobre la electricidad", 1, ie, 21], ["Alquiler del contador", 1, cont, 21]],
      `Consumo de ${anterior}: la factura llega en ${MESES[m]} y cuenta en ${MESES[m]}.`);
    gasto("SUM", "Gas Natural Distribución Centro (ejemplo)", "B00000002", `GN-${a}-${String(m + 1).padStart(2, "0")}-88213`, elDia(a, m, 12), 10, "DOMICILIACION",
      [[`Gas natural (${anterior})`, 1, GAS[i] ?? 950, 21], ["Impuesto de hidrocarburos y alquiler de equipos", 1, 41.2, 21]]);
    gasto("PUBL", "Agencia Brasa Digital S.L. (ejemplo)", "B00000003", `BD-${String(m + 1).padStart(2, "0")}/${a}-021`, elDia(a, m, 1), 15, "TRANSFERENCIA",
      [[`Gestión de redes sociales y campañas (${MESES[m]})`, 1, 650, 21]]);
    if (i > 0)
      gasto("PUBL", "Plataforma de Reservas Online (ejemplo)", "B00000004", `PRO-${a}${String(m + 1).padStart(2, "0")}-5521`, elDia(a, m, 3), 0, "DOMICILIACION",
        [[`Comisión por comensal reservado (${anterior})`, i === 1 ? 412 : 438, 2, 21]]);
    for (const d of [14, 28])
      gasto("MERC-CONS", "Carbones y Leñas del Tiétar S.L. (ejemplo)", "B00000005", `CLT-26-${String(410 + i * 2 + (d === 28 ? 1 : 0))}`, elDia(a, m, d), 30, "TRANSFERENCIA",
        [["Carbón vegetal de encina (saco de 15 kg)", 40, 21.5, 21], ["Leña de encina para encendido (palé)", 1, 145, 21]],
        "Combustible de la parrilla: no está en el almacén ni en los escandallos.");
  });
  // Agua (bimestral, IVA 10 %)
  for (const [fecha, consumo] of [[new Date(Date.UTC(2026, 8, 12)), 588.4], [new Date(Date.UTC(2026, 10, 12)), 612.9]] as [Date, number][])
    gasto("SUM", "Suministro de agua (Canal, ejemplo)", "Q00000006", `AG-${iso(fecha).replace(/-/g, "")}-3310`, fecha, 15, "DOMICILIACION",
      [["Consumo de agua del bimestre", 1, consumo, 10], ["Cuota de servicio y alcantarillado", 1, 96.3, 10]]);
  // Mantenimiento
  gasto("MANT", "Frío Industrial Chamartín S.L. (ejemplo)", "B00000007", "FIC-2026-1188", new Date(Date.UTC(2026, 8, 29)), 30, "TRANSFERENCIA",
    [["Reparación del compresor de la cámara de carnes", 1, 385, 21], ["Desplazamiento y mano de obra urgente (domingo)", 1, 120, 21]]);
  gasto("MANT", "Extracción y Campanas Madrid S.L. (ejemplo)", "B00000008", "ECM-26-0712", new Date(Date.UTC(2026, 9, 22)), 30, "TRANSFERENCIA",
    [["Limpieza de campana, filtros y conductos de extracción (trimestral)", 1, 720, 21], ["Certificado de limpieza", 1, 35, 21]]);
  gasto("MANT", "Protección Contra Incendios Centro S.L. (ejemplo)", "B00000009", "PCI-4471", new Date(Date.UTC(2026, 9, 28)), 30, "TRANSFERENCIA",
    [["Revisión anual de extintores (8 uds.)", 8, 18.5, 21], ["Retimbrado de extintor de CO2", 1, 88, 21]]);
  gasto("MANT", "Parrillas y Brasas Hostelería S.L. (ejemplo)", "B00000010", "PBH-26-219", new Date(Date.UTC(2026, 10, 9)), 30, "TRANSFERENCIA",
    [["Cambio de parrillas de acero inoxidable de la brasa", 2, 165, 21], ["Mano de obra", 1, 60, 21]]);

  // =========================================================================
  // 3. Nóminas de septiembre y octubre (de las nóminas reales de Personal)
  // =========================================================================
  const nominas = await prisma.nomina.findMany({
    where: { tenantId: t, centroId: local, estado: { in: ["CERRADA", "PAGADA"] } },
    select: { periodo: true, sociedadId: true, estado: true, fechaPago: true, devengado: true, ssEmpresa: true, ssTrabajador: true, irpf: true, otrasDeducciones: true, neto: true, pagoDelegadoIT: true },
  });
  const porPeriodo = new Map<string, typeof nominas>();
  for (const n of nominas) porPeriodo.set(n.periodo, [...(porPeriodo.get(n.periodo) ?? []), n]);
  const suma = (lista: typeof nominas, campo: "devengado" | "ssEmpresa" | "ssTrabajador" | "irpf" | "otrasDeducciones" | "neto" | "pagoDelegadoIT") => r2(lista.reduce((s, n) => s + Number(n[campo]), 0));
  for (const [per, lista] of Array.from(porPeriodo.entries()).sort()) {
    const [a, m1] = per.split("-").map(Number);
    const m = m1 - 1;
    const fecha = finDeMes(a, m);
    if (fecha < mas(inicio, -31)) continue;
    const soc = lista[0].sociedadId ?? socLocal;
    const mes = MESES[m];
    const pagadas = lista.filter((n) => n.estado === "PAGADA");
    const sinPagar = lista.filter((n) => n.estado !== "PAGADA");
    const nom = (n: number) => `${n} ${n === 1 ? "nómina" : "nóminas"}`;
    const comun = { sociedadId: soc, centroId: local, fecha, recurrente: false, tipoIva: 0 };
    if (pagadas.length) {
      const pago = pagadas[0].fechaPago ?? mas(fecha, 3);
      gastos.push({ ...comun, categoria: "PERS", vencimiento: pago, concepto: `Nóminas de ${mes}: líquido a los empleados (${nom(pagadas.length)})`, proveedorNombre: "Empleados de Raza Pruebas", base: suma(pagadas, "neto"), forma: "TRANSFERENCIA", pagadoEn: pago });
    }
    if (sinPagar.length) {
      const vence = mas(fecha, 5);
      gastos.push({ ...comun, categoria: "PERS", vencimiento: vence, concepto: `Nóminas de ${mes}: líquido pendiente de pagar (${nom(sinPagar.length)} cerradas sin pagar)`, proveedorNombre: "Empleados de Raza Pruebas", base: suma(sinPagar, "neto"), forma: "TRANSFERENCIA", pagadoEn: null, notas: "Nóminas cerradas en Personal y aún sin marcar como pagadas." });
    }
    // IRPF: modelo 111 trimestral, hasta el día 20 del mes siguiente al trimestre
    const finTrim = Math.floor(m / 3) * 3 + 3;
    const venceIrpf = new Date(Date.UTC(a, finTrim, 20));
    gastos.push({ ...comun, categoria: "PERS", vencimiento: venceIrpf, concepto: `Nóminas de ${mes}: retenciones de IRPF (modelo 111, ${Math.floor(m / 3) + 1}.º trimestre)`, proveedorNombre: "Agencia Tributaria", base: suma(lista, "irpf"), forma: "DOMICILIACION", pagadoEn: pagoSi(venceIrpf) });
    // Seguridad Social: se paga el último día laborable del mes siguiente (cuota obrera + empresa − pago delegado de IT)
    const venceSS = ultimoLaborable(a, m + 1);
    const delegado = suma(lista, "pagoDelegadoIT");
    gastos.push({ ...comun, categoria: "PERS", vencimiento: venceSS, concepto: `Seguros sociales de ${mes}: cuota del trabajador`, proveedorNombre: "Tesorería General de la Seguridad Social", base: suma(lista, "ssTrabajador"), forma: "DOMICILIACION", pagadoEn: pagoSi(venceSS) });
    gastos.push({
      ...comun, categoria: "PERS-SS", vencimiento: venceSS, concepto: `Seguros sociales de ${mes}: cuota de la empresa`, proveedorNombre: "Tesorería General de la Seguridad Social",
      base: r2(suma(lista, "ssEmpresa") - delegado), forma: "DOMICILIACION", pagadoEn: pagoSi(venceSS),
      notas: delegado ? `Cuota de empresa ${suma(lista, "ssEmpresa")} € menos ${delegado} € de pago delegado de IT que se compensa en el mismo recibo.` : undefined,
    });
    const otras = suma(lista, "otrasDeducciones");
    if (otras) gastos.push({ ...comun, categoria: "PERS", vencimiento: fecha, concepto: `Nóminas de ${mes}: anticipos y embargos descontados`, proveedorNombre: "Varios", base: otras, forma: "TRANSFERENCIA", pagadoEn: fecha });
  }

  // =========================================================================
  // 4. Facturas emitidas
  // =========================================================================
  interface LineaFE { concepto: string; cantidad: number; precio: number; tipoIva: number; base?: number; cuota?: number; anticipo?: FacturaFE }
  interface FacturaFE {
    sociedadId: string; centroId: string | null; origen: "EVENTO" | "ENTRE_SOCIEDADES" | "OTRO"; clienteNombre: string; clienteCif: string | null; sociedadDestinoId?: string | null;
    fecha: Date; vencimiento: Date | null; estado: "PREPARADA" | "EMITIDA_FUERA" | "COBRADA"; serie: string; numeroOficial?: string; cobradaEn?: Date | null; forma?: FormaPagoContable; notas: string; lineas: LineaFE[];
  }
  const emitidas: FacturaFE[] = [];
  const PROGRAMA = "Programa de facturación certificado (pendiente de elegir, P-23)";
  /** Líneas con precio IVA incluido (como los presupuestos de eventos) → base y cuota que suman exacto. */
  const desdeConIva = (concepto: string, cantidad: number, precioConIva: number, iva: number): LineaFE => {
    const total = r2(cantidad * precioConIva);
    const base = r2(total / (1 + iva / 100));
    return { concepto, cantidad, precio: r4(base / cantidad), tipoIva: iva, base, cuota: r2(total - base) };
  };

  // Eventos de RZ-PRU con presupuesto aceptado
  const eventos = await prisma.eventoSolicitud.findMany({
    where: { tenantId: t, centroId: local, estado: { in: ["ACEPTADA", "CELEBRADA"] } },
    include: { presupuestos: { where: { estado: "ACEPTADO" }, include: { lineas: { orderBy: { orden: "asc" } } } } },
    orderBy: { fecha: "asc" },
  });
  const CIF_CLIENTE: Record<string, string> = { "Nexo Ingeniería S.A.": "A00000011", "Lumbre Consultores S.L.": "B00000012", "Abogados Recoletos": "B00000013" };
  const huecosEventos: string[] = [];
  // La señal del último evento de empresa aceptado aún no ha llegado (sirve para ver una factura preparada)
  const senalPendiente = eventos
    .filter((e) => e.empresa && Number(e.presupuestos[0]?.senal ?? 0) > 0 && e.presupuestos[0]?.aceptadoEn)
    .sort((a, b) => b.presupuestos[0].aceptadoEn!.getTime() - a.presupuestos[0].aceptadoEn!.getTime())[0]?.id;
  for (const ev of eventos) {
    const pre = ev.presupuestos[0];
    if (!pre || !ev.fecha) {
      huecosEventos.push(`${ev.numero} aceptado sin presupuesto aceptado`);
      continue;
    }
    const cliente = ev.empresa ?? ev.nombreContacto;
    const cif = ev.empresa ? (CIF_CLIENTE[ev.empresa] ?? null) : null;
    const total = Number(pre.total);
    const senal = Number(pre.senal ?? 0);
    const aceptado = pre.aceptadoEn ? aFecha(isoMadrid(pre.aceptadoEn)) : mas(ev.fecha, -20);
    const celebrado = ev.fecha <= hoy;
    let anticipo: FacturaFE | null = null;
    if (senal > 0) {
      const fSenal = mas(aceptado, ev.empresa ? 2 : 1);
      const cobrada = ev.id !== senalPendiente;
      const linea = desdeConIva(`Anticipo a cuenta del evento ${ev.numero} del ${ddmm(ev.fecha)} (señal del presupuesto ${pre.numero})`, 1, senal, 10);
      if (cobrada) {
        anticipo = { sociedadId: socLocal, centroId: local, origen: "EVENTO", clienteNombre: cliente, clienteCif: cif, fecha: fSenal, vencimiento: fSenal, estado: "COBRADA", serie: "IHA-A26", cobradaEn: fSenal, forma: "TRANSFERENCIA", notas: `Factura de anticipo: el IVA se devenga al cobrar la señal. Evento ${ev.numero}.`, lineas: [linea] };
        emitidas.push(anticipo);
      } else {
        emitidas.push({ sociedadId: socLocal, centroId: local, origen: "EVENTO", clienteNombre: cliente, clienteCif: cif, fecha: fSenal, vencimiento: mas(fSenal, 7), estado: "PREPARADA", serie: "IHA-A26", notas: `Señal pedida el ${ddmm(aceptado)} y aún sin cobrar: la factura de anticipo se emite cuando llegue la transferencia. Evento ${ev.numero}.`, lineas: [linea] });
      }
    }
    if (celebrado) {
      const lineas = pre.lineas.map((l) => desdeConIva(l.concepto, Number(l.cantidad), Number(l.precio), Number(l.iva)));
      if (anticipo) {
        const a = desdeConIva("Menos anticipo facturado", 1, senal, 10);
        lineas.push({ ...a, cantidad: -1, base: -a.base!, cuota: -a.cuota!, anticipo });
      }
      const empresa = !!ev.empresa;
      const fecha = empresa ? mas(ev.fecha, 1) : ev.fecha;
      const vence = empresa ? mas(fecha, 15) : fecha;
      const cobrada = !empresa;
      emitidas.push({
        sociedadId: socLocal, centroId: local, origen: "EVENTO", clienteNombre: cliente, clienteCif: cif, fecha, vencimiento: vence, estado: cobrada ? "COBRADA" : "EMITIDA_FUERA",
        serie: "IHA-F26", cobradaEn: cobrada ? fecha : null, forma: cobrada ? "TARJETA" : "TRANSFERENCIA",
        notas: cobrada
          ? `Evento ${ev.numero} (${ev.personas} personas). Cobrada con tarjeta en el TPV del local el día del evento: esa venta está también en la caja; ojo con contarla dos veces.`
          : `Evento ${ev.numero} (${ev.personas} personas). Factura a 15 días por transferencia.${pre.condiciones?.includes("Señal") && !senal ? " El presupuesto pedía señal pero no se registró ninguna." : ""}`,
        lineas,
      });
    }
  }

  // =========================================================================
  // 5. Estados, números y escritura
  // =========================================================================
  facturas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.proveedorNombre.localeCompare(b.proveedorNombre));
  const numerosFR = await reservarNumeros(prisma, t, "FR", facturas.length);
  const filasFR: Prisma.FacturaRecibidaCreateManyInput[] = [];
  const filasFRL: Prisma.FacturaRecibidaLineaCreateManyInput[] = [];
  const filasFRA: Prisma.FacturaRecibidaAlbaranCreateManyInput[] = [];
  const pagos: Prisma.PagoCobroCreateManyInput[] = [];
  const resumen = { recibidas: 0, pendientes: 0, validadas: 0, pagadas: 0, vencidas: 0, base: 0 };

  facturas.forEach((f, i) => {
    const id = nuevoId();
    const ls = f.lineas.map((l, orden) => {
      const base = r2(l.cantidad * l.precio);
      return { id: nuevoId(), facturaId: id, concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, tipoIva: l.tipoIva, base, cuotaIva: r2((base * l.tipoIva) / 100), categoriaId: cat[l.categoria] ?? null, productoId: l.productoId ?? null, orden };
    });
    const base = r2(ls.reduce((s, l) => s + l.base, 0));
    const cuotaIva = r2(ls.reduce((s, l) => s + l.cuotaIva, 0));
    const total = r2(base + cuotaIva);
    let estado: EstadoFacturaRecibida = f.estado ?? "VALIDADA";
    let pagadaEn: Date | null = f.pagadaEn ?? null;
    let origen: "MANUAL" | "LECTURA_IA" | "ELECTRONICA" = f.origen ?? (f.proveedorNombre === "MADURADOS DEL NORTE CARNES SELECTAS S.L." ? "ELECTRONICA" : "MANUAL");
    if (!f.estado) {
      if (f.fecha >= recientes) {
        estado = "PENDIENTE";
        if (origen === "MANUAL") origen = "LECTURA_IA";
      } else if (!f.noPagar && f.vencimiento && f.vencimiento <= hoy) {
        estado = "PAGADA";
        pagadaEn = f.vencimiento;
      }
    }
    if (estado === "PAGADA" && pagadaEn)
      pagos.push({ tenantId: t, sociedadId: f.sociedadId, tipo: "PAGO", fecha: pagadaEn, importe: total, forma: f.forma, facturaRecibidaId: id, referencia: `Pago ${f.numeroProveedor}`, usuarioId: admin });
    resumen.recibidas++;
    resumen.base += base;
    if (estado === "PENDIENTE") resumen.pendientes++;
    if (estado === "VALIDADA") resumen.validadas++;
    if (estado === "PAGADA") resumen.pagadas++;
    if (estado !== "PAGADA" && f.vencimiento && f.vencimiento < hoy) resumen.vencidas++;
    filasFR.push({
      id, tenantId: t, numero: numerosFR[i], numeroProveedor: f.numeroProveedor, proveedorId: f.proveedorId, proveedorNombre: f.proveedorNombre, proveedorCif: f.proveedorCif,
      sociedadId: f.sociedadId, centroId: f.centroId, categoriaId: cat[f.categoria] ?? null, fecha: f.fecha, vencimiento: f.vencimiento, base, cuotaIva, total, estado, origen,
      pedidoCompraId: null, notas: f.notas ?? null, creadoPor: f.centro === "L" ? gerente : usr("economato@erp.local") ?? admin,
      validadaPor: estado === "PENDIENTE" ? null : admin, validadaEn: estado === "PENDIENTE" ? null : mas(f.fecha, 3), pagadaEn,
      createdAt: mas(f.fecha, 1), updatedAt: pagadaEn ?? mas(f.fecha, estado === "PENDIENTE" ? 1 : 3),
    });
    filasFRL.push(...ls);
    for (const pedidoCompraId of f.albaranIds) filasFRA.push({ tenantId: t, facturaId: id, pedidoCompraId });
  });

  // Gastos
  const filasG: Prisma.GastoContableCreateManyInput[] = gastos.map((g) => {
    const id = nuevoId();
    const cuotaIva = r2((g.base * g.tipoIva) / 100);
    const total = r2(g.base + cuotaIva);
    if (g.pagadoEn) pagos.push({ tenantId: t, sociedadId: g.sociedadId, tipo: "PAGO", fecha: g.pagadoEn, importe: total, forma: g.forma, gastoId: id, referencia: g.concepto.slice(0, 80), usuarioId: admin });
    return {
      id, tenantId: t, sociedadId: g.sociedadId, centroId: g.centroId, categoriaId: cat[g.categoria], fecha: g.fecha, vencimiento: g.vencimiento, concepto: g.concepto, proveedorNombre: g.proveedorNombre,
      base: g.base, cuotaIva, total, recurrente: g.recurrente, estado: g.pagadoEn ? "PAGADO" : "PENDIENTE", notas: g.notas ?? null, creadoPor: admin, pagadoEn: g.pagadoEn,
      createdAt: mas(g.fecha, 1), updatedAt: g.pagadoEn ?? mas(g.fecha, 1),
    };
  });

  // Facturas emitidas (referencia interna PRE- del contador, como hace el módulo)
  emitidas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  // Número oficial por serie y en orden de fecha (lo daría el programa certificado); el anticipo se cita en la final
  const ultimo: Record<string, number> = { "IHA-A26": 37, "IHA-F26": 410 };
  for (const f of emitidas) {
    if (f.estado !== "PREPARADA" && !f.numeroOficial) f.numeroOficial = `${f.serie}/${String((ultimo[f.serie] = (ultimo[f.serie] ?? 0) + 1)).padStart(4, "0")}`;
    for (const l of f.lineas) if (l.anticipo) l.concepto = `Menos anticipo facturado (${l.anticipo.numeroOficial})`;
  }
  const numerosPRE = await reservarNumeros(prisma, t, "PRE", emitidas.length);
  const filasFE: Prisma.FacturaEmitidaCreateManyInput[] = [];
  const filasFEL: Prisma.FacturaEmitidaLineaCreateManyInput[] = [];
  emitidas.forEach((f, i) => {
    const id = nuevoId();
    const ls = f.lineas.map((l, orden) => {
      const base = l.base ?? r2(l.cantidad * l.precio);
      return { id: nuevoId(), facturaId: id, concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, tipoIva: l.tipoIva, base, cuotaIva: l.cuota ?? r2((base * l.tipoIva) / 100), orden };
    });
    const base = r2(ls.reduce((s, l) => s + l.base, 0));
    const cuotaIva = r2(ls.reduce((s, l) => s + l.cuotaIva, 0));
    const total = r2(base + cuotaIva);
    if (f.estado === "COBRADA" && f.cobradaEn)
      pagos.push({ tenantId: t, sociedadId: f.sociedadId, tipo: "COBRO", fecha: f.cobradaEn, importe: total, forma: f.forma ?? "TRANSFERENCIA", facturaEmitidaId: id, referencia: `Cobro ${f.numeroOficial}`, usuarioId: admin });
    filasFE.push({
      id, tenantId: t, referencia: numerosPRE[i], numeroOficial: f.estado === "PREPARADA" ? null : f.numeroOficial, programaEmisor: f.estado === "PREPARADA" ? null : PROGRAMA,
      sociedadId: f.sociedadId, centroId: f.centroId, origen: f.origen, clienteNombre: f.clienteNombre, clienteCif: f.clienteCif, sociedadDestinoId: f.sociedadDestinoId ?? null,
      fecha: f.fecha, vencimiento: f.vencimiento, base, cuotaIva, total, estado: f.estado, notas: f.notas, creadoPor: admin, cobradaEn: f.cobradaEn ?? null,
      createdAt: f.fecha, updatedAt: f.cobradaEn ?? f.fecha,
    });
    filasFEL.push(...ls);
  });

  await enLotes(filasFR, 500, (l) => prisma.facturaRecibida.createMany({ data: l }));
  await enLotes(filasFRL, 2000, (l) => prisma.facturaRecibidaLinea.createMany({ data: l }));
  await enLotes(filasFRA, 2000, (l) => prisma.facturaRecibidaAlbaran.createMany({ data: l }));
  await enLotes(filasG, 500, (l) => prisma.gastoContable.createMany({ data: l }));
  await enLotes(filasFE, 500, (l) => prisma.facturaEmitida.createMany({ data: l }));
  await enLotes(filasFEL, 2000, (l) => prisma.facturaEmitidaLinea.createMany({ data: l }));
  await enLotes(pagos, 1000, (l) => prisma.pagoCobro.createMany({ data: l }));

  // ---------- Facturas entre sociedades del obrador al local (con la función del ERP) ----------
  // Una por mes ya cerrado con pedidos recibidos de OB a RZ-PRU; el mes en curso se factura al cerrarlo.
  const entre = { facturas: 0, mismaSociedad: 0 };
  if (admin) {
    const deps: Dependencias = {
      numerar: async (tx, tenantId, serie) => (await reservarNumeros(tx as PrismaClient, tenantId, serie, 1))[0],
      auditar: async (tx, a) => {
        await tx.auditoria.create({ data: { tenantId: a.tenantId, usuarioId: a.usuarioId, entidad: a.entidad, entidadId: a.entidadId, accion: a.accion, antes: (a.antes ?? undefined) as object | undefined, despues: (a.despues ?? undefined) as object | undefined } });
      },
    };
    const servidos = await prisma.pedidoInterno.findMany({ where: { tenantId: t, origenId: ob, destinoId: local, estado: "RECIBIDO", servidoEn: { not: null } }, select: { servidoEn: true } });
    const mesesPedidos = Array.from(new Set(servidos.map((p) => isoMadrid(p.servidoEn!).slice(0, 7)))).sort();
    let numeroOB = 120;
    for (const mes of mesesPedidos) {
      const [a, m1] = mes.split("-").map(Number);
      if (finDeMes(a, m1 - 1) >= hoy) continue; // mes sin cerrar
      const r = await prisma.$transaction((tx) => generarFacturasObrador(tx, t, admin, mes, [ob], deps, { destinoIds: [local], ahora: ctx.hoy }), { timeout: 60_000 });
      entre.mismaSociedad += r.mismaSociedad;
      for (const g of r.generadas) {
        entre.facturas++;
        // después: emitida en el programa certificado (número oficial) y, si ya venció, cobrada y pagada por el local
        const emitida = await prisma.facturaEmitida.findUniqueOrThrow({ where: { id: g.emitidaId } });
        const numeroOficial = `OB-F26/${String(++numeroOB).padStart(4, "0")}`;
        const vence = emitida.vencimiento!;
        const cobrada = vence <= hoy;
        await prisma.facturaEmitida.update({ where: { id: g.emitidaId }, data: { estado: cobrada ? "COBRADA" : "EMITIDA_FUERA", numeroOficial, programaEmisor: PROGRAMA, cobradaEn: cobrada ? vence : null } });
        await prisma.facturaRecibida.update({
          where: { id: g.espejoId },
          data: { numeroProveedor: numeroOficial, estado: cobrada ? "PAGADA" : "VALIDADA", validadaPor: admin, validadaEn: mas(emitida.fecha, 3), pagadaEn: cobrada ? vence : null },
        });
        if (cobrada)
          await prisma.pagoCobro.createMany({
            data: [
              { tenantId: t, sociedadId: emitida.sociedadId, tipo: "COBRO", fecha: vence, importe: emitida.total, forma: "TRANSFERENCIA", facturaEmitidaId: g.emitidaId, referencia: `Cobro ${numeroOficial}`, usuarioId: admin },
              { tenantId: t, sociedadId: socLocal, tipo: "PAGO", fecha: vence, importe: emitida.total, forma: "TRANSFERENCIA", facturaRecibidaId: g.espejoId, referencia: `Pago ${numeroOficial}`, usuarioId: admin },
            ],
          });
      }
    }
  }

  console.log(
    `  contabilidad: ${resumen.recibidas} facturas recibidas (${resumen.pendientes} por revisar, ${resumen.validadas} validadas, ${resumen.pagadas} pagadas, ${resumen.vencidas} vencidas sin pagar; ${r2(resumen.base)} € de base), ` +
      `${filasG.length} gastos, ${filasFE.length} facturas emitidas, ${pagos.length} pagos y cobros`,
  );
  console.log(`  contabilidad: casos de revisión: ${casos.join(" · ")}`);
  console.log(`  contabilidad: ${entre.facturas} facturas del obrador al local generadas con generarFacturasObrador${entre.mismaSociedad ? ` (${entre.mismaSociedad} meses de la misma sociedad, sin factura)` : ""}${entreSociedades ? "" : " (OB y RZ-PRU son de la misma sociedad: sin factura)"}`);
  if (huecosEventos.length) console.log(`  contabilidad: eventos sin facturar: ${huecosEventos.join(" · ")}`);
}
