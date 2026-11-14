import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Entrada, Etiqueta, Pestanas, Tabla } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { nombreAlergeno } from "@/modulos/comidas/carta-alergenos";
import { listarLotes } from "@/modulos/obrador/servicio";
import { retirarLote } from "@/modulos/obrador/acciones";
import { AvisoError, param, SinObrador, unidad, type Busqueda } from "../_comun";

export default async function Lotes({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("obrador", "obrador:lotes:ver");
  const sp = await searchParams;
  const estado = param(sp, "estado") ?? "VIGENTE";
  const q = param(sp, "q") ?? "";
  const lotes = await listarLotes(ctx, { estado: estado === "TODOS" ? undefined : estado, q: q || undefined });
  const puedeRetirar = ctx.puede("obrador:lotes:retirar");
  const puedeImprimir = ctx.puede("obrador:etiquetas:imprimir");

  return (
    <>
      <Cabecera titulo="Lotes" subtitulo="Cada producción crea un lote con caducidad. Desde aquí se ve qué ingredientes llevaba, a qué locales pudo ir y se imprime la etiqueta." />
      <AvisoError error={param(sp, "error")} />
      <SinObrador ctx={ctx} />
      <Pestanas
        activa={`/obrador/lotes?estado=${estado}`}
        items={[
          { href: "/obrador/lotes?estado=VIGENTE", titulo: "Vigentes" },
          { href: "/obrador/lotes?estado=CADUCADO", titulo: "Caducados" },
          { href: "/obrador/lotes?estado=RETIRADO", titulo: "Retirados" },
          { href: "/obrador/lotes?estado=TODOS", titulo: "Todos" },
        ]}
      />
      <form className="mb-4 flex max-w-md gap-2" action="/obrador/lotes">
        <input type="hidden" name="estado" value={estado} />
        <Entrada name="q" defaultValue={q} placeholder="Buscar por código de lote" />
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[
          { titulo: "Lote" },
          { titulo: "Producto" },
          { titulo: "Cantidad", alinear: "derecha" },
          { titulo: "Elaborado", secundaria: true },
          { titulo: "Caduca" },
          { titulo: "Estado" },
        ]}
        vacio="No hay lotes en esta vista. Los lotes se crean al cerrar una orden de producción."
        filas={lotes.map((l) => ({
          id: l.id,
          tono: l.estado === "RETIRADO" ? ("error" as const) : l.estado === "ACTIVO" && l.diasParaCaducar <= 1 ? ("aviso" as const) : undefined,
          celdas: [
            l.codigo,
            l.producto,
            `${numero(l.cantidad)} ${unidad(l.unidad)}`,
            fecha(l.elaboradoEn),
            fecha(l.caducaEn),
            l.estado === "RETIRADO" ? (
              <Etiqueta tono="error">Retirado</Etiqueta>
            ) : l.caducado ? (
              <Etiqueta tono="aviso">Caducado</Etiqueta>
            ) : (
              <Etiqueta tono="ok">Vigente</Etiqueta>
            ),
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Orden", valor: l.orden.numero },
                  { etiqueta: "Obrador", valor: l.obrador },
                  { etiqueta: "Elaborado", valor: fechaHora(l.elaboradoEn) },
                  { etiqueta: "Coste por unidad", valor: euros(l.costeUnitario, 4) },
                  { etiqueta: "Alérgenos", valor: l.alergenos.length ? l.alergenos.map(nombreAlergeno).join(", ") : "Ninguno" },
                  { etiqueta: "Conservación", valor: l.conservacion ?? "—" },
                  { etiqueta: "Retirado", valor: l.retiradoEn ? `${fechaHora(l.retiradoEn)} · ${l.retiradoMotivo ?? ""}` : "—" },
                ]}
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Ingredientes que llevaba</div>
                  <Tabla
                    clave={(i) => i.producto + i.cantidad}
                    filas={l.ingredientesDetalle}
                    columnas={[
                      { titulo: "Ingrediente", celda: (i) => i.producto },
                      { titulo: "Cantidad", alinear: "derecha", celda: (i) => `${numero(i.cantidad, 3)} ${unidad(i.unidad)}` },
                      { titulo: "Coste", alinear: "derecha", celda: (i) => euros(i.cantidad * i.costeUnitario) },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Posibles destinos (pedidos servidos entre elaboración y caducidad)</div>
                  <Tabla
                    clave={(d) => d.id}
                    filas={l.destinos}
                    vacio="No se ha servido este producto a ningún local mientras el lote estaba vigente."
                    columnas={[
                      { titulo: "Pedido", celda: (d) => d.pedido },
                      { titulo: "Local", celda: (d) => d.local },
                      { titulo: "Servido", celda: (d) => fecha(d.servidoEn) },
                      { titulo: "Cantidad", alinear: "derecha", celda: (d) => numero(d.cantidad) },
                    ]}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {puedeImprimir && (
                  <BotonEnlace href={`/obrador/lotes/${l.id}/etiqueta`} variante="secundario">
                    Imprimir etiqueta
                  </BotonEnlace>
                )}
                {puedeRetirar && l.estado !== "RETIRADO" && (
                  <form action={retirarLote} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="volver" value="/obrador/lotes" />
                    <Campo etiqueta="Motivo de la retirada">
                      <Entrada name="motivo" required placeholder="Alerta sanitaria del proveedor de carne" className="w-72" />
                    </Campo>
                    <Boton type="submit" variante="peligro">
                      Retirar lote
                    </Boton>
                  </form>
                )}
              </div>
              <p className="text-xs text-slate-500">
                El pedido interno todavía no guarda el lote servido: los destinos son los pedidos de ese producto mientras el lote estaba vigente.{" "}
                <Link className="text-acento hover:underline" href="/obrador/produccion?estado=CERRADA">
                  Ver producción cerrada
                </Link>
              </p>
            </div>
          ),
        }))}
      />
    </>
  );
}
