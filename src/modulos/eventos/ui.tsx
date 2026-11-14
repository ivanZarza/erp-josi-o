/** Piezas de pantalla propias de Eventos (Server Components). */
import { Aviso, Etiqueta, Pestanas } from "@/ui";
import { NOMBRE_ESTADO, type EstadoEvento } from "./servicio";

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;
export const param = (sp: Record<string, string | string[] | undefined>, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

export function AvisosUrl({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = param(sp, "error");
  const ok = param(sp, "ok");
  if (!error && !ok) return null;
  return <div className="mb-4">{error ? <Aviso tono="error">{error}</Aviso> : <Aviso tono="ok">{ok}</Aviso>}</div>;
}

const TONO: Record<EstadoEvento, "normal" | "ok" | "aviso" | "error" | "info"> = {
  NUEVA: "aviso",
  CONTACTADA: "info",
  PRESUPUESTO: "info",
  ACEPTADA: "ok",
  CELEBRADA: "normal",
  PERDIDA: "error",
};
export function EtiquetaEstadoEvento({ estado }: { estado: EstadoEvento }) {
  return <Etiqueta tono={TONO[estado]}>{NOMBRE_ESTADO[estado]}</Etiqueta>;
}

export function PestanasEventos({ activa, puedeGestionar }: { activa: string; puedeGestionar: boolean }) {
  return (
    <Pestanas
      activa={activa}
      items={[
        { href: "/eventos", titulo: "Solicitudes" },
        ...(puedeGestionar ? [{ href: "/eventos/nueva", titulo: "Nueva solicitud" }] : []),
        { href: "/eventos/menus", titulo: "Menús de grupo" },
      ]}
    />
  );
}
