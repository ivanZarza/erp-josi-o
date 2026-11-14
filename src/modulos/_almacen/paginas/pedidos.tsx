import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fecha, fechaHora } from "@/kernel/formato";
import { Cabecera, Tarjeta, Selector, Boton, BotonEnlace, Campo, AreaTexto, Entrada, Aviso, Tabla, Vacio } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarPedidosInternos, leerPedidoInterno, catalogoParaPedir, importePedido } from "@/nucleo/pedidos";
import { stockEnCentro } from "@/nucleo/stock";
import { centrosQueSirven, num } from "@/nucleo/comun-almacen";
import {
  accionCrearPedido,
  accionEditarPedido,
  accionServirPedido,
  accionRecibirPedido,
  accionRechazarPedido,
  accionCancelarPedido,
} from "../acciones";
import { SelectorCantidades } from "../selector-cantidades";
import { EtiquetaPedido, Mensajes, Ocultos, rutaVolver, textosArea, uno, unidad, veCentro, paraCampo, type PropsPagina, type PropsPaginaId } from "../comun";
import { centrosDelArea } from "./resumen";

const ESTADOS = [
  ["", "Todos"],
  ["PENDIENTE", "Por servir"],
  ["SERVIDO", "Servidos por confirmar"],
  ["RECIBIDO", "Recibidos"],
  ["RECHAZADO", "Rechazados"],
  ["CANCELADO", "Cancelados"],
];

// ------------------------------------------------------------------ listado

export async function PaginaPedidos({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:pedidos:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const ids = centrosDelArea(ctx, area).map((c) => c.id);
  const estado = uno(sp, "estado");
  const pedidos = await listarPedidosInternos(prisma, ctx.tenant.id, area, ids, { estado: estado || undefined });

  return (
    <>
      <Cabecera
        titulo={`Pedidos de ${t.nombre.toLowerCase()}`}
        subtitulo="Lo que piden los locales al obrador. Mientras no se sirve, el local puede cambiarlo."
        acciones={ctx.puede(`${t.m}:pedidos:crear`) && <BotonEnlace href={`/${t.m}/pedidos/nuevo`}>Nuevo pedido</BotonEnlace>}
      />
      <Mensajes sp={sp} />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Selector name="estado" defaultValue={estado} className="w-auto">
          {ESTADOS.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </Selector>
        <Boton variante="secundario" type="submit">
          Filtrar
        </Boton>
      </form>
      <TablaDesplegable
        columnas={[
          { titulo: "Pedido" },
          { titulo: "Pide" },
          { titulo: "Sirve", secundaria: true },
          { titulo: "Líneas", alinear: "derecha", secundaria: true },
          { titulo: "Importe", alinear: "derecha" },
          { titulo: "Fecha", secundaria: true },
          { titulo: "Estado" },
        ]}
        vacio={estado ? "No hay pedidos en ese estado." : "Todavía no hay pedidos. Los locales los hacen desde «Nuevo pedido»."}
        filas={pedidos.map((p) => ({
          id: p.id,
          tono: p.estado === "PENDIENTE" ? ("aviso" as const) : undefined,
          celdas: [
            <Link key="n" href={`/${t.m}/pedidos/${p.id}`} className="font-medium text-acento">
              {p.numero}
            </Link>,
            p.destino.nombre,
            p.origen.nombre,
            numero(p.lineas.length),
            euros(importePedido(p)),
            fecha(p.createdAt),
            <EtiquetaPedido key="e" estado={p.estado} />,
          ],
          detalle: (
            <div className="space-y-3">
              <DatosDetalle
                datos={[
                  { etiqueta: "Hecho", valor: fechaHora(p.createdAt) },
                  { etiqueta: "Servido", valor: p.servidoEn ? fechaHora(p.servidoEn) : "—" },
                  { etiqueta: "Albarán", valor: p.albaran ?? "—" },
                  { etiqueta: "Notas", valor: p.notas ? <span className="whitespace-pre-line">{p.notas}</span> : "—" },
                ]}
              />
              <Tabla
                clave={(l) => l.id}
                filas={p.lineas}
                columnas={[
                  { titulo: "Producto", celda: (l) => l.producto.nombre },
                  { titulo: "Pedido", alinear: "derecha", celda: (l) => numero(num(l.pedida), 3) },
                  { titulo: "Servido", alinear: "derecha", celda: (l) => (l.servida === null ? "—" : numero(num(l.servida), 3)) },
                  { titulo: "Recibido", alinear: "derecha", celda: (l) => (l.recibida === null ? "—" : numero(num(l.recibida), 3)) },
                  { titulo: "Precio", alinear: "derecha", celda: (l) => (l.precio === null ? "—" : euros(num(l.precio))) },
                ]}
              />
              <BotonEnlace href={`/${t.m}/pedidos/${p.id}`}>{p.estado === "PENDIENTE" || p.estado === "SERVIDO" ? "Abrir para servir, cambiar o confirmar" : "Abrir pedido"}</BotonEnlace>
            </div>
          ),
        }))}
      />
    </>
  );
}

// ------------------------------------------------------------------ nuevo

export async function PaginaPedidoNuevo({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:pedidos:crear`);
  const sp = await searchParams;
  const prisma = await db();
  const origenes = await centrosQueSirven(prisma, ctx.tenant.id);
  const destinos = centrosDelArea(ctx, area).filter((c) => !origenes.some((o) => o.id === c.id));

  if (origenes.length === 0 || destinos.length === 0) {
    return (
      <>
        <Cabecera titulo="Nuevo pedido" />
        <Vacio>
          {origenes.length === 0
            ? "La cadena no tiene obrador ni almacén central del que pedir."
            : "Para pedir hay que elegir arriba un local (los pedidos los hace un local al obrador)."}
        </Vacio>
      </>
    );
  }
  const destinoId = destinos.length === 1 ? destinos[0].id : uno(sp, "destino");
  const origenId = origenes.length === 1 ? origenes[0].id : uno(sp, "origen") || origenes[0].id;
  const destino = destinos.find((d) => d.id === destinoId);

  if (!destino) {
    return (
      <>
        <Cabecera titulo="Nuevo pedido" subtitulo="¿Para qué local es el pedido?" />
        <Mensajes sp={sp} />
        <Tarjeta>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Campo etiqueta="Local que pide">
              <Selector name="destino" required defaultValue="">
                <option value="" disabled>
                  Elige el local…
                </option>
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Boton type="submit">Seguir</Boton>
          </form>
        </Tarjeta>
      </>
    );
  }

  const catalogo = await catalogoParaPedir(prisma, ctx.tenant.id, area, origenId, destino.id);
  const origen = origenes.find((o) => o.id === origenId)!;
  return (
    <>
      <Cabecera titulo="Nuevo pedido" subtitulo={`${destino.nombre} pide a ${origen.nombre}. Escribe solo las cantidades de lo que necesitas.`} />
      <Mensajes sp={sp} />
      {origenes.length > 1 && (
        <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="destino" value={destino.id} />
          <Selector name="origen" defaultValue={origenId} className="w-auto" aria-label="Centro que sirve">
            {origenes.map((o) => (
              <option key={o.id} value={o.id}>
                Pedir a {o.nombre}
              </option>
            ))}
          </Selector>
          <Boton variante="secundario" type="submit">
            Cambiar
          </Boton>
        </form>
      )}
      <form action={accionCrearPedido} className="space-y-4 pb-24">
        <Ocultos area={area} volver={rutaVolver(`/${t.m}/pedidos/nuevo`, sp)} />
        <input type="hidden" name="origenId" value={origenId} />
        <input type="hidden" name="destinoId" value={destino.id} />
        {catalogo.length === 0 ? (
          <Vacio>No hay productos activos para pedir.</Vacio>
        ) : (
          <SelectorCantidades productos={catalogo} mostrarDisponible />
        )}
        <Campo etiqueta="Notas para el obrador (opcional)">
          <AreaTexto name="notas" rows={2} />
        </Campo>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
          <Boton type="submit" className="w-full md:w-auto">
            Enviar pedido
          </Boton>
        </div>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ ficha

export async function PaginaPedido({ area, searchParams, params }: PropsPaginaId) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:pedidos:ver`);
  const sp = await searchParams;
  const { id } = await params;
  const prisma = await db();
  const p = await leerPedidoInterno(prisma, ctx.tenant.id, area, id);
  if (!p || (!veCentro(ctx, p.origenId) && !veCentro(ctx, p.destinoId))) notFound();
  const volver = rutaVolver(`/${t.m}/pedidos/${p.id}`, sp);

  const puedeServir = p.estado === "PENDIENTE" && ctx.puede(`${t.m}:pedidos:servir`) && veCentro(ctx, p.origenId);
  const puedeCambiar = p.estado === "PENDIENTE" && ctx.puede(`${t.m}:pedidos:crear`) && veCentro(ctx, p.destinoId);
  const puedeRecibir = p.estado === "SERVIDO" && ctx.puede(`${t.m}:pedidos:recibir`) && veCentro(ctx, p.destinoId);
  const disponible = puedeServir ? await stockEnCentro(prisma, ctx.tenant.id, area, p.origenId) : new Map<string, number>();
  const catalogo = puedeCambiar ? await catalogoParaPedir(prisma, ctx.tenant.id, area, p.origenId, p.destinoId) : [];

  return (
    <>
      <Cabecera
        titulo={`Pedido ${p.numero}`}
        subtitulo={`${p.destino.nombre} pide a ${p.origen.nombre} · ${fechaHora(p.createdAt)}`}
        acciones={
          <BotonEnlace href={`/${t.m}/pedidos`} variante="secundario">
            Volver a pedidos
          </BotonEnlace>
        }
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <Tarjeta>
          <DatosDetalle
            datos={[
              { etiqueta: "Estado", valor: <EtiquetaPedido estado={p.estado} /> },
              { etiqueta: "Importe", valor: euros(importePedido(p)) },
              { etiqueta: "Albarán de salida", valor: p.albaran ?? "—" },
              { etiqueta: "Servido", valor: p.servidoEn ? fechaHora(p.servidoEn) : "—" },
              { etiqueta: "Notas", valor: p.notas ? <span className="whitespace-pre-line">{p.notas}</span> : "—" },
            ]}
          />
        </Tarjeta>

        {puedeServir ? (
          <Tarjeta titulo="Servir">
            <form action={accionServirPedido} className="space-y-3">
              <Ocultos area={area} volver={volver} id={p.id} />
              <p className="text-sm text-slate-600">Cada cantidad viene propuesta con lo pedido limitado a lo que hay. Al servir se hace el albarán de salida y se mueve el stock.</p>
              <Tabla
                clave={(l) => l.id}
                filas={p.lineas}
                columnas={[
                  { titulo: "Producto", celda: (l) => `${l.producto.nombre} (${l.producto.referencia})` },
                  { titulo: "Pedido", alinear: "derecha", celda: (l) => numero(num(l.pedida), 3) },
                  {
                    titulo: "Hay",
                    alinear: "derecha",
                    celda: (l) => {
                      const h = disponible.get(l.productoId) ?? 0;
                      return <span className={h < num(l.pedida) ? "font-medium text-amber-700" : ""}>{numero(h, 3)}</span>;
                    },
                  },
                  {
                    titulo: "Servir",
                    alinear: "derecha",
                    celda: (l) => (
                      <Entrada
                        name={`s_${l.id}`}
                        inputMode="decimal"
                        defaultValue={paraCampo(Math.max(0, Math.min(num(l.pedida), disponible.get(l.productoId) ?? 0)))}
                        className="ml-auto w-24 text-right"
                        aria-label={`Servir ${l.producto.nombre}`}
                      />
                    ),
                  },
                ]}
              />
              <Boton type="submit">Servir y hacer albarán</Boton>
            </form>
            <form action={accionRechazarPedido} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
              <Ocultos area={area} volver={volver} id={p.id} />
              <div className="min-w-60 flex-1">
                <Entrada name="motivo" required placeholder="Motivo del rechazo (lo verá el local)" />
              </div>
              <Boton variante="peligro" type="submit">
                Rechazar pedido
              </Boton>
            </form>
          </Tarjeta>
        ) : puedeRecibir ? (
          <Tarjeta titulo="Confirmar lo recibido">
            <form action={accionRecibirPedido} className="space-y-3">
              <Ocultos area={area} volver={volver} id={p.id} />
              <p className="text-sm text-slate-600">Si ha llegado algo distinto de lo servido, cambia la cantidad: el stock del local se regulariza y queda anotado.</p>
              <Tabla
                clave={(l) => l.id}
                filas={p.lineas.filter((l) => num(l.servida) > 0 || num(l.pedida) > 0)}
                columnas={[
                  { titulo: "Producto", celda: (l) => l.producto.nombre },
                  { titulo: "Pedido", alinear: "derecha", celda: (l) => numero(num(l.pedida), 3) },
                  { titulo: "Servido", alinear: "derecha", celda: (l) => numero(num(l.servida), 3) },
                  {
                    titulo: "Recibido",
                    alinear: "derecha",
                    celda: (l) => <Entrada name={`r_${l.id}`} inputMode="decimal" defaultValue={paraCampo(num(l.servida))} className="ml-auto w-24 text-right" aria-label={`Recibido ${l.producto.nombre}`} />,
                  },
                ]}
              />
              <Entrada name="nota" placeholder="Nota sobre la recepción (por ejemplo, «2 botellas rotas»)" />
              <Boton type="submit">Confirmar recepción</Boton>
            </form>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Líneas">
            <Tabla
              clave={(l) => l.id}
              filas={p.lineas}
              columnas={[
                { titulo: "Producto", celda: (l) => `${l.producto.nombre} (${l.producto.referencia})` },
                { titulo: "Pedido", alinear: "derecha", celda: (l) => `${numero(num(l.pedida), 3)} ${unidad(l.producto.unidad)}` },
                { titulo: "Servido", alinear: "derecha", celda: (l) => (l.servida === null ? "—" : numero(num(l.servida), 3)) },
                { titulo: "Recibido", alinear: "derecha", celda: (l) => (l.recibida === null ? "—" : numero(num(l.recibida), 3)) },
                { titulo: "Precio", alinear: "derecha", celda: (l) => (l.precio === null ? "—" : euros(num(l.precio))) },
              ]}
            />
            {p.estado === "PENDIENTE" && !puedeCambiar && <p className="mt-3 text-sm text-slate-500">Pendiente de que lo sirva {p.origen.nombre}.</p>}
            {p.estado === "SERVIDO" && !puedeRecibir && <p className="mt-3 text-sm text-slate-500">Falta que {p.destino.nombre} confirme lo recibido.</p>}
          </Tarjeta>
        )}

        {puedeCambiar && (
          <Tarjeta titulo="Cambiar el pedido">
            <form action={accionEditarPedido} className="space-y-3">
              <Ocultos area={area} volver={volver} id={p.id} />
              <SelectorCantidades productos={catalogo} iniciales={Object.fromEntries(p.lineas.map((l) => [l.productoId, num(l.pedida)]))} mostrarDisponible />
              <Campo etiqueta="Notas">
                <AreaTexto name="notas" rows={2} defaultValue={p.notas ?? ""} />
              </Campo>
              <Boton type="submit">Guardar cambios</Boton>
            </form>
            <form action={accionCancelarPedido} className="mt-4 border-t border-slate-200 pt-4">
              <Ocultos area={area} volver={volver} id={p.id} />
              <Boton variante="peligro" type="submit">
                Cancelar el pedido
              </Boton>
            </form>
          </Tarjeta>
        )}
        {p.estado === "RECHAZADO" && <Aviso tono="error">Este pedido se rechazó. El motivo está en las notas.</Aviso>}
      </div>
    </>
  );
}
