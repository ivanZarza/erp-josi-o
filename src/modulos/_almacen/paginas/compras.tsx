import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fecha, fechaHora } from "@/kernel/formato";
import { Cabecera, Tarjeta, Selector, Boton, BotonEnlace, Campo, AreaTexto, Entrada, Aviso, Tabla, Vacio } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarCompras, leerCompra, importeCompra, textoWhatsApp, enlaceWhatsApp, propuestaCompra } from "@/nucleo/compras";
import { listarProductos } from "@/nucleo/productos";
import { num } from "@/nucleo/comun-almacen";
import { almacenesDeCentros } from "@/nucleo/stock";
import { proveedoresDeArea } from "@/modulos/proveedores/servicio";
import { accionCrearCompra, accionEditarCompra, accionEnviarCompra, accionRecibirCompra, accionCancelarCompra } from "../acciones";
import { SelectorCantidades, type ProductoSeleccionable } from "../selector-cantidades";
import { EtiquetaCompra, Mensajes, Ocultos, SelectorAlmacen, rutaVolver, textosArea, uno, unidad, veCentro, paraCampo, type PropsPagina, type PropsPaginaId } from "../comun";
import { centrosDelArea } from "./resumen";

const ESTADOS = [
  ["", "Todas"],
  ["BORRADOR", "Sin enviar"],
  ["ENVIADO", "Enviadas, por recibir"],
  ["RECIBIDO_PARCIAL", "Recibidas en parte"],
  ["RECIBIDO", "Recibidas"],
  ["CANCELADO", "Canceladas"],
];

const VIA: Record<string, string> = { whatsapp: "WhatsApp", email: "correo", telefono: "teléfono" };

// ------------------------------------------------------------------ listado

export async function PaginaCompras({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:compras:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const ids = centrosDelArea(ctx, area).map((c) => c.id);
  const estado = uno(sp, "estado");
  const compras = await listarCompras(prisma, ctx.tenant.id, area, ids, { estado: estado || undefined });

  return (
    <>
      <Cabecera
        titulo={`Compras de ${t.nombre.toLowerCase()}`}
        subtitulo="Pedidos a proveedores. Solo suman stock cuando se recibe la mercancía."
        acciones={ctx.puede(`${t.m}:compras:crear`) && <BotonEnlace href={`/${t.m}/compras/nueva`}>Nueva compra</BotonEnlace>}
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
          { titulo: "Compra" },
          { titulo: "Proveedor" },
          { titulo: "Recibe", secundaria: true },
          { titulo: "Líneas", alinear: "derecha", secundaria: true },
          { titulo: "Importe", alinear: "derecha" },
          { titulo: "Fecha", secundaria: true },
          { titulo: "Estado" },
        ]}
        vacio={estado ? "No hay compras en ese estado." : "Todavía no hay compras. Crea una con «Nueva compra»."}
        filas={compras.map((c) => ({
          id: c.id,
          celdas: [
            <Link key="n" href={`/${t.m}/compras/${c.id}`} className="font-medium text-acento">
              {c.numero}
            </Link>,
            c.proveedor.nombre,
            c.centro.nombre,
            numero(c.lineas.length),
            euros(importeCompra(c)),
            fecha(c.createdAt),
            <EtiquetaCompra key="e" estado={c.estado} />,
          ],
          detalle: (
            <div className="space-y-3">
              <DatosDetalle
                datos={[
                  { etiqueta: "Enviada", valor: c.enviadoEn ? `${fechaHora(c.enviadoEn)} por ${VIA[c.enviadoPor ?? ""] ?? c.enviadoPor}` : "—" },
                  { etiqueta: "Recibida", valor: c.recibidoEn ? fechaHora(c.recibidoEn) : "—" },
                  { etiqueta: "Albaranes de entrada", valor: c.albaran ?? "—" },
                  { etiqueta: "Notas", valor: c.notas ? <span className="whitespace-pre-line">{c.notas}</span> : "—" },
                ]}
              />
              <Tabla
                clave={(l) => l.id}
                filas={c.lineas}
                columnas={[
                  { titulo: "Producto", celda: (l) => l.producto.nombre },
                  { titulo: "Pedido", alinear: "derecha", celda: (l) => numero(num(l.cantidad), 3) },
                  { titulo: "Recibido", alinear: "derecha", celda: (l) => (l.recibida === null ? "—" : numero(num(l.recibida), 3)) },
                  { titulo: "Precio", alinear: "derecha", celda: (l) => euros(num(l.precio), 4) },
                ]}
              />
              <BotonEnlace href={`/${t.m}/compras/${c.id}`}>{c.estado === "RECIBIDO" || c.estado === "CANCELADO" ? "Abrir compra" : "Abrir para enviar o recibir"}</BotonEnlace>
            </div>
          ),
        }))}
      />
    </>
  );
}

// ------------------------------------------------------------------ nueva

export async function PaginaCompraNueva({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:compras:crear`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const proveedores = await proveedoresDeArea(prisma, ctx.tenant.id, area);
  const proveedorId = uno(sp, "proveedor");
  const centroId = centros.length === 1 ? centros[0].id : uno(sp, "centro");
  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const centro = centros.find((c) => c.id === centroId);

  if (centros.length === 0) {
    return (
      <>
        <Cabecera titulo="Nueva compra" />
        <Vacio>Ninguno de tus centros tiene activada el área de {t.nombre}.</Vacio>
      </>
    );
  }

  if (!proveedor || !centro) {
    const porDefecto = centroId || centros.find((c) => c.tipo !== "LOCAL")?.id || "";
    return (
      <>
        <Cabecera titulo="Nueva compra" subtitulo="Elige a quién se compra y dónde se recibe." />
        <Mensajes sp={sp} />
        <Tarjeta>
          <form method="get" className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <Campo etiqueta="Proveedor">
              <Selector name="proveedor" required defaultValue={proveedorId}>
                <option value="">Elige el proveedor…</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Centro que recibe">
              <Selector name="centro" required defaultValue={porDefecto}>
                <option value="">Elige el centro…</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Boton type="submit">Seguir</Boton>
          </form>
        </Tarjeta>
        {proveedores.length === 0 && (
          <div className="mt-4">
            <Aviso tono="aviso">
              No hay proveedores de {t.nombre.toLowerCase()}. <Link href="/proveedores/nuevo" className="text-acento underline">Da de alta uno</Link>.
            </Aviso>
          </div>
        )}
      </>
    );
  }

  const todos = uno(sp, "todos") === "1";
  const conPropuesta = uno(sp, "propuesta") === "1";
  const productos = await listarProductos(prisma, ctx.tenant.id, area, todos ? {} : { proveedorId: proveedor.id });
  const propuesta = conPropuesta ? await propuestaCompra(prisma, ctx.tenant.id, area, centro.id, todos ? undefined : proveedor.id) : new Map<string, number>();
  const lista: ProductoSeleccionable[] = productos.map((p) => ({
    id: p.id,
    referencia: p.referencia,
    nombre: p.nombre,
    unidad: p.unidad,
    familia: p.familia?.nombre ?? "Sin familia",
    precio: num(p.costeUnitario),
  }));
  const base = `/${t.m}/compras/nueva?proveedor=${proveedor.id}&centro=${centro.id}`;

  return (
    <>
      <Cabecera titulo={`Compra a ${proveedor.nombre}`} subtitulo={`Se recibe en ${centro.nombre}. El precio propuesto es el coste medio actual; cámbialo si el proveedor tiene otro.`} />
      <Mensajes sp={sp} />
      <div className="mb-3 flex flex-wrap gap-2">
        <BotonEnlace variante="secundario" href={`${base}${todos ? "" : "&todos=1"}${conPropuesta ? "&propuesta=1" : ""}`}>
          {todos ? "Ver solo los productos de este proveedor" : "Ver todos los productos del área"}
        </BotonEnlace>
        <BotonEnlace variante="secundario" href={`${base}${todos ? "&todos=1" : ""}&propuesta=1`}>
          Rellenar con lo que está bajo mínimo
        </BotonEnlace>
        <BotonEnlace variante="secundario" href={`/${t.m}/compras/nueva`}>
          Cambiar proveedor
        </BotonEnlace>
      </div>
      {conPropuesta && propuesta.size === 0 && (
        <div className="mb-3">
          <Aviso>No hay nada bajo mínimo en {centro.nombre} para estos productos.</Aviso>
        </div>
      )}
      <form action={accionCrearCompra} className="space-y-4">
        <Ocultos area={area} volver={rutaVolver(`/${t.m}/compras/nueva`, sp)} />
        <input type="hidden" name="proveedorId" value={proveedor.id} />
        <input type="hidden" name="centroId" value={centro.id} />
        {lista.length === 0 ? (
          <Vacio>
            Este proveedor no tiene productos asignados. Pulsa «Ver todos los productos del área» o asígnaselos en Productos.
          </Vacio>
        ) : (
          <SelectorCantidades productos={lista} conPrecio iniciales={Object.fromEntries(propuesta)} />
        )}
        <Campo etiqueta="Notas para el proveedor (opcional)">
          <AreaTexto name="notas" rows={2} placeholder="Por ejemplo: entregar antes de las 11:00" />
        </Campo>
        <Boton type="submit">Preparar compra</Boton>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ ficha

export async function PaginaCompra({ area, searchParams, params }: PropsPaginaId) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:compras:ver`);
  const sp = await searchParams;
  const { id } = await params;
  const prisma = await db();
  const c = await leerCompra(prisma, ctx.tenant.id, area, id);
  if (!c || !veCentro(ctx, c.centroId)) notFound();
  const volver = rutaVolver(`/${t.m}/compras/${c.id}`, sp);
  const abierta = c.estado === "BORRADOR" || c.estado === "ENVIADO";
  const puedeCrear = ctx.puede(`${t.m}:compras:crear`);
  const puedeRecibir = ctx.puede(`${t.m}:compras:recibir`) && (abierta || c.estado === "RECIBIDO_PARCIAL");
  const almacenes = puedeRecibir ? await almacenesDeCentros(prisma, [c.centroId]) : [];

  const texto = textoWhatsApp({
    numero: c.numero,
    cadena: ctx.tenant.nombre,
    centro: c.centro.nombre,
    contacto: c.proveedor.contacto,
    notas: c.notas,
    lineas: c.lineas.map((l) => ({ nombre: l.producto.nombre, referencia: l.producto.referencia, unidad: l.producto.unidad, cantidad: num(l.cantidad) })),
  });
  const enlace = enlaceWhatsApp(c.proveedor.telefono, texto);

  let catalogo: ProductoSeleccionable[] = [];
  if (abierta && puedeCrear) {
    const prods = await listarProductos(prisma, ctx.tenant.id, area, {});
    const enCompra = new Set(c.lineas.map((l) => l.productoId));
    const precioLinea = new Map(c.lineas.map((l) => [l.productoId, num(l.precio)]));
    catalogo = prods
      .filter((p) => p.proveedorId === c.proveedorId || enCompra.has(p.id))
      .map((p) => ({ id: p.id, referencia: p.referencia, nombre: p.nombre, unidad: p.unidad, familia: p.familia?.nombre ?? "Sin familia", precio: precioLinea.get(p.id) ?? num(p.costeUnitario) }));
  }

  return (
    <>
      <Cabecera
        titulo={`Compra ${c.numero}`}
        subtitulo={`${c.proveedor.nombre} · se recibe en ${c.centro.nombre} · ${fechaHora(c.createdAt)}`}
        acciones={
          <BotonEnlace href={`/${t.m}/compras`} variante="secundario">
            Volver a compras
          </BotonEnlace>
        }
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <Tarjeta>
          <DatosDetalle
            datos={[
              { etiqueta: "Estado", valor: <EtiquetaCompra estado={c.estado} /> },
              { etiqueta: "Importe", valor: euros(importeCompra(c)) },
              { etiqueta: "Enviada", valor: c.enviadoEn ? `${fechaHora(c.enviadoEn)} por ${VIA[c.enviadoPor ?? ""] ?? c.enviadoPor}` : "—" },
              { etiqueta: "Albaranes de entrada", valor: c.albaran ?? "—" },
              { etiqueta: "Contacto", valor: [c.proveedor.contacto, c.proveedor.telefono].filter(Boolean).join(" · ") || "—" },
              { etiqueta: "Correo", valor: c.proveedor.email ?? "—" },
              { etiqueta: "Días de reparto", valor: c.proveedor.diasReparto ?? "—" },
              { etiqueta: "Pedido mínimo", valor: c.proveedor.pedidoMinimo ? euros(num(c.proveedor.pedidoMinimo)) : "—" },
            ]}
          />
          {c.proveedor.pedidoMinimo && importeCompra(c) < num(c.proveedor.pedidoMinimo) && (
            <div className="mt-3">
              <Aviso tono="aviso">El importe no llega al pedido mínimo del proveedor ({euros(num(c.proveedor.pedidoMinimo))}).</Aviso>
            </div>
          )}
        </Tarjeta>

        {abierta && puedeCrear && (
          <Tarjeta titulo="Enviar al proveedor">
            <pre className="mb-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{texto}</pre>
            <div className="flex flex-wrap items-end gap-2">
              {enlace ? (
                <a href={enlace} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-md bg-acento px-4 text-sm font-medium text-white hover:opacity-90">
                  Abrir WhatsApp con el pedido
                </a>
              ) : (
                <Aviso tono="aviso">
                  El proveedor no tiene un teléfono válido en formato +34…: <Link href="/proveedores" className="underline">corrígelo en Proveedores</Link> para enviarlo por WhatsApp.
                </Aviso>
              )}
              <form action={accionEnviarCompra} className="flex flex-wrap items-end gap-2">
                <Ocultos area={area} volver={volver} id={c.id} />
                <Selector name="via" defaultValue={c.enviadoPor ?? "whatsapp"} className="w-auto" aria-label="Enviado por">
                  <option value="whatsapp">Enviado por WhatsApp</option>
                  <option value="email">Enviado por correo</option>
                  <option value="telefono">Pedido por teléfono</option>
                </Selector>
                <Boton variante="secundario" type="submit">
                  {c.estado === "ENVIADO" ? "Cambiar cómo se envió" : "Marcar como enviada"}
                </Boton>
              </form>
            </div>
          </Tarjeta>
        )}

        {puedeRecibir ? (
          <Tarjeta titulo="Recibir mercancía">
            <form action={accionRecibirCompra} className="space-y-3">
              <Ocultos area={area} volver={volver} id={c.id} />
              <p className="text-sm text-slate-600">
                Escribe lo que ha llegado de verdad y el precio del albarán. Solo esto suma stock y recalcula el coste medio.
              </p>
              <Tabla
                clave={(l) => l.id}
                filas={c.lineas}
                columnas={[
                  { titulo: "Producto", celda: (l) => `${l.producto.nombre} (${l.producto.referencia})` },
                  { titulo: "Pedido", alinear: "derecha", celda: (l) => `${numero(num(l.cantidad), 3)} ${unidad(l.producto.unidad)}` },
                  { titulo: "Ya recibido", alinear: "derecha", celda: (l) => numero(num(l.recibida), 3) },
                  {
                    titulo: "Llega ahora",
                    alinear: "derecha",
                    celda: (l) => (
                      <Entrada
                        name={`r_${l.id}`}
                        inputMode="decimal"
                        defaultValue={paraCampo(Math.max(0, num(l.cantidad) - num(l.recibida)))}
                        className="ml-auto w-24 text-right"
                        aria-label={`Llega ahora ${l.producto.nombre}`}
                      />
                    ),
                  },
                  {
                    titulo: "€/ud",
                    alinear: "derecha",
                    celda: (l) => <Entrada name={`p_${l.id}`} inputMode="decimal" defaultValue={paraCampo(num(l.precio))} className="ml-auto w-24 text-right" aria-label={`Precio ${l.producto.nombre}`} />,
                  },
                ]}
              />
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-64">
                  <Campo etiqueta="Número del albarán del proveedor">
                    <Entrada name="albaranProveedor" placeholder="Opcional" />
                  </Campo>
                </div>
                {almacenes.length > 0 && (
                  <Campo etiqueta="Entra en">
                    <SelectorAlmacen almacenes={almacenes} />
                  </Campo>
                )}
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" name="cerrar" /> Cerrar la compra aunque falte algo
                </label>
              </div>
              <Boton type="submit">Guardar recepción</Boton>
            </form>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Líneas">
            <Tabla
              clave={(l) => l.id}
              filas={c.lineas}
              columnas={[
                { titulo: "Producto", celda: (l) => `${l.producto.nombre} (${l.producto.referencia})` },
                { titulo: "Pedido", alinear: "derecha", celda: (l) => `${numero(num(l.cantidad), 3)} ${unidad(l.producto.unidad)}` },
                { titulo: "Recibido", alinear: "derecha", celda: (l) => (l.recibida === null ? "—" : numero(num(l.recibida), 3)) },
                { titulo: "€/ud", alinear: "derecha", celda: (l) => euros(num(l.precio), 4) },
                { titulo: "Importe", alinear: "derecha", celda: (l) => euros(num(l.cantidad) * num(l.precio)) },
              ]}
            />
          </Tarjeta>
        )}

        {abierta && puedeCrear && (
          <Tarjeta titulo="Cambiar la compra">
            <form action={accionEditarCompra} className="space-y-3">
              <Ocultos area={area} volver={volver} id={c.id} />
              <SelectorCantidades productos={catalogo} conPrecio iniciales={Object.fromEntries(c.lineas.map((l) => [l.productoId, num(l.cantidad)]))} />
              <Campo etiqueta="Notas">
                <AreaTexto name="notas" rows={2} defaultValue={c.notas ?? ""} />
              </Campo>
              <Boton type="submit">Guardar cambios</Boton>
            </form>
            <form action={accionCancelarCompra} className="mt-4 border-t border-slate-200 pt-4">
              <Ocultos area={area} volver={volver} id={c.id} />
              <Boton variante="peligro" type="submit">
                Cancelar la compra
              </Boton>
            </form>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
