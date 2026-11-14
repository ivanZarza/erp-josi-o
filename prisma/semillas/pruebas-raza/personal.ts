/**
 * Parte «personal» del local Raza Pruebas (RZ-PRU). Datos inventados (nombres, DNI/NIE, NSS, IBAN
 * y teléfonos con formato válido, pero de ejemplo). Lo legal (convenio, cotizaciones, IRPF) es de
 * ejemplo, a comprobar con la gestoría.
 *
 * Crea:
 * - Puestos y categorías del convenio de hostelería de Madrid que faltaban (segundo de cocina,
 *   encargado de sala, jefe de barra, runner, hostess).
 * - 32 personas (31 activas + 1 baja voluntaria del mes pasado): gerente, encargados, cocina,
 *   parrilla, office, sumiller, barra, sala, runners y hostess; fijos discontinuos, parciales y temporales.
 * - Contratos con salario, complementos (transporte, responsabilidad, nocturnidad, idiomas) e IRPF.
 * - Turnos tipo del local, cuadrantes desde el lunes anterior al día 1 de hace dos meses (al menos
 *   8 semanas atrás) hasta 2 semanas adelante, y fichajes de lo ya trabajado con incidencias:
 *   retrasos, olvidos (algunos corregidos por el gerente), horas extra y una cena de empresa.
 * - Ausencias (vacaciones, una baja por IT, asuntos propios, permiso, un día sin justificar, una pedida
 *   y una rechazada), certificados (alguno caducado o a punto), documentos, una oferta abierta con candidatos.
 * - Nóminas de los 2 últimos meses cerrados con el mismo cálculo que la pantalla (src/modulos/personal/nominas.ts).
 * - Usuarios gerente.pruebas@erp.local (gerente) y camarero.pruebas@erp.local (portal del empleado).
 *
 * Todo en lote (createMany). Si el local ya tiene empleados, no hace nada.
 */
import bcrypt from "bcryptjs";
import type { PrismaClient, Prisma } from "../../../src/generated/prisma/client";
import type { ContextoPruebas } from "./contexto";
import { aDia, sumarDias, hoyMadrid, lunesDe, limitesTurno, instanteMadrid, diasEntre, diaSemana, diasDelMes, mesSiguiente, type Turno } from "../../../src/modulos/personal/fechas";
import { prepararNominasMes, guardarNominas } from "../../../src/modulos/personal/nominas";

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

/** Pseudoaleatorio determinista: la semilla sale igual cada vez. */
function azar(semilla: number) {
  let x = semilla;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}
const r = azar(20261114);
const entre = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const id = () => `rzp${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`;
const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

function dni(): string {
  const n = entre(10000000, 79999999);
  return `${n}${LETRAS[n % 23]}`;
}
function nie(): string {
  const p = r() < 0.5 ? "X" : "Y";
  const n = entre(1000000, 9999999);
  const num = Number(`${p === "X" ? 0 : 1}${n}`);
  return `${p}${n}${LETRAS[num % 23]}`;
}
/** NSS de Madrid (28) con dígitos de control. */
function nss(): string {
  const n = String(entre(10000000, 99999999));
  const control = Number(BigInt(`28${n}`) % 97n);
  return `28${n}${String(control).padStart(2, "0")}`;
}
/** IBAN español con dígitos de control correctos (cuenta inventada). */
function iban(): string {
  const entidad = ["2100", "0049", "0182", "0081", "2085", "1465"][entre(0, 5)];
  const oficina = String(entre(1000, 9999));
  const cuenta = String(entre(1000000000, 9999999999));
  const pesos = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
  const dc = (s: string) => {
    const v = 11 - (s.split("").reduce((t, c, i) => t + Number(c) * pesos[i], 0) % 11);
    return v === 11 ? 0 : v === 10 ? 1 : v;
  };
  const bban = `${entidad}${oficina}${dc(`00${entidad}${oficina}`)}${dc(cuenta)}${cuenta}`;
  const resto = Number(BigInt(`${bban}142800`) % 97n);
  return `ES${String(98 - resto).padStart(2, "0")}${bban}`;
}
const telefono = () => `+34${r() < 0.85 ? "6" : "7"}${String(entre(10000000, 99999999))}`;
const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

async function enLotes<T>(datos: T[], tam: number, fn: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < datos.length; i += tam) await fn(datos.slice(i, i + tam));
}

// ---------------------------------------------------------------------
// Catálogos: puestos, categorías del convenio y turnos
// ---------------------------------------------------------------------

type Dep = "COCINA" | "SALA" | "BARRA" | "OFFICE" | "DIRECCION";
/** Puestos que usa el local: [nombre, departamento, salario bruto anual a 40 h (ejemplo)] */
const PUESTOS: Record<string, [Dep, number]> = {
  Gerente: ["DIRECCION", 42000],
  "Encargado/a de sala": ["SALA", 30500],
  "Jefe de cocina": ["COCINA", 38000],
  "Segundo/a de cocina": ["COCINA", 29000],
  "Parrillero/a": ["COCINA", 25200],
  "Cocinero/a": ["COCINA", 22800],
  "Ayudante de cocina": ["COCINA", 19600],
  Friegaplatos: ["OFFICE", 18300],
  Sumiller: ["SALA", 27600],
  "Jefe/a de barra": ["BARRA", 26400],
  Barman: ["BARRA", 21800],
  "Camarero/a": ["SALA", 20800],
  Runner: ["SALA", 18900],
  Hostess: ["SALA", 19900],
};
/** Categorías del convenio de Madrid que no existían: [nombre, nivel, salario base anual (tabla de ejemplo)] */
const CATEGORIAS_NUEVAS: [string, string, number][] = [
  ["Segundo/a de cocina", "Nivel II", 24000],
  ["Encargado/a de sala", "Nivel II", 25500],
  ["Jefe/a de barra", "Nivel III", 22000],
  ["Runner", "Nivel V (ayudante de camarero)", 16900],
  ["Hostess", "Nivel IV (recepción)", 17200],
];
const CONVENIO_MADRID = "Hostelería de la Comunidad de Madrid";

type ClaveTurno = "M" | "T" | "P" | "N" | "R" | "C";
const TURNOS: Record<ClaveTurno, Turno & { nombre: string; pausaMinutos: number }> = {
  M: { nombre: "Mañana", inicio: "09:00", fin: "17:30", pausaMinutos: 30 },
  T: { nombre: "Tarde-noche", inicio: "16:30", fin: "01:00", pausaMinutos: 30 },
  P: { nombre: "Partido", inicio: "12:30", fin: "16:30", inicio2: "20:00", fin2: "00:00", pausaMinutos: 0 },
  N: { nombre: "Noche (cierre)", inicio: "19:00", fin: "03:30", pausaMinutos: 30 },
  R: { nombre: "Refuerzo cenas (parcial)", inicio: "19:30", fin: "00:30", pausaMinutos: 0 },
  C: { nombre: "Comidas (parcial)", inicio: "12:00", fin: "18:00", pausaMinutos: 0 },
};

// ---------------------------------------------------------------------
// Plantilla
// ---------------------------------------------------------------------

type TipoC = "INDEFINIDO" | "TEMPORAL" | "FIJO_DISCONTINUO" | "PRACTICAS" | "PARCIAL";
interface Persona {
  nombre: string;
  apellidos: string;
  extranjero?: string; // nacionalidad si necesita NIE
  puesto: string;
  turno: ClaveTurno;
  /** alterna cada semana con este turno (encargados, cocineros) */
  alterna?: ClaveTurno;
  tipo?: TipoC;
  jornada?: number;
  /** días que trabaja a la semana (5 por defecto; los parciales, 4) */
  dias?: number;
  /** antigüedad en días antes de hoy */
  antiguedad: number;
  irpf?: number;
  complementos?: [string, string, number, boolean?][]; // concepto, nombre, € al mes, cotiza (sí por defecto)
  idiomas?: string;
}

const P: Persona[] = [
  { nombre: "Marta", apellidos: "Velasco Iglesias", puesto: "Gerente", turno: "P", antiguedad: 1650, irpf: 19 },
  { nombre: "Rodrigo", apellidos: "Fuentes Abad", puesto: "Encargado/a de sala", turno: "P", alterna: "T", antiguedad: 1200, complementos: [["PLUS_RESPONSABILIDAD", "Plus de responsabilidad", 180]] },
  { nombre: "Lorena", apellidos: "Quintana Ruiz", puesto: "Encargado/a de sala", turno: "T", alterna: "P", antiguedad: 700, complementos: [["PLUS_RESPONSABILIDAD", "Plus de responsabilidad", 180]] },
  { nombre: "Ignacio", apellidos: "Herrero Salas", puesto: "Jefe de cocina", turno: "P", antiguedad: 1500, irpf: 17.5, complementos: [["PLUS_RESPONSABILIDAD", "Plus de responsabilidad", 220]] },
  { nombre: "Fátima", apellidos: "El Amrani", extranjero: "Marruecos", puesto: "Segundo/a de cocina", turno: "T", antiguedad: 980, irpf: 9, complementos: [["PLUS_RESPONSABILIDAD", "Plus de responsabilidad", 120]] },
  { nombre: "Bruno", apellidos: "Cabello Ortega", puesto: "Parrillero/a", turno: "P", antiguedad: 1300 },
  { nombre: "Wilmer", apellidos: "Rojas Paredes", extranjero: "Venezuela", puesto: "Parrillero/a", turno: "T", antiguedad: 820 },
  { nombre: "Adrián", apellidos: "Pozo Lara", puesto: "Parrillero/a", turno: "T", tipo: "TEMPORAL", antiguedad: 166 },
  { nombre: "Natalia", apellidos: "Escudero Gil", puesto: "Cocinero/a", turno: "M", alterna: "T", antiguedad: 1100 },
  { nombre: "Samuel", apellidos: "Oduya Okafor", extranjero: "Nigeria", puesto: "Cocinero/a", turno: "T", alterna: "M", antiguedad: 600, irpf: 8 },
  { nombre: "Clara", apellidos: "Montes Rivas", puesto: "Cocinero/a", turno: "P", antiguedad: 400 },
  { nombre: "Kevin", apellidos: "Mendoza Zambrano", extranjero: "Ecuador", puesto: "Ayudante de cocina", turno: "M", antiguedad: 520 },
  { nombre: "Yaiza", apellidos: "Herrera Cid", puesto: "Ayudante de cocina", turno: "T", tipo: "TEMPORAL", antiguedad: 0 /* se ajusta: alta el día 20 del mes pasado */ },
  { nombre: "Iker", apellidos: "Garrido Sanz", puesto: "Ayudante de cocina", turno: "R", tipo: "PARCIAL", jornada: 20, dias: 4, antiguedad: 300, complementos: [["PLUS_TRANSPORTE", "Plus de transporte", 31]] },
  { nombre: "Mamadou", apellidos: "Diallo Sow", extranjero: "Senegal", puesto: "Friegaplatos", turno: "N", antiguedad: 900, complementos: [["PLUS_NOCTURNIDAD", "Plus de nocturnidad", 95]] },
  { nombre: "Rosa", apellidos: "Benítez Campos", puesto: "Friegaplatos", turno: "M", antiguedad: 2100 },
  { nombre: "Álvaro", apellidos: "Santamaría Ugarte", puesto: "Sumiller", turno: "P", antiguedad: 1000, complementos: [["PLUS_IDIOMAS", "Plus de idiomas (inglés)", 60]] },
  { nombre: "Daniel", apellidos: "Robles Méndez", puesto: "Jefe/a de barra", turno: "T", antiguedad: 1400, complementos: [["PLUS_RESPONSABILIDAD", "Plus de responsabilidad", 100]] },
  { nombre: "Giulia", apellidos: "Romano Bianchi", extranjero: "Italia", puesto: "Barman", turno: "N", antiguedad: 450, complementos: [["PLUS_NOCTURNIDAD", "Plus de nocturnidad", 95]] },
  { nombre: "Héctor", apellidos: "Vidal Pons", puesto: "Barman", turno: "T", tipo: "FIJO_DISCONTINUO", antiguedad: 590 },
  { nombre: "Patricia", apellidos: "Lozano Peña", puesto: "Camarero/a", turno: "P", antiguedad: 800 },
  { nombre: "Sergio", apellidos: "Calvo Marín", puesto: "Camarero/a", turno: "T", antiguedad: 650 },
  { nombre: "Ana Sofía", apellidos: "Restrepo Gómez", extranjero: "Colombia", puesto: "Camarero/a", turno: "T", antiguedad: 380 },
  { nombre: "Jorge", apellidos: "Navas Prieto", puesto: "Camarero/a", turno: "M", antiguedad: 1250 },
  { nombre: "Lucía", apellidos: "Ferrer Albors", puesto: "Camarero/a", turno: "P", tipo: "FIJO_DISCONTINUO", antiguedad: 610 },
  { nombre: "Marcos", apellidos: "Delgado Vera", puesto: "Camarero/a", turno: "R", tipo: "PARCIAL", jornada: 20, dias: 4, antiguedad: 210, irpf: 2, complementos: [["PLUS_TRANSPORTE", "Plus de transporte", 31]] },
  { nombre: "Elena", apellidos: "Popescu", extranjero: "Rumanía", puesto: "Camarero/a", turno: "T", tipo: "TEMPORAL", antiguedad: 183 },
  { nombre: "Omar", apellidos: "Benali Haddad", extranjero: "Marruecos", puesto: "Runner", turno: "T", antiguedad: 340 },
  { nombre: "Paula", apellidos: "Gómez Reyes", puesto: "Runner", turno: "C", tipo: "PARCIAL", jornada: 24, dias: 4, antiguedad: 260, complementos: [["PLUS_TRANSPORTE", "Plus de transporte", 37]] },
  { nombre: "Irene", apellidos: "Castaño Molina", puesto: "Hostess", turno: "T", antiguedad: 560, complementos: [["PLUS_IDIOMAS", "Plus de idiomas (inglés y francés)", 60]] },
  { nombre: "Valeria", apellidos: "Ríos Cordero", extranjero: "Argentina", puesto: "Hostess", turno: "R", tipo: "PARCIAL", jornada: 20, dias: 4, antiguedad: 150, complementos: [["PLUS_TRANSPORTE", "Plus de transporte", 31]] },
  // baja voluntaria el día 18 del mes pasado
  { nombre: "Nicolás", apellidos: "Bravo Soler", puesto: "Camarero/a", turno: "P", antiguedad: 900 },
];
const IDX = (nombre: string) => {
  const i = P.findIndex((p) => p.nombre === nombre);
  if (i < 0) throw new Error(`Semilla personal RZ-PRU: no existe ${nombre}`);
  return i;
};
const UE = new Set(["Italia", "Rumanía"]); // no necesitan permiso de trabajo

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const centroId = ctx.centroPruebas;
  if ((await prisma.empleado.count({ where: { tenantId: t, centroPrincipalId: centroId } })) > 0) {
    console.log("  personal: Raza Pruebas ya tiene plantilla, no se toca");
    return;
  }
  const centro = await prisma.centro.findUniqueOrThrow({ where: { id: centroId } });
  const sociedadId = centro.sociedadId;

  // ---------- fechas de referencia ----------
  const hoy = hoyMadrid(ctx.hoy);
  const mesActual = hoy.slice(0, 7);
  const mesA = mesSiguiente(mesActual, -2); // nómina pagada
  const mesB = mesSiguiente(mesActual, -1); // nómina del mes pasado
  const d = (mes: string, dia: number) => `${mes}-${String(dia).padStart(2, "0")}`;
  const lunesHoy = lunesDe(hoy);
  const inicioCuadrante = [sumarDias(lunesHoy, -56), lunesDe(d(mesA, 1))].sort()[0];
  const finCuadrante = sumarDias(lunesHoy, 20); // domingo de dentro de 2 semanas
  const ahora = ctx.hoy.getTime();

  // ---------- usuarios del local (gerente y un camarero para el portal) ----------
  const hash = await bcrypt.hash("Prueba2026!", 10);
  const usuario = async (email: string, nombre: string, rol: string) => {
    const u = (await prisma.usuario.findFirst({ where: { tenantId: t, email } })) ?? (await prisma.usuario.create({ data: { tenantId: t, email, nombre, rol, passwordHash: hash, todosCentros: false } }));
    await prisma.usuarioCentro.createMany({ data: [{ usuarioId: u.id, centroId }], skipDuplicates: true });
    return u.id;
  };
  const usuarioGerente = await usuario("gerente.pruebas@erp.local", "Marta Velasco (gerente Raza Pruebas)", "gerente");
  const usuarioCamarero = await usuario("camarero.pruebas@erp.local", "Patricia Lozano (camarera Raza Pruebas)", "empleado");

  // ---------- puestos y categorías ----------
  await prisma.puesto.createMany({ data: Object.entries(PUESTOS).map(([nombre, [departamento]], i) => ({ tenantId: t, nombre, departamento, orden: 50 + i })), skipDuplicates: true });
  const puestos = new Map((await prisma.puesto.findMany({ where: { tenantId: t, nombre: { in: Object.keys(PUESTOS) } } })).map((p) => [p.nombre, p.id]));
  const convenio =
    (await prisma.convenio.findFirst({ where: { tenantId: t, nombre: CONVENIO_MADRID } })) ??
    (await prisma.convenio.create({ data: { tenantId: t, nombre: CONVENIO_MADRID, comunidad: "Madrid", horasAnuales: 1776, diasVacaciones: 30, descansoMinimoHoras: 12 } }));
  await prisma.categoriaConvenio.createMany({
    data: [
      ...CATEGORIAS_NUEVAS.map(([nombre, nivel, salario]) => ({ convenioId: convenio.id, nombre, nivel, salarioBaseAnual: salario })),
      // por si la semilla general no las creó
      ...Object.entries(PUESTOS).map(([nombre, [, salario]]) => ({ convenioId: convenio.id, nombre, salarioBaseAnual: Math.round(salario * 0.85) })),
    ],
    skipDuplicates: true,
  });
  const categorias = new Map((await prisma.categoriaConvenio.findMany({ where: { convenioId: convenio.id } })).map((c) => [c.nombre, c]));
  const categoriaDe = (puesto: string) => categorias.get(puesto) ?? categorias.get(puesto.replace("Jefe de", "Jefe/a de"));

  await prisma.turnoTipo.createMany({ data: Object.values(TURNOS).map((x) => ({ tenantId: t, centroId, nombre: x.nombre, inicio: x.inicio, fin: x.fin, inicio2: x.inicio2 ?? null, fin2: x.fin2 ?? null })) });

  // ---------- empleados ----------
  const ultimo = await prisma.empleado.findFirst({ where: { tenantId: t, codigo: { startsWith: "EMP-" } }, orderBy: { codigo: "desc" }, select: { codigo: true } });
  let n = ultimo ? Number(ultimo.codigo.slice(4)) || 0 : 0;
  const CALLES = ["C/ Bravo Murillo", "C/ de Alcalá", "C/ de Toledo", "Av. de la Albufera", "C/ de Embajadores", "C/ de Fuencarral", "Pº de Extremadura", "C/ de López de Hoyos", "C/ de Arturo Soria", "C/ del General Ricardos"];
  const CP = ["28020", "28028", "28005", "28018", "28045", "28004", "28011", "28002", "28043", "28019"];
  const altaYaiza = d(mesB, 20);
  const bajaNicolas = d(mesB, 18);

  interface Emp { id: string; p: Persona; i: number; alta: string; baja: string | null; turnoBase: ClaveTurno }
  const emps: Emp[] = [];
  const filasEmp: Prisma.EmpleadoCreateManyInput[] = [];
  for (const [i, p] of P.entries()) {
    const alta = p.nombre === "Yaiza" ? altaYaiza : sumarDias(hoy, -p.antiguedad);
    const baja = p.nombre === "Nicolás" ? bajaNicolas : null;
    const e: Emp = { id: id(), p, i, alta, baja, turnoBase: p.turno };
    emps.push(e);
    const k = i % CALLES.length;
    const nacimiento = `${entre(1972, 2005)}-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}`;
    filasEmp.push({
      id: e.id,
      tenantId: t,
      codigo: `EMP-${String(++n).padStart(4, "0")}`,
      nombre: p.nombre,
      apellidos: p.apellidos,
      dni: p.extranjero ? nie() : dni(),
      nss: nss(),
      fechaNacimiento: aDia(nacimiento),
      email: `${sinTildes(p.nombre)}.${sinTildes(p.apellidos.split(" ")[0])}@ejemplo.es`,
      telefono: telefono(),
      direccion: `${CALLES[k]} ${entre(2, 180)}, ${entre(1, 6)}.º ${"ABCD"[entre(0, 3)]}, ${CP[k]} Madrid`,
      contactoEmergencia: `${["Madre", "Padre", "Pareja", "Hermana", "Hermano"][entre(0, 4)]}: ${telefono()}`,
      iban: p.nombre === "Elena" ? null : iban(), // una sin IBAN: hueco para avisar antes de pagar
      centroPrincipalId: centroId,
      sociedadId,
      puestoId: puestos.get(p.puesto) ?? null,
      categoriaId: categoriaDe(p.puesto)?.id ?? null,
      usuarioId: p.nombre === "Marta" ? usuarioGerente : p.nombre === "Patricia" ? usuarioCamarero : null,
      pin: String(2000 + ((i * 371) % 7900)).padStart(4, "0"),
      fechaAlta: aDia(alta),
      fechaBaja: baja ? aDia(baja) : null,
      motivoBaja: baja ? "Baja voluntaria (se va a otro restaurante)" : null,
      activo: !baja,
      notas: p.extranjero ? `Nacionalidad: ${p.extranjero}` : null,
    });
  }
  await prisma.empleado.createMany({ data: filasEmp });
  // préstamos: dos personas de Raza Pruebas pueden reforzar Raza Barquillo
  if (ctx.centros["RZ-BAR"]) await prisma.empleadoCentro.createMany({ data: [IDX("Bruno"), IDX("Sergio")].map((i) => ({ empleadoId: emps[i].id, centroId: ctx.centros["RZ-BAR"] })) });

  // ---------- contratos y complementos ----------
  const contratos: Prisma.ContratoCreateManyInput[] = [];
  const complementos: Prisma.ComplementoSalarialCreateManyInput[] = [];
  /** periodo de actividad de cada persona (para el cuadrante): [desde, hasta|null][] */
  const activo = new Map<string, [string, string | null][]>();
  for (const e of emps) {
    const p = e.p;
    const tipo: TipoC = p.tipo ?? "INDEFINIDO";
    const jornada = p.jornada ?? 40;
    const salarioBase = PUESTOS[p.puesto][1] * (1 + Math.min(0.06, p.antiguedad / 365 * 0.01)); // un poco más con los años
    const salario = Math.round((salarioBase * jornada) / 40 / 10) * 10;
    const cat = categoriaDe(p.puesto);
    const base = { tenantId: t, empleadoId: e.id, jornadaSemanal: jornada, convenioId: convenio.id, categoriaId: cat?.id ?? null, sociedadId, salarioBrutoAnual: salario, porcentajeCotizacion: tipo === "TEMPORAL" ? 33.35 : 32.15, irpfPorcentaje: p.irpf ?? null };
    const tramos: { id: string; tipo: TipoC; desde: string; hasta: string | null; prueba?: string; activo: boolean; motivoFin?: string; notas?: string }[] = [];
    if (p.nombre === "Héctor") {
      // fijo discontinuo de la temporada de terraza: llamamiento de abril a fin del mes pasado
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: sumarDias(e.alta, 200), activo: false, motivoFin: "Fin del llamamiento (temporada de terraza)" });
      tramos.push({ id: id(), tipo, desde: `${hoy.slice(0, 4)}-04-01`, hasta: d(mesB, diasDelMes(mesB).length), activo: false, motivoFin: "Fin del llamamiento (temporada de terraza). Se le volverá a llamar en primavera", notas: "Fijo discontinuo: inactivo hasta el próximo llamamiento" });
    } else if (p.nombre === "Lucía") {
      // fija discontinua: temporada pasada y nuevo llamamiento el día 13 del mes pasado (refuerzo de otoño y Navidad)
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: sumarDias(d(mesA, 1), -1), activo: false, motivoFin: "Fin del llamamiento (temporada de verano)" });
      tramos.push({ id: id(), tipo, desde: d(mesB, 13), hasta: null, activo: true, notas: "Llamamiento de refuerzo para otoño y Navidad" });
    } else if (p.nombre === "Adrián") {
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: sumarDias(hoy, 12), activo: true, notas: "Temporal por aumento de producción. Valorar pasarlo a indefinido" });
    } else if (p.nombre === "Elena") {
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: sumarDias(hoy, 45), activo: true });
    } else if (p.nombre === "Yaiza") {
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: sumarDias(e.alta, 180), prueba: sumarDias(e.alta, 30), activo: true });
    } else if (p.nombre === "Nicolás") {
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: e.baja, activo: false, motivoFin: "Baja: baja voluntaria" });
    } else {
      tramos.push({ id: id(), tipo, desde: e.alta, hasta: null, activo: true });
    }
    activo.set(e.id, tramos.map((x) => [x.desde, x.hasta]));
    for (const x of tramos) {
      contratos.push({ ...base, id: x.id, tipo: x.tipo, fechaInicio: aDia(x.desde), fechaFin: x.hasta ? aDia(x.hasta) : null, finPeriodoPrueba: x.prueba ? aDia(x.prueba) : null, activo: x.activo, motivoFin: x.motivoFin ?? null, notas: x.notas ?? null });
      const comps = p.complementos ?? [];
      const conTransporte = comps.some((c) => c[0] === "PLUS_TRANSPORTE") ? comps : [["PLUS_TRANSPORTE", "Plus de transporte", 62] as [string, string, number], ...comps];
      for (const [concepto, nombre, importe, cotiza] of conTransporte) complementos.push({ tenantId: t, contratoId: x.id, concepto, nombre, importeMensual: importe, cotiza: cotiza ?? true, tributa: true });
    }
  }
  await prisma.contrato.createMany({ data: contratos });
  await prisma.complementoSalarial.createMany({ data: complementos });

  // ---------- ausencias ----------
  const ultimoA = diasDelMes(mesA).length;
  const ultimoB = diasDelMes(mesB).length;
  type TipoAus = "VACACIONES" | "ASUNTOS_PROPIOS" | "PERMISO_RETRIBUIDO" | "BAJA_ENFERMEDAD" | "SIN_JUSTIFICAR";
  const AUS: [string, TipoAus, string, string, "PEDIDA" | "APROBADA" | "RECHAZADA", string?, string?][] = [
    ["Natalia", "VACACIONES", d(mesA, 1), d(mesA, 14), "APROBADA", "Vacaciones de verano (segunda quincena)"],
    ["Jorge", "VACACIONES", d(mesA, 7), d(mesA, 20), "APROBADA"],
    ["Rosa", "VACACIONES", d(mesA, 15), d(mesA, 28), "APROBADA", "Viaje al pueblo"],
    ["Kevin", "PERMISO_RETRIBUIDO", d(mesA, 10), d(mesA, 11), "APROBADA", "Hospitalización de un familiar (2 días del convenio)"],
    ["Álvaro", "VACACIONES", d(mesB, 19), d(mesB, 25), "APROBADA", "Feria del vino en Burdeos (vacaciones)"],
    ["Wilmer", "BAJA_ENFERMEDAD", d(mesB, 8), sumarDias(d(mesB, ultimoB), 2), "APROBADA", "Lumbalgia. Parte de baja y de alta entregados"],
    ["Sergio", "ASUNTOS_PROPIOS", d(mesB, 14), d(mesB, 14), "APROBADA", "Gestiones en el banco"],
    ["Iker", "SIN_JUSTIFICAR", d(mesB, 18), d(mesB, 18), "APROBADA", "No se presentó ni avisó. Se descuenta el día"],
    ["Marta", "VACACIONES", sumarDias(hoy, 10), sumarDias(hoy, 16), "APROBADA"],
    ["Lorena", "ASUNTOS_PROPIOS", sumarDias(hoy, 6), sumarDias(hoy, 6), "PEDIDA", "Boda de una amiga"],
    ["Daniel", "VACACIONES", sumarDias(hoy, 30), sumarDias(hoy, 36), "PEDIDA"],
    ["Patricia", "VACACIONES", sumarDias(hoy, 40), sumarDias(hoy, 46), "PEDIDA", "Pedida desde el portal"],
    ["Ignacio", "VACACIONES", `${hoy.slice(0, 4)}-12-22`, `${hoy.slice(0, 4)}-12-31`, "RECHAZADA", "Navidades con la familia", "Máxima ocupación por las cenas de empresa: elige enero"],
  ];
  await prisma.ausencia.createMany({
    data: AUS.map(([nombre, tipo, desde, hasta, estado, comentario, motivoRechazo]) => ({
      tenantId: t, empleadoId: emps[IDX(nombre)].id, centroId, tipo, desde: aDia(desde), hasta: aDia(hasta), dias: diasEntre(desde, hasta), estado,
      comentario: comentario ?? null, motivoRechazo: motivoRechazo ?? null,
      pedidaPor: nombre === "Patricia" ? usuarioCamarero : null,
      resueltaPor: estado !== "PEDIDA" ? usuarioGerente : null, resueltaEn: estado !== "PEDIDA" ? instanteMadrid(sumarDias(desde, -10) < hoy ? sumarDias(desde, -10) : hoy, "11:00") : null,
    })),
  });
  // días sin turno por ausencia (el día sin justificar sí tenía turno: se queda en el cuadrante sin fichajes)
  const ausente = (empId: string, dia: string) => AUS.some(([nombre, tipo, desde, hasta, estado]) => estado === "APROBADA" && tipo !== "SIN_JUSTIFICAR" && emps[IDX(nombre)].id === empId && desde <= dia && hasta >= dia);
  const sinJustificar = new Set(AUS.filter((a) => a[1] === "SIN_JUSTIFICAR").map((a) => `${emps[IDX(a[0])].id}|${a[2]}`));

  // ---------- cuadrante y fichajes ----------
  const asignaciones: Prisma.AsignacionTurnoCreateManyInput[] = [];
  const fichajes: Prisma.FichajeCreateManyInput[] = [];
  const CENA_EMPRESA = (() => {
    // sábado del mes pasado con una cena de empresa de 70 personas: cocina y sala se quedan 2 h más
    const sabados = diasDelMes(mesB).filter((x) => diaSemana(x) === 5);
    return sabados[2] ?? sabados[0];
  })();
  const enCena = new Set(["Ignacio", "Fátima", "Bruno", "Natalia", "Samuel", "Clara", "Rodrigo", "Patricia", "Sergio", "Ana Sofía", "Omar", "Álvaro", "Mamadou"]);
  const tardones = new Set(["Sergio", "Omar"]);
  const minutos = (m: number) => m * 60_000;
  const turnoDia = (e: Emp, lunes: string): ClaveTurno => {
    if (!e.p.alterna) return e.turnoBase;
    const semana = Math.round(diasEntre(inicioCuadrante, lunes) / 7);
    return semana % 2 === 0 ? e.turnoBase : e.p.alterna;
  };
  for (const e of emps) {
    const nDias = e.p.dias ?? 5;
    // días libres seguidos: la gerente libra domingo y lunes; los parciales trabajan de jueves a domingo
    const libre1 = e.p.nombre === "Marta" ? 6 : nDias === 4 ? 0 : (e.i * 2 + 1) % 7;
    const libres = new Set(Array.from({ length: 7 - nDias }, (_, k) => (libre1 + k) % 7));
    for (let dia = inicioCuadrante; dia <= finCuadrante; dia = sumarDias(dia, 1)) {
      if (libres.has(diaSemana(dia))) continue;
      if (!(activo.get(e.id) ?? []).some(([a, b]) => a <= dia && (!b || b >= dia))) continue;
      if (e.baja && dia > e.baja) continue;
      if (ausente(e.id, dia)) continue;
      const clave = turnoDia(e, lunesDe(dia));
      const turno = TURNOS[clave];
      asignaciones.push({ tenantId: t, centroId, empleadoId: e.id, fecha: aDia(dia), inicio: turno.inicio, fin: turno.fin, inicio2: turno.inicio2 ?? null, fin2: turno.fin2 ?? null, pausaMinutos: turno.pausaMinutos, creadoPor: usuarioGerente, notas: dia === CENA_EMPRESA ? "Cena de empresa (70 pax)" : null });

      // fichajes de lo ya empezado
      const lim = limitesTurno(dia, turno);
      if (lim.inicio.getTime() > ahora) continue;
      if (sinJustificar.has(`${e.id}|${dia}`)) continue; // no vino
      const nombre = e.p.nombre;
      const origen = r() < 0.85 ? "TABLETA" : "MOVIL";
      const pRetraso = tardones.has(nombre) ? 0.18 : 0.04;
      const retraso = r() < pRetraso ? minutos(entre(8, 35)) : 0;
      const entrada = new Date(lim.inicio.getTime() + minutos(entre(-9, 2)) + retraso);
      const finde = [4, 5].includes(diaSemana(dia));
      const cocina = PUESTOS[e.p.puesto][0] === "COCINA";
      let extra = 0;
      if (dia === CENA_EMPRESA && enCena.has(nombre)) extra = minutos(entre(100, 140));
      else if (r() < (cocina && finde ? 0.16 : finde ? 0.08 : 0.03)) extra = minutos(entre(40, 110));
      const salida = new Date(lim.fin.getTime() + minutos(entre(-3, 9)) + extra);
      const olvidaSalida = r() < 0.015;
      const olvidaEntrada = !olvidaSalida && r() < 0.008;
      const marcas: { tipo: "ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA"; momento: Date }[] = [];
      if (!olvidaEntrada) marcas.push({ tipo: "ENTRADA", momento: entrada });
      if (turno.inicio2 && turno.fin2) {
        marcas.push({ tipo: "INICIO_PAUSA", momento: new Date(instanteMadrid(dia, turno.fin).getTime() + minutos(entre(-2, 8))) });
        marcas.push({ tipo: "FIN_PAUSA", momento: new Date(instanteMadrid(dia, turno.inicio2).getTime() + minutos(entre(-6, 3))) });
      } else if (turno.pausaMinutos) {
        const mitad = lim.inicio.getTime() + (lim.fin.getTime() - lim.inicio.getTime()) / 2 + minutos(entre(-20, 20));
        marcas.push({ tipo: "INICIO_PAUSA", momento: new Date(mitad) });
        marcas.push({ tipo: "FIN_PAUSA", momento: new Date(mitad + minutos(turno.pausaMinutos + entre(-2, 4))) });
      }
      if (!olvidaSalida) marcas.push({ tipo: "SALIDA", momento: salida });
      for (const m of marcas) if (m.momento.getTime() < ahora) fichajes.push({ id: id(), tenantId: t, empleadoId: e.id, centroId, tipo: m.tipo, momento: m.momento, origen });
      // la mitad de los olvidos los corrige el gerente al día siguiente (fichaje manual con motivo)
      if ((olvidaSalida || olvidaEntrada) && r() < 0.5 && lim.fin.getTime() + minutos(600) < ahora) {
        const falta = olvidaSalida ? { tipo: "SALIDA" as const, momento: lim.fin } : { tipo: "ENTRADA" as const, momento: lim.inicio };
        fichajes.push({ id: id(), tenantId: t, empleadoId: e.id, centroId, tipo: falta.tipo, momento: falta.momento, origen: "MANUAL", motivoCorreccion: olvidaSalida ? "Olvidó fichar la salida; hora confirmada por el encargado" : "Olvidó fichar la entrada; hora del cuadrante", corregidoPor: usuarioGerente, corregidoEn: new Date(lim.fin.getTime() + minutos(600)), creadoPor: usuarioGerente });
      }
    }
  }
  // una corrección de verdad: entrada fichada por error a otra hora, anulada y sustituida
  const aCorregir = fichajes.find((f) => f.empleadoId === emps[IDX("Omar")].id && f.tipo === "ENTRADA" && (f.momento as Date).getTime() < ahora - minutos(60 * 24 * 20));
  if (aCorregir) {
    const original = aCorregir.momento as Date;
    aCorregir.momento = new Date(original.getTime() - minutos(95));
    aCorregir.anulado = true;
    aCorregir.motivoCorreccion = "Fichó con el PIN de otro compañero";
    aCorregir.corregidoPor = usuarioGerente;
    aCorregir.corregidoEn = new Date(original.getTime() + minutos(300));
    fichajes.push({ id: id(), tenantId: t, empleadoId: aCorregir.empleadoId, centroId, tipo: "ENTRADA", momento: original, origen: "MANUAL", corrigeAId: aCorregir.id, motivoCorreccion: "Fichó con el PIN de otro compañero; hora real según cámara", corregidoPor: usuarioGerente, corregidoEn: aCorregir.corregidoEn, creadoPor: usuarioGerente });
  }
  await enLotes(asignaciones, 1000, (l) => prisma.asignacionTurno.createMany({ data: l }));
  await enLotes(fichajes, 2000, (l) => prisma.fichaje.createMany({ data: l }));
  const semanas: Prisma.CuadranteSemanaCreateManyInput[] = [];
  for (let l = lunesDe(inicioCuadrante); l <= finCuadrante; l = sumarDias(l, 7)) {
    const publicado = l <= sumarDias(lunesHoy, 7);
    semanas.push({ tenantId: t, centroId, lunes: aDia(l), estado: publicado ? "PUBLICADO" : "BORRADOR", publicadoPor: publicado ? usuarioGerente : null, publicadoEn: publicado ? instanteMadrid(sumarDias(l, -4), "18:00") : null });
  }
  await prisma.cuadranteSemana.createMany({ data: semanas, skipDuplicates: true });

  // ---------- certificados y documentos ----------
  const certs: Prisma.CertificadoEmpleadoCreateManyInput[] = [];
  const docs: Prisma.DocumentoEmpleadoCreateManyInput[] = [];
  for (const e of emps) {
    const p = e.p;
    const dep = PUESTOS[p.puesto][0];
    const tocaAlimentos = dep !== "DIRECCION";
    if (tocaAlimentos && p.nombre !== "Yaiza") {
      // caducados: Kevin y Omar; a punto de caducar: Mamadou
      const caduca = p.nombre === "Kevin" ? sumarDias(hoy, -20) : p.nombre === "Omar" ? sumarDias(hoy, -75) : p.nombre === "Mamadou" ? sumarDias(hoy, 12) : sumarDias(hoy, entre(200, 1300));
      certs.push({ tenantId: t, empleadoId: e.id, tipo: "MANIPULADOR", nombre: "Manipulador de alimentos (mayor riesgo)", entidad: "Academia de Hostelería de Madrid", obtenidoEn: aDia(sumarDias(caduca, -1460)), caducaEn: aDia(caduca) });
    }
    if (tocaAlimentos && !["Iker", "Valeria", "Yaiza"].includes(p.nombre)) {
      certs.push({ tenantId: t, empleadoId: e.id, tipo: "ALERGENOS", nombre: "Alérgenos e intolerancias (Reglamento 1169/2011)", entidad: "Formación interna Grupo Raza", obtenidoEn: aDia(sumarDias(hoy, -entre(30, 600))), caducaEn: p.nombre === "Elena" ? aDia(sumarDias(hoy, 8)) : null });
    }
    if (p.nombre !== "Yaiza") certs.push({ tenantId: t, empleadoId: e.id, tipo: "PRL", nombre: "Prevención de riesgos laborales en hostelería (6 h)", entidad: "Servicio de prevención ajeno", obtenidoEn: aDia(e.alta), caducaEn: null });
    if (["Bruno", "Wilmer", "Adrián", "Ignacio"].includes(p.nombre)) certs.push({ tenantId: t, empleadoId: e.id, tipo: "FORMACION_INTERNA", nombre: "Maduración y despiece de vacuno", entidad: "Formación interna Grupo Raza", obtenidoEn: aDia(sumarDias(hoy, -entre(60, 400))), caducaEn: null });
    if (p.nombre === "Álvaro") certs.push({ tenantId: t, empleadoId: e.id, tipo: "OTRO", nombre: "WSET nivel 3 en vinos", entidad: "Wine & Spirit Education Trust", obtenidoEn: aDia(sumarDias(hoy, -900)), caducaEn: null });

    docs.push({ tenantId: t, empleadoId: e.id, tipo: "DNI", nombre: p.extranjero ? "NIE / tarjeta de residencia (copia)" : "DNI (copia)", caducaEn: aDia(sumarDias(hoy, entre(300, 3000))), subidoPor: usuarioGerente });
    docs.push({ tenantId: t, empleadoId: e.id, tipo: "CONTRATO", nombre: `Contrato firmado (${e.alta.slice(0, 4)})`, subidoPor: usuarioGerente });
    if (p.extranjero && !UE.has(p.extranjero)) {
      const caduca = p.nombre === "Samuel" ? sumarDias(hoy, 21) : p.nombre === "Kevin" ? sumarDias(hoy, -5) : sumarDias(hoy, entre(150, 900));
      docs.push({ tenantId: t, empleadoId: e.id, tipo: "PERMISO_TRABAJO", nombre: p.nombre === "Kevin" ? "Autorización de residencia y trabajo (renovación en trámite)" : "Autorización de residencia y trabajo", caducaEn: aDia(caduca), subidoPor: usuarioGerente });
    }
    if (p.nombre === "Wilmer") docs.push({ tenantId: t, empleadoId: e.id, tipo: "OTRO", nombre: "Parte de baja por incapacidad temporal", subidoPor: usuarioGerente });
    if (p.nombre === "Nicolás") docs.push({ tenantId: t, empleadoId: e.id, tipo: "OTRO", nombre: "Carta de baja voluntaria (preaviso de 15 días)", subidoPor: usuarioGerente });
  }
  await prisma.certificadoEmpleado.createMany({ data: certs });
  await prisma.documentoEmpleado.createMany({ data: docs });

  // ---------- selección ----------
  const oferta1 = id();
  const oferta2 = id();
  await prisma.ofertaEmpleo.createMany({
    data: [
      { id: oferta1, tenantId: t, centroId, puestoId: puestos.get("Parrillero/a"), titulo: "Parrillero/a con experiencia en brasa · Raza Pruebas", descripcion: "Parrilla de carbón y carne madurada. Mínimo 2 años en parrilla o brasa. Turno de tarde-noche, 2 días libres seguidos.", tipoContrato: "INDEFINIDO", jornada: 40, plazas: 1, publicadaEn: instanteMadrid(sumarDias(hoy, -18), "10:00"), creadoPor: usuarioGerente },
      { id: oferta2, tenantId: t, centroId, puestoId: puestos.get("Runner"), titulo: "Runner fines de semana · Raza Pruebas", descripcion: "Viernes a domingo, cenas. Ideal para estudiantes.", tipoContrato: "PARCIAL", jornada: 16, plazas: 2, publicadaEn: instanteMadrid(sumarDias(hoy, -6), "10:00"), creadoPor: usuarioGerente },
    ],
  });
  const consiente = instanteMadrid(sumarDias(hoy, -10), "12:00");
  const borrar = aDia(sumarDias(hoy, 355));
  await prisma.candidato.createMany({
    data: [
      { tenantId: t, ofertaId: oferta1, nombre: "Gonzalo", apellidos: "Arias Bermejo", telefono: telefono(), email: "gonzalo.arias@ejemplo.es", origen: "InfoJobs", estado: "PRUEBA", notas: "Prueba en parrilla el próximo martes de 18:00 a 23:00", consentimientoEn: consiente, borrarEn: borrar },
      { tenantId: t, ofertaId: oferta1, nombre: "Thiago", apellidos: "Ferreira Lima", telefono: telefono(), origen: "Recomendación de Wilmer", estado: "ENTREVISTA", notas: "Ha trabajado en un asador de Buenos Aires", consentimientoEn: consiente, borrarEn: borrar },
      { tenantId: t, ofertaId: oferta1, nombre: "Raquel", apellidos: "Soto Villa", email: "raquel.soto@ejemplo.es", origen: "Web", estado: "RECIBIDO", consentimientoEn: consiente, borrarEn: borrar },
      { tenantId: t, ofertaId: oferta1, nombre: "Javier", apellidos: "Muñoz Pardo", telefono: telefono(), origen: "InfoJobs", estado: "DESCARTADO", notas: "Sin experiencia en brasa", borrarEn: aDia(sumarDias(hoy, 80)) },
      { tenantId: t, ofertaId: oferta1, nombre: "Mihai", apellidos: "Ionescu", telefono: telefono(), origen: "Currículum en mano", estado: "OFERTA", notas: "Oferta enviada: 25.200 € brutos, incorporación el lunes", consentimientoEn: consiente, borrarEn: borrar },
      { tenantId: t, ofertaId: oferta2, nombre: "Lucas", apellidos: "Prieto Gil", telefono: telefono(), email: "lucas.prieto@ejemplo.es", origen: "Web", estado: "RECIBIDO", consentimientoEn: consiente, borrarEn: borrar },
      { tenantId: t, ofertaId: oferta2, nombre: "Aitana", apellidos: "León Ramos", telefono: telefono(), origen: "Instagram", estado: "ENTREVISTA", consentimientoEn: consiente, borrarEn: borrar },
      // sin teléfono ni correo, por probar el aviso de datos de contacto
      { tenantId: t, ofertaId: oferta2, nombre: "Hugo", apellidos: "Serrano", origen: "Currículum en mano", estado: "RECIBIDO", notas: "Dejó el CV en la barra sin teléfono", borrarEn: aDia(sumarDias(hoy, 85)) },
    ],
  });

  // ---------- nóminas de los dos últimos meses cerrados ----------
  for (const mes of [mesA, mesB]) {
    const { nominas } = await prepararNominasMes(prisma, t, [centroId], mes);
    await guardarNominas(prisma, t, nominas, { estado: "CERRADA", usuarioId: usuarioGerente });
  }
  // mes A: pagadas el día 2 del mes siguiente. Mes B: pagadas el 3 de este mes, salvo dos pendientes de revisar
  await prisma.nomina.updateMany({ where: { tenantId: t, centroId, periodo: mesA }, data: { estado: "PAGADA", fechaPago: aDia(d(mesB, 2)) } });
  const pendientes = [emps[IDX("Wilmer")].id, emps[IDX("Nicolás")].id];
  await prisma.nomina.updateMany({ where: { tenantId: t, centroId, periodo: mesB, empleadoId: { notIn: pendientes } }, data: { estado: "PAGADA", fechaPago: aDia(d(mesActual, 3)) } });
  await prisma.nomina.updateMany({ where: { tenantId: t, centroId, periodo: mesB, empleadoId: pendientes[0] }, data: { notas: "Pendiente: la gestoría tiene que revisar el parte de baja (IT) antes de pagar" } });
  await prisma.nomina.updateMany({ where: { tenantId: t, centroId, periodo: mesB, empleadoId: pendientes[1] }, data: { notas: "Pendiente: falta el finiquito (vacaciones no disfrutadas), lo calcula la gestoría" } });

  console.log(`  personal: ${emps.length} personas, ${contratos.length} contratos, ${asignaciones.length} turnos, ${fichajes.length} fichajes, ${AUS.length} ausencias, ${certs.length} certificados, nóminas de ${mesA} y ${mesB} (${ultimoA} y ${ultimoB} días)`);
}
