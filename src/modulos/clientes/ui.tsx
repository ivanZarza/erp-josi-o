/** Piezas de pantalla propias de Clientes (Server Components). */
import { Aviso, Etiqueta, Pestanas } from "@/ui";
import { fecha } from "@/kernel/formato";

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
  const tono = nota >= 4 ? "text-ok" : nota <= 2 ? "text-error" : "text-aviso";
  return <span className={`font-semibold tabular-nums ${tono}`}>{nota} / 5</span>;
}
