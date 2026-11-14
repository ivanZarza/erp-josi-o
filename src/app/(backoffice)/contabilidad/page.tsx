import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { euros, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Cifra, Rejilla, BotonEnlace, HuecoIntegracion, Vacio, Aviso } from "@/ui";
import { resumenPorSociedad, vencimientos, finDeSemanaISO, mesActual, redondear } from "@/modulos/contabilidad/servicio";
import { Avisos, Filtros, FiltroMes, param, type ParametrosBusqueda } from "./_comun";

export default async function ResumenContabilidad({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:ver");
  const sp = await searchParams;
  const mes = param(sp, "mes") ?? mesActual();
  const [resumen, venceSemana] = await Promise.all([resumenPorSociedad(ctx, mes), vencimientos(ctx, finDeSemanaISO())]);
  const pagosSemana = venceSemana.filter((v) => v.tipo === "PAGO");
  const vencidos = venceSemana.filter((v) => v.vencido);
  const total = (k: "porPagar" | "porCobrar" | "gastosMes" | "comprasMes") => redondear(resumen.reduce((s, r) => s + r[k], 0));
  const pendientesRevisar = resumen.reduce((s, r) => s + r.pendientesRevisar, 0);

  return (
    <>
      <Cabecera
        titulo="Contabilidad"
        subtitulo="Lo pendiente de pagar y cobrar, y lo gastado en el mes, por sociedad. El ERP no lleva la contabilidad oficial: la prepara para la gestoría."
        acciones={
          ctx.puede("contabilidad:facturas:editar") ? (
            <>
              <BotonEnlace href="/contabilidad/recibidas/nueva">Registrar factura recibida</BotonEnlace>
              <BotonEnlace href="/contabilidad/gastos" variante="secundario">
                Apuntar gasto
              </BotonEnlace>
            </>
          ) : undefined
        }
      />
      <Avisos sp={sp} />
      <Filtros>
        <FiltroMes valor={mes} />
      </Filtros>

      <Rejilla columnas={4}>
        <Cifra etiqueta="Pendiente de pagar" valor={euros(total("porPagar"))} detalle="Facturas sin pagar y gastos pendientes" href="/contabilidad/vencimientos" />
        <Cifra etiqueta="Vence esta semana" valor={euros(pagosSemana.reduce((s, v) => s + v.total, 0))} detalle={`${numero(pagosSemana.length)} pagos · ${numero(vencidos.length)} ya vencidos`} tono={vencidos.length ? "error" : pagosSemana.length ? "aviso" : "normal"} href="/contabilidad/vencimientos" />
        <Cifra etiqueta="Pendiente de cobrar" valor={euros(total("porCobrar"))} detalle="Facturas emitidas sin cobrar" href="/contabilidad/emitidas?estado=EMITIDA_FUERA" />
        <Cifra etiqueta="Facturas por revisar" valor={numero(pendientesRevisar)} tono={pendientesRevisar ? "aviso" : "ok"} href="/contabilidad/recibidas?estado=PENDIENTE" />
      </Rejilla>

      <div className="mt-6 space-y-4">
        {resumen.length === 0 ? (
          <Vacio>Tus centros no tienen sociedad asignada. Asigna la sociedad de cada centro en Organización para poder llevar su contabilidad.</Vacio>
        ) : (
          <Rejilla columnas={3}>
            {resumen.map((r) => (
              <Tarjeta key={r.sociedad.id} titulo={r.sociedad.razonSocial} acciones={<span className="text-xs text-slate-500">{r.sociedad.cif}</span>}>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Dato etiqueta="Pendiente de pagar" valor={euros(r.porPagar)} href={`/contabilidad/vencimientos?sociedad=${r.sociedad.id}`} />
                  <Dato etiqueta="Pendiente de cobrar" valor={euros(r.porCobrar)} href={`/contabilidad/emitidas?sociedad=${r.sociedad.id}&estado=EMITIDA_FUERA`} />
                  <Dato etiqueta="Compras del mes (sin IVA)" valor={euros(r.comprasMes)} href={`/contabilidad/recibidas?sociedad=${r.sociedad.id}&mes=${mes}`} />
                  <Dato etiqueta="Gastos del mes (sin IVA)" valor={euros(r.gastosMes)} href={`/contabilidad/gastos?sociedad=${r.sociedad.id}&mes=${mes}`} />
                </dl>
                {r.pendientesRevisar > 0 && <p className="mt-3 text-xs text-amber-700">{numero(r.pendientesRevisar)} facturas pendientes de revisar.</p>}
                {r.sociedad.cif === "PENDIENTE" && (
                  <div className="mt-3">
                    <Aviso tono="aviso">Sociedad sin CIF confirmado: revisa en Organización a qué sociedad pertenecen sus centros.</Aviso>
                  </div>
                )}
              </Tarjeta>
            ))}
          </Rejilla>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HuecoIntegracion nombre="Lectura de facturas con IA" descripcion="Subir el PDF o la foto de la factura del proveedor y que se rellenen solos proveedor, número, fecha, líneas e IVA (como en Tramidocs)" />
        <HuecoIntegracion nombre="Programa de la gestoría" descripcion="Enviar facturas, gastos y ventas a A3, Sage, Holded u Odoo (pendiente de saber cuál usa la gestoría, P-04). Hoy se exporta un CSV por sociedad y mes" />
        <HuecoIntegracion nombre="Verifactu" descripcion="El ERP no está certificado: las facturas emitidas se preparan aquí y se emiten en un programa certificado (P-23)" />
        <HuecoIntegracion nombre="Bancos" descripcion="Leer los movimientos del banco para marcar pagos y cobros y cuadrar las tarjetas de los cierres de caja" />
      </div>
    </>
  );
}

function Dato({ etiqueta, valor, href }: { etiqueta: string; valor: string; href: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 tabular-nums">
        <Link href={href} className="hover:underline">
          {valor}
        </Link>
      </dd>
    </div>
  );
}
