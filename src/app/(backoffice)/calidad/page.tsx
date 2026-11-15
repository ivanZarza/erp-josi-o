import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, numero } from "@/kernel/formato";
import { AreaTexto, Boton, Cabecera, Campo, Entrada, Etiqueta, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { historialListas, tareasDeHoy } from "@/modulos/calidad/servicio";
import { registrarLista } from "@/modulos/calidad/acciones";
import { Indicadores, Mensajes, TIPOS_LISTA, type Busqueda } from "./_comun";

export default async function TareasDeHoy({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("calidad", "calidad:ver");
  const sp = await searchParams;
  const puedeRegistrar = ctx.puede("calidad:registrar");
  const [{ hoy, cortes, filas }, historial] = await Promise.all([tareasDeHoy(ctx), historialListas(ctx, 7)]);
  const corte = cortes.length === 1 ? `la jornada acaba a las ${cortes[0]}` : "cada centro cierra la jornada a su hora de corte";
  const pendientes = filas.filter((f) => !f.ejecucion).length;

  return (
    <>
      <Cabecera titulo="Calidad · tareas de hoy" subtitulo={hoy ? `Listas de comprobación APPCC de la jornada del ${fecha(hoy)} (${corte}).` : `Listas de comprobación APPCC de la jornada en curso de cada centro (${corte}).`} />
      <Mensajes sp={sp} />
      <Indicadores ctx={ctx} pendientesHoy={pendientes} />

      <TablaDesplegable
        columnas={[{ titulo: "Centro" }, { titulo: "Lista" }, { titulo: "Tipo", secundaria: true }, { titulo: "Puntos", alinear: "derecha" }, { titulo: "Estado" }, { titulo: "Hecha por", secundaria: true }]}
        vacio="No hay listas APPCC para tus centros. Créalas en Plantillas APPCC."
        total={`${filas.length} listas · ${pendientes} pendientes`}
        filas={filas.map((f) => ({
          id: f.clave,
          tono: f.ejecucion && !f.ejecucion.todoCorrecto ? ("error" as const) : undefined,
          celdas: [
            hoy ? f.centro : `${f.centro} · jornada del ${fecha(f.jornada)}`,
            f.plantilla.nombre,
            TIPOS_LISTA[f.plantilla.tipo],
            numero(f.plantilla.puntos.length),
            f.ejecucion ? (
              f.ejecucion.todoCorrecto ? (
                <Etiqueta tono="ok">Hecha</Etiqueta>
              ) : (
                <Etiqueta tono="error">Con fallos</Etiqueta>
              )
            ) : (
              <Etiqueta tono="aviso">Pendiente</Etiqueta>
            ),
            f.ejecucion ? `${f.ejecucion.realizadoNombre ?? "—"} · ${fechaHora(f.ejecucion.createdAt)}` : "—",
          ],
          detalle: f.ejecucion ? (
            <div className="space-y-3">
              <Tabla
                clave={(r) => r.id}
                filas={f.ejecucion.respuestas}
                columnas={[
                  { titulo: "Punto", celda: (r) => r.texto },
                  { titulo: "Dato", celda: (r) => r.valor ?? "—" },
                  { titulo: "Resultado", celda: (r) => (r.correcto ? <Etiqueta tono="ok">Correcto</Etiqueta> : <Etiqueta tono="error">No conforme</Etiqueta>) },
                ]}
              />
              {f.ejecucion.observaciones && <p className="text-sm text-slate-700">Observaciones: {f.ejecucion.observaciones}</p>}
            </div>
          ) : puedeRegistrar ? (
            <form action={registrarLista} className="space-y-3">
              <input type="hidden" name="plantillaId" value={f.plantilla.id} />
              <input type="hidden" name="centroId" value={f.centroId} />
              <input type="hidden" name="volver" value="/calidad" />
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {f.plantilla.puntos.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <label className="flex min-h-10 flex-1 items-center gap-3 text-sm">
                      <input type="checkbox" name={`ok_${p.id}`} defaultChecked className="h-5 w-5" />
                      {p.texto}
                    </label>
                    {p.pideValor && <Entrada name={`valor_${p.id}`} required placeholder="Dato (°C, n.º albarán…)" className="w-48" />}
                  </div>
                ))}
              </div>
              <Campo etiqueta="Observaciones" ayuda="Obligatorias si algún punto no está correcto: se abrirá una incidencia.">
                <AreaTexto name="observaciones" rows={2} />
              </Campo>
              <Boton type="submit">Firmar la lista</Boton>
            </form>
          ) : (
            <DatosDetalle datos={[{ etiqueta: "Estado", valor: "Pendiente (no tienes permiso para registrarla)" }]} />
          ),
        }))}
      />

      <div className="mt-6">
        <Tarjeta titulo="Últimos 7 días">
          <TablaDesplegable
            columnas={[{ titulo: "Día" }, { titulo: "Centro" }, { titulo: "Lista" }, { titulo: "Resultado" }, { titulo: "Hecha por", secundaria: true }]}
            vacio="Sin listas registradas en los últimos 7 días."
            filas={historial.map((e) => ({
              id: e.id,
              tono: e.todoCorrecto ? undefined : ("error" as const),
              celdas: [fecha(e.fecha), e.centro, e.plantilla.nombre, e.todoCorrecto ? <Etiqueta tono="ok">Correcta</Etiqueta> : <Etiqueta tono="error">Con fallos</Etiqueta>, e.realizadoNombre ?? "—"],
              detalle: (
                <div className="space-y-2">
                  <Tabla
                    clave={(r) => r.id}
                    filas={e.respuestas}
                    columnas={[
                      { titulo: "Punto", celda: (r) => r.texto },
                      { titulo: "Dato", celda: (r) => r.valor ?? "—" },
                      { titulo: "Resultado", celda: (r) => (r.correcto ? "Correcto" : "No conforme") },
                    ]}
                  />
                  {e.observaciones && <p className="text-sm">Observaciones: {e.observaciones}</p>}
                </div>
              ),
            }))}
          />
        </Tarjeta>
      </div>
    </>
  );
}
