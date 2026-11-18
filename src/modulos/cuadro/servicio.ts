import "server-only";
import { diaMadrid, hoyMadrid, inicioDiaMadrid } from "@/kernel/fechas";
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
 * - Gastos → Contabilidad (apuntesContablesCuadro): gastos registrados + facturas línea a línea de categorías de
 *   gasto. Lo de la sociedad sin centro sale en una fila aparte (no se reparte entre los locales).
 * - Personal → regla «manda la nómina» (decisión del 15/11/2026, a confirmar por Iván): si el centro tiene nóminas
 *   calculadas ese mes (borrador, cerradas o pagadas: costeNominasPorCentroYMes), su coste empresa repartido por
 *   igual entre los días del mes; si no, horas fichadas (o del cuadrante) × coste/hora del contrato
 *   (costePersonalPorCentroYDia). Nunca las dos a la vez. Sin Personal contratado, lo apuntado en Contabilidad en
 *   categorías de Personal. Cada cifra dice cuál ha usado (criterioPersonal).
 * - Corte: el mes en curso llega hasta AYER (días cerrados) y el presupuesto se reparte por días hasta ayer.
 * - Días: siempre en hora de Madrid (inicioDiaMadrid) para lo que tiene hora (movimientos de stock).
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import { porcentaje, euros, numero as numeroTexto, fecha as fechaTexto } from "@/kernel/formato";
import { ventasPorCentroYDia } from "@/modulos/caja/servicio";
import { gastosPorCentroYDia, detalleGastosCentro, apuntesContablesCuadro, facturasSinCategoria } from "@/modulos/contabilidad/servicio";
import { costePersonalPorCentroYDia, costeNominasPorCentroYMes } from "@/modulos/personal/servicio";
import { PresupuestoEsquema } from "./esquemas";

export class ErrorCuadro extends Error {}

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function hoyISO(): string {
  return hoyMadrid();
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
const DIA_MS = 86_400_000;

export { inicioDiaMadrid };

/**
 * Hasta dónde llegan las cifras de un mes: los meses pasados, enteros; el mes en curso, hasta AYER incluido
 * (días cerrados: hoy aún no ha terminado); un mes futuro, nada. `hasta` es exclusivo (medianoche UTC de @db.Date).
 * `fraccion` = parte del mes que se compara con el presupuesto («a fecha»).
 */
export function limiteMes(mes: string): { desde: Date; hasta: Date; finMes: Date; fraccion: number; aFecha: boolean } {
  const r = rangoMes(mes);
  const hoy = aFecha(hoyISO());
  const hasta = r.hasta > hoy ? new Date(Math.max(hoy.getTime(), r.desde.getTime())) : r.hasta;
  const fraccion = (hasta.getTime() - r.desde.getTime()) / (r.hasta.getTime() - r.desde.getTime());
  return { desde: r.desde, hasta, finMes: r.hasta, fraccion, aFecha: fraccion < 1 };
}

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
      hay: ctx.tieneModulo("personal") || ctx.tieneModulo("contabilidad"),
      motivo: ctx.tieneModulo("personal")
        ? "Coste empresa de las nóminas del mes si el centro las tiene calculadas; si no, horas fichadas (o del cuadrante) × coste por hora del contrato"
        : ctx.tieneModulo("contabilidad")
          ? "Personal no está contratado: gastos y facturas de categorías de Personal apuntados en Contabilidad"
          : "Ni Personal ni Contabilidad están contratados",
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
  /** Días (centro × día) cuyo personal es el coste empresa de las nóminas (repartido por días). */
  personalNominas: number;
  /** Días (centro × día) cuyo personal son horas × coste/hora. */
  personalHoras: number;
  /** Días (centro × día) cuyo personal sale de Contabilidad (sin Personal contratado). */
  personalContable: number;
  /** Horas de personal (fichadas o del cuadrante), también en los días que manda la nómina. */
  horasPersonal: number;
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

/** De dónde sale el personal de unas cifras (null si no hay coste). */
export function criterioPersonal(c: Cifras): "nominas" | "horas" | "contabilidad" | "mixto" | null {
  const usados = [c.personalNominas > 0, c.personalHoras > 0, c.personalContable > 0].filter(Boolean).length;
  if (usados > 1) return "mixto";
  if (c.personalNominas > 0) return "nominas";
  if (c.personalHoras > 0) return "horas";
  if (c.personalContable > 0) return "contabilidad";
  return null;
}

export const TEXTO_CRITERIO_PERSONAL = {
  nominas: "coste empresa de las nóminas del mes",
  horas: "horas fichadas o del cuadrante × coste por hora (sin nóminas ese mes)",
  contabilidad: "gastos de personal apuntados en Contabilidad",
  mixto: "nóminas donde ya están calculadas y horas × coste por hora en el resto",
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
  personalNominas: 0,
  personalHoras: 0,
  personalContable: 0,
  horasPersonal: 0,
});

const sumar = (a: number | null, b: number) => (a === null ? null : redondear(a + b));

/** Tipos de movimiento que cuentan como mercancía entrada (con su signo). */
const TIPOS_MERCANCIA = ["ENTRADA_COMPRA", "ENTRADA_PEDIDO", "SALIDA_PEDIDO"] as const;

/** Meses «AAAA-MM» que tocan un rango [desde, hasta). */
function mesesDelRango(desde: Date, hasta: Date): string[] {
  const meses: string[] = [];
  for (let m = dia(desde).slice(0, 7); m <= dia(new Date(hasta.getTime() - DIA_MS)).slice(0, 7); m = mesDesplazado(m, 1)) meses.push(m);
  return meses;
}

/** Cifras por centro y día en un rango [desde, hasta) de días. Clave: `${centroId}|${AAAA-MM-DD}`. */
export async function cifrasPorCentroYDia(ctx: Contexto, centroIds: string[], desde: Date, hasta: Date): Promise<Map<string, Cifras>> {
  const f = fuentes(ctx);
  const mapa = new Map<string, Cifras>();
  const de = (centroId: string, fecha: Date) => {
    const k = `${centroId}|${dia(fecha)}`;
    let c = mapa.get(k);
    if (!c) mapa.set(k, (c = vacias(f)));
    return c;
  };
  if (centroIds.length === 0 || hasta <= desde) return mapa;
  const prisma = await db();
  const conPersonal = ctx.tieneModulo("personal");
  const meses = mesesDelRango(desde, hasta);
  const [ventas, movimientos, gastos, horas, nominas, personalContable] = await Promise.all([
    f.ventas.hay ? ventasPorCentroYDia(ctx.tenant.id, centroIds, desde, hasta) : Promise.resolve([]),
    f.mercancia.hay
      ? prisma.movimientoStock.findMany({
          // los movimientos llevan hora: el día se corta a medianoche de Madrid, no a la universal
          where: { tenantId: ctx.tenant.id, centroId: { in: centroIds }, tipo: { in: [...TIPOS_MERCANCIA] }, createdAt: { gte: inicioDiaMadrid(dia(desde)), lt: inicioDiaMadrid(dia(hasta)) } },
          select: { centroId: true, cantidad: true, costeUnitario: true, createdAt: true },
        })
      : Promise.resolve([]),
    f.gastos.hay ? gastosPorCentroYDia(ctx.tenant.id, centroIds, desde, hasta) : Promise.resolve([]),
    // Personal cuenta los días con ambos extremos incluidos: hasta − 1 día
    conPersonal ? costePersonalPorCentroYDia(ctx.tenant.id, centroIds, desde, new Date(hasta.getTime() - DIA_MS)) : Promise.resolve([]),
    conPersonal ? costeNominasPorCentroYMes(ctx.tenant.id, centroIds, meses[0], meses[meses.length - 1]) : Promise.resolve([]),
    !conPersonal && f.personal.hay ? apuntesContablesCuadro(ctx.tenant.id, { centroIds }, desde, hasta, "personal") : Promise.resolve([]),
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
  // Personal: manda la nómina del mes (coste empresa repartido por igual entre los días del mes); sin nómina, horas × coste/hora
  const conNomina = new Map(nominas.filter((n) => n.costeEmpresa !== 0).map((n) => [`${n.centroId}|${n.mes}`, n.costeEmpresa]));
  for (const p of horas) {
    const c = de(p.centroId, aFecha(p.dia));
    c.horasPersonal = redondear(c.horasPersonal + p.horas);
    if (conNomina.has(`${p.centroId}|${p.dia.slice(0, 7)}`)) continue;
    c.personal = sumar(c.personal, p.coste);
    c.personalHoras = 1;
  }
  for (const [k, coste] of conNomina) {
    const [centroId, mes] = k.split("|");
    const r = rangoMes(mes);
    const diasMes = Math.round((r.hasta.getTime() - r.desde.getTime()) / DIA_MS);
    // reparto al céntimo sin perder nada: el día i lleva lo acumulado hasta i+1 menos lo acumulado hasta i
    const acumulado = (n: number) => redondear((coste * n) / diasMes);
    const ini = Math.max(r.desde.getTime(), desde.getTime());
    const fin = Math.min(r.hasta.getTime(), hasta.getTime());
    for (let t = ini; t < fin; t += DIA_MS) {
      const i = Math.round((t - r.desde.getTime()) / DIA_MS);
      const c = de(centroId, new Date(t));
      c.personal = sumar(c.personal, redondear(acumulado(i + 1) - acumulado(i)));
      c.personalNominas = 1;
    }
  }
  for (const a of personalContable) {
    if (!a.centroId) continue;
    const c = de(a.centroId, a.fecha);
    c.personal = sumar(c.personal, a.importe);
    c.personalContable = 1;
  }
  return mapa;
}

function porcentajeTexto(parte: number, total: number): string {
  return total ? porcentaje((parte / total) * 100) : "—";
}

/** Fecha y hora real → día (Madrid) a medianoche UTC. */
function fechaMadrid(d: Date): Date {
  return aFecha(diaMadrid(d));
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
  /** Lo de la sociedad sin centro que lleva esta fila (fila «sin centro» o la sociedad en su vista). */
  sinCentro?: { gastos: number; personal: number };
  /** Fila «sin centro»: de qué sociedad es. */
  sociedadId?: string;
}

export type Vista = "centro" | "marca" | "sociedad";

/**
 * Gastos (y, sin Personal contratado, personal de Contabilidad) de las sociedades que NO están imputados a
 * ningún centro (gestoría, seguros de la sociedad…). No se reparten entre los locales: salen en una fila
 * por sociedad (o dentro de la sociedad en la vista por sociedad) y suman en el total. Solo con «todos mis
 * centros»: con un centro elegido arriba, no entran (igual que en Contabilidad).
 */
async function sinCentroPorSociedad(ctx: Contexto, sociedadIds: string[], desde: Date, hasta: Date) {
  const f = fuentes(ctx);
  const porSociedad = new Map<string, { gastos: number; personal: number }>();
  if (ctx.centroActivo || sociedadIds.length === 0 || hasta <= desde) return porSociedad;
  const [gastos, personal] = await Promise.all([
    f.gastos.hay ? apuntesContablesCuadro(ctx.tenant.id, { sociedadesSinCentro: sociedadIds }, desde, hasta, "gastos") : Promise.resolve([]),
    !ctx.tieneModulo("personal") && f.personal.hay ? apuntesContablesCuadro(ctx.tenant.id, { sociedadesSinCentro: sociedadIds }, desde, hasta, "personal") : Promise.resolve([]),
  ]);
  for (const [lista, campo] of [[gastos, "gastos"], [personal, "personal"]] as const)
    for (const x of lista) {
      const v = porSociedad.get(x.sociedadId) ?? { gastos: 0, personal: 0 };
      v[campo] = redondear(v[campo] + x.importe);
      porSociedad.set(x.sociedadId, v);
    }
  return porSociedad;
}

/** Indicadores del mes por centro, marca o sociedad, con su presupuesto. */
export async function indicadoresMes(ctx: Contexto, mes: string, vista: Vista) {
  const prisma = await db();
  const ids = centrosFiltro(ctx);
  const [a, m] = mes.split("-").map(Number);
  // Mes en curso: las cifras llegan hasta ayer (días cerrados; el cuadrante futuro no es coste todavía)
  // y el presupuesto se reparte por días hasta ayer para comparar «a fecha».
  const lim = limiteMes(mes);
  const [centros, porDia, presupuestos] = await Promise.all([
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: ids } }, include: { marca: true, sociedad: true }, orderBy: [{ tipo: "desc" }, { nombre: "asc" }] }),
    cifrasPorCentroYDia(ctx, ids, lim.desde, lim.hasta),
    prisma.presupuestoCentro.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: ids }, anio: a, mes: m } }),
  ]);
  const f = fuentes(ctx);
  const porCentro = new Map<string, Cifras>(centros.map((c) => [c.id, vacias(f)]));
  for (const [k, v] of porDia) acumular(porCentro.get(k.split("|")[0])!, v);
  const aFechaDe = (v: number | null) => (v === null ? null : redondear(v * lim.fraccion));
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

  // lo de cada sociedad sin centro: fila aparte (o dentro de la sociedad), nunca repartido a ojo entre los locales
  const sociedades = new Map(centros.filter((c) => c.sociedad).map((c) => [c.sociedadId!, c.sociedad!]));
  const sinCentro = await sinCentroPorSociedad(ctx, Array.from(sociedades.keys()), lim.desde, lim.hasta);
  for (const [sociedadId, v] of sinCentro) {
    if (!v.gastos && !v.personal) continue;
    const cifras = vacias(f);
    if (cifras.gastos !== null) cifras.gastos = v.gastos;
    if (cifras.personal !== null && v.personal) {
      cifras.personal = v.personal;
      cifras.personalContable = 1;
    }
    const texto = `${[v.gastos ? `gastos ${euros(v.gastos)}` : "", v.personal ? `personal ${euros(v.personal)}` : ""].filter(Boolean).join(" y ")} de la sociedad sin centro (no se reparten entre los locales)`;
    const g = vista === "sociedad" ? grupos.get(sociedadId) : undefined;
    if (g) {
      acumular(g.cifras, cifras);
      g.detalle = `${g.detalle} · incluye ${texto}`;
      g.sinCentro = v;
    } else
      filas.push({ clave: `sin-centro|${sociedadId}`, nombre: `${sociedades.get(sociedadId)!.razonSocial}: sin centro`, detalle: `Solo ${texto}`, centroIds: [], cifras, presupuesto: null, sinCentro: v, sociedadId });
  }

  const total: FilaCuadro = { clave: "total", nombre: "Total", detalle: `${centros.length} centros`, centroIds: centros.map((c) => c.id), cifras: vacias(f), presupuesto: null };
  for (const g of filas) {
    acumular(total.cifras, g.cifras);
    if (g.presupuesto) total.presupuesto = sumarPresupuesto(total.presupuesto, g.presupuesto);
  }
  return { filas, total, fuentes: f, presupuestoAFecha: lim.aFecha, hastaDia: lim.aFecha ? new Date(lim.hasta.getTime() - DIA_MS) : null };
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

export interface FilaDetalle {
  id: string;
  fecha: Date;
  documento: string;
  concepto: string;
  importe: number;
}

/**
 * De dónde sale cada cifra de un centro en un mes, con el mismo corte que el cuadro (el mes en curso, hasta ayer):
 * la suma de las filas es la cifra del cuadro. `avisos`: lo que no suma y conviene revisar.
 */
export async function detalleIndicador(ctx: Contexto, indicador: Indicador, centroId: string, mes: string): Promise<{ centro: Awaited<ReturnType<typeof centroPermitido>>; filas: FilaDetalle[] | null; motivo: string; avisos?: string[]; hastaDia: Date | null }> {
  const centro = await centroPermitido(ctx, centroId);
  const f = fuentes(ctx);
  const lim = limiteMes(mes);
  const r = { desde: lim.desde, hasta: lim.hasta };
  const hastaDia = lim.aFecha ? new Date(lim.hasta.getTime() - DIA_MS) : null;
  const prisma = await db();
  if (indicador === "ventas") {
    if (!f.ventas.hay) return { centro, filas: null, motivo: f.ventas.motivo, hastaDia };
    const v = await ventasPorCentroYDia(ctx.tenant.id, [centroId], r.desde, r.hasta);
    return { centro, motivo: f.ventas.motivo, hastaDia, filas: v.map((x) => ({ id: dia(x.fecha), fecha: x.fecha, documento: "Jornada", concepto: `${x.comensales} comensales · ${x.tickets} tickets`, importe: x.ventaNeta })) };
  }
  if (indicador === "mercancia") {
    if (!f.mercancia.hay) return { centro, filas: null, motivo: f.mercancia.motivo, hastaDia };
    // con tickets: coste teórico de lo vendido de cada día (y compras solo antes del primer día con tickets)
    const ventas = f.ventas.hay ? await ventasPorCentroYDia(ctx.tenant.id, [centroId], r.desde, r.hasta) : [];
    const teoricos = ventas.filter((v) => v.costeTeorico !== null);
    const primerTeorico = teoricos.length ? teoricos[0].fecha : null;
    const filasTeoricas = teoricos.map((v) => ({ id: `teorico|${dia(v.fecha)}`, fecha: v.fecha, documento: "Tickets", concepto: `Coste teórico de lo vendido (${porcentajeTexto(v.costeTeorico!, v.ventaNeta)} de ${euros(v.ventaNeta)} de venta)`, importe: v.costeTeorico! }));
    const movs = r.hasta > r.desde
      ? await prisma.movimientoStock.findMany({
          // mismo corte de día que el cuadro: medianoche de Madrid
          where: { tenantId: ctx.tenant.id, centroId, tipo: { in: [...TIPOS_MERCANCIA] }, createdAt: { gte: inicioDiaMadrid(dia(r.desde)), lt: inicioDiaMadrid(dia(primerTeorico ?? r.hasta)) } },
          select: { tipo: true, documento: true, cantidad: true, costeUnitario: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    // agrupar por documento (pedido de compra, albarán…)
    const docs = new Map<string, { fecha: Date; tipo: string; importe: number; lineas: number }>();
    for (const m of movs) {
      const k = `${m.tipo}|${m.documento ?? "sin documento"}`;
      const d = docs.get(k) ?? { fecha: fechaMadrid(m.createdAt), tipo: m.tipo, importe: 0, lineas: 0 };
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
      hastaDia,
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
    if (!f.gastos.hay) return { centro, filas: null, motivo: f.gastos.motivo, hastaDia };
    const [g, sinCategoria] = await Promise.all([detalleGastosCentro(ctx.tenant.id, centroId, r.desde, r.hasta), facturasSinCategoria(ctx.tenant.id, [centroId], r.desde, r.hasta)]);
    const avisos = sinCategoria.length
      ? [`${sinCategoria.length} ${sinCategoria.length === 1 ? "factura" : "facturas"} sin categoría no suman en ninguna cifra (${sinCategoria.slice(0, 5).map((x) => `${x.numero} · ${x.proveedorNombre}`).join(", ")}${sinCategoria.length > 5 ? "…" : ""}). Ponles categoría en Contabilidad (hoy: anular y registrar de nuevo).`]
      : [];
    return { centro, motivo: f.gastos.motivo, hastaDia, avisos, filas: g.map((x) => ({ id: x.id, fecha: x.fecha, documento: x.documento, concepto: `${x.concepto} · ${x.categoria}`, importe: x.importe })) };
  }
  // personal: misma regla que el cuadro (manda la nómina del mes; si no, horas × coste/hora)
  if (!f.personal.hay) return { centro, filas: null, motivo: f.personal.motivo, hastaDia };
  if (!ctx.tieneModulo("personal")) {
    const ap = await apuntesContablesCuadro(ctx.tenant.id, { centroIds: [centroId] }, r.desde, r.hasta, "personal");
    return { centro, motivo: f.personal.motivo, hastaDia, filas: ap.map((x) => ({ id: x.id, fecha: x.fecha, documento: x.documento, concepto: `${x.concepto} · ${x.categoria}`, importe: x.importe })) };
  }
  const [nominas, horas] = await Promise.all([
    costeNominasPorCentroYMes(ctx.tenant.id, [centroId], mes, mes),
    r.hasta > r.desde ? costePersonalPorCentroYDia(ctx.tenant.id, [centroId], r.desde, new Date(r.hasta.getTime() - DIA_MS)) : Promise.resolve([]),
  ]);
  const nomina = nominas.find((n) => n.costeEmpresa !== 0);
  const horasMes = redondear(horas.reduce((s, h) => s + h.horas, 0));
  if (nomina) {
    const importe = redondear(nomina.costeEmpresa * lim.fraccion);
    const parte = lim.aFecha ? ` × ${porcentaje(lim.fraccion * 100)} del mes (hasta ayer) = ${euros(importe)}` : "";
    return {
      centro,
      hastaDia,
      motivo: `Coste empresa de las nóminas de ${nombreMes(mes).toLowerCase()} (bruto + Seguridad Social de la empresa), repartido por igual entre los días del mes. Las horas de este mes no suman: ya están pagadas en la nómina`,
      avisos: nomina.borradores ? [`${nomina.borradores} de ${nomina.empleados} nóminas están en borrador: el coste puede cambiar al cerrarlas en Personal → Nóminas.`] : [],
      filas: [
        {
          id: `nominas|${mes}`,
          fecha: lim.desde,
          documento: "Nóminas",
          concepto: `${nomina.empleados} nóminas · bruto ${euros(nomina.devengado)} + SS empresa ${euros(nomina.ssEmpresa)} → coste empresa ${euros(nomina.costeEmpresa)}${parte} · ${numeroTexto(horasMes)} h trabajadas`,
          importe,
        },
      ],
    };
  }
  return {
    centro,
    hastaDia,
    motivo: "Sin nóminas calculadas este mes: horas fichadas (o del cuadrante si no hay fichaje) × coste por hora del contrato en vigor ese día. Cuando se calculen las nóminas, mandará su coste empresa",
    filas: horas.map((h) => ({ id: `horas|${h.dia}`, fecha: aFecha(h.dia), documento: "Horas", concepto: `${numeroTexto(h.horas)} h × coste/hora (media ${h.horas ? euros(h.coste / h.horas) : "—"} por hora)`, importe: h.coste })),
  };
}

// ---------- indicadores diarios guardados (kpi_daily) ----------

/**
 * Recalcula y guarda los indicadores de cada centro y día del mes (lo que haya en las fuentes ahora mismo),
 * con el mismo corte que el cuadro (el mes en curso, hasta ayer). Los días guardados que ya no tienen datos
 * (por ejemplo, una jornada anulada) se borran, para que la foto no enseñe cifras viejas. Queda en el historial.
 */
export async function recalcularIndicadoresMes(ctx: Contexto, mes: string): Promise<{ guardados: number; borrados: number }> {
  const ids = centrosFiltro(ctx);
  const lim = limiteMes(mes);
  const porDia = await cifrasPorCentroYDia(ctx, ids, lim.desde, lim.hasta);
  const prisma = await db();
  const calculadoEn = new Date();
  return prisma.$transaction(
    async (tx) => {
      let guardados = 0;
      for (const [k, c] of porDia) {
        const [centroId, fechaISO] = k.split("|");
        const fecha = aFecha(fechaISO);
        const datos = { ventas: c.ventas, comensales: c.comensales, tickets: c.tickets, mercancia: c.mercancia, gastos: c.gastos, personal: c.personal, calculadoEn };
        await tx.indicadorDiario.upsert({
          where: { tenantId_centroId_fecha: { tenantId: ctx.tenant.id, centroId, fecha } },
          create: { tenantId: ctx.tenant.id, centroId, fecha, ...datos },
          update: datos,
        });
        guardados++;
      }
      // todo lo del mes (de estos centros) que no se acaba de calcular: días sin datos o posteriores a ayer
      const { count: borrados } = await tx.indicadorDiario.deleteMany({
        where: { tenantId: ctx.tenant.id, centroId: { in: ids }, fecha: { gte: lim.desde, lt: lim.finMes }, calculadoEn: { not: calculadoEn } },
      });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "IndicadorDiario", entidadId: mes, accion: "recalcular", despues: { mes, centros: ids.length, guardados, borrados } });
      return { guardados, borrados };
    },
    { timeout: 60_000 },
  );
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
