import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, BotonEnlace, HuecoIntegracion, Vacio } from "@/ui";
import { sociedadesVisibles, diccionarios, hoyISO, albaranesSinFactura } from "@/modulos/contabilidad/servicio";
import { accionCrearFacturaRecibida } from "@/modulos/contabilidad/acciones";
import { Avisos, LineasFormulario, type ParametrosBusqueda } from "../../_comun";

export default async function NuevaFacturaRecibida({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  const sp = await searchParams;
  const [sociedades, d, albaranes] = await Promise.all([sociedadesVisibles(ctx), diccionarios(ctx), albaranesSinFactura(ctx)]);
  const centros = ctx.centros.map((c) => ({ ...c, sociedadId: d.centros.get(c.id)?.sociedadId ?? null }));

  return (
    <>
      <Cabecera titulo="Registrar factura recibida" subtitulo="Alta a mano de una factura de proveedor. Queda «pendiente de revisar» hasta que alguien la valide." acciones={<BotonEnlace href="/contabilidad/recibidas" variante="secundario">Volver</BotonEnlace>} />
      <Avisos sp={sp} />
      <div className="mb-4">
        <HuecoIntegracion nombre="Lectura de facturas con IA" descripcion="Aquí se podrá subir el PDF o la foto y la IA rellenará este formulario para revisarlo" />
      </div>
      {sociedades.length === 0 ? (
        <Vacio>Tus centros no tienen sociedad asignada: asígnala en Organización antes de registrar facturas.</Vacio>
      ) : (
        <form action={accionCrearFacturaRecibida} className="space-y-4">
          <Tarjeta titulo="Datos de la factura">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Sociedad que la recibe">
                <Selector name="sociedadId" required defaultValue={sociedades.length === 1 ? sociedades[0].id : ""}>
                  <option value="">Elige…</option>
                  {sociedades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial} ({s.cif})
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Centro (opcional)" ayuda="Debe ser de la sociedad elegida. Vacío = gasto general de la sociedad.">
                <Selector name="centroId" defaultValue={ctx.centroActivo?.id ?? ""}>
                  <option value="">Sin centro</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Proveedor dado de alta">
                <Selector name="proveedorId" defaultValue="">
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
                <Entrada type="date" name="fecha" required defaultValue={hoyISO()} />
              </Campo>
              <Campo etiqueta="Vencimiento">
                <Entrada type="date" name="vencimiento" />
              </Campo>
              <Campo etiqueta="Albarán que factura (opcional)" ayuda="Compra recibida en los últimos 90 días que aún no está enlazada a ninguna factura. Si dejas las líneas vacías, se copian las del albarán con su producto.">
                <Selector name="pedidoCompraId" defaultValue="">
                  <option value="">Sin albarán</option>
                  {albaranes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.texto}
                    </option>
                  ))}
                </Selector>
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
          <Tarjeta titulo="Líneas (vacías = las del albarán elegido)">
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
