import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, euros, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, BotonEnlace, Etiqueta, Tabla, Vacio } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { detalleSolicitud, listarMenus, marcasYLocales, estadosSiguientes, nombreOrigen, pasosPresupuesto, NOMBRE_ESTADO, NOMBRE_TIPO, type TipoEvento } from "@/modulos/eventos/servicio";
import { espaciosDeCentros, reservasDeEspacio, NOMBRE_TIPO_ESPACIO } from "@/modulos/reservas/servicio";
import { cambiarEstadoAccion, asignarLocalAccion, crearPresupuestoAccion, cambiarEstadoPresupuestoAccion } from "@/modulos/eventos/acciones";
import { AvisosUrl, EtiquetaEstadoEvento, type Busqueda } from "@/modulos/eventos/ui";

const ESTADO_PRESUPUESTO = { BORRADOR: "Borrador", ENVIADO: "Enviado", ACEPTADO: "Aceptado", RECHAZADO: "Rechazado" } as const;

export default async function DetalleEvento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigir("eventos", "eventos:ver");
  const { id } = await params;
  const sp = await searchParams;
  const s = await detalleSolicitud(ctx, id);
  if (!s) notFound();
  const puede = ctx.puede("eventos:gestionar");
  const [menus, { marcas, locales }] = await Promise.all([listarMenus(ctx), marcasYLocales(ctx)]);
  const conReservas = ctx.tieneModulo("reservas");
  const espacios = conReservas ? await espaciosDeCentros(ctx.tenant.id, locales.map((l) => l.id)) : [];
  const fechaTxt = s.fecha ? s.fecha.toISOString().slice(0, 10) : null;
  const ocupacion = conReservas && s.espacioId && fechaTxt ? await reservasDeEspacio(ctx.tenant.id, s.espacioId, fechaTxt) : [];
  const nombreMarca = Object.fromEntries(marcas.map((m) => [m.id, m.nombre]));
  const nombreLocal = Object.fromEntries(locales.map((l) => [l.id, l.nombre]));
  const espacio = espacios.find((e) => e.id === s.espacioId);
  // Menús de la marca del evento primero (y los generales)
  const menusMarca = menus.filter((m) => !s.marcaId || !m.marcaId || m.marcaId === s.marcaId);
  const abierta = s.estado !== "CELEBRADA" && s.estado !== "PERDIDA";

  return (
    <>
      <Cabecera
        titulo={`${s.numero} · ${s.nombreContacto}`}
        subtitulo={`${NOMBRE_TIPO[s.tipo as TipoEvento]} · ${numero(s.personas)} personas · ${s.fecha ? fecha(s.fecha) : "sin fecha"}${s.hora ? ` ${s.hora}` : ""}`}
        acciones={<BotonEnlace variante="secundario" href="/eventos">Volver</BotonEnlace>}
      />
      <AvisosUrl sp={sp} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Tarjeta titulo="Solicitud" acciones={<EtiquetaEstadoEvento estado={s.estado} />}>
            <DatosDetalle
              datos={[
                { etiqueta: "Contacto", valor: s.nombreContacto },
                { etiqueta: "Empresa", valor: s.empresa ?? "—" },
                { etiqueta: "Teléfono", valor: s.telefono ?? "—" },
                { etiqueta: "Correo", valor: s.email ?? "—" },
                { etiqueta: "Marca", valor: s.marcaId ? nombreMarca[s.marcaId] : s.recomiendame ? "Pide recomendación" : "—" },
                { etiqueta: "Local", valor: s.centroId ? nombreLocal[s.centroId] ?? "—" : "Sin asignar" },
                { etiqueta: "Espacio", valor: espacio ? `${espacio.nombre} (aforo ${espacio.aforo})` : "—" },
                { etiqueta: "Quiere gastar", valor: s.presupuestoCliente ? euros(s.presupuestoCliente) : "—" },
                { etiqueta: "Origen", valor: nombreOrigen(s.origen) },
                { etiqueta: "Cliente", valor: s.clienteId ? <Link className="text-acento underline" href={`/clientes/${s.clienteId}`}>Ver ficha</Link> : "—" },
                { etiqueta: "Motivo de pérdida", valor: s.motivoPerdida ?? "—" },
                { etiqueta: "Recibida", valor: fechaHora(s.createdAt) },
              ]}
            />
            {s.notas && <p className="mt-3 whitespace-pre-line text-sm">{s.notas}</p>}
            {puede && (
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-borde pt-4">
                {estadosSiguientes(s.estado)
                  .filter((e) => e !== "PERDIDA")
                  .map((e) => (
                    <form key={e} action={cambiarEstadoAccion}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="estado" value={e} />
                      <Boton type="submit">Pasar a «{NOMBRE_ESTADO[e]}»</Boton>
                    </form>
                  ))}
                {estadosSiguientes(s.estado).includes("PERDIDA") && (
                  <form action={cambiarEstadoAccion} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="estado" value="PERDIDA" />
                    <Entrada name="nota" placeholder="Motivo: precio, fecha, otro local…" className="w-64" required />
                    <Boton type="submit" variante="peligro">Marcar como perdida</Boton>
                  </form>
                )}
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Presupuestos">
            <TablaDesplegable
              columnas={[{ titulo: "Número" }, { titulo: "Versión", alinear: "derecha" }, { titulo: "Total", alinear: "derecha" }, { titulo: "Señal", alinear: "derecha", secundaria: true }, { titulo: "Estado" }, { titulo: "Fecha", secundaria: true }]}
              vacio="Aún no hay presupuestos. Crea el primero con un menú de grupo."
              filas={s.presupuestos.map((p) => ({
                id: p.id,
                celdas: [
                  <span key="n" className="font-medium">{p.numero}</span>,
                  `v${p.version}`,
                  euros(p.total),
                  p.senal ? euros(p.senal) : "—",
                  <Etiqueta key="e" tono={p.estado === "ACEPTADO" ? "ok" : p.estado === "RECHAZADO" ? "error" : p.estado === "ENVIADO" ? "info" : "normal"}>{ESTADO_PRESUPUESTO[p.estado]}</Etiqueta>,
                  fecha(p.createdAt),
                ],
                detalle: (
                  <div className="space-y-3">
                    <Tabla
                      clave={(l) => l.id}
                      filas={p.lineas}
                      columnas={[
                        { titulo: "Concepto", celda: (l) => l.concepto },
                        { titulo: "Cantidad", alinear: "derecha", celda: (l) => numero(l.cantidad) },
                        { titulo: "Precio", alinear: "derecha", celda: (l) => euros(l.precio) },
                        { titulo: "IVA", alinear: "derecha", celda: (l) => `${numero(l.iva)} %` },
                        { titulo: "Importe", alinear: "derecha", celda: (l) => euros(l.importe) },
                      ]}
                    />
                    <div className="text-right text-sm font-semibold">Total (IVA incluido): {euros(p.total)}</div>
                    {p.condiciones && <p className="whitespace-pre-line text-sm text-suave">{p.condiciones}</p>}
                    <DatosDetalle datos={[{ etiqueta: "Enviado", valor: fechaHora(p.enviadoEn) }, { etiqueta: "Aceptado", valor: fechaHora(p.aceptadoEn) }]} />
                    {puede && abierta && (
                      <div className="flex flex-wrap gap-2">
                        {pasosPresupuesto(p.estado).map((e) => (
                          <form key={e} action={cambiarEstadoPresupuestoAccion}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="solicitudId" value={s.id} />
                            <input type="hidden" name="estado" value={e} />
                            <Boton type="submit" variante={e === "RECHAZADO" ? "secundario" : "principal"}>
                              {e === "ENVIADO" ? "Marcar como enviado" : e === "ACEPTADO" ? "El cliente lo acepta" : "El cliente lo rechaza"}
                            </Boton>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
            {puede && abierta && (
              <form action={crearPresupuestoAccion} className="mt-4 grid grid-cols-1 gap-3 border-t border-borde pt-4 sm:grid-cols-3">
                <input type="hidden" name="solicitudId" value={s.id} />
                <div className="text-sm font-semibold sm:col-span-3">Nuevo presupuesto (versión {s.presupuestos.length + 1})</div>
                <Campo etiqueta="Menú de grupo">
                  <Selector name="menuId" defaultValue="">
                    <option value="">Sin menú</option>
                    {menusMarca.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} · {euros(m.precioPersona)} / persona{m.marcaId ? ` · ${nombreMarca[m.marcaId] ?? ""}` : ""}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Personas"><Entrada type="number" name="personas" min={1} defaultValue={s.personas} /></Campo>
                <Campo etiqueta="Señal (€)"><Entrada name="senal" inputMode="decimal" placeholder="300,00" /></Campo>
                <div className="sm:col-span-3">
                  <Campo etiqueta="Extras" ayuda="Uno por línea: concepto;cantidad;precio con IVA. Ejemplo: Barra libre 1 h;40;12,50">
                    <AreaTexto name="extras" rows={3} />
                  </Campo>
                </div>
                <div className="sm:col-span-3">
                  <Campo etiqueta="Condiciones">
                    <AreaTexto name="condiciones" rows={2} defaultValue="Precios con IVA incluido. Confirmación del número de comensales 72 horas antes. Señal del 30 % para bloquear la fecha." />
                  </Campo>
                </div>
                <div className="sm:col-span-3"><Boton type="submit">Crear presupuesto</Boton></div>
              </form>
            )}
          </Tarjeta>
        </div>

        <div className="space-y-4">
          {puede && abierta && (
            <Tarjeta titulo="Local, espacio y fecha">
              <form action={asignarLocalAccion} className="space-y-3">
                <input type="hidden" name="id" value={s.id} />
                <Campo etiqueta="Local">
                  <Selector name="centroId" defaultValue={s.centroId ?? ""}>
                    <option value="">Sin asignar</option>
                    {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </Selector>
                </Campo>
                {conReservas && (
                  <Campo etiqueta="Espacio" ayuda="Espacios del módulo Reservas">
                    <Selector name="espacioId" defaultValue={s.espacioId ?? ""}>
                      <option value="">Sin espacio</option>
                      {espacios.map((e) => (
                        <option key={e.id} value={e.id}>
                          {nombreLocal[e.centroId]} · {e.nombre} ({NOMBRE_TIPO_ESPACIO[e.tipo]}, {e.aforo} pers.)
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Fecha"><Entrada type="date" name="fecha" defaultValue={fechaTxt ?? ""} /></Campo>
                  <Campo etiqueta="Hora"><Entrada type="time" name="hora" step={900} defaultValue={s.hora ?? ""} /></Campo>
                </div>
                <Boton type="submit" variante="secundario">Guardar</Boton>
              </form>
            </Tarjeta>
          )}

          {espacio && fechaTxt && (
            <Tarjeta titulo={`Ocupación de ${espacio.nombre} ese día`}>
              {espacio.aforo < s.personas && <p className="mb-2 text-sm text-error">El aforo del espacio ({espacio.aforo}) es menor que el grupo ({s.personas}).</p>}
              {ocupacion.length === 0 ? (
                <p className="text-sm text-ok">Sin reservas en este espacio ese día.</p>
              ) : (
                <ul className="divide-y divide-borde text-sm">
                  {ocupacion.map((r) => (
                    <li key={r.id} className="flex justify-between py-1">
                      <span>{r.hora} · {r.nombre}</span>
                      <span className="tabular-nums">{r.personas} pers.</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          )}

          <Tarjeta titulo="Historial">
            {s.historial.length === 0 ? (
              <Vacio>Sin cambios.</Vacio>
            ) : (
              <ul className="space-y-1 text-sm">
                {s.historial.map((h) => (
                  <li key={h.id}>
                    <span className="text-suave">{fechaHora(h.createdAt)}</span> · {h.desde ? `${NOMBRE_ESTADO[h.desde]} → ` : ""}{NOMBRE_ESTADO[h.hasta]}
                    {h.nota && <span className="text-suave"> · {h.nota}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
