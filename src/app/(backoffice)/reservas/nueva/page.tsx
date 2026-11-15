import { exigir } from "@/kernel/contexto";
import { numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, Aviso, Etiqueta } from "@/ui";
import { espaciosDeCentros, mesasDeMisCentros, franjasDelDia, hoyMadrid, NOMBRE_TIPO_ESPACIO } from "@/modulos/reservas/servicio";
import { crearReservaAccion } from "@/modulos/reservas/acciones";
import { AvisosUrl, PestanasReservas, param, type Busqueda } from "@/modulos/reservas/ui";

export default async function NuevaReserva({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("reservas", "reservas:gestionar");
  const sp = await searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, "fecha") ?? "") ? param(sp, "fecha")! : hoyMadrid();
  const locales = ctx.centros.filter((c) => c.tipo === "LOCAL" && c.modulos.includes("reservas"));
  const centro = ctx.centroActivo && locales.some((l) => l.id === ctx.centroActivo!.id) ? ctx.centroActivo : null;
  const [espacios, mesas, franjas] = await Promise.all([
    espaciosDeCentros(ctx.tenant.id, centro ? [centro.id] : locales.map((l) => l.id)),
    centro ? mesasDeMisCentros(ctx) : Promise.resolve([]),
    centro ? franjasDelDia(ctx, centro.id, dia) : Promise.resolve([]),
  ]);
  const nombreLocal = Object.fromEntries(locales.map((l) => [l.id, l.nombre]));

  return (
    <>
      <Cabecera titulo="Nueva reserva" subtitulo={centro ? centro.nombre : "Elige el local en el formulario o arriba en el selector de centro."} />
      <PestanasReservas activa="/reservas/nueva" puedeReglas={ctx.puede("reservas:reglas:editar")} puedePlanos={ctx.puede("reservas:planos:editar")} />
      <AvisosUrl sp={sp} />
      {locales.length === 0 ? (
        <Aviso tono="aviso">No tienes ningún local con Reservas activado.</Aviso>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Tarjeta titulo="Datos de la reserva" className="xl:col-span-2">
            <form action={crearReservaAccion} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Local">
                <Selector name="centroId" defaultValue={centro?.id ?? ""} required>
                  {!centro && <option value="">Elige local…</option>}
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Fecha">
                <Entrada type="date" name="fecha" defaultValue={dia} required />
              </Campo>
              <Campo etiqueta="Hora">
                <Entrada type="time" name="hora" step={900} defaultValue="21:00" required />
              </Campo>
              <Campo etiqueta="Personas">
                <Entrada type="number" name="personas" min={1} defaultValue={2} required />
              </Campo>
              <Campo etiqueta="Nombre">
                <Entrada name="nombre" required autoComplete="off" />
              </Campo>
              <Campo etiqueta="Teléfono" ayuda="Con prefijo: +34…">
                <Entrada name="telefono" type="tel" placeholder="+34 600 000 000" />
              </Campo>
              <Campo etiqueta="Correo">
                <Entrada name="email" type="email" />
              </Campo>
              <Campo etiqueta="Origen" ayuda="Las de la web se guardan como «Solicitada» hasta que las confirmes">
                <Selector name="origen" defaultValue="TELEFONO">
                  <option value="TELEFONO">Teléfono</option>
                  <option value="MANUAL">En el local</option>
                  <option value="WEB">Web</option>
                  <option value="COVERMANAGER">CoverManager</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Zona preferida">
                <Selector name="espacioId" defaultValue="">
                  <option value="">Sin preferencia</option>
                  {espacios.map((e) => (
                    <option key={e.id} value={e.id}>
                      {centro ? "" : `${nombreLocal[e.centroId]} · `}{e.nombre} ({NOMBRE_TIPO_ESPACIO[e.tipo]})
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Mesa" ayuda={centro ? "Si no eliges, se asigna la mejor libre" : "Elige un local arriba para escoger mesa"}>
                <Selector name="mesaId" defaultValue="">
                  <option value="">Asignar automáticamente</option>
                  {mesas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.espacio.nombre} · mesa {m.nombre} (hasta {m.capacidadMax})
                    </option>
                  ))}
                </Selector>
              </Campo>
              <div className="sm:col-span-2">
                <Campo etiqueta="Alergias">
                  <Entrada name="alergias" placeholder="Celíaco, frutos secos…" />
                </Campo>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Campo etiqueta="Notas">
                  <AreaTexto name="notas" rows={2} placeholder="Cumpleaños, trona, mesa tranquila…" />
                </Campo>
              </div>
              <fieldset className="space-y-2 text-sm sm:col-span-2 lg:col-span-4">
                <legend className="mb-1 font-medium">Consentimientos (preguntar al cliente)</legend>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="consentimientoReserva" defaultChecked /> Acepta que guardemos sus datos para gestionar la reserva
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="consentimientoCorreo" /> Quiere recibir ofertas por correo
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="consentimientoWhatsapp" /> Quiere recibir ofertas por WhatsApp
                </label>
                <label className="flex items-center gap-2 text-suave">
                  <input type="checkbox" name="sinMesa" /> Guardar aunque no quede mesa libre (se asigna después en sala)
                </label>
              </fieldset>
              <div className="sm:col-span-2 lg:col-span-4">
                <Boton type="submit">Guardar reserva</Boton>
              </div>
            </form>
          </Tarjeta>

          <Tarjeta titulo="Ocupación por franjas">
            {!centro ? (
              <p className="text-sm text-suave">Elige un local en el selector de arriba para ver los cubiertos de cada franja.</p>
            ) : franjas.length === 0 ? (
              <p className="text-sm text-suave">Este día no hay turnos configurados: no se limita el número de cubiertos.</p>
            ) : (
              <div className="space-y-4">
                <form className="flex gap-2">
                  <Entrada type="date" name="fecha" defaultValue={dia} />
                  <Boton variante="secundario" type="submit">Ver</Boton>
                </form>
                {franjas.map(({ turno, franjas: lista }) => (
                  <div key={turno.id}>
                    <div className="mb-1 text-sm font-semibold">{turno.nombre} · máx. {numero(turno.maxCubiertosFranja)} cada {turno.intervaloMin} min</div>
                    <ul className="divide-y divide-borde text-sm">
                      {lista.map((f) => {
                        const lleno = f.cubiertos >= f.maximo;
                        return (
                          <li key={f.hora} className="flex items-center justify-between py-1">
                            <span className="tabular-nums">{f.hora}</span>
                            <span className="flex items-center gap-2 tabular-nums">
                              {numero(f.cubiertos)} / {numero(f.maximo)}
                              {lleno ? <Etiqueta tono="error">Completa</Etiqueta> : f.cubiertos >= f.maximo * 0.75 ? <Etiqueta tono="aviso">Casi llena</Etiqueta> : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
        </div>
      )}
    </>
  );
}
