import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, Boton, Etiqueta, Vacio } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { diccionarios, NOMBRE_GRUPO } from "@/modulos/contabilidad/servicio";
import { accionCrearCategoriasBasicas, accionCrearCategoria, accionAlternarCategoria } from "@/modulos/contabilidad/acciones";
import { Avisos, type ParametrosBusqueda } from "../_comun";

export default async function Categorias({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:ver");
  const sp = await searchParams;
  const d = await diccionarios(ctx);
  const categorias = Array.from(d.categorias.values());
  const puedeEditar = ctx.puede("contabilidad:gastos:editar");

  return (
    <>
      <Cabecera titulo="Categorías contables" subtitulo="Plan de cuentas sencillo. El grupo decide dónde suma en el Cuadro de mando; la cuenta de la gestoría sale en la exportación." />
      <Avisos sp={sp} />
      {categorias.length === 0 && (
        <div className="mb-4">
          <Vacio>
            <p className="mb-3">Todavía no hay categorías.</p>
            {puedeEditar && (
              <form action={accionCrearCategoriasBasicas}>
                <Boton type="submit">Crear las categorías básicas de hostelería</Boton>
              </form>
            )}
          </Vacio>
        </div>
      )}
      {puedeEditar && (
        <Tarjeta titulo="Nueva categoría" className="mb-4">
          <form action={accionCrearCategoria} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Campo etiqueta="Código">
              <Entrada name="codigo" required placeholder="MUSICA" />
            </Campo>
            <Campo etiqueta="Nombre">
              <Entrada name="nombre" required placeholder="Música y licencias" />
            </Campo>
            <Campo etiqueta="Grupo">
              <Selector name="grupo" defaultValue="GASTO_VARIABLE">
                {Object.entries(NOMBRE_GRUPO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Cuenta en la gestoría" ayuda="Opcional (P-04)">
              <Entrada name="cuentaGestoria" placeholder="629" />
            </Campo>
            <div className="self-end">
              <Boton type="submit">Añadir</Boton>
            </div>
          </form>
        </Tarjeta>
      )}
      <TablaDesplegable
        columnas={[{ titulo: "Código" }, { titulo: "Nombre" }, { titulo: "Grupo" }, { titulo: "Cuenta gestoría", secundaria: true }, { titulo: "Estado" }]}
        filas={categorias.map((c) => ({
          id: c.id,
          celdas: [c.codigo, c.nombre, NOMBRE_GRUPO[c.grupo], c.cuentaGestoria ?? "—", <Etiqueta key="e" tono={c.activo ? "ok" : "normal"}>{c.activo ? "Activa" : "Desactivada"}</Etiqueta>],
          detalle: puedeEditar ? (
            <div className="space-y-3">
              <DatosDetalle datos={[{ etiqueta: "Orden", valor: String(c.orden) }]} />
              <form action={accionAlternarCategoria}>
                <input type="hidden" name="id" value={c.id} />
                <Boton type="submit" variante="secundario">
                  {c.activo ? "Desactivar" : "Activar"}
                </Boton>
              </form>
            </div>
          ) : undefined,
        }))}
      />
    </>
  );
}
