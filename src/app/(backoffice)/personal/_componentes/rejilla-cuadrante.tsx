"use client";
/**
 * Rejilla editable del cuadrante: personas × 7 días. Al pulsar una celda se abre el editor
 * de ese turno debajo (horario, segundo tramo si es partido, pausa y notas) con los turnos
 * tipo del centro como atajos. Guarda con acciones de servidor.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { Boton, Campo, Entrada } from "@/ui";

export interface CeldaRejilla {
  dia: string;
  asignacion: { id: string; inicio: string; fin: string; inicio2: string | null; fin2: string | null; pausaMinutos: number; notas: string | null; horas: number } | null;
  otroCentro: { centro: string; inicio: string; fin: string } | null;
  ausencia: { tipo: string; estado: string } | null;
}

export interface FilaRejilla {
  empleado: { id: string; nombre: string; puesto: string | null; departamento: string | null; prestado: string | null };
  jornadaSemanal: number | null;
  horasSemana: number;
  celdas: CeldaRejilla[];
}

export interface TurnoTipoRejilla {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
  inicio2: string | null;
  fin2: string | null;
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function horas(h: number) {
  const min = Math.round(h * 60);
  const mm = min % 60;
  return `${Math.floor(min / 60)}${mm ? `:${String(mm).padStart(2, "0")}` : ""} h`;
}

export function RejillaCuadrante({
  centroId,
  dias,
  filas,
  turnosTipo,
  nombresAusencia,
  avisosPorCelda,
  editable,
  volver,
  guardar,
  quitar,
}: {
  centroId: string;
  dias: string[];
  filas: FilaRejilla[];
  turnosTipo: TurnoTipoRejilla[];
  nombresAusencia: Record<string, string>;
  avisosPorCelda: Record<string, string[]>;
  editable: boolean;
  volver: string;
  guardar: (f: FormData) => Promise<void>;
  quitar: (f: FormData) => Promise<void>;
}) {
  const [sel, setSel] = useState<{ empleadoId: string; dia: string } | null>(null);
  const [valores, setValores] = useState({ inicio: "", fin: "", inicio2: "", fin2: "", pausaMinutos: "0", notas: "" });

  const fila = sel ? filas.find((f) => f.empleado.id === sel.empleadoId) : null;
  const celda = fila && sel ? fila.celdas.find((c) => c.dia === sel.dia) : null;

  function abrir(empleadoId: string, c: CeldaRejilla) {
    if (!editable || c.otroCentro) return;
    setSel({ empleadoId, dia: c.dia });
    const a = c.asignacion;
    setValores({ inicio: a?.inicio ?? "", fin: a?.fin ?? "", inicio2: a?.inicio2 ?? "", fin2: a?.fin2 ?? "", pausaMinutos: String(a?.pausaMinutos ?? 0), notas: a?.notas ?? "" });
  }

  const fecha = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Persona</th>
              {dias.map((d, i) => (
                <th key={d} className="px-2 py-2 text-center font-medium">
                  {DIAS[i]} {fecha(d)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Semana</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const exceso = f.jornadaSemanal !== null && f.horasSemana > f.jornadaSemanal + 0.01;
              return (
                <tr key={f.empleado.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{f.empleado.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {f.empleado.puesto ?? "Sin puesto"}
                      {f.empleado.prestado ? ` · de ${f.empleado.prestado}` : ""}
                    </div>
                  </td>
                  {f.celdas.map((c) => {
                    const activa = sel?.empleadoId === f.empleado.id && sel.dia === c.dia;
                    const avisos = avisosPorCelda[`${f.empleado.id}|${c.dia}`] ?? [];
                    const borde = activa ? "ring-2 ring-acento" : avisos.length ? "ring-1 ring-red-300" : "";
                    return (
                      <td key={c.dia} className="px-1 py-1 text-center align-top">
                        <button
                          type="button"
                          title={avisos.join("\n") || undefined}
                          onClick={() => abrir(f.empleado.id, c)}
                          disabled={!editable || !!c.otroCentro}
                          className={`flex min-h-12 w-full flex-col items-center justify-center rounded-md px-1 py-1 text-xs ${borde} ${
                            c.asignacion ? (avisos.length ? "bg-red-50 text-red-800" : "bg-acento-claro text-acento") : c.otroCentro ? "bg-slate-100 text-slate-500" : c.ausencia ? "bg-amber-50 text-amber-800" : "text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          {c.asignacion ? (
                            <>
                              <span className="font-medium tabular-nums">
                                {c.asignacion.inicio}–{c.asignacion.fin}
                              </span>
                              {c.asignacion.inicio2 && (
                                <span className="tabular-nums">
                                  {c.asignacion.inicio2}–{c.asignacion.fin2}
                                </span>
                              )}
                              {c.ausencia && <span className="text-[10px]">{nombresAusencia[c.ausencia.tipo]}</span>}
                            </>
                          ) : c.otroCentro ? (
                            <>
                              <span>{c.otroCentro.centro}</span>
                              <span className="tabular-nums">
                                {c.otroCentro.inicio}–{c.otroCentro.fin}
                              </span>
                            </>
                          ) : c.ausencia ? (
                            <span>
                              {nombresAusencia[c.ausencia.tipo] ?? c.ausencia.tipo}
                              {c.ausencia.estado === "PEDIDA" ? " (pedida)" : ""}
                            </span>
                          ) : (
                            <span>Libre</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-right tabular-nums ${exceso ? "font-semibold text-error" : ""}`}>
                    {horas(f.horasSemana)}
                    <div className="text-xs font-normal text-slate-500">{f.jornadaSemanal !== null ? `de ${horas(f.jornadaSemanal)}` : "sin contrato"}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sel && fila && celda && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">
              {fila.empleado.nombre} · {DIAS[dias.indexOf(sel.dia)]} {fecha(sel.dia)}
            </div>
            <button type="button" onClick={() => setSel(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          {turnosTipo.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {turnosTipo.map((t) => (
                <Boton
                  key={t.id}
                  type="button"
                  variante="secundario"
                  onClick={() => setValores((v) => ({ ...v, inicio: t.inicio, fin: t.fin, inicio2: t.inicio2 ?? "", fin2: t.fin2 ?? "" }))}
                >
                  {t.nombre} {t.inicio}–{t.fin}
                  {t.inicio2 ? ` / ${t.inicio2}–${t.fin2}` : ""}
                </Boton>
              ))}
            </div>
          )}
          <form action={guardar} className="flex flex-wrap items-end gap-3" key={`${sel.empleadoId}-${sel.dia}`}>
            <input type="hidden" name="volver" value={volver} />
            <input type="hidden" name="centroId" value={centroId} />
            <input type="hidden" name="empleadoId" value={sel.empleadoId} />
            <input type="hidden" name="fecha" value={sel.dia} />
            <Campo etiqueta="Entrada">
              <Entrada type="time" name="inicio" required value={valores.inicio} onChange={(e) => setValores({ ...valores, inicio: e.target.value })} />
            </Campo>
            <Campo etiqueta="Salida">
              <Entrada type="time" name="fin" required value={valores.fin} onChange={(e) => setValores({ ...valores, fin: e.target.value })} />
            </Campo>
            <Campo etiqueta="Vuelve (partido)">
              <Entrada type="time" name="inicio2" value={valores.inicio2} onChange={(e) => setValores({ ...valores, inicio2: e.target.value })} />
            </Campo>
            <Campo etiqueta="Sale (partido)">
              <Entrada type="time" name="fin2" value={valores.fin2} onChange={(e) => setValores({ ...valores, fin2: e.target.value })} />
            </Campo>
            <Campo etiqueta="Pausa (min)">
              <Entrada type="number" min={0} step={5} name="pausaMinutos" className="w-24" value={valores.pausaMinutos} onChange={(e) => setValores({ ...valores, pausaMinutos: e.target.value })} />
            </Campo>
            <Campo etiqueta="Notas">
              <Entrada name="notas" value={valores.notas} onChange={(e) => setValores({ ...valores, notas: e.target.value })} />
            </Campo>
            <Boton type="submit">Guardar turno</Boton>
          </form>
          {celda.asignacion && (
            <form action={quitar} className="mt-3">
              <input type="hidden" name="volver" value={volver} />
              <input type="hidden" name="asignacionId" value={celda.asignacion.id} />
              <Boton type="submit" variante="secundario">
                Quitar turno (día libre)
              </Boton>
            </form>
          )}
          <p className="mt-3 text-xs text-slate-500">Si la salida es menor que la entrada, el turno acaba al día siguiente (cierre de madrugada).</p>
        </div>
      )}
    </div>
  );
}
