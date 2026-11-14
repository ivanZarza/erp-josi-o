import "server-only";
/**
 * Lógica del Cuadro de mando. Funciona aunque falten otros módulos: cada fuente se usa solo si su
 * módulo está contratado (ctx.tieneModulo); si no, la cifra sale como «sin datos» (null), nunca inventada.
 *
 * Fuentes:
 * - Ventas, comensales, tickets → Caja (ventasPorCentroYDia).
 * - Mercancía → coste teórico de lo vendido (tickets de Caja × escandallos) en los locales con tickets, desde
 *   su primer día con tickets; si no, núcleo (MovimientoStock): compras recibidas + recibido de otros centros
 *   − servido a otros centros. El teórico es mejor: no depende de cuándo se compra y no cuenta el stock que
 *   queda en el almacén. Cada cifra dice cuál se ha usado (mercanciaTeorica / mercanciaCompras = días).
 * - Gastos → Contabilidad (gastosPorCentroYDia): gastos registrados + facturas de categorías de gasto.
 * - Personal → coste por centro y día del módulo Personal (costePersonalPorCentroYDia: fichajes o cuadrante × coste/hora).
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import { porcentaje, euros, fecha as fechaTexto } from "@/kernel/formato";
import { ventasPorCentroYDia } from "@/modulos/caja/servicio";
import { gastosPorCentroYDia, detalleGastosCentro } from "@/modulos/contabilidad/servicio";
import { costePersonalPorCentroYDia } from "@/modulos/personal/servicio";
import { PresupuestoEsquema } from "./esquemas";

export class ErrorCuadro extends Error {}

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
export function mesActual(): string {
  return hoyISO().slice(0, 7);
}
export function rangoMes(mes: string): { desde: Date; hasta: Date } {
  const [a, m] = mes.split("-").map(Number);
  return { desde: new Date(Date.UTC(a, m - 1, 1)), hasta: new Date(Date.UTC(a, m, 1)) };
}
export function mesValido(mes: string | undefined): string {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : mesActual();
}
export function mesDesplazado(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const dia = (d: Date) => d.toISOString().slice(0, 10);

// ---------- de dónde salen las cifras ----------

export interface Fuentes {
  ventas: { hay: boolean; motivo: string };
  mercancia: { hay: boolean; motivo: string };
  gastos: { hay: boolean; motivo: string };
  personal: { hay: boolean; motivo: string };
}

export function fuentes(ctx: Contexto): Fuentes {
  const almacen = ctx.tieneModulo("bebidas") || ctx.tieneModulo("comidas") || ctx.tieneModulo("obrador");
  return {
    ventas: { hay: ctx.tieneModulo("caja"), motivo: ctx.tieneModulo("caja") ? "Jornadas de Caja y ventas" : "Caja y ventas no está contratado" },
    mercancia: {
      hay: almacen || ctx.tieneModulo("caja"),
      motivo:
        almacen || ctx.tieneModulo("caja")
          ? "Coste teórico de lo vendido (tickets × escandallos) en los locales con tickets; en el resto, compras recibidas y entradas desde otros centros"
          : "Ni Caja con tickets, ni Bebidas, ni Comidas, ni Obrador están contratados",
    },
    gastos: { hay: ctx.tieneModulo("contabilidad"), motivo: ctx.tieneModulo("contabilidad") ? "Gastos y facturas de gasto de Contabilidad" : "Contabilidad no está contratada" },
    personal: {
      hay: ctx.tieneModulo("personal"),
      motivo: ctx.tieneModulo("personal") ? "Horas fichadas (o del cuadrante si no hay fichaje) × coste por hora del contrato" : "Personal no está contratado",
    },
  };
}

// ---------- cálculo ----------

export interface Cifras {
  ventas: number | null;
  comensales: number | null;
  tickets: number | null;
  mercancia: number | null;
  gastos: number | null;
  personal: number | null;
  /** Días (centro × día) cuya mercancía es el coste teórico de lo vendido. */
  mercanciaTeorica: number;
  /** Días (centro × día) cuya mercancía son las compras y entradas. */
  mercanciaCompras: number;
}

/** Qué mercancía se ha usado en unas cifras: «teórico», «compras» o «mixto» (y null si no hay). */
export function criterioMercancia(c: Cifras): "teorico" | "compras" | "mixto" | null {
  if (c.mercanciaTeorica > 0 && c.mercanciaCompras > 0) return "mixto";
  if (c.mercanciaTeorica > 0) return "teorico";
  if (c.mercanciaCompras > 0) return "compras";
  return null;
}

export const TEXTO_CRITERIO = {
  teorico: "coste teórico de lo vendido (tickets × escandallos)",
  compras: "compras y entradas de mercancía",
  mixto: "coste teórico donde hay tickets y compras en el resto",
} as const;

const vacias = (f: Fuentes): Cifras => ({
  ventas: f.ventas.hay ? 0 : null,
  comensales: f.ventas.hay ? 0 : null,
  tickets: f.ventas.hay ? 0 : null,
  mercancia: f.mercancia.hay ? 0 : null,
  gastos: f.gastos.hay ? 0 : null,
  personal: f.personal.hay ? 0 : null,
  mercanciaTeorica: 0,
  mercanciaCompras: 0,
});

const sumar = (a: number | null, b: number) => (a === null ? null : redondear(a + b));

/** Tipos de movimiento que cuentan como mercancía entrada (con su signo). */
const TIPOS_MERCANCIA = ["ENTRADA_COMPRA", "ENTRADA_PEDIDO", "SALIDA_PEDIDO"] as const;

/** Cifras por centro y día en un rango [desde, hasta). Clave: `${centroId}|${AAAA-MM-DD}`. */
export async function cifrasPorCentroYDia(ctx: Contexto, centroIds: string[], desde: Date, hasta: Date): Promise<Map<string, Cifras>> {
  const f = fuentes(ctx);
  const mapa = new Map<string, Cifras>();
  const de = (centroId: string, fecha: Date) => {
    const k = `${centroId}|${dia(fecha)}`;
    let c = mapa.get(k);
    if (!c) mapa.set(k, (c = vacias(f)));
    return c;
  };
  if (centroIds.length === 0) return mapa;
  const prisma = await db();
  const [ventas, movimientos, gastos, personal] = await Promise.all([
    f.ventas.hay ? ventasPorCentroYDia(ctx.tenant.id, centroIds, desde, hasta) : Promise.resolve([]),
    f.mercancia.hay
      ? prisma.movimientoStock.findMany({
          where: { tenantId: ctx.tenant.id, centroId: { in: centroIds }, tipo: { in: [...TIPOS_MERCANCIA] }, createdAt: { gte: desde, lt: hasta } },
          select: { centroId: true, cantidad: true, costeUnitario: true, createdAt: true },
        })
      : Promise.resolve([]),
    f.gastos.hay ? gastosPorCentroYDia(ctx.tenant.id, centroIds, desde, hasta) : Promise.resolve([]),
    // Personal cuenta los días con ambos extremos incluidos: hasta − 1 día
    f.personal.hay ? costePersonalPorCentroYDia(ctx.tenant.id, centroIds, desde, new Date(hasta.getTime() - 86_400_000)) : Promise.resolve([]),
  ]);
  // primer día con tickets de cada centro: desde ese día la mercancía es el coste teórico de lo vendido
  const primerDiaTeorico = new Map<string, string>();
  for (const v of ventas) {
    const c = de(v.centroId, v.fecha);
    c.ventas = sumar(c.ventas, v.ventaNeta);
    c.comensales = (c.comensales ?? 0) + v.comensales;
    c.tickets = (c.tickets ?? 0) + v.tickets;
    if (v.costeTeorico !== null) {
      c.mercancia = sumar(c.mercancia ?? 0, v.costeTeorico);
      c.mercanciaTeorica = 1;
      const d = dia(v.fecha);
      if (!primerDiaTeorico.has(v.centroId) || d < primerDiaTeorico.get(v.centroId)!) primerDiaTeorico.set(v.centroId, d);
    }
  }
  for (const m of movimientos) {
    // la cantidad ya lleva signo: lo servido a otro centro resta, lo recibido suma
    const diaM = fechaMadrid(m.createdAt);
    const desdeTeorico = primerDiaTeorico.get(m.centroId);
    if (desdeTeorico && dia(diaM) >= desdeTeorico) continue;
    const c = de(m.centroId, diaM);
    c.mercancia = sumar(c.mercancia ?? 0, Number(m.cantidad) * Number(m.costeUnitario));
    c.mercanciaCompras = 1;
  }
  for (const g of gastos) {
    const c = de(g.centroId, g.fecha);
    c.gastos = sumar(c.gastos, g.importe);
  }
  for (const p of personal) {
    const c = de(p.centroId, aFecha(p.dia));
    c.personal = sumar(c.personal, p.coste);
  }
  return mapa;
}

function porcentajeTexto(parte: number, total: number): string {
  return total ? porcentaje((parte / total) * 100) : "—";
}

/** Fecha y hora real → día (Madrid) a medianoche UTC. */
function fechaMadrid(d: Date): Date {
  return aFecha(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d));
}

export interface Presupuesto {
  ventas: number;
  mercancia: number | null;
  personal: number | null;
  gastos: number | null;
}

export interface FilaCuadro {
  clave: string;
  nombre: string;
  detalle: string; // marca · sociedad, o nº de centros
  centroIds: string[];
  cifras: Cifras;
  presupuesto: Presupuesto | null;
}

export type Vista = "centro" | "marca" | "sociedad";

/** Indicadores del mes por centro, marca o sociedad, con su presupuesto. */
export async function indicadoresMes(ctx: Contexto, mes: string, vista: Vista) {
  const prisma = await db();
  const ids = centrosFiltro(ctx);
  const r = rangoMes(mes);
  const [a, m] = mes.split("-").map(Number);
  // Mes en curso: las cifras llegan hasta hoy (el cuadrante futuro no es coste todavía)
  // y el presupuesto se reparte por días para comparar «a fecha».
  const hoy = aFecha(hoyISO());
  const hasta = r.hasta > hoy ? new Date(hoy.getTime() + 86_400_000) : r.hasta;
  const fraccion = Math.max(0, Math.min(1, (hasta.getTime() - r.desde.getTime()) / (r.hasta.getTime() - r.desde.getTime())));
  const [centros, porDia, presupuestos] = await Promise.all([
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids } }, include: { marca: true, sociedad: true }, orderBy: [{ tipo: "desc" }, { nombre: "asc" }] }),
    cifrasPorCentroYDia(ctx, ids, r.desde, hasta),
    prisma.presupuestoCentro.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, anio: a, mes: m } }),
  ]);
  const f = fuentes(ctx);
  const porCentro = new Map<string, Cifras>(centros.map((c) => [c.id, vacias(f)]));
  for (const [k, v] of porDia) acumular(porCentro.get(k.split("|")[0])!, v);
  const aFechaDe = (v: number | null) => (v === null ? null : redondear(v * fraccion));
  const presu = new Map(presupuestos.map((p) => [p.centroId, { ventas: aFechaDe(Number(p.ventas))!, mercancia: aFechaDe(num(p.mercancia)), personal: aFechaDe(num(p.personal)), gastos: aFechaDe(num(p.gastos)) }]));

  const grupos = new Map<string, FilaCuadro>();
  for (const c of centros) {
    const [clave, nombre, detalle] =
      vista === "marca" ? [c.marcaId ?? "sin-marca", c.marca?.nombre ?? "Sin marca", ""] : vista === "sociedad" ? [c.sociedadId ?? "sin-sociedad", c.sociedad?.razonSocial ?? "Sin sociedad", c.sociedad?.cif ?? ""] : [c.id, c.nombre, [c.marca?.nombre, c.sociedad?.razonSocial].filter(Boolean).join(" · ")];
    let g = grupos.get(clave);
    if (!g) grupos.set(clave, (g = { clave, nombre, detalle, centroIds: [], cifras: vacias(f), presupuesto: null }));
    g.centroIds.push(c.id);
    acumular(g.cifras, porCentro.get(c.id)!);
    const p = presu.get(c.id);
    if (p) g.presupuesto = sumarPresupuesto(g.presupuesto, p);
  }
  const filas = Array.from(grupos.values());
  if (vista !== "centro") for (const g of filas) g.detalle = `${g.centroIds.length} ${g.centroIds.length === 1 ? "centro" : "centros"}${g.detalle ? ` · ${g.detalle}` : ""}`;
  const total: FilaCuadro = { clave: "total", nombre: "Total", detalle: `${centros.length} centros`, centroIds: centros.map((c) => c.id), cifras: vacias(f), presupuesto: null };
  for (const g of filas) {
    acumular(total.cifras, g.cifras);
    if (g.presupuesto) total.presupuesto = sumarPresupuesto(total.presupuesto, g.presupuesto);
  }
  return { filas, total, fuentes: f, presupuestoAFecha: fraccion < 1 };
}

/** Cifras de un día concreto (por ejemplo, ayer) sumando todos los centros del filtro. */
export async function cifrasDelDia(ctx: Contexto, fechaISO: string): Promise<Cifras> {
  const ids = centrosFiltro(ctx);
  const desde = aFecha(fechaISO);
  const porDia = await cifrasPorCentroYDia(ctx, ids, desde, new Date(desde.getTime() + 86400000));
  const t = vacias(fuentes(ctx));
  for (const v of porDia.values()) acumular(t, v);
  return t;
}

function num(v: { toString(): string } | null): number | null {
  return v === null ? null : Number(v.toString());
}

function acumular(a: Cifras, b: Cifras) {
  for (const k of Object.keys(a) as (keyof Cifras)[]) {
    if (a[k] !== null && b[k] !== null) a[k] = redondear((a[k] as number) + (b[k] as number));
  }
}

function sumarPresupuesto(a: Presupuesto | null, b: Presupuesto): Presupuesto {
  if (!a) return { ...b };
  const s = (x: number | null, y: number | null) => (x === null && y === null ? null : redondear((x ?? 0) + (y ?? 0)));
  return { ventas: redondear(a.ventas + b.ventas), mercancia: s(a.mercancia, b.mercancia), personal: s(a.personal, b.personal), gastos: s(a.gastos, b.gastos) };
}

/** Resultado de gestión con lo que haya; `incompleto` dice qué falta. */
export function resultado(c: Cifras): { valor: number | null; faltan: string[] } {
  if (c.ventas === null) return { valor: null, faltan: ["ventas"] };
  const faltan: string[] = [];
  let v = c.ventas;
  for (const [k, nombre] of [["mercancia", "mercancía"], ["personal", "personal"], ["gastos", "gastos"]] as const) {
    if (c[k] === null) faltan.push(nombre);
    else v -= c[k] as number;
  }
  return { valor: redondear(v), faltan };
}

/** Porcentaje sobre ventas (null si no hay datos o no hay ventas). */
export function sobreVentas(valor: number | null, ventas: number | null): number | null {
  if (valor === null || !ventas) return null;
  return redondear((valor / ventas) * 100);
}

// ---------- detalle de cada cifra ----------

export type Indicador = "ventas" | "mercancia" | "gastos" | "personal";

async function centroPermitido(ctx: Contexto, centroId: string) {
  if (!ctx.centros.some((c) => c.id === centroId)) throw new ErrorCuadro("No puedes ver ese centro.");
  const prisma = await db();
  return prisma.centro.findFirstOrThrow({ where: { id: centroId, tenantId: ctx.tenant.id }, include: { marca: true, sociedad: true } });
}

export async function detalleIndicador(ctx: Contexto, indicador: Indicador, centroId: string, mes: string) {
  const centro = await centroPermitido(ctx, centroId);
  const f = fuentes(ctx);
  const r = rangoMes(mes);
  const prisma = await db();
  if (indicador === "ventas") {
    if (!f.ventas.hay) return { centro, filas: null, motivo: f.ventas.motivo };
    const v = await ventasPorCentroYDia(ctx.tenant.id, [centroId], r.desde, r.hasta);
    return { centro, motivo: f.ventas.motivo, filas: v.map((x) => ({ id: dia(x.fecha), fecha: x.fecha, documento: "Jornada", concepto: `${x.comensales} comensales · ${x.tickets} tickets`, importe: x.ventaNeta })) };
  }
  if (indicador === "mercancia") {
    if (!f.mercancia.hay) return { centro, filas: null, motivo: f.mercancia.motivo };
    // con tickets: coste teórico de lo vendido de cada día (y compras solo antes del primer día con tickets)
    const ventas = f.ventas.hay ? await ventasPorCentroYDia(ctx.tenant.id, [centroId], r.desde, r.hasta) : [];
    const teoricos = ventas.filter((v) => v.costeTeorico !== null);
    const primerTeorico = teoricos.length ? teoricos[0].fecha : null;
    const filasTeoricas = teoricos.map((v) => ({ id: `teorico|${dia(v.fecha)}`, fecha: v.fecha, documento: "Tickets", concepto: `Coste teórico de lo vendido (${porcentajeTexto(v.costeTeorico!, v.ventaNeta)} de ${euros(v.ventaNeta)} de venta)`, importe: v.costeTeorico! }));
    const movs = await prisma.movimientoStock.findMany({
      where: { tenantId: ctx.tenant.id, centroId, tipo: { in: [...TIPOS_MERCANCIA] }, createdAt: { gte: r.desde, lt: primerTeorico ?? r.hasta } },
      select: { tipo: true, documento: true, cantidad: true, costeUnitario: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    // agrupar por documento (pedido de compra, albarán…)
    const docs = new Map<string, { fecha: Date; tipo: string; importe: number; lineas: number }>();
    for (const m of movs) {
      const k = `${m.tipo}|${m.documento ?? "sin documento"}`;
      const d = docs.get(k) ?? { fecha: m.createdAt, tipo: m.tipo, importe: 0, lineas: 0 };
      d.importe += Number(m.cantidad) * Number(m.costeUnitario);
      d.lineas++;
      docs.set(k, d);
    }
    const numeros = Array.from(docs.keys()).map((k) => k.split("|")[1]);
    const compras = await prisma.pedidoCompra.findMany({ where: { tenantId: ctx.tenant.id, OR: [{ numero: { in: numeros } }, { albaran: { in: numeros } }] }, include: { proveedor: { select: { nombre: true } } } });
    const proveedorDe = new Map<string, string>();
    for (const c of compras) {
      proveedorDe.set(c.numero, c.proveedor.nombre);
      if (c.albaran) proveedorDe.set(c.albaran, c.proveedor.nombre);
    }
    const nombreTipo: Record<string, string> = { ENTRADA_COMPRA: "Compra recibida", ENTRADA_PEDIDO: "Recibido de otro centro", SALIDA_PEDIDO: "Servido a otro centro" };
    return {
      centro,
      motivo: teoricos.length
        ? `Coste teórico de lo vendido (tickets × escandallos) desde el ${fechaTexto(primerTeorico!)}${docs.size ? "; antes, compras y entradas" : ""}. Detalle por plato en Caja → Venta por plato`
        : "Compras recibidas y entradas desde otros centros (el local no tiene tickets con líneas este mes)",
      filas: [
        ...Array.from(docs.entries()).map(([k, d]) => {
          const documento = k.split("|")[1];
          return { id: k, fecha: d.fecha, documento, concepto: `${nombreTipo[d.tipo]}${proveedorDe.get(documento) ? ` · ${proveedorDe.get(documento)}` : ""} · ${d.lineas} líneas`, importe: redondear(d.importe) };
        }),
        ...filasTeoricas,
      ],
    };
  }
  if (indicador === "gastos") {
    if (!f.gastos.hay) return { centro, filas: null, motivo: f.gastos.motivo };
    const g = await detalleGastosCentro(ctx.tenant.id, centroId, r.desde, r.hasta);
    return { centro, motivo: f.gastos.motivo, filas: g.map((x) => ({ id: x.id, fecha: x.fecha, documento: x.documento, concepto: `${x.concepto} · ${x.categoria}`, importe: x.importe })) };
  }
  return { centro, filas: null, motivo: f.personal.motivo };
}

// ---------- indicadores diarios guardados (kpi_daily) ----------

/** Recalcula y guarda los indicadores de cada centro y día del mes (lo que haya en las fuentes ahora mismo). */
export async function recalcularIndicadoresMes(ctx: Contexto, mes: string): Promise<number> {
  const ids = centrosFiltro(ctx);
  const r = rangoMes(mes);
  const hoy = aFecha(hoyISO());
  const hasta = r.hasta > hoy ? new Date(hoy.getTime() + 86400000) : r.hasta;
  const porDia = await cifrasPorCentroYDia(ctx, ids, r.desde, hasta);
  const prisma = await db();
  let n = 0;
  await prisma.$transaction(async (tx) => {
    for (const [k, c] of porDia) {
      const [centroId, fechaISO] = k.split("|");
      const fecha = aFecha(fechaISO);
      const datos = { ventas: c.ventas, comensales: c.comensales, tickets: c.tickets, mercancia: c.mercancia, gastos: c.gastos, personal: c.personal, calculadoEn: new Date() };
      await tx.indicadorDiario.upsert({
        where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId, fecha } },
        create: { tenantId: ctx.tenant.id, centroId, fecha, ...datos },
        update: datos,
      });
      n++;
    }
  });
  return n;
}

export async function indicadoresDiariosGuardados(ctx: Contexto, mes: string) {
  const prisma = await db();
  const r = rangoMes(mes);
  return prisma.indicadorDiario.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centrosFiltro(ctx) }, fecha: { gte: r.desde, lt: r.hasta } },
    orderBy: [{ fecha: "desc" }, { centroId: "asc" }],
  });
}

// ---------- presupuestos ----------

export async function presupuestosMes(ctx: Contexto, mes: string) {
  const prisma = await db();
  const [a, m] = mes.split("-").map(Number);
  const ids = centrosFiltro(ctx);
  const [centros, presupuestos] = await Promise.all([
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids } }, include: { marca: true, sociedad: true }, orderBy: [{ tipo: "desc" }, { nombre: "asc" }] }),
    prisma.presupuestoCentro.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, anio: a, mes: m } }),
  ]);
  const p = new Map(presupuestos.map((x) => [x.centroId, x]));
  return centros.map((c) => ({ centro: c, presupuesto: p.get(c.id) ?? null }));
}

export async function guardarPresupuesto(ctx: Contexto, entrada: unknown) {
  const d = PresupuestoEsquema.parse(entrada);
  if (!ctx.centros.some((c) => c.id === d.centroId)) throw new ErrorCuadro("No puedes presupuestar ese centro.");
  const [anio, mes] = d.mes.split("-").map(Number);
  const prisma = await db();
  const clave = { tenantId_centroId_anio_mes: { tenantId: ctx.tenant.id, centroId: d.centroId, anio, mes } };
  const antes = await prisma.presupuestoCentro.findUnique({ where: clave });
  const datos = { ventas: d.ventas, mercancia: d.mercancia ?? null, personal: d.personal ?? null, gastos: d.gastos ?? null, notas: d.notas ?? null, editadoPor: ctx.usuario.id };
  await prisma.$transaction(async (tx) => {
    const p = await tx.presupuestoCentro.upsert({ where: clave, create: { tenantId: ctx.tenant.id, centroId: d.centroId, anio, mes, ...datos }, update: datos });
    await auditar(tx, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "PresupuestoCentro",
      entidadId: p.id,
      accion: antes ? "editar" : "crear",
      antes: antes ? { ventas: Number(antes.ventas), mercancia: num(antes.mercancia), personal: num(antes.personal), gastos: num(antes.gastos) } : undefined,
      despues: { ventas: d.ventas, mercancia: d.mercancia, personal: d.personal, gastos: d.gastos },
    });
  });
}

/** Copia el presupuesto del mes anterior a los centros que aún no tienen el de este mes. */
export async function copiarPresupuestoMesAnterior(ctx: Contexto, mes: string): Promise<number> {
  const prisma = await db();
  const ids = centrosFiltro(ctx);
  const [a, m] = mes.split("-").map(Number);
  const [ap, mp] = mesDesplazado(mes, -1).split("-").map(Number);
  const [anteriores, actuales] = await Promise.all([
    prisma.presupuestoCentro.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, anio: ap, mes: mp } }),
    prisma.presupuestoCentro.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, anio: a, mes: m }, select: { centroId: true } }),
  ]);
  const ya = new Set(actuales.map((x) => x.centroId));
  const nuevos = anteriores.filter((p) => !ya.has(p.centroId));
  if (nuevos.length === 0) return 0;
  await prisma.$transaction(async (tx) => {
    for (const p of nuevos) {
      const c = await tx.presupuestoCentro.create({
        data: { tenantId: ctx.tenant.id, centroId: p.centroId, anio: a, mes: m, ventas: p.ventas, mercancia: p.mercancia, personal: p.personal, gastos: p.gastos, notas: "Copiado del mes anterior", editadoPor: ctx.usuario.id },
      });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "PresupuestoCentro", entidadId: c.id, accion: "copiar", despues: { desde: p.id } });
    }
  });
  return nuevos.length;
}
