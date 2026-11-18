/**
 * Días en hora de Madrid, común a todo el ERP (sin "server-only": no usa la base).
 * Todo «hoy» y todo corte de día se calcula aquí, nunca en hora universal ni del servidor.
 * Un filtro «desde 14/11 hasta 14/11» tiene que coger de las 00:00 a las 24:00 de Madrid,
 * no de la medianoche del servidor (que en Cloudflare es hora universal).
 */

const ZONA = "Europe/Madrid";

const formatoPartes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Día y hora de Madrid de un instante: { dia: «2026-11-15», hora: «00:30», minutos: 30 }. */
export function partesMadrid(instante: Date): { dia: string; hora: string; minutos: number } {
  const p = formatoPartes.formatToParts(instante);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { dia: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}`, minutos: Number(v("hour")) * 60 + Number(v("minute")) };
}

/** Día de Madrid de un instante, «2026-11-15». */
export function diaMadrid(instante: Date): string {
  return partesMadrid(instante).dia;
}

/** Hora de corte por defecto de un centro: lo anterior cuenta para el día anterior. */
export const HORA_CORTE = "05:00";

/**
 * Jornada (día de negocio) de un instante con la hora de corte del centro («05:00»):
 * a las 01:30 del 15 todavía es la jornada del 14. Una hora de corte no válida usa la de por defecto.
 */
export function jornadaMadrid(instante: Date, horaCorte: string | null | undefined = HORA_CORTE): string {
  const corte = horaCorte && /^\d{1,2}:\d{2}$/.test(horaCorte) ? horaCorte : HORA_CORTE;
  const [h, m] = corte.split(":").map(Number);
  const { dia, minutos } = partesMadrid(instante);
  if (minutos >= h * 60 + m) return dia;
  return new Date(Date.parse(`${dia}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Hoy en Madrid, «2026-11-15»; con `desplazamientoDias` = 30, el día de dentro de 30 días. */
export function hoyMadrid(desplazamientoDias = 0, ahora = new Date()): string {
  const instante = new Date(ahora.getTime() + desplazamientoDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
}

/** Minutos que Madrid va por delante de la hora universal en ese instante (60 en invierno, 120 en verano). */
function desfaseMadrid(instante: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instante);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  const comoUTC = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"));
  return Math.round((comoUTC - instante.getTime()) / 60000);
}

/**
 * Instante en que empieza en Madrid el día «aaaa-mm-dd» (más `sumarDias`; con 1 se obtiene el final
 * exclusivo de ese día, para un «hasta» inclusivo). Para cortar por día lo que se guarda con hora.
 */
export function inicioDiaMadrid(dia: string, sumarDias = 0): Date {
  const r = inicioDiaMadridSiValido(dia, sumarDias);
  if (!r) throw new Error(`Fecha no válida: ${dia}`);
  return r;
}

/** Igual que inicioDiaMadrid, pero undefined si el texto no es una fecha (para filtros que pueden venir vacíos). */
export function inicioDiaMadridSiValido(dia: string | undefined, sumarDias = 0): Date | undefined {
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return undefined;
  const [a, m, d] = dia.split("-").map(Number);
  const medianocheUTC = Date.UTC(a, m - 1, d + sumarDias);
  if (Number.isNaN(medianocheUTC)) return undefined;
  // primera aproximación con el desfase de ese momento y corrección por si cae en el cambio de hora
  let instante = new Date(medianocheUTC - desfaseMadrid(new Date(medianocheUTC)) * 60000);
  instante = new Date(medianocheUTC - desfaseMadrid(instante) * 60000);
  return instante;
}

/**
 * Instante real de «día a tal hora» en Madrid: instanteMadrid("2026-11-15", "21:30").
 * `minutosExtra` permite pasar de las 24:00 (cierres de madrugada). En el cambio de hora se toma el
 * desfase de dos horas antes, así una hora que no existe (02:30 del último domingo de marzo) cae una hora después.
 */
export function instanteMadrid(dia: string, hhmm: string, minutosExtra = 0): Date {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const supuesto = Date.UTC(a, m - 1, d) + ((h || 0) * 60 + (mi || 0) + minutosExtra) * 60_000;
  return new Date(supuesto - desfaseMadrid(new Date(supuesto - 2 * 3_600_000)) * 60_000);
}
