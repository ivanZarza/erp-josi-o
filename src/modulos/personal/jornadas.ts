/**
 * Jornadas a partir de los fichajes (sin dependencias de servidor: lo usan el servicio,
 * el cálculo de nóminas y la semilla). Una jornada = persona + día de jornada (hora de corte 05:00).
 */
import { jornadaDe } from "./fechas";

export interface Jornada {
  empleadoId: string;
  centroId: string;
  dia: string;
  entrada: Date | null;
  salida: Date | null;
  minutosPausa: number;
  horas: number;
  incompleta: boolean;
  fichajes: { id: string; centroId: string; tipo: string; momento: Date; origen: string; anulado: boolean; motivoCorreccion: string | null; corregidoPor: string | null; corregidoEn: Date | null; corrigeAId: string | null }[];
}

/** Agrupa fichajes en jornadas (persona + día de jornada), calcula horas y pausas. */
export function calcularJornadas(fichajes: { id: string; empleadoId: string; centroId: string; tipo: string; momento: Date; origen: string; anulado: boolean; motivoCorreccion: string | null; corregidoPor: string | null; corregidoEn: Date | null; corrigeAId: string | null }[]): Jornada[] {
  const grupos = new Map<string, Jornada>();
  const orden = [...fichajes].sort((a, b) => a.momento.getTime() - b.momento.getTime());
  for (const f of orden) {
    const dia = jornadaDe(f.momento);
    const clave = `${f.empleadoId}|${dia}`;
    let j = grupos.get(clave);
    if (!j) {
      j = { empleadoId: f.empleadoId, centroId: f.centroId, dia, entrada: null, salida: null, minutosPausa: 0, horas: 0, incompleta: false, fichajes: [] };
      grupos.set(clave, j);
    }
    j.fichajes.push(f);
  }
  for (const j of grupos.values()) {
    const validos = j.fichajes.filter((f) => !f.anulado);
    let dentroDesde: Date | null = null;
    let pausaDesde: Date | null = null;
    let minutos = 0;
    for (const f of validos) {
      if (f.tipo === "ENTRADA") {
        if (!j.entrada) j.entrada = f.momento;
        dentroDesde = f.momento;
        j.centroId = f.centroId;
      } else if (f.tipo === "INICIO_PAUSA" && dentroDesde) {
        minutos += (f.momento.getTime() - dentroDesde.getTime()) / 60_000;
        dentroDesde = null;
        pausaDesde = f.momento;
      } else if (f.tipo === "FIN_PAUSA") {
        if (pausaDesde) j.minutosPausa += (f.momento.getTime() - pausaDesde.getTime()) / 60_000;
        pausaDesde = null;
        dentroDesde = f.momento;
      } else if (f.tipo === "SALIDA") {
        if (dentroDesde) minutos += (f.momento.getTime() - dentroDesde.getTime()) / 60_000;
        dentroDesde = null;
        j.salida = f.momento;
      }
    }
    j.incompleta = !j.entrada || !!dentroDesde || !!pausaDesde || !j.salida;
    j.horas = minutos / 60;
  }
  return Array.from(grupos.values());
}

