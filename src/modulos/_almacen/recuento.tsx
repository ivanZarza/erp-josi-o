"use client";
/**
 * Pantalla de recuento de inventario, pensada para el móvil: buscador, botones grandes − y +,
 * filtro «sin contar» y contador de avance. Va DENTRO de un <form> del servidor y manda n_<líneaId>.
 * Es a ciegas: no enseña el stock teórico.
 */
import { useMemo, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";

export interface LineaRecuento {
  id: string;
  nombre: string;
  referencia: string;
  unidad: string;
  familia: string;
  contado: number | null;
}

function leer(s: string): number | null {
  let t = s.trim().replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const escribir = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");

export function Recuento({ lineas, soloLectura = false }: { lineas: LineaRecuento[]; soloLectura?: boolean }) {
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(lineas.map((l) => [l.id, l.contado === null ? "" : escribir(l.contado)])));
  const [texto, setTexto] = useState("");
  const [sinContar, setSinContar] = useState(false);

  const familias = useMemo(() => {
    const m = new Map<string, LineaRecuento[]>();
    for (const l of lineas) m.set(l.familia, [...(m.get(l.familia) ?? []), l]);
    return Array.from(m);
  }, [lineas]);

  const contadas = lineas.filter((l) => (valores[l.id] ?? "").trim() !== "").length;
  const t = texto.trim().toLowerCase();
  const visible = (l: LineaRecuento) =>
    (!sinContar || (valores[l.id] ?? "").trim() === "") && (!t || l.nombre.toLowerCase().includes(t) || l.referencia.toLowerCase().includes(t));

  const sumar = (id: string, d: number) => {
    const actual = leer(valores[id] ?? "") ?? 0;
    setValores({ ...valores, [id]: escribir(Math.max(0, actual + d)) });
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-slate-50/95 px-1 py-2 backdrop-blur">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar producto o referencia"
            className="w-full rounded-md border border-slate-200 bg-white py-3 pl-10 pr-3 text-base outline-none focus:border-acento"
          />
        </label>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>
            Contadas <strong>{contadas}</strong> de {lineas.length}
          </span>
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
            <input type="checkbox" checked={sinContar} onChange={(e) => setSinContar(e.target.checked)} />
            Solo sin contar
          </label>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-slate-200">
          <div className="h-full bg-acento" style={{ width: `${lineas.length ? (contadas / lineas.length) * 100 : 0}%` }} />
        </div>
      </div>

      {familias.map(([familia, lista]) => (
        <section key={familia} className={lista.some(visible) ? "" : "hidden"}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{familia}</h3>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {lista.map((l) => {
              const v = valores[l.id] ?? "";
              return (
                <li key={l.id} className={`${visible(l) ? "flex" : "hidden"} flex-wrap items-center gap-2 px-3 py-3 ${v.trim() !== "" ? "bg-green-50/50" : ""}`}>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="text-base font-medium leading-tight">{l.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {l.referencia} · {l.unidad.toLowerCase()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!soloLectura && (
                      <button type="button" onClick={() => sumar(l.id, -1)} className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-white active:bg-slate-100" aria-label={`Quitar uno de ${l.nombre}`}>
                        <Minus size={20} />
                      </button>
                    )}
                    <input
                      name={`n_${l.id}`}
                      inputMode="decimal"
                      placeholder="—"
                      readOnly={soloLectura}
                      value={v}
                      onChange={(e) => setValores({ ...valores, [l.id]: e.target.value })}
                      aria-label={`Contado de ${l.nombre}`}
                      className="h-12 w-20 rounded-md border border-slate-200 px-2 text-center text-lg font-semibold tabular-nums outline-none focus:border-acento"
                    />
                    {!soloLectura && (
                      <button type="button" onClick={() => sumar(l.id, 1)} className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-white active:bg-slate-100" aria-label={`Añadir uno de ${l.nombre}`}>
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
