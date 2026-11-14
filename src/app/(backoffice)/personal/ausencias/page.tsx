import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { fecha } from "@/kernel/formato";
import { Cabecera, Tarjeta, Boton, BotonEnlace, Campo, Entrada, Selector, Cifra, Rejilla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import * as s from "@/modulos/personal/servicio";
import { pedirAusenciaAccion, resolverAusenciaAccion } from "@/modulos/personal/acciones";
import { TIPOS_AUSENCIA, NOMBRE_AUSENCIA } from "@/modulos/personal/esquemas";
import { esMes, hoyMadrid, diasDelMes, mesSiguiente, nombreMes, diaISO, diaSemana, NOMBRES_DIA_CORTO } from "@/modulos/personal/fechas";
import { Mensajes, Volver, Acciones, EtiquetaAusencia, nombreAusencia, param, type Busqueda } from "../_componentes/comun";

export default async function Ausencias({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:ausencias:ver");
  const sp = await searchParams;
  const hoy = hoyMadrid();
  const mesP = param(sp, "mes");
  const mes = esMes(mesP) ? mesP : hoy.slice(0, 7);
  const estado = param(sp, "estado") ?? "";
  const dias = diasDelMes(mes);
  const volver = `/personal/ausencias?mes=${mes}${estado ? `&estado=${estado}` : ""}`;
  const aprobar = ctx.puede("personal:ausencias:aprobar");

  const [ausencias, pendientes, empleados, centros] = await Promise.all([
    s.listarAusencias(ctx, { desde: dias[0], hasta: dias[dias.length - 1], estado: estado || undefined }),
    s.listarAusencias(ctx, { estado: "PEDIDA" }),
    s.listarEmpleados(ctx, { estado: "activos" }),
    s.mapaCentros(ctx),
  ]);
  const autores = await s.nombresUsuarios(ctx, ausencias.flatMap((a) => [a.resueltaPor, a.pedidaPor]));
  const aprobadas = ausencias.filter((a) => a.estado === "APROBADA");
  const bajas = aprobadas.filter((a) => a.tipo.startsWith("BAJA"));

  // calendario: semanas de lunes a domingo
  const huecosInicio = diaSemana(dias[0]);
  const celdas: (string | null)[] = [...Array(huecosInicio).fill(null), ...dias];
  while (celdas.length % 7) celdas.push(null);
  const enDia = (d: string) => ausencias.filter((a) => (a.estado === "APROBADA" || a.estado === "PEDIDA") && diaISO(a.desde) <= d && diaISO(a.hasta) >= d);

  return (
    <>
      <Cabecera
        titulo="Ausencias"
        subtitulo={`${ctx.centroActivo?.nombre ?? "Todos tus centros"} · ${nombreMes(mes)}`}
        acciones={
          <>
            <BotonEnlace href={`/personal/ausencias?mes=${mesSiguiente(mes, -1)}`} variante="secundario">
              Mes anterior
            </BotonEnlace>
            <BotonEnlace href="/personal/ausencias" variante="secundario">
              Este mes
            </BotonEnlace>
            <BotonEnlace href={`/personal/ausencias?mes=${mesSiguiente(mes)}`} variante="secundario">
              Mes siguiente
            </BotonEnlace>
          </>
        }
      />
      <Mensajes sp={sp} />
      <Rejilla columnas={4}>
        <Cifra etiqueta="Por aprobar" valor={pendientes.length} tono={pendientes.length ? "aviso" : "ok"} detalle="en todas las fechas" />
        <Cifra etiqueta="Aprobadas este mes" valor={aprobadas.length} />
        <Cifra etiqueta="Días de vacaciones" valor={aprobadas.filter((a) => a.tipo === "VACACIONES").reduce((t, a) => t + a.dias, 0)} />
        <Cifra etiqueta="Bajas médicas" valor={bajas.length} tono={bajas.length ? "aviso" : "normal"} />
      </Rejilla>

      <Tarjeta titulo={`Calendario de ${nombreMes(mes)}`} className="mt-4">
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-px rounded-lg border border-slate-200 bg-slate-200 text-xs">
            {NOMBRES_DIA_CORTO.map((d) => (
              <div key={d} className="bg-slate-50 px-2 py-1 text-center font-medium uppercase text-slate-500">
                {d}
              </div>
            ))}
            {celdas.map((d, i) => {
              const lista = d ? enDia(d) : [];
              return (
                <div key={i} className={`min-h-20 bg-white p-1 ${d === hoy ? "ring-2 ring-inset ring-acento" : ""} ${!d ? "bg-slate-50" : ""}`}>
                  {d && <div className="mb-1 text-right text-slate-500 tabular-nums">{Number(d.slice(8))}</div>}
                  {lista.slice(0, 4).map((a) => (
                    <div key={a.id} title={`${s.nombreCompleto(a.empleado)} · ${nombreAusencia(a.tipo)}`} className={`mb-0.5 truncate rounded px-1 ${a.estado === "PEDIDA" ? "bg-amber-50 text-amber-800" : a.tipo.startsWith("BAJA") ? "bg-red-50 text-red-800" : "bg-acento-claro text-acento"}`}>
                      {a.empleado.nombre} {a.empleado.apellidos.split(" ")[0]?.[0]}.
                    </div>
                  ))}
                  {lista.length > 4 && <div className="text-slate-500">+{lista.length - 4} más</div>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Burdeos: aprobada · ámbar: pedida · rojo: baja médica.</p>
      </Tarjeta>

      <form className="my-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="mes" value={mes} />
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado}>
            <option value="">Todos</option>
            <option value="PEDIDA">Pedidas</option>
            <option value="APROBADA">Aprobadas</option>
            <option value="RECHAZADA">Rechazadas</option>
            <option value="ANULADA">Anuladas</option>
          </Selector>
        </Campo>
        <Boton variante="secundario" type="submit">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Persona" }, { titulo: "Tipo" }, { titulo: "Desde" }, { titulo: "Hasta" }, { titulo: "Días", alinear: "derecha" }, { titulo: "Centro", secundaria: true }, { titulo: "Estado" }]}
        total={`${ausencias.length} ausencias en ${nombreMes(mes)}`}
        vacio="No hay ausencias este mes."
        filas={ausencias.map((a) => ({
          id: a.id,
          tono: a.estado === "PEDIDA" ? "aviso" : undefined,
          celdas: [
            <Link key="n" href={`/personal/empleados/${a.empleadoId}?pestana=ausencias`} className="font-medium text-acento hover:underline">
              {s.nombreCompleto(a.empleado)}
            </Link>,
            nombreAusencia(a.tipo),
            fecha(a.desde),
            fecha(a.hasta),
            a.dias,
            centros.get(a.centroId)?.nombre ?? "—",
            <EtiquetaAusencia key="e" estado={a.estado} />,
          ],
          detalle: (
            <>
              <DatosDetalle
                datos={[
                  { etiqueta: "Puesto", valor: a.empleado.puesto?.nombre },
                  { etiqueta: "Comentario", valor: a.comentario },
                  { etiqueta: "Pedida por", valor: autores.get(a.pedidaPor ?? "") ?? "—" },
                  { etiqueta: "Resuelta", valor: a.resueltaEn ? `${autores.get(a.resueltaPor ?? "") ?? "—"} · ${fecha(a.resueltaEn)}` : "Pendiente" },
                  ...(a.motivoRechazo ? [{ etiqueta: "Motivo", valor: a.motivoRechazo }] : []),
                ]}
              />
              {aprobar && (a.estado === "PEDIDA" || a.estado === "APROBADA") && (
                <Acciones>
                  <form action={resolverAusenciaAccion} className="flex flex-wrap items-end gap-2">
                    <Volver a={volver} />
                    <input type="hidden" name="ausenciaId" value={a.id} />
                    <Campo etiqueta="Motivo (obligatorio para rechazar)">
                      <Entrada name="motivo" />
                    </Campo>
                    {a.estado === "PEDIDA" && (
                      <>
                        <Boton type="submit" name="decision" value="APROBAR">
                          Aprobar
                        </Boton>
                        <Boton type="submit" name="decision" value="RECHAZAR" variante="peligro">
                          Rechazar
                        </Boton>
                      </>
                    )}
                    <Boton type="submit" name="decision" value="ANULAR" variante="secundario">
                      Anular
                    </Boton>
                  </form>
                </Acciones>
              )}
            </>
          ),
        }))}
      />

      <Tarjeta titulo="Registrar ausencia" className="mt-6">
        <form action={pedirAusenciaAccion} className="flex flex-wrap items-end gap-3">
          <Volver a={volver} />
          <div className="min-w-64">
            <Campo etiqueta="Persona">
              <Selector name="empleadoId" required defaultValue="">
                <option value="">Elige…</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {s.nombreCompleto(e)} · {centros.get(e.centroPrincipalId)?.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
          <Campo etiqueta="Tipo">
            <Selector name="tipo">
              {TIPOS_AUSENCIA.map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_AUSENCIA[t]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Desde">
            <Entrada type="date" name="desde" required />
          </Campo>
          <Campo etiqueta="Hasta">
            <Entrada type="date" name="hasta" required />
          </Campo>
          <Campo etiqueta="Comentario">
            <Entrada name="comentario" />
          </Campo>
          {aprobar && (
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="aprobarYa" className="h-4 w-4 accent-acento" /> Aprobar ya
            </label>
          )}
          <Boton type="submit">Guardar</Boton>
        </form>
        <p className="mt-2 text-xs text-slate-500">Los datos de salud de las bajas solo deben anotarse en el parte (documento), no en el comentario.</p>
      </Tarjeta>
    </>
  );
}
