import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, BotonEnlace, HuecoIntegracion, Vacio, Tabla } from "@/ui";
import { euros, fecha as fechaEs } from "@/kernel/formato";
import { sociedadesVisibles, diccionarios, hoyISO, albaranesPendientes, redondear } from "@/modulos/contabilidad/servicio";
import { accionCrearFacturaRecibida } from "@/modulos/contabilidad/acciones";
import { Avisos, LineasFormulario, param, type ParametrosBusqueda } from "../../_comun";

export default async function NuevaFacturaRecibida({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  const sp = await searchParams;
  const [sociedades, d] = await Promise.all([sociedadesVisibles(ctx), diccionarios(ctx)]);
  const centros = ctx.centros.map((c) => ({ ...c, sociedadId: d.centros.get(c.id)?.sociedadId ?? null }));
  // Paso 1 (opcional): proveedor, centro y fecha para proponer sus albaranes pendientes de facturar
  const proveedorId = param(sp, "proveedor");
  const centroElegido = param(sp, "centro") ?? ctx.centroActivo?.id ?? "";
  const fechaFactura = param(sp, "fecha") ?? hoyISO();
  const albaranes = proveedorId ? await albaranesPendientes(ctx, { proveedorId, centroId: centroElegido || undefined, hasta: fechaFactura }) : [];
  const sociedadPropuesta = centroElegido ? (centros.find((c) => c.id === centroElegido)?.sociedadId ?? "") : sociedades.length === 1 ? sociedades[0].id : "";
  const propuestos = albaranes.filter((a) => a.propuesto);

  return (
    <>
      <Cabecera titulo="Registrar factura recibida" subtitulo="Alta a mano de una factura de proveedor. Queda «pendiente de revisar» hasta que alguien la valide." acciones={<BotonEnlace href="/contabilidad/recibidas" variante="secundario">Volver</BotonEnlace>} />
      <Avisos sp={sp} />
      <div className="mb-4">
        <HuecoIntegracion nombre="Lectura de facturas con IA" descripcion="Aquí se podrá subir el PDF o la foto y la IA rellenará este formulario para revisarlo" />
      </div>
      {sociedades.length > 0 && (
        <Tarjeta titulo="1. Albaranes que factura (opcional)">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <Campo etiqueta="Proveedor">
                <Selector name="proveedor" defaultValue={proveedorId ?? ""}>
                  <option value="">Elige el proveedor…</option>
                  {d.proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
            <div className="min-w-48">
              <Campo etiqueta="Centro">
                <Selector name="centro" defaultValue={centroElegido}>
                  <option value="">Todos los de la sociedad</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
            <div className="w-44">
              <Campo etiqueta="Fecha de la factura">
                <Entrada type="date" name="fecha" defaultValue={fechaFactura} />
              </Campo>
            </div>
            <Boton type="submit" variante="secundario">
              Ver sus albaranes sin factura
            </Boton>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Si la factura es semanal, quincenal o mensual, junta todos sus albaranes. Salen marcados los del periodo: recibidos después de la última factura del proveedor en ese centro y hasta la fecha de la factura.
          </p>
        </Tarjeta>
      )}
      {sociedades.length === 0 ? (
        <Vacio>Tus centros no tienen sociedad asignada: asígnala en Organización antes de registrar facturas.</Vacio>
      ) : (
        <form action={accionCrearFacturaRecibida} className="space-y-4">
          <Tarjeta titulo="Datos de la factura">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Sociedad que la recibe">
                <Selector name="sociedadId" required defaultValue={sociedadPropuesta}>
                  <option value="">Elige…</option>
                  {sociedades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial} ({s.cif})
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Centro (opcional)" ayuda="Debe ser de la sociedad elegida. Vacío = de la sociedad (puede juntar albaranes de varios de sus centros).">
                <Selector name="centroId" defaultValue={centroElegido}>
                  <option value="">Sin centro</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Proveedor dado de alta">
                <Selector name="proveedorId" defaultValue={proveedorId ?? ""}>
                  <option value="">Otro (escribir abajo)</option>
                  {d.proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Otro proveedor" ayuda="Compañía de la luz, casero… si no está en la lista">
                <Entrada name="proveedorNombre" />
              </Campo>
              <Campo etiqueta="CIF del proveedor">
                <Entrada name="proveedorCif" />
              </Campo>
              <Campo etiqueta="Número de factura del proveedor">
                <Entrada name="numeroProveedor" required />
              </Campo>
              <Campo etiqueta="Fecha de la factura">
                <Entrada type="date" name="fecha" required defaultValue={fechaFactura} />
              </Campo>
              <Campo etiqueta="Vencimiento">
                <Entrada type="date" name="vencimiento" />
              </Campo>
              <Campo etiqueta="Categoría principal" ayuda="Obligatoria: va a las líneas sin categoría propia y decide dónde suma en el Cuadro de mando">
                <Selector name="categoriaId" required defaultValue="">
                  <option value="">Elige…</option>
                  {d.listaCategorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
          </Tarjeta>
          {proveedorId && (
            <Tarjeta titulo={`Albaranes sin factura de ${d.proveedores.find((p) => p.id === proveedorId)?.nombre ?? "este proveedor"}`}>
              {albaranes.length === 0 ? (
                <Vacio>Este proveedor no tiene albaranes recibidos sin factura en los últimos 120 días en tus centros.</Vacio>
              ) : (
                <>
                  <Tabla
                    clave={(a) => a.id}
                    filas={albaranes}
                    columnas={[
                      { titulo: "Factura", celda: (a) => <input type="checkbox" name="albaranIds" value={a.id} defaultChecked={a.propuesto} aria-label={`Facturar ${a.albaran ?? a.numero}`} /> },
                      { titulo: "Albarán", celda: (a) => `${a.albaran ?? a.numero}${a.albaranProveedor ? ` (del proveedor: ${a.albaranProveedor})` : ""}` },
                      { titulo: "Recibido", celda: (a) => fechaEs(a.recibidoEn) },
                      { titulo: "Centro", celda: (a) => a.centro },
                      { titulo: "Estado", celda: (a) => (a.estado === "RECIBIDO_PARCIAL" ? "Recibido en parte" : "Recibido") },
                      { titulo: "Sin IVA", celda: (a) => euros(a.base), alinear: "derecha" },
                    ]}
                  />
                  <p className="mt-2 text-sm text-slate-600">
                    Marcados: los {propuestos.length} del periodo, {euros(redondear(propuestos.reduce((s, a) => s + a.base, 0)))} sin IVA. Cada albarán solo puede ir en una factura. Si dejas las líneas vacías, se copian las de los albaranes marcados (cantidad recibida, precio e IVA del producto); si escribes las de la factura, la revisión las cuadra con los albaranes.
                  </p>
                </>
              )}
            </Tarjeta>
          )}
          <Tarjeta titulo="Líneas (vacías = las de los albaranes marcados)">
            <LineasFormulario categorias={d.listaCategorias} />
          </Tarjeta>
          <Tarjeta titulo="Notas">
            <AreaTexto name="notas" rows={2} />
          </Tarjeta>
          <div className="flex justify-end">
            <Boton type="submit">Registrar factura</Boton>
          </div>
        </form>
      )}
    </>
  );
}
