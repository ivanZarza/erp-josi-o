/**
 * Bebidas · Bodega: los vinos con su D.O., añada, stock en los centros elegidos arriba, coste,
 * precio en carta, % de coste y precio por copa. Se entra por el tipo de vino (tintos, blancos…).
 */
import { redirect } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, Rejilla, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { AvisoError, param, PestanasCarta, TarjetaEntrada, type Busqueda } from "@/modulos/comidas/carta-pantallas/comun";
import { nombreTipoVino, TIPOS_VINO } from "@/modulos/bebidas/fichas";
import { listarBodega, productosSinFicha } from "@/modulos/bebidas/servicio";
import { objetivoCosteBotella } from "@/modulos/comidas/carta-servicio";

export default async function Bodega({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("bebidas", "bebidas:productos:ver");
  const sp = await searchParams;
  const ir = param(sp, "ficha");
  if (ir) redirect(`/bebidas/bodega/${ir}`);
  const q = param(sp, "q") ?? "";
  const tipo = param(sp, "tipo") ?? "";
  const denominacion = param(sp, "do") ?? "";
  const soloCarta = param(sp, "carta") === "1";
  const { vinos, total, porTipo, denominaciones } = await listarBodega(ctx, { q: q || undefined, tipo: tipo || undefined, denominacion: denominacion || undefined, soloCarta });
  const puedeEditar = ctx.puede("bebidas:productos:editar");
  const sinFicha = puedeEditar ? await productosSinFicha(ctx) : [];

  const valor = vinos.reduce((s, v) => s + Math.max(0, v.stock) * v.coste, 0);
  const enCarta = vinos.filter((v) => v.ventas.length > 0).length;
  const conPct = vinos.filter((v) => v.pctCoste != null);
  const pctMedio = conPct.length ? conPct.reduce((s, v) => s + (v.pctCoste ?? 0), 0) / conPct.length : 0;
  // mismo objetivo de coste que la Carta de bebidas: el de Bebidas de la marca donde se vende la botella
  const caro = (v: (typeof vinos)[number]) => v.pctCoste != null && v.pctCoste > objetivoCosteBotella(v.ventas);
  const caros = conPct.filter(caro).length;
  const fichasIncompletas = vinos.filter((v) => !v.ficha || !v.ficha.tipo || !v.ficha.denominacion).length;

  const enlace = (t: string) => {
    const u = new URLSearchParams();
    if (t) u.set("tipo", t);
    if (q) u.set("q", q);
    if (denominacion) u.set("do", denominacion);
    if (soloCarta) u.set("carta", "1");
    const s = u.toString();
    return s ? `/bebidas/bodega?${s}` : "/bebidas/bodega";
  };
  const tipos = [...TIPOS_VINO.map((t) => ({ clave: t.clave as string, nombre: t.plural })), { clave: "SIN", nombre: "Sin tipo" }].filter((t) => porTipo.get(t.clave));

  return (
    <>
      <Cabecera
        titulo="Bodega"
        subtitulo={`Los vinos con su ficha, el stock ${ctx.centroActivo ? `de ${ctx.centroActivo.nombre}` : "de todos tus centros"} y lo que se cobran en la carta.`}
      />
      <PestanasCarta activa="/bebidas/bodega" area="BEBIDAS" />
      <AvisoError error={param(sp, "error")} />

      <div className="mb-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Vinos" valor={numero(vinos.length)} detalle={fichasIncompletas ? `${numero(fichasIncompletas)} con la ficha sin tipo o sin D.O.` : "Todos con ficha"} tono={fichasIncompletas ? "aviso" : "normal"} />
          <Cifra etiqueta="Valor en bodega" valor={euros(valor)} detalle="Stock × coste medio" />
          <Cifra etiqueta="En la carta" valor={numero(enCarta)} detalle={`Coste medio de la botella: ${porcentaje(pctMedio)}`} />
          <Cifra etiqueta="Coste alto" valor={numero(caros)} detalle="Botellas por encima del objetivo de coste de su marca" tono={caros ? "error" : "ok"} />
        </Rejilla>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <TarjetaEntrada href={enlace("")} titulo="Todos" detalle={`${numero(total)} vinos`} activa={!tipo} />
        {tipos.map((t) => (
          <TarjetaEntrada key={t.clave} href={enlace(t.clave)} titulo={t.nombre} detalle={`${numero(porTipo.get(t.clave) ?? 0)} vinos`} activa={tipo === t.clave} tono={t.clave === "SIN" ? "aviso" : undefined} />
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" action="/bebidas/bodega">
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        <Campo etiqueta="Buscar">
          <Entrada name="q" defaultValue={q} placeholder="Nombre del vino" />
        </Campo>
        <Campo etiqueta="D.O. o región">
          <Selector name="do" defaultValue={denominacion}>
            <option value="">Todas</option>
            {denominaciones.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Selector>
        </Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="carta" value="1" defaultChecked={soloCarta} /> Solo los que están en la carta
        </label>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[
          { titulo: "Vino" },
          { titulo: "D.O.", secundaria: true },
          { titulo: "Añada", alinear: "derecha" },
          { titulo: "Stock", alinear: "derecha" },
          { titulo: "Coste", alinear: "derecha", secundaria: true },
          { titulo: "En carta", alinear: "derecha" },
          { titulo: "% coste", alinear: "derecha" },
          { titulo: "Copa", alinear: "derecha", secundaria: true },
        ]}
        vacio="No hay vinos con este filtro. Los vinos salen aquí cuando su familia es de vino o tienen ficha."
        total={`${numero(vinos.length)} vinos`}
        filas={vinos.map((v) => ({
          id: v.productoId,
          tono: caro(v) ? ("error" as const) : !v.ficha ? ("aviso" as const) : undefined,
          celdas: [
            <span key="n">
              {v.nombre} {!v.ficha && <Etiqueta tono="aviso">Sin ficha</Etiqueta>}
              <span className="block text-xs text-slate-500">
                {[v.ficha?.bodega, v.ficha ? nombreTipoVino(v.ficha.tipo) : v.familia, v.ficha?.crianza, v.ficha && v.ficha.capacidadCl !== 75 ? `${numero(v.ficha.capacidadCl, 1)} cl` : null].filter(Boolean).join(" · ")}
              </span>
            </span>,
            v.ficha?.denominacion ?? "—",
            v.ficha?.anada ? String(v.ficha.anada) : "—",
            v.stock ? numero(v.stock, v.stock % 1 ? 2 : 0) : <span key="s" className="text-slate-400">0</span>,
            euros(v.coste),
            v.precioBotella != null ? euros(v.precioBotella) : v.ventas.length ? <span key="p" className="text-xs text-slate-500">Solo por copa</span> : <span key="p" className="text-slate-400">No está</span>,
            v.pctCoste != null ? <Etiqueta key="pc" tono={caro(v) ? "error" : "ok"}>{porcentaje(v.pctCoste)}</Etiqueta> : "—",
            v.precioCopa != null ? euros(v.precioCopa) : "—",
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Referencia", valor: v.referencia },
                  { etiqueta: "Familia", valor: v.familia },
                  { etiqueta: "Uva", valor: v.ficha?.uva ?? "—" },
                  { etiqueta: "Capacidad", valor: v.ficha ? `${numero(v.ficha.capacidadCl, 1)} cl` : "—" },
                  { etiqueta: "Stock por centro", valor: v.stockPorCentro.length ? v.stockPorCentro.map((s) => `${s.centro}: ${numero(s.stock, s.stock % 1 ? 2 : 0)}`).join(" · ") : "Sin stock" },
                  { etiqueta: "Copa", valor: v.precioCopa != null ? `${euros(v.precioCopa)}${v.copaCl ? ` (${numero(v.copaCl, 1)} cl)` : ""}` : "No se vende por copa" },
                  { etiqueta: "Maridaje", valor: v.ficha?.maridaje ?? "—" },
                  { etiqueta: "Para recomendarlo", valor: v.ficha?.argumentoVenta ?? "—" },
                ]}
              />
              {v.ficha?.notasCata && <p className="text-sm text-slate-600">{v.ficha.notasCata}</p>}
              {v.ventas.length > 0 && (
                <Tabla
                  clave={(x) => `${x.platoId}-${x.formato}`}
                  filas={v.ventas}
                  columnas={[
                    { titulo: "En la carta", celda: (x) => x.plato },
                    { titulo: "Formato", celda: (x) => x.formato },
                    { titulo: "Precio", alinear: "derecha", celda: (x) => euros(x.precio) },
                    { titulo: "Botellas", alinear: "derecha", celda: (x) => numero(x.cantidad, 3) },
                  ]}
                />
              )}
              <BotonEnlace href={`/bebidas/bodega/${v.productoId}`}>{puedeEditar ? (v.ficha ? "Editar ficha de vino" : "Hacer la ficha de vino") : "Ver ficha"}</BotonEnlace>
            </div>
          ),
        }))}
      />

      {puedeEditar && sinFicha.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Ficha de vino para otro producto">
            <form action="/bebidas/bodega" className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Producto de Bebidas sin ficha" ayuda="Un vino que está en otra familia, un vermut, un oporto…">
                <Selector name="ficha" required defaultValue="">
                  <option value="" disabled>
                    Elige un producto…
                  </option>
                  {sinFicha.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.referencia})
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Boton type="submit" variante="secundario">
                Hacer la ficha
              </Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
