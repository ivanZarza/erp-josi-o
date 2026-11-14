import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero, porcentaje } from "@/kernel/formato";
import { Boton, Cabecera, Campo, Entrada, Etiqueta, Selector, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarCartas, listarPlatos, marcaDelCentroActivo, marcasDeLaCadena } from "@/modulos/comidas/carta-servicio";
import { actualizarCarta, anadirPlatoSeccion, cambiarActivoCarta, crearCarta, crearSeccion, fijarObjetivoMarca, quitarPlatoSeccion, quitarSeccion } from "@/modulos/comidas/carta-acciones";
import { AvisoError, listaAlergenos, param, PestanasCarta, type Busqueda } from "../_comun";

export default async function Cartas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("comidas", "comidas:carta:ver");
  const sp = await searchParams;
  const marcas = await marcasDeLaCadena(ctx);
  const marcaId = param(sp, "marca") ?? (await marcaDelCentroActivo(ctx)) ?? "";
  const [cartas, platos] = await Promise.all([listarCartas(ctx, marcaId || null), listarPlatos(ctx, { marcaId: marcaId || null })]);
  const puedeEditar = ctx.puede("comidas:carta:editar");
  const volver = "/comidas/carta/cartas";
  const pct = new Map(platos.map((p) => [p.id, p]));

  return (
    <>
      <Cabecera titulo="Cartas" subtitulo="Cartas de cada marca con sus secciones. Las temporales (Navidad, degustación, grupos) tienen fecha de inicio y de fin." />
      <PestanasCarta activa="/comidas/carta/cartas" />
      <AvisoError error={param(sp, "error")} />

      <form className="mb-4 flex flex-wrap items-end gap-3" action="/comidas/carta/cartas">
        <Campo etiqueta="Marca">
          <Selector name="marca" defaultValue={marcaId}>
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Carta" }, { titulo: "Marca" }, { titulo: "Tipo" }, { titulo: "Fechas", secundaria: true }, { titulo: "Secciones", alinear: "derecha" }, { titulo: "Platos", alinear: "derecha" }, { titulo: "Estado" }]}
        vacio="No hay cartas con este filtro. Crea una abajo."
        filas={cartas.map((c) => {
          const disponibles = platos.filter((p) => p.marcaId === c.marcaId);
          return {
            id: c.id,
            celdas: [
              c.nombre,
              c.marca,
              c.tipo === "TEMPORAL" ? <Etiqueta tono="info">Temporal</Etiqueta> : "Permanente",
              c.tipo === "TEMPORAL" ? `${fecha(c.desde)} – ${fecha(c.hasta)}` : "—",
              numero(c.secciones.length),
              numero(c.totalPlatos),
              !c.activo ? <Etiqueta>Desactivada</Etiqueta> : c.vigente ? <Etiqueta tono="ok">En vigor</Etiqueta> : c.proxima ? <Etiqueta tono="aviso">Próxima</Etiqueta> : <Etiqueta>Terminada</Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                {c.secciones.length === 0 && <p className="text-sm text-slate-500">La carta no tiene secciones todavía.</p>}
                {c.secciones.map((s) => (
                  <div key={s.id} className="rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-sm font-semibold">
                        {s.nombre} {s.nombreEn && <span className="font-normal text-slate-500">· {s.nombreEn}</span>}
                      </span>
                      {puedeEditar && (
                        <form action={quitarSeccion}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="volver" value={volver} />
                          <Boton type="submit" variante="secundario">
                            Quitar sección
                          </Boton>
                        </form>
                      )}
                    </div>
                    <ul className="divide-y divide-slate-100 text-sm">
                      {s.lineas.map((l) => {
                        const info = pct.get(l.plato.id);
                        return (
                          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span>
                              <Link className="hover:underline" href={`/comidas/carta/platos/${l.plato.id}`}>
                                {l.plato.nombre}
                              </Link>{" "}
                              {!l.plato.activo && <Etiqueta>Retirado</Etiqueta>}
                              <span className="block text-xs text-slate-500">Alérgenos: {listaAlergenos(l.plato.alergenos)}</span>
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="tabular-nums">{euros(Number(l.plato.precio))}</span>
                              {info && info.coste > 0 && <Etiqueta tono={info.sobreObjetivo ? "error" : "ok"}>{porcentaje(info.pctCoste)}</Etiqueta>}
                              {puedeEditar && (
                                <form action={quitarPlatoSeccion}>
                                  <input type="hidden" name="id" value={l.id} />
                                  <input type="hidden" name="volver" value={volver} />
                                  <Boton type="submit" variante="secundario">
                                    Quitar
                                  </Boton>
                                </form>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {puedeEditar && (
                      <form action={anadirPlatoSeccion} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-3">
                        <input type="hidden" name="seccionId" value={s.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <Selector name="platoId" required defaultValue="" className="max-w-sm">
                          <option value="" disabled>
                            Añadir un plato de {c.marca}…
                          </option>
                          {disponibles
                            .filter((p) => !s.lineas.some((l) => l.plato.id === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} ({euros(p.precio)})
                              </option>
                            ))}
                        </Selector>
                        <Boton type="submit" variante="secundario">
                          Añadir
                        </Boton>
                      </form>
                    )}
                  </div>
                ))}
                {puedeEditar && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <form action={crearSeccion} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="cartaId" value={c.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <Campo etiqueta="Nueva sección">
                        <Entrada name="nombre" required placeholder="Postres" />
                      </Campo>
                      <Campo etiqueta="En inglés">
                        <Entrada name="nombreEn" placeholder="Desserts" />
                      </Campo>
                      <Boton type="submit">Añadir sección</Boton>
                    </form>
                    <form action={actualizarCarta} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="marcaId" value={c.marcaId} />
                      <input type="hidden" name="volver" value={volver} />
                      <Campo etiqueta="Nombre">
                        <Entrada name="nombre" defaultValue={c.nombre} required />
                      </Campo>
                      <Campo etiqueta="Tipo">
                        <Selector name="tipo" defaultValue={c.tipo}>
                          <option value="PERMANENTE">Permanente</option>
                          <option value="TEMPORAL">Temporal</option>
                        </Selector>
                      </Campo>
                      <Campo etiqueta="Desde">
                        <Entrada type="date" name="desde" defaultValue={c.desde ? c.desde.toISOString().slice(0, 10) : ""} />
                      </Campo>
                      <Campo etiqueta="Hasta">
                        <Entrada type="date" name="hasta" defaultValue={c.hasta ? c.hasta.toISOString().slice(0, 10) : ""} />
                      </Campo>
                      <Boton type="submit" variante="secundario">
                        Guardar
                      </Boton>
                    </form>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <DatosDetalle datos={[{ etiqueta: "Platos de la marca fuera de esta carta", valor: numero(disponibles.filter((p) => !c.secciones.some((s) => s.lineas.some((l) => l.plato.id === p.id))).length) }]} />
                  {puedeEditar && (
                    <form action={cambiarActivoCarta}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="activo" value={c.activo ? "false" : "true"} />
                      <input type="hidden" name="volver" value={volver} />
                      <Boton type="submit" variante="secundario">
                        {c.activo ? "Desactivar carta" : "Activar carta"}
                      </Boton>
                    </form>
                  )}
                </div>
              </div>
            ),
          };
        })}
      />

      {puedeEditar && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Tarjeta titulo="Nueva carta">
            <form action={crearCarta} className="grid grid-cols-1 items-end gap-3 md:grid-cols-2">
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Marca">
                <Selector name="marcaId" defaultValue={marcaId || marcas[0]?.id}>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre">
                <Entrada name="nombre" required placeholder="Menú de Navidad 2026" />
              </Campo>
              <Campo etiqueta="Tipo">
                <Selector name="tipo" defaultValue="PERMANENTE">
                  <option value="PERMANENTE">Permanente</option>
                  <option value="TEMPORAL">Temporal (con fechas)</option>
                </Selector>
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Desde">
                  <Entrada type="date" name="desde" />
                </Campo>
                <Campo etiqueta="Hasta">
                  <Entrada type="date" name="hasta" />
                </Campo>
              </div>
              <Boton type="submit">Crear carta</Boton>
            </form>
          </Tarjeta>
          <Tarjeta titulo="Objetivo de coste por marca">
            <div className="space-y-2">
              {marcas.map((m) => (
                <form key={m.id} action={fijarObjetivoMarca} className="flex items-end gap-2">
                  <input type="hidden" name="marcaId" value={m.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <span className="flex-1 text-sm">{m.nombre}</span>
                  <Entrada name="objetivoCostePct" defaultValue={String(m.objetivo)} inputMode="decimal" className="w-24" aria-label={`Objetivo de ${m.nombre} (%)`} />
                  <span className="text-sm">%</span>
                  <Boton type="submit" variante="secundario">
                    Guardar
                  </Boton>
                </form>
              ))}
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
