import { exigir } from "@/kernel/contexto";
import { euros, fechaHora, numeroCampo, porcentaje } from "@/kernel/formato";
import { Boton, Cabecera, Entrada, Etiqueta, Selector } from "@/ui";
import { TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarRecargos } from "@/modulos/comidas/carta-servicio";
import { fijarRecargo } from "@/modulos/comidas/carta-acciones";
import { AvisoError, param, PestanasCarta, type Busqueda } from "../_comun";

export default async function Recargos({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("comidas", "comidas:carta:ver");
  const sp = await searchParams;
  const filas = await listarRecargos(ctx);
  const puedeEditar = ctx.puede("comidas:carta:editar");
  const volver = "/comidas/carta/recargos";

  return (
    <>
      <Cabecera
        titulo="Pan y aperitivo"
        subtitulo="Recargo fijo por persona de cada local (entre 3,20 € y 5,50 € según la marca). Si está activo, Caja lo añade solo a cada ticket que se apunta: importe por persona × comensales, con su IVA."
      />
      <PestanasCarta activa={volver} />
      <AvisoError error={param(sp, "error")} />
      <TablaDesplegable
        columnas={[{ titulo: "Local" }, { titulo: "Marca" }, { titulo: "Por persona", alinear: "derecha" }, { titulo: "IVA", alinear: "derecha", secundaria: true }, { titulo: "Escandallo", secundaria: true }, { titulo: "Estado" }]}
        vacio="No tienes locales."
        filas={filas.map((f) => ({
          id: f.centroId,
          tono: f.importe == null ? ("aviso" as const) : undefined,
          celdas: [
            f.local,
            f.marca,
            f.importe != null ? euros(f.importe) : "—",
            porcentaje(f.iva),
            f.plato ?? "Sin escandallo",
            f.importe == null ? <Etiqueta tono="aviso">Sin definir</Etiqueta> : f.activo ? <Etiqueta tono="ok">Activo</Etiqueta> : <Etiqueta>Desactivado</Etiqueta>,
          ],
          detalle: puedeEditar ? (
            <form action={fijarRecargo} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="centroId" value={f.centroId} />
              <input type="hidden" name="volver" value={volver} />
              <label className="text-sm">
                <span className="mb-1 block font-medium">Importe por persona (IVA incluido)</span>
                <Entrada name="importe" inputMode="decimal" defaultValue={numeroCampo(f.importe)} required className="w-32" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">IVA %</span>
                <Entrada name="iva" inputMode="decimal" defaultValue={numeroCampo(f.iva)} required className="w-20" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Escandallo (plato de la carta)</span>
                <Selector name="platoId" defaultValue={f.platoId ?? ""} className="w-64">
                  <option value="">Sin escandallo (no baja stock)</option>
                  {f.platos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Selector>
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="activo" defaultChecked={f.importe == null ? true : f.activo} /> Activo (se cobra en este local)
              </label>
              <Boton type="submit">Guardar</Boton>
              <span className="text-xs text-slate-500">Última modificación: {fechaHora(f.actualizado)}</span>
            </form>
          ) : undefined,
        }))}
      />
    </>
  );
}
