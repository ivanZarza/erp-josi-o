/**
 * Parte «caja» del local Raza Pruebas (RZ-PRU): ventas, cierres de caja y cuadro de mando.
 *
 * 1. Ventas de las 8 semanas hasta ayer (JornadaVenta + JornadaVentaPago), mesa a mesa y sumadas por día:
 *    - una mesa = cada reserva TERMINADA o SENTADA del día (las «sin reserva» ya vienen de Reservas);
 *    - la cuenta de la mesa es el importe de la visita de Clientes cuando existe (para que Caja y Clientes
 *      cuadren); los eventos cobran el presupuesto aceptado; el resto se calcula con la carta real
 *      (pan y aperitivo, entrantes, cortes, guarniciones, postres, vino por botella, agua, cafés y copas);
 *    - IVA de venta 10 %; formas de cobro: tarjeta, efectivo, Bizum, tarjetas regalo canjeadas ese día
 *      (VALE, sacadas de Clientes) y a cuenta de empresa (CREDITO) para un evento con factura;
 *    - descuentos, invitaciones y anulaciones de cada día.
 *    El esquema solo guarda totales por jornada: la mezcla de platos se simula para que los totales sean
 *    creíbles y se resume en las notas de la jornada (ver docs/pruebas/huecos-caja.md).
 *    NO se descuenta stock: el consumo diario ya lo simularon las partes de cocina y bebidas.
 * 2. Cierres de caja de cada día hasta ayer (hoy queda abierto, sin cierre): arqueo con fondo de 300 €,
 *    descuadres pequeños con su motivo, uno grande sin explicar (rechazado por finanzas) y uno de tarjeta
 *    cobrada como efectivo; los últimos días, pendientes de validar y sin liquidación del banco.
 * 3. Cuadro de mando: presupuesto de septiembre a diciembre (personal según las nóminas reales) e
 *    indicadores diarios guardados (IndicadorDiario) calculados como lo hace el módulo.
 *
 * Datos inventados salvo la carta. Si se ejecuta dos veces no duplica (cada bloque mira si ya está).
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "../../../src/generated/prisma/client";
import { calcularJornadas } from "../../../src/modulos/personal/jornadas";
import { horasTurno } from "../../../src/modulos/personal/fechas";
import type { ContextoPruebas } from "./contexto";

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

const DIA_MS = 86_400_000;
const SEMANAS = 8;
const FONDO_CAJA = 300;
/** Igual que SEMANAS_EFECTIVAS de src/modulos/personal/servicio.ts (no se puede importar: es de servidor). */
const SEMANAS_EFECTIVAS = 52 - 30 / 7;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Generador pseudoaleatorio con semilla (mismos datos en cada carga). */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fechaMadrid(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const aFecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const masDias = (dia: string, n: number) => iso(new Date(aFecha(dia).getTime() + n * DIA_MS));
/** Hora de Madrid aproximada (UTC+1 en invierno, UTC+2 hasta el 25/10/2026). */
function enMadrid(dia: string, hh: number, mm = 0): Date {
  const desfase = dia < "2026-10-25" ? 2 : 1;
  return new Date(aFecha(dia).getTime() + (hh - desfase) * 3_600_000 + mm * 60_000);
}

// ---------------------------------------------------------------------------------------------
// Carta: qué se pide (pesos por plato, según lo que más se vende en una parrilla de carne madurada)
// ---------------------------------------------------------------------------------------------

interface PlatoVenta {
  nombre: string;
  seccion: string;
  precio: number;
}

/** Grupos de venta por sección de la carta (orden de la sección en «Carta Raza Pruebas»). */
type Grupo = "pan" | "entrante" | "corte" | "principal" | "guarnicion" | "postre" | "vino" | "generoso" | "agua" | "cerveza" | "vermut" | "copa" | "cafe" | "dulce";

function grupoDe(seccion: string): Grupo | null {
  const s = seccion.toLowerCase();
  if (s === "servicio") return "pan";
  if (s.startsWith("de la huerta") || s.startsWith("entrantes")) return "entrante";
  if (s.startsWith("raza selección")) return "corte";
  if (s === "pastas" || s === "pescados" || s === "otras especialidades") return "principal";
  if (s === "guarniciones") return "guarnicion";
  if (s === "postres") return "postre";
  if (s.startsWith("generosos")) return "generoso";
  if (s.startsWith("vinos dulces")) return "dulce";
  if (s.startsWith("aguas")) return "agua";
  if (s === "cervezas") return "cerveza";
  if (s === "vermut") return "vermut";
  if (s.startsWith("copas")) return "copa";
  if (s.startsWith("cafés")) return "cafe";
  if (/^(blancos|tintos|rosados|espumosos|formato|proyecto)/.test(s)) return "vino";
  return null;
}

/** Peso de cada plato dentro de su grupo (1 = normal). Los cortes y los entrantes clásicos venden más. */
const PESO_PLATO: [RegExp, number][] = [
  [/^Entraña/, 9], [/^Bife de chorizo/, 8], [/^Lomo bajo/, 7], [/^Solomillo de vaca/, 7], [/^Ojo de bife/, 6], [/^Lomo alto \(350/, 6],
  [/^Chuletón/, 5], [/^Cube roll/, 4], [/^T-bone/, 3], [/^Solomillo con su costilla/, 3], [/^Lomo alto \(700/, 2], [/^Lomo alto de Nebraska/, 2],
  [/^Empanada/, 10], [/^Croquetas/, 6], [/^Mini steak tartar/, 7], [/^Mini hamburguesas/, 6], [/^Burrata/, 5], [/^Jamón/, 4], [/^Steak tartar/, 4],
  [/^Mollejas/, 4], [/^Matrimonio/, 4], [/^Provoleta/, 5], [/^Nuestra gilda/, 4], [/^Pulpo/, 4], [/^Tataki/, 3], [/^Alcachofas/, 3],
  [/^Patatas fritas corte/, 10], [/^Patatas fritas aliñadas/, 7], [/^Patata asada/, 5], [/^Puré/, 5],
  [/^Tarta de queso y dulce/, 8], [/^Tiramisú/, 6], [/^Tarta de chocolate/, 5], [/^Tarta de queso y pistacho/, 5],
  [/^Agua Solán de Cabras 1 l/, 10], [/^Agua Solán de Cabras 33/, 4], [/^Coca-Cola/, 4], [/^Caña Mahou Cinco/, 8], [/^Doble Mahou/, 3],
  [/^Café solo/, 6], [/^Cortado/, 5], [/^Café con leche$/, 4], [/^Descafeinado/, 3], [/^Gin tonic Tanqueray/, 4], [/^Gin tonic Hendrick/, 3],
];

/** Peso de cada sección de vinos (Ribera y Rioja de crianza son los que más salen). */
const PESO_VINO: [RegExp, number][] = [
  [/^Tintos Ribera del Duero · Crianza/, 30], [/^Tintos Rioja · Crianza/, 25], [/^Tintos de la tierra/, 10], [/^Blancos · Rueda/, 7], [/^Blancos · Rías/, 5],
  [/^Blancos · Otras/, 2], [/^Blancos · De Castilla/, 1.5], [/^Tintos Ribera del Duero · Reservas/, 5], [/^Tintos Rioja · Grandes/, 3], [/^Tintos Toro/, 3],
  [/^Rosados/, 1.5], [/^Espumosos · Corpinnat/, 1.5], [/^Espumosos · A.O.C./, 1], [/^Tintos internacionales/, 1], [/^Formato magnum/, 0.8], [/^Proyecto 100/, 0.05],
];

function pesoPlato(p: PlatoVenta, grupo: Grupo): number {
  if (grupo === "vino") {
    const sec = PESO_VINO.find(([re]) => re.test(p.seccion))?.[1] ?? 0.5;
    // dentro de la sección se piden más los de precio bajo y medio
    return sec * Math.pow(30 / Math.max(28, p.precio), 1.6);
  }
  return PESO_PLATO.find(([re]) => re.test(p.nombre))?.[1] ?? 2;
}

/** Elegidor ponderado de un grupo. */
function elegidor(platos: { p: PlatoVenta; w: number }[]) {
  const total = platos.reduce((s, x) => s + x.w, 0);
  return (r: number): PlatoVenta => {
    let x = r * total;
    for (const it of platos) {
      x -= it.w;
      if (x <= 0) return it.p;
    }
    return platos[platos.length - 1].p;
  };
}

// ---------------------------------------------------------------------------------------------
// Semilla
// ---------------------------------------------------------------------------------------------

type Forma = "EFECTIVO" | "TARJETA" | "BIZUM" | "VALE" | "CREDITO";

interface Mesa {
  reservaId: string;
  personas: number;
  comida: boolean;
  cuenta: number; // cobrado, con IVA
  formas: Partial<Record<Forma, number>>;
}

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const centroId = ctx.centroPruebas;
  const hoy = fechaMadrid(ctx.hoy);
  const ayer = masDias(hoy, -1);
  const primerDia = masDias(hoy, -SEMANAS * 7);
  const azar = aleatorio(20261114 + 7);

  const [gerente, admin] = await Promise.all([
    prisma.usuario.findFirst({ where: { tenantId: t, email: "gerente.pruebas@erp.local" }, select: { id: true } }),
    prisma.usuario.findFirst({ where: { tenantId: t, rol: "admin", email: "admin@erp.local" }, select: { id: true } }),
  ]);

  // ---------------- 1. Ventas ----------------
  const yaVentas = await prisma.jornadaVenta.count({ where: { tenantId: t, centroId } });
  if (yaVentas === 0) {
    // Carta del local
    const carta = await prisma.carta.findFirst({
      where: { tenantId: t, nombre: "Carta Raza Pruebas" },
      include: { secciones: { include: { lineas: { include: { plato: { include: { precios: { where: { centroId } } } } } } } } },
    });
    if (!carta) throw new Error("Falta la «Carta Raza Pruebas»: carga antes las partes cocina y bebidas");
    const porGrupo = new Map<Grupo, { p: PlatoVenta; w: number }[]>();
    for (const s of carta.secciones) {
      const g = grupoDe(s.nombre);
      if (!g) continue;
      for (const l of s.lineas) {
        const local = l.plato.precios[0];
        if (local && !local.disponible) continue;
        const p: PlatoVenta = { nombre: l.plato.nombre, seccion: s.nombre, precio: Number(local?.precio ?? l.plato.precio) };
        if (!p.precio) continue;
        porGrupo.set(g, [...(porGrupo.get(g) ?? []), { p, w: pesoPlato(p, g) }]);
      }
    }
    const elegir = new Map<Grupo, (r: number) => PlatoVenta>([...porGrupo].map(([g, l]) => [g, elegidor(l)]));
    const pan = porGrupo.get("pan")?.[0]?.p;

    /** Simula lo que pide una mesa: devuelve el total con IVA y suma la mezcla del día. */
    const simularMesa = (personas: number, comida: boolean, mezcla: Map<string, number>, r: () => number): number => {
      let total = 0;
      const pedir = (g: Grupo, n: number) => {
        const e = elegir.get(g);
        for (let i = 0; i < n && e; i++) {
          const p = e(r());
          total += p.precio;
          const clave = `${g}|${g === "vino" ? p.seccion : p.nombre}`;
          mezcla.set(clave, (mezcla.get(clave) ?? 0) + 1);
        }
      };
      if (pan) {
        total += pan.precio * personas;
        mezcla.set("pan|Pan y aperitivo", (mezcla.get("pan|Pan y aperitivo") ?? 0) + personas);
      }
      const n = (base: number, margen: number) => Math.max(0, Math.round(personas * (base + (r() - 0.5) * margen)));
      pedir("entrante", Math.max(1, n(0.8, 0.4)));
      // principales: casi todo cortes; los de 1 kg (chuletón, T-bone, lomo alto 700 g) son para dos
      let principales = Math.max(1, n(0.85, 0.2));
      while (principales > 0) {
        const g: Grupo = r() < 0.84 ? "corte" : "principal";
        const p = elegir.get(g)!(r());
        total += p.precio;
        mezcla.set(`${g}|${p.nombre}`, (mezcla.get(`${g}|${p.nombre}`) ?? 0) + 1);
        principales -= /1 kg|700 g/.test(p.nombre) && personas > 1 ? 2 : 1;
      }
      pedir("guarnicion", n(0.5, 0.3));
      pedir("postre", n(comida ? 0.6 : 0.5, 0.3));
      // vino por botella (no hay tintos por copa en la carta); mesas de 1 o 2 a mediodía, a veces cerveza
      const sinVino = personas <= 2 && r() < (comida ? 0.45 : 0.2);
      if (!sinVino) pedir("vino", Math.max(1, Math.round(personas / (comida ? 3.4 + r() : 2.2 + r() * 0.8))));
      else pedir(r() < 0.5 ? "cerveza" : "generoso", personas);
      pedir("agua", Math.max(1, n(0.45, 0.3)));
      pedir("cerveza", n(comida ? 0.25 : 0.15, 0.2));
      if (comida) pedir("vermut", n(0.08, 0.1));
      pedir("cafe", n(comida ? 0.7 : 0.45, 0.3));
      if (!comida) pedir("copa", n(0.18, 0.2));
      if (r() < 0.06) pedir("dulce", 1);
      return r2(total);
    };

    // Reservas sentadas o terminadas de las 8 semanas (incluyen las «sin reserva» y los eventos)
    const reservas = await prisma.reserva.findMany({
      where: { tenantId: t, centroId, fecha: { gte: aFecha(primerDia), lte: aFecha(ayer) }, estado: { in: ["SENTADA", "TERMINADA"] } },
      select: { id: true, fecha: true, hora: true, personas: true, solicitudEventoId: true, notas: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });
    const visitas = await prisma.clienteVisita.findMany({
      where: { tenantId: t, reservaId: { in: reservas.map((r) => r.id) }, importe: { not: null } },
      select: { reservaId: true, importe: true },
    });
    const importeVisita = new Map(visitas.map((v) => [v.reservaId!, Number(v.importe)]));
    // Eventos: lo cobrado es el presupuesto aceptado; los de empresa van a cuenta (factura)
    const idsEvento = reservas.map((r) => r.solicitudEventoId).filter((x): x is string => !!x);
    const eventos = await prisma.eventoSolicitud.findMany({ where: { id: { in: idsEvento } }, include: { presupuestos: { where: { estado: "ACEPTADO" } } } });
    const evento = new Map(eventos.map((e) => [e.id, { total: e.presupuestos[0] ? Number(e.presupuestos[0].total) : null, empresa: !!e.empresa }]));
    // Tarjetas regalo canjeadas en el local cada día (se cobran como VALE)
    const canjes = await prisma.tarjetaRegaloMovimiento.findMany({
      where: { tipo: "CANJE", centroId, tarjeta: { tenantId: t }, createdAt: { gte: enMadrid(primerDia, 5), lt: enMadrid(hoy, 5) } },
      select: { importe: true, createdAt: true },
    });
    const valePorDia = new Map<string, number>();
    for (const c of canjes) {
      const dia = fechaMadrid(new Date(c.createdAt.getTime() - 5 * 3_600_000)); // jornada con corte a las 05:00
      valePorDia.set(dia, r2((valePorDia.get(dia) ?? 0) - Number(c.importe)));
    }

    const porDia = new Map<string, typeof reservas>();
    for (const r of reservas) porDia.set(iso(r.fecha), [...(porDia.get(iso(r.fecha)) ?? []), r]);

    const jornadas: Prisma.JornadaVentaCreateManyInput[] = [];
    const pagos: Prisma.JornadaVentaPagoCreateManyInput[] = [];
    const mezclaTotal = new Map<string, number>();

    for (let d = SEMANAS * 7; d >= 1; d--) {
      const dia = masDias(hoy, -d);
      const delDia = porDia.get(dia) ?? [];
      if (delDia.length === 0) continue; // día cerrado (no ocurre en estas 8 semanas)
      const r = aleatorio(Number(dia.replaceAll("-", "")));
      const mezcla = new Map<string, number>();
      const mesas: Mesa[] = [];
      let descuentos = 0;
      for (const res of delDia) {
        const comida = res.hora < "17:00";
        const simulado = simularMesa(res.personas, comida, mezcla, r);
        const ev = res.solicitudEventoId ? evento.get(res.solicitudEventoId) : undefined;
        let cuenta = ev?.total ?? importeVisita.get(res.id) ?? simulado;
        // descuento a algunas mesas (cliente habitual, compensación por una espera): la cuenta ya va descontada
        if (!ev && r() < 0.025) {
          const pct = r() < 0.6 ? 0.1 : 0.15;
          descuentos += cuenta * pct / (1 - pct);
        }
        cuenta = r2(cuenta);
        const formas: Mesa["formas"] = {};
        if (ev?.empresa) formas.CREDITO = cuenta;
        else {
          const x = r();
          const efectivo = res.personas <= 2 ? 0.17 : 0.1;
          formas[x < efectivo ? "EFECTIVO" : x < efectivo + 0.05 ? "BIZUM" : "TARJETA"] = cuenta;
        }
        mesas.push({ reservaId: res.id, personas: res.personas, comida, cuenta, formas });
      }
      // canjes de tarjeta regalo del día: se descuentan de lo cobrado con tarjeta en las mesas de mayor cuenta
      let vale = valePorDia.get(dia) ?? 0;
      if (vale > 0) {
        for (const m of [...mesas].sort((a, b) => b.cuenta - a.cuenta)) {
          if (vale <= 0) break;
          const tarjeta = m.formas.TARJETA ?? 0;
          const usa = r2(Math.min(vale, tarjeta));
          if (usa <= 0) continue;
          m.formas.TARJETA = r2(tarjeta - usa);
          m.formas.VALE = r2((m.formas.VALE ?? 0) + usa);
          vale = r2(vale - usa);
        }
      }
      for (const [k, v] of mezcla) mezclaTotal.set(k, (mezclaTotal.get(k) ?? 0) + v);

      const conIva = r2(mesas.reduce((s, m) => s + m.cuenta, 0));
      const comidaConIva = r2(mesas.filter((m) => m.comida).reduce((s, m) => s + m.cuenta, 0));
      const ventaNeta = r2(conIva / 1.1);
      const ventaComida = r2(comidaConIva / 1.1);
      const comensales = mesas.reduce((s, m) => s + m.personas, 0);
      // tickets: una cuenta por mesa; alguna mesa grande pide la cuenta por separado
      const tickets = mesas.length + mesas.filter((m) => m.personas >= 6 && r() < 0.3).length;
      // invitaciones (chupitos, postres, una botella por una espera) a precio de venta sin IVA
      const invitaciones = r2((comensales * (0.15 + r() * 0.35)) + (r() < 0.12 ? 30 + r() * 40 : 0));
      // anulaciones: líneas borradas antes de cobrar (error de comanda, plato devuelto)
      const nAnul = r() < 0.55 ? 1 + Math.floor(r() * 3) : 0;
      let anulaciones = 0;
      for (let i = 0; i < nAnul; i++) anulaciones += 6 + r() * 34;
      if (d === 17) anulaciones += 186.36; // una mesa entera anulada y vuelta a abrir: aparece en el cierre (ver cierres)

      const id = randomUUID();
      const sumaForma = (f: Forma) => r2(mesas.reduce((s, m) => s + (m.formas[f] ?? 0), 0));
      const formas: Forma[] = ["TARJETA", "EFECTIVO", "BIZUM", "VALE", "CREDITO"];
      const importes = Object.fromEntries(formas.map((f) => [f, sumaForma(f)])) as Record<Forma, number>;
      // el redondeo de las mesas se lo queda la tarjeta para que lo cobrado cuadre al céntimo con la venta
      importes.TARJETA = r2(importes.TARJETA + conIva - formas.reduce((s, f) => s + importes[f], 0));
      for (const f of formas) if (importes[f] > 0) pagos.push({ id: randomUUID(), jornadaId: id, forma: f, importe: importes[f] });

      const top = (g: string, n: number) =>
        [...mezcla].filter(([k]) => k.startsWith(`${g}|`)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k.split("|")[1]} ${v}`).join(", ");
      const botellas = [...mezcla].filter(([k]) => k.startsWith("vino|")).reduce((s, [, v]) => s + v, 0);
      const cortes = [...mezcla].filter(([k]) => k.startsWith("corte|")).reduce((s, [, v]) => s + v, 0);
      const ev = delDia.filter((x) => x.solicitudEventoId).map((x) => x.notas?.split(" · ")[0]).join(", ");
      jornadas.push({
        id, tenantId: t, centroId, fecha: aFecha(dia), ventaNeta, cuotaIva: r2(conIva - ventaNeta),
        ventaComida, ventaCena: r2(ventaNeta - ventaComida), comensales, tickets,
        descuentos: r2(descuentos / 1.1), invitaciones, anulaciones: r2(anulaciones), origen: "MANUAL",
        notas:
          `Metida a mano desde el cierre Z del TPV (sin conectar). ${mesas.length} mesas.` +
          (ev ? ` Evento: ${ev}.` : "") +
          ` Mezcla estimada: ${cortes} cortes (${top("corte", 3)}); ${botellas} botellas de vino (${top("vino", 2).replace(/Tintos /g, "")}).`,
        creadoPor: gerente?.id ?? null, createdAt: enMadrid(masDias(dia, 1), 11, 30), updatedAt: enMadrid(masDias(dia, 1), 11, 30),
      });
    }
    for (let i = 0; i < jornadas.length; i += 200) await prisma.jornadaVenta.createMany({ data: jornadas.slice(i, i + 200) });
    for (let i = 0; i < pagos.length; i += 500) await prisma.jornadaVentaPago.createMany({ data: pagos.slice(i, i + 500) });

    // resumen de la mezcla de las 8 semanas (para la documentación de huecos)
    const lista = (g: string, n: number) => [...mezclaTotal].filter(([k]) => k.startsWith(`${g}|`)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k.split("|")[1]} ${v}`).join("; ");
    console.log(`  caja: ${jornadas.length} jornadas, ${pagos.length} cobros. Cortes más vendidos: ${lista("corte", 5)}. Vinos por sección: ${lista("vino", 4)}`);
  }

  // ---------------- 2. Cierres de caja ----------------
  const yaCierres = await prisma.cierreCaja.count({ where: { tenantId: t, centroId } });
  if (yaCierres === 0) {
    const jornadas = await prisma.jornadaVenta.findMany({
      where: { tenantId: t, centroId, fecha: { gte: aFecha(primerDia), lte: aFecha(ayer) } },
      include: { pagos: true },
      orderBy: { fecha: "asc" },
    });
    // descuadres por días atrás: [efectivo, tarjeta, motivo]. El resto, a cero.
    const DESCUADRES: Record<number, [number, number, string | null]> = {
      52: [-4.5, 0, "Cambio mal dado en la mesa 14 (lo reconoce el camarero)"],
      47: [10, 0, "Propina en efectivo metida en el cajón por error"],
      41: [-20, 0, "Billete de 20 € de más en un cambio de la terraza"],
      37: [-0.8, 0, "Monedas: redondeos de cambio"],
      33: [-12, 0, "Pago en efectivo al repartidor de hielo sin ticket (se pide el justificante)"],
      27: [-62.4, 62.4, "Mesa 9 cobrada con tarjeta y marcada como efectivo en el TPV"],
      23: [5, 0, "Propina en efectivo sin apartar"],
      17: [-250, 0, "Sin explicar: recontado dos veces por el encargado y la gerente, no aparece"],
      12: [-2.3, 0, "Monedas: redondeos de cambio"],
      9: [0, -18.9, "Una devolución en el datáfono (plato devuelto) no está en el TPV"],
      5: [15, 0, "Propina en efectivo sin apartar"],
      2: [-7.6, 0, "Cambio mal dado en la barra"],
    };
    const cierres: Prisma.CierreCajaCreateManyInput[] = [];
    for (const j of jornadas) {
      const dia = iso(j.fecha);
      const atras = Math.round((aFecha(hoy).getTime() - j.fecha.getTime()) / DIA_MS);
      const efectivo = Number(j.pagos.find((p) => p.forma === "EFECTIVO")?.importe ?? 0);
      const tarjeta = Number(j.pagos.find((p) => p.forma === "TARJETA")?.importe ?? 0);
      const [desc, descTarjeta, motivo] = DESCUADRES[atras] ?? [0, 0, null];
      const rechazado = atras === 17;
      const pendiente = atras <= 3;
      const cerrado = enMadrid(masDias(dia, 1), 0, 40 + Math.floor(azar() * 30));
      cierres.push({
        id: randomUUID(), tenantId: t, centroId, fecha: j.fecha,
        efectivoTeorico: efectivo, efectivoContado: r2(efectivo + desc), descuadre: desc,
        tarjetaTeorico: tarjeta,
        // el banco liquida la tarjeta a los 2 días: los cierres de ayer y anteayer aún no lo tienen
        tarjetaBanco: atras <= 2 ? null : r2(tarjeta + descTarjeta),
        fondoCaja: FONDO_CAJA, motivo,
        estado: rechazado ? "RECHAZADO" : pendiente ? "PENDIENTE" : "VALIDADO",
        cerradoPor: gerente?.id ?? null,
        validadoPor: pendiente ? null : admin?.id ?? null,
        validadoEn: pendiente ? null : enMadrid(masDias(dia, rechazado ? 2 : 3), 10, 15),
        comentarioValidacion: rechazado
          ? "Descuadre de 250 € sin causa. Revisar los tickets anulados de esa noche (hay una mesa entera anulada) y las cámaras del cajón; rehacer el arqueo con la explicación."
          : atras === 27 ? "Ok: el descuadre de efectivo y el de tarjeta se compensan." : null,
        createdAt: cerrado, updatedAt: cerrado,
      });
    }
    await prisma.cierreCaja.createMany({ data: cierres });
    console.log(`  caja: ${cierres.length} cierres (hoy, ${hoy}, queda abierto)`);
  }

  // ---------------- 3. Cuadro de mando: presupuestos ----------------
  // Personal: coste empresa de las nóminas reales del mes anterior (o del mismo mes, si es el primero)
  const nominas = await prisma.nomina.groupBy({ by: ["periodo"], where: { tenantId: t, centroId }, _sum: { costeEmpresa: true } });
  const costeNominas = new Map(nominas.map((n) => [n.periodo, Number(n._sum.costeEmpresa ?? 0)]));
  const personalDe = (mes: string, anterior: string) => {
    // el último mes con nóminas hasta el anterior; si no hay, el propio mes (primer mes del local)
    const ref = [...costeNominas.keys()].filter((p) => p <= anterior).sort().pop() ?? (costeNominas.has(mes) ? mes : undefined);
    const base = ref ? costeNominas.get(ref)! : 0;
    return ref ? { valor: Math.round(base / 100) * 100, nota: `personal = nóminas de ${ref} (${Math.round(base)} € de coste empresa)` } : null;
  };
  // [año, mes, ventas sin IVA, % mercancía, gastos, nota]
  const PRESUPUESTOS: [number, number, number, number, number, string][] = [
    [2026, 9, 110000, 0.31, 31000, "Apertura el 19/09: 12 días de venta; plantilla completa todo el mes por la formación previa"],
    [2026, 10, 290000, 0.3, 42000, "Primer mes completo"],
    [2026, 11, 280000, 0.3, 42000, "Noviembre flojo entre semana; empiezan las cenas de empresa a final de mes"],
    [2026, 12, 345000, 0.3, 46000, "Navidad: menús de grupo y cenas de empresa"],
  ];
  const presupuestos: Prisma.PresupuestoCentroCreateManyInput[] = PRESUPUESTOS.map(([anio, mes, ventas, pctMerc, gastos, nota]) => {
    const m = `${anio}-${String(mes).padStart(2, "0")}`;
    const ant = `${mes === 1 ? anio - 1 : anio}-${String(mes === 1 ? 12 : mes - 1).padStart(2, "0")}`;
    const p = personalDe(m, ant);
    return {
      tenantId: t, centroId, anio, mes, ventas, mercancia: r2(ventas * pctMerc), personal: p?.valor ?? null, gastos,
      notas: `${nota}. Mercancía ${Math.round(pctMerc * 100)} % de las ventas; ${p?.nota ?? "personal sin nóminas de referencia"}; gastos: alquiler, suministros, mantenimiento y comisiones.`,
      editadoPor: admin?.id ?? null,
    };
  });
  await prisma.presupuestoCentro.createMany({ data: presupuestos, skipDuplicates: true });

  // ---------------- 4. Cuadro de mando: indicadores diarios guardados ----------------
  // Lo mismo que «Recalcular el mes» de /cuadro/diario (src/modulos/cuadro/servicio.ts, cifrasPorCentroYDia):
  // ventas, comensales y tickets de Caja; mercancía = compras recibidas + recibido de otros centros − servido;
  // personal = horas fichadas (o del cuadrante si no hay fichaje) × coste/hora del contrato. Gastos: sin datos
  // (la parte de contabilidad va después: se rellenan al pulsar «Recalcular el mes»).
  const yaIndicadores = await prisma.indicadorDiario.count({ where: { tenantId: t, centroId } });
  if (yaIndicadores === 0) {
    const desdeMes = `${primerDia.slice(0, 7)}-01`;
    const [ventas, movs, asignaciones, fichajes] = await Promise.all([
      prisma.jornadaVenta.findMany({ where: { tenantId: t, centroId, fecha: { gte: aFecha(desdeMes), lte: aFecha(ayer) } } }),
      prisma.movimientoStock.findMany({
        where: { tenantId: t, centroId, tipo: { in: ["ENTRADA_COMPRA", "ENTRADA_PEDIDO", "SALIDA_PEDIDO"] }, createdAt: { gte: enMadrid(desdeMes, 0), lt: enMadrid(hoy, 0) } },
        select: { cantidad: true, costeUnitario: true, createdAt: true },
      }),
      prisma.asignacionTurno.findMany({ where: { tenantId: t, centroId, fecha: { gte: aFecha(desdeMes), lte: aFecha(ayer) } } }),
      prisma.fichaje.findMany({ where: { tenantId: t, centroId, momento: { gte: enMadrid(desdeMes, 5), lt: enMadrid(hoy, 5) } } }),
    ]);
    const jornadasPersonal = calcularJornadas(fichajes).filter((j) => j.dia >= desdeMes && j.dia <= ayer);
    const empleados = Array.from(new Set([...asignaciones.map((a) => a.empleadoId), ...jornadasPersonal.map((j) => j.empleadoId)]));
    const contratos = await prisma.contrato.findMany({ where: { tenantId: t, empleadoId: { in: empleados } } });
    const costeHora = (empleadoId: string, dia: string): number => {
      const d = aFecha(dia).getTime();
      const c = contratos
        .filter((x) => x.empleadoId === empleadoId && x.fechaInicio.getTime() <= d && (!x.fechaFin || x.fechaFin.getTime() >= d))
        .sort((a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime())[0];
      if (!c) return 0;
      if (c.costeHora !== null) return Number(c.costeHora);
      const salario = Number(c.salarioBrutoAnual ?? 0);
      const jornada = Number(c.jornadaSemanal);
      return salario && jornada ? (salario * (1 + Number(c.porcentajeCotizacion) / 100)) / (jornada * SEMANAS_EFECTIVAS) : 0;
    };

    type Fila = { ventas: number | null; comensales: number | null; tickets: number | null; mercancia: number; personal: number };
    const filas = new Map<string, Fila>();
    const fila = (dia: string) => {
      let f = filas.get(dia);
      if (!f) filas.set(dia, (f = { ventas: 0, comensales: 0, tickets: 0, mercancia: 0, personal: 0 }));
      return f;
    };
    for (const v of ventas) {
      const f = fila(iso(v.fecha));
      f.ventas = r2((f.ventas ?? 0) + Number(v.ventaNeta));
      f.comensales = (f.comensales ?? 0) + v.comensales;
      f.tickets = (f.tickets ?? 0) + v.tickets;
    }
    for (const m of movs) {
      const f = fila(fechaMadrid(m.createdAt));
      f.mercancia += Number(m.cantidad) * Number(m.costeUnitario);
    }
    const fichadas = new Set(jornadasPersonal.map((j) => `${j.empleadoId}|${j.dia}`));
    for (const a of asignaciones) {
      const dia = iso(a.fecha);
      if (!fichadas.has(`${a.empleadoId}|${dia}`)) fila(dia).personal += horasTurno(a) * costeHora(a.empleadoId, dia);
    }
    for (const j of jornadasPersonal) fila(j.dia).personal += j.horas * costeHora(j.empleadoId, j.dia);

    const datos: Prisma.IndicadorDiarioCreateManyInput[] = [...filas]
      .filter(([dia]) => dia >= desdeMes && dia <= ayer)
      .map(([dia, f]) => ({
        tenantId: t, centroId, fecha: aFecha(dia), ventas: f.ventas, comensales: f.comensales, tickets: f.tickets,
        mercancia: r2(f.mercancia), gastos: null, personal: r2(f.personal), calculadoEn: enMadrid(masDias(dia, 1), 6),
      }));
    for (let i = 0; i < datos.length; i += 200) await prisma.indicadorDiario.createMany({ data: datos.slice(i, i + 200), skipDuplicates: true });
    console.log(`  caja: ${datos.length} indicadores diarios guardados`);
  }
}
