/** Piezas comunes de las pantallas del Cuadro de mando (solo de este módulo). */
import Link from "next/link";
import { Aviso } from "@/ui";
import { euros, porcentaje } from "@/kernel/formato";

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

/** Cifra en euros que enlaza a su detalle; «sin datos» si la fuente no existe (nunca un cero inventado). */
export function Importe({ valor, href, motivo }: { valor: number | null; href?: string; motivo?: string }) {
  if (valor === null)
    return (
      <span className="text-xs text-slate-400" title={motivo}>
        sin datos
      </span>
    );
  return href ? (
    <Link href={href} className="hover:underline">
      {euros(valor)}
    </Link>
  ) : (
    <>{euros(valor)}</>
  );
}

/** Porcentaje; null → «—». */
export function Pct({ valor }: { valor: number | null }) {
  return <>{valor === null ? "—" : porcentaje(valor)}</>;
}

/** Desviación frente a presupuesto en %, en verde si es buena. `masEsMejor` para ventas. */
export function Desviacion({ real, previsto, masEsMejor = true }: { real: number | null; previsto: number | null | undefined; masEsMejor?: boolean }) {
  if (real === null || !previsto) return <span className="text-slate-400">—</span>;
  const d = ((real - previsto) / previsto) * 100;
  const bueno = masEsMejor ? d >= 0 : d <= 0;
  return <span className={bueno ? "text-emerald-600" : "text-red-600"}>{`${d >= 0 ? "+" : ""}${porcentaje(d)}`}</span>;
}
