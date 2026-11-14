import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, Cifra, Rejilla, Etiqueta, Vacio, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarCierres, centrosCaja, hoyISO, sumarDias, nombresUsuarios, arqueo } from "@/modulos/caja/servicio";
import { accionCrearCierre, accionValidarCierre, accionAbrirCaja, accionMovimientoCaja } from "@/modulos/caja/acciones";
import { NOMBRE_MOVIMIENTO_CAJA } from "@/modulos/caja/esquemas";
import { Avisos, param, type ParametrosBusqueda } from "../_comun";

const ESTADO = {
  PENDIENTE: { texto: "Pendiente de validar", tono: "aviso" as const },
  VALIDADO: { texto: "Validado", tono: "ok" as const },
  RECHAZADO: { texto: "Rechazado: revisar", tono: "error" as const },
};

export default async function Cierres({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("caja", "caja:cierres:ver");
  const sp = await searchParams;
  const hoy = hoyISO();
  const estado = param(sp, "estado");
  const desde = param(sp, "desde") ?? sumarDias(hoy, -30);
  const centros = centrosCaja(ctx);
  const cierres = await listarCierres(ctx, { estado, desde });
  const usuarios = await nombresUsuarios(ctx, cierres.flatMap((c) => [c.cerradoPor, c.validadoPor]));
  const nombre = new Map(centros.map((c) => [c.id, c.nombre]));
  const puedeCrear = ctx.puede("caja:cierres:crear");
  const puedeValidar = ctx.puede("caja:cierres:validar");
  const centroDia = param(sp, "centro") ?? ctx.centroActivo?.id ?? (centros.length === 1 ? centros[0].id : "");
  const dia = param(sp, "dia") ?? hoy;
  const volver = `/caja/cierres?${new URLSearchParams({ desde, dia, ...(centroDia ? { centro: centroDia } : {}), ...(estado ? { estado } : {}) }).toString()}`;
  const caja = centros.some((c) => c.id === centroDia) ? await arqueo(ctx, centroDia, dia) : null;
  const pendientes = cierres.filter((c) => c.estado === "PENDIENTE").length;
  const conDescuadre = cierres.filter((c) => Number(c.descuadre) !== 0);
  const descuadreTotal = conDescuadre.reduce((s, c) => s + Number(c.descuadre), 0);

  if (centros.length === 0)
    return (
      <>
        <Cabecera titulo="Cierres de caja" />
        <Vacio>No hay locales con Caja y ventas en tu selección.</Vacio>
      </>
    );

  return (
    <>
      <Cabecera titulo="Apertura y cierres de caja" subtitulo="Se abre la caja con el fondo inicial, se apuntan retiradas y pagos con dinero de caja y al cerrar se cuenta el efectivo; finanzas lo valida. Todo descuadre lleva su motivo." />
      <Avisos sp={sp} />
      <Rejilla columnas={3}>
        <Cifra etiqueta="Pendientes de validar" valor={numero(pendientes)} tono={pendientes ? "aviso" : "ok"} href="/caja/cierres?estado=PENDIENTE" />
        <Cifra etiqueta="Cierres con descuadre" valor={numero(conDescuadre.length)} detalle={`de ${numero(cierres.length)} en la lista`} tono={conDescuadre.length ? "aviso" : "ok"} />
        <Cifra etiqueta="Descuadre acumulado" valor={euros(descuadreTotal)} tono={descuadreTotal < 0 ? "error" : "normal"} />
      </Rejilla>

      <Tarjeta titulo="Caja del día: apertura, retiradas y pagos" className="mt-4">
        <form method="get" className="mb-3 flex flex-wrap items-end gap-3">
          {centros.length > 1 && (
            <Campo etiqueta="Local">
              <Selector name="centro" defaultValue={centroDia}>
                <option value="">Elige…</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Campo etiqueta="Día de negocio">
            <Entrada type="date" name="dia" defaultValue={dia} max={hoy} />
          </Campo>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
        {!caja ? (
          <p className="text-sm text-slate-500">Elige un local para ver su caja del día.</p>
        ) : (
          <div className="space-y-4">
            <DatosDetalle
              datos={[
                { etiqueta: "Fondo inicial (apertura)", valor: caja.apertura ? `${euros(caja.fondoInicial)} · ${fechaHora(caja.apertura.abiertaEn)}` : "Sin abrir" },
                { etiqueta: "Cobros en efectivo", valor: caja.efectivoVentas === null ? "Sin ventas" : euros(caja.efectivoVentas) },
                { etiqueta: "Entradas de cambio", valor: euros(caja.entradasCaja) },
                { etiqueta: "Retiradas", valor: euros(-caja.retiradas) },
                { etiqueta: "Pagos con dinero de caja", valor: euros(-caja.pagosCaja) },
                { etiqueta: "Efectivo que debería haber", valor: caja.efectivoTeorico === null ? "—" : <strong>{euros(caja.efectivoTeorico)}</strong> },
                { etiqueta: "Tarjeta que liquidará el banco", valor: caja.tarjetaTeorico === null ? "—" : `${euros(caja.tarjetaTeorico)} (con ${euros(caja.propinasTarjeta)} de propinas)` },
                { etiqueta: "Propinas en efectivo (al bote)", valor: euros(caja.propinasEfectivo) },
              ]}
            />
            {caja.apertura && caja.apertura.movimientos.length > 0 && (
              <ul className="space-y-1 text-sm">
                {caja.apertura.movimientos.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 border-t border-slate-100 pt-1">
                    <span>
                      {fechaHora(m.momento)} · {NOMBRE_MOVIMIENTO_CAJA[m.tipo]}: {m.concepto}
                    </span>
                    <span className="tabular-nums">{euros(m.tipo === "ENTRADA" ? m.importe : -Number(m.importe))}</span>
                  </li>
                ))}
              </ul>
            )}
            {puedeCrear && (
              <div className="grid gap-4 lg:grid-cols-2">
                <form action={accionAbrirCaja} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
                  <input type="hidden" name="volver" value={volver} />
                  <input type="hidden" name="centroId" value={centroDia} />
                  <input type="hidden" name="fecha" value={dia} />
                  <Campo etiqueta={caja.apertura ? "Corregir el fondo inicial" : "Abrir la caja con un fondo de"}>
                    <Entrada name="fondoInicial" required inputMode="decimal" className="w-32 text-right" defaultValue={caja.apertura ? String(Number(caja.apertura.fondoInicial)).replace(".", ",") : "300"} />
                  </Campo>
                  <Boton type="submit" variante="secundario">
                    {caja.apertura ? "Corregir" : "Abrir caja"}
                  </Boton>
                </form>
                {caja.apertura && (
                  <form action={accionMovimientoCaja} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
                    <input type="hidden" name="volver" value={volver} />
                    <input type="hidden" name="centroId" value={centroDia} />
                    <input type="hidden" name="fecha" value={dia} />
                    <Campo etiqueta="Tipo">
                      <Selector name="tipo" defaultValue="RETIRADA">
                        {Object.entries(NOMBRE_MOVIMIENTO_CAJA).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Selector>
                    </Campo>
                    <Campo etiqueta="Importe">
                      <Entrada name="importe" required inputMode="decimal" className="w-24 text-right" />
                    </Campo>
                    <Campo etiqueta="Concepto">
                      <Entrada name="concepto" required placeholder="A caja fuerte, repartidor de hielo…" />
                    </Campo>
                    <Boton type="submit" variante="secundario">
                      Apuntar
                    </Boton>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {puedeCrear && (
        <Tarjeta titulo="Hacer cierre de caja" className="mt-4">
          <form action={accionCrearCierre} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <input type="hidden" name="volver" value={volver} />
            <Campo etiqueta="Local">
              <Selector name="centroId" required defaultValue={ctx.centroActivo?.id ?? (centros.length === 1 ? centros[0].id : "")}>
                <option value="">Elige…</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Día de negocio">
              <Entrada type="date" name="fecha" required defaultValue={param(sp, "dia") ?? sumarDias(hoy, -1)} max={hoy} />
            </Campo>
            <Campo etiqueta="Efectivo contado">
              <Entrada name="efectivoContado" required inputMode="decimal" className="text-right" />
            </Campo>
            <Campo etiqueta="Efectivo teórico" ayuda="Vacío = fondo inicial + efectivo de las ventas − retiradas − pagos">
              <Entrada name="efectivoTeorico" inputMode="decimal" className="text-right" />
            </Campo>
            <Campo etiqueta="Tarjeta según el banco" ayuda="Opcional (incluye las propinas con tarjeta)">
              <Entrada name="tarjetaBanco" inputMode="decimal" className="text-right" />
            </Campo>
            <Campo etiqueta="Fondo de caja que se deja">
              <Entrada name="fondoCaja" inputMode="decimal" className="text-right" />
            </Campo>
            <div className="col-span-2 sm:col-span-3 lg:col-span-5">
              <Campo etiqueta="Motivo del descuadre" ayuda="Obligatorio si lo contado no cuadra">
                <AreaTexto name="motivo" rows={1} />
              </Campo>
            </div>
            <div className="self-end">
              <Boton type="submit">Guardar cierre</Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      <form method="get" className="mb-4 mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado ?? ""}>
            <option value="">Todos</option>
            {Object.entries(ESTADO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.texto}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Desde">
          <Entrada type="date" name="desde" defaultValue={desde} />
        </Campo>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        vacio="No hay cierres en estas fechas."
        columnas={[{ titulo: "Día" }, { titulo: "Local" }, { titulo: "Teórico", alinear: "derecha", secundaria: true }, { titulo: "Contado", alinear: "derecha", secundaria: true }, { titulo: "Descuadre", alinear: "derecha" }, { titulo: "Estado" }]}
        filas={cierres.map((c) => {
          const desc = Number(c.descuadre);
          return {
            id: c.id,
            tono: c.estado === "RECHAZADO" ? ("error" as const) : desc !== 0 ? ("aviso" as const) : undefined,
            celdas: [
              fecha(c.fecha),
              nombre.get(c.centroId) ?? "—",
              euros(c.efectivoTeorico),
              euros(c.efectivoContado),
              <span key="d" className={desc < 0 ? "text-red-600" : desc > 0 ? "text-amber-600" : ""}>
                {euros(desc)}
              </span>,
              <Etiqueta key="e" tono={ESTADO[c.estado].tono}>
                {ESTADO[c.estado].texto}
              </Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Fondo inicial", valor: euros(c.fondoInicial) },
                    { etiqueta: "Efectivo de las ventas", valor: c.efectivoVentas !== null ? euros(c.efectivoVentas) : "—" },
                    { etiqueta: "Retiradas y pagos con caja", valor: euros(-(Number(c.retiradas) + Number(c.pagosCaja)) + Number(c.entradasCaja)) },
                    { etiqueta: "Tarjeta (ventas + propinas)", valor: c.tarjetaTeorico !== null ? `${euros(c.tarjetaTeorico)}${Number(c.propinasTarjeta) ? ` (propinas ${euros(c.propinasTarjeta)})` : ""}` : "—" },
                    { etiqueta: "Propinas en efectivo", valor: euros(c.propinasEfectivo) },
                    { etiqueta: "Tarjeta (banco)", valor: c.tarjetaBanco !== null ? euros(c.tarjetaBanco) : "—" },
                    { etiqueta: "Diferencia tarjeta", valor: c.tarjetaTeorico !== null && c.tarjetaBanco !== null ? euros(Number(c.tarjetaBanco) - Number(c.tarjetaTeorico)) : "—" },
                    { etiqueta: "Fondo que se deja", valor: euros(c.fondoCaja) },
                    { etiqueta: "Motivo", valor: c.motivo ?? "—" },
                    { etiqueta: "Cerrado por", valor: (c.cerradoPor && usuarios.get(c.cerradoPor)) || "—" },
                    { etiqueta: "Revisado por", valor: (c.validadoPor && usuarios.get(c.validadoPor)) || "—" },
                    { etiqueta: "Revisado el", valor: c.validadoEn ? fechaHora(c.validadoEn) : "—" },
                    { etiqueta: "Comentario de finanzas", valor: c.comentarioValidacion ?? "—" },
                  ]}
                />
                {puedeValidar && c.estado === "PENDIENTE" && (
                  <form action={accionValidarCierre} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="volver" value={volver} />
                    <div className="min-w-72">
                      <Campo etiqueta="Comentario (obligatorio para rechazar)">
                        <Entrada name="comentario" />
                      </Campo>
                    </div>
                    <Boton type="submit" name="decision" value="VALIDADO">
                      Validar
                    </Boton>
                    <Boton type="submit" name="decision" value="RECHAZADO" variante="peligro">
                      Rechazar
                    </Boton>
                  </form>
                )}
              </div>
            ),
          };
        })}
      />
      <div className="mt-4">
        <HuecoIntegracion nombre="Programa de caja (TPV)" descripcion="Traer del TPV el efectivo y la tarjeta teóricos de cada cierre (cierre Z)" />
      </div>
    </>
  );
}
