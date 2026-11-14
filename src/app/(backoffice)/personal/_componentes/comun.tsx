/**
 * Piezas comunes de las pantallas de Personal (Server Components).
 */
import type { ReactNode } from "react";
import { Aviso, Etiqueta } from "@/ui";
import { fecha } from "@/kernel/formato";
import { NOMBRE_AUSENCIA, NOMBRE_CONTRATO, NOMBRE_ESTADO_CANDIDATO } from "@/modulos/personal/esquemas";
import { aDia, hoyMadrid, sumarDias } from "@/modulos/personal/fechas";

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, k: string): string | undefined {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

/** Mensaje de resultado de la última acción (?ok= / ?error=). */
export function Mensajes({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = param(sp, "ok");
  const error = param(sp, "error");
  if (!ok && !error) return null;
  return <div className="mb-4">{error ? <Aviso tono="error" titulo="No se ha podido guardar">{error}</Aviso> : <Aviso tono="ok">{ok}</Aviso>}</div>;
}

/** Campo oculto con la página a la que volver tras la acción. */
export function Volver({ a }: { a: string }) {
  return <input type="hidden" name="volver" value={a} />;
}

export function Fila({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

/** Formularios en línea dentro del detalle de una fila. */
export function Acciones({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">{children}</div>;
}

export function EtiquetaContrato({ tipo }: { tipo: string | null | undefined }) {
  if (!tipo) return <Etiqueta tono="error">Sin contrato</Etiqueta>;
  return <Etiqueta tono={tipo === "INDEFINIDO" ? "ok" : tipo === "FIJO_DISCONTINUO" ? "info" : "normal"}>{NOMBRE_CONTRATO[tipo as keyof typeof NOMBRE_CONTRATO] ?? tipo}</Etiqueta>;
}

export function EtiquetaAusencia({ estado }: { estado: string }) {
  const tono = estado === "APROBADA" ? "ok" : estado === "PEDIDA" ? "aviso" : estado === "RECHAZADA" ? "error" : "normal";
  const txt = { PEDIDA: "Pedida", APROBADA: "Aprobada", RECHAZADA: "Rechazada", ANULADA: "Anulada" }[estado] ?? estado;
  return <Etiqueta tono={tono}>{txt}</Etiqueta>;
}

export function nombreAusencia(t: string) {
  return NOMBRE_AUSENCIA[t as keyof typeof NOMBRE_AUSENCIA] ?? t;
}

export function EtiquetaCandidato({ estado }: { estado: string }) {
  const tono = estado === "CONTRATADO" ? "ok" : estado === "DESCARTADO" ? "normal" : estado === "OFERTA" ? "info" : "aviso";
  return <Etiqueta tono={tono}>{NOMBRE_ESTADO_CANDIDATO[estado as keyof typeof NOMBRE_ESTADO_CANDIDATO] ?? estado}</Etiqueta>;
}

/** Estado de una caducidad: caducado (rojo), caduca en 30 días (ámbar) o vigente. */
export function EtiquetaCaducidad({ caducaEn }: { caducaEn: Date | null }) {
  if (!caducaEn) return <Etiqueta tono="ok">Sin caducidad</Etiqueta>;
  const hoy = aDia(hoyMadrid());
  if (caducaEn < hoy) return <Etiqueta tono="error">Caducado el {fecha(caducaEn)}</Etiqueta>;
  if (caducaEn <= aDia(sumarDias(hoyMadrid(), 30))) return <Etiqueta tono="aviso">Caduca el {fecha(caducaEn)}</Etiqueta>;
  return <Etiqueta tono="ok">Hasta el {fecha(caducaEn)}</Etiqueta>;
}

/** Horas en formato «7 h 30 min». */
export function horasTexto(h: number): string {
  const min = Math.round(h * 60);
  const hh = Math.floor(Math.abs(min) / 60);
  const mm = Math.abs(min) % 60;
  return `${min < 0 ? "−" : ""}${hh} h${mm ? ` ${mm} min` : ""}`;
}
