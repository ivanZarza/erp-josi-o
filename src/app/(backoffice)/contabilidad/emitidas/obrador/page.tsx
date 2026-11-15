import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Boton, BotonEnlace, Etiqueta, Aviso, Tabla, Vacio } from "@/ui";
import { vistaFacturacionObrador, mesActual } from "@/modulos/contabilidad/servicio";
import { accionFacturarPedidosObrador } from "@/modulos/contabilidad/acciones";
import { Avisos, ESTADO_EMITIDA, param, type ParametrosBusqueda } from "../../_comun";
import type { EstadoFacturaEmitida } from "@/generated/prisma/client";

/** Facturar pedidos del obrador: factura entre sociedades del obrador a cada local, una por local y mes. */
export default async function FacturarPedidosObrador({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  const sp = await searchParams;
  const mesParam = param(sp, "mes");
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesActual();
  const v = await vistaFacturacionObrador(ctx, mes);
  const facturables = v.propuestas.filter((p) => !p.mismaSociedad && p.errores.length === 0 && p.lineas.length > 0);
  const mismas = v.propuestas.filter((p) => p.mismaSociedad);

  return (
    <>
      <Cabecera
        titulo="Facturar pedidos del obrador"
        subtitulo="Factura entre sociedades del obrador a cada local con los pedidos internos recibidos del mes: una por local y mes, a la tarifa del obrador."
        acciones={
          <BotonEnlace href="/contabilidad/emitidas" variante="secundario">
            Volver a facturas emitidas
          </BotonEnlace>
        }
      />
      <Avisos sp={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Campo etiqueta="Mes (según el día en que se sirvió)">
            <Entrada type="month" name="mes" defaultValue={mes} />
          </Campo>
        </div>
        <Boton type="submit" variante="secundario">
          Ver lo que se va a facturar
        </Boton>
      </form>
      <div className="mb-4 space-y-3">
        <Aviso tono="info" titulo="Cómo se factura">
          Entran los pedidos <strong>recibidos</strong> (el local confirmó lo que le llegó) servidos en el mes y que no estén ya en otra factura. Cada línea va al precio del pedido (la tarifa del obrador para ese local) por lo servido más lo que llegó de más; lo que faltó al recibir también se factura, porque salió del obrador y en el local quedó como merma. El IVA es el de cada producto. Se prepara la factura emitida (referencia PRE-…, se emite en el programa certificado) en la sociedad del obrador y su espejo como factura recibida en la sociedad del local, con categoría de mercancía (el Cuadro de mando no la suma: la mercancía del local sale del stock al coste medio, así no cuenta dos veces). Fecha de la factura: {fecha(new Date(`${v.fechaFactura}T12:00:00Z`))}{v.mesAcabado ? " (último día del mes)" : " (hoy: el mes no ha acabado; lo que se sirva después irá en otra factura)"}. Vence a 30 días.
        </Aviso>
      </div>

      {v.propuestas.length === 0 && v.sinConfirmar.length === 0 && v.yaFacturadas.length === 0 &&
        (ctx.centroActivo && ctx.centroActivo.tipo === "LOCAL" ? (
          <Vacio>Arriba tienes elegido un local ({ctx.centroActivo.nombre}): las facturas las hace el obrador. Elige arriba el obrador o «Todos mis centros».</Vacio>
        ) : (
          <Vacio>No hay pedidos del obrador servidos en ese mes en tus centros.</Vacio>
        ))}

      {v.propuestas.length > 0 && (
        <form action={accionFacturarPedidosObrador} className="space-y-4">
          <input type="hidden" name="mes" value={mes} />
          {v.propuestas.map((p) => (
            <Tarjeta
              key={`${p.origen.id}-${p.destino.id}`}
              titulo={`${p.origen.nombre} → ${p.destino.nombre}`}
              acciones={
                p.mismaSociedad ? (
                  <Etiqueta tono="normal">Misma sociedad: sin factura</Etiqueta>
                ) : p.errores.length ? (
                  <Etiqueta tono="error">No se puede facturar</Etiqueta>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="destinoIds" value={p.destino.id} defaultChecked /> Facturar
                  </label>
                )
              }
            >
              <div className="space-y-3">
                {p.mismaSociedad ? (
                  <p className="text-sm text-slate-600">
                    El obrador y {p.destino.nombre} son de la misma sociedad ({p.sociedadOrigen?.razonSocial ?? "—"}): es un traspaso interno, no lleva factura. Cuenta como venta del obrador y gasto del local en las cuentas de gestión (Obrador y Cuadro de mando).
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">
                    Factura de <strong>{p.sociedadOrigen?.razonSocial ?? "sin sociedad"}</strong> a <strong>{p.sociedadDestino?.razonSocial ?? "sin sociedad"}</strong> ({p.sociedadDestino?.cif ?? "—"}).
                  </p>
                )}
                {p.errores.map((e) => (
                  <Aviso key={e} tono="error">
                    {e}
                  </Aviso>
                ))}
                <Tabla
                  clave={(x) => x.id}
                  filas={p.pedidos}
                  columnas={[
                    { titulo: "Pedido", celda: (x) => x.numero },
                    { titulo: "Albarán", celda: (x) => x.albaran ?? "—" },
                    { titulo: "Servido", celda: (x) => fecha(x.servidoEn) },
                    { titulo: "Diferencias al recibir", celda: (x) => (x.diferencias ? `${numero(x.diferencias)} líneas` : "—") },
                    { titulo: "Sin IVA", celda: (x) => euros(x.base), alinear: "derecha" },
                  ]}
                />
                {!p.mismaSociedad && (
                  <>
                    <Tabla
                      clave={(l) => `${l.productoId}-${l.precio}`}
                      filas={p.lineas}
                      columnas={[
                        { titulo: "Producto", celda: (l) => l.concepto },
                        { titulo: "Cantidad", celda: (l) => numero(l.cantidad, 3), alinear: "derecha" },
                        { titulo: "Precio", celda: (l) => euros(l.precio, 4), alinear: "derecha" },
                        { titulo: "IVA", celda: (l) => `${numero(l.tipoIva)} %`, alinear: "derecha" },
                        { titulo: "Base", celda: (l) => euros(l.base), alinear: "derecha" },
                      ]}
                    />
                    <p className="text-right text-sm">
                      {p.porIva.map((x) => `Base al ${numero(x.tipo)} %: ${euros(x.base)} + IVA ${euros(x.cuotaIva)}`).join(" · ")} · <strong>Total {euros(p.total)}</strong>
                    </p>
                  </>
                )}
              </div>
            </Tarjeta>
          ))}
          {facturables.length > 0 && (
            <div className="flex justify-end">
              <Boton type="submit">Preparar las facturas marcadas</Boton>
            </div>
          )}
          {facturables.length === 0 && mismas.length > 0 && <p className="text-sm text-slate-600">Nada que facturar: los pedidos del mes son traspasos internos de la misma sociedad.</p>}
        </form>
      )}

      {v.sinConfirmar.length > 0 && (
        <Tarjeta titulo="Servidos sin confirmar por el local (todavía no entran)">
          <Tabla
            clave={(x) => x.id}
            filas={v.sinConfirmar}
            columnas={[
              { titulo: "Pedido", celda: (x) => x.numero },
              { titulo: "Albarán", celda: (x) => x.albaran ?? "—" },
              { titulo: "Del obrador", celda: (x) => x.origen },
              { titulo: "Al local", celda: (x) => x.destino },
              { titulo: "Servido", celda: (x) => fecha(x.servidoEn) },
              { titulo: "Factura", celda: (x) => (x.mismaSociedad ? "Misma sociedad: sin factura" : "Cuando el local confirme") },
            ]}
          />
        </Tarjeta>
      )}

      {v.yaFacturadas.length > 0 && (
        <Tarjeta titulo="Ya facturado de este mes (no se vuelve a facturar)">
          <Tabla
            clave={(x) => x.id}
            filas={v.yaFacturadas}
            columnas={[
              { titulo: "Referencia", celda: (x) => x.numeroOficial ?? x.referencia },
              { titulo: "Del obrador", celda: (x) => x.origen },
              { titulo: "A", celda: (x) => x.destino },
              { titulo: "Pedidos", celda: (x) => numero(x.pedidos), alinear: "derecha" },
              { titulo: "Total", celda: (x) => euros(x.total), alinear: "derecha" },
              { titulo: "Estado", celda: (x) => ESTADO_EMITIDA[x.estado as EstadoFacturaEmitida]?.texto ?? x.estado },
            ]}
          />
        </Tarjeta>
      )}
    </>
  );
}
