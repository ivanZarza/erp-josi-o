import { exigir, centrosFiltro } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Boton, Cabecera, Campo, Entrada, Etiqueta, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { jornadaHoy, listarMantenimiento } from "@/modulos/calidad/servicio";
import { crearMantenimiento, desactivarMantenimiento, marcarMantenimientoHecho } from "@/modulos/calidad/acciones";
import { Indicadores, Mensajes, type Busqueda } from "../_comun";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function cada(dias: number) {
  if (dias % 365 === 0) return dias === 365 ? "Cada año" : `Cada ${numero(dias / 365)} años`;
  if (dias % 30 === 0) return dias === 30 ? "Cada mes" : `Cada ${numero(dias / 30)} meses`;
  if (dias % 7 === 0) return dias === 7 ? "Cada semana" : `Cada ${numero(dias / 7)} semanas`;
  return `Cada ${numero(dias)} días`;
}

export default async function Mantenimiento({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("calidad", "calidad:ver");
  const sp = await searchParams;
  const tareas = await listarMantenimiento(ctx);
  const hoy = jornadaHoy();
  const puedeRegistrar = ctx.puede("calidad:registrar");
  const puedeEditar = ctx.puede("calidad:editar");
  const volver = "/calidad/mantenimiento";
  const centros = ctx.centros.filter((c) => centrosFiltro(ctx).includes(c.id));

  // Calendario de los próximos 3 meses (las vencidas van al mes actual)
  const mesActual = hoy.slice(0, 7);
  const meses: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(`${mesActual}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    meses.push(d.toISOString().slice(0, 7));
  }

  return (
    <>
      <Cabecera titulo="Mantenimiento preventivo" subtitulo="Campanas, extintores, cámaras, desratización… con su periodicidad y la empresa que lo hace." />
      <Mensajes sp={sp} />
      <Indicadores ctx={ctx} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {meses.map((m) => {
          const delMes = tareas.filter((t) => (t.proxima.slice(0, 7) === m) || (m === mesActual && t.proxima.slice(0, 7) < m));
          return (
            <Tarjeta key={m} titulo={`${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`}>
              {delMes.length === 0 ? (
                <p className="text-sm text-slate-500">Nada previsto.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {delMes.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2">
                      <span>
                        <span className="tabular-nums">{fecha(t.proximaVez)}</span> · {t.nombre}
                        <span className="block text-xs text-slate-500">{t.centro}</span>
                      </span>
                      {t.vencida && <Etiqueta tono="error">Vencida</Etiqueta>}
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          );
        })}
      </div>

      <TablaDesplegable
        columnas={[{ titulo: "Centro" }, { titulo: "Tarea" }, { titulo: "Periodicidad", secundaria: true }, { titulo: "Empresa", secundaria: true }, { titulo: "Última vez" }, { titulo: "Próxima" }]}
        vacio="No hay mantenimientos dados de alta. Añádelos abajo."
        filas={tareas.map((t) => ({
          id: t.id,
          tono: t.vencida ? ("error" as const) : t.diasParaProxima <= 7 ? ("aviso" as const) : undefined,
          celdas: [
            t.centro,
            t.equipo ? `${t.nombre} · ${t.equipo}` : t.nombre,
            cada(t.cadaDias),
            t.empresa ?? "Personal propio",
            fecha(t.ultimaVez),
            t.vencida ? <Etiqueta tono="error">{fecha(t.proximaVez)}</Etiqueta> : t.diasParaProxima <= 7 ? <Etiqueta tono="aviso">{fecha(t.proximaVez)}</Etiqueta> : fecha(t.proximaVez),
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle datos={[{ etiqueta: "Notas", valor: t.notas ?? "—" }, { etiqueta: "Días para la próxima", valor: numero(t.diasParaProxima) }]} />
              {puedeRegistrar && (
                <form action={marcarMantenimientoHecho} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="tareaId" value={t.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <Campo etiqueta="Hecho el">
                    <Entrada type="date" name="fecha" defaultValue={hoy} required />
                  </Campo>
                  <Campo etiqueta="Coste (€)">
                    <Entrada name="coste" inputMode="decimal" className="w-28" />
                  </Campo>
                  <div className="min-w-64 flex-1">
                    <Campo etiqueta="Nota">
                      <Entrada name="nota" placeholder="Certificado n.º, incidencias…" />
                    </Campo>
                  </div>
                  <Boton type="submit">Marcar como hecho</Boton>
                </form>
              )}
              <Tabla
                clave={(h) => h.id}
                filas={t.hechos}
                vacio="Sin registros anteriores."
                columnas={[
                  { titulo: "Fecha", celda: (h) => fecha(h.fecha) },
                  { titulo: "Coste", alinear: "derecha", celda: (h) => (h.coste != null ? euros(h.coste) : "—") },
                  { titulo: "Nota", celda: (h) => h.nota ?? "—" },
                  { titulo: "Quién", celda: (h) => h.realizadoNombre ?? "—" },
                ]}
              />
              {puedeEditar && (
                <form action={desactivarMantenimiento}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <Boton type="submit" variante="secundario">
                    Dar de baja la tarea
                  </Boton>
                </form>
              )}
            </div>
          ),
        }))}
      />

      {puedeEditar && centros.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Nuevo mantenimiento">
            <form action={crearMantenimiento} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
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
              <Campo etiqueta="Tarea">
                <Entrada name="nombre" required placeholder="Limpieza de campana y conductos" />
              </Campo>
              <Campo etiqueta="Equipo">
                <Entrada name="equipo" placeholder="Campana de la parrilla" />
              </Campo>
              <Campo etiqueta="Empresa">
                <Entrada name="empresa" placeholder="Empresa que lo hace" />
              </Campo>
              <Campo etiqueta="Cada cuántos días">
                <Entrada name="cadaDias" inputMode="numeric" required defaultValue="90" />
              </Campo>
              <Campo etiqueta="Próxima vez">
                <Entrada type="date" name="proximaVez" required defaultValue={hoy} />
              </Campo>
              <Campo etiqueta="Notas">
                <Entrada name="notas" />
              </Campo>
              <Boton type="submit">Añadir</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
