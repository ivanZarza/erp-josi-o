"use client";
/**
 * Tabla con filas desplegables (specs/06_diseno.md §4).
 * En la fila, los datos principales; al abrirla, el panel de detalle con el resto y las acciones.
 * Se usa desde Server Components pasando las celdas y el detalle ya pintados (ReactNode).
 */
import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

export interface ColumnaDesplegable {
  titulo: string;
  alinear?: "izquierda" | "derecha" | "centro";
  /** se oculta en pantallas pequeñas */
  secundaria?: boolean;
}

export interface FilaDesplegable {
  id: string;
  celdas: ReactNode[];
  detalle?: ReactNode;
  /** resalta la fila (aviso, error) */
  tono?: "aviso" | "error";
}

export function TablaDesplegable({ columnas, filas, vacio, total }: { columnas: ColumnaDesplegable[]; filas: FilaDesplegable[]; vacio?: ReactNode; total?: ReactNode }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todas = filas.length > 0 && filas.every((f) => !f.detalle || abiertas.has(f.id));

  if (filas.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{vacio ?? "No hay datos todavía."}</div>;
  }
  const al = (a?: string) => (a === "derecha" ? "text-right tabular-nums" : a === "centro" ? "text-center" : "text-left");
  const oculta = (c: ColumnaDesplegable) => (c.secundaria ? "hidden md:table-cell" : "");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span>{total ?? `${filas.length} resultados`}</span>
        <button
          type="button"
          className="rounded px-2 py-1 hover:bg-slate-100"
          onClick={() => setAbiertas(todas ? new Set() : new Set(filas.filter((f) => f.detalle).map((f) => f.id)))}
        >
          {todas ? "Cerrar todas" : "Abrir todas"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8" />
              {columnas.map((c) => (
                <th key={c.titulo} className={`px-3 py-2 font-medium ${al(c.alinear)} ${oculta(c)}`}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const abierta = abiertas.has(f.id);
              const fondo = f.tono === "error" ? "bg-red-50/60" : f.tono === "aviso" ? "bg-amber-50/60" : "";
              return (
                <FilaFragment key={f.id}>
                  <tr
                    className={`border-t border-slate-100 ${f.detalle ? "cursor-pointer" : ""} hover:bg-slate-50 ${fondo} ${abierta ? "bg-slate-50" : ""}`}
                    onClick={() => f.detalle && alternar(f.id)}
                  >
                    <td className="pl-3 text-slate-400">{f.detalle ? abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} /> : null}</td>
                    {f.celdas.map((celda, i) => (
                      <td key={i} className={`px-3 py-2 ${al(columnas[i]?.alinear)} ${columnas[i] ? oculta(columnas[i]) : ""}`}>
                        {celda}
                      </td>
                    ))}
                  </tr>
                  {abierta && f.detalle && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={columnas.length} className="px-3 pb-4 pt-1">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">{f.detalle}</div>
                      </td>
                    </tr>
                  )}
                </FilaFragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Rejilla de datos para el panel de detalle: etiqueta arriba, valor abajo. */
export function DatosDetalle({ datos, columnas = 4 }: { datos: { etiqueta: string; valor: ReactNode }[]; columnas?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columnas];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${c}`}>
      {datos.map((d) => (
        <div key={d.etiqueta}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{d.etiqueta}</dt>
          <dd className="mt-0.5 text-sm text-slate-900">{d.valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
