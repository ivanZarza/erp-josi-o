/** Piezas comunes de las pantallas de Caja (solo de este módulo). */
import { Aviso } from "@/ui";

export type ParametrosBusqueda = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export function Avisos({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = param(sp, "ok");
  const error = param(sp, "error");
  if (!ok && !error) return null;
  return <div className="mb-4">{error ? <Aviso tono="error">{error}</Aviso> : <Aviso tono="ok">{ok}</Aviso>}</div>;
}

/** Valor de un Decimal para un campo de formulario («1234,5»), sin separador de miles. */
const formatoCampo = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: false });
export function valorCampo(v: { toString(): string } | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return formatoCampo.format(Number(v.toString()));
}
