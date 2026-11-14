import { exigir, centrosFiltro } from "@/kernel/contexto";
import { fecha, fechaHora } from "@/kernel/formato";
import { AreaTexto, Boton, Cabecera, Campo, Entrada, Etiqueta, Pestanas, Selector, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarIncidencias, responsablesPosibles } from "@/modulos/calidad/servicio";
import { crearIncidencia, gestionarIncidencia } from "@/modulos/calidad/acciones";
import { ESTADOS_INCIDENCIA, Indicadores, Mensajes, param, TIPOS_INCIDENCIA, type Busqueda } from "../_comun";

const PRIORIDAD: Record<string, "error" | "aviso" | "normal"> = { ALTA: "error", MEDIA: "aviso", BAJA: "normal" };

export default async function Incidencias({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("calidad", "calidad:ver");
  const sp = await searchParams;
  const vista = param(sp, "estado") ?? "PENDIENTES";
  const [incidencias, usuarios] = await Promise.all([listarIncidencias(ctx, vista), responsablesPosibles(ctx)]);
  const puedeCrear = ctx.puede("calidad:registrar");
  const puedeGestionar = ctx.puede("calidad:incidencias:gestionar");
  const volver = "/calidad/incidencias";
  const centros = ctx.centros.filter((c) => centrosFiltro(ctx).includes(c.id));

  return (
    <>
      <Cabecera titulo="Incidencias" subtitulo="Averías, quejas, accidentes y fallos de seguridad alimentaria, con responsable y plazo." />
      <Mensajes sp={sp} />
      <Indicadores ctx={ctx} />
      <Pestanas
        activa={`/calidad/incidencias?estado=${vista}`}
        items={[
          { href: "/calidad/incidencias?estado=PENDIENTES", titulo: "Pendientes" },
          { href: "/calidad/incidencias?estado=RESUELTA", titulo: "Resueltas" },
          { href: "/calidad/incidencias?estado=ANULADA", titulo: "Anuladas" },
          { href: "/calidad/incidencias?estado=TODAS", titulo: "Todas" },
        ]}
      />
      <TablaDesplegable
        columnas={[
          { titulo: "Número" },
          { titulo: "Centro" },
          { titulo: "Qué pasa" },
          { titulo: "Tipo", secundaria: true },
          { titulo: "Responsable", secundaria: true },
          { titulo: "Plazo" },
          { titulo: "Estado" },
        ]}
        vacio="No hay incidencias en esta vista."
        filas={incidencias.map((i) => ({
          id: i.id,
          tono: i.vencida ? ("error" as const) : i.prioridad === "ALTA" && i.estado === "ABIERTA" ? ("aviso" as const) : undefined,
          celdas: [
            i.numero,
            i.centro,
            i.titulo,
            TIPOS_INCIDENCIA[i.tipo],
            i.responsableNombre ?? "Sin asignar",
            i.plazo ? (i.vencida ? <Etiqueta tono="error">Vencida {fecha(i.plazo)}</Etiqueta> : fecha(i.plazo)) : "—",
            <Etiqueta key="e" tono={ESTADOS_INCIDENCIA[i.estado].tono}>
              {ESTADOS_INCIDENCIA[i.estado].texto}
            </Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Prioridad", valor: <Etiqueta tono={PRIORIDAD[i.prioridad] ?? "normal"}>{i.prioridad.toLowerCase()}</Etiqueta> },
                  { etiqueta: "Origen", valor: i.origen === "MANUAL" ? "Dada de alta a mano" : i.origen === "APPCC" ? "Lista APPCC" : i.origen === "TEMPERATURA" ? "Alarma de temperatura" : i.origen === "LOTE" ? "Retirada de lote del obrador" : i.origen },
                  { etiqueta: "Abierta por", valor: `${i.creadoNombre ?? "—"} · ${fechaHora(i.createdAt)}` },
                  { etiqueta: "Resuelta", valor: fechaHora(i.resueltaEn) },
                  { etiqueta: "Foto", valor: "Subida de fotos pendiente" },
                ]}
              />
              {i.descripcion && <p className="whitespace-pre-line text-sm text-slate-700">{i.descripcion}</p>}
              {puedeGestionar ? (
                <form action={gestionarIncidencia} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <Campo etiqueta="Estado">
                    <Selector name="estado" defaultValue={i.estado}>
                      {Object.entries(ESTADOS_INCIDENCIA).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.texto}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Prioridad">
                    <Selector name="prioridad" defaultValue={i.prioridad}>
                      <option value="ALTA">Alta</option>
                      <option value="MEDIA">Media</option>
                      <option value="BAJA">Baja</option>
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Responsable">
                    <Selector name="responsableId" defaultValue={i.responsableId ?? ""}>
                      <option value="">Sin asignar</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Plazo">
                    <Entrada type="date" name="plazo" defaultValue={i.plazo ? i.plazo.toISOString().slice(0, 10) : ""} />
                  </Campo>
                  <div className="md:col-span-3">
                    <Campo etiqueta="Solución">
                      <AreaTexto name="solucion" rows={2} defaultValue={i.solucion ?? ""} placeholder="Qué se ha hecho para resolverla" />
                    </Campo>
                  </div>
                  <Boton type="submit">Guardar</Boton>
                </form>
              ) : (
                i.solucion && <p className="text-sm">Solución: {i.solucion}</p>
              )}
            </div>
          ),
        }))}
      />
      {puedeCrear && centros.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Nueva incidencia">
            <form action={crearIncidencia} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Centro">
                <Selector name="centroId" defaultValue={centros[0].id}>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Tipo">
                <Selector name="tipo" defaultValue="AVERIA">
                  {Object.entries(TIPOS_INCIDENCIA).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <div className="md:col-span-2">
                <Campo etiqueta="Qué ha pasado">
                  <Entrada name="titulo" required placeholder="No enfría la mesa fría de la línea" />
                </Campo>
              </div>
              <div className="md:col-span-4">
                <Campo etiqueta="Detalle">
                  <AreaTexto name="descripcion" rows={2} />
                </Campo>
              </div>
              <Campo etiqueta="Prioridad">
                <Selector name="prioridad" defaultValue="MEDIA">
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Responsable">
                <Selector name="responsableId" defaultValue="">
                  <option value="">Sin asignar</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Plazo">
                <Entrada type="date" name="plazo" />
              </Campo>
              <Boton type="submit">Abrir incidencia</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
