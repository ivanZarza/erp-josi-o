import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { BotonEnlace, Cabecera, Cifra, Etiqueta, Rejilla, Tarjeta, Vacio } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { resumenObrador } from "@/modulos/obrador/servicio";
import { SinObrador, unidad } from "./_comun";

export default async function ResumenObrador() {
  const ctx = await exigir("obrador", "obrador:ver");
  const sinObrador = <SinObrador ctx={ctx} />;
  const r = await resumenObrador(ctx);
  const cerradasHoy = r.ordenesHoy.filter((o) => o.estado === "CERRADA").length;
  const planificadasHoy = r.ordenesHoy.filter((o) => o.estado === "PLANIFICADA").length;

  return (
    <>
      <Cabecera
        titulo="Obrador"
        subtitulo={`Producción de hoy (${fecha(r.hoy)}), lotes que caducan y venta a los locales del mes.`}
        acciones={
          <>
            <BotonEnlace href="/obrador/produccion">Planificar producción</BotonEnlace>
            <BotonEnlace href="/obrador/tarifas" variante="secundario">
              Tarifas a locales
            </BotonEnlace>
          </>
        }
      />
      {sinObrador}
      <Rejilla columnas={4}>
        <Cifra etiqueta="Producción de hoy" valor={numero(r.ordenesHoy.length)} detalle={`${cerradasHoy} cerradas · ${planificadasHoy} por hacer`} href="/obrador/produccion" />
        <Cifra
          etiqueta="Lotes que caducan"
          valor={numero(r.lotesCaducan.length)}
          detalle="En los próximos 3 días o ya caducados"
          tono={r.lotesCaducan.length > 0 ? "aviso" : "ok"}
          href="/obrador/lotes"
        />
        <Cifra etiqueta="Venta a locales (mes)" valor={euros(r.venta)} detalle={`Margen sobre coste: ${euros(r.margen)}`} />
        <Cifra etiqueta="Pedidos por servir" valor={numero(r.pedidosPendientes)} detalle="Pedidos de locales pendientes" tono={r.pedidosPendientes > 0 ? "aviso" : "normal"} />
      </Rejilla>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Tarjeta titulo="Producción de hoy">
          <TablaDesplegable
            columnas={[{ titulo: "Orden" }, { titulo: "Elaborado" }, { titulo: "Cantidad", alinear: "derecha" }, { titulo: "Estado" }]}
            vacio="No hay producción planificada para hoy. Planifícala en Producción."
            filas={r.ordenesHoy.map((o) => ({
              id: o.id,
              celdas: [
                o.numero,
                o.elaborado,
                `${numero(o.cantidadReal ?? o.cantidadPrevista)} ${unidad(o.unidad)}`,
                <Etiqueta key="e" tono={o.estado === "CERRADA" ? "ok" : o.estado === "ANULADA" ? "normal" : "aviso"}>
                  {o.estado === "CERRADA" ? "Cerrada" : o.estado === "ANULADA" ? "Anulada" : "Por hacer"}
                </Etiqueta>,
              ],
              detalle: (
                <DatosDetalle
                  datos={[
                    { etiqueta: "Receta", valor: o.receta.nombre },
                    { etiqueta: "Tandas", valor: numero(o.tandas) },
                    { etiqueta: "Coste", valor: o.costeTotal != null ? euros(o.costeTotal) : `${euros(o.costeEstimado)} (estimado)` },
                    { etiqueta: "Lote", valor: o.lote?.codigo ?? "—" },
                  ]}
                />
              ),
            }))}
          />
        </Tarjeta>

        <Tarjeta titulo="Lotes que caducan">
          <TablaDesplegable
            columnas={[{ titulo: "Lote" }, { titulo: "Producto" }, { titulo: "Cantidad", alinear: "derecha" }, { titulo: "Caduca" }]}
            vacio="Ningún lote caduca en los próximos 3 días."
            filas={r.lotesCaducan.map((l) => ({
              id: l.id,
              tono: l.caducado ? ("error" as const) : ("aviso" as const),
              celdas: [l.codigo, l.producto, `${numero(l.cantidad)} ${unidad(l.unidad)}`, l.caducado ? <Etiqueta tono="error">Caducado {fecha(l.caducaEn)}</Etiqueta> : fecha(l.caducaEn)],
              detalle: (
                <DatosDetalle
                  datos={[
                    { etiqueta: "Elaborado", valor: fechaHora(l.elaboradoEn) },
                    { etiqueta: "Orden", valor: l.orden.numero },
                    { etiqueta: "Conservación", valor: l.conservacion ?? "—" },
                    { etiqueta: "Enviado a", valor: l.destinos.length ? Array.from(new Set(l.destinos.map((d) => d.local))).join(", ") : "Sin pedidos servidos" },
                  ]}
                />
              ),
            }))}
          />
        </Tarjeta>
      </div>

      <div className="mt-6">
        <Tarjeta titulo="Venta a locales este mes">
          {r.porLocal.length === 0 ? (
            <Vacio>Todavía no se ha servido ningún pedido a los locales este mes.</Vacio>
          ) : (
            <TablaDesplegable
              columnas={[{ titulo: "Local" }, { titulo: "Líneas servidas", alinear: "derecha" }, { titulo: "Importe", alinear: "derecha" }]}
              filas={r.porLocal.map((x) => ({ id: x.id, celdas: [x.local, numero(x.lineas), euros(x.importe)] }))}
              total={`${r.porLocal.length} locales · ${euros(r.venta)}`}
            />
          )}
        </Tarjeta>
      </div>
    </>
  );
}
