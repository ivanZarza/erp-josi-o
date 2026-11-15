import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, Campo, Entrada, Cifra, Rejilla, Etiqueta, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { vencimientos, sociedadesVisibles, diccionarios, finDeSemanaISO, hoyISO, redondear } from "@/modulos/contabilidad/servicio";
import { accionPagarFacturaRecibida, accionPagarGasto, accionCobrarFacturaEmitida, accionValidarFacturaRecibida } from "@/modulos/contabilidad/acciones";
import { Avisos, Filtros, FiltroSociedad, FormularioPago, BotonAccion, param, type ParametrosBusqueda } from "../_comun";

const ORIGEN = { "factura-recibida": "Factura recibida", gasto: "Gasto", "factura-emitida": "Factura emitida" } as const;

export default async function Vencimientos({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:ver");
  const sp = await searchParams;
  const hasta = param(sp, "hasta") ?? finDeSemanaISO();
  const sociedadId = param(sp, "sociedad");
  const [lista, sociedades, d] = await Promise.all([vencimientos(ctx, hasta, sociedadId), sociedadesVisibles(ctx), diccionarios(ctx)]);
  const hoy = hoyISO();
  const puedeFacturas = ctx.puede("contabilidad:facturas:editar");
  const puedeGastos = ctx.puede("contabilidad:gastos:editar");
  const volver = `/contabilidad/vencimientos?${new URLSearchParams({ hasta, ...(sociedadId ? { sociedad: sociedadId } : {}) }).toString()}`;
  const pagos = lista.filter((v) => v.tipo === "PAGO");
  const cobros = lista.filter((v) => v.tipo === "COBRO");
  const pagosVencidos = pagos.filter((v) => v.vencido);
  const cobrosVencidos = cobros.filter((v) => v.vencido);
  const suma = (l: typeof lista) => redondear(l.reduce((s, v) => s + v.total, 0));

  return (
    <>
      <Cabecera titulo="Vencimientos" subtitulo={`Pagos y cobros pendientes que vencen hasta el ${fecha(hasta)} (incluye lo ya vencido y lo que no tiene fecha).`} />
      <Avisos sp={sp} />
      <Filtros>
        <FiltroSociedad sociedades={sociedades} valor={sociedadId} />
        <div>
          <Campo etiqueta="Vence hasta">
            <Entrada type="date" name="hasta" defaultValue={hasta} />
          </Campo>
        </div>
      </Filtros>
      <div className="mb-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="A pagar" valor={euros(suma(pagos))} detalle={`${numero(pagos.length)} pagos`} />
          <Cifra etiqueta="Pagos ya vencidos" valor={euros(suma(pagosVencidos))} detalle={`${numero(pagosVencidos.length)} pagos`} tono={pagosVencidos.length ? "error" : "ok"} />
          <Cifra etiqueta="A cobrar" valor={euros(suma(cobros))} detalle={`${numero(cobros.length)} cobros`} />
          <Cifra etiqueta="Cobros ya vencidos" valor={euros(suma(cobrosVencidos))} detalle={`${numero(cobrosVencidos.length)} cobros`} tono={cobrosVencidos.length ? "aviso" : "ok"} />
        </Rejilla>
      </div>
      <TablaDesplegable
        vacio="No vence nada en estas fechas."
        columnas={[{ titulo: "Vence" }, { titulo: "Tipo" }, { titulo: "Tercero" }, { titulo: "Documento", secundaria: true }, { titulo: "Sociedad", secundaria: true }, { titulo: "Importe", alinear: "derecha" }]}
        filas={lista.map((v) => ({
          id: `${v.origen}-${v.id}`,
          // rojo: pago vencido (hay que pagar ya); naranja: cobro vencido (hay que reclamarlo)
          tono: v.vencido ? (v.tipo === "PAGO" ? ("error" as const) : ("aviso" as const)) : undefined,
          celdas: [
            v.vencimiento ? fecha(v.vencimiento) : "Sin fecha",
            <Etiqueta key="t" tono={v.tipo === "PAGO" ? "aviso" : "info"}>
              {v.tipo === "PAGO" ? "Pago" : "Cobro"}
            </Etiqueta>,
            v.tercero,
            v.documento,
            d.sociedades.get(v.sociedadId)?.razonSocial ?? "—",
            euros(v.total),
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Origen", valor: ORIGEN[v.origen] },
                  { etiqueta: "Centro", valor: v.centroId ? (d.centros.get(v.centroId)?.nombre ?? "—") : "De la sociedad" },
                  { etiqueta: "Estado", valor: v.estado === "PENDIENTE" && v.origen === "factura-recibida" ? "Pendiente de revisar" : v.estado === "VALIDADA" ? "Validada" : v.estado === "EMITIDA_FUERA" ? "Emitida, sin cobrar" : "Pendiente" },
                  { etiqueta: "Vencido", valor: v.vencido ? "Sí" : "No" },
                ]}
              />
              <div className="flex flex-wrap items-end gap-3">
                {v.origen === "factura-recibida" && puedeFacturas && v.estado === "PENDIENTE" && <BotonAccion accion={accionValidarFacturaRecibida} id={v.id} volver={volver} texto="Validar factura" variante="principal" />}
                {v.origen === "factura-recibida" && puedeFacturas && v.estado === "VALIDADA" && <FormularioPago accion={accionPagarFacturaRecibida} id={v.id} volver={volver} hoy={hoy} total={v.total} texto="Marcar pagada" />}
                {v.origen === "gasto" && puedeGastos && <FormularioPago accion={accionPagarGasto} id={v.id} volver={volver} hoy={hoy} total={v.total} texto="Marcar pagado" />}
                {v.origen === "factura-emitida" && puedeFacturas && <FormularioPago accion={accionCobrarFacturaEmitida} id={v.id} volver={volver} hoy={hoy} total={v.total} texto="Marcar cobrada" />}
              </div>
            </div>
          ),
        }))}
      />
      <div className="mt-4">
        <HuecoIntegracion nombre="Bancos" descripcion="Leer los movimientos del banco para dar por pagados o cobrados los vencimientos sin hacerlo a mano" />
      </div>
    </>
  );
}
