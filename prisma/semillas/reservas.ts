/**
 * Semilla del módulo Reservas (solo desarrollo): planos de Albufera Moraleja (sala, terraza y tres
 * reservados), Raza Barquillo (sala, barra y reservado) y El Puchero (sala y reservado), turnos de
 * comida y cena, reglas, y reservas de hoy y mañana. Si ya hay clientes (semilla de Clientes),
 * las reservas se enlazan con ellos.
 */
import type { Sembrar } from "./index";
import { hoyMadrid } from "../../src/kernel/fechas";

type Mesa = { nombre: string; min: number; max: number; x: number; y: number; forma?: "CUADRADA" | "REDONDA" | "RECTANGULAR"; combinable?: boolean; especial?: string; internet?: boolean };
type Espacio = { nombre: string; tipo: "SALA" | "TERRAZA" | "RESERVADO" | "BARRA"; aforo: number; ancho: number; alto: number; mesas: Mesa[] };

/** Rejilla de mesas: filas × columnas a partir de (x0, y0) con separación d. */
function rejilla(prefijo: number, filas: number, cols: number, x0: number, y0: number, d: number, cap: [number, number], extra: Partial<Mesa> = {}): Mesa[] {
  const l: Mesa[] = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) l.push({ nombre: String(prefijo + f * cols + c), min: cap[0], max: cap[1], x: x0 + c * d, y: y0 + f * d, ...extra });
  return l;
}

const PLANOS: Record<string, { grupoMaximo: number; espacios: Espacio[] }> = {
  "AL-MOR": {
    grupoMaximo: 12,
    espacios: [
      {
        nombre: "Sala principal", tipo: "SALA", aforo: 80, ancho: 820, alto: 480,
        mesas: [
          ...rejilla(1, 2, 5, 30, 30, 110, [2, 4], { combinable: true }),
          ...rejilla(11, 1, 3, 30, 300, 150, [4, 6], { forma: "REDONDA" }),
          { nombre: "14", min: 6, max: 8, x: 520, y: 300, forma: "RECTANGULAR" },
          { nombre: "15", min: 2, max: 2, x: 700, y: 30, especial: "Ventana" },
          { nombre: "16", min: 2, max: 2, x: 700, y: 140, especial: "Ventana" },
        ],
      },
      { nombre: "Terraza", tipo: "TERRAZA", aforo: 40, ancho: 720, alto: 300, mesas: rejilla(31, 2, 5, 30, 40, 130, [2, 4], { forma: "REDONDA", combinable: true }) },
      {
        nombre: "Reservado Socarrat", tipo: "RESERVADO", aforo: 16, ancho: 420, alto: 280,
        mesas: [{ nombre: "R1", min: 8, max: 16, x: 100, y: 100, forma: "RECTANGULAR", internet: false, especial: "Reservado completo" }],
      },
      {
        nombre: "Reservado Fumet", tipo: "RESERVADO", aforo: 20, ancho: 420, alto: 280,
        mesas: [
          { nombre: "R2", min: 6, max: 10, x: 40, y: 100, forma: "RECTANGULAR", combinable: true, internet: false },
          { nombre: "R3", min: 6, max: 10, x: 240, y: 100, forma: "RECTANGULAR", combinable: true, internet: false },
        ],
      },
      {
        nombre: "Reservado La Barraca", tipo: "RESERVADO", aforo: 10, ancho: 360, alto: 240,
        mesas: [{ nombre: "R4", min: 4, max: 10, x: 110, y: 90, forma: "REDONDA", internet: false, especial: "Chimenea" }],
      },
    ],
  },
  "RZ-BAR": {
    grupoMaximo: 10,
    espacios: [
      {
        nombre: "Sala", tipo: "SALA", aforo: 60, ancho: 800, alto: 460,
        mesas: [...rejilla(1, 3, 4, 30, 30, 120, [2, 4], { combinable: true }), { nombre: "13", min: 5, max: 8, x: 540, y: 60, forma: "RECTANGULAR" }, { nombre: "14", min: 5, max: 8, x: 540, y: 220, forma: "RECTANGULAR" }],
      },
      { nombre: "Barra", tipo: "BARRA", aforo: 10, ancho: 640, alto: 160, mesas: rejilla(21, 1, 5, 30, 50, 120, [1, 2]) },
      { nombre: "Reservado", tipo: "RESERVADO", aforo: 12, ancho: 400, alto: 260, mesas: [{ nombre: "R1", min: 6, max: 12, x: 90, y: 90, forma: "RECTANGULAR", internet: false }] },
    ],
  },
  "PU-CHA": {
    grupoMaximo: 10, // El Puchero hoy pide más de 10 → evento
    espacios: [
      { nombre: "Comedor", tipo: "SALA", aforo: 50, ancho: 760, alto: 420, mesas: [...rejilla(1, 3, 4, 30, 30, 120, [2, 4], { combinable: true }), { nombre: "13", min: 4, max: 6, x: 540, y: 150, forma: "REDONDA" }] },
      { nombre: "Terraza", tipo: "TERRAZA", aforo: 24, ancho: 600, alto: 240, mesas: rejilla(21, 1, 5, 20, 80, 110, [2, 4], { forma: "REDONDA" }) },
      { nombre: "Reservado", tipo: "RESERVADO", aforo: 14, ancho: 380, alto: 240, mesas: [{ nombre: "R1", min: 6, max: 14, x: 80, y: 80, forma: "RECTANGULAR", internet: false }] },
    ],
  },
};

const NOMBRES_SUELTOS = ["Familia Ortega", "Beatriz Calvo", "Óscar Peña", "Nuria Vidal", "Tomás Herrero", "Rocío Lozano", "Íñigo Arias", "Pilar Cano", "Gonzalo Prieto", "Lorena Méndez"];

const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

export const sembrar: Sembrar = async (prisma, ctx) => {
  const t = ctx.tenantId;
  const clientes = await prisma.cliente.findMany({ where: { tenantId: t, activo: true }, take: 50, orderBy: { createdAt: "asc" } });
  let iCliente = 0;
  let iSuelto = 0;
  const siguienteCliente = () => {
    if (clientes.length && iCliente < clientes.length) {
      const c = clientes[iCliente++];
      return { clienteId: c.id, nombre: `${c.nombre} ${c.apellidos ?? ""}`.trim(), telefono: c.telefono, email: c.email, alergias: c.alergias };
    }
    return { clienteId: null, nombre: NOMBRES_SUELTOS[iSuelto++ % NOMBRES_SUELTOS.length], telefono: `+34699${String(100000 + iSuelto * 3157).slice(0, 6)}`, email: null, alergias: null };
  };

  for (const [codigo, plano] of Object.entries(PLANOS)) {
    const centroId = ctx.centros[codigo];
    if (!centroId) continue;
    await prisma.reservaAjustes.create({ data: { tenantId: t, centroId, grupoMaximo: plano.grupoMaximo, antelacionMinutos: 120, duracionPorPersonas: { "2": 90, "4": 105, "8": 120, "16": 150 } } });
    await prisma.reservaTurno.createMany({
      data: [
        { tenantId: t, centroId, nombre: "Comida", dias: [1, 2, 3, 4, 5, 6, 7], horaInicio: "13:00", horaFin: "15:30", duracionMin: 105, intervaloMin: 15, maxCubiertosFranja: 24 },
        { tenantId: t, centroId, nombre: "Cena", dias: codigo === "PU-CHA" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7], horaInicio: "20:00", horaFin: "23:00", duracionMin: 120, intervaloMin: 15, maxCubiertosFranja: 30 },
      ],
    });

    // Espacios y mesas
    const mesas: { id: string; espacioId: string; tipo: string; min: number; max: number }[] = [];
    for (const [orden, e] of plano.espacios.entries()) {
      const esp = await prisma.reservaEspacio.create({ data: { tenantId: t, centroId, nombre: e.nombre, tipo: e.tipo, aforo: e.aforo, ancho: e.ancho, alto: e.alto, orden } });
      for (const m of e.mesas) {
        const forma = m.forma ?? "CUADRADA";
        const tam = forma === "RECTANGULAR" ? { ancho: m.max > 10 ? 200 : 140, alto: 70 } : m.max > 4 ? { ancho: 80, alto: 80 } : { ancho: 60, alto: 60 };
        const creada = await prisma.reservaMesa.create({
          data: {
            tenantId: t, centroId, espacioId: esp.id, nombre: m.nombre, capacidadMin: m.min, capacidadMax: m.max, x: m.x, y: m.y, forma, ...tam,
            combinable: m.combinable ?? false, reservableInternet: m.internet ?? true, especial: m.especial ?? null,
          },
        });
        mesas.push({ id: creada.id, espacioId: esp.id, tipo: e.tipo, min: m.min, max: m.max });
      }
    }

    // Reservas de hoy y mañana
    const ocupacion = new Map<string, [number, number][]>(); // mesa+día → intervalos
    const libre = (dia: string, mesaId: string, ini: number, fin: number) => !(ocupacion.get(`${dia}|${mesaId}`) ?? []).some(([a, b]) => a < fin && ini < b);
    const ocupar = (dia: string, mesaId: string, ini: number, fin: number) => ocupacion.set(`${dia}|${mesaId}`, [...(ocupacion.get(`${dia}|${mesaId}`) ?? []), [ini, fin]]);

    const plan: [number, string, number, string?][] = [
      // [día (0 hoy, 1 mañana), hora, personas, estado]
      [0, "13:30", 2, "TERMINADA"], [0, "13:30", 4, "TERMINADA"], [0, "14:00", 3, "TERMINADA"], [0, "14:00", 2, "NO_PRESENTADA"], [0, "14:15", 6, "TERMINADA"],
      [0, "14:30", 2, "TERMINADA"], [0, "14:45", 5, "SENTADA"], [0, "20:30", 2, "CONFIRMADA"], [0, "20:30", 4, "CONFIRMADA"], [0, "21:00", 2, "LLEGADA"],
      [0, "21:00", 8, "CONFIRMADA"], [0, "21:15", 2, "SOLICITADA"], [0, "21:30", 4, "CONFIRMADA"], [0, "21:30", 3, "CANCELADA"], [0, "21:45", 2, "CONFIRMADA"],
      [0, "22:00", 6, "CONFIRMADA"],
      [1, "13:30", 4, "CONFIRMADA"], [1, "14:00", 2, "CONFIRMADA"], [1, "14:00", 7, "CONFIRMADA"], [1, "14:30", 2, "CONFIRMADA"], [1, "21:00", 2, "CONFIRMADA"],
      [1, "21:00", 4, "CONFIRMADA"], [1, "21:30", 10, "CONFIRMADA"], [1, "21:30", 2, "SOLICITADA"], [1, "22:00", 4, "CONFIRMADA"],
    ];
    const ORIGENES = ["COVERMANAGER", "COVERMANAGER", "TELEFONO", "WEB", "MANUAL"] as const;
    for (const [i, [d, hora, personas, estado = "CONFIRMADA"]] of plan.entries()) {
      const dia = hoyMadrid(d);
      const duracion = personas <= 2 ? 90 : personas <= 4 ? 105 : personas <= 8 ? 120 : 150;
      const ini = aMin(hora);
      const fin = ini + duracion;
      const candidatas = mesas
        .filter((m) => m.min <= personas && personas <= m.max && m.tipo !== "BARRA" && libre(dia, m.id, ini, fin))
        .sort((a, b) => a.max - b.max);
      const mesa = estado === "CANCELADA" ? null : candidatas[0] ?? null;
      if (mesa && estado !== "NO_PRESENTADA") ocupar(dia, mesa.id, ini, fin);
      const cli = siguienteCliente();
      // Historial: alta y los pasos hasta el estado actual
      const pasos: Record<string, string[]> = { LLEGADA: ["LLEGADA"], SENTADA: ["LLEGADA", "SENTADA"], TERMINADA: ["SENTADA", "TERMINADA"], NO_PRESENTADA: ["NO_PRESENTADA"], CANCELADA: ["CANCELADA"] };
      let anterior = estado === "SOLICITADA" ? "SOLICITADA" : "CONFIRMADA";
      const hist = [{ desde: null as string | null, hasta: anterior }];
      for (const p of pasos[estado] ?? []) {
        hist.push({ desde: anterior, hasta: p });
        anterior = p;
      }
      await prisma.reserva.create({
        data: {
          tenantId: t, centroId, clienteId: cli.clienteId, nombre: cli.nombre, telefono: cli.telefono, email: cli.email, personas,
          fecha: new Date(`${dia}T00:00:00.000Z`), hora, duracionMin: duracion, estado: estado as never, origen: ORIGENES[i % ORIGENES.length],
          alergias: cli.alergias, notas: i % 5 === 0 ? "Celebran un cumpleaños" : i % 7 === 0 ? "Traen carrito de bebé" : null,
          externoId: ORIGENES[i % ORIGENES.length] === "COVERMANAGER" ? `CM-${100000 + i}` : null,
          mesas: mesa ? { create: [{ mesaId: mesa.id }] } : undefined,
          historial: { create: hist.map((h) => ({ desde: h.desde as never, hasta: h.hasta as never })) },
        },
      });
    }
  }
};
