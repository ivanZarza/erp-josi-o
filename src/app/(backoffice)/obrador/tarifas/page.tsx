import { exigir } from "@/kernel/contexto";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { Aviso, Boton, Cabecera, Campo, Entrada, Etiqueta, Pestanas, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { catalogoParaRecetas, listarTarifas, localesDestino, obradoresVisibles } from "@/modulos/obrador/servicio";
import { aplicarTarifa, recalcularTarifas } from "@/modulos/obrador/acciones";
import { AvisoError, param, SinObrador, unidad, type Busqueda } from "../_comun";

const MODOS: Record<string, string> = { COSTE: "A coste", COSTE_MAS_PORCENTAJE: "Coste + %", PRECIO_FIJO: "Precio fijo" };

function CamposTarifa({ marcas, locales }: { marcas: { id: string; nombre: string }[]; locales: { id: string; nombre: string }[] }) {
  return (
    <>
      <Campo etiqueta="Aplicar a">
        <Selector name="ambito" defaultValue="TODOS">
          <option value="TODOS">Todos los locales</option>
          <optgroup label="Locales de una marca">
            {marcas.map((m) => (
              <option key={m.id} value={`MARCA:${m.id}`}>
                {m.nombre}
              </option>
            ))}
          </optgroup>
          <optgroup label="Un local">
            {locales.map((l) => (
              <option key={l.id} value={`CENTRO:${l.id}`}>
                {l.nombre}
              </option>
            ))}
          </optgroup>
        </Selector>
      </Campo>
      <Campo etiqueta="Modo">
        <Selector name="modo" defaultValue="COSTE_MAS_PORCENTAJE">
          <option value="COSTE">A coste</option>
          <option value="COSTE_MAS_PORCENTAJE">Coste + %</option>
          <option value="PRECIO_FIJO">Precio fijo</option>
        </Selector>
      </Campo>
      <Campo etiqueta="% o precio (€)" ayuda="% de margen sobre coste, o precio fijo por unidad">
        <Entrada name="valor" inputMode="decimal" placeholder="15" />
      </Campo>
    </>
  );
}

export default async function Tarifas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("obrador", "obrador:tarifas:ver");
  const sp = await searchParams;
  const obradores = obradoresVisibles(ctx);
  const obrador = obradores.find((o) => o.id === param(sp, "obrador")) ?? obradores[0];
  const puedeEditar = ctx.puede("obrador:tarifas:editar");

  if (!obrador)
    return (
      <>
        <Cabecera titulo="Tarifas a locales" />
        <SinObrador ctx={ctx} />
      </>
    );

  const [articulos, locales, catalogo] = await Promise.all([listarTarifas(ctx, obrador.id), localesDestino(ctx), puedeEditar ? catalogoParaRecetas(ctx) : Promise.resolve([])]);
  const marcas = Array.from(new Map(locales.filter((l) => l.marca).map((l) => [l.marca!.id, l.marca!])).values());
  const listaLocales = locales.map((l) => ({ id: l.id, nombre: l.nombre }));
  const volver = `/obrador/tarifas`;
  const enCatalogo = new Set(articulos.map((a) => a.productoId));
  const reventa = catalogo.filter((p) => !enCatalogo.has(p.id));

  return (
    <>
      <Cabecera
        titulo="Tarifas a locales"
        subtitulo="Precio al que el obrador vende cada artículo a cada local: es el precio de las líneas del pedido interno (lo que vale el pedido). El stock que entra en el local se valora al coste medio del producto (uno solo en toda la cadena), no a esta tarifa."
        acciones={
          puedeEditar && (
            <form action={recalcularTarifas}>
              <input type="hidden" name="obradorId" value={obrador.id} />
              <input type="hidden" name="volver" value={volver} />
              <Boton type="submit" variante="secundario">
                Recalcular con el coste actual
              </Boton>
            </form>
          )
        }
      />
      <AvisoError error={param(sp, "error")} />
      {obradores.length > 1 && (
        <Pestanas activa={`/obrador/tarifas?obrador=${obrador.id}`} items={obradores.map((o) => ({ href: `/obrador/tarifas?obrador=${o.id}`, titulo: o.nombre }))} />
      )}
      <div className="mb-4">
        <Aviso>
          «A coste» y «Coste + %» se recalculan solos al cerrar cada producción (el coste es el precio medio del elaborado) y con «Recalcular con el coste actual». «Precio fijo»
          no cambia hasta que lo edites. Este precio es el mismo dato que «Tarifa al centro» de Stock → Productos: si alguien lo cambia allí a mano, al recalcular se respeta y la
          tarifa de ese local pasa a «Precio fijo». Los cambios no avisan todavía a los locales ni tienen fecha de entrada en vigor, y aún no se hace la factura entre sociedades
          al servir (pendiente).
        </Aviso>
      </div>

      <TablaDesplegable
        columnas={[
          { titulo: "Artículo" },
          { titulo: "Tipo", secundaria: true },
          { titulo: "Coste", alinear: "derecha" },
          { titulo: "Modo" },
          { titulo: "Locales con precio", alinear: "derecha" },
          { titulo: "Precio", alinear: "derecha" },
        ]}
        vacio="El obrador aún no tiene artículos en venta. Crea recetas o añade un artículo de reventa abajo."
        filas={articulos.map((a) => ({
          id: a.productoId,
          tono: a.locales < locales.length ? ("aviso" as const) : undefined,
          celdas: [
            `${a.nombre} · ${a.referencia}`,
            <Etiqueta key="t" tono={a.tipo === "Elaborado" ? "info" : "normal"}>
              {a.tipo}
            </Etiqueta>,
            `${euros(a.coste, 4)}/${unidad(a.unidad)}`,
            a.modos.length ? a.modos.map((m) => MODOS[m!]).join(", ") : <span className="text-slate-500">Sin tarifa</span>,
            `${numero(a.locales)} de ${numero(locales.length)}`,
            a.minimo == null ? "—" : a.minimo === a.maximo ? euros(a.minimo, 4) : `${euros(a.minimo, 4)} – ${euros(a.maximo, 4)}`,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Familia", valor: a.familia },
                  { etiqueta: "Unidad", valor: unidad(a.unidad) },
                  { etiqueta: "Coste medio", valor: euros(a.coste, 4) },
                  { etiqueta: "Locales sin precio", valor: numero(locales.length - a.locales) },
                ]}
              />
              {puedeEditar && (
                <form action={aplicarTarifa} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
                  <input type="hidden" name="obradorId" value={obrador.id} />
                  <input type="hidden" name="productoId" value={a.productoId} />
                  <input type="hidden" name="volver" value={volver} />
                  <CamposTarifa marcas={marcas} locales={listaLocales} />
                  <Boton type="submit">Aplicar tarifa</Boton>
                </form>
              )}
              <Tabla
                clave={(f) => f.centroId}
                filas={a.filas}
                columnas={[
                  { titulo: "Local", celda: (f) => f.local },
                  { titulo: "Marca", celda: (f) => f.marca },
                  { titulo: "Modo", celda: (f) => (f.modo ? `${MODOS[f.modo]}${f.modo === "COSTE_MAS_PORCENTAJE" ? ` (${porcentaje(f.porcentaje)})` : ""}` : "—") },
                  {
                    titulo: "Precio",
                    alinear: "derecha",
                    celda: (f) =>
                      f.precio != null ? (
                        <span>
                          {euros(f.precio, 4)} {f.cambiadoAMano && <Etiqueta tono="aviso">Cambiado a mano</Etiqueta>}
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                  { titulo: "Margen", alinear: "derecha", celda: (f) => (f.margenPct != null ? porcentaje(f.margenPct) : "—") },
                ]}
              />
            </div>
          ),
        }))}
      />

      {puedeEditar && (
        <div className="mt-6">
          <Tarjeta titulo="Añadir un artículo de reventa (vino, seco…)">
            <form action={aplicarTarifa} className="grid grid-cols-1 items-end gap-3 md:grid-cols-5">
              <input type="hidden" name="obradorId" value={obrador.id} />
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Artículo">
                <Selector name="productoId" required defaultValue="">
                  <option value="" disabled>
                    Elige un producto…
                  </option>
                  {Array.from(new Set(reventa.map((p) => p.grupo))).map((g) => (
                    <optgroup key={g} label={g}>
                      {reventa
                        .filter((p) => p.grupo === g)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} ({euros(p.coste)})
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Selector>
              </Campo>
              <CamposTarifa marcas={marcas} locales={listaLocales} />
              <Boton type="submit">Añadir con esta tarifa</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
