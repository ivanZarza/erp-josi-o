/**
 * Componentes comunes del backoffice. Usar SIEMPRE estos para que todo se vea igual.
 * Server Components salvo que se indique. Sin emojis, sin degradados.
 */
import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Cabecera de página: título, explicación corta y acciones a la derecha. */
export function Cabecera({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({ titulo, children, className, acciones }: { titulo?: string; children: ReactNode; className?: string; acciones?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-borde bg-white p-4", className)}>
      {(titulo || acciones) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

/** Cifra destacada (indicador). tono: normal | ok | aviso | error */
export function Cifra({ etiqueta, valor, detalle, tono = "normal", href }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "normal" | "ok" | "aviso" | "error"; href?: string }) {
  const color = { normal: "text-tinta", ok: "text-ok", aviso: "text-aviso", error: "text-error" }[tono];
  const cuerpo = (
    <div className="rounded-lg border border-borde bg-white p-4 transition hover:border-stone-300">
      <div className="text-xs font-medium uppercase tracking-wide text-suave">{etiqueta}</div>
      <div className={cx("cifra mt-1 text-2xl font-semibold", color)}>{valor}</div>
      {detalle && <div className="mt-1 text-xs text-suave">{detalle}</div>}
    </div>
  );
  return href ? <Link href={href}>{cuerpo}</Link> : cuerpo;
}

export function Rejilla({ children, columnas = 4 }: { children: ReactNode; columnas?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columnas];
  return <div className={cx("grid grid-cols-1 gap-4", c)}>{children}</div>;
}

/** Tabla simple. Las celdas numéricas con alinear="derecha". */
export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  alinear?: "izquierda" | "derecha" | "centro";
  className?: string;
}
export function Tabla<T>({ filas, columnas, vacio, clave }: { filas: T[]; columnas: Columna<T>[]; vacio?: ReactNode; clave: (f: T) => string }) {
  if (filas.length === 0) return <Vacio>{vacio ?? "No hay datos todavía."}</Vacio>;
  const al = (a?: string) => (a === "derecha" ? "text-right cifra" : a === "centro" ? "text-center" : "text-left");
  return (
    <div className="overflow-x-auto rounded-lg border border-borde bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-borde bg-stone-50 text-xs uppercase tracking-wide text-suave">
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={cx("px-3 py-2 font-medium", al(c.alinear))}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {filas.map((f) => (
            <tr key={clave(f)} className="hover:bg-stone-50">
              {columnas.map((c) => (
                <td key={c.titulo} className={cx("px-3 py-2", al(c.alinear), c.className)}>
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-borde bg-white p-8 text-center text-sm text-suave">{children}</div>;
}

export function Etiqueta({ children, tono = "normal" }: { children: ReactNode; tono?: "normal" | "ok" | "aviso" | "error" | "info" }) {
  const c = {
    normal: "bg-stone-100 text-stone-700",
    ok: "bg-green-50 text-ok",
    aviso: "bg-amber-50 text-aviso",
    error: "bg-red-50 text-error",
    info: "bg-acento-claro text-acento",
  }[tono];
  return <span className={cx("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", c)}>{children}</span>;
}

export function Boton({ variante = "principal", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "secundario" | "peligro" }) {
  const v = {
    principal: "bg-acento text-white hover:opacity-90",
    secundario: "border border-borde bg-white text-tinta hover:bg-stone-50",
    peligro: "bg-error text-white hover:opacity-90",
  }[variante];
  return <button {...p} className={cx("inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-medium disabled:opacity-50", v, className)} />;
}

export function BotonEnlace({ href, children, variante = "principal" }: { href: string; children: ReactNode; variante?: "principal" | "secundario" }) {
  const v = variante === "principal" ? "bg-acento text-white hover:opacity-90" : "border border-borde bg-white text-tinta hover:bg-stone-50";
  return (
    <Link href={href} className={cx("inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-medium", v)}>
      {children}
    </Link>
  );
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-suave">{ayuda}</span>}
    </label>
  );
}

const claseEntrada = "w-full rounded-md border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento-claro";
export function Entrada(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(claseEntrada, p.className)} />;
}
export function Selector(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(claseEntrada, p.className)} />;
}
export function AreaTexto(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(claseEntrada, p.className)} />;
}

/** Aviso en la página (por ejemplo, «hueco de integración pendiente»). */
export function Aviso({ children, tono = "info", titulo }: { children: ReactNode; tono?: "info" | "aviso" | "error" | "ok"; titulo?: string }) {
  const c = { info: "border-stone-200 bg-stone-50", aviso: "border-amber-200 bg-amber-50", error: "border-red-200 bg-red-50", ok: "border-green-200 bg-green-50" }[tono];
  return (
    <div className={cx("rounded-lg border p-4 text-sm", c)}>
      {titulo && <div className="mb-1 font-semibold">{titulo}</div>}
      {children}
    </div>
  );
}

/** Hueco de integración: se muestra donde irá una conexión externa que aún no está hecha. */
export function HuecoIntegracion({ nombre, descripcion }: { nombre: string; descripcion: string }) {
  return (
    <Aviso titulo={`Integración pendiente: ${nombre}`}>
      {descripcion}. Se conectará más adelante; mientras tanto los datos se introducen a mano.
    </Aviso>
  );
}

/** Pestañas de navegación dentro de una sección (enlaces). */
export function Pestanas({ items, activa }: { items: { href: string; titulo: string }[]; activa: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-borde">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={cx("whitespace-nowrap border-b-2 px-3 py-2 text-sm", activa === i.href ? "border-acento font-medium text-acento" : "border-transparent text-suave hover:text-tinta")}>
          {i.titulo}
        </Link>
      ))}
    </nav>
  );
}
