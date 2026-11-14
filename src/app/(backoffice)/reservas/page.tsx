import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { exigir } from "@/kernel/contexto";
import { fecha as fmtFecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Boton, BotonEnlace, Entrada, Selector, HuecoIntegracion, Vacio, Tarjeta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { reservasDelDia, mesasDeMisCentros, hoyMadrid, sumarDias, estadosSiguientes, NOMBRE_ESTADO, NOMBRE_ORIGEN, type EstadoReserva } from "@/modulos/reservas/servicio";
import { cambiarEstadoReservaAccion, cambiarMesaAccion } from "@/modulos/reservas/acciones";
import { AvisosUrl, EtiquetaEstadoReserva, PestanasReservas, param, type Busqueda } from "@/modulos/reservas/ui";

export default async function ReservasDelDia({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("reservas", "reservas:ver");
  const sp = await searchParams;
  const hoy = hoyMadrid();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, "fecha") ?? "") ? param(sp, "fecha")! : hoy;
  const [{ reservas, nombreEspacio }, mesasCentros] = await Promise.all([reservasDelDia(ctx, dia), mesasDeMisCentros(ctx)]);
  const puedeGestionar = ctx.puede("reservas:gestionar");
  const variosCentros = !ctx.centroActivo;
  const nombreCentro = Object.fromEntries(ctx.centros.map((c) => [c.id, c.nombre]));
  const volver = `/reservas?fecha=${dia}`;

  const vivas = reservas.filter((r) => r.estado !== "CANCELADA" && r.estado !== "NO_PRESENTADA");
  const personas = vivas.reduce((a, r) => a + r.personas, 0);
  const enSala = reservas.filter((r) => r.estado === "SENTADA" || r.estado === "LLEGADA").length;
  const noPresentadas = reservas.filter((r) => r.estado === "NO_PRESENTADA").length;

  // Agrupar por hora en punto
  const grupos = new Map<string, typeof reservas>();
  for (const r of reservas) {
    const k = `${r.hora.slice(0, 2)}:00`;
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }

  const columnas = [
    { titulo: "Hora" },
    { titulo: "Nombre" },
    { titulo: "Pers.", alinear: "derecha" as const },
    { titulo: "Mesa" },
    ...(variosCentros ? [{ titulo: "Local", secundaria: true }] : [{ titulo: "Zona", secundaria: true }]),
    { titulo: "Estado" },
    { titulo: "Origen", secundaria: true },
  ];

  return (
    <>
      <Cabecera
        titulo={dia === hoy ? "Reservas de hoy" : `Reservas del ${fmtFecha(new Date(`${dia}T12:00:00Z`))}`}
        subtitulo={ctx.centroActivo ? ctx.centroActivo.nombre : `Todos tus locales (${ctx.centros.length}). Elige uno arriba para ver solo ese.`}
        acciones={puedeGestionar ? <BotonEnlace href={`/reservas/nueva?fecha=${dia}`}><Plus size={16} className="mr-1" />Nueva reserva</BotonEnlace> : undefined}
      />
      <PestanasReservas activa="/reservas" puedeReglas={ctx.puede("reservas:reglas:editar")} puedePlanos={ctx.puede("reservas:planos:editar")} />
      <AvisosUrl sp={sp} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BotonEnlace variante="secundario" href={`/reservas?fecha=${sumarDias(dia, -1)}`}><ChevronLeft size={16} />Día anterior</BotonEnlace>
        <form className="flex items-center gap-2">
          <Entrada type="date" name="fecha" defaultValue={dia} className="w-44" />
          <Boton variante="secundario" type="submit">Ver</Boton>
        </form>
        <BotonEnlace variante="secundario" href={`/reservas?fecha=${sumarDias(dia, 1)}`}>Día siguiente<ChevronRight size={16} /></BotonEnlace>
        {dia !== hoy && <BotonEnlace variante="secundario" href="/reservas">Hoy</BotonEnlace>}
      </div>

      <div className="mb-6">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Reservas" valor={numero(vivas.length)} detalle={`${numero(reservas.length - vivas.length)} canceladas o no presentadas`} />
          <Cifra etiqueta="Personas" valor={numero(personas)} />
          <Cifra etiqueta="En sala ahora" valor={numero(enSala)} tono={enSala > 0 ? "ok" : "normal"} />
          <Cifra etiqueta="No presentadas" valor={numero(noPresentadas)} tono={noPresentadas > 0 ? "error" : "normal"} />
        </Rejilla>
      </div>

      {reservas.length === 0 ? (
        <Vacio>
          No hay reservas este día. {puedeGestionar && <Link className="text-acento underline" href={`/reservas/nueva?fecha=${dia}`}>Apunta una nueva</Link>}
        </Vacio>
      ) : (
        <div className="space-y-6">
          {Array.from(grupos.entries()).map(([hora, lista]) => (
            <section key={hora}>
              <h2 className="mb-2 text-sm font-semibold text-suave">
                {hora} · {numero(lista.length)} {lista.length === 1 ? "reserva" : "reservas"} · {numero(lista.reduce((a, r) => a + (r.estado === "CANCELADA" ? 0 : r.personas), 0))} personas
              </h2>
              <TablaDesplegable
                columnas={columnas}
                total={`${lista.length} reservas`}
                filas={lista.map((r) => {
                  const mesas = r.mesas.map((m) => m.mesa.nombre).join(" + ");
                  const zona = r.mesas[0]?.mesa.espacio.nombre ?? (r.espacioId ? nombreEspacio[r.espacioId] : null);
                  return {
                    id: r.id,
                    tono: r.estado === "NO_PRESENTADA" ? ("error" as const) : !mesas && r.estado !== "CANCELADA" ? ("aviso" as const) : undefined,
                    celdas: [
                      <span key="h" className="font-medium tabular-nums">{r.hora}</span>,
                      <span key="n">{r.nombre}{r.alergias && <span className="ml-2 text-xs text-error">Alergias</span>}</span>,
                      numero(r.personas),
                      mesas || <span className="text-aviso">Sin mesa</span>,
                      variosCentros ? nombreCentro[r.centroId] : (zona ?? "—"),
                      <EtiquetaEstadoReserva key="e" estado={r.estado} />,
                      NOMBRE_ORIGEN[r.origen],
                    ],
                    detalle: (
                      <div className="space-y-4">
                        <DatosDetalle
                          datos={[
                            { etiqueta: "Teléfono", valor: r.telefono ?? "—" },
                            { etiqueta: "Correo", valor: r.email ?? "—" },
                            { etiqueta: "Duración", valor: `${numero(r.duracionMin)} min` },
                            { etiqueta: "Zona", valor: zona ?? "Sin preferencia" },
                            { etiqueta: "Notas", valor: r.notas ?? "—" },
                            { etiqueta: "Alergias", valor: r.alergias ? <span className="text-error">{r.alergias}</span> : "—" },
                            { etiqueta: "Cliente", valor: r.clienteId ? <Link className="text-acento underline" href={`/clientes/${r.clienteId}`}>Ver ficha</Link> : "—" },
                            { etiqueta: "Creada", valor: fechaHora(r.createdAt) },
                          ]}
                        />
                        {puedeGestionar && (
                          <div className="flex flex-wrap items-end gap-2">
                            {estadosSiguientes(r.estado).map((e: EstadoReserva) => (
                              <form key={e} action={cambiarEstadoReservaAccion}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="estado" value={e} />
                                <input type="hidden" name="volver" value={volver} />
                                <Boton type="submit" variante={e === "CANCELADA" || e === "NO_PRESENTADA" ? "secundario" : "principal"}>{NOMBRE_ESTADO[e]}</Boton>
                              </form>
                            ))}
                            {["SOLICITADA", "CONFIRMADA", "LLEGADA"].includes(r.estado) && (
                              <form action={cambiarMesaAccion} className="flex items-end gap-2">
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="volver" value={volver} />
                                <Selector name="mesaId" defaultValue="" className="w-56">
                                  <option value="">Asignar automáticamente</option>
                                  {mesasCentros
                                    .filter((m) => m.centroId === r.centroId)
                                    .map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.espacio.nombre} · mesa {m.nombre} (hasta {m.capacidadMax})
                                      </option>
                                    ))}
                                </Selector>
                                <Boton type="submit" variante="secundario">Cambiar mesa</Boton>
                              </form>
                            )}
                          </div>
                        )}
                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-suave">Historial</div>
                          <ul className="space-y-0.5 text-xs text-suave">
                            {r.historial.map((h) => (
                              <li key={h.id}>
                                {fechaHora(h.createdAt)} · {h.desde ? `${NOMBRE_ESTADO[h.desde]} → ` : ""}{NOMBRE_ESTADO[h.hasta]}{h.nota ? ` · ${h.nota}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ),
                  };
                })}
              />
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HuecoIntegracion nombre="CoverManager" descripcion="Las reservas de CoverManager aparecerán aquí solas (origen «CoverManager») y las nuevas se crearán también allí si su API lo permite" />
        <HuecoIntegracion nombre="Reservar con Google" descripcion="Botón «Reservar» en la ficha de Google de cada local, que llegará como reserva de origen «Web»" />
      </div>
      {variosCentros && (
        <div className="mt-4">
          <Tarjeta titulo="Consejo">
            <p className="text-sm text-suave">Para ver el plano de mesas y la ocupación por franjas, elige un local en el selector de arriba.</p>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
