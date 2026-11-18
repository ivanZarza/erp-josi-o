/**
 * Parte «caja» del local Raza Pruebas (RZ-PRU): tickets con líneas, apertura y cierres de caja, y cuadro de mando.
 *
 * 1. Tickets de las 8 semanas hasta ayer, uno por mesa: cada reserva TERMINADA o SENTADA del día (las «sin
 *    reserva» ya vienen de Reservas) es un ticket con sus líneas de la carta real (plato + formato):
 *    pan y aperitivo por persona (la línea del recargo por comensal del local, como la añade Caja, con el
 *    escandallo del plato «Pan y aperitivo», que la semilla enlaza al recargo), entrantes, cortes (los que más), principales, guarniciones, postres, vino por
 *    botella (Ribera y Rioja de crianza los que más; alguna mágnum), copas de vino y generosos en las mesas
 *    pequeñas, agua, cervezas, vermut a mediodía, cafés y copas por la noche. Los eventos llevan el menú de
 *    grupo con el descuento que deja el ticket en el presupuesto aceptado (a cuenta de la empresa si la hay).
 *    Descuentos a algunas mesas, invitaciones (chupitos, un postre, una botella por una espera), líneas anuladas
 *    con motivo y quién, una mesa entera anulada, propinas con tarjeta y en efectivo, cuentas a medias y los
 *    canjes de tarjeta regalo de Clientes de cada día (VALE).
 *    Todo se guarda con la función común guardarTickets (src/modulos/caja/tickets.ts), la misma de la pantalla y
 *    del TPV: las líneas DESCUENTAN STOCK por su escandallo y formato (movimientos VENTA) y las jornadas de
 *    venta se calculan solas desde los tickets.
 *    El camarero no vende lo que no hay: antes de pedir cada plato se mira el stock que habrá en ese momento
 *    (compras, pedidos, mermas e inventarios de las partes de cocina y bebidas, menos lo ya vendido) y que no
 *    falte después; si no llega, la mesa pide otro de la misma sección. Así ningún producto ni almacén queda
 *    en negativo en ningún momento. Después: el importe de cada visita de Clientes pasa a ser el de su ticket,
 *    y los inventarios del local se recuentan sobre el stock real (mismo descuadre que tenían).
 * 2. Apertura de caja cada día con fondo de 300 €, retiradas a la caja fuerte los días de mucho efectivo, pagos
 *    con dinero de caja (hielo, mercado) y una entrada de cambio. Cierres de cada día hasta ayer (hoy queda
 *    abierto): arqueo con fondo, retiradas, pagos y propinas; descuadres pequeños con motivo, uno grande sin
 *    explicar (rechazado), uno de tarjeta cobrada como efectivo; los últimos, pendientes y sin banco.
 * 3. Cuadro de mando: presupuesto de septiembre a diciembre e indicadores diarios guardados (IndicadorDiario)
 *    calculados como el módulo (mercancía = coste teórico de lo vendido, porque el local tiene tickets).
 *
 * Datos inventados salvo la carta. Si se ejecuta dos veces no duplica (cada bloque mira si ya está).
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "../../../src/generated/prisma/client";
import { calcularJornadas } from "../../../src/modulos/personal/jornadas";
import { horasTurno } from "../../../src/modulos/personal/fechas";
import { cargarEscandallos, consumoDeVenta, costesProductos, recargosDeVenta, type EscandalloVenta } from "../../../src/nucleo/consumo-ventas";
import { guardarTickets, importesLinea, lineaRecargo, precioEnLocal, totalesTicket, type CobroNuevo, type FormaCobro, type LineaTicketNueva, type TicketNuevo } from "../../../src/modulos/caja/tickets";
import type { ContextoPruebas } from "./contexto";
import { grupoDe, pesoArticulo, POR_COMENSAL, type Grupo } from "./mezcla-ventas";
import { pesosComida } from "./cocina";
import { pesosBebidas } from "./bebidas";
import { diaMadrid } from "../../../src/kernel/fechas";

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

const DIA_MS = 86_400_000;
const SEMANAS = 8;
const FONDO_CAJA = 300;
/** Igual que SEMANAS_EFECTIVAS de src/modulos/personal/servicio.ts (no se puede importar: es de servidor). */
const SEMANAS_EFECTIVAS = 52 - 30 / 7;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

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
  return diaMadrid(d);
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
// Carta: qué se pide. Grupos, unidades por comensal y pesos: mezcla-ventas.ts (la misma mezcla con la que
// cocina y bebidas han planificado sus compras)
// ---------------------------------------------------------------------------------------------

/** Lo que se puede pedir: un plato en un formato (o sin formato), con su precio en el local. */
interface Articulo {
  platoId: string;
  formatoId: string | null;
  nombre: string;
  seccion: string;
  precio: number;
  esc: EscandalloVenta;
}

// ---------------------------------------------------------------------------------------------
// Stock en el tiempo: lo que hay en cada momento sin contar las ventas, y lo mínimo que habrá después
// ---------------------------------------------------------------------------------------------

class StockEnElTiempo {
  private tiempos = new Map<string, number[]>();
  private acumulado = new Map<string, number[]>();
  private minimoDespues = new Map<string, number[]>();
  private vendido = new Map<string, number>();

  constructor(movs: { productoId: string; cantidad: number; t: number }[]) {
    const porProducto = new Map<string, { cantidad: number; t: number }[]>();
    for (const m of movs) porProducto.set(m.productoId, [...(porProducto.get(m.productoId) ?? []), m]);
    for (const [p, lista] of porProducto) {
      lista.sort((a, b) => a.t - b.t);
      const ts: number[] = [];
      const acc: number[] = [];
      let s = 0;
      for (const m of lista) {
        s += m.cantidad;
        ts.push(m.t);
        acc.push(s);
      }
      const min = new Array<number>(acc.length + 1);
      min[acc.length] = Infinity;
      for (let i = acc.length - 1; i >= 0; i--) min[i] = Math.min(acc[i], min[i + 1]);
      this.tiempos.set(p, ts);
      this.acumulado.set(p, acc);
      this.minimoDespues.set(p, min);
    }
  }

  /** Lo que se puede vender de un producto en el instante t sin que el stock baje de cero ni ahora ni después. */
  disponible(productoId: string, t: number): number {
    const ts = this.tiempos.get(productoId);
    if (!ts) return 0;
    let lo = 0;
    let hi = ts.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ts[m] <= t) lo = m + 1;
      else hi = m;
    }
    const ahora = lo > 0 ? this.acumulado.get(productoId)![lo - 1] : 0;
    return Math.min(ahora, this.minimoDespues.get(productoId)![lo]) - (this.vendido.get(productoId) ?? 0);
  }

  cabe(consumo: { productoId: string; cantidad: number }[], t: number): boolean {
    const total = new Map<string, number>();
    for (const c of consumo) total.set(c.productoId, (total.get(c.productoId) ?? 0) + c.cantidad);
    for (const [p, q] of total) if (this.disponible(p, t) < q - 1e-6) return false;
    return true;
  }

  vender(consumo: { productoId: string; cantidad: number }[]) {
    for (const c of consumo) this.vendido.set(c.productoId, (this.vendido.get(c.productoId) ?? 0) + c.cantidad);
  }
}

// ---------------------------------------------------------------------------------------------
// Semilla
// ---------------------------------------------------------------------------------------------

const MOTIVOS_ANULACION = [
  "Error de comanda: se marcó en otra mesa",
  "Pedido duplicado en el TPV",
  "El cliente cambia de idea antes de servir",
  "Plato devuelto: el punto de la carne no era el pedido",
  "Bebida servida en la mesa equivocada",
];

interface LineaSim extends LineaTicketNueva {
  grupo: Grupo;
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

  // ---------------- 1. Tickets ----------------
  const yaTickets = await prisma.ticket.count({ where: { tenantId: t, centroId } });
  if (yaTickets === 0) {
    const inicio = Date.now();
    // Carta del local con sus formatos y precios
    const carta = await prisma.carta.findFirst({
      where: { tenantId: t, nombre: "Carta Raza Pruebas" },
      include: { secciones: { include: { lineas: { include: { plato: { include: { precios: { where: { centroId } } } } } } } } },
    });
    if (!carta) throw new Error("Falta la «Carta Raza Pruebas»: carga antes las partes cocina y bebidas");
    const escandallos = await cargarEscandallos(prisma, t, carta.secciones.flatMap((s) => s.lineas.map((l) => l.platoId)));
    const costes = await costesProductos(
      prisma,
      t,
      Array.from(escandallos.values()).flatMap((e) => [...e.ingredientes.map((i) => i.productoId), ...e.formatos.map((f) => f.productoId).filter((x): x is string => !!x)]),
    );
    const porGrupo = new Map<Grupo, { a: Articulo; w: number }[]>();
    const pesos = new Map<string, number>([...Array.from(pesosComida(ctx.carta.comida), ([k, v]) => [`${k}|`, v] as [string, number]), ...pesosBebidas(ctx.carta)]);
    const anadir = (g: Grupo, a: Articulo) => {
      const formato = a.formatoId ? a.esc.formatos.find((f) => f.id === a.formatoId)?.nombre ?? null : null;
      const w = pesoArticulo({ clave: "", seccion: a.seccion, formato, precio: a.precio, variosFormatos: a.esc.formatos.length > 1, peso: pesos.get(`${a.nombre}|${formato ?? ""}`) }, g);
      porGrupo.set(g, [...(porGrupo.get(g) ?? []), { a, w }]);
    };
    let pan: Articulo | undefined;
    for (const s of carta.secciones) {
      if (!grupoDe(s.nombre)) continue;
      for (const l of s.lineas) {
        const local = l.plato.precios[0];
        if ((local && !local.disponible) || !l.plato.activo) continue;
        const esc = escandallos.get(l.platoId);
        if (!esc) continue;
        const ajuste = local?.precio != null ? Number(local.precio) : null;
        const art = (formatoId: string | null, nombre: string): Articulo => ({ platoId: esc.platoId, formatoId, nombre, seccion: s.nombre, precio: precioEnLocal(esc, formatoId, ajuste), esc });
        if (esc.formatos.length === 0) {
          const a = art(null, esc.nombre);
          if (!a.precio) continue;
          if (grupoDe(s.nombre) === "pan") pan = a;
          else anadir(grupoDe(s.nombre)!, a);
          continue;
        }
        for (const f of esc.formatos) {
          const a = art(f.id, esc.nombre);
          if (a.precio) anadir(grupoDe(s.nombre, f.nombre)!, a);
        }
      }
    }
    // Pan y aperitivo: el recargo por comensal del local (lo crea la parte de cocina con el precio de la carta),
    // con el escandallo del plato «Pan y aperitivo» para que baje el pan, las aceitunas y el aceite
    let recargo = (await recargosDeVenta(prisma, t, [centroId])).get(centroId);
    if (recargo && pan && !recargo.platoId) {
      await prisma.cartaRecargo.update({ where: { id: recargo.id }, data: { platoId: pan.platoId } });
      recargo = { ...recargo, platoId: pan.platoId };
    }
    let sinPan = 0;
    /** La línea del recargo de una mesa (como la añade Caja). Si no queda pan, va anulada con el motivo. */
    const lineaPan = (personas: number, momento: Date): LineaSim | null => {
      const l = recargo ? lineaRecargo(recargo, personas, { momento }) : null;
      if (!l) return null;
      const esc = recargo!.platoId ? escandallos.get(recargo!.platoId) : undefined;
      const consumo = esc ? consumoDeVenta(esc, null, personas) : [];
      if (stock.cabe(consumo, momento.getTime())) stock.vender(consumo);
      else {
        sinPan++;
        l.anulada = { motivo: "No quedaba pan: no se sirve ni se cobra", por: gerente?.id ?? null, en: momento };
      }
      return { grupo: "pan", ...l };
    };
    const elegidor = (g: Grupo) => {
      const lista = porGrupo.get(g) ?? [];
      const total = lista.reduce((s, x) => s + x.w, 0);
      return (r: number): Articulo | undefined => {
        let x = r * total;
        for (const it of lista) {
          x -= it.w;
          if (x <= 0) return it.a;
        }
        return lista[lista.length - 1]?.a;
      };
    };
    const elegir = new Map<Grupo, (r: number) => Articulo | undefined>(Array.from(porGrupo.keys()).map((g) => [g, elegidor(g)]));

    // Stock del local en el tiempo (compras, pedidos, mermas e inventarios ya cargados por cocina y bebidas)
    const movs = await prisma.movimientoStock.findMany({ where: { tenantId: t, centroId }, select: { productoId: true, cantidad: true, createdAt: true } });
    const stock = new StockEnElTiempo(movs.map((m) => ({ productoId: m.productoId, cantidad: Number(m.cantidad), t: m.createdAt.getTime() })));
    let agotados = 0;
    const faltaron = new Map<string, number>(); // producto que faltó → veces (para ajustar las compras de cocina y bebidas)
    const apuntarFalta = (consumo: { productoId: string; cantidad: number }[], t0: number) => {
      for (const c of consumo) if (stock.disponible(c.productoId, t0) < c.cantidad - 1e-6) faltaron.set(c.productoId, (faltaron.get(c.productoId) ?? 0) + 1);
    };

    /** Pide `n` artículos del grupo si hay stock (si no, otro de la misma sección o del grupo). */
    const pedir = (lineas: LineaSim[], g: Grupo, n: number, momento: Date, r: () => number, extra: Partial<LineaSim> = {}): Articulo | undefined => {
      const e = elegir.get(g);
      let ultimo: Articulo | undefined;
      if (!e || n <= 0) return undefined;
      for (let i = 0; i < n; i++) {
        let hecho = false;
        for (let intento = 0; intento < 8 && !hecho; intento++) {
          const a = e(r());
          if (!a) break;
          const consumo = consumoDeVenta(a.esc, a.formatoId, 1);
          if (!stock.cabe(consumo, momento.getTime())) {
            if (intento === 0) {
              agotados++;
              apuntarFalta(consumo, momento.getTime());
            }
            continue;
          }
          stock.vender(consumo);
          const igual = lineas.find((l) => l.platoId === a.platoId && l.formatoId === a.formatoId && !l.invitacion && !l.anulada && !extra.invitacion && !extra.anulada && l.grupo === g);
          if (igual) igual.cantidad += 1;
          else lineas.push({ grupo: g, platoId: a.platoId, formatoId: a.formatoId, cantidad: 1, precio: a.precio, momento, ...extra });
          ultimo = a;
          hecho = true;
        }
      }
      return ultimo;
    };

    /**
     * Lo que pide una mesa: las unidades por comensal de cada grupo (mezcla-ventas.ts), con más cafés,
     * cervezas y vermut a mediodía y más vino y copas por la noche (de media, lo mismo que la previsión).
     */
    const simularMesa = (personas: number, comida: boolean, momento: Date, r: () => number): LineaSim[] => {
      const lineas: LineaSim[] = [];
      const lp = lineaPan(personas, momento);
      if (lp) lineas.push(lp);
      // unidades de un grupo para la mesa: personas × por comensal × reparto comida/cena, con redondeo al azar
      const n = (g: Grupo, comidaX = 1, cenaX = 1) => {
        const x = personas * POR_COMENSAL[g] * (comida ? comidaX : cenaX) * (0.75 + r() * 0.5);
        return Math.floor(x) + (r() < x - Math.floor(x) ? 1 : 0);
      };
      pedir(lineas, "entrante", Math.max(1, n("entrante", 1, 1)), momento, r);
      const cortes = n("corte");
      const otros = n("principal");
      pedir(lineas, "corte", cortes + otros === 0 ? 1 : cortes, momento, r);
      pedir(lineas, "principal", otros, momento, r);
      pedir(lineas, "guarnicion", n("guarnicion"), momento, r);
      pedir(lineas, "postre", n("postre", 1.1, 0.93), momento, r);
      // vino por botella; las mesas de 1 o 2 a veces toman copas de vino, cerveza o un generoso
      const sinBotella = personas <= 2 && r() < (comida ? 0.4 : 0.15);
      if (!sinBotella) pedir(lineas, "vino", Math.max(1, n("vino", 0.8, 1.13)), momento, r);
      else {
        const x = r();
        pedir(lineas, x < 0.5 ? "copaVino" : x < 0.8 ? "cerveza" : "generoso", personas, momento, r);
      }
      pedir(lineas, "copaVino", n("copaVino", 0.4, 0.75), momento, r); // copas de vino en la barra o con el postre
      pedir(lineas, "agua", Math.max(1, n("agua")), momento, r);
      pedir(lineas, "cerveza", n("cerveza", 1.2, 0.7), momento, r);
      if (comida) pedir(lineas, "vermut", n("vermut", 2.1), momento, r);
      pedir(lineas, "cafe", n("cafe", 1.2, 0.8), momento, r);
      if (!comida) pedir(lineas, "copa", n("copa", 1, 1.6), momento, r);
      pedir(lineas, "generoso", n("generoso", 0.4, 0.4), momento, r);
      pedir(lineas, "dulce", n("dulce"), momento, r);
      return lineas;
    };

    /** Menú de grupo de un evento: platos de la carta para todos y descuento hasta el presupuesto aceptado. */
    const simularEvento = (personas: number, presupuesto: number, momento: Date, r: () => number): LineaSim[] => {
      const lineas: LineaSim[] = [];
      const lp = lineaPan(personas, momento);
      if (lp) lineas.push(lp);
      pedir(lineas, "entrante", Math.round(personas * 0.9), momento, r);
      pedir(lineas, "corte", Math.round(personas * 0.6), momento, r);
      pedir(lineas, "guarnicion", Math.round(personas * 0.5), momento, r);
      pedir(lineas, "postre", personas, momento, r);
      pedir(lineas, "vino", Math.ceil(personas / 2.5), momento, r);
      pedir(lineas, "agua", Math.ceil(personas / 2), momento, r);
      pedir(lineas, "cafe", Math.round(personas * 0.8), momento, r);
      // (la línea del pan anulada por falta de stock no cuenta)
      const brutoVivas = () => lineas.filter((l) => !l.anulada).reduce((s, l) => s + l.cantidad * l.precio!, 0);
      let bruto = brutoVivas();
      for (let i = 0; bruto < presupuesto && i < 20; i++) {
        pedir(lineas, "vino", 1, momento, r);
        bruto = brutoVivas();
      }
      // el precio cerrado del menú: descuento repartido por las líneas para que el ticket sea el presupuesto
      const quitar = r2(Math.max(0, bruto - presupuesto));
      const vivas = lineas.filter((l) => !l.anulada);
      let puesto = 0;
      vivas.forEach((l, i) => {
        const b = r2(l.cantidad * l.precio!);
        l.descuento = i === vivas.length - 1 ? r2(quitar - puesto) : r2((b * quitar) / bruto);
        puesto = r2(puesto + l.descuento);
      });
      return lineas;
    };

    // Reservas sentadas o terminadas de las 8 semanas (incluyen las «sin reserva» y los eventos)
    const reservas = await prisma.reserva.findMany({
      where: { tenantId: t, centroId, fecha: { gte: aFecha(primerDia), lte: aFecha(ayer) }, estado: { in: ["SENTADA", "TERMINADA"] } },
      select: { id: true, fecha: true, hora: true, personas: true, duracionMin: true, solicitudEventoId: true, notas: true, mesas: { select: { mesa: { select: { nombre: true } } } } },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }, { personas: "asc" }, { nombre: "asc" }],
    });
    const visitas = await prisma.clienteVisita.findMany({ where: { tenantId: t, reservaId: { in: reservas.map((r) => r.id) } }, select: { id: true, reservaId: true } });
    // Eventos: lo cobrado es el presupuesto aceptado; los de empresa van a cuenta (factura)
    const idsEvento = reservas.map((r) => r.solicitudEventoId).filter((x): x is string => !!x);
    const eventos = await prisma.eventoSolicitud.findMany({ where: { id: { in: idsEvento } }, include: { presupuestos: { where: { estado: "ACEPTADO" } } } });
    const evento = new Map(eventos.map((e) => [e.id, { total: e.presupuestos[0] ? Number(e.presupuestos[0].total) : null, empresa: !!e.empresa, numero: e.numero }]));
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
    // Camareros de cada día (cuadrante de Personal)
    const turnos = await prisma.asignacionTurno.findMany({
      where: { tenantId: t, centroId, fecha: { gte: aFecha(primerDia), lte: aFecha(ayer) }, empleado: { puesto: { nombre: { in: ["Camarero/a", "Encargado/a de sala"] } } } },
      select: { fecha: true, inicio: true, fin: true, inicio2: true, fin2: true, empleado: { select: { id: true, nombre: true, apellidos: true } } },
    });
    const camarerosDia = new Map<string, typeof turnos>();
    for (const x of turnos) camarerosDia.set(iso(x.fecha), [...(camarerosDia.get(iso(x.fecha)) ?? []), x]);
    const camareroPara = (dia: string, hora: string, r: () => number) => {
      const lista = camarerosDia.get(dia) ?? [];
      const dentro = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && (a <= hora && (b > hora || b < a));
      const enTurno = lista.filter((x) => dentro(x.inicio, x.fin) || dentro(x.inicio2, x.fin2));
      const de = enTurno.length ? enTurno : lista;
      return de.length ? de[Math.floor(r() * de.length)].empleado : null;
    };

    const porDia = new Map<string, typeof reservas>();
    for (const r of reservas) porDia.set(iso(r.fecha), [...(porDia.get(iso(r.fecha)) ?? []), r]);
    const opus = (porGrupo.get("demanda") ?? []).find((x) => /opus one/i.test(x.a.nombre))?.a;

    const tickets: TicketNuevo[] = [];
    const importeTicketDeReserva = new Map<string, number>();
    for (let d = SEMANAS * 7; d >= 1; d--) {
      const dia = masDias(hoy, -d);
      const delDia = porDia.get(dia) ?? [];
      if (delDia.length === 0) continue;
      const r = aleatorio(Number(dia.replaceAll("-", "")));
      const delDiaTickets: (TicketNuevo & { lineas: LineaSim[] })[] = [];
      for (const res of delDia) {
        const [hh, mm] = res.hora.split(":").map(Number);
        const abiertoEn = enMadrid(dia, hh, mm);
        const momento = new Date(abiertoEn.getTime() + 20 * 60_000);
        const comida = res.hora < "17:00";
        const ev = res.solicitudEventoId ? evento.get(res.solicitudEventoId) : undefined;
        const lineas = ev?.total ? simularEvento(res.personas, ev.total, momento, r) : simularMesa(res.personas, comida, momento, r);
        if (!ev) {
          // descuento a algunas mesas (cliente habitual, compensación por una espera)
          if (r() < 0.025) {
            const pct = r() < 0.6 ? 0.1 : 0.15;
            for (const l of lineas) l.descuento = r2(l.cantidad * l.precio! * pct);
          }
          // invitaciones: chupitos a la mesa, algún postre
          if (r() < 0.1) {
            const chupitos = (porGrupo.get("copa") ?? []).filter((x) => x.a.precio <= 7);
            const a = chupitos.length ? chupitos[Math.floor(r() * chupitos.length)].a : undefined;
            const cuantos = Math.min(res.personas, 1 + Math.floor(r() * 3));
            const consumo = a ? consumoDeVenta(a.esc, a.formatoId, cuantos) : [];
            if (a && stock.cabe(consumo, momento.getTime())) {
              stock.vender(consumo);
              lineas.push({ grupo: "copa", platoId: a.platoId, formatoId: a.formatoId, cantidad: cuantos, precio: a.precio, invitacion: true, momento, concepto: `${a.nombre} (invitación de la casa)` });
            }
          }
          if (r() < 0.03) pedir(lineas, "postre", 1, momento, r, { invitacion: true });
        }
        const camarero = camareroPara(dia, res.hora, r);
        delDiaTickets.push({
          id: randomUUID(),
          centroId,
          numero: "",
          abiertoEn,
          cobradoEn: new Date(abiertoEn.getTime() + Math.round(res.duracionMin * (0.85 + r() * 0.15)) * 60_000),
          fecha: dia,
          mesa: res.mesas.map((m) => m.mesa.nombre).join("+") || null,
          comensales: res.personas,
          empleadoId: camarero?.id ?? null,
          camarero: camarero ? `${camarero.nombre} ${camarero.apellidos}` : null,
          estado: "COBRADO",
          lineas,
          cobros: [],
          origen: "TPV",
          externoId: null,
          reservaId: res.id,
          notas: ev ? `Evento ${ev.numero}: menú de grupo a precio cerrado (presupuesto aceptado)` : null,
          creadoPor: gerente?.id ?? null,
        });
      }
      // una botella invitada a una mesa que esperó (algunos días)
      if (r() < 0.12 && delDiaTickets.length) {
        const tk = delDiaTickets[Math.floor(r() * delDiaTickets.length)];
        const antes = tk.lineas.length;
        pedir(tk.lineas as LineaSim[], "vino", 1, new Date(tk.abiertoEn.getTime() + 20 * 60_000), r, { invitacion: true });
        if (tk.lineas.length > antes) tk.notas = "Botella invitada: la mesa esperó 30 minutos";
      }
      // anulaciones: líneas borradas antes de cobrar (error de comanda, plato devuelto); no mueven stock
      const nAnul = r() < 0.55 ? 1 + Math.floor(r() * 3) : 0;
      for (let i = 0; i < nAnul; i++) {
        const tk = delDiaTickets[Math.floor(r() * delDiaTickets.length)];
        const g: Grupo = (["entrante", "corte", "vino", "postre"] as Grupo[])[Math.floor(r() * 4)];
        const a = elegir.get(g)?.(r());
        if (!a) continue;
        tk.lineas.push({ grupo: g, platoId: a.platoId, formatoId: a.formatoId, cantidad: 1, precio: a.precio, momento: new Date(tk.abiertoEn.getTime() + 25 * 60_000), anulada: { motivo: MOTIVOS_ANULACION[Math.floor(r() * MOTIVOS_ANULACION.length)], por: gerente?.id ?? null, en: new Date(tk.abiertoEn.getTime() + 32 * 60_000) } });
      }
      // hace 17 días: una mesa entera anulada en la terraza y vuelta a abrir en otra (aparece en el cierre)
      if (d === 17) {
        const cena = delDiaTickets.filter((x) => x.mesa && x.comensales >= 3 && x.abiertoEn.getUTCHours() >= 19);
        const base = cena[0] ?? delDiaTickets[0];
        const r2a = aleatorio(17);
        const lineas: LineaSim[] = [];
        for (const g of ["entrante", "entrante", "corte", "corte", "vino"] as Grupo[]) {
          const a = elegir.get(g)?.(r2a());
          if (a) lineas.push({ grupo: g, platoId: a.platoId, formatoId: a.formatoId, cantidad: 1, precio: a.precio, momento: base.abiertoEn });
        }
        delDiaTickets.push({
          ...base,
          id: randomUUID(),
          abiertoEn: new Date(base.abiertoEn.getTime() - 10 * 60_000),
          cobradoEn: null,
          estado: "ANULADO",
          anulacion: { motivo: "Mesa abierta en la terraza por error; se vuelve a abrir en la mesa buena", por: gerente?.id ?? null, en: new Date(base.abiertoEn.getTime() + 5 * 60_000) },
          lineas,
          reservaId: null,
          notas: null,
        });
      }
      // hace 19 días: Opus One bajo demanda para la reserva de la mesa 12 (lo pidió el obrador para ella)
      if (d === 19 && opus) {
        const tk = [...delDiaTickets].filter((x) => x.abiertoEn.getUTCHours() >= 19 && x.estado === "COBRADO").sort((a, b) => b.comensales - a.comensales)[0];
        const consumo = consumoDeVenta(opus.esc, opus.formatoId, 1);
        if (tk && stock.cabe(consumo, tk.abiertoEn.getTime() + 20 * 60_000)) {
          stock.vender(consumo);
          tk.lineas.push({ grupo: "demanda", platoId: opus.platoId, formatoId: opus.formatoId, cantidad: 1, precio: opus.precio, momento: new Date(tk.abiertoEn.getTime() + 20 * 60_000) });
          tk.notas = "Opus One pedido bajo demanda para esta reserva";
        }
      }

      // cobros: forma de pago, propinas, cuentas a medias y canjes de tarjeta regalo
      delDiaTickets.sort((a, b) => a.abiertoEn.getTime() - b.abiertoEn.getTime());
      let vale = valePorDia.get(dia) ?? 0;
      const totales = delDiaTickets.map((tk) =>
        totalesTicket(tk.lineas.map((l) => importesLinea({ cantidad: l.cantidad, precio: l.precio!, iva: l.iva ?? escandallos.get(l.platoId!)?.iva ?? 10, descuento: l.descuento ?? 0, invitacion: !!l.invitacion, anulada: !!l.anulada }))).total,
      );
      const orden = delDiaTickets.map((_, i) => i).sort((a, b) => totales[b] - totales[a]);
      delDiaTickets.forEach((tk, i) => {
        tk.numero = `T${dia.slice(2).replaceAll("-", "")}-${String(i + 1).padStart(3, "0")}`;
        tk.externoId = `RZPRU-${tk.numero}`;
        if (tk.estado !== "COBRADO") return;
        const total = totales[i];
        const ev = tk.reservaId ? evento.get(delDia.find((x) => x.id === tk.reservaId)?.solicitudEventoId ?? "") : undefined;
        const cobros: CobroNuevo[] = [];
        if (ev?.empresa) cobros.push({ forma: "CREDITO", importe: total });
        else {
          const x = r();
          const efectivo = tk.comensales <= 2 ? 0.17 : 0.1;
          const forma: FormaCobro = x < efectivo ? "EFECTIVO" : x < efectivo + 0.05 ? "BIZUM" : "TARJETA";
          // propina: con tarjeta, un 3–8 % redondeado; en efectivo, la vuelta (va al bote del personal)
          const propina = forma === "TARJETA" && r() < 0.35 ? Math.max(1, Math.round((total * (0.03 + r() * 0.05)) / 0.5) * 0.5) : forma === "EFECTIVO" && r() < 0.5 ? Math.max(1, Math.round(total * 0.05)) : 0;
          if (forma === "TARJETA" && tk.comensales >= 6 && r() < 0.3) {
            // cuenta a medias entre dos tarjetas
            const mitad = r2(total / 2);
            cobros.push({ forma: "TARJETA", importe: mitad, propina }, { forma: "TARJETA", importe: r2(total - mitad) });
          } else cobros.push({ forma, importe: total, propina });
        }
        tk.cobros = cobros;
      });
      // canjes de tarjeta regalo del día: pagan parte de las cuentas con tarjeta más altas
      for (const i of orden) {
        if (vale <= 0) break;
        const tk = delDiaTickets[i];
        const c = tk.cobros.find((x) => x.forma === "TARJETA");
        if (!c) continue;
        const usa = r2(Math.min(vale, c.importe));
        if (usa <= 0) continue;
        c.importe = r2(c.importe - usa);
        tk.cobros.push({ forma: "VALE", importe: usa });
        vale = r2(vale - usa);
      }
      for (const tk of delDiaTickets) {
        tk.cobros = tk.cobros.filter((c) => c.importe > 0 || (c.propina ?? 0) > 0);
        if (tk.reservaId && tk.estado === "COBRADO") importeTicketDeReserva.set(tk.reservaId, totales[delDiaTickets.indexOf(tk)]);
        for (const l of tk.lineas as LineaSim[]) delete (l as Partial<LineaSim>).grupo;
        tickets.push(tk);
      }
    }

    if (process.env.CAJA_DETALLE) {
      console.log(`  caja: simulación hecha en ${Math.round((Date.now() - inicio) / 100) / 10} s`);
      const nombres = new Map((await prisma.producto.findMany({ where: { id: { in: Array.from(faltaron.keys()) } }, select: { id: true, nombre: true, referencia: true } })).map((p) => [p.id, `${p.referencia} ${p.nombre}`]));
      console.log("  caja: productos que más faltaron:", [...faltaron].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([p, n]) => `${nombres.get(p)} ${n}`).join("; "));
    }
    // Guardar con la función común: tickets, líneas, cobros, stock (VENTA) y jornadas
    const r = await guardarTickets(prisma, t, tickets, { usuarioId: gerente?.id ?? null, escandallos, costes });
    const lineas = tickets.reduce((s, x) => s + x.lineas.length, 0);
    console.log(
      `  caja: ${tickets.length} tickets (${tickets.filter((x) => x.estado === "ANULADO").length} anulado), ${lineas} líneas, ${r.movimientos} movimientos de venta; ${agotados} veces se pidió algo agotado y se cambió por otro; ${sinPan} mesas sin pan por falta de stock (${Math.round((Date.now() - inicio) / 100) / 10} s)`,
    );

    // Clientes: el importe de cada visita es el de su ticket
    const filasVisita = visitas.filter((v) => v.reservaId && importeTicketDeReserva.has(v.reservaId)).map((v) => `('${v.id}', ${importeTicketDeReserva.get(v.reservaId!)!.toFixed(2)})`);
    for (let i = 0; i < filasVisita.length; i += 1000)
      await prisma.$executeRawUnsafe(`UPDATE "ClienteVisita" v SET importe = x.importe::numeric FROM (VALUES ${filasVisita.slice(i, i + 1000).join(",")}) AS x(id, importe) WHERE v.id = x.id`);

    // Inventarios del local: se recuentan sobre el stock real (el que ha dejado la venta), con el mismo descuadre
    const inventarios = await prisma.inventario.findMany({ where: { tenantId: t, centroId }, include: { lineas: true }, orderBy: { createdAt: "asc" } });
    let recortadas = 0;
    for (const inv of inventarios) {
      const st = await prisma.movimientoStock.groupBy({ by: ["productoId"], where: { tenantId: t, centroId, createdAt: { lt: inv.createdAt }, ...(inv.almacenId ? { almacenId: inv.almacenId } : {}) }, _sum: { cantidad: true } });
      const real = new Map(st.map((x) => [x.productoId, Number(x._sum.cantidad ?? 0)]));
      const filas = inv.lineas.map((l) => {
        const teorico = r3(real.get(l.productoId) ?? 0);
        let contado = l.contado === null ? null : r3(teorico + Number(l.contado) - Number(l.teorico));
        if (contado !== null && contado < 0) {
          recortadas++;
          contado = 0;
        }
        return `('${l.id}', ${teorico}, ${contado === null ? "NULL" : contado})`;
      });
      for (let i = 0; i < filas.length; i += 1000)
        await prisma.$executeRawUnsafe(`UPDATE "InventarioLinea" il SET teorico = x.teorico::numeric, contado = x.contado::numeric FROM (VALUES ${filas.slice(i, i + 1000).join(",")}) AS x(id, teorico, contado) WHERE il.id = x.id`);
    }
    console.log(`  caja: ${filasVisita.length} visitas de Clientes con el importe de su ticket; ${inventarios.length} inventarios recontados sobre el stock real${recortadas ? ` (${recortadas} líneas sin stock para su descuadre)` : ""}`);
  }

  // ---------------- 2. Apertura de caja, retiradas, pagos y cierres ----------------
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
      47: [10, 0, "Propina en efectivo metida en el cajón en vez de en el bote"],
      41: [-20, 0, "Billete de 20 € de más en un cambio de la terraza"],
      37: [-0.8, 0, "Monedas: redondeos de cambio"],
      27: [-62.4, 62.4, "Mesa 9 cobrada con tarjeta y marcada como efectivo en el TPV"],
      23: [5, 0, "Propina en efectivo sin apartar al bote"],
      17: [-250, 0, "Sin explicar: recontado dos veces por el encargado y la gerente, no aparece"],
      12: [-2.3, 0, "Monedas: redondeos de cambio"],
      9: [0, -18.9, "Una devolución en el datáfono (plato devuelto) no está en el TPV"],
      5: [15, 0, "Propina en efectivo sin apartar al bote"],
      2: [-7.6, 0, "Cambio mal dado en la barra"],
    };
    // pagos y entradas con dinero de caja: [días atrás, tipo, importe, concepto, hora]
    const MOVIMIENTOS: [number, "PAGO" | "ENTRADA", number, string, number][] = [
      [44, "ENTRADA", 100, "Cambio en monedas traído de la caja fuerte", 12],
      [33, "PAGO", 12, "Repartidor de hielo: pago en efectivo sin ticket (se pide el justificante)", 13],
      [26, "PAGO", 8.4, "Limones y hierbabuena en el mercado para la barra (ticket en el sobre)", 12],
      [11, "PAGO", 25, "Propina al técnico de la cámara (urgencia de domingo)", 16],
      [6, "PAGO", 14.5, "Flores para la mesa del evento", 12],
    ];
    const aperturas: Prisma.AperturaCajaCreateManyInput[] = [];
    const movsCaja: Prisma.MovimientoCajaCreateManyInput[] = [];
    const cierres: Prisma.CierreCajaCreateManyInput[] = [];
    for (const j of jornadas) {
      const dia = iso(j.fecha);
      const atras = Math.round((aFecha(hoy).getTime() - j.fecha.getTime()) / DIA_MS);
      const pago = (f: string) => j.pagos.find((p) => p.forma === f);
      const efectivo = Number(pago("EFECTIVO")?.importe ?? 0);
      const tarjeta = Number(pago("TARJETA")?.importe ?? 0);
      const propinasTarjeta = Number(pago("TARJETA")?.propina ?? 0);
      const propinasEfectivo = Number(pago("EFECTIVO")?.propina ?? 0);
      const aperturaId = randomUUID();
      const abierta = enMadrid(dia, 12, 15 + Math.floor(azar() * 20));
      aperturas.push({ id: aperturaId, tenantId: t, centroId, fecha: j.fecha, fondoInicial: FONDO_CAJA, abiertaEn: abierta, abiertaPor: gerente?.id ?? null, notas: null });
      let retiradas = 0;
      let pagos = 0;
      let entradas = 0;
      // retirada a la caja fuerte a media tarde los días de mucho efectivo
      if (efectivo > 700) {
        const importe = Math.floor((efectivo * 0.6) / 50) * 50;
        retiradas += importe;
        movsCaja.push({ id: randomUUID(), aperturaId, tipo: "RETIRADA", importe, concepto: "A la caja fuerte (sobre firmado por la gerente)", momento: enMadrid(dia, 17, 40), usuarioId: gerente?.id ?? null });
      }
      for (const [d, tipo, importe, concepto, hora] of MOVIMIENTOS) {
        if (d !== atras) continue;
        if (tipo === "PAGO") pagos += importe;
        else entradas += importe;
        movsCaja.push({ id: randomUUID(), aperturaId, tipo, importe, concepto, momento: enMadrid(dia, hora, 30), usuarioId: gerente?.id ?? null });
      }
      const [desc, descTarjeta, motivo] = DESCUADRES[atras] ?? [0, 0, null];
      const rechazado = atras === 17;
      const pendiente = atras <= 3;
      const cerrado = enMadrid(masDias(dia, 1), 0, 40 + Math.floor(azar() * 30));
      const teorico = r2(FONDO_CAJA + efectivo + entradas - retiradas - pagos);
      const tarjetaTeorico = r2(tarjeta + propinasTarjeta);
      cierres.push({
        id: randomUUID(), tenantId: t, centroId, fecha: j.fecha,
        efectivoTeorico: teorico, efectivoContado: r2(teorico + desc), descuadre: desc,
        tarjetaTeorico,
        // el banco liquida la tarjeta (con sus propinas) a los 2 días: los cierres de ayer y anteayer aún no lo tienen
        tarjetaBanco: atras <= 2 ? null : r2(tarjetaTeorico + descTarjeta),
        fondoCaja: FONDO_CAJA, fondoInicial: FONDO_CAJA, efectivoVentas: efectivo, retiradas, pagosCaja: pagos, entradasCaja: entradas, propinasTarjeta, propinasEfectivo, motivo,
        estado: rechazado ? "RECHAZADO" : pendiente ? "PENDIENTE" : "VALIDADO",
        cerradoPor: gerente?.id ?? null,
        validadoPor: pendiente ? null : admin?.id ?? null,
        validadoEn: pendiente ? null : enMadrid(masDias(dia, rechazado ? 2 : 3), 10, 15),
        comentarioValidacion: rechazado
          ? "Descuadre de 250 € sin causa. Revisar el ticket anulado de esa noche (una mesa entera en la terraza) y las cámaras del cajón; rehacer el arqueo con la explicación."
          : atras === 27 ? "Ok: el descuadre de efectivo y el de tarjeta se compensan." : null,
        createdAt: cerrado, updatedAt: cerrado,
      });
    }
    // hoy: caja abierta con el fondo, sin cierre
    if (!aperturas.some((a) => iso(a.fecha as Date) === hoy)) aperturas.push({ id: randomUUID(), tenantId: t, centroId, fecha: aFecha(hoy), fondoInicial: FONDO_CAJA, abiertaEn: enMadrid(hoy, 12, 20), abiertaPor: gerente?.id ?? null, notas: "Caja de hoy: abierta, sin cerrar" });
    await prisma.aperturaCaja.createMany({ data: aperturas, skipDuplicates: true });
    if (movsCaja.length) await prisma.movimientoCaja.createMany({ data: movsCaja });
    await prisma.cierreCaja.createMany({ data: cierres });
    console.log(`  caja: ${aperturas.length} aperturas de caja, ${movsCaja.length} retiradas y pagos, ${cierres.length} cierres (hoy, ${hoy}, queda abierto)`);
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
  // ventas, comensales y tickets de Caja; mercancía = coste teórico de lo vendido desde el primer día con
  // tickets (antes, compras recibidas + recibido de otros centros − servido); personal = horas fichadas (o
  // del cuadrante si no hay fichaje) × coste/hora del contrato, salvo en los meses con nóminas (manda su coste
  // empresa repartido por días). Gastos: sin datos (se rellenan con «Recalcular el mes»).
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
    let primerTeorico: string | null = null;
    for (const v of ventas) {
      const f = fila(iso(v.fecha));
      f.ventas = r2((f.ventas ?? 0) + Number(v.ventaNeta));
      f.comensales = (f.comensales ?? 0) + v.comensales;
      f.tickets = (f.tickets ?? 0) + v.tickets;
      if (v.desdeTickets && v.costeTeorico !== null) {
        f.mercancia += Number(v.costeTeorico);
        if (!primerTeorico || iso(v.fecha) < primerTeorico) primerTeorico = iso(v.fecha);
      }
    }
    for (const m of movs) {
      const dia = fechaMadrid(m.createdAt);
      if (primerTeorico && dia >= primerTeorico) continue;
      fila(dia).mercancia += Number(m.cantidad) * Number(m.costeUnitario);
    }
    const fichadas = new Set(jornadasPersonal.map((j) => `${j.empleadoId}|${j.dia}`));
    for (const a of asignaciones) {
      const dia = iso(a.fecha);
      if (!fichadas.has(`${a.empleadoId}|${dia}`)) fila(dia).personal += horasTurno(a) * costeHora(a.empleadoId, dia);
    }
    for (const j of jornadasPersonal) fila(j.dia).personal += j.horas * costeHora(j.empleadoId, j.dia);
    // Regla del Cuadro (15/11/2026): si el mes tiene nóminas calculadas, manda su coste empresa repartido por igual
    // entre los días del mes (al céntimo); las horas solo cuentan en los meses sin nóminas.
    for (const [mesN, coste] of costeNominas) {
      if (!coste) continue;
      const [an, me] = mesN.split("-").map(Number);
      const diasMes = new Date(Date.UTC(an, me, 0)).getUTCDate();
      const acumulado = (n: number) => r2((coste * n) / diasMes);
      for (let i = 0; i < diasMes; i++) {
        const dia = `${mesN}-${String(i + 1).padStart(2, "0")}`;
        if (dia < desdeMes || dia > ayer) continue;
        fila(dia).personal = r2(acumulado(i + 1) - acumulado(i));
      }
    }

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
