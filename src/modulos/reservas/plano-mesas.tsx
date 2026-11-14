"use client";
/**
 * Plano de mesas (docs/specs/modulos/reservas/plano-de-mesas.md).
 * Pinta las mesas de cada espacio en su posición con el color del estado en la franja elegida.
 * Con permiso `reservas:planos:editar` se pueden arrastrar y guardar las posiciones.
 */
import { useRef, useState, useTransition } from "react";
import { Move, Save, Undo2 } from "lucide-react";

export type EstadoMesa = "libre" | "reservada" | "llegada" | "sentada";

export interface MesaPlano {
  id: string;
  nombre: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  forma: "CUADRADA" | "REDONDA" | "RECTANGULAR";
  capacidadMin: number;
  capacidadMax: number;
  combinable: boolean;
  especial: string | null;
  estado: EstadoMesa;
  reserva: { nombre: string; personas: number; hora: string } | null;
}

export interface EspacioPlano {
  id: string;
  nombre: string;
  tipo: string;
  aforo: number;
  ancho: number;
  alto: number;
  mesas: MesaPlano[];
}

const COLOR: Record<EstadoMesa, string> = {
  libre: "border-emerald-500 bg-emerald-50 text-emerald-900",
  reservada: "border-amber-500 bg-amber-50 text-amber-900",
  llegada: "border-sky-500 bg-sky-50 text-sky-900",
  sentada: "border-red-600 bg-red-50 text-red-900",
};
const NOMBRE: Record<EstadoMesa, string> = { libre: "Libre", reservada: "Reservada", llegada: "Ha llegado", sentada: "Sentada" };
const REJILLA = 10;

export function PlanoMesas({
  espacios,
  puedeEditar,
  guardar,
}: {
  espacios: EspacioPlano[];
  puedeEditar: boolean;
  guardar: (cambios: { id: string; x: number; y: number }[]) => Promise<{ ok: boolean; mensaje: string }>;
}) {
  const [editando, setEditando] = useState(false);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const arrastre = useRef<{ id: string; dx: number; dy: number; max: { x: number; y: number } } | null>(null);

  const posicion = (m: MesaPlano) => pos[m.id] ?? { x: m.x, y: m.y };
  const cambiadas = Object.keys(pos).length;

  function alPulsar(e: React.PointerEvent<HTMLDivElement>, m: MesaPlano, espacio: EspacioPlano) {
    if (!editando) return;
    const p = posicion(m);
    const caja = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    arrastre.current = { id: m.id, dx: e.clientX - caja.left - p.x, dy: e.clientY - caja.top - p.y, max: { x: espacio.ancho - m.ancho, y: espacio.alto - m.alto } };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a) return;
    const caja = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const ajustar = (v: number, max: number) => Math.min(Math.max(0, Math.round(v / REJILLA) * REJILLA), Math.max(0, max));
    const x = ajustar(e.clientX - caja.left - a.dx, a.max.x);
    const y = ajustar(e.clientY - caja.top - a.dy, a.max.y);
    setPos((p) => ({ ...p, [a.id]: { x, y } }));
  }
  function alSoltar() {
    arrastre.current = null;
  }
  function guardarCambios() {
    const lista = Object.entries(pos).map(([id, p]) => ({ id, ...p }));
    empezar(async () => {
      const r = await guardar(lista);
      setMensaje(r.mensaje);
      if (r.ok) {
        setPos({});
        setEditando(false);
      }
    });
  }

  if (espacios.length === 0)
    return <div className="rounded-lg border border-dashed border-borde bg-white p-8 text-center text-sm text-suave">Este local aún no tiene espacios ni mesas. Créalos en «Espacios y mesas».</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(NOMBRE) as EstadoMesa[]).map((e) => (
            <span key={e} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded border-2 ${COLOR[e]}`} />
              {NOMBRE[e]}
            </span>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mensaje && <span className="text-sm text-suave">{mensaje}</span>}
          {puedeEditar && !editando && (
            <button type="button" onClick={() => { setEditando(true); setMensaje(null); }} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-borde bg-white px-4 text-sm font-medium hover:bg-stone-50">
              <Move size={16} /> Mover mesas
            </button>
          )}
          {editando && (
            <>
              <button type="button" onClick={() => { setPos({}); setEditando(false); }} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-borde bg-white px-4 text-sm font-medium hover:bg-stone-50">
                <Undo2 size={16} /> Descartar
              </button>
              <button type="button" disabled={cambiadas === 0 || pendiente} onClick={guardarCambios} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-acento px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                <Save size={16} /> {pendiente ? "Guardando…" : `Guardar posiciones${cambiadas ? ` (${cambiadas})` : ""}`}
              </button>
            </>
          )}
        </div>
      </div>
      {editando && <p className="text-sm text-suave">Arrastra las mesas a su sitio. Se ajustan a una rejilla de {REJILLA} unidades.</p>}

      {espacios.map((esp) => {
        const libres = esp.mesas.filter((m) => m.estado === "libre").length;
        return (
          <section key={esp.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{esp.nombre}</h2>
              <span className="text-xs text-suave">
                {esp.mesas.length} mesas · {libres} libres · aforo {esp.aforo}
              </span>
            </div>
            <div className="overflow-auto">
              <div
                className={`relative rounded-lg border border-slate-200 ${editando ? "bg-[radial-gradient(circle,_#e2e8f0_1px,_transparent_1px)] [background-size:10px_10px]" : "bg-slate-50"}`}
                style={{ width: esp.ancho, height: esp.alto }}
              >
                {esp.mesas.map((m) => {
                  const p = posicion(m);
                  const redonda = m.forma === "REDONDA";
                  return (
                    <div
                      key={m.id}
                      onPointerDown={(e) => alPulsar(e, m, esp)}
                      onPointerMove={alMover}
                      onPointerUp={alSoltar}
                      onPointerCancel={alSoltar}
                      title={`Mesa ${m.nombre} · ${m.capacidadMin}-${m.capacidadMax} personas${m.especial ? ` · ${m.especial}` : ""}${m.combinable ? " · combinable" : ""}${m.reserva ? `\n${m.reserva.hora} ${m.reserva.nombre} (${m.reserva.personas})` : ""}`}
                      className={`absolute flex select-none flex-col items-center justify-center border-2 text-center leading-tight shadow-sm ${COLOR[m.estado]} ${redonda ? "rounded-full" : "rounded-md"} ${editando ? "cursor-move touch-none ring-offset-1 hover:ring-2 hover:ring-acento" : ""} ${pos[m.id] ? "ring-2 ring-acento" : ""}`}
                      style={{ left: p.x, top: p.y, width: m.ancho, height: m.alto }}
                    >
                      <span className="text-sm font-semibold">{m.nombre}</span>
                      <span className="text-[10px]">{m.reserva ? `${m.reserva.hora} · ${m.reserva.personas}p` : `${m.capacidadMin}-${m.capacidadMax}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
