"use client";
/**
 * Lista de productos con casilla de cantidad (y de precio en compras), con buscador.
 * Va DENTRO de un <form> del servidor: manda los campos c_<productoId> (cantidad) y p_<productoId> (precio).
 * Pensado para el móvil del local: letra y casillas grandes, agrupado por familias.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { euros, numero } from "@/kernel/formato";

export interface ProductoSeleccionable {
  id: string;
  referencia: string;
  nombre: string;
  unidad: string;
  familia: string;
  disponible?: number | null; // stock en el centro que sirve
  precio?: number | null;
}

function leer(s: string): number {
  let t = s.trim().replace(/\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
function escribir(n: number): string {
  return String(n).replace(".", ",");
}

export function SelectorCantidades({
  productos,
  iniciales = {},
  conPrecio = false,
  mostrarDisponible = false,
  textoExceso = "Pides más de lo que hay: se servirá lo disponible.",
}: {
  productos: ProductoSeleccionable[];
  iniciales?: Record<string, number>;
  conPrecio?: boolean;
  mostrarDisponible?: boolean;
  /** Aviso cuando la cantidad pasa de lo disponible. */
  textoExceso?: string;
}) {
  const [cant, setCant] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(iniciales).map(([k, v]) => [k, escribir(v)])));
  const [precio, setPrecio] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.precio != null ? escribir(p.precio) : ""])));
  const [texto, setTexto] = useState("");
  const [soloElegidos, setSoloElegidos] = useState(false);

  const t = texto.trim().toLowerCase();
  const visibles = (p: ProductoSeleccionable) => {
    if (soloElegidos && !(leer(cant[p.id] ?? "") > 0)) return false;
    if (!t) return true;
    return p.nombre.toLowerCase().includes(t) || p.referencia.toLowerCase().includes(t) || p.familia.toLowerCase().includes(t);
  };

  const familias = useMemo(() => {
    const m = new Map<string, ProductoSeleccionable[]>();
    for (const p of productos) m.set(p.familia, [...(m.get(p.familia) ?? []), p]);
    return Array.from(m);
  }, [productos]);

  const elegidos = productos.filter((p) => leer(cant[p.id] ?? "") > 0);
  const importe = elegidos.reduce((a, p) => a + leer(cant[p.id] ?? "") * leer(precio[p.id] ?? ""), 0);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-slate-50/95 px-1 py-2 backdrop-blur">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar producto, referencia o familia"
            className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-base outline-none focus:border-acento"
          />
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
          <input type="checkbox" checked={soloElegidos} onChange={(e) => setSoloElegidos(e.target.checked)} />
          Solo lo elegido
        </label>
        <div className="w-full text-sm text-slate-600 sm:w-auto">
          <strong>{elegidos.length}</strong> producto(s)
          {(conPrecio || productos.some((p) => p.precio != null)) && elegidos.length > 0 && <> · {euros(importe)}</>}
        </div>
      </div>

      {familias.map(([familia, lista]) => {
        const vis = lista.filter(visibles);
        // los ocultos siguen en el formulario (con display:none) para no perder lo escrito
        return (
          <section key={familia} className={vis.length ? "" : "hidden"}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{familia}</h3>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {lista.map((p) => {
                const c = leer(cant[p.id] ?? "");
                const pasa = mostrarDisponible && p.disponible != null && c > p.disponible;
                return (
                  <li key={p.id} className={`${visibles(p) ? "flex" : "hidden"} flex-wrap items-center gap-3 px-3 py-2 ${c > 0 ? "bg-acento-claro/40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {p.referencia} · {p.unidad.toLowerCase()}
                        {mostrarDisponible && p.disponible != null && (
                          <>
                            {" · "}
                            {p.disponible > 0 ? <>hay {numero(p.disponible, 3)}</> : <span className="font-medium text-red-600">sin existencias</span>}
                          </>
                        )}
                        {!conPrecio && p.precio != null && <> · {euros(p.precio)}</>}
                      </div>
                      {pasa && <div className="text-xs text-amber-700">{textoExceso}</div>}
                    </div>
                    {conPrecio && (
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        €/ud
                        <input
                          name={`p_${p.id}`}
                          inputMode="decimal"
                          value={precio[p.id] ?? ""}
                          onChange={(e) => setPrecio({ ...precio, [p.id]: e.target.value })}
                          className="w-20 rounded-md border border-slate-200 px-2 py-2 text-right text-sm tabular-nums"
                        />
                      </label>
                    )}
                    <input
                      name={`c_${p.id}`}
                      inputMode="decimal"
                      aria-label={`Cantidad de ${p.nombre}`}
                      placeholder="0"
                      value={cant[p.id] ?? ""}
                      onChange={(e) => setCant({ ...cant, [p.id]: e.target.value })}
                      className="w-20 rounded-md border border-slate-200 px-2 py-2 text-right text-base tabular-nums outline-none focus:border-acento"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
