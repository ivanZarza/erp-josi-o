import { exigir } from "@/kernel/contexto";
import { euros, numero } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Entrada, Etiqueta, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { nombreAlergeno } from "@/modulos/comidas/carta-alergenos";
import { catalogoParaRecetas, listarRecetas, obradoresVisibles } from "@/modulos/obrador/servicio";
import { crearReceta } from "@/modulos/obrador/acciones";
import { AvisoError, param, SinObrador, unidad, type Busqueda } from "../_comun";

export default async function Recetas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("obrador", "obrador:recetas:ver");
  const sp = await searchParams;
  const verInactivas = param(sp, "inactivas") === "1";
  const puedeEditar = ctx.puede("obrador:recetas:editar");
  const obradores = obradoresVisibles(ctx);
  const [recetas, catalogo] = await Promise.all([listarRecetas(ctx, { incluirInactivas: verInactivas }), puedeEditar ? catalogoParaRecetas(ctx) : Promise.resolve([])]);
  const sinReceta = catalogo.filter((p) => p.grupo === "Comidas");

  return (
    <>
      <Cabecera
        titulo="Recetas de producción"
        subtitulo="Ingredientes con cantidad neta y merma, rendimiento por tanda, vida útil y alérgenos (heredados de los ingredientes)."
        acciones={
          <BotonEnlace href={verInactivas ? "/obrador/recetas" : "/obrador/recetas?inactivas=1"} variante="secundario">
            {verInactivas ? "Ocultar desactivadas" : "Ver desactivadas"}
          </BotonEnlace>
        }
      />
      <AvisoError error={param(sp, "error")} />
      <SinObrador ctx={ctx} />

      <TablaDesplegable
        columnas={[
          { titulo: "Receta" },
          { titulo: "Elaborado" },
          { titulo: "Rinde", alinear: "derecha" },
          { titulo: "Coste tanda", alinear: "derecha", secundaria: true },
          { titulo: "Coste unidad", alinear: "derecha" },
          { titulo: "Vida útil", alinear: "derecha", secundaria: true },
          { titulo: "Alérgenos" },
        ]}
        vacio="No hay recetas todavía. Crea la primera abajo."
        filas={recetas.map((r) => ({
          id: r.id,
          tono: r.calc.sinCoste.length > 0 ? ("aviso" as const) : undefined,
          celdas: [
            <span key="n">
              {r.nombre} {!r.activo && <Etiqueta>Desactivada</Etiqueta>}
            </span>,
            `${r.producto} · ${r.referencia}`,
            `${numero(r.rendimiento)} ${unidad(r.unidad)}`,
            euros(r.calc.costeMedio),
            euros(r.calc.costeUnidad, 4),
            `${numero(r.vidaUtilDias)} días`,
            r.calc.alergenosTotales.length ? r.calc.alergenosTotales.map(nombreAlergeno).join(", ") : <span className="text-slate-500">Ninguno</span>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Obrador", valor: r.obrador },
                  { etiqueta: "Conservación", valor: r.conservacion ?? "—" },
                  { etiqueta: "Tiempo", valor: r.tiempoMinutos ? `${numero(r.tiempoMinutos)} min` : "—" },
                  { etiqueta: "Precio medio actual", valor: euros(r.costeMedioActual, 4) },
                  { etiqueta: "Coste al último precio", valor: euros(r.calc.costeUltimo) },
                  { etiqueta: "Trazas", valor: r.calc.trazas.length ? r.calc.trazas.map(nombreAlergeno).join(", ") : "—" },
                  { etiqueta: "Ingredientes sin coste", valor: r.calc.sinCoste.length ? r.calc.sinCoste.join(", ") : "—" },
                ]}
              />
              <Tabla
                clave={(l) => l.id}
                filas={r.calc.lineas}
                vacio="La receta aún no tiene ingredientes."
                columnas={[
                  { titulo: "Ingrediente", celda: (l) => l.producto },
                  { titulo: "Neta", alinear: "derecha", celda: (l) => `${numero(l.cantidad, 3)} ${unidad(l.unidad)}` },
                  { titulo: "Merma", alinear: "derecha", celda: (l) => `${numero(l.mermaPct, 1)} %` },
                  { titulo: "Bruta", alinear: "derecha", celda: (l) => `${numero(l.bruta, 3)} ${unidad(l.unidad)}` },
                  { titulo: "Coste", alinear: "derecha", celda: (l) => euros(l.importeMedio) },
                ]}
              />
              {r.pasos && <p className="whitespace-pre-line text-sm text-slate-700">{r.pasos}</p>}
              <BotonEnlace href={`/obrador/recetas/${r.id}`}>{puedeEditar ? "Editar receta" : "Ver receta"}</BotonEnlace>
            </div>
          ),
        }))}
      />

      {puedeEditar && obradores.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Nueva receta">
            <form action={crearReceta} className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input type="hidden" name="volver" value="/obrador/recetas" />
              <Campo etiqueta="Obrador">
                <Selector name="centroId" defaultValue={obradores[0].id}>
                  {obradores.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre de la receta">
                <Entrada name="nombre" required placeholder="Empanada de carne cortada a cuchillo" />
              </Campo>
              <Campo etiqueta="Elaborado de salida (si ya existe)" ayuda="Si lo dejas vacío se crea un producto nuevo con el nombre de al lado">
                <Selector name="productoId" defaultValue="">
                  <option value="">— Crear un producto nuevo —</option>
                  {sinReceta.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.referencia})
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre del producto nuevo">
                <Entrada name="nombreProducto" placeholder="Empanada de carne (ud)" />
              </Campo>
              <Campo etiqueta="Unidad del elaborado">
                <Selector name="unidad" defaultValue="KG">
                  <option value="KG">Kilos</option>
                  <option value="L">Litros</option>
                  <option value="UD">Unidades</option>
                  <option value="RACION">Raciones</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Rendimiento por tanda">
                <Entrada name="rendimiento" inputMode="decimal" required placeholder="40" />
              </Campo>
              <Campo etiqueta="Vida útil (días)">
                <Entrada name="vidaUtilDias" inputMode="numeric" defaultValue="3" required />
              </Campo>
              <Campo etiqueta="Conservación">
                <Entrada name="conservacion" placeholder="Refrigerado de 0 a 4 °C" />
              </Campo>
              <div className="md:col-span-4">
                <Boton type="submit">Crear receta y añadir ingredientes</Boton>
              </div>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
