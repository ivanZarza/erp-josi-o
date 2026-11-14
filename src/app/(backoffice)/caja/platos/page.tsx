import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero, porcentaje } from "@/kernel/formato";
import { Cabecera, Campo, Entrada, Selector, Boton, Cifra, Rejilla, Pestanas, Vacio, Aviso } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { ventaPorPlato, consumoTeoricoReal, centrosCaja, hoyISO, sumarDias, redondear } from "@/modulos/caja/servicio";
import { Avisos, param, type ParametrosBusqueda } from "../_comun";

const pct = (parte: number, total: number) => (total ? porcentaje((parte / total) * 100) : "—");

export default async function VentaPorPlato({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("caja", "caja:ver");
  const sp = await searchParams;
  const vista = param(sp, "vista") === "consumo" ? "consumo" : "platos";
  const centros = centrosCaja(ctx);
  if (centros.length === 0)
    return (
      <>
        <Cabecera titulo="Venta por plato" />
        <Vacio>No hay locales con Caja y ventas en tu selección.</Vacio>
      </>
    );

  return (
    <>
      <Cabecera titulo="Venta por plato" subtitulo="Lo vendido por plato y formato (de los tickets) con su coste teórico, y el consumo teórico frente al real de los inventarios." />
      <Avisos sp={sp} />
      <Pestanas
        activa={vista === "consumo" ? "/caja/platos?vista=consumo" : "/caja/platos"}
        items={[
          { href: "/caja/platos", titulo: "Venta por plato" },
          { href: "/caja/platos?vista=consumo", titulo: "Consumo teórico frente a real" },
        ]}
      />
      {vista === "platos" ? <Platos sp={sp} /> : <Consumo sp={sp} centros={centros} />}
    </>
  );

  async function Platos({ sp }: { sp: Record<string, string | string[] | undefined> }) {
    const hoy = hoyISO();
    const hasta = param(sp, "hasta") ?? sumarDias(hoy, -1);
    const desde = param(sp, "desde") ?? `${hasta.slice(0, 7)}-01`;
    const area = param(sp, "area");
    const agrupar = param(sp, "agrupar") === "dia" ? "dia" : "mes";
    const todas = await ventaPorPlato(ctx, desde, hasta);
    const filas = todas.filter((f) => !area || f.area === area);
    const venta = redondear(filas.reduce((s, f) => s + f.importe, 0));
    const coste = redondear(filas.reduce((s, f) => s + f.coste, 0));
    const unidades = filas.reduce((s, f) => s + f.unidades, 0);
    const clave = (dia: string) => (agrupar === "mes" ? dia.slice(0, 7) : dia);
    return (
      <>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Campo etiqueta="Desde">
            <Entrada type="date" name="desde" defaultValue={desde} />
          </Campo>
          <Campo etiqueta="Hasta">
            <Entrada type="date" name="hasta" defaultValue={hasta} />
          </Campo>
          <Campo etiqueta="Área">
            <Selector name="area" defaultValue={area ?? ""}>
              <option value="">Comidas y bebidas</option>
              <option value="COMIDAS">Comidas</option>
              <option value="BEBIDAS">Bebidas</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Detalle de cada plato">
            <Selector name="agrupar" defaultValue={agrupar}>
              <option value="mes">Por meses</option>
              <option value="dia">Por días</option>
            </Selector>
          </Campo>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
        <Rejilla columnas={4}>
          <Cifra etiqueta="Venta sin IVA" valor={euros(venta)} detalle={`${fecha(desde)} – ${fecha(hasta)}`} />
          <Cifra etiqueta="Coste teórico" valor={euros(coste)} detalle={`${pct(coste, venta)} de la venta (con invitaciones)`} />
          <Cifra etiqueta="Margen bruto" valor={euros(venta - coste)} detalle={pct(venta - coste, venta)} tono={venta - coste >= 0 ? "ok" : "error"} />
          <Cifra etiqueta="Unidades vendidas" valor={numero(unidades, 0)} detalle={`${numero(filas.length)} platos y formatos`} />
        </Rejilla>
        <div className="mt-4">
          <TablaDesplegable
            total={`${numero(filas.length)} platos y formatos · ${euros(venta)}`}
            vacio="No hay tickets con líneas en estas fechas. Las jornadas metidas a mano (sin tickets) no tienen detalle por plato."
            columnas={[{ titulo: "Plato · formato" }, { titulo: "Unidades", alinear: "derecha" }, { titulo: "Venta", alinear: "derecha" }, { titulo: "Coste teórico", alinear: "derecha", secundaria: true }, { titulo: "Margen", alinear: "derecha" }, { titulo: "% coste", alinear: "derecha", secundaria: true }]}
            filas={filas.map((f) => {
              const grupos = new Map<string, { unidades: number; importe: number; coste: number }>();
              for (const [dia, d] of f.porDia) {
                const g = grupos.get(clave(dia)) ?? { unidades: 0, importe: 0, coste: 0 };
                g.unidades += d.unidades;
                g.importe += d.importe;
                g.coste += d.coste;
                grupos.set(clave(dia), g);
              }
              const orden = Array.from(grupos.entries()).sort((a, b) => b[0].localeCompare(a[0]));
              const caro = f.importe > 0 && f.coste / f.importe > 0.4;
              return {
                id: f.clave,
                tono: caro ? ("aviso" as const) : undefined,
                celdas: [
                  <span key="c">
                    {f.concepto}
                    {f.area === "BEBIDAS" ? <span className="ml-1 text-xs text-slate-500">(bebida)</span> : null}
                  </span>,
                  numero(f.unidades),
                  euros(f.importe),
                  euros(f.coste),
                  euros(f.importe - f.coste),
                  pct(f.coste, f.importe),
                ],
                detalle: (
                  <div className="space-y-3">
                    <DatosDetalle
                      datos={[
                        { etiqueta: "Precio medio sin IVA", valor: f.unidades ? euros(f.importe / f.unidades) : "—" },
                        { etiqueta: "Coste teórico por unidad", valor: f.unidades + f.invitadas ? euros(f.coste / (f.unidades + f.invitadas)) : "—" },
                        { etiqueta: "Invitadas", valor: f.invitadas ? numero(f.invitadas) : "—" },
                        { etiqueta: "Peso en la venta", valor: pct(f.importe, venta) },
                      ]}
                    />
                    <table className="w-full max-w-xl text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-1 text-left">{agrupar === "mes" ? "Mes" : "Día"}</th>
                          <th className="py-1 text-right">Unidades</th>
                          <th className="py-1 text-right">Venta</th>
                          <th className="py-1 text-right">Coste</th>
                          <th className="py-1 text-right">Margen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orden.map(([k, g]) => (
                          <tr key={k} className="border-t border-slate-100">
                            <td className="py-1">{agrupar === "mes" ? k : fecha(k)}</td>
                            <td className="py-1 text-right tabular-nums">{numero(g.unidades)}</td>
                            <td className="py-1 text-right tabular-nums">{euros(g.importe)}</td>
                            <td className="py-1 text-right tabular-nums">{euros(g.coste)}</td>
                            <td className="py-1 text-right tabular-nums">{euros(g.importe - g.coste)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
              };
            })}
          />
          <p className="mt-3 text-xs text-slate-500">
            Venta sin IVA de los tickets cobrados (sin líneas anuladas). Coste teórico = escandallo del plato (o la parte del formato: copa = 0,2 de la botella) × coste medio del producto al venderlo. Las invitaciones cuentan en el coste, no en la venta. En naranja, platos con más del 40 % de coste.
          </p>
        </div>
      </>
    );
  }

  async function Consumo({ sp, centros }: { sp: Record<string, string | string[] | undefined>; centros: { id: string; nombre: string }[] }) {
    const centroId = param(sp, "centro") ?? ctx.centroActivo?.id ?? (centros.length === 1 ? centros[0].id : "");
    const area = param(sp, "area") === "COMIDAS" ? "COMIDAS" : "BEBIDAS";
    const inventarioId = param(sp, "inventario");
    if (!centros.some((c) => c.id === centroId))
      return (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="vista" value="consumo" />
          <Campo etiqueta="Local">
            <Selector name="centro" defaultValue="">
              <option value="">Elige…</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
      );
    const r = await consumoTeoricoReal(ctx, centroId, area, inventarioId);
    const total = (f: (x: (typeof r.filas)[number]) => number) => redondear(r.filas.reduce((s, x) => s + f(x), 0));
    const teoricoE = total((x) => x.teorico * x.coste);
    const realE = total((x) => x.real * x.coste);
    return (
      <>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <input type="hidden" name="vista" value="consumo" />
          {centros.length > 1 && (
            <Campo etiqueta="Local">
              <Selector name="centro" defaultValue={centroId}>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Campo etiqueta="Área">
            <Selector name="area" defaultValue={area}>
              <option value="BEBIDAS">Bebidas</option>
              <option value="COMIDAS">Comidas</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Hasta el inventario">
            <Selector name="inventario" defaultValue={r.final?.id ?? ""}>
              {r.inventarios.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.numero})
                </option>
              ))}
            </Selector>
          </Campo>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
        {!r.final ? (
          <Vacio>No hay inventarios cerrados de todo el local en {area === "BEBIDAS" ? "Bebidas" : "Comidas"}: haz uno para comparar lo que ha bajado de verdad con lo vendido.</Vacio>
        ) : (
          <>
            <Aviso>
              Desde {r.inicial ? `el inventario ${r.inicial.nombre} (${fechaHora(r.inicial.cerradoEn)})` : "el principio (sin inventario anterior: stock 0)"} hasta {r.final.nombre} ({fechaHora(r.final.cerradoEn)}). Real = recuento inicial + entradas − mermas − recuento final. Teórico = lo que ha bajado por las ventas de los tickets.
            </Aviso>
            <div className="mt-4">
              <Rejilla columnas={3}>
                <Cifra etiqueta="Consumo teórico (ventas)" valor={euros(teoricoE)} />
                <Cifra etiqueta="Consumo real (inventarios)" valor={euros(realE)} />
                <Cifra etiqueta="Diferencia sin explicar" valor={euros(realE - teoricoE)} detalle={teoricoE ? `${porcentaje(((realE - teoricoE) / teoricoE) * 100)} sobre el teórico` : "—"} tono={Math.abs(realE - teoricoE) > teoricoE * 0.05 ? "aviso" : "ok"} />
              </Rejilla>
            </div>
            <div className="mt-4">
              <TablaDesplegable
                total={`${numero(r.filas.length)} productos · ordenados por la diferencia en euros`}
                vacio="Ningún producto del inventario se ha movido en el periodo."
                columnas={[{ titulo: "Producto" }, { titulo: "Teórico", alinear: "derecha" }, { titulo: "Real", alinear: "derecha" }, { titulo: "Diferencia", alinear: "derecha" }, { titulo: "Diferencia €", alinear: "derecha" }]}
                filas={r.filas.map((f) => ({
                  id: f.productoId,
                  tono: Math.abs(f.diferenciaEuros) >= 50 ? ("aviso" as const) : undefined,
                  celdas: [`${f.producto} (${f.unidad.toLowerCase()})`, numero(f.teorico, 3), numero(f.real, 3), numero(f.diferencia, 3), euros(f.diferenciaEuros)],
                  detalle: (
                    <DatosDetalle
                      datos={[
                        { etiqueta: "Referencia", valor: f.referencia },
                        { etiqueta: "Recuento inicial", valor: numero(f.inicial, 3) },
                        { etiqueta: "Entradas (compras y pedidos)", valor: numero(f.entradas, 3) },
                        { etiqueta: "Mermas apuntadas", valor: numero(f.mermas, 3) },
                        { etiqueta: "Recuento final", valor: numero(f.final, 3) },
                        { etiqueta: "Coste por unidad", valor: euros(f.coste, 4) },
                        { etiqueta: "Diferencia sobre el teórico", valor: f.teorico ? porcentaje((f.diferencia / f.teorico) * 100) : "—" },
                      ]}
                    />
                  ),
                }))}
              />
            </div>
          </>
        )}
      </>
    );
  }
}
