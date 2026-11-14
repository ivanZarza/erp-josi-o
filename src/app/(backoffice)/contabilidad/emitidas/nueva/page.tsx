import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, BotonEnlace, Aviso, Vacio } from "@/ui";
import { sociedadesVisibles, diccionarios, hoyISO } from "@/modulos/contabilidad/servicio";
import { accionCrearFacturaEmitida } from "@/modulos/contabilidad/acciones";
import { Avisos, LineasFormulario, type ParametrosBusqueda } from "../../_comun";

export default async function PrepararFacturaEmitida({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:facturas:editar");
  const sp = await searchParams;
  const [sociedades, d] = await Promise.all([sociedadesVisibles(ctx), diccionarios(ctx)]);
  const todasSociedades = Array.from(d.sociedades.values());

  return (
    <>
      <Cabecera titulo="Preparar factura emitida" subtitulo="Se guardan los datos para emitirla después en un programa certificado." acciones={<BotonEnlace href="/contabilidad/emitidas" variante="secundario">Volver</BotonEnlace>} />
      <Avisos sp={sp} />
      <div className="mb-4">
        <Aviso tono="aviso" titulo="No es una factura oficial">
          El ERP no está certificado para Verifactu. Esto genera un borrador con referencia «PRE-…»; la factura con validez se emite en el programa certificado.
        </Aviso>
      </div>
      {sociedades.length === 0 ? (
        <Vacio>Tus centros no tienen sociedad asignada.</Vacio>
      ) : (
        <form action={accionCrearFacturaEmitida} className="space-y-4">
          <Tarjeta titulo="Datos">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Sociedad que factura">
                <Selector name="sociedadId" required defaultValue={sociedades.length === 1 ? sociedades[0].id : ""}>
                  <option value="">Elige…</option>
                  {sociedades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Centro (opcional)">
                <Selector name="centroId" defaultValue={ctx.centroActivo?.id ?? ""}>
                  <option value="">Sin centro</option>
                  {ctx.centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Tipo">
                <Selector name="origen" defaultValue="EVENTO">
                  <option value="EVENTO">Evento</option>
                  <option value="CATERING">Catering</option>
                  <option value="ENTRE_SOCIEDADES">Entre sociedades del grupo</option>
                  <option value="OTRO">Otro</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Sociedad del grupo que recibe" ayuda="Solo si es entre sociedades">
                <Selector name="sociedadDestinoId" defaultValue="">
                  <option value="">—</option>
                  {todasSociedades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Cliente">
                <Entrada name="clienteNombre" required />
              </Campo>
              <Campo etiqueta="CIF / NIF del cliente">
                <Entrada name="clienteCif" />
              </Campo>
              <Campo etiqueta="Fecha">
                <Entrada type="date" name="fecha" required defaultValue={hoyISO()} />
              </Campo>
              <Campo etiqueta="Vencimiento">
                <Entrada type="date" name="vencimiento" />
              </Campo>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Líneas">
            <LineasFormulario />
          </Tarjeta>
          <Tarjeta titulo="Notas">
            <AreaTexto name="notas" rows={2} />
          </Tarjeta>
          <div className="flex justify-end">
            <Boton type="submit">Preparar factura</Boton>
          </div>
        </form>
      )}
    </>
  );
}
