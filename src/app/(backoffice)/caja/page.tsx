import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, BotonEnlace, Cifra, Rejilla, Etiqueta, HuecoIntegracion, Vacio, Aviso } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarJornadas, jornadaDe, jornadasQueFaltan, centrosCaja, hoyISO, sumarDias, redondear } from "@/modulos/caja/servicio";
import { accionGuardarJornada } from "@/modulos/caja/acciones";
import { FORMAS_COBRO, NOMBRE_FORMA_COBRO } from "@/modulos/caja/esquemas";
import { Avisos, param, valorCampo, type ParametrosBusqueda } from "./_comun";

export default async function Ventas({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("caja", "caja:ver");
  const sp = await searchParams;
  const hoy = hoyISO();
  const ayer = sumarDias(hoy, -1);
  const hasta = param(sp, "hasta") ?? hoy;
  const desde = param(sp, "desde") ?? sumarDias(hasta, -29);
  const centros = centrosCaja(ctx);
  const puedeEditar = ctx.puede("caja:ventas:editar");

  // jornada a editar: ?centro=&fecha= (por defecto, ayer en el centro activo)
  const centroForm = param(sp, "centro") ?? ctx.centroActivo?.id ?? (centros.length === 1 ? centros[0].id : "");
  const fechaForm = param(sp, "fecha") ?? ayer;
  const [jornadas, faltanAyer, enEdicion] = await Promise.all([
    listarJornadas(ctx, desde, hasta),
    jornadasQueFaltan(ctx, ayer),
    centroForm && centros.some((c) => c.id === centroForm) ? jornadaDe(ctx, centroForm, fechaForm) : Promise.resolve(null),
  ]);
  const nombre = new Map(centros.map((c) => [c.id, c.nombre]));
  const venta = redondear(jornadas.reduce((s, j) => s + Number(j.ventaNeta), 0));
  const comensales = jornadas.reduce((s, j) => s + j.comensales, 0);
  const tickets = jornadas.reduce((s, j) => s + j.tickets, 0);
  const deAyer = jornadas.filter((j) => j.fecha.toISOString().slice(0, 10) === ayer);
  const ventaAyer = redondear(deAyer.reduce((s, j) => s + Number(j.ventaNeta), 0));
  const pago = (forma: string) => enEdicion?.pagos.find((p) => p.forma === forma)?.importe ?? null;

  if (centros.length === 0)
    return (
      <>
        <Cabecera titulo="Ventas" />
        <Vacio>No hay locales con Caja y ventas en tu selección. Elige otro centro arriba o activa el área en el local.</Vacio>
      </>
    );

  return (
    <>
      <Cabecera titulo="Ventas" subtitulo="Ventas de cada local por jornada (día de negocio). Si el local tiene tickets, la jornada se calcula sola desde ellos; si no, se mete a mano. Importes de venta sin IVA; cobros por forma de pago con IVA." />
      <Avisos sp={sp} />
      <div className="mb-4">
        <HuecoIntegracion nombre="Programa de caja (TPV)" descripcion="Leer del TPV los tickets con sus líneas, cobros, propinas y comensales (Revo, Ágora, Last.app… o Chift, pendiente P-03). Mientras, los tickets se importan en CSV o se apuntan en «Tickets», y la jornada se calcula sola" />
      </div>

      <Rejilla columnas={4}>
        <Cifra etiqueta={`Venta de ayer (${fecha(ayer)})`} valor={euros(ventaAyer)} detalle={`${numero(deAyer.length)} de ${numero(centros.length)} locales con datos`} />
        <Cifra etiqueta="Venta del periodo" valor={euros(venta)} detalle={`${fecha(desde)} – ${fecha(hasta)}`} />
        <Cifra etiqueta="Ticket medio" valor={tickets ? euros(venta / tickets) : "—"} detalle={`${numero(tickets)} tickets`} />
        <Cifra etiqueta="Venta por comensal" valor={comensales ? euros(venta / comensales) : "—"} detalle={`${numero(comensales)} comensales`} />
      </Rejilla>

      {faltanAyer.length > 0 && (
        <div className="mt-4">
          <Aviso tono="aviso" titulo="Faltan las ventas de ayer">
            {faltanAyer.map((c) => c.nombre).join(", ")}.
          </Aviso>
        </div>
      )}

      {puedeEditar && (
        <Tarjeta titulo={enEdicion ? `Ventas de ${nombre.get(centroForm)} del ${fecha(fechaForm)}` : "Meter las ventas de un día (locales sin tickets)"} className="mt-4">
          {enEdicion?.desdeTickets ? (
            <Aviso>
              Esta jornada se calcula sola desde sus tickets: para corregirla, anula la línea o el ticket que esté mal en{" "}
              <a className="underline" href={`/caja/tickets?desde=${fechaForm}&hasta=${fechaForm}&centro=${centroForm}`}>
                Tickets
              </a>
              .
            </Aviso>
          ) : enEdicion?.origen === "TPV" ? (
            <Aviso>Esta jornada viene del TPV y no se puede cambiar a mano.</Aviso>
          ) : (
            <form action={accionGuardarJornada} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Campo etiqueta="Local">
                  <Selector name="centroId" required defaultValue={centroForm}>
                    <option value="">Elige…</option>
                    {centros.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Día de negocio">
                  <Entrada type="date" name="fecha" required defaultValue={fechaForm} max={hoy} />
                </Campo>
                <Campo etiqueta="Venta neta (sin IVA)">
                  <Entrada name="ventaNeta" required inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.ventaNeta)} />
                </Campo>
                <Campo etiqueta="IVA de la venta">
                  <Entrada name="cuotaIva" inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.cuotaIva)} />
                </Campo>
                <Campo etiqueta="Comensales">
                  <Entrada name="comensales" required inputMode="numeric" className="text-right" defaultValue={enEdicion?.comensales ?? ""} />
                </Campo>
                <Campo etiqueta="Tickets">
                  <Entrada name="tickets" required inputMode="numeric" className="text-right" defaultValue={enEdicion?.tickets ?? ""} />
                </Campo>
                <Campo etiqueta="Venta comida (sin IVA)">
                  <Entrada name="ventaComida" inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.ventaComida)} />
                </Campo>
                <Campo etiqueta="Venta cena (sin IVA)">
                  <Entrada name="ventaCena" inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.ventaCena)} />
                </Campo>
                <Campo etiqueta="Descuentos">
                  <Entrada name="descuentos" inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.descuentos)} />
                </Campo>
                <Campo etiqueta="Invitaciones">
                  <Entrada name="invitaciones" inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.invitaciones)} />
                </Campo>
                <Campo etiqueta="Anulaciones">
                  <Entrada name="anulaciones" inputMode="decimal" className="text-right" defaultValue={valorCampo(enEdicion?.anulaciones)} />
                </Campo>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Cobros por forma de pago (con IVA)</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {FORMAS_COBRO.map((f) => (
                    <Campo key={f} etiqueta={NOMBRE_FORMA_COBRO[f]}>
                      <Entrada name={`pago_${f}`} inputMode="decimal" className="text-right" defaultValue={valorCampo(pago(f))} />
                    </Campo>
                  ))}
                </div>
              </div>
              <Campo etiqueta="Notas">
                <AreaTexto name="notas" rows={2} defaultValue={enEdicion?.notas ?? ""} />
              </Campo>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Para corregir un día ya metido, ábrelo en la tabla y pulsa «Corregir». Si el día ya existe, se sobrescribe (queda en el historial).</p>
                <Boton type="submit">{enEdicion ? "Guardar corrección" : "Guardar ventas"}</Boton>
              </div>
            </form>
          )}
        </Tarjeta>
      )}

      <form method="get" className="mb-4 mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Campo etiqueta="Desde">
          <Entrada type="date" name="desde" defaultValue={desde} />
        </Campo>
        <Campo etiqueta="Hasta">
          <Entrada type="date" name="hasta" defaultValue={hasta} />
        </Campo>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        total={`${numero(jornadas.length)} jornadas · ${euros(venta)} sin IVA`}
        vacio="No hay ventas en estas fechas. Mete la primera jornada con el formulario de arriba."
        columnas={[{ titulo: "Día" }, { titulo: "Local" }, { titulo: "Venta neta", alinear: "derecha" }, { titulo: "Comensales", alinear: "derecha", secundaria: true }, { titulo: "Ticket medio", alinear: "derecha", secundaria: true }, { titulo: "Origen" }]}
        filas={jornadas.map((j) => {
          const iso = j.fecha.toISOString().slice(0, 10);
          return {
            id: j.id,
            celdas: [
              fecha(j.fecha),
              nombre.get(j.centroId) ?? "—",
              euros(j.ventaNeta),
              numero(j.comensales),
              j.tickets ? euros(Number(j.ventaNeta) / j.tickets) : "—",
              <Etiqueta key="o" tono={j.desdeTickets ? "ok" : j.origen === "TPV" ? "ok" : "normal"}>
                {j.desdeTickets ? (j.origen === "TPV" ? "Tickets del TPV" : "Tickets") : j.origen === "TPV" ? "TPV" : "A mano"}
              </Etiqueta>,
            ],
            detalle: (
              <div className="space-y-3">
                <DatosDetalle
                  datos={[
                    { etiqueta: "IVA", valor: euros(j.cuotaIva) },
                    { etiqueta: "Tickets", valor: numero(j.tickets) },
                    { etiqueta: "Venta por comensal", valor: j.comensales ? euros(Number(j.ventaNeta) / j.comensales) : "—" },
                    { etiqueta: "Comida / cena", valor: j.ventaComida !== null || j.ventaCena !== null ? `${euros(j.ventaComida)} / ${euros(j.ventaCena)}` : "—" },
                    { etiqueta: "Descuentos", valor: euros(j.descuentos) },
                    { etiqueta: "Invitaciones", valor: euros(j.invitaciones) },
                    { etiqueta: "Anulaciones", valor: euros(j.anulaciones) },
                    { etiqueta: "Propinas", valor: euros(j.propinas) },
                    { etiqueta: "Coste teórico de lo vendido", valor: j.costeTeorico !== null ? `${euros(j.costeTeorico)}${Number(j.ventaNeta) ? ` (${numero((Number(j.costeTeorico) / Number(j.ventaNeta)) * 100, 1)} %)` : ""}` : "—" },
                    ...j.pagos.map((p) => ({ etiqueta: NOMBRE_FORMA_COBRO[p.forma], valor: `${euros(p.importe)}${Number(p.propina) ? ` + propinas ${euros(p.propina)}` : ""}` })),
                    { etiqueta: "Notas", valor: j.notas ?? "—" },
                  ]}
                />
                {j.desdeTickets && (
                  <BotonEnlace variante="secundario" href={`/caja/tickets?desde=${iso}&hasta=${iso}&centro=${j.centroId}`}>
                    Ver los tickets
                  </BotonEnlace>
                )}
                {puedeEditar && j.origen === "MANUAL" && !j.desdeTickets && (
                  <BotonEnlace variante="secundario" href={`/caja?centro=${j.centroId}&fecha=${iso}&desde=${desde}&hasta=${hasta}`}>
                    Corregir
                  </BotonEnlace>
                )}
              </div>
            ),
          };
        })}
      />
    </>
  );
}
