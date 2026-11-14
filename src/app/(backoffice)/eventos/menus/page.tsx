import { exigir } from "@/kernel/contexto";
import { euros, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarMenus, marcasYLocales } from "@/modulos/eventos/servicio";
import { guardarMenuAccion, activarMenuAccion } from "@/modulos/eventos/acciones";
import { AvisosUrl, PestanasEventos, type Busqueda } from "@/modulos/eventos/ui";

type Menu = Awaited<ReturnType<typeof listarMenus>>[number];

function FormMenu({ m, marcas }: { m?: Menu; marcas: { id: string; nombre: string }[] }) {
  return (
    <form action={guardarMenuAccion} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {m && <input type="hidden" name="id" value={m.id} />}
      <Campo etiqueta="Nombre"><Entrada name="nombre" defaultValue={m?.nombre} placeholder="Socarrat" required /></Campo>
      <Campo etiqueta="Marca">
        <Selector name="marcaId" defaultValue={m?.marcaId ?? ""}>
          <option value="">Todas las marcas</option>
          {marcas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="Precio por persona (IVA incl.)"><Entrada type="number" name="precioPersona" min={0} step="0.01" defaultValue={m ? Number(m.precioPersona) : undefined} required /></Campo>
      <Campo etiqueta="IVA %"><Entrada type="number" name="iva" min={0} max={21} defaultValue={m ? Number(m.iva) : 10} /></Campo>
      <Campo etiqueta="Mínimo de personas"><Entrada type="number" name="minPersonas" min={1} defaultValue={m?.minPersonas ?? 10} /></Campo>
      <div className="sm:col-span-2 lg:col-span-5"><Campo etiqueta="Descripción"><Entrada name="descripcion" defaultValue={m?.descripcion ?? ""} /></Campo></div>
      <div className="sm:col-span-2 lg:col-span-5"><Campo etiqueta="Platos" ayuda="Uno por línea"><AreaTexto name="platos" rows={4} defaultValue={m?.platos ?? ""} /></Campo></div>
      <div><Boton type="submit">{m ? "Guardar menú" : "Crear menú"}</Boton></div>
    </form>
  );
}

export default async function MenusDeGrupo({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("eventos", "eventos:ver");
  const sp = await searchParams;
  const puedeEditar = ctx.puede("eventos:menus:editar");
  const [menus, { marcas }] = await Promise.all([listarMenus(ctx, true), marcasYLocales(ctx)]);
  const nombreMarca = Object.fromEntries(marcas.map((m) => [m.id, m.nombre]));

  return (
    <>
      <Cabecera titulo="Menús de grupo" subtitulo="Menús cerrados de cada marca para presupuestar eventos" />
      <PestanasEventos activa="/eventos/menus" puedeGestionar={ctx.puede("eventos:gestionar")} />
      <AvisosUrl sp={sp} />
      <TablaDesplegable
        columnas={[{ titulo: "Menú" }, { titulo: "Marca" }, { titulo: "Precio / persona", alinear: "derecha" }, { titulo: "Mínimo", alinear: "derecha", secundaria: true }, { titulo: "Estado" }]}
        vacio="Aún no hay menús de grupo."
        filas={menus.map((m) => ({
          id: m.id,
          celdas: [
            <span key="n" className="font-medium">{m.nombre}</span>,
            m.marcaId ? nombreMarca[m.marcaId] ?? "—" : "Todas",
            euros(m.precioPersona),
            `${numero(m.minPersonas)} pers.`,
            m.activo ? <Etiqueta key="e" tono="ok">Activo</Etiqueta> : <Etiqueta key="e">Desactivado</Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle datos={[{ etiqueta: "Descripción", valor: m.descripcion ?? "—" }, { etiqueta: "IVA", valor: `${numero(m.iva)} %` }]} columnas={2} />
              {m.platos && <ul className="list-inside list-disc text-sm">{m.platos.split(/\r?\n/).filter(Boolean).map((p, i) => <li key={i}>{p}</li>)}</ul>}
              {puedeEditar && (
                <>
                  <FormMenu m={m} marcas={marcas} />
                  <form action={activarMenuAccion}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="activo" value={m.activo ? "0" : "1"} />
                    <Boton type="submit" variante="secundario">{m.activo ? "Desactivar menú" : "Volver a activar"}</Boton>
                  </form>
                </>
              )}
            </div>
          ),
        }))}
      />
      {puedeEditar && (
        <div className="mt-6">
          <Tarjeta titulo="Nuevo menú">
            <FormMenu marcas={marcas} />
          </Tarjeta>
        </div>
      )}
    </>
  );
}
