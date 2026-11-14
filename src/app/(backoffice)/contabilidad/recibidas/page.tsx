import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, BotonEnlace, Campo, Selector, Etiqueta, HuecoIntegracion, Tabla, Aviso } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarFacturasRecibidas, revisarFacturasRecibidas, sociedadesVisibles, diccionarios, hoyISO, redondear } from "@/modulos/contabilidad/servicio";
import { accionValidarFacturaRecibida, accionPagarFacturaRecibida, accionAnularFacturaRecibida } from "@/modulos/contabilidad/acciones";
import { Avisos, Filtros, FiltroSociedad, FiltroMes, FormularioPago, BotonAccion, ESTADO_RECIBIDA, param, type ParametrosBusqueda } from "../_comun";

export default async function FacturasRecibidas({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:ver");
  const sp = await searchParams;
  const filtro = { sociedadId: param(sp, "sociedad"), estado: param(sp, "estado"), mes: param(sp, "mes") };
  const [facturas, sociedades, d] = await Promise.all([listarFacturasRecibidas(ctx, filtro), sociedadesVisibles(ctx), diccionarios(ctx)]);
  const puedeEditar = ctx.puede("contabilidad:facturas:editar");
  const hoy = hoyISO();
  const volver = `/contabilidad/recibidas?${new URLSearchParams(Object.entries(filtro).filter(([, v]) => v) as [string, string][]).toString()}`;
  const sumaTotal = redondear(facturas.filter((f) => f.estado !== "ANULADA").reduce((s, f) => s + Number(f.total), 0));
  // «La factura no cuadra» con los albaranes y posibles duplicadas (solo se revisan las que no están pagadas)
  const revision = await revisarFacturasRecibidas(ctx.tenant.id, facturas.filter((f) => f.estado === "PENDIENTE" || f.estado === "VALIDADA"));

  return (
    <>
      <Cabecera
        titulo="Facturas recibidas"
        subtitulo="Facturas de proveedores por sociedad: se registran, se revisan (validar) y se marcan como pagadas."
        acciones={puedeEditar ? <BotonEnlace href="/contabilidad/recibidas/nueva">Registrar factura</BotonEnlace> : undefined}
      />
      <Avisos sp={sp} />
      <div className="mb-4">
        <HuecoIntegracion nombre="Lectura de facturas con IA" descripcion="Subir el PDF o la foto y que la IA rellene la factura, y cruzarla con los pedidos y recepciones de Bebidas y Comidas" />
      </div>
      <Filtros>
        <FiltroSociedad sociedades={sociedades} valor={filtro.sociedadId} />
        <div className="min-w-48">
          <Campo etiqueta="Estado">
            <Selector name="estado" defaultValue={filtro.estado ?? ""}>
              <option value="">Todos</option>
              {Object.entries(ESTADO_RECIBIDA).map(([k, v]) => (
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
        total={`${numero(facturas.length)} facturas · ${euros(sumaTotal)} con IVA (sin anuladas)${revision.size ? ` · ${numero(revision.size)} con avisos de revisión` : ""}`}
        vacio="No hay facturas con estos filtros. Registra la primera con «Registrar factura»."
        columnas={[
          { titulo: "Fecha" },
          { titulo: "Proveedor" },
          { titulo: "Nº proveedor", secundaria: true },
          { titulo: "Sociedad", secundaria: true },
          { titulo: "Vencimiento", secundaria: true },
          { titulo: "Total", alinear: "derecha" },
          { titulo: "Estado" },
        ]}
        filas={facturas.map((f) => {
          const centro = f.centroId ? d.centros.get(f.centroId) : null;
          const vencida = f.vencimiento && f.estado !== "PAGADA" && f.estado !== "ANULADA" && f.vencimiento.toISOString().slice(0, 10) < hoy;
          const avisos = revision.get(f.id) ?? [];
          return {
            id: f.id,
            tono: vencida ? ("error" as const) : f.estado === "PENDIENTE" || avisos.length ? ("aviso" as const) : undefined,
            celdas: [
              fecha(f.fecha),
              f.proveedorNombre,
              f.numeroProveedor,
              d.sociedades.get(f.sociedadId)?.razonSocial ?? "—",
              fecha(f.vencimiento),
              euros(f.total),
              <span key="e" className="flex flex-wrap gap-1">
                <Etiqueta tono={ESTADO_RECIBIDA[f.estado].tono}>{ESTADO_RECIBIDA[f.estado].texto}</Etiqueta>
                {avisos.length > 0 && <Etiqueta tono="error">{avisos.some((a) => a.texto.startsWith("Posible duplicada")) ? "¿Duplicada?" : "No cuadra"}</Etiqueta>}
              </span>,
            ],
            detalle: (
              <div className="space-y-4">
                {avisos.length > 0 && (
                  <Aviso tono="aviso" titulo="Revisar antes de validar o pagar">
                    <ul className="list-disc space-y-1 pl-5">
                      {avisos.map((a, i) => (
                        <li key={i} className={a.tono === "error" ? "font-medium" : undefined}>
                          {a.texto}
                        </li>
                      ))}
                    </ul>
                  </Aviso>
                )}
                <DatosDetalle
                  datos={[
                    { etiqueta: "Número interno", valor: f.numero },
                    { etiqueta: "CIF del proveedor", valor: f.proveedorCif ?? "—" },
                    { etiqueta: "Centro", valor: centro?.nombre ?? "De la sociedad (sin centro)" },
                    { etiqueta: "Categoría", valor: (f.categoriaId && d.categorias.get(f.categoriaId)?.nombre) || "—" },
                    { etiqueta: "Base", valor: euros(f.base) },
                    { etiqueta: "IVA", valor: euros(f.cuotaIva) },
                    { etiqueta: "Origen", valor: f.origen === "MANUAL" ? "Alta a mano" : f.origen === "LECTURA_IA" ? "Leída con IA" : "Factura electrónica" },
                    { etiqueta: "Validada", valor: f.validadaEn ? fecha(f.validadaEn) : "—" },
                    { etiqueta: "Pagada", valor: f.pagadaEn ? fecha(f.pagadaEn) : "—" },
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
                    { titulo: "Categoría", celda: (l) => (l.categoriaId && d.categorias.get(l.categoriaId)?.nombre) || "—" },
                  ]}
                />
                {puedeEditar && (
                  <div className="flex flex-wrap items-end gap-3">
                    {f.estado === "PENDIENTE" && <BotonAccion accion={accionValidarFacturaRecibida} id={f.id} volver={volver} texto="Validar (revisada y correcta)" variante="principal" />}
                    {f.estado === "VALIDADA" && <FormularioPago accion={accionPagarFacturaRecibida} id={f.id} volver={volver} hoy={hoy} total={Number(f.total)} texto="Marcar pagada" />}
                    {(f.estado === "PENDIENTE" || f.estado === "VALIDADA") && <BotonAccion accion={accionAnularFacturaRecibida} id={f.id} volver={volver} texto="Anular" variante="peligro" />}
                  </div>
                )}
              </div>
            ),
          };
        })}
      />
    </>
  );
}
