/** Piezas de pantalla propias de Clientes (Server Components). */
import { Aviso, Etiqueta, Pestanas } from "@/ui";
import { fecha } from "@/kernel/formato";
import { NOTA_AVISO, NOTA_RESENA } from "./servicio";

/** De dónde llegó un cliente, una visita, un consentimiento o una tarjeta (columna `origen`). */
export const NOMBRE_ORIGEN: Record<string, string> = {
  MANUAL: "A mano",
  RESERVA: "Reserva",
  WEB: "Web",
  COVERMANAGER: "CoverManager",
  EVENTO: "Solicitud de evento",
  TPV: "Caja (TPV)",
};
export const nombreOrigen = (o: string | null | undefined) => (o ? (NOMBRE_ORIGEN[o] ?? o) : "—");

/** Tipos de consentimiento, tal como se leen en pantalla. */
export const NOMBRE_CONSENTIMIENTO: Record<string, string> = {
  RESERVA: "Datos para gestionar reservas",
  CORREO: "Ofertas por correo",
  WHATSAPP: "Ofertas por WhatsApp",
};

/**
 * Color de una nota (o de una media) de 1 a 5, igual en todas las pantallas:
 * verde desde NOTA_RESENA (4), rojo hasta NOTA_AVISO (2), ámbar en medio.
 */
export function tonoNota(nota: number | null): "ok" | "error" | "aviso" | "normal" {
  if (nota === null) return "normal";
  return nota >= NOTA_RESENA ? "ok" : nota <= NOTA_AVISO ? "error" : "aviso";
}

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;
export const param = (sp: Record<string, string | string[] | undefined>, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

export function AvisosUrl({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = param(sp, "error");
  const ok = param(sp, "ok");
  if (!error && !ok) return null;
  const texto = ok === "guardado" ? "Cambios guardados" : ok === "suprimido" ? "Datos del cliente suprimidos" : ok;
  return <div className="mb-4">{error ? <Aviso tono="error">{error}</Aviso> : <Aviso tono="ok">{texto}</Aviso>}</div>;
}

export function PestanasClientes({ activa }: { activa: string }) {
  return (
    <Pestanas
      activa={activa}
      items={[
        { href: "/clientes", titulo: "Clientes" },
        { href: "/clientes/encuestas", titulo: "Encuestas" },
        { href: "/clientes/tarjetas-regalo", titulo: "Tarjetas regalo" },
      ]}
    />
  );
}

/** Sí / No / sin dato con su fecha. */
export function EtiquetaConsentimiento({ c }: { c: { otorgado: boolean; fecha: Date } | null }) {
  if (!c) return <Etiqueta>Sin dato</Etiqueta>;
  return <Etiqueta tono={c.otorgado ? "ok" : "normal"}>{c.otorgado ? "Sí" : "No"} · {fecha(c.fecha)}</Etiqueta>;
}

export function Estrellas({ nota }: { nota: number | null }) {
  if (nota === null) return <span className="text-suave">—</span>;
  const tono = { ok: "text-ok", error: "text-error", aviso: "text-aviso", normal: "" }[tonoNota(nota)];
  return <span className={`font-semibold tabular-nums ${tono}`}>{nota} / 5</span>;
}
