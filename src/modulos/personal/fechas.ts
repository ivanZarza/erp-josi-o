/**
 * Utilidades de fechas y horas del módulo Personal (sin dependencias de servidor:
 * las usa también la semilla).
 * - Los días se guardan como fecha (@db.Date) = medianoche UTC del día: "2026-11-09" → 2026-11-09T00:00:00Z.
 * - Las horas de los turnos son texto "HH:MM" en hora de Madrid. Si el fin es menor o igual
 *   que el inicio, el tramo acaba al día siguiente (cierre de madrugada).
 * - Los fichajes son instantes reales (DateTime). Su «jornada» es el día de Madrid restando
 *   la hora de corte (05:00 por defecto): un fichaje a las 01:30 cuenta para el día anterior.
 */

import { diaMadrid, instanteMadrid, jornadaMadrid, partesMadrid } from "../../kernel/fechas";

export const HORA_CORTE = "05:00";

/** "2026-11-09" → Date a medianoche UTC (para campos @db.Date). */
export function aDia(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/** Date de un campo @db.Date → "2026-11-09". */
export function diaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, n: number): string {
  const d = aDia(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return diaISO(d);
}

/** Días naturales entre dos fechas, ambas incluidas. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aDia(hasta).getTime() - aDia(desde).getTime()) / 86_400_000) + 1;
}

/** 0 = lunes … 6 = domingo */
export function diaSemana(iso: string): number {
  return (aDia(iso).getUTCDay() + 6) % 7;
}

export function lunesDe(iso: string): string {
  return sumarDias(iso, -diaSemana(iso));
}

export const NOMBRES_DIA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const NOMBRES_DIA_CORTO = ["L", "M", "X", "J", "V", "S", "D"];
export const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-11" → ["2026-11-01", …, "2026-11-30"] */
export function diasDelMes(mes: string): string[] {
  const [a, m] = mes.split("-").map(Number);
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

export function mesSiguiente(mes: string, n = 1): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} de ${a}`;
}

/** Partes de un instante en hora de Madrid (común: src/kernel/fechas.ts). */
export { partesMadrid };

/** Hoy en Madrid, "2026-11-08" (o el día de Madrid del instante que se pase). */
export function hoyMadrid(ahora = new Date()): string {
  return diaMadrid(ahora);
}

/** "HH:MM" → minutos desde las 00:00. */
export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function aHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Duración en minutos de un tramo; si fin <= inicio, cruza la medianoche. */
export function duracionTramo(inicio: string, fin: string): number {
  const a = aMinutos(inicio);
  let b = aMinutos(fin);
  if (b <= a) b += 1440;
  return b - a;
}

export interface Turno {
  inicio: string;
  fin: string;
  inicio2?: string | null;
  fin2?: string | null;
  pausaMinutos?: number | null;
}

/** Horas de trabajo de un turno (tramos menos la pausa). */
export function horasTurno(t: Turno): number {
  let min = duracionTramo(t.inicio, t.fin);
  if (t.inicio2 && t.fin2) min += duracionTramo(t.inicio2, t.fin2);
  min -= t.pausaMinutos ?? 0;
  return Math.max(0, min) / 60;
}

/** Instante real de un día + hora de Madrid (común: src/kernel/fechas.ts). */
export { instanteMadrid };

/** Inicio y fin reales de un turno de un día (el fin del último tramo, cruzando medianoche si hace falta). */
export function limitesTurno(dia: string, t: Turno): { inicio: Date; fin: Date } {
  const ini = aMinutos(t.inicio);
  let finMin: number;
  if (t.inicio2 && t.fin2) {
    let i2 = aMinutos(t.inicio2);
    if (i2 < ini) i2 += 1440;
    finMin = i2 + duracionTramo(t.inicio2, t.fin2);
  } else {
    finMin = ini + duracionTramo(t.inicio, t.fin);
  }
  return { inicio: instanteMadrid(dia, t.inicio), fin: instanteMadrid(dia, "00:00", finMin) };
}

/** Día de jornada al que pertenece un fichaje (resta la hora de corte). */
export function jornadaDe(momento: Date, horaCorte = HORA_CORTE): string {
  return jornadaMadrid(momento, horaCorte);
}

/** "2026-11-09" válido */
export function esDia(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function esMes(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}
