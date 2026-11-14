import { exigir } from "@/kernel/contexto";
import { numero } from "@/kernel/formato";
import { Boton, Cabecera, Campo, Entrada, Etiqueta, Selector, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarPlantillas } from "@/modulos/calidad/servicio";
import { anadirPunto, cambiarActivoPlantilla, cambiarActivoPunto, crearPlantilla } from "@/modulos/calidad/acciones";
import { Mensajes, TIPOS_LISTA, type Busqueda } from "../_comun";

export default async function Plantillas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("calidad", "calidad:editar");
  const sp = await searchParams;
  const plantillas = await listarPlantillas(ctx);
  const volver = "/calidad/plantillas";

  return (
    <>
      <Cabecera titulo="Plantillas APPCC" subtitulo="Listas de comprobación de apertura, cierre, limpieza y recepción. Pueden valer para todos los centros o para uno." />
      <Mensajes sp={sp} />
      <TablaDesplegable
        columnas={[{ titulo: "Lista" }, { titulo: "Tipo" }, { titulo: "Centro" }, { titulo: "Puntos", alinear: "derecha" }, { titulo: "Veces hecha", alinear: "derecha", secundaria: true }, { titulo: "Estado" }]}
        vacio="No hay plantillas. Crea la primera abajo."
        filas={plantillas.map((p) => ({
          id: p.id,
          celdas: [
            p.nombre,
            TIPOS_LISTA[p.tipo],
            p.centro,
            numero(p.puntos.filter((x) => x.activo).length),
            numero(p._count.ejecuciones),
            p.activo ? <Etiqueta tono="ok">Activa</Etiqueta> : <Etiqueta>Desactivada</Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle datos={[{ etiqueta: "Tipo", valor: TIPOS_LISTA[p.tipo] }, { etiqueta: "Centro", valor: p.centro }]} />
              <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {p.puntos.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className={x.activo ? "" : "text-slate-400 line-through"}>
                      {x.texto} {x.pideValor && <Etiqueta tono="info">Pide dato</Etiqueta>}
                    </span>
                    <form action={cambiarActivoPunto}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="activo" value={x.activo ? "false" : "true"} />
                      <input type="hidden" name="volver" value={volver} />
                      <Boton type="submit" variante="secundario">
                        {x.activo ? "Quitar" : "Recuperar"}
                      </Boton>
                    </form>
                  </li>
                ))}
              </ol>
              <form action={anadirPunto} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="plantillaId" value={p.id} />
                <input type="hidden" name="volver" value={volver} />
                <div className="min-w-64 flex-1">
                  <Campo etiqueta="Nuevo punto">
                    <Entrada name="texto" required placeholder="Superficies de trabajo limpias y desinfectadas" />
                  </Campo>
                </div>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" name="pideValor" /> Pide un dato
                </label>
                <Boton type="submit">Añadir punto</Boton>
              </form>
              <form action={cambiarActivoPlantilla}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit" variante="secundario">
                  {p.activo ? "Desactivar lista" : "Activar lista"}
                </Boton>
              </form>
            </div>
          ),
        }))}
      />
      <div className="mt-6">
        <Tarjeta titulo="Nueva lista">
          <form action={crearPlantilla} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <input type="hidden" name="volver" value={volver} />
            <Campo etiqueta="Nombre">
              <Entrada name="nombre" required placeholder="Apertura de cocina" />
            </Campo>
            <Campo etiqueta="Tipo">
              <Selector name="tipo" defaultValue="APERTURA">
                {Object.entries(TIPOS_LISTA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Centro">
              <Selector name="centroId" defaultValue="">
                <option value="">Todos los centros</option>
                {ctx.centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Boton type="submit">Crear lista</Boton>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
