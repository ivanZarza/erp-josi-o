import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, BotonEnlace, Cifra, Rejilla, Etiqueta, HuecoIntegracion, Vacio, Aviso } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarTickets, resumenTickets, cartaDeVenta, centrosCaja, hoyISO, sumarDias, nombresUsuarios } from "@/modulos/caja/servicio";
import { accionRegistrarTicket, accionAnadirLineas, accionCobrarTicket, accionAnularLinea, accionAnularTicket, accionImportarTpv } from "@/modulos/caja/acciones";
import { FORMAS_COBRO, NOMBRE_FORMA_COBRO, LINEAS_FORMULARIO } from "@/modulos/caja/esquemas";
import { empleadosDelCentro, nombreCompleto } from "@/modulos/personal/servicio";
import type { PlatoVendible } from "@/nucleo/consumo-ventas";
import { Avisos, param, type ParametrosBusqueda } from "../_comun";

const ESTADO = {
  ABIERTO: { texto: "Abierto", tono: "aviso" as const },
  COBRADO: { texto: "Cobrado", tono: "ok" as const },
  ANULADO: { texto: "Anulado", tono: "error" as const },
};

/** Selector de plato y formato (valor «platoId|formatoId»), agrupado por sección de la carta. */
function SelectorArticulo({ name, carta }: { name: string; carta: PlatoVendible[] }) {
  const secciones = Array.from(new Set(carta.map((p) => p.seccion)));
  return (
    <Selector name={name} defaultValue="">
      <option value="">—</option>
      {secciones.map((s) => (
        <optgroup key={s} label={s}>
          {carta
            .filter((p) => p.seccion === s)
            .flatMap((p) =>
              p.formatos.length
                ? p.formatos.map((f) => (
                    <option key={`${p.platoId}|${f.id}`} value={`${p.platoId}|${f.id}`}>
                      {p.nombre} · {f.nombre} — {euros(f.precio)}
                    </option>
                  ))
                : [
                    <option key={p.platoId} value={`${p.platoId}|`}>
                      {p.nombre} — {euros(p.precio)}
                    </option>,
                  ],
            )}
        </optgroup>
      ))}
    </Selector>
  );
}

function FilasLineas({ carta, filas }: { carta: PlatoVendible[]; filas: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="grid grid-cols-[1fr_5rem_auto] items-end gap-2">
          <SelectorArticulo name={`linea_${i}_articulo`} carta={carta} />
          <Entrada name={`linea_${i}_cantidad`} inputMode="decimal" defaultValue="1" className="text-right" aria-label="Cantidad" />
          <label className="flex items-center gap-1 pb-2 text-xs text-slate-600">
            <input type="checkbox" name={`linea_${i}_invitacion`} /> Invitación
          </label>
        </div>
      ))}
    </div>
  );
}

function CamposCobro() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Campo etiqueta="Forma de pago">
        <Selector name="forma" defaultValue="TARJETA">
          {FORMAS_COBRO.map((f) => (
            <option key={f} value={f}>
              {NOMBRE_FORMA_COBRO[f]}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Propina" ayuda="Aparte de la cuenta">
        <Entrada name="propina" inputMode="decimal" className="text-right" />
      </Campo>
      <Campo etiqueta="Segundo cobro (opcional)">
        <Selector name="forma2" defaultValue="">
          <option value="">—</option>
          {FORMAS_COBRO.map((f) => (
            <option key={f} value={f}>
              {NOMBRE_FORMA_COBRO[f]}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Importe del segundo cobro">
        <Entrada name="importe2" inputMode="decimal" className="text-right" />
      </Campo>
    </div>
  );
}

export default async function Tickets({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("caja", "caja:ver");
  const sp = await searchParams;
  const hoy = hoyISO();
  const hasta = param(sp, "hasta") ?? hoy;
  const desde = param(sp, "desde") ?? sumarDias(hasta, -1);
  const estado = param(sp, "estado");
  const q = param(sp, "q");
  const centros = centrosCaja(ctx);
  const centroForm = param(sp, "centro") ?? ctx.centroActivo?.id ?? (centros.length === 1 ? centros[0].id : "");
  const puedeCrear = ctx.puede("caja:tickets:crear");
  const puedeAnular = ctx.puede("caja:tickets:anular");
  const puedeImportar = ctx.puede("caja:tpv:importar");

  if (centros.length === 0)
    return (
      <>
        <Cabecera titulo="Tickets" />
        <Vacio>No hay locales con Caja y ventas en tu selección. Elige otro centro arriba o activa el área en el local.</Vacio>
      </>
    );

  const centroValido = centros.some((c) => c.id === centroForm);
  // el local elegido sirve para apuntar tickets Y filtra la lista (sin local elegido: todos los de tu selección)
  const filtro = { desde, hasta, estado, q, centroId: centroValido ? centroForm : undefined };
  const [tickets, resumen, carta, empleados] = await Promise.all([
    listarTickets(ctx, filtro),
    resumenTickets(ctx, filtro),
    puedeCrear && centroValido ? cartaDeVenta(ctx, centroForm) : Promise.resolve([] as PlatoVendible[]),
    puedeCrear && centroValido && ctx.tieneModulo("personal") ? empleadosDelCentro(ctx, centroForm).catch(() => []) : Promise.resolve([]),
  ]);
  const usuarios = await nombresUsuarios(ctx, tickets.flatMap((t) => [t.anuladoPor, ...t.lineas.map((l) => l.anuladaPor)]));
  const camareros = new Map(empleados.map((e) => [e.id, nombreCompleto(e)]));
  const nombreCentro = new Map(centros.map((c) => [c.id, c.nombre]));
  const volver = `/caja/tickets?${new URLSearchParams({ desde, hasta, ...(estado ? { estado } : {}), ...(q ? { q } : {}), ...(centroForm ? { centro: centroForm } : {}) }).toString()}`;
  const salaPrimero = [...empleados].sort((a, b) => Number(/camarer|sala|barra|sumiller/i.test(b.puesto?.nombre ?? "")) - Number(/camarer|sala|barra|sumiller/i.test(a.puesto?.nombre ?? "")));

  return (
    <>
      <Cabecera titulo="Tickets" subtitulo="Cada cuenta con sus líneas (plato y formato), cobros y propinas. Cada línea baja el stock por su escandallo; anularla lo devuelve." />
      <Avisos sp={sp} />

      <Rejilla columnas={4}>
        <Cifra etiqueta="Tickets cobrados" valor={numero(resumen.cobrados)} detalle={`${numero(resumen.abiertos)} abiertos · ${numero(resumen.anulados)} anulados`} />
        <Cifra etiqueta="Venta (sin IVA)" valor={euros(resumen.venta)} detalle={resumen.cobrados ? `ticket medio ${euros(resumen.venta / resumen.cobrados)}` : "—"} />
        <Cifra etiqueta="Propinas" valor={euros(resumen.propinas)} detalle="Aparte de la venta" />
        <Cifra
          etiqueta="Anulaciones"
          valor={euros(resumen.anulaciones)}
          detalle={`${numero(resumen.lineasAnuladas)} líneas y ${numero(resumen.anulados)} tickets · invitaciones ${euros(resumen.invitaciones)}`}
          tono={resumen.anulados > 0 ? "aviso" : "normal"}
          href={`/caja/tickets?${new URLSearchParams({ desde, hasta, estado: "CON_ANULACIONES", ...(centroValido ? { centro: centroForm } : {}) }).toString()}`}
        />
      </Rejilla>

      {puedeCrear && (
        <Tarjeta titulo="Apuntar un ticket" className="mt-4">
          {!centroValido ? (
            <Aviso>Elige un local en el filtro de la lista (más abajo) para apuntar tickets con su carta.</Aviso>
          ) : carta.length === 0 ? (
            <Aviso tono="aviso">{nombreCentro.get(centroForm)} no tiene carta activa: crea la carta en Comidas o Bebidas.</Aviso>
          ) : (
            <form action={accionRegistrarTicket} className="space-y-4">
              <input type="hidden" name="volver" value={volver} />
              <input type="hidden" name="centroId" value={centroForm} />
              <p className="text-sm text-slate-600">
                Local: <strong>{nombreCentro.get(centroForm)}</strong>. Mientras no haya TPV conectado. Cada línea baja el stock del almacén por defecto del producto (los vinos de la Bodega, cervezas, refrescos y café de la Barra).
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Campo etiqueta="Mesa">
                  <Entrada name="mesa" />
                </Campo>
                <Campo etiqueta="Comensales">
                  <Entrada name="comensales" inputMode="numeric" defaultValue="2" className="text-right" required />
                </Campo>
                <Campo etiqueta="Camarero">
                  {empleados.length ? (
                    <Selector name="empleadoId" defaultValue="">
                      <option value="">—</option>
                      {salaPrimero.map((e) => (
                        <option key={e.id} value={e.id}>
                          {nombreCompleto(e)}
                          {e.puesto ? ` (${e.puesto.nombre})` : ""}
                        </option>
                      ))}
                    </Selector>
                  ) : (
                    <Entrada name="camarero" />
                  )}
                </Campo>
                <Campo etiqueta="Descuento a la cuenta (%)">
                  <Entrada name="descuentoPct" inputMode="decimal" className="text-right" />
                </Campo>
                <Campo etiqueta="Estado">
                  <Selector name="estado" defaultValue="COBRADO">
                    <option value="COBRADO">Cobrado</option>
                    <option value="ABIERTO">Abierto (mesa sin cobrar)</option>
                  </Selector>
                </Campo>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Líneas (plato o bebida, formato y cantidad)</p>
                <FilasLineas carta={carta} filas={LINEAS_FORMULARIO} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Cobro (si se guarda como cobrado)</p>
                <CamposCobro />
              </div>
              <Campo etiqueta="Notas">
                <AreaTexto name="notas" rows={2} />
              </Campo>
              <div className="flex justify-end">
                <Boton type="submit">Guardar ticket</Boton>
              </div>
            </form>
          )}
        </Tarjeta>
      )}

      {puedeImportar && (
        <Tarjeta titulo="Importar ventas del TPV" className="mt-4">
          <div className="mb-3">
            <HuecoIntegracion nombre="Programa de caja (TPV)" descripcion="Conexión directa con Revo, Ágora, Last.app o Chift pendiente (P-03). Mientras, se pueden importar los tickets en CSV o en el formato propio del ERP (JSON)" />
          </div>
          {!centroValido ? (
            <Aviso>Elige un local en el filtro de la lista (más abajo) para importar sus tickets.</Aviso>
          ) : (
            <form action={accionImportarTpv} className="space-y-3">
              <input type="hidden" name="volver" value={volver} />
              <input type="hidden" name="centroId" value={centroForm} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo etiqueta="Formato">
                  <Selector name="formato" defaultValue="csv">
                    <option value="csv">CSV sencillo (una fila por línea)</option>
                    <option value="json">Formato propio del ERP (JSON)</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Archivo">
                  <Entrada type="file" name="archivo" accept=".csv,.json,.txt" />
                </Campo>
              </div>
              <Campo etiqueta="O pega aquí el contenido" ayuda="CSV: ticket;abierto;cobrado;mesa;comensales;camarero;plato;formato;cantidad;precio;descuento;invitacion;anulada;forma_pago;propina">
                <AreaTexto name="texto" rows={4} placeholder={"ticket;abierto;mesa;comensales;plato;formato;cantidad;forma_pago;propina\nR-1;2026-11-13 21:05;12;2;Entraña;;1;TARJETA;2"} />
              </Campo>
              <div className="flex justify-end">
                <Boton type="submit" variante="secundario">
                  Importar tickets
                </Boton>
              </div>
            </form>
          )}
        </Tarjeta>
      )}

      <form method="get" className="mb-4 mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {centros.length > 1 && (
          <Campo etiqueta="Local">
            <Selector name="centro" defaultValue={centroForm}>
              <option value="">Todos (para apuntar, elige uno)</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        )}
        <Campo etiqueta="Desde">
          <Entrada type="date" name="desde" defaultValue={desde} />
        </Campo>
        <Campo etiqueta="Hasta">
          <Entrada type="date" name="hasta" defaultValue={hasta} />
        </Campo>
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado ?? ""}>
            <option value="">Todos</option>
            <option value="ABIERTO">Abiertos</option>
            <option value="COBRADO">Cobrados</option>
            <option value="ANULADO">Anulados</option>
            <option value="CON_ANULACIONES">Con anulaciones</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Mesa, número o camarero" ayuda="Trozo del texto, sin distinguir mayúsculas">
          <Entrada name="q" defaultValue={q ?? ""} />
        </Campo>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        total={`${numero(tickets.length)} tickets${tickets.length === 300 ? " (los 300 más recientes: acota las fechas)" : ""}`}
        vacio="No hay tickets en estas fechas."
        columnas={[{ titulo: "Hora" }, { titulo: "Ticket" }, { titulo: "Mesa" }, { titulo: "Comensales", alinear: "derecha", secundaria: true }, { titulo: "Total", alinear: "derecha" }, { titulo: "Propina", alinear: "derecha", secundaria: true }, { titulo: "Estado" }]}
        filas={tickets.map((t) => {
          const anuladas = t.lineas.filter((l) => l.anulada).length;
          const abierto = t.estado === "ABIERTO";
          return {
            id: t.id,
            tono: t.estado === "ANULADO" ? ("error" as const) : anuladas ? ("aviso" as const) : undefined,
            celdas: [
              fechaHora(t.abiertoEn),
              t.numero,
              t.mesa ?? "—",
              numero(t.comensales),
              euros(t.total),
              Number(t.propina) ? euros(t.propina) : "—",
              <span key="e" className="flex flex-wrap gap-1">
                <Etiqueta tono={ESTADO[t.estado].tono}>{ESTADO[t.estado].texto}</Etiqueta>
                {anuladas > 0 && <Etiqueta tono="aviso">{anuladas} anuladas</Etiqueta>}
                {t.origen === "TPV" && <Etiqueta tono="info">TPV</Etiqueta>}
              </span>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Local", valor: nombreCentro.get(t.centroId) ?? "—" },
                    { etiqueta: "Día de negocio", valor: `${fecha(t.fecha)} · ${t.turno === "COMIDA" ? "comida" : "cena"}` },
                    { etiqueta: "Camarero", valor: (t.empleadoId && camareros.get(t.empleadoId)) || t.camarero || "—" },
                    { etiqueta: "Venta sin IVA", valor: euros(t.base) },
                    { etiqueta: "IVA", valor: euros(t.cuotaIva) },
                    { etiqueta: "Coste teórico", valor: `${euros(t.costeTeorico)}${Number(t.base) > 0 ? ` (${numero((Number(t.costeTeorico) / Number(t.base)) * 100, 1)} %)` : ""}` },
                    { etiqueta: "Descuentos", valor: euros(t.descuentos) },
                    { etiqueta: "Invitaciones", valor: euros(t.invitaciones) },
                    { etiqueta: "Anulado", valor: euros(t.anulaciones) },
                    { etiqueta: "Cobros", valor: t.cobros.length ? t.cobros.map((c) => `${NOMBRE_FORMA_COBRO[c.forma]} ${euros(c.importe)}${Number(c.propina) ? ` + propina ${euros(c.propina)}` : ""}`).join(" · ") : "Sin cobrar" },
                    ...(t.estado === "ANULADO" ? [{ etiqueta: "Motivo de la anulación", valor: `${t.motivoAnulacion ?? "—"}${t.anuladoPor ? ` (${usuarios.get(t.anuladoPor) ?? "—"}, ${fechaHora(t.anuladoEn)})` : ""}` }] : []),
                    { etiqueta: "Notas", valor: t.notas ?? "—" },
                  ]}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-1 text-left">Línea</th>
                        <th className="py-1 text-right">Cant.</th>
                        <th className="py-1 text-right">Precio</th>
                        <th className="py-1 text-right">Total</th>
                        <th className="py-1 text-right">Coste</th>
                        <th className="py-1 text-left" />
                      </tr>
                    </thead>
                    <tbody>
                      {t.lineas.map((l) => (
                        <tr key={l.id} className={`border-t border-slate-100 ${l.anulada ? "text-slate-400 line-through" : ""}`}>
                          <td className="py-1">
                            {l.concepto}
                            {l.invitacion && <span className="ml-1 text-xs text-sky-700 no-underline">(invitación)</span>}
                            {Number(l.descuento) > 0 && <span className="ml-1 text-xs text-slate-500">(−{euros(l.descuento)})</span>}
                            {!l.platoId && <span className="ml-1 text-xs text-amber-700">(sin enlazar con la carta)</span>}
                            {l.anulada && (
                              <span className="block text-xs no-underline">
                                Anulada: {l.motivoAnulacion ?? "—"}
                                {l.anuladaPor ? ` · ${usuarios.get(l.anuladaPor) ?? "—"}` : ""}
                                {l.anuladaEn ? ` · ${fechaHora(l.anuladaEn)}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-right tabular-nums">{numero(l.cantidad)}</td>
                          <td className="py-1 text-right tabular-nums">{euros(l.precio)}</td>
                          <td className="py-1 text-right tabular-nums">{euros(l.total)}</td>
                          <td className="py-1 text-right tabular-nums">{euros(l.costeTeorico)}</td>
                          <td className="py-1 pl-2">
                            {abierto && puedeAnular && !l.anulada && (
                              <form action={accionAnularLinea} className="flex gap-1">
                                <input type="hidden" name="volver" value={volver} />
                                <input type="hidden" name="id" value={l.id} />
                                <Entrada name="motivo" placeholder="Motivo" required className="w-32" />
                                <Boton type="submit" variante="peligro">
                                  Anular
                                </Boton>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {abierto && puedeCrear && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <form action={accionAnadirLineas} className="space-y-2 rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-medium">Añadir líneas</p>
                      <input type="hidden" name="volver" value={volver} />
                      <input type="hidden" name="id" value={t.id} />
                      {t.centroId === centroForm ? <FilasLineas carta={carta} filas={3} /> : <BotonEnlace variante="secundario" href={`/caja/tickets?${new URLSearchParams({ desde, hasta, centro: t.centroId }).toString()}`}>Elegir este local para añadir</BotonEnlace>}
                      {t.centroId === centroForm && (
                        <div className="flex justify-end">
                          <Boton type="submit" variante="secundario">
                            Añadir
                          </Boton>
                        </div>
                      )}
                    </form>
                    <form action={accionCobrarTicket} className="space-y-2 rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-medium">Cobrar {euros(t.total)}</p>
                      <input type="hidden" name="volver" value={volver} />
                      <input type="hidden" name="id" value={t.id} />
                      <CamposCobro />
                      <div className="flex justify-end">
                        <Boton type="submit">Cobrar</Boton>
                      </div>
                    </form>
                  </div>
                )}
                {t.estado !== "ANULADO" && puedeAnular && (
                  <form action={accionAnularTicket} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="volver" value={volver} />
                    <input type="hidden" name="id" value={t.id} />
                    <Campo etiqueta="Anular el ticket entero (devuelve el stock)">
                      <Entrada name="motivo" placeholder="Motivo" required className="w-72" />
                    </Campo>
                    <Boton type="submit" variante="peligro">
                      Anular ticket
                    </Boton>
                  </form>
                )}
              </div>
            ),
          };
        })}
      />
    </>
  );
}
