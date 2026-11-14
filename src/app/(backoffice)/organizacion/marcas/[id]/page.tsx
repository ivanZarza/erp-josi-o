import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { moduloPorId } from "@/kernel/registro";
import { AreaTexto, Boton, BotonEnlace, Cabecera, Campo, Entrada, Rejilla, Selector, Tarjeta } from "@/ui";
import { DatosDetalle } from "@/ui/tabla-desplegable";
import { guardarMarcaAccion, guardarPlantillaAccion } from "@/modulos/organizacion/acciones";
import { leerPlantilla, listarCentros, obtenerMarca } from "@/modulos/organizacion/servicio";
import { AvisosPagina, CamposDias, Casilla, EtiquetaEstado, Muestra, textoHorario, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { MODULOS } from "@/kernel/registro";

export default async function MarcaPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:ver");
  const { id } = await params;
  const sp = await searchParams;
  const marca = await obtenerMarca(ctx, id).catch(() => null);
  if (!marca) notFound();
  const plantilla = leerPlantilla(marca.plantilla);
  const centros = await listarCentros(ctx);
  const areas = MODULOS.filter((m) => !m.nucleo && ctx.tieneModulo(m.id) && (!m.tiposCentro || m.tiposCentro.includes("LOCAL")));
  const editar = ctx.puede("organizacion:marcas:editar");
  const editarPlantilla = ctx.puede("organizacion:plantillas:editar");

  return (
    <>
      <Cabecera
        titulo={marca.nombre}
        subtitulo={marca.concepto ?? "Marca"}
        acciones={
          <BotonEnlace href="/organizacion/marcas" variante="secundario">
            Volver a marcas
          </BotonEnlace>
        }
      />
      <AvisosPagina sp={sp} />
      <div className="space-y-4">
        <Tarjeta titulo="Identidad">
          {editar ? (
            <form action={guardarMarcaAccion} className="space-y-4">
              <input type="hidden" name="marcaId" value={marca.id} />
              <Rejilla columnas={4}>
                <Campo etiqueta="Nombre">
                  <Entrada name="nombre" required defaultValue={marca.nombre} />
                </Campo>
                <Campo etiqueta="Lema">
                  <Entrada name="lema" defaultValue={marca.lema ?? ""} />
                </Campo>
                <Campo etiqueta="Web">
                  <Entrada name="web" defaultValue={marca.web ?? ""} placeholder="marca.com" />
                </Campo>
                <Campo etiqueta="Instagram">
                  <Entrada name="instagram" defaultValue={marca.instagram ?? ""} placeholder="@marca" />
                </Campo>
                <Campo etiqueta="Color principal" ayuda="#RRGGBB">
                  <Entrada name="colorPrincipal" defaultValue={marca.colorPrincipal ?? ""} placeholder="#7a1f2b" />
                </Campo>
                <Campo etiqueta="Color de fondo" ayuda="#RRGGBB">
                  <Entrada name="colorFondo" defaultValue={marca.colorFondo ?? ""} placeholder="#ffffff" />
                </Campo>
              </Rejilla>
              <Campo etiqueta="Concepto">
                <AreaTexto name="concepto" rows={2} defaultValue={marca.concepto ?? ""} />
              </Campo>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span>Vista: </span>
                <Muestra color={marca.colorPrincipal} />
                <Muestra color={marca.colorFondo} />
              </div>
              <Boton type="submit">Guardar marca</Boton>
            </form>
          ) : (
            <DatosDetalle
              datos={[
                { etiqueta: "Lema", valor: marca.lema ?? "—" },
                { etiqueta: "Web", valor: marca.web ?? "—" },
                { etiqueta: "Instagram", valor: marca.instagram ?? "—" },
                { etiqueta: "Colores", valor: <span className="flex gap-3"><Muestra color={marca.colorPrincipal} /><Muestra color={marca.colorFondo} /></span> },
              ]}
            />
          )}
        </Tarjeta>

        <Tarjeta titulo="Plantilla de marca">
          <p className="mb-4 text-sm text-suave">
            Lo que hereda un local nuevo de esta marca al abrirlo con el asistente. Se copia al local (no queda enlazado). Carta, organigrama, cuadrante, APPCC, plano de reservas y web tipo los
            aportará cada módulo cuando esté hecho.
          </p>
          {editarPlantilla ? (
            <form action={guardarPlantillaAccion} className="space-y-4">
              <input type="hidden" name="marcaId" value={marca.id} />
              <Rejilla columnas={2}>
                <Campo etiqueta="Local modelo" ayuda="De él se copian los productos que puede pedir, con mínimos y máximos">
                  <Selector name="centroModeloId" defaultValue={plantilla.centroModeloId ?? ""}>
                    <option value="">Sin local modelo</option>
                    {centros
                      .filter((c) => c.tipo === "LOCAL")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({c.codigo})
                        </option>
                      ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Hora de corte tipo">
                  <Entrada name="horaCorte" type="time" defaultValue={plantilla.horaCorte ?? ""} />
                </Campo>
              </Rejilla>
              <div>
                <div className="mb-1 text-sm font-medium">Áreas activas en un local de la marca</div>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
                  {areas.map((m) => (
                    <Casilla key={m.id} nombre="areas" valor={m.id} marcada={plantilla.areas.length ? plantilla.areas.includes(m.id) : true}>
                      {m.nombre}
                    </Casilla>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">Horario tipo</div>
                <CamposDias horario={plantilla.horario} />
              </div>
              <Campo etiqueta="Notas para quien abra un local">
                <AreaTexto name="notas" rows={3} defaultValue={plantilla.notas ?? ""} />
              </Campo>
              <Boton type="submit">Guardar plantilla</Boton>
            </form>
          ) : (
            <DatosDetalle
              columnas={3}
              datos={[
                { etiqueta: "Local modelo", valor: centros.find((c) => c.id === plantilla.centroModeloId)?.nombre ?? "—" },
                { etiqueta: "Áreas", valor: plantilla.areas.map((a) => moduloPorId(a)?.nombre ?? a).join(", ") || "Todas las contratadas" },
                { etiqueta: "Horario tipo", valor: textoHorario(plantilla.horario) },
              ]}
            />
          )}
        </Tarjeta>

        <Tarjeta titulo={`Centros de la marca (${marca.centros.length})`}>
          {marca.centros.length ? (
            <ul className="divide-y divide-slate-100">
              {marca.centros.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/organizacion/centros/${c.id}`} className="text-acento hover:underline">
                    {c.nombre} ({c.codigo})
                  </Link>
                  <EtiquetaEstado estado={c.estado} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Esta marca aún no tiene locales.</p>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
