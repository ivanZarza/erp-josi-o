import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fechaHora } from "@/kernel/formato";
import { Cabecera, Tarjeta, Selector, Boton, Campo, Entrada, Tabla, Vacio } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { almacenesDeCentros, SIN_UBICAR } from "@/nucleo/stock";
import { catalogoTraspaso, listarTraspasos } from "@/nucleo/traspasos";
import { normalizarNombre } from "@/nucleo/regla-almacen";
import { accionTraspaso } from "../acciones";
import { SelectorCantidades } from "../selector-cantidades";
import { Mensajes, Ocultos, rutaVolver, textosArea, uno, unidad, type PropsPagina } from "../comun";
import { centrosDelArea } from "./resumen";

/**
 * Traspasos entre almacenes del mismo centro (Bodega → Barra al reponer, Cámara → Congelador…).
 * Arriba se elige centro, de dónde y a dónde; abajo salen los productos con stock en el origen.
 * Si el destino es el sitio del producto y el centro tiene máximo (o mínimo), viene propuesta la cantidad para reponer.
 */
export async function PaginaTraspasos({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:stock:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const ids = centros.map((c) => c.id);
  const [almacenes, traspasos, usuarios] = await Promise.all([
    almacenesDeCentros(prisma, ids),
    listarTraspasos(prisma, ctx.tenant.id, area, ids),
    prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, nombre: true } }),
  ]);
  const quien = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const puede = ctx.puede(`${t.m}:traspasos:crear`);

  // centros con almacenes (con uno solo se puede colocar en él el stock «Sin ubicar»)
  const conDos = centros.filter((c) => almacenes.some((a) => a.centroId === c.id));
  const centroId = conDos.find((c) => c.id === uno(sp, "centro"))?.id ?? conDos.find((c) => c.id === ctx.centroActivo?.id)?.id ?? conDos.find((c) => c.tipo === "LOCAL")?.id ?? conDos[0]?.id;
  const suyos = almacenes.filter((a) => a.centroId === centroId);
  const buscar = (n: string) => suyos.find((a) => normalizarNombre(a.nombre).includes(n))?.id;
  const [defOrigen, defDestino] = area === "BEBIDAS" ? [buscar("bodega"), buscar("barra")] : [buscar("camara"), buscar("congelador")];
  // origen: un almacén o «Sin ubicar» (stock del centro que aún no está en ningún almacén)
  const origenId = uno(sp, "de") === SIN_UBICAR ? SIN_UBICAR : (suyos.find((a) => a.id === uno(sp, "de"))?.id ?? (suyos.length > 1 ? (defOrigen ?? suyos[0]?.id) : SIN_UBICAR));
  const destinoId = suyos.find((a) => a.id === uno(sp, "a"))?.id ?? (defDestino !== origenId ? defDestino : undefined) ?? suyos.find((a) => a.id !== origenId)?.id;
  const listo = puede && centroId && origenId && destinoId && origenId !== destinoId;
  const catalogo = listo ? await catalogoTraspaso(prisma, ctx.tenant.id, area, centroId, origenId === SIN_UBICAR ? null : origenId, destinoId) : [];
  const nombre = (id?: string) => (id === SIN_UBICAR ? "Sin ubicar" : (suyos.find((a) => a.id === id)?.nombre ?? "—"));
  const volver = rutaVolver(`/${t.m}/traspasos`, sp);
  const propuestas = Object.fromEntries(catalogo.filter((p) => p.propuesta > 0).map((p) => [p.id, p.propuesta]));

  return (
    <>
      <Cabecera titulo={`Traspasos de ${t.nombre.toLowerCase()}`} subtitulo="Pasar de un almacén a otro del mismo centro (por ejemplo, de la Bodega a la Barra al reponer). El stock del centro no cambia." />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        {puede &&
          (conDos.length === 0 ? (
            <Vacio>Ninguno de tus centros tiene almacenes: no hay nada que traspasar.</Vacio>
          ) : (
            <Tarjeta titulo="Nuevo traspaso">
              <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
                {conDos.length > 1 && (
                  <Campo etiqueta="Centro">
                    <Selector name="centro" defaultValue={centroId} className="w-auto">
                      {conDos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                )}
                <Campo etiqueta="De">
                  <Selector name="de" defaultValue={origenId} className="w-auto">
                    {suyos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                    <option value={SIN_UBICAR}>Sin ubicar</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="A">
                  <Selector name="a" defaultValue={destinoId} className="w-auto">
                    {suyos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Boton variante="secundario" type="submit">
                  Ver productos
                </Boton>
              </form>
              {!listo ? (
                <p className="text-sm text-slate-600">Elige dos almacenes distintos (o «Sin ubicar» como origen).</p>
              ) : catalogo.length === 0 ? (
                <p className="text-sm text-slate-600">
                  En {nombre(origenId)} no hay stock de {t.productos}.
                </p>
              ) : (
                <form action={accionTraspaso} className="space-y-3 pb-24 md:pb-0">
                  <Ocultos area={area} volver={volver} />
                  <input type="hidden" name="centroId" value={centroId} />
                  <input type="hidden" name="origenId" value={origenId} />
                  <input type="hidden" name="destinoId" value={destinoId} />
                  <p className="text-sm text-slate-600">
                    De <strong>{nombre(origenId)}</strong> a <strong>{nombre(destinoId)}</strong>. «Hay» es lo que queda en {nombre(origenId)}.
                    {Object.keys(propuestas).length > 0 && ` Vienen propuestas ${Object.keys(propuestas).length} cantidad(es) para llegar al máximo (o al mínimo) del centro.`}
                  </p>
                  <SelectorCantidades
                    productos={catalogo.map((p) => ({
                      id: p.id,
                      referencia: p.referencia,
                      nombre: `${p.nombre}${p.enDestino ? ` · en ${nombre(destinoId)}: ${numero(p.enDestino, 3)}` : ""}`,
                      unidad: unidad(p.unidad),
                      familia: p.familia,
                      disponible: p.enOrigen,
                    }))}
                    iniciales={propuestas}
                    mostrarDisponible
                    textoExceso={`No hay tanto en ${nombre(origenId)}: no se podrá hacer el traspaso.`}
                  />
                  <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-end gap-2 border-t border-slate-200 bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
                    <Entrada name="nota" placeholder="Nota (opcional)" className="min-w-0 flex-1 md:w-72 md:flex-none" />
                    <Boton type="submit">Hacer traspaso</Boton>
                  </div>
                </form>
              )}
            </Tarjeta>
          ))}

        <TablaDesplegable
          columnas={[
            { titulo: "Traspaso" },
            { titulo: "Fecha", secundaria: true },
            { titulo: "Centro", secundaria: true },
            { titulo: "De → a" },
            { titulo: "Productos", alinear: "derecha" },
            { titulo: "Valor", alinear: "derecha", secundaria: true },
          ]}
          vacio="Todavía no hay traspasos."
          filas={traspasos.map((d) => ({
            id: d.documento,
            celdas: [<span key="n" className="font-medium">{d.documento}</span>, fechaHora(d.fecha), d.centro, `${d.origen} → ${d.destino}`, numero(d.lineas.length), euros(d.valor)],
            detalle: (
              <div className="space-y-3">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Documento", valor: d.documento },
                    { etiqueta: "Fecha", valor: fechaHora(d.fecha) },
                    { etiqueta: "Centro", valor: d.centro },
                    { etiqueta: "De → a", valor: `${d.origen} → ${d.destino}` },
                    { etiqueta: "Motivo", valor: d.motivo ?? "—" },
                    { etiqueta: "Usuario", valor: d.usuarioId ? (quien.get(d.usuarioId) ?? "—") : "Sistema" },
                  ]}
                />
                <Tabla
                  clave={(l) => l.referencia}
                  filas={d.lineas}
                  columnas={[
                    { titulo: "Producto", celda: (l) => `${l.producto} (${l.referencia})` },
                    { titulo: "Cantidad", alinear: "derecha", celda: (l) => `${numero(l.cantidad, 3)} ${unidad(l.unidad)}` },
                  ]}
                />
              </div>
            ),
          }))}
        />
      </div>
    </>
  );
}
