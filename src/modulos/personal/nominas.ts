/**
 * Cálculo de nóminas mensuales (DE EJEMPLO, a comprobar con la gestoría).
 * La nómina oficial la hace la gestoría; esto sirve para conocer el coste de personal por centro
 * y mes, revisar lo que mandará la gestoría y enlazar con Contabilidad y el Cuadro de mando.
 *
 * Sin dependencias de servidor: lo usan el servicio (pantalla «Nóminas») y la semilla.
 *
 * Cómo se calcula (todo mes comercial de 30 días):
 * 1. Sueldo de una paga = salario bruto anual del contrato ÷ pagas anuales (14 por defecto).
 *    Se reparte en «Salario base» (tabla del convenio, proporcional a la jornada) y «Mejora voluntaria»
 *    (lo que se paga por encima del convenio).
 * 2. Complementos fijos del contrato (transporte, responsabilidad, nocturnidad…), importe mensual.
 * 3. Prorrata de pagas extra = sueldo de una paga × (pagas − 12) ÷ 12, si están prorrateadas.
 *    Si no, regla general (devengo semestral): la paga de verano se gana del 1 de enero al 30 de junio
 *    y se cobra en junio; la de Navidad, del 1 de julio al 31 de diciembre y se cobra en diciembre.
 *    Se paga en proporción a los días del semestre en alta con contrato, sin contar los de IT ni los
 *    días sin sueldo. Si el empleado se da de baja, en el mes de la baja se paga la parte ganada
 *    del semestre (finiquito). Muchos convenios cambian los periodos: a comprobar con la gestoría.
 * 4. Todo lo anterior se paga por los días en alta, menos los días de baja (IT) y los días sin sueldo.
 * 5. Incapacidad temporal por enfermedad común o accidente no laboral: días 1-3 sin prestación;
 *    4-15 al 60 % a cargo de la empresa; 16-20 al 60 % y desde el 21 al 75 % en pago delegado (lo
 *    adelanta la empresa y lo descuenta de los seguros sociales). Por accidente de trabajo: el día del
 *    accidente se paga como trabajado y desde el día siguiente, 75 % en pago delegado (de la mutua).
 *    Base reguladora diaria = base de cotización normal ÷ 30 (la real del accidente de trabajo suma la
 *    media de horas extra del año anterior: a comprobar con la gestoría).
 * 6. Horas extra (horasExtraDeJornadas: lo fichado por encima del turno del cuadrante) al precio de la
 *    hora ordinaria × 1,25. A tiempo parcial (esTiempoParcial: contrato «Tiempo parcial» o jornada de
 *    menos de 40 h) son «horas complementarias», sin recargo, y cotizan como salario normal.
 * 7. Base de contingencias comunes = sueldo + complementos que cotizan + prorrata (aunque las pagas no
 *    se prorrateen), por los días en alta, con tope máximo. Base de profesionales = la anterior + horas extra.
 * 8. Seguridad Social, IRPF, neto y coste empresa con los tipos de TIPOS_NOMINA.
 */
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { aDia, diaISO, diasDelMes, diasEntre, horasTurno, instanteMadrid, sumarDias } from "./fechas";
import { calcularJornadas } from "./jornadas";
import type { Turno } from "./fechas";

// =====================================================================
// Tipos y porcentajes DE EJEMPLO (2026). A comprobar con la gestoría.
// =====================================================================

export const TIPOS_NOMINA = {
  /** Seguridad Social a cargo del trabajador (%) */
  trabajador: { comunes: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, formacion: 0.1, mei: 0.15, horasExtra: 4.7 },
  /** Seguridad Social a cargo de la empresa (%). AT/EP = epígrafe de restauración (de ejemplo). */
  empresa: { comunes: 23.6, desempleoIndefinido: 5.5, desempleoTemporal: 6.7, fogasa: 0.2, formacion: 0.6, mei: 0.75, atep: 1.5, horasExtra: 23.6 },
  /** Tope máximo de la base de cotización mensual (€) */
  baseMaxima: 5101.2,
  /** Recargo de las horas extra sobre la hora ordinaria */
  recargoHorasExtra: 1.25,
  /** Horas anuales si el convenio no las tiene */
  horasAnualesPorDefecto: 1776,
  /** Prestación por incapacidad temporal (enfermedad común y accidente no laboral; el accidente de trabajo, 75 % desde el día siguiente) */
  it: { diasSinPrestacion: 3, finEmpresa: 15, finSesenta: 20, pctSesenta: 60, pctSetentaYCinco: 75, pctAccidenteTrabajo: 75 },
  /** Jornada semanal completa: por debajo, el contrato es a tiempo parcial */
  jornadaCompleta: 40,
  /** Fichado por encima del turno que no cuenta como hora extra (minutos por jornada) */
  toleranciaExtraMinutos: 15,
} as const;

/** A tiempo parcial: contrato «Tiempo parcial» o jornada por debajo de la completa (40 h). Una sola regla para el cálculo y la pantalla. */
export function esTiempoParcial(tipoContrato: string | null | undefined, jornadaSemanal: number): boolean {
  return tipoContrato === "PARCIAL" || (jornadaSemanal > 0 && jornadaSemanal < TIPOS_NOMINA.jornadaCompleta);
}

/**
 * Horas extra (o complementarias) de un periodo: por cada jornada fichada, lo que pasa del turno del
 * cuadrante de ese día si supera la tolerancia (15 min); una jornada fichada sin turno cuenta entera.
 * El total se redondea hacia abajo a cuartos de hora. Única regla: la usan la nómina y el CSV de la gestoría.
 */
export function horasExtraDeJornadas(jornadas: { dia: string; horas: number }[], turnos: { dia: string; turno: Turno }[]): number {
  let extra = 0;
  for (const j of jornadas) {
    const previstas = turnos.filter((t) => t.dia === j.dia).reduce((s, t) => s + horasTurno(t.turno), 0);
    const exceso = j.horas - previstas;
    if (exceso * 60 > TIPOS_NOMINA.toleranciaExtraMinutos) extra += exceso;
  }
  return Math.floor(extra * 4) / 4;
}

/** Retención de IRPF orientativa por salario anual (la real depende de la situación personal: la fija la gestoría). */
export function irpfOrientativo(salarioAnual: number): number {
  if (salarioAnual <= 16000) return 2;
  if (salarioAnual <= 20000) return 7;
  if (salarioAnual <= 24000) return 11;
  if (salarioAnual <= 30000) return 14;
  if (salarioAnual <= 40000) return 17;
  return 21;
}

// =====================================================================
// Cálculo de una nómina (función pura)
// =====================================================================

export interface ComplementoEntrada {
  concepto: string;
  nombre: string;
  importeMensual: number;
  cotiza: boolean;
  tributa: boolean;
}

export interface EntradaNomina {
  mes: string; // "2026-10"
  diasAlta: number; // días naturales en alta en el mes
  diasMes: number; // días naturales del mes
  salarioAnual: number; // bruto anual del contrato (ya ajustado a la jornada)
  salarioConvenioAnual: number; // tabla del convenio para su categoría y jornada (0 = todo es salario base)
  pagasAnuales: number;
  pagasProrrateadas: boolean;
  complementos: ComplementoEntrada[];
  jornadaSemanal: number;
  horasAnualesConvenio: number;
  parcial: boolean;
  temporal: boolean;
  horasExtra: number;
  /** días de IT del mes: por enfermedad común según el día de la baja en que caen; `accidente` = días de IT por accidente de trabajo (desde el día siguiente al accidente) */
  diasIT: { sinPrestacion: number; empresa: number; sesenta: number; setentaYCinco: number; accidente?: number };
  /** Pagas extra sin prorratear: la que toca cobrar este mes y la parte ganada (0 a 1). null = este mes no toca. */
  pagaExtra?: { nombre: string; fraccion: number; dias: number } | null;
  diasSinSueldo: number;
  irpfPorcentaje: number | null; // null = orientativo
  otrasDeducciones?: { nombre: string; importe: number }[];
}

export interface LineaCalculada {
  orden: number;
  tipo: "DEVENGO" | "DEDUCCION" | "EMPRESA";
  concepto: string;
  nombre: string;
  cantidad?: number;
  precio?: number;
  base?: number;
  porcentaje?: number;
  importe: number;
}

export interface ResultadoNomina {
  salarioBase: number;
  complementos: number;
  importeHorasExtra: number;
  prorrataPagas: number;
  prestacionIT: number;
  pagoDelegadoIT: number;
  devengado: number;
  baseCotizacion: number;
  baseProfesionales: number;
  ssTrabajador: number;
  ssEmpresa: number;
  irpfPorcentaje: number;
  irpf: number;
  otrasDeducciones: number;
  neto: number;
  costeEmpresa: number;
  diasCotizados: number;
  diasITTotal: number;
  lineas: LineaCalculada[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularNomina(e: EntradaNomina): ResultadoNomina {
  const T = TIPOS_NOMINA;
  const lineas: LineaCalculada[] = [];
  let orden = 0;
  const linea = (l: Omit<LineaCalculada, "orden" | "importe"> & { importe: number }) => {
    const importe = r2(l.importe);
    if (importe === 0 && l.tipo !== "DEVENGO") return 0;
    if (importe === 0 && l.concepto !== "SALARIO_BASE") return 0;
    lineas.push({ ...l, importe, orden: orden++ });
    return importe;
  };

  // días: mes comercial de 30
  const diasAlta30 = e.diasAlta >= e.diasMes ? 30 : Math.min(30, e.diasAlta);
  const diasAT = e.diasIT.accidente ?? 0;
  const diasIT = e.diasIT.sinPrestacion + e.diasIT.empresa + e.diasIT.sesenta + e.diasIT.setentaYCinco + diasAT;
  const diasPagados = Math.max(0, diasAlta30 - diasIT - e.diasSinSueldo);
  const fAlta = diasAlta30 / 30;
  const fPago = diasPagados / 30;

  const paga = e.salarioAnual / e.pagasAnuales;
  const pagaConvenio = Math.min(paga, e.salarioConvenioAnual > 0 ? e.salarioConvenioAnual / e.pagasAnuales : paga);
  const mejora = paga - pagaConvenio;
  const extras = Math.max(0, e.pagasAnuales - 12);

  // ---- devengos ----
  const salarioBase = linea({ tipo: "DEVENGO", concepto: "SALARIO_BASE", nombre: "Salario base", cantidad: diasPagados, precio: pagaConvenio / 30, importe: pagaConvenio * fPago });
  let complementos = linea({ tipo: "DEVENGO", concepto: "MEJORA_VOLUNTARIA", nombre: "Mejora voluntaria (absorbible)", cantidad: diasPagados, precio: mejora / 30, importe: mejora * fPago });
  let noTributa = 0;
  let complementosCotizan = 0;
  for (const c of e.complementos) {
    const imp = linea({ tipo: "DEVENGO", concepto: c.concepto, nombre: c.nombre, cantidad: diasPagados, precio: c.importeMensual / 30, importe: c.importeMensual * fPago });
    complementos += imp;
    if (!c.tributa) noTributa += imp;
    if (c.cotiza) complementosCotizan += c.importeMensual;
  }
  let prorrataPagas = 0;
  if (extras > 0 && e.pagasProrrateadas) {
    prorrataPagas = linea({ tipo: "DEVENGO", concepto: "PRORRATA_PAGAS", nombre: `Prorrata de ${extras} pagas extra`, cantidad: diasPagados, base: paga, importe: ((paga * extras) / 12) * fPago });
  } else if (extras > 0 && e.pagaExtra && e.pagaExtra.fraccion > 0) {
    // las pagas extra (2 normalmente) se reparten entre verano y Navidad, en proporción a lo ganado del semestre
    const fraccion = Math.min(1, e.pagaExtra.fraccion);
    prorrataPagas = linea({ tipo: "DEVENGO", concepto: "PAGA_EXTRA", nombre: e.pagaExtra.nombre, cantidad: e.pagaExtra.dias, base: paga, importe: paga * (extras / 2) * fraccion });
  }

  // horas extra (o complementarias)
  const horasAnuales = (e.horasAnualesConvenio || T.horasAnualesPorDefecto) * (e.jornadaSemanal / 40 || 1);
  const precioHora = horasAnuales > 0 ? e.salarioAnual / horasAnuales : 0;
  let importeHorasExtra = 0;
  let horasComplementarias = 0;
  if (e.horasExtra > 0) {
    if (e.parcial) {
      horasComplementarias = linea({ tipo: "DEVENGO", concepto: "HORAS_COMPLEMENTARIAS", nombre: "Horas complementarias", cantidad: e.horasExtra, precio: precioHora, importe: e.horasExtra * precioHora });
      importeHorasExtra = horasComplementarias;
    } else {
      const p = precioHora * T.recargoHorasExtra;
      importeHorasExtra = linea({ tipo: "DEVENGO", concepto: "HORAS_EXTRA", nombre: "Horas extraordinarias", cantidad: e.horasExtra, precio: p, importe: e.horasExtra * p });
    }
  }

  // base de cotización normal del mes (con prorrata aunque las pagas no se prorrateen)
  const baseMensualNormal = paga + complementosCotizan + (paga * extras) / 12;
  const baseReguladoraDia = baseMensualNormal / 30;
  // incapacidad temporal
  const itEmpresa = linea({ tipo: "DEVENGO", concepto: "IT_EMPRESA", nombre: `Incapacidad temporal a cargo de la empresa (${T.it.pctSesenta} %)`, cantidad: e.diasIT.empresa, precio: (baseReguladoraDia * T.it.pctSesenta) / 100, importe: (e.diasIT.empresa * baseReguladoraDia * T.it.pctSesenta) / 100 });
  const it60 = linea({ tipo: "DEVENGO", concepto: "IT_DELEGADO_60", nombre: `Incapacidad temporal, pago delegado (${T.it.pctSesenta} %)`, cantidad: e.diasIT.sesenta, precio: (baseReguladoraDia * T.it.pctSesenta) / 100, importe: (e.diasIT.sesenta * baseReguladoraDia * T.it.pctSesenta) / 100 });
  const it75 = linea({ tipo: "DEVENGO", concepto: "IT_DELEGADO_75", nombre: `Incapacidad temporal, pago delegado (${T.it.pctSetentaYCinco} %)`, cantidad: e.diasIT.setentaYCinco, precio: (baseReguladoraDia * T.it.pctSetentaYCinco) / 100, importe: (e.diasIT.setentaYCinco * baseReguladoraDia * T.it.pctSetentaYCinco) / 100 });
  const pctAT = T.it.pctAccidenteTrabajo;
  const itAT = linea({ tipo: "DEVENGO", concepto: "IT_ACCIDENTE_TRABAJO", nombre: `Incapacidad temporal por accidente de trabajo, pago delegado (${pctAT} %)`, cantidad: diasAT, precio: (baseReguladoraDia * pctAT) / 100, importe: (diasAT * baseReguladoraDia * pctAT) / 100 });
  const pagoDelegadoIT = r2(it60 + it75 + itAT);
  const prestacionIT = r2(itEmpresa + pagoDelegadoIT);

  const devengado = r2(salarioBase + complementos + prorrataPagas + importeHorasExtra + prestacionIT);

  // ---- bases ----
  const fCotiza = Math.max(0, diasAlta30 - e.diasSinSueldo) / 30;
  let baseCotizacion = r2(Math.min(T.baseMaxima, baseMensualNormal * fCotiza + horasComplementarias));
  const horasExtraEstructurales = e.parcial ? 0 : importeHorasExtra;
  const baseProfesionales = r2(Math.min(T.baseMaxima, baseCotizacion + horasExtraEstructurales));
  if (fAlta === 0) baseCotizacion = 0;

  // ---- Seguridad Social del trabajador ----
  const tt = T.trabajador;
  const desempleoT = e.temporal ? tt.desempleoTemporal : tt.desempleoIndefinido;
  let ssTrabajador = 0;
  ssTrabajador += linea({ tipo: "DEDUCCION", concepto: "SS_COMUNES", nombre: "Contingencias comunes", base: baseCotizacion, porcentaje: tt.comunes, importe: (baseCotizacion * tt.comunes) / 100 });
  ssTrabajador += linea({ tipo: "DEDUCCION", concepto: "SS_MEI", nombre: "Mecanismo de equidad intergeneracional", base: baseCotizacion, porcentaje: tt.mei, importe: (baseCotizacion * tt.mei) / 100 });
  ssTrabajador += linea({ tipo: "DEDUCCION", concepto: "SS_DESEMPLEO", nombre: "Desempleo", base: baseProfesionales, porcentaje: desempleoT, importe: (baseProfesionales * desempleoT) / 100 });
  ssTrabajador += linea({ tipo: "DEDUCCION", concepto: "SS_FORMACION", nombre: "Formación profesional", base: baseProfesionales, porcentaje: tt.formacion, importe: (baseProfesionales * tt.formacion) / 100 });
  ssTrabajador += linea({ tipo: "DEDUCCION", concepto: "SS_HORAS_EXTRA", nombre: "Horas extraordinarias", base: horasExtraEstructurales, porcentaje: tt.horasExtra, importe: (horasExtraEstructurales * tt.horasExtra) / 100 });
  ssTrabajador = r2(ssTrabajador);

  // ---- IRPF ----
  const irpfPorcentaje = e.irpfPorcentaje ?? irpfOrientativo(e.salarioAnual);
  const baseIRPF = Math.max(0, devengado - noTributa);
  const irpf = linea({ tipo: "DEDUCCION", concepto: "IRPF", nombre: "Retención IRPF", base: baseIRPF, porcentaje: irpfPorcentaje, importe: (baseIRPF * irpfPorcentaje) / 100 });

  let otrasDeducciones = 0;
  for (const d of e.otrasDeducciones ?? []) otrasDeducciones += linea({ tipo: "DEDUCCION", concepto: "OTRA", nombre: d.nombre, importe: d.importe });
  otrasDeducciones = r2(otrasDeducciones);

  // ---- Seguridad Social de la empresa ----
  const te = T.empresa;
  const desempleoE = e.temporal ? te.desempleoTemporal : te.desempleoIndefinido;
  let ssEmpresa = 0;
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_COMUNES", nombre: "Contingencias comunes (empresa)", base: baseCotizacion, porcentaje: te.comunes, importe: (baseCotizacion * te.comunes) / 100 });
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_MEI", nombre: "Mecanismo de equidad intergeneracional (empresa)", base: baseCotizacion, porcentaje: te.mei, importe: (baseCotizacion * te.mei) / 100 });
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_ATEP", nombre: "Accidentes de trabajo y enfermedades profesionales", base: baseProfesionales, porcentaje: te.atep, importe: (baseProfesionales * te.atep) / 100 });
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_DESEMPLEO", nombre: "Desempleo (empresa)", base: baseProfesionales, porcentaje: desempleoE, importe: (baseProfesionales * desempleoE) / 100 });
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_FOGASA", nombre: "Fondo de Garantía Salarial", base: baseProfesionales, porcentaje: te.fogasa, importe: (baseProfesionales * te.fogasa) / 100 });
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_FORMACION", nombre: "Formación profesional (empresa)", base: baseProfesionales, porcentaje: te.formacion, importe: (baseProfesionales * te.formacion) / 100 });
  ssEmpresa += linea({ tipo: "EMPRESA", concepto: "SSE_HORAS_EXTRA", nombre: "Horas extraordinarias (empresa)", base: horasExtraEstructurales, porcentaje: te.horasExtra, importe: (horasExtraEstructurales * te.horasExtra) / 100 });
  ssEmpresa = r2(ssEmpresa);

  const neto = r2(devengado - ssTrabajador - irpf - otrasDeducciones);
  const costeEmpresa = r2(devengado + ssEmpresa - pagoDelegadoIT);

  return {
    salarioBase: r2(salarioBase),
    complementos: r2(complementos),
    importeHorasExtra: r2(importeHorasExtra),
    prorrataPagas: r2(prorrataPagas),
    prestacionIT,
    pagoDelegadoIT,
    devengado,
    baseCotizacion,
    baseProfesionales,
    ssTrabajador,
    ssEmpresa,
    irpfPorcentaje,
    irpf,
    otrasDeducciones,
    neto,
    costeEmpresa,
    diasCotizados: diasAlta30,
    diasITTotal: diasIT,
    lineas,
  };
}

// =====================================================================
// Preparar las nóminas de un mes leyendo la base de datos
// =====================================================================

type Cliente = PrismaClient | Prisma.TransactionClient;

export interface NominaPreparada {
  empleadoId: string;
  centroId: string;
  sociedadId: string | null;
  contratoId: string;
  periodo: string;
  desde: string;
  hasta: string;
  puesto: string | null;
  categoria: string | null;
  tipoContrato: string;
  jornadaSemanal: number;
  horasTrabajadas: number;
  horasExtra: number;
  diasSinSueldo: number;
  resultado: ResultadoNomina;
}

const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);

/** Semestre de devengo de la paga extra (regla general): enero-junio (verano) y julio-diciembre (Navidad). */
function inicioSemestre(mes: string): string {
  return `${mes.slice(0, 4)}-${mes.slice(5) <= "06" ? "01" : "07"}-01`;
}
function finSemestre(mes: string): string {
  return `${mes.slice(0, 4)}-${mes.slice(5) <= "06" ? "06-30" : "12-31"}`;
}

/**
 * Días del semestre (desde `semIni` hasta `hasta`, incluidos) que generan paga extra: en alta, con un
 * contrato que cubre el día y sin baja (IT) ni ausencia sin sueldo aprobada ese día.
 */
function diasDevengoPagaExtra(
  e: { fechaAlta: Date; fechaBaja: Date | null; contratos: { fechaInicio: Date; fechaFin: Date | null }[]; ausencias: { tipo: string; desde: Date; hasta: Date }[] },
  semIni: string,
  hasta: string,
): number {
  const alta = diaISO(e.fechaAlta);
  const baja = e.fechaBaja ? diaISO(e.fechaBaja) : null;
  const sinDevengo = ["BAJA_ENFERMEDAD", "BAJA_ACCIDENTE", "SIN_JUSTIFICAR", "EXCEDENCIA"];
  let n = 0;
  for (let d = max(semIni, alta); d <= hasta && (!baja || d <= baja); d = sumarDias(d, 1)) {
    const conContrato = e.contratos.some((c) => diaISO(c.fechaInicio) <= d && (!c.fechaFin || diaISO(c.fechaFin) >= d));
    if (!conContrato) continue;
    const ausente = e.ausencias.some((a) => sinDevengo.includes(a.tipo) && diaISO(a.desde) <= d && diaISO(a.hasta) >= d && !(a.tipo === "BAJA_ACCIDENTE" && diaISO(a.desde) === d));
    if (!ausente) n++;
  }
  return n;
}

/** Días de IT del mes, clasificados por el día de la baja en que caen (la baja puede venir del mes anterior). */
function tramosIT(desdeBaja: string, hastaBaja: string, ini: string, fin: string) {
  const r = { sinPrestacion: 0, empresa: 0, sesenta: 0, setentaYCinco: 0 };
  const T = TIPOS_NOMINA.it;
  const a = max(desdeBaja, ini);
  const b = min(hastaBaja, fin);
  if (a > b) return r;
  for (let d = a; d <= b; d = sumarDias(d, 1)) {
    const n = diasEntre(desdeBaja, d); // 1 = primer día de baja
    if (n <= T.diasSinPrestacion) r.sinPrestacion++;
    else if (n <= T.finEmpresa) r.empresa++;
    else if (n <= T.finSesenta) r.sesenta++;
    else r.setentaYCinco++;
  }
  return r;
}

/**
 * Calcula (sin guardar) las nóminas de un mes de los empleados cuyo centro principal está en `centroIds`.
 * Horas extra = por cada jornada fichada, lo que pasa del turno del cuadrante (más de 15 min);
 * una jornada fichada sin turno cuenta entera. Se redondea a cuartos de hora.
 * Empleados sin contrato en el mes: no tienen nómina (salen en `sinContrato`).
 */
export async function prepararNominasMes(prisma: Cliente, tenantId: string, centroIds: string[], mes: string): Promise<{ nominas: NominaPreparada[]; sinContrato: string[] }> {
  const dias = diasDelMes(mes);
  const ini = dias[0];
  const fin = dias[dias.length - 1];
  const empleados = await prisma.empleado.findMany({
    where: { tenantId, centroPrincipalId: { in: centroIds }, fechaAlta: { lte: aDia(fin) }, OR: [{ fechaBaja: null }, { fechaBaja: { gte: aDia(ini) } }] },
    include: {
      puesto: true,
      contratos: { include: { categoria: true, convenio: true, complementos: { where: { activo: true } } } },
      asignaciones: { where: { fecha: { gte: aDia(ini), lte: aDia(fin) } } },
      // desde el inicio del semestre: hacen falta para la paga extra sin prorratear
      ausencias: { where: { estado: "APROBADA", desde: { lte: aDia(fin) }, hasta: { gte: aDia(inicioSemestre(mes)) } } },
    },
  });
  const fichajes = await prisma.fichaje.findMany({
    where: { tenantId, empleadoId: { in: empleados.map((e) => e.id) }, momento: { gte: instanteMadrid(ini, "05:00"), lt: instanteMadrid(sumarDias(fin, 1), "05:00") } },
  });
  const jornadas = calcularJornadas(fichajes);
  const centros = await prisma.centro.findMany({ where: { tenantId, id: { in: centroIds } }, select: { id: true, sociedadId: true } });
  const sociedadCentro = new Map(centros.map((c) => [c.id, c.sociedadId]));

  const nominas: NominaPreparada[] = [];
  const sinContrato: string[] = [];
  for (const e of empleados) {
    // contratos que tocan el mes: se toma el último (el que manda a fin de mes)
    const delMes = e.contratos
      .filter((c) => diaISO(c.fechaInicio) <= fin && (!c.fechaFin || diaISO(c.fechaFin) >= ini))
      .sort((a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime());
    const c = delMes[0];
    if (!c || !c.salarioBrutoAnual) {
      sinContrato.push(e.id);
      continue;
    }
    // primer día cubierto: el mayor entre el 1 del mes, el alta y el inicio del contrato más antiguo del mes
    const inicioContratos = delMes.map((x) => diaISO(x.fechaInicio)).reduce(min);
    const desde = max(max(ini, diaISO(e.fechaAlta)), inicioContratos);
    const finContrato = c.fechaFin ? diaISO(c.fechaFin) : fin;
    const hasta = min(min(fin, e.fechaBaja ? diaISO(e.fechaBaja) : fin), finContrato);
    if (desde > hasta) continue;
    const diasAlta = diasEntre(desde, hasta);

    // ausencias
    const it = { sinPrestacion: 0, empresa: 0, sesenta: 0, setentaYCinco: 0, accidente: 0 };
    let diasSinSueldo = 0;
    for (const a of e.ausencias) {
      const d1 = diaISO(a.desde);
      const d2 = diaISO(a.hasta);
      if (a.tipo === "BAJA_ACCIDENTE") {
        // accidente de trabajo: el día del accidente se paga como trabajado; la prestación, desde el día siguiente
        const a1 = max(sumarDias(d1, 1), desde);
        const a2 = min(d2, hasta);
        if (a1 <= a2) it.accidente += diasEntre(a1, a2);
      } else if (a.tipo === "BAJA_ENFERMEDAD") {
        const t = tramosIT(d1, d2, desde, hasta);
        it.sinPrestacion += t.sinPrestacion;
        it.empresa += t.empresa;
        it.sesenta += t.sesenta;
        it.setentaYCinco += t.setentaYCinco;
      } else if (a.tipo === "SIN_JUSTIFICAR" || a.tipo === "EXCEDENCIA") {
        const a1 = max(d1, desde);
        const a2 = min(d2, hasta);
        if (a1 <= a2) diasSinSueldo += diasEntre(a1, a2);
      }
    }

    // horas trabajadas y extra (de los fichajes, contra el cuadrante)
    const suyas = jornadas.filter((j) => j.empleadoId === e.id && j.dia >= desde && j.dia <= hasta);
    const horasTrabajadas = suyas.reduce((s, j) => s + j.horas, 0);
    const horasExtra = horasExtraDeJornadas(suyas, e.asignaciones.map((a) => ({ dia: diaISO(a.fecha), turno: a })));

    // paga extra sin prorratear: en junio y diciembre, o en el mes de la baja (la parte ganada del semestre)
    const bajaEnMes = !!e.fechaBaja && diaISO(e.fechaBaja) >= ini && diaISO(e.fechaBaja) <= fin;
    const mesPaga = ["06", "12"].includes(mes.slice(5));
    let pagaExtra: EntradaNomina["pagaExtra"] = null;
    if (!c.pagasProrrateadas && c.pagasAnuales > 12 && (mesPaga || bajaEnMes)) {
      const verano = mes.slice(5) <= "06";
      const devengo = diasDevengoPagaExtra(e, inicioSemestre(mes), hasta);
      pagaExtra = { nombre: `${verano ? "Paga extra de verano" : "Paga extra de Navidad"}${mesPaga ? "" : " (parte ganada, por la baja)"}`, fraccion: devengo / diasEntre(inicioSemestre(mes), finSemestre(mes)), dias: devengo };
    }

    const jornada = Number(c.jornadaSemanal);
    const salarioConvenio = c.categoria?.salarioBaseAnual ? (Number(c.categoria.salarioBaseAnual) * jornada) / 40 : 0;
    const resultado = calcularNomina({
      mes,
      diasAlta,
      diasMes: dias.length,
      salarioAnual: Number(c.salarioBrutoAnual),
      salarioConvenioAnual: salarioConvenio,
      pagasAnuales: c.pagasAnuales,
      pagasProrrateadas: c.pagasProrrateadas,
      complementos: c.complementos.map((k) => ({ concepto: k.concepto, nombre: k.nombre, importeMensual: Number(k.importeMensual), cotiza: k.cotiza, tributa: k.tributa })),
      jornadaSemanal: jornada,
      horasAnualesConvenio: c.convenio?.horasAnuales ?? TIPOS_NOMINA.horasAnualesPorDefecto,
      parcial: esTiempoParcial(c.tipo, jornada),
      temporal: c.tipo === "TEMPORAL" || c.tipo === "PRACTICAS",
      horasExtra,
      diasIT: it,
      diasSinSueldo,
      irpfPorcentaje: c.irpfPorcentaje !== null ? Number(c.irpfPorcentaje) : null,
      pagaExtra,
    });
    nominas.push({
      empleadoId: e.id,
      centroId: e.centroPrincipalId,
      sociedadId: c.sociedadId ?? e.sociedadId ?? sociedadCentro.get(e.centroPrincipalId) ?? null,
      contratoId: c.id,
      periodo: mes,
      desde,
      hasta,
      puesto: e.puesto?.nombre ?? null,
      categoria: c.categoria?.nombre ?? null,
      tipoContrato: c.tipo,
      jornadaSemanal: jornada,
      horasTrabajadas: r2(horasTrabajadas),
      horasExtra,
      diasSinSueldo,
      resultado,
    });
  }
  return { nominas, sinContrato };
}

/** Id nuevo para insertar cabeceras y líneas en lote sin volver a leer. */
function nuevoId(): string {
  return `nom${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`;
}

/**
 * Guarda las nóminas preparadas en lote (createMany). Sustituye los borradores del mismo
 * empleado, centro y mes; las CERRADAS y PAGADAS no se tocan (se devuelven en `bloqueadas`).
 */
export async function guardarNominas(
  prisma: Cliente,
  tenantId: string,
  nominas: NominaPreparada[],
  opciones: { estado?: "BORRADOR" | "CERRADA" | "PAGADA"; fechaPago?: string | null; usuarioId?: string | null } = {},
): Promise<{ guardadas: number; bloqueadas: number }> {
  if (nominas.length === 0) return { guardadas: 0, bloqueadas: 0 };
  const periodos = Array.from(new Set(nominas.map((n) => n.periodo)));
  const existentes = await prisma.nomina.findMany({
    where: { tenantId, periodo: { in: periodos }, empleadoId: { in: nominas.map((n) => n.empleadoId) } },
    select: { id: true, empleadoId: true, centroId: true, periodo: true, estado: true },
  });
  const clave = (n: { empleadoId: string; centroId: string; periodo: string }) => `${n.empleadoId}|${n.centroId}|${n.periodo}`;
  const bloqueadas = new Set(existentes.filter((x) => x.estado !== "BORRADOR").map(clave));
  const borradores = existentes.filter((x) => x.estado === "BORRADOR").map((x) => x.id);
  if (borradores.length) {
    await prisma.lineaNomina.deleteMany({ where: { nominaId: { in: borradores } } });
    await prisma.nomina.deleteMany({ where: { id: { in: borradores } } });
  }
  const aGuardar = nominas.filter((n) => !bloqueadas.has(clave(n)));
  const estado = opciones.estado ?? "BORRADOR";
  const ahora = new Date();
  const cabeceras: Prisma.NominaCreateManyInput[] = [];
  const lineas: Prisma.LineaNominaCreateManyInput[] = [];
  for (const n of aGuardar) {
    const id = nuevoId();
    const r = n.resultado;
    cabeceras.push({
      id,
      tenantId,
      empleadoId: n.empleadoId,
      centroId: n.centroId,
      sociedadId: n.sociedadId,
      contratoId: n.contratoId,
      periodo: n.periodo,
      desde: aDia(n.desde),
      hasta: aDia(n.hasta),
      diasCotizados: r.diasCotizados,
      diasIT: r.diasITTotal,
      diasSinSueldo: n.diasSinSueldo,
      puesto: n.puesto,
      categoria: n.categoria,
      tipoContrato: n.tipoContrato as Prisma.NominaCreateManyInput["tipoContrato"],
      jornadaSemanal: n.jornadaSemanal,
      horasTrabajadas: n.horasTrabajadas,
      horasExtra: n.horasExtra,
      salarioBase: r.salarioBase,
      complementos: r.complementos,
      importeHorasExtra: r.importeHorasExtra,
      prorrataPagas: r.prorrataPagas,
      prestacionIT: r.prestacionIT,
      devengado: r.devengado,
      baseCotizacion: r.baseCotizacion,
      baseProfesionales: r.baseProfesionales,
      ssTrabajador: r.ssTrabajador,
      ssEmpresa: r.ssEmpresa,
      irpfPorcentaje: r.irpfPorcentaje,
      irpf: r.irpf,
      otrasDeducciones: r.otrasDeducciones,
      neto: r.neto,
      pagoDelegadoIT: r.pagoDelegadoIT,
      costeEmpresa: r.costeEmpresa,
      estado,
      fechaPago: estado === "PAGADA" && opciones.fechaPago ? aDia(opciones.fechaPago) : null,
      calculadaEn: ahora,
      calculadaPor: opciones.usuarioId ?? null,
      cerradaEn: estado !== "BORRADOR" ? ahora : null,
      cerradaPor: estado !== "BORRADOR" ? (opciones.usuarioId ?? null) : null,
    });
    for (const l of r.lineas) {
      lineas.push({ nominaId: id, orden: l.orden, tipo: l.tipo, concepto: l.concepto, nombre: l.nombre, cantidad: l.cantidad ?? null, precio: l.precio ?? null, base: l.base ?? null, porcentaje: l.porcentaje ?? null, importe: l.importe });
    }
  }
  for (let i = 0; i < cabeceras.length; i += 500) await prisma.nomina.createMany({ data: cabeceras.slice(i, i + 500) });
  for (let i = 0; i < lineas.length; i += 2000) await prisma.lineaNomina.createMany({ data: lineas.slice(i, i + 2000) });
  return { guardadas: cabeceras.length, bloqueadas: bloqueadas.size };
}
