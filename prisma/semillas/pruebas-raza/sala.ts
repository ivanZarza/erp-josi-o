/**
 * Parte «sala» del local Raza Pruebas (RZ-PRU): Reservas, Clientes, Eventos y Calidad.
 *
 * - Reservas: plano (salón, terraza, reservado «La Cava», barra), turnos de comida y cena (también fin
 *   de semana), ajustes y reservas de 8 semanas atrás y 4 adelante (más jueves a sábado), con estados,
 *   orígenes, notas, mesas asignadas e historial.
 * - Clientes: unos 300 inventados (habituales, empresas, turistas, ocasionales) con consentimientos,
 *   visitas enlazadas a las reservas terminadas, encuestas y tarjetas regalo con movimientos.
 * - Eventos: los 3 menús de Navidad reales de Raza (ctx.carta.menus), solicitudes de grupo en todos
 *   los estados, presupuestos con líneas (alguno con segunda versión) e historial.
 * - Calidad: equipos de frío con lecturas mañana y tarde 8 semanas, listas APPCC firmadas a diario
 *   (con fallos e incidencias), incidencias a mano y mantenimiento preventivo (alguno vencido).
 *
 * Todo se busca por código o nombre y se inserta por lotes (createMany). Datos inventados salvo los
 * menús de Navidad. Cada bloque se salta si ya está cargado (se puede repetir sin duplicar).
 */
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../../src/generated/prisma/client";
import type { ContextoPruebas } from "./contexto";

// ---------------------------------------------------------------- utilidades

const DIA_MS = 86_400_000;
const nuevoId = () => randomUUID();

/** Pseudoaleatorio con semilla fija: siempre los mismos datos. */
function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const textoDia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const fechaDia = (s: string) => new Date(`${s}T00:00:00.000Z`);
const sumarDias = (s: string, n: number) => new Date(fechaDia(s).getTime() + n * DIA_MS).toISOString().slice(0, 10);
/** 1 = lunes … 7 = domingo */
const diaSemana = (s: string) => ((fechaDia(s).getUTCDay() + 6) % 7) + 1;
const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const deMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

/** Minutos de diferencia de Madrid con UTC en ese instante (60 en invierno, 120 en verano). */
function desfaseMadrid(d: Date) {
  const v = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = v.match(/GMT([+-]\d+)/);
  return m ? Number(m[1]) * 60 : 60;
}
/** Instante real de «día a la hora tal» en Madrid (admite minutos > 24 h para pasar de medianoche). */
function enMadrid(dia: string, minutos: number) {
  const base = fechaDia(dia).getTime() + minutos * 60_000;
  return new Date(base - desfaseMadrid(new Date(base)) * 60_000);
}

async function enLotes<T>(filas: T[], crear: (lote: T[]) => Promise<unknown>, tam = 1000) {
  for (let i = 0; i < filas.length; i += tam) await crear(filas.slice(i, i + tam));
}

/** Reserva N números seguidos de una serie (mismo formato que src/kernel/numeracion.ts). */
async function reservarNumeros(prisma: PrismaClient, tenantId: string, serie: string, n: number) {
  if (n === 0) return [];
  const anio = new Date().getFullYear();
  const c = await prisma.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: n },
    update: { valor: { increment: n } },
  });
  const primero = c.valor - n + 1;
  return Array.from({ length: n }, (_, i) => `${serie}-${anio}-${String(primero + i).padStart(6, "0")}`);
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// ---------------------------------------------------------------- personas del local

type Personas = { gerente: string; gerenteUsuarioId: string | null; cocina: string; sala: string; ayudante: string };

/** Nombres del personal de RZ-PRU (parte «personal») o, si aún no hay, unos inventados. */
async function personasDelLocal(prisma: PrismaClient, tenantId: string, centroId: string): Promise<Personas> {
  const empleados = await prisma.empleado.findMany({
    where: { tenantId, activo: true, OR: [{ centroPrincipalId: centroId }, { centros: { some: { centroId } } }] },
    include: { puesto: true },
  });
  const buscar = (re: RegExp) => empleados.find((e) => re.test(e.puesto?.nombre ?? ""));
  const nombre = (e?: { nombre: string; apellidos: string }) => (e ? `${e.nombre} ${e.apellidos.split(" ")[0]}` : null);
  const ger = buscar(/gerent|encargad|direct/i);
  return {
    gerente: nombre(ger) ?? "Marcos Villalba (gerente)",
    gerenteUsuarioId: ger?.usuarioId ?? null,
    cocina: nombre(buscar(/jefe de cocina|chef|jefa de cocina/i)) ?? "Lucía Herranz (jefa de cocina)",
    sala: nombre(buscar(/sala|ma[iî]tre|hostess|recepci/i)) ?? "Andrea Piñeiro (jefa de sala)",
    ayudante: nombre(buscar(/parrill|cociner|ayudante/i)) ?? "Iker Sanz (parrillero)",
  };
}

// ================================================================ PLANO, TURNOS Y AJUSTES

type MesaPlano = { nombre: string; min: number; max: number; x: number; y: number; forma?: "CUADRADA" | "REDONDA" | "RECTANGULAR"; combinable?: boolean; internet?: boolean; especial?: string };
type EspacioPlano = { clave: "SALON" | "TERRAZA" | "RESERVADO" | "BARRA"; nombre: string; tipo: "SALA" | "TERRAZA" | "RESERVADO" | "BARRA"; aforo: number; ancho: number; alto: number; mesas: MesaPlano[] };

function rejilla(desde: number, filas: number, cols: number, x0: number, y0: number, d: number, cap: [number, number], extra: Partial<MesaPlano> = {}): MesaPlano[] {
  const l: MesaPlano[] = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) l.push({ nombre: String(desde + f * cols + c), min: cap[0], max: cap[1], x: x0 + c * d, y: y0 + f * d, ...extra });
  return l;
}

const PLANO: EspacioPlano[] = [
  {
    clave: "SALON", nombre: "Salón principal", tipo: "SALA", aforo: 64, ancho: 900, alto: 520,
    mesas: [
      ...rejilla(1, 3, 4, 30, 30, 110, [2, 4], { combinable: true }),
      { nombre: "13", min: 4, max: 6, x: 500, y: 40, forma: "REDONDA" },
      { nombre: "14", min: 4, max: 6, x: 620, y: 40, forma: "REDONDA" },
      { nombre: "15", min: 4, max: 6, x: 500, y: 170, forma: "REDONDA" },
      { nombre: "16", min: 2, max: 2, x: 780, y: 40, especial: "Ventana" },
      { nombre: "17", min: 6, max: 8, x: 480, y: 330, forma: "RECTANGULAR", combinable: true },
      { nombre: "18", min: 6, max: 8, x: 680, y: 330, forma: "RECTANGULAR", combinable: true },
    ],
  },
  {
    clave: "TERRAZA", nombre: "Terraza (con estufas)", tipo: "TERRAZA", aforo: 32, ancho: 760, alto: 280,
    mesas: rejilla(31, 2, 4, 40, 40, 150, [2, 4], { forma: "REDONDA", combinable: true }),
  },
  {
    clave: "RESERVADO", nombre: "Reservado La Cava", tipo: "RESERVADO", aforo: 18, ancho: 440, alto: 280,
    mesas: [{ nombre: "R1", min: 8, max: 18, x: 90, y: 100, forma: "RECTANGULAR", internet: false, especial: "Reservado completo, junto a la cámara de maduración acristalada" }],
  },
  {
    clave: "BARRA", nombre: "Barra", tipo: "BARRA", aforo: 10, ancho: 640, alto: 160,
    mesas: [...rejilla(41, 1, 4, 30, 50, 120, [1, 2], { internet: false }), { nombre: "45", min: 2, max: 4, x: 520, y: 40, especial: "Mesa alta" }],
  },
];

type Turno = { nombre: string; dias: number[]; ini: string; fin: string; duracion: number; max: number; comida: boolean };
const TURNOS: Turno[] = [
  { nombre: "Comida (lunes a viernes)", dias: [1, 2, 3, 4, 5], ini: "13:00", fin: "15:30", duracion: 105, max: 22, comida: true },
  { nombre: "Comida (fin de semana)", dias: [6, 7], ini: "13:00", fin: "16:00", duracion: 120, max: 30, comida: true },
  { nombre: "Cena (domingo a jueves)", dias: [7, 1, 2, 3, 4], ini: "20:00", fin: "23:00", duracion: 120, max: 24, comida: false },
  { nombre: "Cena (viernes y sábado)", dias: [5, 6], ini: "20:00", fin: "23:30", duracion: 120, max: 34, comida: false },
];
const DURACION_POR_PERSONAS: Record<string, number> = { "2": 90, "4": 105, "6": 120, "10": 150 };
const duracionPara = (p: number) => (p <= 2 ? 90 : p <= 4 ? 105 : p <= 6 ? 120 : 150);

/** Cubiertos objetivo de cada servicio según el día (1 = lunes). */
const OBJETIVO: Record<"comida" | "cena", number[]> = {
  comida: [0, 34, 40, 46, 56, 70, 104, 96],
  cena: [0, 30, 40, 52, 84, 112, 124, 36],
};

// ================================================================ CLIENTES

const NOMBRES_H = ["Javier", "Carlos", "Álvaro", "Pablo", "Diego", "Jorge", "Alejandro", "Sergio", "Daniel", "Fernando", "Ignacio", "Rodrigo", "Gonzalo", "Miguel", "Luis", "Andrés", "Íñigo", "Borja", "Marcos", "Rubén"];
const NOMBRES_M = ["Lucía", "María", "Carmen", "Paula", "Laura", "Marta", "Elena", "Sara", "Cristina", "Ana", "Beatriz", "Patricia", "Irene", "Natalia", "Raquel", "Nuria", "Silvia", "Teresa", "Rocío", "Blanca"];
const APELLIDOS = ["García", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Alonso", "Navarro", "Torres", "Domínguez", "Gil", "Vázquez", "Serrano", "Ramos", "Blanco", "Molina", "Morales", "Suárez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín", "Sanz", "Iglesias", "Medina", "Garrido", "Cortés", "Castillo", "Lozano", "Guerrero", "Cano", "Prieto", "Méndez", "Calvo", "Cruz", "Gallego", "Vidal", "León"];
const EMPRESAS: [string, string][] = [
  ["Lumbre Consultores S.L.", "lumbreconsultores"], ["Abogados Recoletos", "recoletosabogados"], ["Nexo Ingeniería S.A.", "nexoingenieria"], ["Grupo Tasman", "grupotasman"],
  ["Clínica Dental Arturo Soria", "dentalarturosoria"], ["Farmalíder Ventas", "farmalider"], ["Seguros Alcalá", "segurosalcala"], ["Constructora Hnos. Ayuso", "ayusoconstruye"],
  ["Inmobiliaria Castellana 80", "castellana80"], ["Bodegas Pesquera (distribución Madrid)", "pesqueramadrid"], ["Auditores Serrano & Cía.", "auditoresserrano"], ["Agencia Brío Comunicación", "agenciabrio"],
  ["Tecnologías Duero", "tecduero"], ["Notaría de Goya", "notariagoya"], ["Arquitectos Velarde", "velardearq"], ["Logística Henares", "logihenares"],
  ["Fondo Atalaya Capital", "atalayacapital"], ["Editorial Malasaña", "editorialmalasana"], ["Hospital Veterinario Retiro", "vetretiro"], ["Asesoría Prado Fiscal", "pradofiscal"],
];
const TURISTAS: [string, string, string, string][] = [
  // nombre, apellidos, idioma, prefijo
  ["John", "Smith", "en", "+447700"], ["Emily", "Clarke", "en", "+447711"], ["Oliver", "Brown", "en", "+447722"], ["Sophie", "Taylor", "en", "+447733"],
  ["Michael", "Johnson", "en", "+1212555"], ["Jennifer", "Davis", "en", "+1305555"], ["Chris", "Miller", "en", "+1415555"], ["Ashley", "Wilson", "en", "+1617555"],
  ["Camille", "Dubois", "fr", "+336120"], ["Julien", "Moreau", "fr", "+336130"], ["Léa", "Laurent", "fr", "+336140"], ["Thomas", "Bernard", "fr", "+336150"],
  ["Lukas", "Müller", "de", "+491512"], ["Anna", "Schmidt", "de", "+491522"], ["Felix", "Weber", "de", "+491532"], ["Giulia", "Rossi", "it", "+393331"],
  ["Marco", "Bianchi", "it", "+393341"], ["Francesca", "Romano", "it", "+393351"], ["Santiago", "Pereyra", "es", "+54911"], ["Valentina", "Gómez Paz", "es", "+52155"],
  ["Mateo", "Fernández Ríos", "es", "+56912"], ["João", "Silva", "pt", "+351912"], ["Beatriz", "Costa", "pt", "+351922"], ["Hiroshi", "Tanaka", "en", "+8190"],
];
const ALERGIAS = ["Celíaco", "Intolerante a la lactosa", "Alergia a frutos secos", "Alergia al marisco", "Alergia al huevo", "Alergia a la mostaza"];
const PREFERENCIAS = [
  "Carne al punto menos", "Chuletón vuelta y vuelta", "Mesa 16 (ventana) si está libre", "Siempre terraza, aunque haga frío", "Tinto de Ribera, le gusta Pesquera",
  "Mesa tranquila, lejos de la barra", "Pide la cámara de maduración para enseñarla a sus invitados", "Agua con gas Vichy", "Le gusta sentarse en barra",
  "Bife de chorizo poco hecho y patatas sin sal", "Prefiere servicio rápido a mediodía (comidas de trabajo)",
];

type TipoCliente = "HABITUAL" | "VIP" | "EMPRESA" | "TURISTA" | "OCASIONAL" | "EVENTO" | "UNA_VISITA";
type ClienteGen = {
  id: string; tipo: TipoCliente; nombre: string; apellidos: string; telefono: string; email: string | null; idioma: string;
  fechaNacimiento: Date | null; alergias: string | null; preferencias: string | null; notas: string | null; etiquetas: string[];
  origen: string; createdAt: Date; usos: number; maxUsos: number; peso: number; visitas: number; ultimaVisita: Date | null; ultimoDia?: string;
};

// ================================================================ ENCUESTAS

const COMENTARIOS: Record<number, string[]> = {
  5: [
    "El lomo bajo de rubia gallega, espectacular. Volveremos seguro.",
    "Trato de diez y la carne en su punto exacto. La tarta de queso con dulce de leche, imprescindible.",
    "Nos enseñaron la cámara de maduración, un detalle. Todo perfecto.",
    "Celebramos el cumpleaños de mi mujer y nos sacaron la tarta con vela. Gracias.",
    "Gran carta de vinos y el camarero nos recomendó muy bien.",
    null as unknown as string,
  ],
  4: [
    "Muy buena carne, aunque tardaron un poco en traer los principales.",
    "Todo muy rico. El ruido a la hora de la cena es alto.",
    "Buena relación calidad-precio para la calidad de la carne.",
    "Bien en general; las patatas llegaron algo frías.",
    null as unknown as string,
  ],
  3: ["La carne buena pero el servicio desbordado. Esperamos 25 minutos el postre.", "Correcto, sin más. Esperaba más del chuletón madurado por el precio.", "Mesa pegada a la puerta, mucho frío cada vez que entraba alguien."],
  2: ["Pedimos el bife al punto y llegó muy hecho. Lo cambiaron pero tardaron mucho.", "Nos dieron la mesa 20 minutos tarde teniendo reserva.", "Precio alto para lo que es; el vino por copa servido caliente."],
  1: ["Muy mala experiencia: cobro de pan y agua que no pedimos y nadie nos atendió la queja.", "Reservamos terraza y nos sentaron dentro sin avisar. No volveremos."],
};
const SEGUIMIENTOS = [
  "Llamada del gerente: se disculpa y le invita a una botella de vino en su próxima visita.",
  "Se habla con el equipo de parrilla sobre los puntos de la carne. Cliente contesta agradecido.",
  "Se revisa la nota: el pan y el agua sí se cobran (carta). Se le explica y se le ofrece un postre en la próxima visita.",
];

// ================================================================ FUNCIÓN PRINCIPAL

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const centroId = ctx.centroPruebas;
  const personas = await personasDelLocal(prisma, ctx.tenantId, centroId);
  if ((await prisma.reservaEspacio.count({ where: { tenantId: ctx.tenantId, centroId } })) === 0) await sembrarReservasYClientes(prisma, ctx, personas);
  else console.log("  sala: reservas y clientes ya cargados, se saltan");
  if ((await prisma.calidadEquipo.count({ where: { tenantId: ctx.tenantId, centroId } })) === 0) await sembrarCalidad(prisma, ctx, personas);
  else console.log("  sala: calidad ya cargada, se salta");
}

// ================================================================ RESERVAS, CLIENTES Y EVENTOS

async function sembrarReservasYClientes(prisma: PrismaClient, ctx: ContextoPruebas, gente: Personas) {
  const t = ctx.tenantId;
  const centroId = ctx.centroPruebas;
  const r = azar(7319);
  const elegir = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
  const ahora = ctx.hoy;
  const hoy = textoDia(ahora);
  const ahoraMin = aMin(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(ahora));
  const marcaRaza = ctx.marcas.RAZA ?? null;

  // ------------------------------------------------------------ plano
  await prisma.reservaAjustes.upsert({
    where: { centroId },
    create: { tenantId: t, centroId, grupoMaximo: 10, antelacionMinutos: 120, elegirMesaInternet: false, duracionPorPersonas: DURACION_POR_PERSONAS },
    update: { grupoMaximo: 10, antelacionMinutos: 120, duracionPorPersonas: DURACION_POR_PERSONAS },
  });
  await prisma.reservaTurno.createMany({
    data: TURNOS.map((x) => ({ tenantId: t, centroId, nombre: x.nombre, dias: x.dias, horaInicio: x.ini, horaFin: x.fin, duracionMin: x.duracion, intervaloMin: 15, maxCubiertosFranja: x.max })),
  });
  type Mesa = { id: string; nombre: string; espacio: EspacioPlano["clave"]; espacioId: string; min: number; max: number; combinable: boolean };
  const mesas: Mesa[] = [];
  const espacioId: Record<string, string> = {};
  const filasEspacio: Prisma.ReservaEspacioCreateManyInput[] = [];
  const filasMesa: Prisma.ReservaMesaCreateManyInput[] = [];
  for (const [orden, e] of PLANO.entries()) {
    const id = nuevoId();
    espacioId[e.clave] = id;
    filasEspacio.push({ id, tenantId: t, centroId, nombre: e.nombre, tipo: e.tipo, aforo: e.aforo, ancho: e.ancho, alto: e.alto, orden });
    for (const m of e.mesas) {
      const forma = m.forma ?? "CUADRADA";
      const tam = forma === "RECTANGULAR" ? { ancho: m.max > 10 ? 220 : 150, alto: 70 } : m.max > 4 ? { ancho: 80, alto: 80 } : { ancho: 60, alto: 60 };
      const mid = nuevoId();
      filasMesa.push({
        id: mid, tenantId: t, centroId, espacioId: id, nombre: m.nombre, capacidadMin: m.min, capacidadMax: m.max, x: m.x, y: m.y, forma, ...tam,
        combinable: m.combinable ?? false, reservableInternet: m.internet ?? true, especial: m.especial ?? null,
      });
      mesas.push({ id: mid, nombre: m.nombre, espacio: e.clave, espacioId: id, min: m.min, max: m.max, combinable: m.combinable ?? false });
    }
  }
  await prisma.reservaEspacio.createMany({ data: filasEspacio });
  await prisma.reservaMesa.createMany({ data: filasMesa });
  const mesaPorNombre = Object.fromEntries(mesas.map((m) => [m.nombre, m]));

  // ------------------------------------------------------------ clientes
  const clientes: ClienteGen[] = [];
  const telefonosUsados = new Set(
    (await prisma.cliente.findMany({ where: { tenantId: t, telefono: { not: null } }, select: { telefono: true } })).map((c) => c.telefono!),
  );
  let nTel = 0;
  const telefonoEs = () => {
    let tel: string;
    do tel = `+3471${String(1_000_000 + nTel++ * 3011).padStart(7, "0")}`;
    while (telefonosUsados.has(tel));
    telefonosUsados.add(tel);
    return tel;
  };
  const altaHace = (min: number, max: number) => new Date(ahora.getTime() - (min + Math.floor(r() * (max - min))) * DIA_MS - Math.floor(r() * 10) * 3_600_000);
  const nuevoCliente = (c: Partial<ClienteGen> & Pick<ClienteGen, "tipo" | "nombre" | "apellidos">): ClienteGen => {
    const cli: ClienteGen = {
      id: nuevoId(), telefono: telefonoEs(), email: null, idioma: "es", fechaNacimiento: null, alergias: null, preferencias: null, notas: null,
      etiquetas: [], origen: "RESERVA", createdAt: altaHace(60, 700), usos: 0, maxUsos: 99, peso: 1, visitas: 0, ultimaVisita: null, ...c,
    };
    clientes.push(cli);
    return cli;
  };
  const personaAzar = (i: number) => {
    const mujer = r() < 0.5;
    const nombre = mujer ? NOMBRES_M[(i * 7 + Math.floor(r() * 20)) % 20] : NOMBRES_H[(i * 11 + Math.floor(r() * 20)) % 20];
    const apellidos = `${APELLIDOS[Math.floor(r() * APELLIDOS.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]}`;
    return { nombre, apellidos };
  };
  const emailDe = (nombre: string, apellidos: string, i: number) => `${sinTildes(nombre)}.${sinTildes(apellidos.split(" ")[0])}${i}@correo-ejemplo.es`;
  const nacimiento = () => new Date(Date.UTC(1958 + Math.floor(r() * 45), Math.floor(r() * 12), 1 + Math.floor(r() * 28)));

  // Contactos de los eventos (se crean como clientes, igual que hace el módulo Eventos)
  const contactosEvento: Record<string, ClienteGen> = {};
  const CONTACTOS: [clave: string, nombre: string, apellidos: string, empresa: number | null][] = [
    ["lumbre", "Raquel", "Benítez Soto", 0], ["recoletos", "Álvaro", "Iturbe Maldonado", 1], ["nexo", "Marina", "Soler Pons", 2], ["tasman", "Fernando", "Lara Quintana", 3],
    ["dental", "Begoña", "Arrieta Gil", 4], ["farma", "Óscar", "Peña Ruiz", 5], ["seguros", "Elena", "Prados Vela", 6], ["ayuso", "Tomás", "Ayuso Herrero", 7],
    ["vecinos", "Pilar", "Cano Méndez", null], ["marta", "Marta", "Llorente Vidal", null], ["boda", "Clara", "Ibáñez Roca", null], ["bautizo", "Gonzalo", "Prieto Arias", null],
    ["despedida", "Hugo", "Calvo Sanz", null], ["grupoweb", "Lorena", "Méndez Ortiz", null], ["pesquera", "Ricardo", "Fuentes Lago", 9], ["finca", "Sonia", "Robles Marco", 15],
  ];
  for (const [i, [clave, nombre, apellidos, emp]] of CONTACTOS.entries()) {
    const empresa = emp !== null ? EMPRESAS[emp] : null;
    contactosEvento[clave] = nuevoCliente({
      tipo: "EVENTO", nombre, apellidos, origen: "EVENTO", createdAt: altaHace(20, 120), maxUsos: 2, peso: 0.5,
      email: empresa ? `${sinTildes(nombre)}.${sinTildes(apellidos.split(" ")[0])}@${empresa[1]}.example` : emailDe(nombre, apellidos, 900 + i),
      etiquetas: empresa ? ["Empresa", "Eventos"] : ["Eventos"],
      notas: empresa ? `Empresa: ${empresa[0]}. Pide factura a nombre de la empresa.` : null,
    });
  }
  // VIP y habituales del barrio
  for (let i = 0; i < 70; i++) {
    const { nombre, apellidos } = personaAzar(i);
    const vip = i < 16;
    nuevoCliente({
      tipo: vip ? "VIP" : "HABITUAL", nombre, apellidos, email: r() < 0.92 ? emailDe(nombre, apellidos, i) : null,
      fechaNacimiento: r() < 0.6 ? nacimiento() : null, alergias: r() < 0.12 ? elegir(ALERGIAS) : null, preferencias: r() < 0.6 ? elegir(PREFERENCIAS) : null,
      notas: vip ? elegir(["Amigo de la propiedad: avisar al gerente cuando reserve", "Socio de una empresa cliente; suele invitar", "Cliente desde la apertura; conoce al jefe de parrilla"]) : r() < 0.2 ? "Viene con su pareja los viernes" : null,
      etiquetas: vip ? ["VIP", "Habitual"] : ["Habitual"], origen: r() < 0.5 ? "COVERMANAGER" : "RESERVA", createdAt: altaHace(200, 900), peso: vip ? 9 : 5, maxUsos: vip ? 12 : 7,
    });
  }
  // Empresas (comidas de trabajo entre semana)
  for (let i = 0; i < 48; i++) {
    const { nombre, apellidos } = personaAzar(100 + i);
    const [empresa, dominio] = EMPRESAS[i % EMPRESAS.length];
    nuevoCliente({
      tipo: "EMPRESA", nombre, apellidos, email: `${sinTildes(nombre)}.${sinTildes(apellidos.split(" ")[0])}@${dominio}.example`,
      notas: `Empresa: ${empresa}.${r() < 0.5 ? " Pide factura a nombre de la empresa." : ""}`, preferencias: r() < 0.4 ? "Prefiere servicio rápido a mediodía (comidas de trabajo)" : null,
      etiquetas: ["Empresa"], origen: r() < 0.5 ? "TELEFONO" : "RESERVA", createdAt: altaHace(60, 600), peso: 3, maxUsos: 8,
    });
  }
  // Turistas (una visita, sobre todo fin de semana)
  for (let i = 0; i < 72; i++) {
    const [nombre, apellidos, idioma, prefijo] = TURISTAS[i % TURISTAS.length];
    const tel = `${prefijo}${String(100000 + i * 7717).slice(0, 6)}`;
    telefonosUsados.add(tel);
    nuevoCliente({
      tipo: "TURISTA", nombre, apellidos: i >= TURISTAS.length ? `${apellidos} (${i})`.replace(/ \(\d+\)$/, "") : apellidos, telefono: tel, idioma,
      email: `${sinTildes(nombre)}.${sinTildes(apellidos)}${i}@mail-example.com`, etiquetas: ["Turista"], origen: r() < 0.7 ? "COVERMANAGER" : "WEB",
      createdAt: altaHace(0, 50), maxUsos: 1, peso: 1.2, alergias: r() < 0.08 ? elegir(ALERGIAS) : null,
      notas: idioma !== "es" ? `Habla ${({ en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués" } as Record<string, string>)[idioma]}; carta en su idioma` : null,
    });
  }
  // Ocasionales hasta llegar a ~300
  for (let i = 0; clientes.length < 300; i++) {
    const { nombre, apellidos } = personaAzar(300 + i);
    nuevoCliente({
      tipo: "OCASIONAL", nombre, apellidos, email: r() < 0.8 ? emailDe(nombre, apellidos, 300 + i) : null, fechaNacimiento: r() < 0.25 ? nacimiento() : null,
      alergias: r() < 0.07 ? elegir(ALERGIAS) : null, origen: elegir(["RESERVA", "COVERMANAGER", "WEB", "TELEFONO"]), createdAt: altaHace(10, 500), maxUsos: 3, peso: 1,
    });
  }
  const fichasCompletas = clientes.length;
  /**
   * Cliente de una reserva: uno de la base (habituales y VIP más a menudo, empresas a mediodía entre
   * semana, turistas en fin de semana), nunca dos veces el mismo día y con un tope por tipo. Si no toca
   * ninguno, se crea un cliente nuevo de una sola visita, como hace el ERP al apuntar la reserva.
   */
  let nUnaVisita = 0;
  const elegirCliente = (dia: string, finDeSemana: boolean, comida: boolean, cuando: Date, origen: string, nuevoSiNoHay = true): ClienteGen | null => {
    const pesoTipo = (c: ClienteGen) =>
      c.tipo === "EMPRESA" ? (comida && !finDeSemana ? c.peso * 2.5 : c.peso * 0.3) : c.tipo === "TURISTA" ? (finDeSemana ? c.peso * 2 : c.peso) : c.peso;
    const lista = clientes.filter(
      (c) => c.usos < c.maxUsos && c.tipo !== "EVENTO" && c.tipo !== "UNA_VISITA" && c.ultimoDia !== dia && (c.tipo !== "TURISTA" || c.createdAt <= cuando) && c.createdAt <= cuando,
    );
    let elegido: ClienteGen | null = null;
    if (lista.length && r() < 0.62) {
      let total = 0;
      for (const c of lista) total += pesoTipo(c);
      let x = r() * total;
      for (const c of lista) {
        x -= pesoTipo(c);
        if (x <= 0) {
          elegido = c;
          break;
        }
      }
      elegido ??= lista[0];
    } else if (nuevoSiNoHay) {
      const i = nUnaVisita++;
      const turista = r() < 0.18;
      const base = turista ? TURISTAS[i % TURISTAS.length] : null;
      const { nombre, apellidos } = base ? { nombre: base[0], apellidos: base[1] } : personaAzar(600 + i);
      let telefono: string | undefined;
      if (base) {
        let k = i;
        do telefono = `${base[3]}${String(200000 + k++ * 6131).slice(0, 6)}`;
        while (telefonosUsados.has(telefono));
        telefonosUsados.add(telefono);
      }
      elegido = nuevoCliente({
        tipo: "UNA_VISITA", nombre, apellidos, idioma: base?.[2] ?? "es", ...(telefono ? { telefono } : {}),
        email: r() < 0.7 ? (base ? `${sinTildes(nombre)}.${sinTildes(apellidos)}${700 + i}@mail-example.com` : emailDe(nombre, apellidos, 700 + i)) : null,
        alergias: r() < 0.05 ? elegir(ALERGIAS) : null, etiquetas: base ? ["Turista"] : [], origen: origen === "MANUAL" ? "RESERVA" : origen,
        createdAt: cuando, maxUsos: 1,
      });
    }
    if (elegido) elegido.ultimoDia = dia;
    return elegido;
  };

  // ------------------------------------------------------------ eventos (antes de las reservas: bloquean el reservado)
  const menusCarta = ctx.carta.menus ?? [];
  type Menu = { id: string; nombre: string; precio: number };
  const menus: Record<string, Menu> = {};
  const yaHayMenus = await prisma.eventoMenu.findMany({ where: { tenantId: t, nombre: { in: menusCarta.map((m) => m.nombre) } } });
  const filasMenu: Prisma.EventoMenuCreateManyInput[] = [];
  for (const m of menusCarta) {
    const existe = yaHayMenus.find((x) => x.nombre === m.nombre);
    const clave = m.nombre.split(" ")[1] ?? m.nombre; // «Origen», «Esencia», «Maduración»
    const precio = m.precio ?? 0;
    if (existe) {
      menus[clave] = { id: existe.id, nombre: existe.nombre, precio: Number(existe.precioPersona) };
      continue;
    }
    // El JSON trae el contenido por secciones ({ seccion, platos[] }); el tipo común dice string[]: se aceptan los dos
    const lineas = (m.contenido as unknown as (string | { seccion: string; platos: string[] })[]).flatMap((x) =>
      typeof x === "string" ? [x] : x.platos.map((p) => `${x.seccion}: ${p}`),
    );
    const notas = (m as unknown as { notas?: string }).notas ?? null;
    const id = nuevoId();
    filasMenu.push({ id, tenantId: t, marcaId: marcaRaza, nombre: m.nombre, precioPersona: precio, iva: 10, minPersonas: 8, descripcion: notas, platos: lineas.join("\n") });
    menus[clave] = { id, nombre: m.nombre, precio };
  }
  if (filasMenu.length) await prisma.eventoMenu.createMany({ data: filasMenu });
  const coctel = await prisma.eventoMenu.findFirst({ where: { tenantId: t, nombre: "Cóctel Navidad" } });

  const anioNav = Number(hoy.slice(0, 4)) + (hoy.slice(5, 10) > "12-20" ? 1 : 0);
  const dic = (d: number) => `${anioNav}-12-${String(d).padStart(2, "0")}`;
  const rel = (n: number) => sumarDias(hoy, n);
  /** Sábado siguiente a «hoy + n días» (la boda). */
  const sabadoTras = (n: number) => {
    let d = rel(n);
    while (diaSemana(d) !== 6) d = sumarDias(d, 1);
    return d;
  };

  type Linea = { menu?: string; menuId?: string; concepto: string; cantidad: number; precio: number };
  type Pres = { estado: "BORRADOR" | "ENVIADO" | "ACEPTADO" | "RECHAZADO"; lineas: Linea[]; senalPct?: number; hace: number; nota?: string };
  type Ev = {
    contacto: string; tipo: "EMPRESA" | "CELEBRACION" | "NAVIDAD" | "CATERING"; estado: "NUEVA" | "CONTACTADA" | "PRESUPUESTO" | "ACEPTADA" | "CELEBRADA" | "PERDIDA";
    empresa?: string; personas: number; dia: string; hora: string; espacio?: "RESERVADO" | "SALON"; mesasEvento?: string[]; origen: string; recibidaHace: number;
    presupuestoCliente?: number; recomiendame?: boolean; notas?: string; motivo?: string; pasos?: [string, string | null][]; presupuestos?: Pres[]; conCentro?: boolean;
  };
  const cava = (n: number): Linea => ({ concepto: "Copa de cava de bienvenida", cantidad: n, precio: 6.5 });
  const EVENTOS: Ev[] = [
    {
      contacto: "lumbre", tipo: "NAVIDAD", estado: "ACEPTADA", empresa: "Lumbre Consultores S.L.", personas: 16, dia: dic(4), hora: "14:00", espacio: "RESERVADO", mesasEvento: ["R1"], origen: "WEB", recibidaHace: 34,
      notas: "Comida de Navidad del equipo. Un celíaco. Quieren pantalla para un vídeo de 5 minutos.",
      pasos: [["CONTACTADA", "Llamada: confirman menú Esencia y reservado"], ["PRESUPUESTO", null], ["ACEPTADA", "Señal del 30 % recibida por transferencia"]],
      presupuestos: [{ estado: "ACEPTADO", lineas: [{ menu: "Esencia", concepto: "", cantidad: 16, precio: 0 }, cava(16)], senalPct: 30, hace: 25 }],
    },
    {
      contacto: "recoletos", tipo: "NAVIDAD", estado: "ACEPTADA", empresa: "Abogados Recoletos", personas: 18, dia: dic(11), hora: "21:00", espacio: "RESERVADO", mesasEvento: ["R1"], origen: "CORREO", recibidaHace: 40,
      notas: "Cena de socios. Facturar a la sociedad. Piden vino de la bodega del menú Maduración también en el aperitivo.",
      pasos: [["CONTACTADA", null], ["PRESUPUESTO", null], ["CONTACTADA", "Rechazan el menú Origen: quieren algo más especial"], ["PRESUPUESTO", null], ["ACEPTADA", "Aceptan la versión 2"]],
      presupuestos: [
        { estado: "RECHAZADO", lineas: [{ menu: "Origen", concepto: "", cantidad: 18, precio: 0 }], senalPct: 30, hace: 33 },
        { estado: "ACEPTADO", lineas: [{ menu: "Maduración", concepto: "", cantidad: 18, precio: 0 }, cava(18), { concepto: "Suplemento: magnum de Marqués de Murrieta Reserva para el brindis", cantidad: 2, precio: 95 }], senalPct: 30, hace: 21 },
      ],
    },
    {
      contacto: "nexo", tipo: "NAVIDAD", estado: "PRESUPUESTO", empresa: "Nexo Ingeniería S.A.", personas: 34, dia: dic(18), hora: "14:00", espacio: "SALON", origen: "CORREO", recibidaHace: 15,
      notas: "Querrían el salón para ellos solos (privatizar media sala). Dos vegetarianos.",
      pasos: [["CONTACTADA", null], ["PRESUPUESTO", null]],
      presupuestos: [{ estado: "ENVIADO", lineas: [{ menu: "Origen", concepto: "", cantidad: 34, precio: 0 }, cava(34), { concepto: "Privatización de media sala (mesas 1 a 12)", cantidad: 1, precio: 300 }], senalPct: 30, hace: 8 }],
    },
    {
      contacto: "dental", tipo: "NAVIDAD", estado: "PRESUPUESTO", empresa: "Clínica Dental Arturo Soria", personas: 12, dia: dic(12), hora: "14:00", espacio: "RESERVADO", origen: "TELEFONO", recibidaHace: 20,
      notas: "Sin respuesta desde que se envió el presupuesto. Llamar.", pasos: [["PRESUPUESTO", null]],
      presupuestos: [{ estado: "ENVIADO", lineas: [{ menu: "Esencia", concepto: "", cantidad: 12, precio: 0 }], senalPct: 30, hace: 12 }],
    },
    {
      contacto: "tasman", tipo: "NAVIDAD", estado: "CONTACTADA", empresa: "Grupo Tasman", personas: 40, dia: dic(17), hora: "21:00", espacio: "SALON", origen: "WEB", recibidaHace: 6, presupuestoCliente: 3200,
      notas: "Quieren DJ y barra libre después de cenar. Preguntar si se puede cerrar el local.", pasos: [["CONTACTADA", "Llamada: piden propuesta con barra libre de 2 horas"]],
      presupuestos: [{ estado: "BORRADOR", lineas: [{ menu: "Origen", concepto: "", cantidad: 40, precio: 0 }, { concepto: "Barra libre 2 horas", cantidad: 40, precio: 22 }, { concepto: "DJ (proveedor externo)", cantidad: 1, precio: 450 }], senalPct: 30, hace: 3 }],
    },
    { contacto: "vecinos", tipo: "NAVIDAD", estado: "NUEVA", empresa: "Asociación de Vecinos Retiro", personas: 22, dia: dic(19), hora: "14:00", origen: "WEB", recibidaHace: 2, presupuestoCliente: 1400, notas: "Preguntan si hay menú por debajo de 65 €." },
    { contacto: "farma", tipo: "NAVIDAD", estado: "NUEVA", empresa: "Farmalíder Ventas", personas: 14, dia: dic(10), hora: "21:30", espacio: "RESERVADO", origen: "CORREO", recibidaHace: 1, notas: "Cena del equipo comercial. Piden el reservado." },
    {
      contacto: "ayuso", tipo: "NAVIDAD", estado: "PERDIDA", empresa: "Constructora Hnos. Ayuso", personas: 45, dia: dic(18), hora: "14:00", origen: "TELEFONO", recibidaHace: 26, presupuestoCliente: 3500,
      motivo: "Sin hueco: querían el salón entero el 18/12 y ya había otra propuesta en curso", pasos: [["CONTACTADA", null], ["PERDIDA", "Sin hueco: querían el salón entero el 18/12 y ya había otra propuesta en curso"]],
    },
    {
      contacto: "seguros", tipo: "NAVIDAD", estado: "PERDIDA", empresa: "Seguros Alcalá", personas: 25, dia: dic(15), hora: "14:00", origen: "WEB", recibidaHace: 30, presupuestoCliente: 1250,
      motivo: "Precio: buscaban un menú de unos 50 €", pasos: [["CONTACTADA", null], ["PRESUPUESTO", null], ["PERDIDA", "Precio: buscaban un menú de unos 50 €"]],
      presupuestos: [{ estado: "RECHAZADO", lineas: [{ menu: "Origen", concepto: "", cantidad: 25, precio: 0 }], senalPct: 30, hace: 24 }],
    },
    {
      contacto: "nexo", tipo: "EMPRESA", estado: "CELEBRADA", empresa: "Nexo Ingeniería S.A.", personas: 14, dia: rel(-20), hora: "14:00", espacio: "RESERVADO", mesasEvento: ["R1"], origen: "TELEFONO", recibidaHace: 45,
      notas: "Comida de cierre de proyecto con el cliente.", pasos: [["PRESUPUESTO", null], ["ACEPTADA", null], ["CELEBRADA", "Todo correcto. Piden repetir en Navidad."]],
      presupuestos: [{ estado: "ACEPTADO", lineas: [{ menu: "Origen", concepto: "", cantidad: 14, precio: 0 }], hace: 38 }],
    },
    {
      contacto: "marta", tipo: "CELEBRACION", estado: "CELEBRADA", personas: 12, dia: rel(-27), hora: "21:30", espacio: "RESERVADO", mesasEvento: ["R1"], origen: "TELEFONO", recibidaHace: 50,
      notas: "50 cumpleaños. Traen su tarta: servicio de corte.", pasos: [["CONTACTADA", null], ["PRESUPUESTO", null], ["ACEPTADA", null], ["CELEBRADA", null]],
      presupuestos: [{ estado: "ACEPTADO", lineas: [{ menu: "Origen", concepto: "", cantidad: 12, precio: 0 }, { concepto: "Servicio de corte de tarta propia", cantidad: 12, precio: 3 }], senalPct: 20, hace: 44 }],
    },
    {
      contacto: "boda", tipo: "CELEBRACION", estado: "ACEPTADA", personas: 18, dia: sabadoTras(12), hora: "14:00", espacio: "RESERVADO", mesasEvento: ["R1"], origen: "CORREO", recibidaHace: 62,
      notas: "Boda civil de Clara y Javier: comida en el reservado. Llegan a las 13:30 del juzgado. Dos vegetarianos y un celíaco. Tarta nupcial de su pastelería.",
      pasos: [["CONTACTADA", "Visita al reservado con los novios"], ["PRESUPUESTO", null], ["CONTACTADA", "Piden añadir barra libre y flores"], ["PRESUPUESTO", null], ["ACEPTADA", "Señal del 40 % pagada"]],
      presupuestos: [
        { estado: "RECHAZADO", lineas: [{ menu: "Maduración", concepto: "", cantidad: 18, precio: 0 }, cava(18)], senalPct: 40, hace: 55 },
        {
          estado: "ACEPTADO", senalPct: 40, hace: 41,
          lineas: [
            { menu: "Maduración", concepto: "", cantidad: 18, precio: 0 }, cava(18), { concepto: "Servicio de corte de tarta nupcial", cantidad: 18, precio: 2.5 },
            { concepto: "Barra libre 1 hora", cantidad: 18, precio: 18 }, { concepto: "Centro de flores y minutas personalizadas", cantidad: 1, precio: 160 },
          ],
        },
      ],
    },
    { contacto: "bautizo", tipo: "CELEBRACION", estado: "NUEVA", personas: 20, dia: sabadoTras(36), hora: "14:00", origen: "TELEFONO", recibidaHace: 0, notas: "Bautizo. 4 niños: preguntan por menú infantil." },
    {
      contacto: "despedida", tipo: "CELEBRACION", estado: "PERDIDA", personas: 15, dia: rel(9), hora: "22:00", origen: "WEB", recibidaHace: 11,
      motivo: "Piden barra libre hasta el cierre y espectáculo: no encaja en el local", pasos: [["PERDIDA", "Piden barra libre hasta el cierre y espectáculo: no encaja en el local"]],
    },
    {
      contacto: "grupoweb", tipo: "CELEBRACION", estado: "ACEPTADA", personas: 12, dia: rel(6), hora: "21:00", espacio: "SALON", mesasEvento: ["17", "18"], origen: "RESERVA", recibidaHace: 9,
      notas: "Reserva web de 12 personas pasada a Eventos. Comerán a la carta (sin menú cerrado).", pasos: [["CONTACTADA", "Se les juntan las mesas 17 y 18 del salón"], ["ACEPTADA", "Sin señal: comen a la carta"]],
    },
    {
      contacto: "pesquera", tipo: "EMPRESA", estado: "CONTACTADA", empresa: "Bodegas Pesquera (distribución Madrid)", personas: 30, dia: rel(19), hora: "20:00", espacio: "SALON", origen: "CORREO", recibidaHace: 7,
      notas: "Cata de vinos con cóctel de pie para clientes de hostelería.", pasos: [["CONTACTADA", null]],
      presupuestos: coctel ? [{ estado: "BORRADOR", lineas: [{ menuId: coctel.id, concepto: `Menú «${coctel.nombre}»`, cantidad: 30, precio: Number(coctel.precioPersona) }, { concepto: "Descorche (el vino lo pone la bodega)", cantidad: 30, precio: 4 }], hace: 2 }] : undefined,
    },
    {
      contacto: "finca", tipo: "CATERING", estado: "NUEVA", empresa: "Logística Henares", personas: 60, dia: rel(26), hora: "14:00", origen: "WEB", recibidaHace: 3, recomiendame: true, conCentro: false,
      notas: "Parrillada en su nave de Alcalá para la plantilla. Preguntan si Raza hace catering con parrilla móvil.",
    },
  ];

  // Ocupación de mesas y de franjas (para no solapar)
  const ocupacion = new Map<string, [number, number][]>();
  const libre = (dia: string, mesaId: string, ini: number, fin: number) => !(ocupacion.get(`${dia}|${mesaId}`) ?? []).some(([a, b]) => a < fin && ini < b);
  const ocupar = (dia: string, mesaId: string, ini: number, fin: number) => ocupacion.set(`${dia}|${mesaId}`, [...(ocupacion.get(`${dia}|${mesaId}`) ?? []), [ini, fin]]);

  const filasReserva: Prisma.ReservaCreateManyInput[] = [];
  const filasAsignada: Prisma.ReservaMesaAsignadaCreateManyInput[] = [];
  const filasHistReserva: Prisma.ReservaHistorialCreateManyInput[] = [];
  const filasVisita: Prisma.ClienteVisitaCreateManyInput[] = [];
  const filasEncuesta: Prisma.ClienteEncuestaCreateManyInput[] = [];

  const numerosEv = await reservarNumeros(prisma, t, "EV", EVENTOS.length);
  const numerosPre = await reservarNumeros(prisma, t, "PRE", EVENTOS.reduce((a, e) => a + (e.presupuestos?.length ?? 0), 0));
  let iPre = 0;
  const filasSolicitud: Prisma.EventoSolicitudCreateManyInput[] = [];
  const filasHistEvento: Prisma.EventoHistorialCreateManyInput[] = [];
  const filasPresupuesto: Prisma.EventoPresupuestoCreateManyInput[] = [];
  const filasLineaPres: Prisma.EventoPresupuestoLineaCreateManyInput[] = [];

  for (const [i, ev] of EVENTOS.entries()) {
    const cli = contactosEvento[ev.contacto];
    cli.usos++;
    const solId = nuevoId();
    const recibida = new Date(ahora.getTime() - ev.recibidaHace * DIA_MS - (2 + Math.floor(r() * 8)) * 3_600_000);
    const conCentro = ev.conCentro !== false;
    filasSolicitud.push({
      id: solId, tenantId: t, numero: numerosEv[i], tipo: ev.tipo, estado: ev.estado, motivoPerdida: ev.motivo ?? null,
      nombreContacto: `${cli.nombre} ${cli.apellidos}`, empresa: ev.empresa ?? null, telefono: cli.telefono, email: cli.email, clienteId: cli.id,
      personas: ev.personas, fecha: fechaDia(ev.dia), hora: ev.hora, presupuestoCliente: ev.presupuestoCliente ?? null,
      marcaId: marcaRaza, centroId: conCentro ? centroId : null, espacioId: conCentro && ev.espacio ? espacioId[ev.espacio] : null,
      recomiendame: ev.recomiendame ?? false, origen: ev.origen, notas: ev.notas ?? null, createdAt: recibida,
    });
    // Historial: alta y pasos repartidos entre la recepción y hoy
    const pasos: [string, string | null][] = [["NUEVA", ev.origen === "RESERVA" ? `Reserva de ${ev.personas} personas pasada a Eventos` : null], ...(ev.pasos ?? [])];
    const finHist = ev.estado === "CELEBRADA" ? enMadrid(ev.dia, aMin(ev.hora) + 240) : ahora;
    let desde: string | null = null;
    for (const [k, [hasta, nota]] of pasos.entries()) {
      const momento = new Date(recibida.getTime() + ((finHist.getTime() - recibida.getTime()) * k) / Math.max(pasos.length, 2));
      filasHistEvento.push({ id: nuevoId(), solicitudId: solId, desde: desde as never, hasta: hasta as never, nota, createdAt: momento });
      desde = hasta;
    }
    // Presupuestos
    for (const [v, p] of (ev.presupuestos ?? []).entries()) {
      const lineas = p.lineas.map((l) => {
        if (l.menu) {
          const m = menus[l.menu];
          return { menuId: m?.id ?? null, concepto: `Menú «${m?.nombre ?? l.menu}»`, cantidad: l.cantidad, precio: m?.precio ?? 0 };
        }
        return { menuId: l.menuId ?? null, concepto: l.concepto, cantidad: l.cantidad, precio: l.precio };
      });
      const total = redondear(lineas.reduce((a, l) => a + l.cantidad * l.precio, 0));
      const presId = nuevoId();
      const creado = new Date(ahora.getTime() - p.hace * DIA_MS);
      filasPresupuesto.push({
        id: presId, tenantId: t, solicitudId: solId, numero: numerosPre[iPre++], version: v + 1, estado: p.estado,
        condiciones: `Precios con IVA incluido. Confirmación del número de comensales 72 horas antes. Señal del ${p.senalPct ?? 30} % para bloquear la fecha. Los principales «a elegir» se eligen por adelantado.`,
        senal: p.senalPct ? redondear((total * p.senalPct) / 100) : null, total,
        enviadoEn: p.estado !== "BORRADOR" ? new Date(creado.getTime() + 3_600_000) : null,
        aceptadoEn: p.estado === "ACEPTADO" ? new Date(creado.getTime() + 4 * DIA_MS) : null,
        createdAt: creado,
      });
      for (const [o, l] of lineas.entries())
        filasLineaPres.push({ id: nuevoId(), presupuestoId: presId, menuId: l.menuId, concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, iva: 10, importe: redondear(l.cantidad * l.precio), orden: o });
    }
    // Reserva que bloquea las mesas del evento aceptado o celebrado
    if ((ev.estado === "ACEPTADA" || ev.estado === "CELEBRADA") && ev.mesasEvento) {
      const ini = aMin(ev.hora);
      const dur = ev.espacio === "RESERVADO" ? 210 : 150;
      const pasado = enMadrid(ev.dia, ini + dur) < ahora;
      const resId = nuevoId();
      const menuTxt = ev.presupuestos?.find((p) => p.estado === "ACEPTADO")?.lineas.find((l) => l.menu)?.menu;
      filasReserva.push({
        id: resId, tenantId: t, centroId, clienteId: cli.id, nombre: `${cli.nombre} ${cli.apellidos}`, telefono: cli.telefono, email: cli.email, personas: ev.personas,
        fecha: fechaDia(ev.dia), hora: ev.hora, duracionMin: dur, espacioId: espacioId[ev.espacio!], estado: pasado ? "TERMINADA" : "CONFIRMADA", origen: "MANUAL",
        notas: `Evento ${numerosEv[i]}${menuTxt ? ` · Menú ${menuTxt}` : " · a la carta"}${ev.empresa ? ` · ${ev.empresa}` : ""}`, solicitudEventoId: solId, createdAt: recibida,
      });
      filasHistReserva.push({ id: nuevoId(), reservaId: resId, desde: null, hasta: "CONFIRMADA", nota: `Creada desde el evento ${numerosEv[i]}`, createdAt: recibida });
      if (pasado) {
        filasHistReserva.push({ id: nuevoId(), reservaId: resId, desde: "CONFIRMADA", hasta: "SENTADA", createdAt: enMadrid(ev.dia, ini + 5) });
        filasHistReserva.push({ id: nuevoId(), reservaId: resId, desde: "SENTADA", hasta: "TERMINADA", createdAt: enMadrid(ev.dia, ini + dur) });
        // Visita del contacto con el importe del presupuesto aceptado (en el ERP no se enlaza solo: ver huecos)
        const aceptado = filasPresupuesto.filter((p) => p.solicitudId === solId && p.estado === "ACEPTADO").pop();
        const visitaId = nuevoId();
        filasVisita.push({ id: visitaId, tenantId: t, clienteId: cli.id, centroId, fecha: fechaDia(ev.dia), personas: ev.personas, importe: aceptado ? Number(aceptado.total) : null, reservaId: resId, origen: "EVENTO", createdAt: enMadrid(ev.dia, ini + dur) });
        filasEncuesta.push({
          id: nuevoId(), tenantId: t, clienteId: cli.id, centroId, visitaId, reservaId: resId, estado: "RESPONDIDA", nota: 5, invitadoResena: true,
          comentario: "Todo perfecto, el reservado es ideal para grupos. Repetiremos.", enviadaEn: enMadrid(ev.dia, ini + dur + 15 * 60), respondidaEn: enMadrid(ev.dia, ini + dur + 20 * 60), createdAt: enMadrid(ev.dia, ini + dur),
        });
        cli.visitas++;
        if (!cli.ultimaVisita || fechaDia(ev.dia) > cli.ultimaVisita) cli.ultimaVisita = fechaDia(ev.dia);
      }
      for (const n of ev.mesasEvento) {
        filasAsignada.push({ id: nuevoId(), reservaId: resId, mesaId: mesaPorNombre[n].id });
        ocupar(ev.dia, mesaPorNombre[n].id, ini - 30, ini + dur);
      }
    }
  }

  // ------------------------------------------------------------ reservas del día a día
  const franjas = new Map<string, number>();
  const NOTAS = [
    "Cumpleaños: traen tarta, sacarla con vela", "Aniversario de boda", "Piden mesa tranquila", "Trona para un bebé", "Silla de ruedas: mesa accesible, sin escalón",
    "Prefieren terraza con estufa", "Primera visita, vienen recomendados", "Quieren chuletón madurado de 60 días: reservar pieza", "Comida de trabajo: necesitan factura",
    "Llegarán 15 minutos tarde", "Piden ver la cámara de maduración",
  ];
  const ALERGIA_RESERVA = ["Celíaco", "Intolerante a la lactosa", "Alergia a frutos secos", "Embarazada: carne muy hecha y sin embutidos"];
  const tamGrupo = () => {
    const x = r();
    return x < 0.44 ? 2 : x < 0.54 ? 3 : x < 0.79 ? 4 : x < 0.87 ? 5 : x < 0.92 ? 6 : x < 0.96 ? 7 + Math.floor(r() * 2) : 9 + Math.floor(r() * 2);
  };
  const ORDEN_ESPACIO: Record<string, number> = { SALON: 0, TERRAZA: 1, BARRA: 2, RESERVADO: 3 };
  /** Mesas para el grupo: una donde quepa (salón primero) o dos combinables del mismo espacio. */
  const buscarMesas = (dia: string, personas: number, ini: number, fin: number, pide: string | null, sinReserva: boolean): string[] | null => {
    const libres = mesas.filter(
      (m) => libre(dia, m.id, ini, fin) && (m.espacio !== "BARRA" || sinReserva || pide === "BARRA") && (m.espacio !== "RESERVADO" || personas >= 8 || pide === "RESERVADO"),
    );
    const prefer = (m: Mesa) => (pide && m.espacio === pide ? -1 : ORDEN_ESPACIO[m.espacio]);
    const una = libres.filter((m) => m.min <= personas && personas <= m.max).sort((a, b) => prefer(a) - prefer(b) || a.max - b.max || Number(a.nombre.replace(/\D/g, "")) - Number(b.nombre.replace(/\D/g, "")))[0];
    if (una) return [una.id];
    const comb = libres.filter((m) => m.combinable).sort((a, b) => prefer(a) - prefer(b));
    for (let i = 0; i < comb.length; i++)
      for (let j = i + 1; j < comb.length; j++)
        if (comb[i].espacioId === comb[j].espacioId && comb[i].max + comb[j].max >= personas && comb[i].max + comb[j].max <= personas + 3) return [comb[i].id, comb[j].id];
    return null;
  };

  let nCm = 0;
  for (let d = -56; d <= 28; d++) {
    const dia = rel(d);
    const ds = diaSemana(dia);
    const finde = ds >= 6;
    for (const turno of TURNOS.filter((x) => x.dias.includes(ds))) {
      const servicio = turno.comida ? "comida" : "cena";
      let objetivo = OBJETIVO[servicio][ds];
      if (d > 0) objetivo *= d <= 7 ? 0.85 : d <= 14 ? 0.55 : 0.3; // reservas futuras: cuanto más lejos, menos
      if (dia.slice(5, 7) === "12") objetivo *= 1.15; // diciembre
      objetivo *= 0.85 + r() * 0.3;
      const iniT = aMin(turno.ini);
      const finT = aMin(turno.fin);
      let cubiertos = 0;
      for (let intento = 0; cubiertos < objetivo && intento < 120; intento++) {
        const personas = tamGrupo();
        // Hora: más a las 14:00-14:30 y 21:00-22:00
        const pico = turno.comida ? 14 * 60 + 15 : 21 * 60 + 30;
        let hora = Math.round((pico + (r() + r() + r() - 1.5) * 70) / 15) * 15;
        hora = Math.min(Math.max(hora, iniT), finT);
        const horaTxt = deMin(hora);
        const fran = `${dia}|${turno.nombre}|${horaTxt}`;
        const pasadoODia = d < 0 || (d === 0 && hora + duracionPara(personas) < ahoraMin);
        const sinReserva = d <= 0 && (d < 0 || hora < ahoraMin) && r() < 0.12 && personas <= 4;
        // Estado
        let estado: "SOLICITADA" | "CONFIRMADA" | "LLEGADA" | "SENTADA" | "TERMINADA" | "CANCELADA" | "NO_PRESENTADA";
        const x = r();
        if (sinReserva) estado = d < 0 || hora + duracionPara(personas) < ahoraMin ? "TERMINADA" : "SENTADA";
        else if (d < 0 || pasadoODia) estado = x < 0.065 ? "CANCELADA" : x < 0.105 ? "NO_PRESENTADA" : "TERMINADA";
        else if (d === 0) estado = x < 0.05 ? "CANCELADA" : hora <= ahoraMin ? "SENTADA" : hora - 10 <= ahoraMin ? "LLEGADA" : "CONFIRMADA";
        else estado = x < 0.05 ? "CANCELADA" : x < 0.11 ? "SOLICITADA" : "CONFIRMADA";
        const cuenta = estado !== "CANCELADA" && estado !== "NO_PRESENTADA";
        if (cuenta && (franjas.get(fran) ?? 0) + personas > turno.max) continue;
        const dur = duracionPara(personas);
        const pide = sinReserva ? (personas <= 2 ? "BARRA" : null) : r() < (finde ? 0.08 : 0.04) ? "TERRAZA" : null;
        const mesasRes = buscarMesas(dia, personas, hora, hora + dur, pide, sinReserva);
        if (!mesasRes) continue;
        if (cuenta) {
          franjas.set(fran, (franjas.get(fran) ?? 0) + personas);
          for (const m of mesasRes) ocupar(dia, m, hora, hora + dur);
        }
        cubiertos += cuenta ? personas : 0;

        // Cliente y origen
        const momentoRes = enMadrid(dia, hora);
        const o = r();
        const origen = sinReserva ? "MANUAL" : o < 0.5 ? "COVERMANAGER" : o < 0.75 ? "TELEFONO" : o < 0.95 ? "WEB" : "MANUAL";
        const cli = sinReserva
          ? r() < 0.35 ? elegirCliente(dia, finde, turno.comida, momentoRes, origen, false) : null
          : elegirCliente(dia, finde, turno.comida, momentoRes, origen);
        if (cli) cli.usos++;
        const antelacion = sinReserva ? 0 : Math.floor(r() * r() * 21) + (r() < 0.2 ? 0 : 1);
        let creada = sinReserva ? new Date(momentoRes.getTime() - 2 * 60_000) : new Date(momentoRes.getTime() - antelacion * DIA_MS - (2 + Math.floor(r() * 9)) * 3_600_000);
        if (creada > ahora) creada = new Date(ahora.getTime() - Math.floor(r() * 48) * 3_600_000);
        if (creada > momentoRes) creada = new Date(momentoRes.getTime() - 3_600_000);

        const notas: string[] = [];
        if (sinReserva) notas.push("Sin reserva: entran de paso");
        else if (r() < 0.2) notas.push(elegir(NOTAS));
        if (cli?.tipo === "VIP" && r() < 0.6) notas.push("Cliente VIP: avisar al gerente");
        if (cli?.tipo === "EMPRESA" && turno.comida && r() < 0.4) notas.push("Comida de trabajo: necesitan factura");
        if (cli?.fechaNacimiento && dia.slice(5) === cli.fechaNacimiento.toISOString().slice(5, 10)) notas.push("Cumpleaños del cliente");
        const alergias = cli?.alergias ?? (r() < 0.06 ? elegir(ALERGIA_RESERVA) : null);

        const resId = nuevoId();
        const nombre = cli ? `${cli.nombre} ${cli.apellidos}` : sinReserva ? `Sin reserva ${deMin(hora)} (${personas})` : elegir(["Familia Ortega", "Beatriz", "Sr. Morales"]);
        filasReserva.push({
          id: resId, tenantId: t, centroId, clienteId: cli?.id ?? null, nombre, telefono: cli?.telefono ?? null, email: cli?.email ?? null, personas,
          fecha: fechaDia(dia), hora: horaTxt, duracionMin: dur, espacioId: pide && pide !== "BARRA" ? espacioId[pide] : null, estado, origen,
          notas: notas.join(". ") || null, alergias, externoId: origen === "COVERMANAGER" ? `CM-${String(4_810_000 + nCm++ * 37)}` : null,
          creadoPor: null, createdAt: creada,
        });
        for (const m of mesasRes) filasAsignada.push({ id: nuevoId(), reservaId: resId, mesaId: m });

        // Historial
        const hist = (desde: string | null, hasta: string, cuando: Date, nota: string | null = null) =>
          filasHistReserva.push({ id: nuevoId(), reservaId: resId, desde: desde as never, hasta: hasta as never, nota, createdAt: cuando });
        if (sinReserva) {
          hist(null, "SENTADA", creada, "Sin reserva");
          if (estado === "TERMINADA") hist("SENTADA", "TERMINADA", enMadrid(dia, hora + dur));
        } else {
          const inicial = estado === "SOLICITADA" || (origen === "WEB" && r() < 0.5) ? "SOLICITADA" : "CONFIRMADA";
          hist(null, inicial, creada, inicial === "SOLICITADA" ? "Pedida por la web: pendiente de confirmar" : null);
          let actual = inicial;
          if (inicial === "SOLICITADA" && estado !== "SOLICITADA") {
            hist("SOLICITADA", "CONFIRMADA", new Date(Math.min(creada.getTime() + 3 * 3_600_000, ahora.getTime())), "Confirmada por teléfono");
            actual = "CONFIRMADA";
          }
          if (estado === "CANCELADA") {
            const cuando = new Date(Math.min(creada.getTime() + (momentoRes.getTime() - creada.getTime()) * r(), ahora.getTime()));
            hist(actual, "CANCELADA", cuando, elegir(["Cancela por teléfono", "Cancelada desde CoverManager", "Enfermedad", null as unknown as string]));
          } else if (estado === "NO_PRESENTADA") hist(actual, "NO_PRESENTADA", enMadrid(dia, hora + 25), "No contestan al teléfono");
          else if (estado === "LLEGADA") hist(actual, "LLEGADA", enMadrid(dia, hora - 5));
          else if (estado === "SENTADA" || estado === "TERMINADA") {
            if (r() < 0.3) {
              hist(actual, "LLEGADA", enMadrid(dia, hora - 3));
              actual = "LLEGADA";
            }
            hist(actual, "SENTADA", enMadrid(dia, hora + Math.floor(r() * 10)));
            if (estado === "TERMINADA") hist("SENTADA", "TERMINADA", enMadrid(dia, hora + dur - 10 + Math.floor(r() * 25)));
          }
        }

        // Visita y encuesta (como hace registrarVisita al terminar)
        if (estado === "TERMINADA" && cli) {
          const fin = enMadrid(dia, hora + dur);
          const visitaId = nuevoId();
          const ticket = (turno.comida ? 52 : 64) + r() * 30;
          filasVisita.push({ id: visitaId, tenantId: t, clienteId: cli.id, centroId, fecha: fechaDia(dia), personas, importe: redondear(personas * ticket), reservaId: resId, origen: "RESERVA", createdAt: fin });
          cli.visitas++;
          if (!cli.ultimaVisita || fechaDia(dia) > cli.ultimaVisita) cli.ultimaVisita = fechaDia(dia);
          const enviada = new Date(fin.getTime() + 15 * 3_600_000);
          const responde = enviada < ahora && r() < 0.55;
          const y = r();
          const nota = responde ? (y < 0.5 ? 5 : y < 0.8 ? 4 : y < 0.9 ? 3 : y < 0.96 ? 2 : 1) : null;
          const gestionada = nota !== null && nota <= 2 && r() < 0.6;
          filasEncuesta.push({
            id: nuevoId(), tenantId: t, clienteId: cli.id, centroId, visitaId, reservaId: resId,
            estado: nota === null ? "PENDIENTE" : gestionada ? "GESTIONADA" : "RESPONDIDA", nota, comentario: nota === null ? null : elegir(COMENTARIOS[nota]) ?? null,
            invitadoResena: nota !== null && nota >= 4, avisoGerencia: nota !== null && nota <= 2, seguimiento: gestionada ? elegir(SEGUIMIENTOS) : null,
            enviadaEn: enviada < ahora ? enviada : fin, respondidaEn: nota === null ? null : new Date(enviada.getTime() + Math.floor(r() * 30) * 3_600_000), createdAt: fin,
          });
        }
      }
    }
  }

  // Visitas antiguas (antes de estas 8 semanas) de habituales y VIP, importadas de CoverManager
  const otrosRaza = ["RZ-BAR", "RZ-CHA", "RZ-BER"].map((c) => ctx.centros[c]).filter(Boolean);
  for (const c of clientes.filter((x) => x.tipo === "VIP" || x.tipo === "HABITUAL")) {
    const n = 2 + Math.floor(r() * (c.tipo === "VIP" ? 10 : 6));
    for (let k = 0; k < n; k++) {
      const fecha = fechaDia(rel(-(60 + Math.floor(r() * 300))));
      if (fecha < c.createdAt) continue;
      const enOtro = otrosRaza.length > 0 && r() < 0.2;
      const pax = 2 + Math.floor(r() * 4);
      filasVisita.push({ id: nuevoId(), tenantId: t, clienteId: c.id, centroId: enOtro ? elegir(otrosRaza) : centroId, fecha, personas: pax, importe: redondear(pax * (55 + r() * 30)), origen: "COVERMANAGER", createdAt: fecha });
      c.visitas++;
      if (!c.ultimaVisita || fecha > c.ultimaVisita) c.ultimaVisita = fecha;
    }
  }

  // ------------------------------------------------------------ guardar clientes y consentimientos
  const filasCliente: Prisma.ClienteCreateManyInput[] = clientes.map((c) => ({
    id: c.id, tenantId: t, nombre: c.nombre, apellidos: c.apellidos, telefono: c.telefono, email: c.email, fechaNacimiento: c.fechaNacimiento, idioma: c.idioma,
    preferencias: c.preferencias, alergias: c.alergias, notas: c.notas, etiquetas: c.etiquetas, origen: c.origen, visitas: c.visitas, ultimaVisita: c.ultimaVisita, createdAt: c.createdAt,
  }));
  const filasConsent: Prisma.ClienteConsentimientoCreateManyInput[] = [];
  const TEXTO_RESERVA = "Política de privacidad de Grupo Raza v2 (2026): tratamiento de datos para gestionar la reserva";
  for (const c of clientes) {
    const origenC = c.origen === "COVERMANAGER" ? "COVERMANAGER" : c.origen === "WEB" ? "WEB" : c.origen === "EVENTO" ? "EVENTO" : "RESERVA";
    filasConsent.push({ id: nuevoId(), tenantId: t, clienteId: c.id, tipo: "RESERVA", otorgado: true, origen: origenC, texto: TEXTO_RESERVA, fecha: c.createdAt });
    const pCorreo = c.tipo === "TURISTA" ? 0.15 : c.tipo === "VIP" ? 0.8 : c.tipo === "EMPRESA" ? 0.45 : 0.55;
    const correo = !!c.email && r() < pCorreo;
    if (correo) filasConsent.push({ id: nuevoId(), tenantId: t, clienteId: c.id, tipo: "CORREO", otorgado: true, origen: origenC, texto: "Acepto recibir ofertas de Grupo Raza por correo", fecha: c.createdAt });
    if (r() < (c.tipo === "TURISTA" ? 0.05 : 0.3))
      filasConsent.push({ id: nuevoId(), tenantId: t, clienteId: c.id, tipo: "WHATSAPP", otorgado: true, origen: origenC, texto: "Acepto recibir ofertas por WhatsApp", fecha: c.createdAt });
    if (correo && r() < 0.1)
      filasConsent.push({ id: nuevoId(), tenantId: t, clienteId: c.id, tipo: "CORREO", otorgado: false, origen: "WEB", texto: "Se da de baja desde el enlace del boletín", fecha: new Date(ahora.getTime() - Math.floor(r() * 40) * DIA_MS) });
    if (marcaRaza && r() < 0.04)
      filasConsent.push({ id: nuevoId(), tenantId: t, clienteId: c.id, tipo: "CORREO", otorgado: true, marcaId: marcaRaza, origen: "MANUAL", texto: "Solo quiere recibir ofertas de Raza", fecha: c.createdAt });
  }
  await enLotes(filasCliente, (l) => prisma.cliente.createMany({ data: l }));
  await enLotes(filasConsent, (l) => prisma.clienteConsentimiento.createMany({ data: l }));

  // ------------------------------------------------------------ guardar reservas, visitas, encuestas y eventos
  await enLotes(filasReserva, (l) => prisma.reserva.createMany({ data: l }));
  await enLotes(filasAsignada, (l) => prisma.reservaMesaAsignada.createMany({ data: l }));
  await enLotes(filasHistReserva, (l) => prisma.reservaHistorial.createMany({ data: l }));
  await enLotes(filasVisita, (l) => prisma.clienteVisita.createMany({ data: l }));
  await enLotes(filasEncuesta, (l) => prisma.clienteEncuesta.createMany({ data: l }));
  await prisma.eventoSolicitud.createMany({ data: filasSolicitud });
  await prisma.eventoHistorial.createMany({ data: filasHistEvento });
  if (filasPresupuesto.length) await prisma.eventoPresupuesto.createMany({ data: filasPresupuesto });
  if (filasLineaPres.length) await prisma.eventoPresupuestoLinea.createMany({ data: filasLineaPres });

  // ------------------------------------------------------------ tarjetas regalo
  const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codigos = new Set((await prisma.tarjetaRegalo.findMany({ where: { tenantId: t }, select: { codigo: true } })).map((x) => x.codigo));
  const codigo = () => {
    let c: string;
    do {
      const s = Array.from({ length: 8 }, () => LETRAS[Math.floor(r() * LETRAS.length)]).join("");
      c = `RZ-${s.slice(0, 4)}-${s.slice(4)}`;
    } while (codigos.has(c));
    codigos.add(c);
    return c;
  };
  const filasTarjeta: Prisma.TarjetaRegaloCreateManyInput[] = [];
  const filasMov: Prisma.TarjetaRegaloMovimientoCreateManyInput[] = [];
  const compradores = clientes.filter((c) => c.tipo === "VIP" || c.tipo === "HABITUAL" || c.tipo === "EMPRESA");
  // [importe, días desde la compra, tipo de final, marca Raza]
  const TARJETAS: [number, number, "ACTIVA" | "PARCIAL" | "AGOTADA" | "CADUCADA" | "ANULADA", boolean][] = [
    [100, 3, "ACTIVA", true], [150, 9, "ACTIVA", true], [75, 14, "ACTIVA", false], [200, 20, "PARCIAL", true], [100, 26, "PARCIAL", true],
    [50, 30, "AGOTADA", true], [120, 35, "PARCIAL", false], [100, 41, "AGOTADA", true], [300, 47, "PARCIAL", true], [80, 52, "ACTIVA", true],
    [100, 58, "AGOTADA", false], [150, 70, "PARCIAL", true], [60, 95, "AGOTADA", true], [100, 130, "ACTIVA", true], [200, 160, "PARCIAL", true],
    [50, 200, "AGOTADA", true], [100, 240, "ACTIVA", false], [150, 300, "PARCIAL", true], [100, 390, "CADUCADA", true], [75, 420, "CADUCADA", true],
    [100, 11, "ANULADA", true], [250, 5, "ACTIVA", true], [100, 1, "ACTIVA", true], [500, 18, "ACTIVA", true],
  ];
  for (const [i, [importe, hace, fin, raza]] of TARJETAS.entries()) {
    const id = nuevoId();
    const comprada = new Date(ahora.getTime() - hace * DIA_MS - 5 * 3_600_000);
    const comprador = compradores[(i * 13) % compradores.length];
    const destinatario = clientes[(i * 29 + 7) % clientes.length];
    const caducidad = fechaDia(textoDia(new Date(comprada.getTime() + 365 * DIA_MS)));
    let saldo = importe;
    const movs: Prisma.TarjetaRegaloMovimientoCreateManyInput[] = [{ id: nuevoId(), tarjetaId: id, tipo: "EMISION", importe, saldoTras: importe, createdAt: comprada }];
    if (fin === "PARCIAL" || fin === "AGOTADA") {
      const canjes = fin === "AGOTADA" ? (r() < 0.5 ? [importe] : [redondear(importe * 0.6), redondear(importe * 0.4)]) : [redondear(importe * (0.3 + r() * 0.4))];
      for (const [k, imp] of canjes.entries()) {
        saldo = redondear(saldo - imp);
        const cuando = new Date(comprada.getTime() + Math.min(hace - 0.5, 4 + k * 10 + r() * Math.max(hace - 5, 1)) * DIA_MS);
        movs.push({ id: nuevoId(), tarjetaId: id, tipo: "CANJE", importe: -imp, saldoTras: saldo, centroId, nota: `Canje en mesa ${elegir(mesas.filter((m) => m.espacio === "SALON")).nombre}`, createdAt: cuando });
      }
    }
    if (fin === "ANULADA") {
      movs.push({ id: nuevoId(), tarjetaId: id, tipo: "ANULACION", importe: -importe, saldoTras: 0, nota: "Compra duplicada en la web: se devuelve el importe", createdAt: new Date(comprada.getTime() + DIA_MS) });
      saldo = 0;
    }
    if (i === 3) {
      // Ajuste: se corrige un canje mal hecho
      movs.push({ id: nuevoId(), tarjetaId: id, tipo: "AJUSTE", importe: 12.5, saldoTras: redondear(saldo + 12.5), centroId, nota: "Se canjeó de más (ticket con el pan cobrado dos veces)", createdAt: new Date(ahora.getTime() - 2 * DIA_MS) });
      saldo = redondear(saldo + 12.5);
    }
    filasTarjeta.push({
      id, tenantId: t, codigo: codigo(), importeInicial: importe, saldo, caducidad, marcaId: raza ? marcaRaza : null,
      estado: fin === "PARCIAL" ? "ACTIVA" : fin, compradorNombre: `${comprador.nombre} ${comprador.apellidos}`, compradorEmail: comprador.email, clienteId: comprador.id,
      destinatario: i % 4 === 0 ? `${destinatario.nombre} ${destinatario.apellidos}` : elegir(["Mis padres", "Para Marta, feliz cumpleaños", "Equipo de ventas", "Papá", "Los recién casados"]),
      mensaje: elegir(["¡Que lo disfrutéis!", "Feliz cumpleaños", "Para un buen chuletón", "Gracias por todo este año", null as unknown as string]),
      origen: r() < 0.7 ? "WEB" : "MANUAL", createdAt: comprada,
    });
    filasMov.push(...movs);
  }
  await prisma.tarjetaRegalo.createMany({ data: filasTarjeta });
  await prisma.tarjetaRegaloMovimiento.createMany({ data: filasMov });

  console.log(
    `  sala: ${mesas.length} mesas, ${filasReserva.length} reservas, ${fichasCompletas} clientes con ficha completa + ${clientes.length - fichasCompletas} de una sola visita, ${filasVisita.length} visitas, ${filasEncuesta.length} encuestas, ` +
      `${filasTarjeta.length} tarjetas regalo, ${filasMenu.length} menús, ${filasSolicitud.length} solicitudes de evento, ${filasPresupuesto.length} presupuestos (gerente: ${gente.gerente})`,
  );
}

// ================================================================ CALIDAD

type EquipoDef = { nombre: string; tipo: "CAMARA_REFRIGERACION" | "CAMARA_CONGELACION" | "NEVERA" | "ARCON_CONGELADOR" | "MESA_FRIA" | "OTRO"; min: number; max: number; habitual: number; ruido: number };
const EQUIPOS: EquipoDef[] = [
  { nombre: "Cámara de maduración de carne", tipo: "CAMARA_REFRIGERACION", min: 0, max: 3, habitual: 1.6, ruido: 0.35 },
  { nombre: "Cámara de carne fresca", tipo: "CAMARA_REFRIGERACION", min: 0, max: 4, habitual: 2.3, ruido: 0.5 },
  { nombre: "Cámara de verduras", tipo: "CAMARA_REFRIGERACION", min: 2, max: 8, habitual: 4.6, ruido: 0.7 },
  { nombre: "Congelador", tipo: "CAMARA_CONGELACION", min: -22, max: -18, habitual: -19.9, ruido: 0.5 },
  { nombre: "Arcón de helados", tipo: "ARCON_CONGELADOR", min: -22, max: -16, habitual: -18.4, ruido: 0.6 },
  { nombre: "Mesa fría de parrilla", tipo: "MESA_FRIA", min: 1, max: 5, habitual: 3.3, ruido: 0.5 },
  { nombre: "Botellero de barra 1", tipo: "NEVERA", min: 2, max: 8, habitual: 5.1, ruido: 0.8 },
  { nombre: "Botellero de barra 2", tipo: "NEVERA", min: 2, max: 8, habitual: 5.4, ruido: 0.8 },
  { nombre: "Vinoteca de tintos", tipo: "OTRO", min: 14, max: 18, habitual: 16.2, ruido: 0.5 },
  { nombre: "Vinoteca de blancos y espumosos", tipo: "OTRO", min: 6, max: 10, habitual: 8.1, ruido: 0.5 },
];
// [equipo, días atrás, tarde?, temperatura, acción correctora, estado de la incidencia, solución, plazo (días desde la lectura)]
type Alarma = [string, number, boolean, number, string, "ABIERTA" | "EN_CURSO" | "RESUELTA", string | null, number];
const ALARMAS: Alarma[] = [
  ["Cámara de verduras", 41, true, 9.1, "Puerta abierta durante la descarga de un pedido grande. Se cierra y a los 30 min marca 6,2 °C.", "RESUELTA", "Se recuerda al equipo cerrar la cámara entre viaje y viaje. Lecturas normales.", 1],
  ["Cámara de maduración de carne", 33, false, 5.4, "Desescarche atascado. Se avisa al técnico de frío y las piezas pasan a la cámara de carne fresca.", "RESUELTA", "Frío Industrial Norte cambia la sonda del evaporador (185 €). Las piezas vuelven a maduración al día siguiente.", 1],
  ["Congelador", 19, true, -14.2, "Puerta mal cerrada tras el inventario. Se cierra y a la hora marca -18,6 °C.", "RESUELTA", "Producto revisado: sin descongelación. Se pone aviso en la puerta.", 1],
  ["Botellero de barra 2", 6, true, 11.5, "El compresor hace ruido. Se pasan los refrescos al botellero 1 y se llama al técnico.", "EN_CURSO", null, 3],
  ["Vinoteca de tintos", 2, false, 20.4, "La vinoteca está junto a la parrilla y sube con el calor del servicio. Se baja el termostato a 14 °C.", "ABIERTA", null, 5],
  ["Mesa fría de parrilla", 0, false, 7.8, "Tapa abierta durante la mise en place. Se cierra y a los 20 min marca 4,1 °C.", "ABIERTA", null, 1],
];

const PLANTILLA_MADURACION: [string, boolean][] = [
  ["Piezas identificadas con fecha de entrada y días de maduración", false],
  ["Humedad relativa de la cámara (%)", true],
  ["Sin moho anómalo, mal olor ni goteo sobre otras piezas", false],
  ["Ventilación interior funcionando", false],
  ["Piezas que salen hoy a corte (número y días de maduración)", true],
];
// [plantilla (empieza por), días atrás, punto (empieza por), observaciones, estado de la incidencia, solución, plazo]
type Fallo = [string, number, string, string, "ABIERTA" | "EN_CURSO" | "RESUELTA", string | null, number];
const FALLOS: Fallo[] = [
  ["Limpieza diaria", 50, "Campana", "Filtros con mucha grasa tras el servicio del sábado. Se limpian al cierre.", "RESUELTA", "Filtros limpios; se pasa la limpieza de filtros a dos veces por semana en diciembre.", 1],
  ["Apertura de cocina", 44, "Personal", "Un ayudante sin gorro ni redecilla. Se le da uno.", "RESUELTA", "Se repasa la norma de uniforme en la reunión de turno.", 1],
  ["Recepción de mercancía", 38, "Temperatura", "Lomo bajo del proveedor llega a 7,9 °C: se rechaza la entrega y se avisa al proveedor.", "RESUELTA", "El proveedor repone al día siguiente con camión refrigerado. Se anota en su ficha.", 1],
  ["Cierre de cocina", 30, "Puertas", "La cámara de verduras quedó entreabierta; el de apertura la encuentra a 8,4 °C.", "RESUELTA", "Producto revisado y apto. Se añade cartel de «cerrar cámara» en la puerta.", 1],
  ["Control de la cámara de maduración", 25, "Sin moho", "Una pieza de lomo alto con moho verde en la superficie: se retira y se apunta como merma (3,2 kg).", "RESUELTA", "Pieza desechada. Se revisa la ventilación: correcta.", 2],
  ["Limpieza diaria", 12, "Freidoras", "Aceite al 27 % de compuestos polares: se cambia.", "RESUELTA", "Aceite cambiado. Se pone el cambio fijo los lunes y jueves.", 1],
  ["Control de la cámara de maduración", 3, "Ventilación", "El ventilador interior hace ruido y gira lento.", "EN_CURSO", null, 1],
  ["Apertura de cocina", 4, "Producto", "Tres táperes de chimichurri sin etiqueta. Se etiquetan y se recuerda la norma.", "EN_CURSO", null, 2],
  ["Recepción de mercancía", 1, "Cantidades", "Faltan dos cajas de patatas del albarán. Se avisa al proveedor para que las traiga mañana.", "ABIERTA", null, 1],
];
/** Hora a la que se firma cada lista (minutos desde las 00:00 de la jornada). */
const HORA_LISTA: [string, number][] = [["Apertura", 10 * 60 + 30], ["Recepción", 11 * 60 + 40], ["Control de la cámara", 12 * 60 + 15], ["Limpieza", 17 * 60], ["Cierre", 24 * 60 + 40]];

// [nombre, equipo, empresa, cada días, próxima (días desde hoy), hechos (días desde hoy), coste]
const MANTENIMIENTO: [string, string | null, string | null, number, number, number[], number | null][] = [
  ["Limpieza de campana y conductos", "Campana de la parrilla", "Higienizaciones Madrid S.L.", 90, -4, [-94], 420],
  ["Limpieza de filtros de campana", "Campana de la parrilla", null, 7, 2, [-54, -47, -40, -33, -26, -19, -12, -5], null],
  ["Revisión de extintores", null, "Extintores Centro S.A.", 365, -10, [-375], 180],
  ["Revisión de cámaras frigoríficas", "Cámaras de maduración, carne y verduras", "Frío Industrial Norte", 180, 47, [-133], 260],
  ["Mantenimiento de la cámara de maduración (sonda, humedad y ventilador)", "Cámara de maduración de carne", "Frío Industrial Norte", 90, 12, [-78], 145],
  ["Desratización y desinsectación", null, "Plagas Control 3D", 30, 6, [-54, -24], 65],
  ["Deshollinado del conducto de la parrilla de carbón", "Parrilla de carbón", "Higienizaciones Madrid S.L.", 180, 61, [-119], 380],
  ["Tratamiento antilegionela del agua caliente", "Acumulador de agua caliente", "Aguas y Control S.L.", 365, 150, [-215], 210],
];

async function sembrarCalidad(prisma: PrismaClient, ctx: ContextoPruebas, gente: Personas) {
  const t = ctx.tenantId;
  const centroId = ctx.centroPruebas;
  const r = azar(9431);
  const ahora = ctx.hoy;
  const hoy = textoDia(ahora);
  const rel = (n: number) => sumarDias(hoy, n);

  // ------------------------------------------------------------ plantillas: las comunes + una propia del local
  const comunes = await prisma.calidadPlantilla.findMany({
    where: { tenantId: t, activo: true, centroId: null },
    include: { puntos: { where: { activo: true }, orderBy: { orden: "asc" } } },
    orderBy: { orden: "asc" },
  });
  let propia = await prisma.calidadPlantilla.findFirst({ where: { tenantId: t, centroId, nombre: "Control de la cámara de maduración" }, include: { puntos: { orderBy: { orden: "asc" } } } });
  if (!propia) {
    const orden = ((await prisma.calidadPlantilla.aggregate({ where: { tenantId: t }, _max: { orden: true } }))._max.orden ?? 0) + 1;
    propia = await prisma.calidadPlantilla.create({
      data: { tenantId: t, centroId, nombre: "Control de la cámara de maduración", tipo: "OTRA", orden, puntos: { create: PLANTILLA_MADURACION.map(([texto, pideValor], i) => ({ texto, pideValor, orden: i + 1 })) } },
      include: { puntos: { orderBy: { orden: "asc" } } },
    });
  }
  const plantillas = [...comunes, propia];

  // ------------------------------------------------------------ incidencias (se numeran al final)
  type Inc = Omit<Prisma.CalidadIncidenciaCreateManyInput, "numero" | "tenantId" | "centroId">;
  const incidencias: Inc[] = [];

  // ------------------------------------------------------------ equipos y lecturas
  const filasEquipo: Prisma.CalidadEquipoCreateManyInput[] = [];
  const filasTemp: Prisma.CalidadTemperaturaCreateManyInput[] = [];
  const quien = [gente.cocina, gente.ayudante, gente.sala];
  for (const e of EQUIPOS) {
    const id = nuevoId();
    filasEquipo.push({ id, tenantId: t, centroId, nombre: e.nombre, tipo: e.tipo, minimo: e.min, maximo: e.max, createdAt: new Date(ahora.getTime() - 120 * DIA_MS) });
    for (let d = -56; d <= 0; d++) {
      for (const tarde of [false, true]) {
        const cuando = enMadrid(rel(d), tarde ? 17 * 60 + 30 + Math.floor(r() * 20) : 8 * 60 + 30 + Math.floor(r() * 20));
        if (cuando > ahora) continue;
        // Alarma de hoy: si aún no es la hora, se pone en la última lectura posible
        const alarma = ALARMAS.find((a) => a[0] === e.nombre && a[1] === -d && a[2] === tarde);
        if (!alarma && r() < 0.02) continue; // lectura olvidada
        const ruido = (r() + r() + r() - 1.5) * e.ruido;
        const temperatura = alarma ? alarma[3] : redondear(Math.min(Math.max(e.habitual + ruido, e.min + 0.1), e.max - 0.1), 1);
        const tempId = nuevoId();
        filasTemp.push({
          id: tempId, tenantId: t, centroId, equipoId: id, temperatura, fueraDeRango: !!alarma, accionCorrectora: alarma ? alarma[4] : null,
          registradoNombre: tarde ? quien[(d + 60) % 3] : gente.cocina, createdAt: cuando,
        });
        if (alarma) {
          const [, , , temp, accion, estado, solucion, plazo] = alarma;
          incidencias.push({
            tipo: "TEMPERATURA", titulo: `${e.nombre}: ${String(temp).replace(".", ",")} °C fuera de rango`,
            descripcion: `Rango permitido de ${e.min} a ${e.max} °C.\nAcción correctora: ${accion}`, prioridad: "ALTA", origen: "TEMPERATURA", origenId: tempId,
            estado, solucion, resueltaEn: estado === "RESUELTA" ? new Date(cuando.getTime() + 20 * 3_600_000) : null, plazo: fechaDia(rel(d + plazo)),
            responsableNombre: estado === "RESUELTA" ? gente.cocina : gente.gerente, responsableId: estado === "RESUELTA" ? null : gente.gerenteUsuarioId,
            creadoNombre: tarde ? quien[(d + 60) % 3] : gente.cocina, createdAt: cuando,
          });
        }
      }
    }
  }
  // Si la alarma de hoy aún no tocaba (antes de las 08:30), se apunta en la última lectura de ayer por la tarde
  for (const a of ALARMAS.filter((x) => x[1] === 0)) {
    if (incidencias.some((i) => i.titulo?.startsWith(a[0]))) continue;
    const eq = filasEquipo.find((f) => f.nombre === a[0])!;
    const ultima = filasTemp.filter((f) => f.equipoId === eq.id).sort((x, y) => (y.createdAt as Date).getTime() - (x.createdAt as Date).getTime())[0];
    if (!ultima) continue;
    Object.assign(ultima, { temperatura: a[3], fueraDeRango: true, accionCorrectora: a[4] });
    incidencias.push({
      tipo: "TEMPERATURA", titulo: `${a[0]}: ${String(a[3]).replace(".", ",")} °C fuera de rango`, descripcion: `Acción correctora: ${a[4]}`, prioridad: "ALTA",
      origen: "TEMPERATURA", origenId: ultima.id, estado: a[5], plazo: fechaDia(rel(1)), responsableNombre: gente.gerente, creadoNombre: gente.cocina, createdAt: ultima.createdAt,
    });
  }
  await prisma.calidadEquipo.createMany({ data: filasEquipo });
  await enLotes(filasTemp, (l) => prisma.calidadTemperatura.createMany({ data: l }));

  // ------------------------------------------------------------ listas APPCC firmadas
  const filasEj: Prisma.CalidadEjecucionCreateManyInput[] = [];
  const filasResp: Prisma.CalidadRespuestaCreateManyInput[] = [];
  const yaHechas = new Set((await prisma.calidadEjecucion.findMany({ where: { tenantId: t, centroId }, select: { plantillaId: true, fecha: true } })).map((e) => `${e.plantillaId}|${e.fecha.toISOString().slice(0, 10)}`));
  let nAlbaran = 52_310;
  for (let d = -56; d <= 0; d++) {
    const dia = rel(d);
    for (const p of plantillas) {
      if (yaHechas.has(`${p.id}|${dia}`)) continue;
      const minutos = HORA_LISTA.find(([k]) => p.nombre.startsWith(k))?.[1] ?? 12 * 60;
      const cuando = enMadrid(dia, minutos + Math.floor(r() * 25));
      if (cuando > ahora) continue;
      if (p.tipo === "RECEPCION" && diaSemana(dia) === 7) continue; // los domingos no hay entregas
      const fallo = FALLOS.find((f) => p.nombre.startsWith(f[0]) && f[1] === -d);
      if (!fallo && r() < 0.025) continue; // lista olvidada
      const ejId = nuevoId();
      const firma = p.tipo === "CIERRE" ? gente.ayudante : p.tipo === "RECEPCION" ? gente.cocina : p.id === propia.id ? gente.cocina : r() < 0.7 ? gente.cocina : gente.ayudante;
      filasEj.push({ id: ejId, tenantId: t, centroId, plantillaId: p.id, fecha: fechaDia(dia), todoCorrecto: !fallo, observaciones: fallo ? fallo[3] : null, realizadoNombre: firma, createdAt: cuando });
      for (const pt of p.puntos) {
        const falla = !!fallo && pt.texto.startsWith(fallo[2]);
        let valor: string | null = null;
        if (pt.pideValor) {
          if (/lavavajillas/i.test(pt.texto)) valor = String(82 + Math.floor(r() * 4));
          else if (/albarán/i.test(pt.texto)) valor = `ALB-${nAlbaran++}`;
          else if (/Humedad/i.test(pt.texto)) valor = String(78 + Math.floor(r() * 7));
          else if (/salen hoy/i.test(pt.texto)) valor = `${1 + Math.floor(r() * 4)} piezas (${elegirDe(r, ["35", "42", "45", "60"])} días)`;
          else if (/Temperatura/i.test(pt.texto)) valor = falla ? "7,9" : String(redondear(1.8 + r() * 2, 1)).replace(".", ",");
          else valor = "Correcto";
        }
        filasResp.push({ id: nuevoId(), ejecucionId: ejId, puntoId: pt.id, texto: pt.texto, correcto: !falla, valor });
      }
      if (fallo) {
        const punto = p.puntos.find((pt) => pt.texto.startsWith(fallo[2]));
        const [, , , obs, estado, solucion, plazo] = fallo;
        incidencias.push({
          tipo: "SEGURIDAD_ALIMENTARIA", titulo: `${p.nombre}: 1 punto(s) no conformes`, descripcion: `- ${punto?.texto ?? fallo[2]}\n\nObservaciones: ${obs}`,
          prioridad: "MEDIA", origen: "APPCC", origenId: ejId, estado, solucion, resueltaEn: estado === "RESUELTA" ? new Date(cuando.getTime() + 26 * 3_600_000) : null,
          plazo: fechaDia(rel(d + plazo)), responsableNombre: gente.cocina, creadoNombre: firma, createdAt: cuando,
        });
      }
    }
  }
  await enLotes(filasEj, (l) => prisma.calidadEjecucion.createMany({ data: l }));
  await enLotes(filasResp, (l) => prisma.calidadRespuesta.createMany({ data: l }));

  // ------------------------------------------------------------ incidencias a mano
  // [tipo, título, descripción, prioridad, estado, hace días, plazo (días desde hoy), solución]
  const MANUALES: ["AVERIA" | "QUEJA" | "ACCIDENTE" | "OTRA", string, string, "BAJA" | "MEDIA" | "ALTA", "ABIERTA" | "EN_CURSO" | "RESUELTA", number, number, string | null][] = [
    ["AVERIA", "Campana de la parrilla: el motor de extracción hace ruido", "Ruido metálico al arrancar; se nota menos tiro con la parrilla a tope.", "ALTA", "EN_CURSO", 9, -2, null],
    ["QUEJA", "Cliente: chuletón pasado de punto y 40 minutos de espera", "Mesa 13, sábado noche. Se queja al gerente en sala.", "MEDIA", "RESUELTA", 16, -14, "Se invita al postre y se repasan con parrilla los tiempos de los puntos en sábado."],
    ["ACCIDENTE", "Quemadura leve en el antebrazo en la parrilla", "Al recolocar las brasas. Primeros auxilios en el botiquín.", "ALTA", "RESUELTA", 22, -21, "Sin baja. Se compran manguitos ignífugos para el puesto de parrilla."],
    ["AVERIA", "Puerta de la cámara de maduración: la goma no ajusta", "Entra aire por la parte de abajo; puede afectar a la humedad.", "MEDIA", "ABIERTA", 5, 3, null],
    ["OTRA", "Carta de alérgenos de los menús de Navidad sin preparar", "Los menús Origen, Esencia y Maduración no tienen ficha de alérgenos para sala.", "ALTA", "ABIERTA", 2, 1, null],
    ["AVERIA", "Lavavajillas: el aclarado no llega a 82 °C", "Marca 74 °C en el aclarado desde el mediodía.", "ALTA", "RESUELTA", 35, -33, "Resistencia cambiada por el servicio técnico (210 €)."],
    ["OTRA", "Extintor de la terraza con la revisión caducada", "La etiqueta marca la revisión de hace más de un año.", "ALTA", "ABIERTA", 1, -1, null],
  ];
  for (const [tipo, titulo, descripcion, prioridad, estado, hace, plazo, solucion] of MANUALES) {
    const creada = enMadrid(rel(-hace), 12 * 60 + Math.floor(r() * 300));
    incidencias.push({
      tipo, titulo, descripcion, prioridad, estado, solucion, origen: "MANUAL", plazo: fechaDia(rel(plazo)),
      resueltaEn: estado === "RESUELTA" ? new Date(creada.getTime() + 2 * DIA_MS) : null,
      responsableNombre: gente.gerente, responsableId: gente.gerenteUsuarioId, creadoNombre: tipo === "QUEJA" ? gente.sala : gente.cocina, createdAt: creada,
    });
  }
  incidencias.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  const numeros = await reservarNumeros(prisma, t, "INC", incidencias.length);
  await prisma.calidadIncidencia.createMany({ data: incidencias.map((i, k) => ({ ...i, tenantId: t, centroId, numero: numeros[k] })) });

  // ------------------------------------------------------------ mantenimiento preventivo
  const filasTarea: Prisma.CalidadMantenimientoCreateManyInput[] = [];
  const filasHecho: Prisma.CalidadMantenimientoHechoCreateManyInput[] = [];
  for (const [nombre, equipo, empresa, cadaDias, proxima, hechos, coste] of MANTENIMIENTO) {
    const id = nuevoId();
    const ultima = hechos.length ? rel(Math.max(...hechos)) : null;
    filasTarea.push({
      id, tenantId: t, centroId, nombre, equipo, empresa, proveedorId: empresa ? ctx.proveedores[empresa] ?? null : null, cadaDias,
      ultimaVez: ultima ? fechaDia(ultima) : null, proximaVez: fechaDia(rel(proxima)), notas: proxima < 0 ? "Pedida cita a la empresa; aún sin fecha" : null,
    });
    for (const h of hechos)
      filasHecho.push({ id: nuevoId(), tareaId: id, fecha: fechaDia(rel(h)), coste, nota: empresa ? `Certificado de ${empresa} archivado en la carpeta del local` : "Hecho por el equipo de cocina al cierre", realizadoNombre: empresa ?? gente.ayudante });
  }
  await prisma.calidadMantenimiento.createMany({ data: filasTarea });
  await prisma.calidadMantenimientoHecho.createMany({ data: filasHecho });

  console.log(`  sala/calidad: ${filasEquipo.length} equipos, ${filasTemp.length} lecturas, ${filasEj.length} listas APPCC, ${incidencias.length} incidencias, ${filasTarea.length} tareas de mantenimiento`);
}

function elegirDe<T>(r: () => number, l: T[]) {
  return l[Math.floor(r() * l.length)];
}
