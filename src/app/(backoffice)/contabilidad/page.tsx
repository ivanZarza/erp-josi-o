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
  // la cifra es de pagos: «ya vencidos» y el rojo solo cuentan pagos (los cobros vencidos van aparte)
  const pagosVencidos = pagosSemana.filter((v) => v.vencido);
  const cobrosVencidos = venceSemana.filter((v) => v.tipo === "COBRO" && v.vencido);
  const total = (k: "porPagar" | "porCobrar" | "gastosMes" | "comprasMes") => redondear(resumen.reduce((s, r) => s + r[k], 0));
  const pendientesRevisar = resumen.reduce((s, r) => s + r.pendientesRevisar, 0);

  return (
    <>
      <Cabecera
        titulo="Contabilidad"
        subtitulo="Lo pendiente de pagar y cobrar, y lo gastado en el mes, por sociedad. El ERP no lleva la contabilidad oficial: la prepara para la gestoría."
        acciones={
          ctx.puede("contabilidad:facturas:editar") || ctx.puede("contabilidad:gastos:editar") ? (
            <>
              {ctx.puede("contabilidad:facturas:editar") && <BotonEnlace href="/contabilidad/recibidas/nueva">Registrar factura recibida</BotonEnlace>}
              {ctx.puede("contabilidad:gastos:editar") && (
                <BotonEnlace href="/contabilidad/gastos" variante="secundario">
                  Apuntar gasto
                </BotonEnlace>
              )}
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
        <Cifra etiqueta="Pagos que vencen esta semana" valor={euros(pagosSemana.reduce((s, v) => s + v.total, 0))} detalle={`${numero(pagosSemana.length)} pagos · ${numero(pagosVencidos.length)} ya vencidos`} tono={pagosVencidos.length ? "error" : pagosSemana.length ? "aviso" : "normal"} href="/contabilidad/vencimientos" />
        <Cifra
          etiqueta="Pendiente de cobrar"
          valor={euros(total("porCobrar"))}
          detalle={cobrosVencidos.length ? `Facturas emitidas sin cobrar · ${numero(cobrosVencidos.length)} cobros ya vencidos` : "Facturas emitidas sin cobrar"}
          tono={cobrosVencidos.length ? "aviso" : "normal"}
          href="/contabilidad/emitidas?estado=EMITIDA_FUERA"
        />
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
                {r.nominas && (r.nominas.costeEmpresa > 0 || r.nominas.apuntado > 0) && (
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                    <Dato
                      etiqueta="Nóminas del mes (Personal)"
                      valor={`${euros(r.nominas.costeEmpresa)}${r.nominas.borradores ? ` · ${numero(r.nominas.borradores)} en borrador` : ""}`}
                      href={ctx.puede("personal:nominas:ver") ? `/personal/nominas?mes=${mes}` : undefined}
                    />
                    <Dato etiqueta="Personal apuntado aquí (sin IVA)" valor={euros(r.nominas.apuntado)} href={`/contabilidad/gastos?sociedad=${r.sociedad.id}&mes=${mes}`} />
                  </dl>
                )}
                {r.nominas && r.nominas.costeEmpresa > 0 && r.nominas.apuntado === 0 && <p className="mt-2 text-xs text-slate-500">Las nóminas de este mes aún no están apuntadas en Contabilidad (lo hace la gestoría).</p>}
                {r.nominas && r.nominas.costeEmpresa > 0 && r.nominas.apuntado > 0 && Math.abs(r.nominas.apuntado - r.nominas.costeEmpresa) > Math.max(1, r.nominas.costeEmpresa * 0.01) && (
                  <p className="mt-2 text-xs text-amber-700">
                    Lo apuntado como personal ({euros(r.nominas.apuntado)}) no cuadra con el coste empresa de las nóminas de Personal ({euros(r.nominas.costeEmpresa)}): revísalo con la gestoría.
                  </p>
                )}
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

function Dato({ etiqueta, valor, href }: { etiqueta: string; valor: string; href?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 tabular-nums">
        {href ? (
          <Link href={href} className="hover:underline">
            {valor}
          </Link>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}
