/**
 * Ficha de un plato o bebida de la carta: escandallo, formatos de venta (botella, copa, mágnum…),
 * precio por local, alérgenos y datos. La usan /comidas/carta/platos/[id] y /bebidas/carta/platos/[id].
 */
import { notFound, redirect } from "next/navigation";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { AreaTexto, Aviso, Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, Rejilla, Selector, Tabla, Tarjeta } from "@/ui";
import { ALERGENOS, porcentajeCoste } from "../carta-alergenos";
import { catalogoIngredientes, fichaPlato, marcasDeLaCadena, type AreaCarta } from "../carta-servicio";
import {
  actualizarFormato,
  actualizarIngrediente,
  actualizarPlato,
  anadirFormato,
  anadirIngrediente,
  cambiarActivoPlato,
  fijarAlergenosPlato,
  fijarPrecioCentro,
  formatoPrincipal,
  heredarAlergenosPlato,
  quitarFormato,
  quitarIngrediente,
} from "../carta-acciones";
import { AREA, AvisoError, exigirCarta, listaAlergenos, param, permisoEditar, unidad, type Busqueda } from "./comun";

const NOMBRES_FORMATO = ["Botella", "Copa", "Media botella", "Mágnum", "Caña", "Doble", "Jarra", "Chupito", "Ración", "Media ración"];

export async function PaginaFichaPlato({ area, params, searchParams }: { area: AreaCarta; params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigirCarta(area);
  const { id } = await params;
  const sp = await searchParams;
  const ficha = await fichaPlato(ctx, id);
  if (!ficha) notFound();
  const { plato: p, porLocal, capacidadCl, costeEscandallo } = ficha;
  // un plato de comida se abre desde Comidas y una bebida desde Bebidas
  if (p.area !== area) redirect(`${AREA[p.area].base}/platos/${p.id}`);
  const A = AREA[area];
  const puedeEditar = ctx.puede(permisoEditar(area));
  const [marcas, catalogo] = await Promise.all([marcasDeLaCadena(ctx), puedeEditar ? catalogoIngredientes(ctx, area) : Promise.resolve([])]);
  const grupos = Array.from(new Set(catalogo.map((c) => c.grupo)));
  const volver = `${A.base}/platos/${p.id}`;
  const precioBase = p.precio / (1 + p.iva / 100);
  const conFormatos = p.formatos.length > 0;

  return (
    <>
      <Cabecera
        titulo={p.nombre}
        subtitulo={`${p.marca}${p.local ? ` · solo en ${p.local}` : ""}${p.nombreEn ? ` · ${p.nombreEn}` : ""}`}
        acciones={
          <>
            <BotonEnlace href={A.base} variante="secundario">
              Volver a la carta
            </BotonEnlace>
            {puedeEditar && (
              <form action={cambiarActivoPlato}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit" variante="secundario">
                  {p.activo ? `Retirar ${A.plato}` : `Recuperar ${A.plato}`}
                </Boton>
              </form>
            )}
          </>
        }
      />
      <AvisoError error={param(sp, "error")} />

      <Rejilla columnas={4}>
        <Cifra etiqueta={conFormatos ? `Precio (${p.formatos[0].nombre.toLowerCase()})` : "Precio (con IVA)"} valor={euros(p.precio)} detalle={`Sin IVA: ${euros(precioBase)}`} />
        <Cifra etiqueta={conFormatos ? `Coste (${p.formatos[0].nombre.toLowerCase()})` : "Coste por ración"} valor={euros(p.coste)} detalle={`Al último precio: ${euros(p.costeUltimo)}`} />
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
          <Tarjeta titulo="Formatos de venta">
            <p className="mb-3 text-sm text-slate-600">
              {area === "BEBIDAS"
                ? "Un mismo vino o bebida se vende en varios formatos (botella, copa, mágnum…), cada uno con su precio y su parte del escandallo. "
                : "Si el plato se vende en varios tamaños (ración, media ración…), cada uno lleva su precio y su parte del escandallo. "}
              El precio del plato es el del primer formato.
              {capacidadCl != null && ` La botella del escandallo es de ${numero(capacidadCl, 1)} cl: los formatos se pueden dar en centilitros.`}
            </p>
            <Tabla
              clave={(f) => f.id}
              filas={p.formatos}
              vacio={`Sin formatos: se vende a ${euros(p.precio)} con el escandallo entero.`}
              columnas={[
                {
                  titulo: "Formato",
                  celda: (f) => (
                    <span>
                      {f.nombre} {f === p.formatos[0] && <Etiqueta tono="info">Principal</Etiqueta>}
                      <span className="block text-xs text-slate-500">
                        {f.productoId ? `${numero(f.cantidad, 3)} × ${f.producto}` : `${numero(f.cantidad, 4)} del escandallo`}
                        {f.centilitros != null && ` · ${numero(f.centilitros, 1)} cl`}
                      </span>
                    </span>
                  ),
                },
                {
                  titulo: puedeEditar ? "Precio · cantidad" : "Precio",
                  celda: (f) =>
                    puedeEditar ? (
                      <form action={actualizarFormato} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <Entrada name="precio" defaultValue={String(f.precio)} inputMode="decimal" className="w-24" aria-label="Precio con IVA" />
                        <Entrada name="cantidad" defaultValue={String(f.cantidad)} inputMode="decimal" className="w-20" aria-label="Cantidad" />
                        <Boton type="submit" variante="secundario">
                          Guardar
                        </Boton>
                      </form>
                    ) : (
                      euros(f.precio)
                    ),
                },
                { titulo: "Coste", alinear: "derecha", celda: (f) => euros(f.coste) },
                { titulo: "% coste", alinear: "derecha", celda: (f) => (f.coste > 0 ? <Etiqueta tono={f.sobreObjetivo ? "error" : "ok"}>{porcentaje(f.pctCoste)}</Etiqueta> : "—") },
                {
                  titulo: "",
                  celda: (f) =>
                    puedeEditar && (
                      <span className="flex gap-2">
                        {f !== p.formatos[0] && (
                          <form action={formatoPrincipal}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="volver" value={volver} />
                            <Boton type="submit" variante="secundario">
                              Poner primero
                            </Boton>
                          </form>
                        )}
                        <form action={quitarFormato}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="volver" value={volver} />
                          <Boton type="submit" variante="secundario">
                            Quitar
                          </Boton>
                        </form>
                      </span>
                    ),
                },
              ]}
            />
            {puedeEditar && (
              <form action={anadirFormato} className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-6">
                <input type="hidden" name="platoId" value={p.id} />
                <input type="hidden" name="volver" value={volver} />
                <Campo etiqueta="Formato">
                  <Entrada name="nombre" list="nombres-formato" required placeholder={area === "BEBIDAS" ? "Copa" : "Media ración"} />
                </Campo>
                <datalist id="nombres-formato">
                  {NOMBRES_FORMATO.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <Campo etiqueta="Precio (con IVA)">
                  <Entrada name="precio" inputMode="decimal" required placeholder="6,50" />
                </Campo>
                {capacidadCl != null && (
                  <Campo etiqueta="Centilitros" ayuda={`De una botella de ${numero(capacidadCl, 1)} cl`}>
                    <Entrada name="centilitros" inputMode="decimal" placeholder="15" />
                  </Campo>
                )}
                <Campo etiqueta={capacidadCl != null ? "o parte del escandallo" : "Parte del escandallo"} ayuda="1 = entero; 0,5 = la mitad">
                  <Entrada name="cantidad" inputMode="decimal" placeholder={capacidadCl != null ? "" : "1"} />
                </Campo>
                <div className={capacidadCl != null ? "" : "md:col-span-2"}>
                  <Campo etiqueta="Otro producto (opcional)" ayuda="Para el mágnum u otra botella: vende ese producto en vez del escandallo">
                    <Selector name="productoId" defaultValue="">
                      <option value="">El del escandallo</option>
                      {catalogo
                        .filter((c) => c.grupo === "Bebidas" || area === "COMIDAS")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                    </Selector>
                  </Campo>
                </div>
                <Boton type="submit">Añadir formato</Boton>
              </form>
            )}
          </Tarjeta>

          <Tarjeta titulo={conFormatos ? `Escandallo base (lo que vale «1» en los formatos: ${euros(costeEscandallo)})` : "Escandallo (por ración)"}>
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

          <Tarjeta titulo={conFormatos ? `Precio por local (${p.formatos[0].nombre.toLowerCase()})` : "Precio por local"}>
            <Tabla
              clave={(l) => l.id}
              filas={porLocal}
              vacio={p.local ? "El local del plato no está abierto." : "La marca no tiene locales abiertos."}
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
                <input type="checkbox" name="revisados" defaultChecked={p.alergenosRevisados} disabled={!puedeEditar} /> Revisados por {area === "BEBIDAS" ? "barra" : "cocina"}
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

          <Tarjeta titulo={area === "BEBIDAS" ? "Datos de la bebida" : "Datos del plato"}>
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
                {conFormatos ? (
                  <Campo etiqueta="Precio (con IVA)" ayuda="Se cambia en «Formatos de venta»">
                    <input type="hidden" name="precio" value={String(p.precio)} />
                    <Entrada value={euros(p.precio)} disabled readOnly />
                  </Campo>
                ) : (
                  <Campo etiqueta="Precio (con IVA)">
                    <Entrada name="precio" defaultValue={String(p.precio)} inputMode="decimal" required disabled={!puedeEditar} />
                  </Campo>
                )}
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
