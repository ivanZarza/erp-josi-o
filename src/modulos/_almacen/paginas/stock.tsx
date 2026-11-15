import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Entrada, Selector, Boton, Tabla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listadoStock, resumirStock, almacenesDeCentros, SIN_UBICAR, type EstadoStock, type FilaStock } from "@/nucleo/stock";
import { listarFamilias } from "@/nucleo/productos";
import { MOTIVOS_MERMA } from "@/nucleo/mermas";
import type { Contexto } from "@/kernel/contexto";
import type { AreaAlmacen } from "@/nucleo/comun-almacen";
import { accionAjustarCentro, accionMerma } from "../acciones";
import { EtiquetaStock, Mensajes, Ocultos, paraCampo, rutaVolver, textoCantidades, textosArea, uno, unidad, type PropsPagina } from "../comun";
import { centrosDelArea } from "./resumen";

export async function PaginaStock({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:stock:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const estado = uno(sp, "estado") as EstadoStock | "AVISOS" | "";
  const almacen = uno(sp, "almacen");
  const [filas, familias, almacenes] = await Promise.all([
    listadoStock(prisma, ctx.tenant.id, area, centros, { texto: uno(sp, "q"), familiaId: uno(sp, "familia") || undefined, estado: estado || undefined, almacen: almacen || undefined }),
    listarFamilias(prisma, ctx.tenant.id, area),
    almacenesDeCentros(prisma, centros.map((c) => c.id)),
  ]);
  // el filtro va por nombre: «Bodega» junta las bodegas de todos los centros elegidos
  const nombresAlmacen = Array.from(new Set(almacenes.map((a) => a.nombre))).sort((a, b) => a.localeCompare(b, "es"));
  const nombreFiltro = almacen === SIN_UBICAR ? "Sin ubicar" : almacen;
  const r = resumirStock(filas);
  const volver = rutaVolver(`/${t.m}/stock`, sp);
  const varios = centros.length > 1;

  return (
    <>
      <Cabecera
        titulo={`Stock de ${t.nombre.toLowerCase()}`}
        subtitulo={`${ctx.centroActivo ? ctx.centroActivo.nombre : `Suma de ${centros.length} centros`}${almacen ? ` · solo ${nombreFiltro}` : ""}. Al abrir una fila se ve cada centro y cada almacén.`}
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Valor" valor={euros(r.valor)} />
          <Cifra etiqueta="Referencias" valor={numero(r.referencias)} detalle={textoCantidades(r.cantidades)} />
          <Cifra etiqueta="Bajo mínimo" valor={numero(r.bajoMinimo)} tono={r.bajoMinimo ? "aviso" : "ok"} />
          <Cifra etiqueta="Sin stock" valor={numero(r.sinStock)} tono={r.sinStock ? "error" : "ok"} />
        </Rejilla>

        <form className="flex flex-wrap items-end gap-2" method="get">
          <div className="min-w-48 flex-1">
            <Entrada name="q" defaultValue={uno(sp, "q")} placeholder="Buscar por nombre, referencia o código de barras" type="search" />
          </div>
          <Selector name="familia" defaultValue={uno(sp, "familia")} className="w-auto">
            <option value="">Todas las familias</option>
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </Selector>
          {nombresAlmacen.length > 0 && (
            <Selector name="almacen" defaultValue={almacen} className="w-auto" aria-label="Almacén">
              <option value="">Todos los almacenes</option>
              {nombresAlmacen.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={SIN_UBICAR}>Sin ubicar</option>
            </Selector>
          )}
          <Selector name="estado" defaultValue={estado} className="w-auto">
            <option value="">Todos los estados</option>
            <option value="AVISOS">Con aviso</option>
            <option value="BAJO">Bajo mínimo</option>
            <option value="SIN">Sin stock</option>
            <option value="OK">Correcto</option>
          </Selector>
          <Boton variante="secundario" type="submit">
            Filtrar
          </Boton>
        </form>

        <TablaDesplegable
          columnas={[
            { titulo: "Producto" },
            { titulo: "Familia", secundaria: true },
            { titulo: "Proveedor", secundaria: true },
            { titulo: almacen ? `En ${nombreFiltro}` : "Stock", alinear: "derecha" },
            { titulo: "Mínimo", alinear: "derecha", secundaria: true },
            { titulo: "Estado" },
            { titulo: "Valor", alinear: "derecha" },
          ]}
          vacio={
            centros.length === 0
              ? `Ninguno de tus centros tiene activada el área de ${t.nombre}.`
              : uno(sp, "q") || estado || uno(sp, "familia") || almacen
                ? "No hay productos con ese filtro."
                : "No hay stock registrado. Llega con las compras recibidas y con los pedidos servidos."
          }
          total={`${filas.length} productos · ${euros(r.valor)}`}
          filas={filas.map((f) => ({
            id: f.producto.id,
            tono: f.estado === "SIN" ? ("error" as const) : f.estado === "BAJO" ? ("aviso" as const) : undefined,
            celdas: [
              <div key="p">
                <div className="font-medium">{f.producto.nombre}</div>
                <div className="text-xs text-slate-500">
                  {f.producto.referencia}
                  {!f.producto.activo && " · desactivado"}
                </div>
              </div>,
              f.producto.familia ?? "—",
              f.producto.proveedor ?? "—",
              <div key="s">
                {numero(f.total, 3)} {unidad(f.producto.unidad)}
                {almacen && f.total !== f.totalCentros && <div className="text-xs text-slate-500">de {numero(f.totalCentros, 3)} en el centro</div>}
              </div>,
              f.minimoTotal === null ? "—" : numero(f.minimoTotal, 3),
              <EtiquetaStock key="e" estado={f.estado} />,
              euros(f.valor),
            ],
            detalle: <DetalleStock fila={f} area={area} ctx={ctx} volver={volver} varios={varios} todosCentros={centros} almacenes={almacenes} />,
          }))}
        />
      </div>
    </>
  );
}

function DetalleStock({
  fila: f,
  area,
  ctx,
  volver,
  varios,
  todosCentros,
  almacenes,
}: {
  fila: FilaStock;
  area: AreaAlmacen;
  ctx: Contexto;
  volver: string;
  varios: boolean;
  todosCentros: { id: string; nombre: string }[];
  almacenes: { id: string; nombre: string; centroId: string }[];
}) {
  const t = textosArea(area);
  const puedeEditar = ctx.puede(`${t.m}:productos:editar`);
  const puedeMerma = ctx.puede(`${t.m}:mermas:crear`);
  const conStock = f.porCentro.filter((c) => c.stock > 0 && ctx.centros.some((x) => x.id === c.centro.id));
  const hayAlmacenes = f.porCentro.some((c) => c.almacenes.length > 0);
  // opciones de la merma: cada almacén con stock; si el centro no tiene almacenes, el centro entero
  const ubicaciones = conStock.flatMap((c) => {
    const conAlm = c.almacenes.filter((a) => a.id !== null && a.stock > 0);
    if (conAlm.length === 0) return [{ valor: `${c.centro.id}:`, texto: `${c.centro.nombre} (hay ${numero(c.stock, 3)})` }];
    return conAlm.map((a) => ({ valor: `${c.centro.id}:${a.id}`, texto: `${varios ? `${c.centro.nombre} · ` : ""}${a.nombre} (hay ${numero(a.stock, 3)})` }));
  });
  return (
    <div className="space-y-4">
      <DatosDetalle
        datos={[
          { etiqueta: "Referencia", valor: f.producto.referencia },
          { etiqueta: "Familia", valor: f.producto.familia ?? "—" },
          { etiqueta: "Proveedor", valor: f.producto.proveedor ?? "—" },
          { etiqueta: "Unidad", valor: unidad(f.producto.unidad) },
          { etiqueta: "Coste medio", valor: f.producto.sinCoste ? "Sin coste" : euros(f.producto.coste, 4) },
          { etiqueta: "Mínimo general", valor: `${numero(f.producto.stockMinimoGeneral, 3)} (obrador y almacenes)` },
          { etiqueta: "Código de barras", valor: f.producto.codigoBarras ?? "—" },
          {
            etiqueta: "Historial",
            valor: (
              <Link className="text-acento" href={`/${t.m}/movimientos?producto=${f.producto.id}`}>
                Ver movimientos
              </Link>
            ),
          },
        ]}
      />

      {(varios || puedeEditar || hayAlmacenes) && (
        <Tabla
          clave={(c) => c.centro.id}
          filas={f.porCentro}
          columnas={[
            { titulo: "Centro", celda: (c) => c.centro.nombre },
            { titulo: "Stock", alinear: "derecha", celda: (c) => numero(c.stock, 3) },
            { titulo: "Estado", celda: (c) => <EtiquetaStock estado={c.estado} /> },
            {
              titulo: "Por almacén",
              celda: (c) =>
                c.almacenes.length === 0 ? (
                  <span className="text-slate-400">Sin almacenes</span>
                ) : (
                  <ul className="space-y-0.5 text-sm">
                    {c.almacenes.map((a) => (
                      <li key={a.id ?? "sin"} className="flex justify-between gap-3">
                        <span className={a.id === null ? "text-amber-700" : ""}>
                          {a.nombre}
                          {a.porDefecto && <span className="text-xs text-slate-500"> · su sitio</span>}
                        </span>
                        <span className="tabular-nums">{numero(a.stock, 3)}</span>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              titulo: puedeEditar ? "Mínimo · máximo · tarifa al centro · se puede pedir" : "Mínimo · máximo · tarifa",
              celda: (c) =>
                puedeEditar ? (
                  <form action={accionAjustarCentro} className="flex flex-wrap items-center gap-1">
                    <Ocultos area={area} volver={volver} />
                    <input type="hidden" name="productoId" value={f.producto.id} />
                    <input type="hidden" name="centroId" value={c.centro.id} />
                    <Entrada name="minimo" inputMode="decimal" placeholder="mín." defaultValue={paraCampo(c.minimo)} className="w-20" aria-label="Mínimo" />
                    <Entrada name="maximo" inputMode="decimal" placeholder="máx." defaultValue={paraCampo(c.maximo)} className="w-20" aria-label="Máximo" />
                    <Entrada name="precioVenta" inputMode="decimal" placeholder="€ tarifa" defaultValue={paraCampo(c.precioVenta)} className="w-24" aria-label="Tarifa al centro" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="activoEnCentro" defaultChecked={c.activoEnCentro} /> pedible
                    </label>
                    {almacenes.some((a) => a.centroId === c.centro.id) && (
                      <Selector name="almacenId" defaultValue={c.almacenManualId ?? ""} className="w-auto" aria-label="Almacén por defecto">
                        <option value="">Su sitio: por familia{c.almacenDefectoId && !c.almacenManualId ? ` (${almacenes.find((a) => a.id === c.almacenDefectoId)?.nombre ?? "—"})` : ""}</option>
                        {almacenes
                          .filter((a) => a.centroId === c.centro.id)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              Su sitio: {a.nombre}
                            </option>
                          ))}
                      </Selector>
                    )}
                    <Boton variante="secundario" type="submit" className="min-h-9 px-3">
                      Guardar
                    </Boton>
                  </form>
                ) : (
                  `${c.minimo === null ? "—" : numero(c.minimo, 3)} · ${c.maximo === null ? "—" : numero(c.maximo, 3)} · ${c.precioVenta === null ? "coste" : euros(c.precioVenta)}`
                ),
            },
          ]}
        />
      )}
      {puedeEditar && (
        <p className="text-xs text-slate-500">
          El mínimo vacío en un local significa «sin control de mínimo». La tarifa es el precio al que el obrador sirve a ese centro; si está vacía se usa el coste. «Su sitio» es el
          almacén donde entra el producto en ese centro (compras, pedidos, producción) y del que sale primero; «por familia» lo decide solo (vinos a Bodega, cervezas y refrescos a
          Barra, refrigerados a Cámara…).
          {todosCentros.length > f.porCentro.length && " Para poner mínimo en un local que aún no aparece aquí, elígelo arriba en el selector de centro."}
        </p>
      )}

      {puedeMerma && ubicaciones.length > 0 && (
        <form action={accionMerma} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <Ocultos area={area} volver={volver} />
          <input type="hidden" name="productoId" value={f.producto.id} />
          <div className="w-full text-sm font-medium">Registrar rotura o merma</div>
          <Selector name="ubicacion" className="w-auto" defaultValue={ubicaciones[0].valor} aria-label="De dónde">
            {ubicaciones.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.texto}
              </option>
            ))}
          </Selector>
          <Entrada name="cantidad" inputMode="decimal" placeholder="Cantidad" required className="w-28" aria-label="Cantidad" />
          <Selector name="motivo" className="w-auto" required defaultValue="" aria-label="Motivo">
            <option value="" disabled>
              Motivo…
            </option>
            {MOTIVOS_MERMA.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Selector>
          <Entrada name="nota" placeholder="Nota (opcional)" className="w-56" />
          <Boton variante="peligro" type="submit">
            Dar de baja
          </Boton>
        </form>
      )}
    </div>
  );
}
