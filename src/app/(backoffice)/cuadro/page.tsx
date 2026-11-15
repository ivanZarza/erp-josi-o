import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Pestanas, Aviso, Campo, Entrada, Boton, BotonEnlace } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { indicadoresMes, cifrasDelDia, resultado, sobreVentas, mesValido, nombreMes, mesDesplazado, hoyISO, aFecha, criterioMercancia, criterioPersonal, TEXTO_CRITERIO, TEXTO_CRITERIO_PERSONAL, type Vista, type FilaCuadro } from "@/modulos/cuadro/servicio";
import { Avisos, Importe, Pct, Desviacion, param, type ParametrosBusqueda } from "./_comun";

export default async function CuadroDeMando({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("cuadro", "cuadro:ver");
  const sp = await searchParams;
  const mes = mesValido(param(sp, "mes"));
  const vistaParam = param(sp, "vista");
  const vista: Vista = vistaParam === "marca" || vistaParam === "sociedad" ? vistaParam : "centro";
  const ayer = new Date(aFecha(hoyISO()).getTime() - 86400000).toISOString().slice(0, 10);
  const [{ filas, total, fuentes, presupuestoAFecha, hastaDia }, deAyer] = await Promise.all([indicadoresMes(ctx, mes, vista), cifrasDelDia(ctx, ayer)]);
  const res = resultado(total.cifras);
  const criterio = criterioMercancia(total.cifras);
  const criterioPers = criterioPersonal(total.cifras);
  const faltan = Object.entries(fuentes).filter(([, f]) => !f.hay);

  // enlace al detalle: solo tiene sentido por centro
  const enlace = (f: FilaCuadro, indicador: string) => (f.centroIds.length === 1 ? `/cuadro/detalle?indicador=${indicador}&centro=${f.centroIds[0]}&mes=${mes}` : undefined);

  return (
    <>
      <Cabecera
        titulo="Cuadro de mando"
        subtitulo={`${nombreMes(mes)}${hastaDia ? ` hasta ayer (${fecha(hastaDia)}): hoy aún no ha terminado` : ""} · ${ctx.centroActivo ? ctx.centroActivo.nombre : `${numero(total.centroIds.length)} centros`}. Cada cifra enlaza a su detalle.`}
        acciones={
          <>
            <BotonEnlace variante="secundario" href={`/cuadro?mes=${mesDesplazado(mes, -1)}&vista=${vista}`}>
              Mes anterior
            </BotonEnlace>
            <BotonEnlace variante="secundario" href={`/cuadro?mes=${mesDesplazado(mes, 1)}&vista=${vista}`}>
              Mes siguiente
            </BotonEnlace>
          </>
        }
      />
      <Avisos sp={sp} />
      {faltan.length > 0 && (
        <div className="mb-4">
          <Aviso tono="info" titulo="Cifras sin datos">
            {faltan.map(([k, f]) => `${k === "ventas" ? "Ventas" : k === "mercancia" ? "Mercancía" : k === "gastos" ? "Gastos" : "Personal"}: ${f.motivo}`).join(". ")}. Se muestran como «sin datos», nunca como cero.
          </Aviso>
        </div>
      )}

      <Rejilla columnas={4}>
        <Cifra
          etiqueta={`Ventas de ayer (${fecha(ayer)})`}
          valor={deAyer.ventas === null ? "Sin datos" : euros(deAyer.ventas)}
          detalle={deAyer.comensales ? `${numero(deAyer.comensales)} comensales · ticket medio ${deAyer.tickets ? euros((deAyer.ventas ?? 0) / deAyer.tickets) : "—"}` : fuentes.ventas.motivo}
          href={ctx.tieneModulo("caja") ? "/caja" : undefined}
        />
        <Cifra
          etiqueta="Ventas del mes"
          valor={total.cifras.ventas === null ? "Sin datos" : euros(total.cifras.ventas)}
          detalle={total.presupuesto ? <>Presupuesto{presupuestoAFecha ? " a fecha" : ""} {euros(total.presupuesto.ventas)} · <Desviacion real={total.cifras.ventas} previsto={total.presupuesto.ventas} /></> : "Sin presupuesto"}
          tono={total.presupuesto && total.cifras.ventas !== null ? (total.cifras.ventas >= total.presupuesto.ventas ? "ok" : "aviso") : "normal"}
          href={`/cuadro/presupuestos?mes=${mes}`}
        />
        <Cifra
          etiqueta="Mercancía sobre ventas"
          valor={<Pct valor={sobreVentas(total.cifras.mercancia, total.cifras.ventas)} />}
          detalle={total.cifras.mercancia === null ? fuentes.mercancia.motivo : `${euros(total.cifras.mercancia)} · ${criterio ? TEXTO_CRITERIO[criterio] : "sin movimientos"}`}
        />
        <Cifra
          etiqueta="Resultado de gestión"
          valor={res.valor === null ? "Sin datos" : euros(res.valor)}
          detalle={res.faltan.length ? `Sin ${res.faltan.join(", ")}: resultado incompleto` : "Ventas − mercancía − personal − gastos"}
          tono={res.valor === null ? "normal" : res.valor >= 0 ? "ok" : "error"}
        />
      </Rejilla>

      <div className="mt-6">
        <Pestanas
          activa={`/cuadro?mes=${mes}&vista=${vista}`}
          items={[
            { href: `/cuadro?mes=${mes}&vista=centro`, titulo: "Por centro" },
            { href: `/cuadro?mes=${mes}&vista=marca`, titulo: "Por marca" },
            { href: `/cuadro?mes=${mes}&vista=sociedad`, titulo: "Por sociedad" },
          ]}
        />
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="vista" value={vista} />
          <Campo etiqueta="Mes">
            <Entrada type="month" name="mes" defaultValue={mes} />
          </Campo>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
        <TablaDesplegable
          total={`${numero(filas.length)} filas · total ventas ${total.cifras.ventas === null ? "sin datos" : euros(total.cifras.ventas)}`}
          vacio="No hay centros en tu selección."
          columnas={[
            { titulo: vista === "centro" ? "Centro" : vista === "marca" ? "Marca" : "Sociedad" },
            { titulo: "Ventas", alinear: "derecha" },
            { titulo: "Vs. presupuesto", alinear: "derecha" },
            { titulo: "Mercancía", alinear: "derecha", secundaria: true },
            { titulo: "% merc.", alinear: "derecha", secundaria: true },
            { titulo: "Personal", alinear: "derecha", secundaria: true },
            { titulo: "Gastos", alinear: "derecha", secundaria: true },
            { titulo: "Resultado", alinear: "derecha" },
          ]}
          filas={[...filas, total].map((f) => {
            const r = resultado(f.cifras);
            const esTotal = f.clave === "total";
            return {
              id: f.clave,
              tono: r.valor !== null && r.valor < 0 ? ("aviso" as const) : undefined,
              celdas: [
                esTotal ? <strong key="n">Total</strong> : f.nombre,
                <Importe key="v" valor={f.cifras.ventas} href={enlace(f, "ventas")} motivo={fuentes.ventas.motivo} />,
                <Desviacion key="d" real={f.cifras.ventas} previsto={f.presupuesto?.ventas} />,
                <Importe key="m" valor={f.cifras.mercancia} href={enlace(f, "mercancia")} motivo={fuentes.mercancia.motivo} />,
                <Pct key="pm" valor={sobreVentas(f.cifras.mercancia, f.cifras.ventas)} />,
                <Importe key="p" valor={f.cifras.personal} href={enlace(f, "personal")} motivo={fuentes.personal.motivo} />,
                <Importe key="g" valor={f.cifras.gastos} href={enlace(f, "gastos") ?? (f.sociedadId && ctx.tieneModulo("contabilidad") ? `/contabilidad/gastos?sociedad=${f.sociedadId}&mes=${mes}` : undefined)} motivo={fuentes.gastos.motivo} />,
                <span key="r" title={r.faltan.length ? `Sin ${r.faltan.join(", ")}` : undefined}>
                  {r.valor === null ? "—" : euros(r.valor)}
                  {r.faltan.length > 0 && r.valor !== null ? "*" : ""}
                </span>,
              ],
              detalle: (
                <div className="space-y-3">
                  <DatosDetalle
                    datos={[
                      { etiqueta: "Detalle", valor: f.detalle || "—" },
                      { etiqueta: "Mercancía según", valor: criterioMercancia(f.cifras) ? TEXTO_CRITERIO[criterioMercancia(f.cifras)!] : "—" },
                      { etiqueta: "Comensales", valor: f.cifras.comensales === null ? "sin datos" : numero(f.cifras.comensales) },
                      { etiqueta: "Tickets", valor: f.cifras.tickets === null ? "sin datos" : numero(f.cifras.tickets) },
                      { etiqueta: "Ticket medio", valor: f.cifras.tickets && f.cifras.ventas !== null ? euros(f.cifras.ventas / f.cifras.tickets) : "—" },
                      { etiqueta: "Venta por comensal", valor: f.cifras.comensales && f.cifras.ventas !== null ? euros(f.cifras.ventas / f.cifras.comensales) : "—" },
                      { etiqueta: "Personal", valor: <Importe valor={f.cifras.personal} href={enlace(f, "personal")} motivo={fuentes.personal.motivo} /> },
                      { etiqueta: "Personal según", valor: criterioPersonal(f.cifras) ? TEXTO_CRITERIO_PERSONAL[criterioPersonal(f.cifras)!] : f.cifras.personal === null ? "sin datos" : "—" },
                      { etiqueta: "Horas de personal", valor: f.cifras.horasPersonal ? `${numero(f.cifras.horasPersonal)} h` : "—" },
                      { etiqueta: "% personal", valor: <Pct valor={sobreVentas(f.cifras.personal, f.cifras.ventas)} /> },
                      { etiqueta: "% gastos", valor: <Pct valor={sobreVentas(f.cifras.gastos, f.cifras.ventas)} /> },
                      { etiqueta: "Presupuesto de ventas", valor: f.presupuesto ? euros(f.presupuesto.ventas) : "Sin presupuesto" },
                      { etiqueta: "Presupuesto de mercancía", valor: f.presupuesto?.mercancia != null ? <>{euros(f.presupuesto.mercancia)} · <Desviacion real={f.cifras.mercancia} previsto={f.presupuesto.mercancia} masEsMejor={false} /></> : "—" },
                      { etiqueta: "Presupuesto de personal", valor: f.presupuesto?.personal != null ? <>{euros(f.presupuesto.personal)} · <Desviacion real={f.cifras.personal} previsto={f.presupuesto.personal} masEsMejor={false} /></> : "—" },
                      { etiqueta: "Presupuesto de gastos", valor: f.presupuesto?.gastos != null ? <>{euros(f.presupuesto.gastos)} · <Desviacion real={f.cifras.gastos} previsto={f.presupuesto.gastos} masEsMejor={false} /></> : "—" },
                    ]}
                  />
                  {r.faltan.length > 0 && r.valor !== null && <p className="text-xs text-slate-500">* Resultado incompleto: sin {r.faltan.join(", ")}.</p>}
                  {f.centroIds.length > 1 && (
                    <p className="text-xs text-slate-500">
                      Para ver de dónde sale cada cifra, abre la vista <Link className="underline" href={`/cuadro?mes=${mes}&vista=centro`}>por centro</Link>.
                    </p>
                  )}
                </div>
              ),
            };
          })}
        />
        <p className="mt-3 text-xs text-slate-500">
          Ventas sin IVA. Mercancía: en los locales con tickets de Caja, el coste teórico de lo vendido (cada línea × su escandallo, desde el primer día con tickets), que no depende de cuándo se compra; en el resto, compras recibidas + lo recibido de otros centros − lo servido a otros centros (así el obrador no cuenta dos veces). Personal: {fuentes.personal.motivo.charAt(0).toLowerCase() + fuentes.personal.motivo.slice(1)}
          {criterioPers ? ` (este mes: ${TEXTO_CRITERIO_PERSONAL[criterioPers]})` : ""}. Gastos = gastos de Contabilidad y líneas de facturas de categorías de gasto, sin IVA; lo de la sociedad sin centro va en su propia fila. El mes en curso llega hasta ayer y el presupuesto se compara «a fecha» (hasta ayer).
        </p>
      </div>
    </>
  );
}
