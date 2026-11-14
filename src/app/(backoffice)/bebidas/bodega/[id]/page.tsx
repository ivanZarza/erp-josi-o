/** Bebidas · Ficha de vino de un producto: datos para la carta y los camareros, stock y dónde se vende. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { AreaTexto, Aviso, Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, Rejilla, Selector, Tabla, Tarjeta } from "@/ui";
import { AvisoError, param, type Busqueda } from "@/modulos/comidas/carta-pantallas/comun";
import { CRIANZAS, TIPOS_VINO } from "@/modulos/bebidas/fichas";
import { fichaVinoProducto } from "@/modulos/bebidas/servicio";
import { guardarFichaVino } from "@/modulos/bebidas/acciones";

export default async function FichaVino({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigir("bebidas", "bebidas:productos:ver");
  const { id } = await params;
  const sp = await searchParams;
  const datos = await fichaVinoProducto(ctx, id);
  if (!datos) notFound();
  const { producto: p, ficha: f } = datos;
  const puedeEditar = ctx.puede("bebidas:productos:editar");
  const volver = `/bebidas/bodega/${p.id}`;

  return (
    <>
      <Cabecera
        titulo={p.nombre}
        subtitulo={`${p.referencia} · ${p.familia}${p.proveedor ? ` · ${p.proveedor}` : ""}`}
        acciones={
          <BotonEnlace href="/bebidas/bodega" variante="secundario">
            Volver a la bodega
          </BotonEnlace>
        }
      />
      <AvisoError error={param(sp, "error")} />
      {param(sp, "guardado") && (
        <div className="mb-4">
          <Aviso tono="ok">Ficha de vino guardada.</Aviso>
        </div>
      )}

      <Rejilla columnas={4}>
        <Cifra etiqueta="Stock" valor={numero(datos.stock, datos.stock % 1 ? 2 : 0)} detalle={ctx.centroActivo ? ctx.centroActivo.nombre : "Todos tus centros"} />
        <Cifra etiqueta="Coste de la botella" valor={euros(p.coste)} detalle="Precio medio de compra" />
        <Cifra etiqueta="Precio en carta" valor={datos.precioBotella != null ? euros(datos.precioBotella) : "—"} detalle={datos.precioCopa != null ? `Copa: ${euros(datos.precioCopa)}` : "No se vende por copa"} />
        <Cifra
          etiqueta="% de coste"
          valor={datos.pctCoste != null ? porcentaje(datos.pctCoste) : "—"}
          detalle="Botella, sobre precio sin IVA"
          tono={datos.pctCoste == null ? "normal" : datos.pctCoste > 40 ? "error" : datos.pctCoste > 33 ? "aviso" : "ok"}
        />
      </Rejilla>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Tarjeta titulo={f ? "Ficha de vino" : "Ficha de vino (sin hacer)"}>
            <form action={guardarFichaVino} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input type="hidden" name="productoId" value={p.id} />
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Tipo">
                <Selector name="tipo" defaultValue={f?.tipo ?? ""} disabled={!puedeEditar}>
                  <option value="">Sin tipo</option>
                  {TIPOS_VINO.map((t) => (
                    <option key={t.clave} value={t.clave}>
                      {t.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="D.O. o región">
                <Entrada name="denominacion" defaultValue={f?.denominacion ?? ""} placeholder="Ribera del Duero" disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Bodega">
                <Entrada name="bodega" defaultValue={f?.bodega ?? ""} placeholder="Bodegas Emilio Moro" disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Uva">
                <Entrada name="uva" defaultValue={f?.uva ?? ""} placeholder="Tempranillo" disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Añada" ayuda="Vacío si no tiene o no se controla">
                <Entrada name="anada" defaultValue={f?.anada ? String(f.anada) : ""} inputMode="numeric" placeholder="2020" disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Capacidad (cl)" ayuda="75 normal, 150 mágnum, 37,5 media">
                <Entrada name="capacidadCl" defaultValue={f ? String(f.capacidadCl) : "75"} inputMode="decimal" disabled={!puedeEditar} />
              </Campo>
              <Campo etiqueta="Crianza">
                <Entrada name="crianza" list="crianzas" defaultValue={f?.crianza ?? ""} placeholder="Crianza" disabled={!puedeEditar} />
              </Campo>
              <datalist id="crianzas">
                {CRIANZAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <div className="md:col-span-2">
                <Campo etiqueta="Maridaje">
                  <Entrada name="maridaje" defaultValue={f?.maridaje ?? ""} placeholder="Carnes rojas a la parrilla" disabled={!puedeEditar} />
                </Campo>
              </div>
              <div className="md:col-span-3">
                <Campo etiqueta="Notas de cata" ayuda="Corta: para la carta y para los camareros">
                  <AreaTexto name="notasCata" rows={2} defaultValue={f?.notasCata ?? ""} disabled={!puedeEditar} />
                </Campo>
              </div>
              <div className="md:col-span-3">
                <Campo etiqueta="Argumento de venta" ayuda="Una frase para que el camarero lo recomiende">
                  <AreaTexto name="argumentoVenta" rows={2} defaultValue={f?.argumentoVenta ?? ""} disabled={!puedeEditar} />
                </Campo>
              </div>
              {puedeEditar && (
                <div>
                  <Boton type="submit">Guardar ficha</Boton>
                </div>
              )}
            </form>
          </Tarjeta>
        </div>
        <div className="space-y-6">
          <Tarjeta titulo="En la carta">
            <Tabla
              clave={(x) => `${x.platoId}-${x.formato}`}
              filas={datos.ventas}
              vacio="No se vende en ninguna carta que veas. Añádelo en Carta de bebidas."
              columnas={[
                {
                  titulo: "Bebida y formato",
                  celda: (x) => (
                    <span>
                      <Link className="hover:underline" href={`/bebidas/carta/platos/${x.platoId}`}>
                        {x.plato}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {x.formato}
                        {x.centilitros != null && ` · ${numero(x.centilitros, 1)} cl`}
                      </span>
                    </span>
                  ),
                },
                { titulo: "Precio", alinear: "derecha", celda: (x) => euros(x.precio) },
                { titulo: "% coste", alinear: "derecha", celda: (x) => (x.pctCoste != null ? <Etiqueta tono={x.pctCoste > 40 ? "error" : "ok"}>{porcentaje(x.pctCoste)}</Etiqueta> : "—") },
              ]}
            />
          </Tarjeta>
          <Tarjeta titulo="Stock por centro">
            <Tabla
              clave={(s) => s.centro}
              filas={datos.stockPorCentro}
              vacio="Sin stock en los centros que ves."
              columnas={[
                { titulo: "Centro", celda: (s) => s.centro },
                { titulo: "Botellas", alinear: "derecha", celda: (s) => numero(s.stock, s.stock % 1 ? 2 : 0) },
              ]}
            />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
