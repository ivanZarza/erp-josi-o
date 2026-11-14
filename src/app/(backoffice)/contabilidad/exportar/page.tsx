import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, Boton, HuecoIntegracion, Aviso, Vacio } from "@/ui";
import { sociedadesVisibles, mesActual } from "@/modulos/contabilidad/servicio";
import { Avisos, type ParametrosBusqueda } from "../_comun";

export default async function Exportar({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:exportar");
  const sp = await searchParams;
  const sociedades = await sociedadesVisibles(ctx);
  return (
    <>
      <Cabecera titulo="Exportar a la gestoría" subtitulo="Un archivo CSV por sociedad y mes con facturas recibidas, gastos, facturas emitidas y ventas diarias." />
      <Avisos sp={sp} />
      <div className="mb-4">
        <HuecoIntegracion nombre="Programa de la gestoría" descripcion="Envío directo a A3, Sage, Holded u Odoo cuando se sepa qué programa usa la gestoría (P-04)" />
      </div>
      {sociedades.length === 0 ? (
        <Vacio>Tus centros no tienen sociedad asignada.</Vacio>
      ) : (
        <Tarjeta titulo="Descargar">
          <form method="get" action="/contabilidad/exportar/csv" className="flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <Campo etiqueta="Sociedad">
                <Selector name="sociedad" required defaultValue={sociedades[0].id}>
                  {sociedades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial} ({s.cif})
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
            <Campo etiqueta="Mes">
              <Entrada type="month" name="mes" required defaultValue={mesActual()} />
            </Campo>
            <Boton type="submit">Descargar CSV</Boton>
          </form>
          <div className="mt-4">
            <Aviso>
              Separado por punto y coma, con coma decimal y fechas dd/mm/aaaa (se abre bien en Excel en español). Las facturas recibidas salen en una fila por tipo de IVA. Las ventas diarias solo salen si Caja y
              ventas está contratado. No incluye anuladas ni facturas emitidas sin número oficial.
            </Aviso>
          </div>
        </Tarjeta>
      )}
    </>
  );
}
