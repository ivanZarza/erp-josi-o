import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, BotonEnlace, Campo, Selector, Entrada, Boton, Etiqueta, Aviso, HuecoIntegracion, Tabla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarFacturasEmitidas, sociedadesVisibles, diccionarios, hoyISO } from "@/modulos/contabilidad/servicio";
import { accionMarcarEmitidaFuera, accionCobrarFacturaEmitida, accionAnularFacturaEmitida } from "@/modulos/contabilidad/acciones";
import { Avisos, Filtros, FiltroSociedad, FiltroMes, FormularioPago, BotonAccion, ESTADO_EMITIDA, param, type ParametrosBusqueda } from "../_comun";

const ORIGEN: Record<string, string> = { EVENTO: "Evento", CATERING: "Catering", ENTRE_SOCIEDADES: "Entre sociedades del grupo", OTRO: "Otro" };

export default async function FacturasEmitidas({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:ver");
  const sp = await searchParams;
  const filtro = { sociedadId: param(sp, "sociedad"), estado: param(sp, "estado"), mes: param(sp, "mes") };
  const [facturas, sociedades, d] = await Promise.all([listarFacturasEmitidas(ctx, filtro), sociedadesVisibles(ctx), diccionarios(ctx)]);
  const puedeEditar = ctx.puede("contabilidad:facturas:editar");
  const hoy = hoyISO();
  const volver = `/contabilidad/emitidas?${new URLSearchParams(Object.entries(filtro).filter(([, v]) => v) as [string, string][]).toString()}`;

  return (
    <>
      <Cabecera
        titulo="Facturas emitidas"
        subtitulo="Eventos, catering y ventas entre sociedades del grupo."
        acciones={puedeEditar ? <BotonEnlace href="/contabilidad/emitidas/nueva">Preparar factura</BotonEnlace> : undefined}
      />
      <Avisos sp={sp} />
      <div className="mb-4 space-y-3">
        <Aviso tono="aviso" titulo="Estas facturas NO se emiten desde el ERP">
          El ERP no está certificado para Verifactu. Aquí solo se <strong>preparan</strong> los datos; la factura oficial se emite en un programa certificado (el de la gestoría,
          Holded, Odoo…) y después se apunta aquí su número oficial. La referencia «PRE-…» es interna y no es un número de factura.
        </Aviso>
        <HuecoIntegracion nombre="Verifactu" descripcion="Enviar la factura preparada al programa certificado y recibir su número oficial sin copiarlo a mano (decisión pendiente P-23)" />
      </div>
      <Filtros>
        <FiltroSociedad sociedades={sociedades} valor={filtro.sociedadId} />
        <div className="min-w-48">
          <Campo etiqueta="Estado">
            <Selector name="estado" defaultValue={filtro.estado ?? ""}>
              <option value="">Todos</option>
              {Object.entries(ESTADO_EMITIDA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.texto}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        <FiltroMes valor={filtro.mes} />
      </Filtros>
      <TablaDesplegable
        total={`${numero(facturas.length)} facturas`}
        vacio="No hay facturas emitidas con estos filtros."
        columnas={[{ titulo: "Fecha" }, { titulo: "Cliente" }, { titulo: "Referencia / nº oficial" }, { titulo: "Sociedad", secundaria: true }, { titulo: "Total", alinear: "derecha" }, { titulo: "Estado" }]}
        filas={facturas.map((f) => ({
          id: f.id,
          tono: f.estado === "PREPARADA" ? ("aviso" as const) : undefined,
          celdas: [
            fecha(f.fecha),
            f.clienteNombre,
            f.numeroOficial ?? f.referencia,
            d.sociedades.get(f.sociedadId)?.razonSocial ?? "—",
            euros(f.total),
            <Etiqueta key="e" tono={ESTADO_EMITIDA[f.estado].tono}>
              {ESTADO_EMITIDA[f.estado].texto}
            </Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Referencia interna", valor: f.referencia },
                  { etiqueta: "Número oficial", valor: f.numeroOficial ?? "Sin emitir" },
                  { etiqueta: "Programa emisor", valor: f.programaEmisor ?? "—" },
                  { etiqueta: "Tipo", valor: ORIGEN[f.origen] },
                  { etiqueta: "CIF del cliente", valor: f.clienteCif ?? "—" },
                  { etiqueta: "Sociedad del grupo que recibe", valor: f.sociedadDestinoId ? (d.sociedades.get(f.sociedadDestinoId)?.razonSocial ?? "—") : "—" },
                  { etiqueta: "Centro", valor: f.centroId ? (d.centros.get(f.centroId)?.nombre ?? "—") : "—" },
                  { etiqueta: "Vencimiento", valor: fecha(f.vencimiento) },
                  { etiqueta: "Base", valor: euros(f.base) },
                  { etiqueta: "IVA", valor: euros(f.cuotaIva) },
                  { etiqueta: "Cobrada", valor: f.cobradaEn ? fecha(f.cobradaEn) : "—" },
                  { etiqueta: "Notas", valor: f.notas ?? "—" },
                ]}
              />
              <Tabla
                clave={(l) => l.id}
                filas={f.lineas}
                columnas={[
                  { titulo: "Concepto", celda: (l) => l.concepto },
                  { titulo: "Cantidad", celda: (l) => numero(l.cantidad, 3), alinear: "derecha" },
                  { titulo: "Precio", celda: (l) => euros(l.precio, 4), alinear: "derecha" },
                  { titulo: "IVA", celda: (l) => `${numero(l.tipoIva)} %`, alinear: "derecha" },
                  { titulo: "Base", celda: (l) => euros(l.base), alinear: "derecha" },
                ]}
              />
              {puedeEditar && (
                <div className="flex flex-wrap items-end gap-3">
                  {(f.estado === "PREPARADA" || f.estado === "BORRADOR") && (
                    <form action={accionMarcarEmitidaFuera} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <div className="w-48">
                        <Campo etiqueta="Número oficial">
                          <Entrada name="numeroOficial" required />
                        </Campo>
                      </div>
                      <div className="w-48">
                        <Campo etiqueta="Programa certificado">
                          <Entrada name="programaEmisor" required placeholder="A3, Holded, Odoo…" />
                        </Campo>
                      </div>
                      <Boton type="submit">Apuntar como emitida</Boton>
                    </form>
                  )}
                  {f.estado === "EMITIDA_FUERA" && <FormularioPago accion={accionCobrarFacturaEmitida} id={f.id} volver={volver} hoy={hoy} total={Number(f.total)} texto="Marcar cobrada" />}
                  {(f.estado === "PREPARADA" || f.estado === "BORRADOR") && <BotonAccion accion={accionAnularFacturaEmitida} id={f.id} volver={volver} texto="Anular" variante="peligro" />}
                </div>
              )}
            </div>
          ),
        }))}
      />
    </>
  );
}
