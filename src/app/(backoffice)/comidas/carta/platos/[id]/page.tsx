import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { AreaTexto, Aviso, Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, Rejilla, Selector, Tabla, Tarjeta } from "@/ui";
import { ALERGENOS, porcentajeCoste } from "@/modulos/comidas/carta-alergenos";
import { catalogoIngredientes, fichaPlato, marcasDeLaCadena } from "@/modulos/comidas/carta-servicio";
import {
  actualizarIngrediente,
  actualizarPlato,
  anadirIngrediente,
  cambiarActivoPlato,
  fijarAlergenosPlato,
  fijarPrecioCentro,
  heredarAlergenosPlato,
  quitarIngrediente,
} from "@/modulos/comidas/carta-acciones";
import { AvisoError, listaAlergenos, param, unidad, type Busqueda } from "../../_comun";

export default async function FichaPlato({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigir("comidas", "comidas:carta:ver");
  const { id } = await params;
  const sp = await searchParams;
  const ficha = await fichaPlato(ctx, id);
  if (!ficha) notFound();
  const { plato: p, porLocal } = ficha;
  const puedeEditar = ctx.puede("comidas:carta:editar");
  const [marcas, catalogo] = await Promise.all([marcasDeLaCadena(ctx), puedeEditar ? catalogoIngredientes(ctx) : Promise.resolve([])]);
  const grupos = Array.from(new Set(catalogo.map((c) => c.grupo)));
  const volver = `/comidas/carta/platos/${p.id}`;
  const precioBase = p.precio / (1 + p.iva / 100);

  return (
    <>
      <Cabecera
        titulo={p.nombre}
        subtitulo={`${p.marca}${p.nombreEn ? ` · ${p.nombreEn}` : ""}`}
        acciones={
          <>
            <BotonEnlace href="/comidas/carta" variante="secundario">
              Volver a la carta
            </BotonEnlace>
            {puedeEditar && (
              <form action={cambiarActivoPlato}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit" variante="secundario">
                  {p.activo ? "Retirar plato" : "Recuperar plato"}
                </Boton>
              </form>
            )}
          </>
        }
      />
      <AvisoError error={param(sp, "error")} />

      <Rejilla columnas={4}>
        <Cifra etiqueta="Precio (con IVA)" valor={euros(p.precio)} detalle={`Sin IVA: ${euros(precioBase)}`} />
        <Cifra etiqueta="Coste por ración" valor={euros(p.coste)} detalle={`Al último precio: ${euros(p.costeUltimo)}`} />
        <Cifra
          etiqueta="% de coste"
          valor={p.coste > 0 ? porcentaje(porcentajeCoste(p.coste, p.precio, p.iva)) : "—"}
          detalle={`Objetivo de ${p.marca}: ${porcentaje(p.objetivo)}`}
          tono={p.sobreObjetivo ? "error" : p.coste > 0 ? "ok" : "normal"}
        />
        <Cifra etiqueta="Margen bruto" valor={euros(precioBase - p.coste)} detalle="Precio sin IVA menos coste" />
      </Rejilla>
      {p.sobreObjetivo && (
        <div className="mt-4">
          <Aviso tono="error" titulo="Coste por encima del objetivo">
            El plato cuesta el {porcentaje(p.pctCoste)} del precio sin IVA y el objetivo de {p.marca} es el {porcentaje(p.objetivo)}. Revisa el escandallo o el precio.
          </Aviso>
        </div>
      )}
      {p.sinCoste.length > 0 && (
        <div className="mt-4">
          <Aviso tono="aviso">Ingredientes sin coste en el catálogo: {p.sinCoste.join(", ")}. El coste del plato sale más bajo de lo real.</Aviso>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Tarjeta titulo="Escandallo (por ración)">
            <Tabla
              clave={(l) => l.id}
              filas={p.ingredientes}
              vacio="Añade los ingredientes del plato."
              columnas={[
                {
                  titulo: "Ingrediente",
                  celda: (l) => (
                    <span>
                      {l.producto} {l.elaborado && <Etiqueta tono="info">Obrador</Etiqueta>}
                      {l.alergenos.length > 0 && <span className="block text-xs text-slate-500">{listaAlergenos(l.alergenos)}</span>}
                    </span>
                  ),
                },
                {
                  titulo: "Neta · merma %",
                  celda: (l) =>
                    puedeEditar ? (
                      <form action={actualizarIngrediente} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <Entrada name="cantidad" defaultValue={String(l.cantidad)} inputMode="decimal" className="w-24" aria-label="Cantidad neta" />
                        <Entrada name="mermaPct" defaultValue={String(l.mermaPct)} inputMode="decimal" className="w-16" aria-label="Merma %" />
                        <Boton type="submit" variante="secundario">
                          Guardar
                        </Boton>
                      </form>
                    ) : (
                      `${numero(l.cantidad, 3)} ${unidad(l.unidad)} · ${numero(l.mermaPct, 1)} %`
                    ),
                },
                { titulo: "Bruta", alinear: "derecha", celda: (l) => `${numero(l.bruta, 3)} ${unidad(l.unidad)}` },
                { titulo: "Precio medio", alinear: "derecha", celda: (l) => (l.costeMedio > 0 ? `${euros(l.costeMedio, 4)}/${unidad(l.unidad)}` : <Etiqueta tono="aviso">Sin coste</Etiqueta>) },
                { titulo: "Coste", alinear: "derecha", celda: (l) => euros(l.importeMedio) },
                { titulo: "% del plato", alinear: "derecha", celda: (l) => (p.coste > 0 ? porcentaje((l.importeMedio / p.coste) * 100) : "—") },
                {
                  titulo: "",
                  celda: (l) =>
                    puedeEditar && (
                      <form action={quitarIngrediente}>
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
              <form action={anadirIngrediente} className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-5">
                <input type="hidden" name="platoId" value={p.id} />
                <input type="hidden" name="volver" value={volver} />
                <div className="md:col-span-2">
                  <Campo etiqueta="Ingrediente (catálogo o elaborado del obrador)">
                    <Selector name="productoId" required defaultValue="">
                      <option value="" disabled>
                        Elige un producto…
                      </option>
                      {grupos.map((g) => (
                        <optgroup key={g} label={g}>
                          {catalogo
                            .filter((c) => c.grupo === g)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre} ({unidad(c.unidad)} · {euros(c.coste)})
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </Selector>
                  </Campo>
                </div>
                <Campo etiqueta="Cantidad neta">
                  <Entrada name="cantidad" inputMode="decimal" required placeholder="0,250" />
                </Campo>
                <Campo etiqueta="Merma %">
                  <Entrada name="mermaPct" inputMode="decimal" defaultValue="0" />
                </Campo>
                <Boton type="submit">Añadir</Boton>
              </form>
            )}
          </Tarjeta>

          <Tarjeta titulo="Precio por local">
            <Tabla
              clave={(l) => l.id}
              filas={porLocal}
              vacio="La marca no tiene locales abiertos."
              columnas={[
                { titulo: "Local", celda: (l) => l.nombre },
                { titulo: "Precio", alinear: "derecha", celda: (l) => (l.precioPropio != null ? <strong>{euros(l.precio)}</strong> : euros(l.precio)) },
                { titulo: "% coste", alinear: "derecha", celda: (l) => (p.coste > 0 ? porcentaje(l.pctCoste) : "—") },
                {
                  titulo: puedeEditar ? "Cambiar en este local" : "Se sirve",
                  celda: (l) =>
                    puedeEditar ? (
                      <form action={fijarPrecioCentro} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="platoId" value={p.id} />
                        <input type="hidden" name="centroId" value={l.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <Entrada name="precio" inputMode="decimal" defaultValue={l.precioPropio != null ? String(l.precioPropio) : ""} placeholder="El de la marca" className="w-32" aria-label="Precio propio" />
                        <label className="flex items-center gap-1 text-sm">
                          <input type="checkbox" name="disponible" defaultChecked={l.disponible} /> Se sirve
                        </label>
                        <Boton type="submit" variante="secundario">
                          Guardar
                        </Boton>
                      </form>
                    ) : l.disponible ? (
                      "Sí"
                    ) : (
                      "No"
                    ),
                },
              ]}
            />
          </Tarjeta>
        </div>

        <div className="space-y-6">
          <Tarjeta titulo="Alérgenos (14 obligatorios)">
            {p.faltanAlergenos.length > 0 && (
              <div className="mb-3">
                <Aviso tono="error">El escandallo lleva {listaAlergenos(p.faltanAlergenos)} y el plato no lo declara.</Aviso>
              </div>
            )}
            <form action={fijarAlergenosPlato} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="volver" value={volver} />
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left font-medium">Alérgeno</th>
                    <th className="font-medium">Contiene</th>
                    <th className="font-medium">Trazas</th>
                  </tr>
                </thead>
                <tbody>
                  {ALERGENOS.map((a) => (
                    <tr key={a.clave} className="border-t border-slate-100">
                      <td className="py-1">
                        {a.nombre} {p.alergenosHeredados.includes(a.clave) && <span className="text-xs text-slate-500">(escandallo)</span>}
                      </td>
                      <td className="text-center">
                        <input type="checkbox" name="alergenos" value={a.clave} defaultChecked={p.alergenos.includes(a.clave)} disabled={!puedeEditar} className="h-5 w-5" />
                      </td>
                      <td className="text-center">
                        <input type="checkbox" name="trazas" value={a.clave} defaultChecked={p.trazas.includes(a.clave)} disabled={!puedeEditar} className="h-5 w-5" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="revisados" defaultChecked={p.alergenosRevisados} disabled={!puedeEditar} /> Revisados por cocina
              </label>
              {puedeEditar && <Boton type="submit">Guardar alérgenos</Boton>}
            </form>
            {puedeEditar && (
              <form action={heredarAlergenosPlato} className="mt-3">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit" variante="secundario">
                  Copiar los del escandallo
                </Boton>
              </form>
            )}
          </Tarjeta>

          <Tarjeta titulo="Datos del plato">
            <form action={actualizarPlato} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Marca">
                <Selector name="marcaId" defaultValue={p.marcaId} disabled={!puedeEditar}>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre (español)">
                <Entrada name="nombre" defaultValue={p.nombre} required disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Nombre (inglés)">
                <Entrada name="nombreEn" defaultValue={p.nombreEn ?? ""} disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Descripción (español)">
                <AreaTexto name="descripcion" rows={2} defaultValue={p.descripcion ?? ""} disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Descripción (inglés)">
                <AreaTexto name="descripcionEn" rows={2} defaultValue={p.descripcionEn ?? ""} disabled={!puedeEditar} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Precio (con IVA)">
                  <Entrada name="precio" defaultValue={String(p.precio)} inputMode="decimal" required disabled={!puedeEditar} />
                </Campo>
                <Campo etiqueta="IVA %">
                  <Entrada name="iva" defaultValue={String(p.iva)} inputMode="decimal" required disabled={!puedeEditar} />
                </Campo>
              </div>
              <Campo etiqueta="Etiquetas" ayuda="Separadas por comas: sin gluten, vegetariano, picante…">
                <Entrada name="etiquetas" defaultValue={p.etiquetas.join(", ")} disabled={!puedeEditar} />
              </Campo>
              {puedeEditar && <Boton type="submit">Guardar datos</Boton>}
            </form>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
