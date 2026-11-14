import { exigir } from "@/kernel/contexto";
import { Boton, Cabecera, Entrada, Etiqueta } from "@/ui";
import { TablaDesplegable } from "@/ui/tabla-desplegable";
import { ALERGENOS } from "@/modulos/comidas/carta-alergenos";
import { productosConAlergenos } from "@/modulos/comidas/carta-servicio";
import { guardarAlergenosProducto } from "@/modulos/comidas/carta-acciones";
import { AvisoError, listaAlergenos, param, PestanasCarta, type Busqueda } from "../_comun";

export default async function AlergenosIngredientes({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("comidas", "comidas:carta:ver");
  const sp = await searchParams;
  const q = param(sp, "q") ?? "";
  const productos = await productosConAlergenos(ctx, q || undefined);
  const puedeEditar = ctx.puede("comidas:carta:editar");
  const volver = "/comidas/carta/alergenos";
  const sinDeclarar = productos.filter((p) => !p.declarado).length;

  return (
    <>
      <Cabecera
        titulo="Alérgenos de los ingredientes"
        subtitulo="Lo que se declara aquí lo heredan los escandallos de los platos y las recetas del obrador. Los elaborados del obrador se calculan solos desde su receta."
      />
      <PestanasCarta activa={volver} />
      <AvisoError error={param(sp, "error")} />
      <form className="mb-4 flex max-w-md gap-2" action={volver}>
        <Entrada name="q" defaultValue={q} placeholder="Buscar ingrediente" />
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>
      <TablaDesplegable
        columnas={[{ titulo: "Producto" }, { titulo: "Familia", secundaria: true }, { titulo: "Alérgenos" }, { titulo: "Trazas", secundaria: true }, { titulo: "Estado" }]}
        total={`${productos.length} productos · ${sinDeclarar} sin declarar`}
        vacio="No hay productos de Comidas."
        filas={productos.map((p) => ({
          id: p.id,
          tono: p.declarado ? undefined : ("aviso" as const),
          celdas: [
            `${p.nombre} · ${p.referencia}`,
            p.familia,
            listaAlergenos(p.alergenos),
            listaAlergenos(p.trazas),
            p.elaborado ? <Etiqueta tono="info">Desde la receta</Etiqueta> : p.declarado ? <Etiqueta tono="ok">Declarado</Etiqueta> : <Etiqueta tono="aviso">Sin declarar</Etiqueta>,
          ],
          detalle:
            puedeEditar && !p.elaborado ? (
              <form action={guardarAlergenosProducto} className="space-y-3">
                <input type="hidden" name="productoId" value={p.id} />
                <input type="hidden" name="volver" value={volver} />
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
                  {ALERGENOS.map((a) => (
                    <div key={a.clave} className="flex items-center justify-between gap-2 text-sm">
                      <span>{a.nombre}</span>
                      <span className="flex gap-3">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="alergenos" value={a.clave} defaultChecked={p.alergenos.includes(a.clave)} /> sí
                        </label>
                        <label className="flex items-center gap-1 text-slate-500">
                          <input type="checkbox" name="trazas" value={a.clave} defaultChecked={p.trazas.includes(a.clave)} /> trazas
                        </label>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Boton type="submit">Guardar alérgenos de {p.nombre}</Boton>
                  <span className="text-xs text-slate-500">Los platos que llevan este ingrediente quedarán pendientes de revisar sus alérgenos.</span>
                </div>
              </form>
            ) : p.elaborado ? (
              <p className="text-sm text-slate-600">Es un elaborado del obrador: sus alérgenos salen de su receta (Obrador → Recetas).</p>
            ) : undefined,
        }))}
      />
    </>
  );
}
