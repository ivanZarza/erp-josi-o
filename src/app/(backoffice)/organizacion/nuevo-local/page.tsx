import { exigir } from "@/kernel/contexto";
import { fecha } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Entrada, Rejilla, Selector, Tarjeta } from "@/ui";
import { TablaDesplegable } from "@/ui/tabla-desplegable";
import { crearLocalAccion } from "@/modulos/organizacion/acciones";
import { pasosVisibles } from "@/modulos/organizacion/asistente";
import { leerPlantilla, listarCentros, listarEdificios, listarMarcas, listarSociedades, localesEnPreparacion } from "@/modulos/organizacion/servicio";
import { AvisosPagina, CamposDireccion, type ParametrosPagina } from "@/modulos/organizacion/vistas";

/** Asistente de apertura, pasos 1 y 2: marca, sociedad, origen y datos. Al guardar, el local queda «en preparación». */
export default async function NuevoLocalPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:centros:abrir");
  const sp = await searchParams;
  const [marcas, sociedades, centros, edificios, enPreparacion] = await Promise.all([
    listarMarcas(ctx),
    listarSociedades(ctx),
    listarCentros(ctx),
    listarEdificios(ctx),
    localesEnPreparacion(ctx),
  ]);
  const pasos = pasosVisibles(ctx.contratados);
  const modelos = marcas.filter((m) => m.activo).map((m) => ({ m, p: leerPlantilla(m.plantilla) }));

  return (
    <>
      <Cabecera titulo="Abrir un local nuevo" subtitulo={`Asistente de ${pasos.length} pasos. Se puede dejar a medias: el local queda «en preparación» y no sale en pedidos ni webs hasta que se abre.`} />
      <AvisosPagina sp={sp} />

      {enPreparacion.length > 0 && (
        <div className="mb-6">
          <TablaDesplegable
            columnas={[{ titulo: "Local en preparación" }, { titulo: "Marca" }, { titulo: "Creado" }, { titulo: "" }]}
            total={`${enPreparacion.length} locales a medio preparar`}
            filas={enPreparacion.map((c) => ({
              id: c.id,
              celdas: [
                `${c.nombre} (${c.codigo})`,
                c.marca?.nombre ?? "—",
                fecha(c.createdAt),
                <BotonEnlace key="s" href={`/organizacion/nuevo-local/${c.id}`} variante="secundario">
                  Seguir
                </BotonEnlace>,
              ],
            }))}
          />
        </div>
      )}

      <form action={crearLocalAccion} className="space-y-4">
        <Tarjeta titulo="Paso 1 · Marca y sociedad">
          <Rejilla columnas={2}>
            <div className="space-y-3">
              <Campo etiqueta="Marca">
                <Selector name="marcaId" defaultValue="">
                  <option value="">Marca nueva (escríbela abajo)</option>
                  {marcas
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre de la marca nueva" ayuda="Solo si no está en la lista. Después podrás completar colores, web y plantilla.">
                <Entrada name="marcaNueva" />
              </Campo>
            </div>
            <div className="space-y-3">
              <Campo etiqueta="Sociedad">
                <Selector name="sociedadId" defaultValue="">
                  <option value="">Sociedad nueva (escríbela abajo) o sin sociedad todavía</option>
                  {sociedades
                    .filter((s) => s.activo)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.razonSocial} ({s.cif})
                      </option>
                    ))}
                </Selector>
              </Campo>
              <Rejilla columnas={2}>
                <Campo etiqueta="Razón social nueva">
                  <Entrada name="sociedadRazon" />
                </Campo>
                <Campo etiqueta="CIF" ayuda="Si aún no lo sabes, escribe PENDIENTE">
                  <Entrada name="sociedadCif" />
                </Campo>
              </Rejilla>
            </div>
          </Rejilla>
          <div className="mt-4 space-y-3">
            <Campo etiqueta="¿De dónde parte?" ayuda="Se copia al local (no queda enlazado): áreas activas, horario y ajustes de productos (qué puede pedir y con qué mínimos)">
              <Selector name="origen" defaultValue="plantilla">
                <option value="plantilla">Plantilla de su marca</option>
                <option value="copiar">Copiar de otro local</option>
                <option value="vacio">Empezar en blanco</option>
              </Selector>
            </Campo>
            <Campo etiqueta="Local del que copiar" ayuda="Solo si eliges «Copiar de otro local»">
              <Selector name="centroOrigenId" defaultValue="">
                <option value="">—</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.codigo})
                  </option>
                ))}
              </Selector>
            </Campo>
            {modelos.length > 0 && (
              <p className="text-xs text-suave">
                Plantillas de marca:{" "}
                {modelos
                  .map(({ m, p }) => `${m.nombre}: ${p.centroModeloId ? `copia ${centros.find((c) => c.id === p.centroModeloId)?.nombre ?? "su local modelo"}` : "sin local modelo"}${p.areas.length ? `, ${p.areas.length} áreas` : ""}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Paso 2 · Datos del local">
          <div className="space-y-4">
            <Rejilla columnas={4}>
              <Campo etiqueta="Código" ayuda="Corto y único (VA-VAL)">
                <Entrada name="codigo" required maxLength={12} />
              </Campo>
              <Campo etiqueta="Nombre comercial">
                <Entrada name="nombre" required placeholder="Vaca Valencia" />
              </Campo>
              <Campo etiqueta="Tipo">
                <Selector name="tipo" defaultValue="LOCAL">
                  <option value="LOCAL">Local</option>
                  <option value="OBRADOR">Obrador</option>
                  <option value="ALMACEN">Almacén</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Apertura prevista">
                <Entrada name="aperturaEn" type="date" />
              </Campo>
              <Campo etiqueta="Teléfono" ayuda="Con prefijo: +34 …">
                <Entrada name="telefono" type="tel" />
              </Campo>
              <Campo etiqueta="Correo del local">
                <Entrada name="email" type="email" />
              </Campo>
            </Rejilla>
            <CamposDireccion v={null} edificios={edificios.map((e) => ({ id: e.id, nombre: `${e.direccion}, ${e.ciudad}${e.centros.length ? ` (${e.centros.map((c) => c.codigo).join(", ")})` : ""}` }))} />
          </div>
        </Tarjeta>

        <div className="flex flex-wrap items-center gap-3">
          <Boton type="submit">Crear en preparación y seguir</Boton>
          <span className="text-sm text-suave">Siguientes pasos: {pasos.slice(1).map((p) => p.titulo).join(" · ")}</span>
        </div>
      </form>
    </>
  );
}
