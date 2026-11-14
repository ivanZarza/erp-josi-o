/** Piezas de pantalla propias de Reservas (Server Components). */
import { Aviso, Etiqueta, Pestanas } from "@/ui";
import { NOMBRE_ESTADO, type EstadoReserva } from "./servicio";

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;
export const param = (sp: Record<string, string | string[] | undefined>, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

/** Mensajes que llegan en la dirección tras guardar (?ok=… / ?error=…). */
export function AvisosUrl({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = param(sp, "error");
  const ok = param(sp, "ok");
  if (!error && !ok) return null;
  return (
    <div className="mb-4">
      {error ? <Aviso tono="error">{error}</Aviso> : <Aviso tono="ok">{ok}</Aviso>}
    </div>
  );
}

const TONO: Record<EstadoReserva, "normal" | "ok" | "aviso" | "error" | "info"> = {
  SOLICITADA: "aviso",
  CONFIRMADA: "info",
  LLEGADA: "info",
  SENTADA: "ok",
  TERMINADA: "normal",
  CANCELADA: "normal",
  NO_PRESENTADA: "error",
};
export function EtiquetaEstadoReserva({ estado }: { estado: EstadoReserva }) {
  return <Etiqueta tono={TONO[estado]}>{NOMBRE_ESTADO[estado]}</Etiqueta>;
}

export function PestanasReservas({ activa, puedeReglas, puedePlanos }: { activa: string; puedeReglas: boolean; puedePlanos: boolean }) {
  const items = [
    { href: "/reservas", titulo: "Reservas del día" },
    { href: "/reservas/nueva", titulo: "Nueva reserva" },
    { href: "/reservas/plano", titulo: "Plano de mesas" },
    ...(puedePlanos ? [{ href: "/reservas/mesas", titulo: "Espacios y mesas" }] : []),
    ...(puedeReglas ? [{ href: "/reservas/reglas", titulo: "Turnos y reglas" }] : []),
  ];
  return <Pestanas items={items} activa={activa} />;
}
