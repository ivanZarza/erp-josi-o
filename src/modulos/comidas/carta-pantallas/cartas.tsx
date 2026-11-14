/**
 * Cartas de un área: cartas de la marca o de un local, con las secciones de esa área (Comidas o
 * Bebidas) y sus platos. Respeta el local elegido arriba.
 */
import Link from "next/link";
import { euros, fecha, numero, porcentaje } from "@/kernel/formato";
import { Boton, Cabecera, Campo, Entrada, Etiqueta, Selector, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { alcanceCarta, listarCartas, listarPlatos, localesVisibles, marcasDeLaCadena, type AreaCarta } from "../carta-servicio";
import { actualizarCarta, anadirPlatoSeccion, cambiarActivoCarta, crearCarta, crearSeccion, fijarObjetivoMarca, quitarPlatoSeccion, quitarSeccion } from "../carta-acciones";
import { AREA, AvisoError, exigirCarta, listaAlergenos, param, permisoEditar, PestanasCarta, type Busqueda } from "./comun";

export async function PaginaCartas({ area, searchParams }: { area: AreaCarta; searchParams: Busqueda }) {
  const ctx = await exigirCarta(area);
  const A = AREA[area];
  const sp = await searchParams;
  const [al, marcas] = await Promise.all([alcanceCarta(ctx), marcasDeLaCadena(ctx)]);
  const marcaId = al.centroId ? (al.marcaId ?? "") : (param(sp, "marca") ?? "");
  const [cartas, platos, locales] = await Promise.all([listarCartas(ctx, { marcaId: marcaId || null, area }), listarPlatos(ctx, { area, marcaId: marcaId || null }), localesVisibles(ctx)]);
  const puedeEditar = ctx.puede(permisoEditar(area));
  const volver = `${A.base}/cartas`;
  const info = new Map(platos.map((p) => [p.id, p]));
  const ejemploSeccion = area === "BEBIDAS" ? { es: "Tintos de Rioja", en: "Rioja reds" } : { es: "Postres", en: "Desserts" };

  return (
    <>
      <Cabecera
        titulo="Cartas"
        subtitulo={
          al.centroId
            ? `Cartas de ${al.centroNombre} y las de su marca que están activas. Aquí solo se ven las secciones de ${A.platos}.`
            : `Cartas de cada marca y de cada local. Aquí solo se ven las secciones de ${A.platos}. Las temporales tienen fecha de inicio y de fin.`
        }
      />
      <PestanasCarta activa={volver} area={area} />
      <AvisoError error={param(sp, "error")} />

      {!al.centroId && (
        <form className="mb-4 flex flex-wrap items-end gap-3" action={volver}>
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
      )}

      <TablaDesplegable
        columnas={[{ titulo: "Carta" }, { titulo: "De" }, { titulo: "Tipo" }, { titulo: "Fechas", secundaria: true }, { titulo: "Secciones", alinear: "derecha" }, { titulo: A.platos[0].toUpperCase() + A.platos.slice(1), alinear: "derecha" }, { titulo: "Estado" }]}
        vacio={al.centroId ? `${al.centroNombre} no tiene cartas propias ni de su marca. Crea una abajo.` : "No hay cartas con este filtro. Crea una abajo."}
        filas={cartas.map((c) => {
          // platos que pueden ir en esta carta: misma marca y, si son de un local, de ese local
          const disponibles = platos.filter((p) => p.marcaId === c.marcaId && (!p.centroId || p.centroId === c.centroId));
          // para añadir a una sección se ofrecen los que aún no están en esta carta
          const enEstaCarta = new Set(c.secciones.flatMap((s) => s.lineas.map((l) => l.plato.id)));
          const paraAnadir = disponibles.filter((p) => !enEstaCarta.has(p.id));
          return {
            id: c.id,
            celdas: [
              c.nombre,
              c.local ? <Etiqueta key="de" tono="info">Solo {c.local}</Etiqueta> : `${c.marca} (toda la marca)`,
              c.tipo === "TEMPORAL" ? <Etiqueta key="t" tono="info">Temporal</Etiqueta> : "Permanente",
              c.tipo === "TEMPORAL" ? `${fecha(c.desde)} – ${fecha(c.hasta)}` : "—",
              numero(c.secciones.length),
              numero(c.totalPlatos),
              <span key="e">{!c.activo ? <Etiqueta>Desactivada</Etiqueta> : c.vigente ? <Etiqueta tono="ok">En vigor</Etiqueta> : c.proxima ? <Etiqueta tono="aviso">Próxima</Etiqueta> : <Etiqueta>Terminada</Etiqueta>}</span>,
            ],
            detalle: (
              <div className="space-y-4">
                {c.secciones.length === 0 && <p className="text-sm text-slate-500">La carta no tiene secciones de {A.platos} todavía.</p>}
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
                        const p = info.get(l.plato.id);
                        return (
                          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span>
                              <Link className="hover:underline" href={`${A.base}/platos/${l.plato.id}`}>
                                {l.plato.nombre}
                              </Link>{" "}
                              {!l.plato.activo && <Etiqueta>Retirado</Etiqueta>}
                              <span className="block text-xs text-slate-500">
                                {p?.formatos.length ? `${p.formatos.map((f) => `${f.nombre} ${euros(f.precio)}`).join(" · ")} · ` : ""}Alérgenos: {listaAlergenos(l.plato.alergenos)}
                              </span>
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="tabular-nums">{euros(Number(l.plato.precio))}</span>
                              {p && p.coste > 0 && <Etiqueta tono={p.sobreObjetivo ? "error" : "ok"}>{porcentaje(p.pctCoste)}</Etiqueta>}
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
                            Añadir {area === "BEBIDAS" ? "una bebida" : "un plato"} de {c.marca}…
                          </option>
                          {paraAnadir.map((p) => (
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
                      <input type="hidden" name="area" value={area} />
                      <input type="hidden" name="volver" value={volver} />
                      <Campo etiqueta={`Nueva sección de ${A.platos}`}>
                        <Entrada name="nombre" required placeholder={ejemploSeccion.es} />
                      </Campo>
                      <Campo etiqueta="En inglés">
                        <Entrada name="nombreEn" placeholder={ejemploSeccion.en} />
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
                  <DatosDetalle
                    datos={[{ etiqueta: `${A.Plato}s que pueden ir y no están`, valor: numero(paraAnadir.length) }]}
                  />
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
              {al.centroId && al.marcaId ? (
                <input type="hidden" name="marcaId" value={al.marcaId} />
              ) : (
                <Campo etiqueta="Marca">
                  <Selector name="marcaId" defaultValue={marcaId || marcas[0]?.id}>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
              <Campo etiqueta="Para" ayuda="Una carta de toda la marca la ven todos sus locales; la de un local, solo ese local">
                <Selector name="centroId" defaultValue={al.centroId ?? ""}>
                  <option value="">Toda la marca</option>
                  {locales
                    .filter((l) => !marcaId || l.marcaId === marcaId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        Solo {l.nombre}
                      </option>
                    ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre">
                <Entrada name="nombre" required placeholder={area === "BEBIDAS" ? "Carta de vinos" : "Menú de Navidad 2026"} />
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
              {marcas
                .filter((m) => !al.marcaId || m.id === al.marcaId)
                .map((m) => (
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
