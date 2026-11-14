import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Entrada, Selector, Boton, Tabla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listadoStock, resumirStock, type EstadoStock, type FilaStock } from "@/nucleo/stock";
import { listarFamilias } from "@/nucleo/productos";
import { MOTIVOS_MERMA } from "@/nucleo/mermas";
import type { Contexto } from "@/kernel/contexto";
import type { AreaAlmacen } from "@/nucleo/comun-almacen";
import { accionAjustarCentro, accionMerma } from "../acciones";
import { EtiquetaStock, Mensajes, Ocultos, paraCampo, rutaVolver, textosArea, uno, unidad, type PropsPagina } from "../comun";
import { centrosDelArea } from "./resumen";

export async function PaginaStock({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:stock:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const estado = uno(sp, "estado") as EstadoStock | "AVISOS" | "";
  const [filas, familias] = await Promise.all([
    listadoStock(prisma, ctx.tenant.id, area, centros, { texto: uno(sp, "q"), familiaId: uno(sp, "familia") || undefined, estado: estado || undefined }),
    listarFamilias(prisma, ctx.tenant.id, area),
  ]);
  const r = resumirStock(filas);
  const volver = rutaVolver(`/${t.m}/stock`, sp);
  const varios = centros.length > 1;

  return (
    <>
      <Cabecera titulo={`Stock de ${t.nombre.toLowerCase()}`} subtitulo={ctx.centroActivo ? ctx.centroActivo.nombre : `Suma de ${centros.length} centros; al abrir una fila se ve cada centro.`} />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Valor" valor={euros(r.valor)} />
          <Cifra etiqueta="Referencias" valor={numero(r.referencias)} detalle={`${numero(r.unidades)} unidades`} />
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
            { titulo: "Stock", alinear: "derecha" },
            { titulo: "Mínimo", alinear: "derecha", secundaria: true },
            { titulo: "Estado" },
            { titulo: "Valor", alinear: "derecha" },
          ]}
          vacio={
            centros.length === 0
              ? `Ninguno de tus centros tiene activada el área de ${t.nombre}.`
              : uno(sp, "q") || estado || uno(sp, "familia")
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
              `${numero(f.total, 3)} ${unidad(f.producto.unidad)}`,
              f.minimoTotal === null ? "—" : numero(f.minimoTotal, 3),
              <EtiquetaStock key="e" estado={f.estado} />,
              euros(f.valor),
            ],
            detalle: <DetalleStock fila={f} area={area} ctx={ctx} volver={volver} varios={varios} todosCentros={centros} />,
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
}: {
  fila: FilaStock;
  area: AreaAlmacen;
  ctx: Contexto;
  volver: string;
  varios: boolean;
  todosCentros: { id: string; nombre: string }[];
}) {
  const t = textosArea(area);
  const puedeEditar = ctx.puede(`${t.m}:productos:editar`);
  const puedeMerma = ctx.puede(`${t.m}:mermas:crear`);
  const conStock = f.porCentro.filter((c) => c.stock > 0);
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

      {(varios || puedeEditar) && (
        <Tabla
          clave={(c) => c.centro.id}
          filas={f.porCentro}
          columnas={[
            { titulo: "Centro", celda: (c) => c.centro.nombre },
            { titulo: "Stock", alinear: "derecha", celda: (c) => numero(c.stock, 3) },
            { titulo: "Estado", celda: (c) => <EtiquetaStock estado={c.estado} /> },
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
          El mínimo vacío en un local significa «sin control de mínimo». La tarifa es el precio al que el obrador sirve a ese centro; si está vacía se usa el coste.
          {todosCentros.length > f.porCentro.length && " Para poner mínimo en un local que aún no aparece aquí, elígelo arriba en el selector de centro."}
        </p>
      )}

      {puedeMerma && conStock.length > 0 && (
        <form action={accionMerma} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <Ocultos area={area} volver={volver} />
          <input type="hidden" name="productoId" value={f.producto.id} />
          <div className="w-full text-sm font-medium">Registrar rotura o merma</div>
          <Selector name="centroId" className="w-auto" defaultValue={conStock[0].centro.id} aria-label="Centro">
            {conStock
              .filter((c) => ctx.centros.some((x) => x.id === c.centro.id))
              .map((c) => (
                <option key={c.centro.id} value={c.centro.id}>
                  {c.centro.nombre} (hay {numero(c.stock, 3)})
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
