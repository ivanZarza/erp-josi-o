import { exigir } from "@/kernel/contexto";
import { Boton, BotonEnlace, Cabecera, Campo, Entrada, Etiqueta, Rejilla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { activarMarcaAccion, guardarMarcaAccion } from "@/modulos/organizacion/acciones";
import { leerPlantilla, listarMarcas } from "@/modulos/organizacion/servicio";
import { AvisosPagina, Muestra, type ParametrosPagina } from "@/modulos/organizacion/vistas";

export default async function MarcasPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:ver");
  const sp = await searchParams;
  const marcas = await listarMarcas(ctx);
  const editar = ctx.puede("organizacion:marcas:editar");

  return (
    <>
      <Cabecera titulo="Marcas" subtitulo="Identidad de cada marca y su plantilla para abrir locales nuevos." />
      <AvisosPagina sp={sp} />
      <TablaDesplegable
        columnas={[{ titulo: "Marca" }, { titulo: "Lema", secundaria: true }, { titulo: "Web", secundaria: true }, { titulo: "Locales", alinear: "derecha" }, { titulo: "Estado" }]}
        vacio="Todavía no hay marcas. Crea la primera abajo."
        total={`${marcas.length} marcas`}
        filas={marcas.map((m) => {
          const p = leerPlantilla(m.plantilla);
          const abiertos = m.centros.filter((c) => c.estado !== "CERRADO").length;
          return {
            id: m.id,
            celdas: [
              <span key="n" className="inline-flex items-center gap-2 font-medium">
                <span className="inline-block h-3 w-3 rounded-full border border-borde" style={{ background: m.colorPrincipal ?? "transparent" }} />
                {m.nombre}
              </span>,
              m.lema ?? m.concepto ?? "—",
              m.web ?? "—",
              abiertos,
              m.activo ? <Etiqueta key="e" tono="ok">Activa</Etiqueta> : <Etiqueta key="e">Desactivada</Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Concepto", valor: m.concepto ?? "—" },
                    { etiqueta: "Instagram", valor: m.instagram ?? "—" },
                    { etiqueta: "Color principal", valor: <Muestra color={m.colorPrincipal} /> },
                    { etiqueta: "Color de fondo", valor: <Muestra color={m.colorFondo} /> },
                    { etiqueta: "Plantilla", valor: p.centroModeloId || p.areas.length ? `${p.centroModeloId ? "Con local modelo" : "Sin local modelo"} · ${p.areas.length} áreas` : "Sin plantilla" },
                    { etiqueta: "Centros", valor: m.centros.map((c) => c.codigo).join(", ") || "—" },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  <BotonEnlace href={`/organizacion/marcas/${m.id}`}>Ver y editar</BotonEnlace>
                  {editar && (
                    <form action={activarMarcaAccion}>
                      <input type="hidden" name="marcaId" value={m.id} />
                      {!m.activo && <input type="hidden" name="activo" value="on" />}
                      <Boton type="submit" variante="secundario">
                        {m.activo ? "Desactivar" : "Activar"}
                      </Boton>
                    </form>
                  )}
                </div>
              </div>
            ),
          };
        })}
      />

      {editar && (
        <div className="mt-6">
          <Tarjeta titulo="Nueva marca">
            <form action={guardarMarcaAccion} className="space-y-4">
              <Rejilla columnas={4}>
                <Campo etiqueta="Nombre">
                  <Entrada name="nombre" required />
                </Campo>
                <Campo etiqueta="Lema">
                  <Entrada name="lema" />
                </Campo>
                <Campo etiqueta="Web">
                  <Entrada name="web" placeholder="marca.com" />
                </Campo>
                <Campo etiqueta="Instagram">
                  <Entrada name="instagram" placeholder="@marca" />
                </Campo>
              </Rejilla>
              <Boton type="submit">Crear marca</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
