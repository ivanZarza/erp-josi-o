import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { euros, numero, numeroCampo } from "@/kernel/formato";
import { AreaTexto, Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, Rejilla, Selector, Tabla, Tarjeta } from "@/ui";
import { ALERGENOS, nombreAlergeno } from "@/modulos/comidas/carta-alergenos";
import { catalogoParaRecetas, fichaReceta } from "@/modulos/obrador/servicio";
import { actualizarLineaReceta, actualizarReceta, anadirLineaReceta, cambiarActivoReceta, quitarLineaReceta } from "@/modulos/obrador/acciones";
import { AvisoError, param, unidad, type Busqueda } from "../../_comun";

export default async function FichaReceta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigir("obrador", "obrador:recetas:ver");
  const { id } = await params;
  const sp = await searchParams;
  const r = await fichaReceta(ctx, id);
  if (!r) notFound();
  const puedeEditar = ctx.puede("obrador:recetas:editar");
  const catalogo = puedeEditar ? (await catalogoParaRecetas(ctx)).filter((p) => p.id !== r.productoId) : [];
  const grupos = Array.from(new Set(catalogo.map((p) => p.grupo)));
  const volver = `/obrador/recetas/${r.id}`;
  const heredados = r.calc.alergenos;

  return (
    <>
      <Cabecera
        titulo={r.nombre}
        subtitulo={`Elaborado: ${r.producto} (${r.referencia}) · ${r.obrador}`}
        acciones={
          <>
            <BotonEnlace href="/obrador/recetas" variante="secundario">
              Volver a recetas
            </BotonEnlace>
            {puedeEditar && (
              <form action={cambiarActivoReceta}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="activo" value={r.activo ? "false" : "true"} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit" variante="secundario">
                  {r.activo ? "Desactivar receta" : "Activar receta"}
                </Boton>
              </form>
            )}
          </>
        }
      />
      <AvisoError error={param(sp, "error")} />

      <Rejilla columnas={4}>
        <Cifra etiqueta="Coste por tanda" valor={euros(r.calc.costeMedio)} detalle={`Al último precio: ${euros(r.calc.costeUltimo)}`} />
        <Cifra etiqueta={`Coste por ${unidad(r.unidad)}`} valor={euros(r.calc.costeUnidad, 4)} detalle={`Rinde ${numero(r.rendimiento)} ${unidad(r.unidad)} por tanda`} />
        <Cifra etiqueta="Vida útil" valor={`${numero(r.vidaUtilDias)} días`} detalle={r.conservacion ?? "Sin indicar conservación"} />
        <Cifra
          etiqueta="Alérgenos"
          valor={numero(r.calc.alergenosTotales.length)}
          detalle={r.calc.alergenosTotales.map(nombreAlergeno).join(", ") || "Ninguno"}
          tono={r.calc.alergenosTotales.length ? "aviso" : "ok"}
        />
      </Rejilla>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Tarjeta titulo="Ingredientes por tanda">
            <Tabla
              clave={(l) => l.id}
              filas={r.calc.lineas}
              vacio="Añade los ingredientes de la receta."
              columnas={[
                {
                  titulo: "Ingrediente",
                  celda: (l) => (
                    <span>
                      {l.producto} {l.elaborado && <Etiqueta tono="info">Elaborado</Etiqueta>}
                      {l.alergenos.length > 0 && <span className="block text-xs text-slate-500">{l.alergenos.map(nombreAlergeno).join(", ")}</span>}
                    </span>
                  ),
                },
                {
                  titulo: "Neta · merma %",
                  celda: (l) =>
                    puedeEditar ? (
                      <form action={actualizarLineaReceta} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <Entrada name="cantidad" defaultValue={numeroCampo(l.cantidad)} inputMode="decimal" className="w-24" aria-label="Cantidad neta" />
                        <Entrada name="mermaPct" defaultValue={numeroCampo(l.mermaPct)} inputMode="decimal" className="w-16" aria-label="Merma %" />
                        <Boton type="submit" variante="secundario">
                          Guardar
                        </Boton>
                      </form>
                    ) : (
                      `${numero(l.cantidad, 3)} ${unidad(l.unidad)} · ${numero(l.mermaPct, 1)} %`
                    ),
                },
                { titulo: "Bruta", alinear: "derecha", celda: (l) => `${numero(l.bruta, 3)} ${unidad(l.unidad)}` },
                { titulo: "Precio medio", alinear: "derecha", celda: (l) => (l.costeMedio > 0 ? euros(l.costeMedio, 4) : <Etiqueta tono="aviso">Sin coste</Etiqueta>) },
                { titulo: "Coste", alinear: "derecha", celda: (l) => euros(l.importeMedio) },
                {
                  titulo: "",
                  celda: (l) =>
                    puedeEditar && (
                      <form action={quitarLineaReceta}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <Boton type="submit" variante="secundario">
                          Quitar
                        </Boton>
                      </form>
                    ),
                },
              ]}
            />
            {puedeEditar && (
              <form action={anadirLineaReceta} className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-5">
                <input type="hidden" name="recetaId" value={r.id} />
                <input type="hidden" name="volver" value={volver} />
                <div className="md:col-span-2">
                  <Campo etiqueta="Ingrediente">
                    <Selector name="productoId" required defaultValue="">
                      <option value="" disabled>
                        Elige un producto…
                      </option>
                      {grupos.map((g) => (
                        <optgroup key={g} label={g}>
                          {catalogo
                            .filter((p) => p.grupo === g)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} ({unidad(p.unidad)} · {euros(p.coste)})
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </Selector>
                  </Campo>
                </div>
                <Campo etiqueta="Cantidad neta">
                  <Entrada name="cantidad" inputMode="decimal" required placeholder="1,5" />
                </Campo>
                <Campo etiqueta="Merma %">
                  <Entrada name="mermaPct" inputMode="decimal" defaultValue="0" />
                </Campo>
                <Boton type="submit">Añadir</Boton>
              </form>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Datos de la receta">
          <form action={actualizarReceta} className="space-y-3">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="volver" value={volver} />
            <Campo etiqueta="Nombre">
              <Entrada name="nombre" defaultValue={r.nombre} required disabled={!puedeEditar} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta={`Rendimiento (${unidad(r.unidad)})`}>
                <Entrada name="rendimiento" defaultValue={numeroCampo(r.rendimiento)} inputMode="decimal" required disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Vida útil (días)">
                <Entrada name="vidaUtilDias" defaultValue={numeroCampo(r.vidaUtilDias)} inputMode="numeric" required disabled={!puedeEditar} />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Conservación">
                <Entrada name="conservacion" defaultValue={r.conservacion ?? ""} disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Tiempo (min)">
                <Entrada name="tiempoMinutos" defaultValue={numeroCampo(r.tiempoMinutos)} inputMode="numeric" disabled={!puedeEditar} />
              </Campo>
            </div>
            <Campo etiqueta="Pasos">
              <AreaTexto name="pasos" rows={6} defaultValue={r.pasos ?? ""} disabled={!puedeEditar} />
            </Campo>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Alérgenos</legend>
              <p className="mb-2 text-xs text-slate-500">Los marcados en gris vienen de los ingredientes. Marca además los que añade la elaboración.</p>
              <div className="grid grid-cols-2 gap-1">
                {ALERGENOS.map((a) => {
                  const heredado = heredados.includes(a.clave);
                  return (
                    <label key={a.clave} className={`flex items-center gap-2 text-sm ${heredado ? "text-slate-400" : ""}`}>
                      <input
                        type="checkbox"
                        name="alergenosPropios"
                        value={a.clave}
                        defaultChecked={heredado || r.alergenosPropios.includes(a.clave)}
                        disabled={heredado || !puedeEditar}
                      />
                      {a.nombre}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {puedeEditar && <Boton type="submit">Guardar receta</Boton>}
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
