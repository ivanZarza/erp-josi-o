import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Boton, Cabecera, Campo, Entrada, Etiqueta, Pestanas, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { hoyMadrid, listarOrdenes, listarRecetas } from "@/modulos/obrador/servicio";
import { anularOrden, cerrarOrden, planificarOrden } from "@/modulos/obrador/acciones";
import { AvisoError, param, SinObrador, unidad, type Busqueda } from "../_comun";

const ESTADOS: Record<string, { texto: string; tono: "ok" | "aviso" | "normal" }> = {
  PLANIFICADA: { texto: "Planificada", tono: "aviso" },
  CERRADA: { texto: "Cerrada", tono: "ok" },
  ANULADA: { texto: "Anulada", tono: "normal" },
};

export default async function Produccion({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("obrador", "obrador:produccion:ver");
  const sp = await searchParams;
  const vista = param(sp, "estado") ?? "PLANIFICADA";
  const puedeCrear = ctx.puede("obrador:produccion:crear");
  const [ordenes, recetas] = await Promise.all([listarOrdenes(ctx, vista === "TODAS" ? {} : { estado: vista }), listarRecetas(ctx)]);
  const hoy = hoyMadrid();

  return (
    <>
      <Cabecera titulo="Producción" subtitulo="Planifica las órdenes y ciérralas al terminar: salen los ingredientes y entra el elaborado con su lote y caducidad." />
      <AvisoError error={param(sp, "error")} />
      <SinObrador ctx={ctx} />

      {puedeCrear && recetas.length > 0 && (
        <div className="mb-6">
          <Tarjeta titulo="Planificar producción">
            <form action={planificarOrden} className="grid grid-cols-1 items-end gap-3 md:grid-cols-5">
              <input type="hidden" name="volver" value="/obrador/produccion" />
              <div className="md:col-span-2">
                <Campo etiqueta="Receta">
                  <Selector name="recetaId" required defaultValue="">
                    <option value="" disabled>
                      Elige una receta…
                    </option>
                    {recetas.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} — {numero(r.rendimiento)} {unidad(r.unidad)} por tanda
                      </option>
                    ))}
                  </Selector>
                </Campo>
              </div>
              <Campo etiqueta="Día">
                <Entrada type="date" name="fecha" defaultValue={hoy} required />
              </Campo>
              <Campo etiqueta="Tandas">
                <Entrada name="tandas" inputMode="decimal" defaultValue="1" required />
              </Campo>
              <Boton type="submit">Planificar</Boton>
              <div className="md:col-span-5">
                <Campo etiqueta="Notas">
                  <Entrada name="notas" placeholder="Para el pedido de Vaca Ayala, reparto del jueves…" />
                </Campo>
              </div>
            </form>
          </Tarjeta>
        </div>
      )}

      <Pestanas
        activa={`/obrador/produccion?estado=${vista}`}
        items={[
          { href: "/obrador/produccion?estado=PLANIFICADA", titulo: "Por hacer" },
          { href: "/obrador/produccion?estado=CERRADA", titulo: "Cerradas" },
          { href: "/obrador/produccion?estado=ANULADA", titulo: "Anuladas" },
          { href: "/obrador/produccion?estado=TODAS", titulo: "Todas" },
        ]}
      />

      <TablaDesplegable
        columnas={[
          { titulo: "Orden" },
          { titulo: "Día" },
          { titulo: "Elaborado" },
          { titulo: "Tandas", alinear: "derecha", secundaria: true },
          { titulo: "Cantidad", alinear: "derecha" },
          { titulo: "Coste", alinear: "derecha", secundaria: true },
          { titulo: "Estado" },
        ]}
        vacio={recetas.length === 0 ? "Primero crea una receta de producción en Recetas." : "No hay órdenes en esta vista."}
        filas={ordenes.map((o) => ({
          id: o.id,
          tono: o.estado === "PLANIFICADA" && o.fecha.toISOString().slice(0, 10) < hoy ? ("aviso" as const) : undefined,
          celdas: [
            o.numero,
            fecha(o.fecha),
            o.elaborado,
            numero(o.tandas),
            `${numero(o.cantidadReal ?? o.cantidadPrevista)} ${unidad(o.unidad)}`,
            o.costeTotal != null ? euros(o.costeTotal) : <span className="text-slate-500">{euros(o.costeEstimado)}</span>,
            <Etiqueta key="e" tono={ESTADOS[o.estado].tono}>
              {ESTADOS[o.estado].texto}
            </Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Receta", valor: <Link className="text-acento hover:underline" href={`/obrador/recetas/${o.recetaId}`}>{o.receta.nombre}</Link> },
                  { etiqueta: "Obrador", valor: o.obrador },
                  { etiqueta: "Cantidad prevista", valor: `${numero(o.cantidadPrevista)} ${unidad(o.unidad)}` },
                  { etiqueta: "Cantidad real", valor: o.cantidadReal != null ? `${numero(o.cantidadReal)} ${unidad(o.unidad)}` : "—" },
                  { etiqueta: "Coste por unidad", valor: o.costeUnitario != null ? euros(o.costeUnitario, 4) : "—" },
                  { etiqueta: "Cerrada", valor: fechaHora(o.cerradoEn) },
                  { etiqueta: "Lote", valor: o.lote ? <Link className="text-acento hover:underline" href={`/obrador/lotes?q=${o.lote.codigo}&estado=TODOS`}>{o.lote.codigo}</Link> : "—" },
                  { etiqueta: "Notas", valor: o.notas ?? "—" },
                ]}
              />
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{o.estado === "CERRADA" ? "Ingredientes previstos" : "Ingredientes que saldrán del stock"}</div>
                <Tabla
                  clave={(c) => c.productoId}
                  filas={o.consumo}
                  columnas={[
                    { titulo: "Ingrediente", celda: (c) => c.producto },
                    { titulo: "Cantidad bruta", alinear: "derecha", celda: (c) => `${numero(c.bruta, 3)} ${unidad(c.unidad)}` },
                    { titulo: "Coste", alinear: "derecha", celda: (c) => euros(c.coste) },
                  ]}
                />
              </div>
              {o.estado === "PLANIFICADA" && puedeCrear && (
                <div className="flex flex-wrap items-end gap-3">
                  <form action={cerrarOrden} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="volver" value="/obrador/produccion" />
                    <Campo etiqueta={`Cantidad producida (${unidad(o.unidad)})`}>
                      <Entrada name="cantidadReal" inputMode="decimal" defaultValue={String(o.cantidadPrevista)} required className="w-40" />
                    </Campo>
                    <label className="flex min-h-10 items-center gap-2 text-sm">
                      <input type="checkbox" name="forzar" /> Cerrar aunque falte stock
                    </label>
                    <Boton type="submit">Cerrar y crear lote</Boton>
                  </form>
                  <form action={anularOrden}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="volver" value="/obrador/produccion" />
                    <Boton type="submit" variante="secundario">
                      Anular
                    </Boton>
                  </form>
                </div>
              )}
              {o.lote && (
                <Link className="text-sm text-acento hover:underline" href={`/obrador/lotes/${o.lote.id}/etiqueta`}>
                  Imprimir etiqueta del lote {o.lote.codigo}
                </Link>
              )}
            </div>
          ),
        }))}
      />
    </>
  );
}
