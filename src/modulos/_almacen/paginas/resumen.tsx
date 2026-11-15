import Link from "next/link";
import { exigir, type Contexto } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fechaHora } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Tarjeta, BotonEnlace, HuecoIntegracion } from "@/ui";
import { TablaDesplegable } from "@/ui/tabla-desplegable";
import { listadoStock, resumirStock } from "@/nucleo/stock";
import { moduloDeArea, type AreaAlmacen } from "@/nucleo/comun-almacen";
import { EtiquetaStock, EtiquetaPedido, Mensajes, textoCantidades, textosArea, unidad, type PropsPagina } from "../comun";

/** Centros en los que trabaja el área: el elegido arriba o todos los del usuario con el área activa. */
export function centrosDelArea(ctx: Contexto, area: AreaAlmacen) {
  const m = moduloDeArea(area);
  const base = ctx.centroActivo ? [ctx.centroActivo] : ctx.centros;
  return base.filter((c) => c.modulos.includes(m));
}

export async function PaginaResumen({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:stock:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const ids = centros.map((c) => c.id);

  const [filas, porServir, porConfirmar, comprasAbiertas, inventarios] = await Promise.all([
    listadoStock(prisma, ctx.tenant.id, area, centros),
    prisma.pedidoInterno.findMany({
      where: { tenantId: ctx.tenant.id, area, estado: "PENDIENTE", origenId: { in: ids } },
      include: { destino: { select: { nombre: true } }, _count: { select: { lineas: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pedidoInterno.count({ where: { tenantId: ctx.tenant.id, area, estado: "SERVIDO", destinoId: { in: ids } } }),
    prisma.pedidoCompra.count({ where: { tenantId: ctx.tenant.id, area, estado: { in: ["ENVIADO", "RECIBIDO_PARCIAL"] }, centroId: { in: ids } } }),
    prisma.inventario.groupBy({ by: ["estado"], where: { tenantId: ctx.tenant.id, area, estado: { not: "CERRADO" }, centroId: { in: ids } }, _count: true }),
  ]);
  const r = resumirStock(filas);
  const avisos = filas.filter((f) => f.estado !== "OK").sort((a, b) => (a.estado === b.estado ? a.producto.nombre.localeCompare(b.producto.nombre) : a.estado === "SIN" ? -1 : 1));
  const invAbiertos = inventarios.find((i) => i.estado === "ABIERTO")?._count ?? 0;
  const invPendientes = inventarios.find((i) => i.estado === "PENDIENTE_APROBACION")?._count ?? 0;

  // valor por familia
  const familias = new Map<string, { valor: number; refs: number }>();
  for (const f of filas) {
    const k = f.producto.familia ?? "Sin familia";
    const a = familias.get(k) ?? { valor: 0, refs: 0 };
    familias.set(k, { valor: a.valor + f.valor, refs: a.refs + 1 });
  }

  return (
    <>
      <Cabecera
        titulo={t.nombre}
        subtitulo={ctx.centroActivo ? `Datos de ${ctx.centroActivo.nombre}.` : `Datos de ${centros.length} centro(s). Elige uno arriba para ver solo ese.`}
        acciones={
          <>
            {ctx.puede(`${t.m}:pedidos:crear`) && <BotonEnlace href={`/${t.m}/pedidos/nuevo`}>Nuevo pedido</BotonEnlace>}
            {ctx.puede(`${t.m}:compras:crear`) && (
              <BotonEnlace href={`/${t.m}/compras/nueva`} variante="secundario">
                Nueva compra
              </BotonEnlace>
            )}
          </>
        }
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Valor del stock" valor={euros(r.valor)} detalle="a coste medio" href={`/${t.m}/stock`} />
          <Cifra etiqueta="Referencias" valor={numero(r.referencias)} detalle={textoCantidades(r.cantidades)} href={`/${t.m}/stock`} />
          <Cifra etiqueta="Bajo mínimo" valor={numero(r.bajoMinimo)} tono={r.bajoMinimo ? "aviso" : "ok"} href={`/${t.m}/stock?estado=BAJO`} />
          <Cifra etiqueta="Sin stock" valor={numero(r.sinStock)} tono={r.sinStock ? "error" : "ok"} href={`/${t.m}/stock?estado=SIN`} />
          <Cifra etiqueta="Pedidos por servir" valor={numero(porServir.length)} tono={porServir.length ? "aviso" : "normal"} href={`/${t.m}/pedidos?estado=PENDIENTE`} />
          <Cifra etiqueta="Pedidos por confirmar" valor={numero(porConfirmar)} detalle="servidos, falta que el local confirme" href={`/${t.m}/pedidos?estado=SERVIDO`} />
          <Cifra etiqueta="Compras por recibir" valor={numero(comprasAbiertas)} detalle="enviadas y recibidas en parte" href={`/${t.m}/compras?estado=POR_RECIBIR`} />
          <Cifra
            etiqueta="Inventarios abiertos"
            valor={numero(invAbiertos + invPendientes)}
            detalle={invPendientes ? `${numero(invAbiertos)} contando · ${numero(invPendientes)} pendiente(s) de aprobación` : invAbiertos ? `${numero(invAbiertos)} contando` : "ninguno sin cerrar"}
            tono={invPendientes ? "aviso" : "normal"}
            href={`/${t.m}/inventarios`}
          />
        </Rejilla>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Tarjeta titulo="Pedidos de locales por servir" acciones={<Link className="text-sm text-acento" href={`/${t.m}/pedidos`}>Ver todos</Link>}>
            <TablaDesplegable
              columnas={[{ titulo: "Pedido" }, { titulo: "Local" }, { titulo: "Líneas", alinear: "derecha" }, { titulo: "Hecho", secundaria: true }, { titulo: "Estado" }]}
              vacio="No hay pedidos pendientes de servir."
              filas={porServir.map((p) => ({
                id: p.id,
                celdas: [
                  <Link key="n" className="font-medium text-acento" href={`/${t.m}/pedidos/${p.id}`}>
                    {p.numero}
                  </Link>,
                  p.destino.nombre,
                  numero(p._count.lineas),
                  fechaHora(p.createdAt),
                  <EtiquetaPedido key="e" estado={p.estado} />,
                ],
              }))}
            />
          </Tarjeta>
          <Tarjeta titulo="Valor por familia">
            <TablaDesplegable
              columnas={[{ titulo: "Familia" }, { titulo: "Referencias", alinear: "derecha" }, { titulo: "Valor", alinear: "derecha" }]}
              vacio="Sin stock todavía."
              filas={Array.from(familias)
                .sort((a, b) => b[1].valor - a[1].valor)
                .map(([nombre, v]) => ({ id: nombre, celdas: [nombre, numero(v.refs), euros(v.valor)] }))}
            />
          </Tarjeta>
        </div>

        <Tarjeta titulo="Avisos de stock" acciones={<Link className="text-sm text-acento" href={`/${t.m}/stock?estado=AVISOS`}>Ver en Stock</Link>}>
          <TablaDesplegable
            columnas={[{ titulo: "Producto" }, { titulo: "Stock", alinear: "derecha" }, { titulo: "Mínimo", alinear: "derecha" }, { titulo: "Proveedor", secundaria: true }, { titulo: "Estado" }]}
            vacio="Todo el stock está por encima del mínimo."
            filas={avisos.slice(0, 15).map((f) => ({
              id: f.producto.id,
              tono: f.estado === "SIN" ? ("error" as const) : ("aviso" as const),
              celdas: [
                f.producto.nombre,
                `${numero(f.total, 3)} ${unidad(f.producto.unidad)}`,
                f.minimoTotal === null ? "—" : numero(f.minimoTotal, 3),
                f.producto.proveedor ?? "—",
                <EtiquetaStock key="e" estado={f.estado} />,
              ],
            }))}
            total={avisos.length > 15 ? `${avisos.length} avisos (se ven los 15 primeros)` : undefined}
          />
        </Tarjeta>

        {area === "BEBIDAS" ? (
          <HuecoIntegracion nombre="Importar BODEGA 360" descripcion="Traerá productos, proveedores, stock validado con un inventario inicial, y el historial de movimientos y albaranes de la app actual" />
        ) : (
          <HuecoIntegracion nombre="Carta al TPV" descripcion="Enviará los platos, precios y alérgenos de la carta al programa de caja de cada local" />
        )}
      </div>
    </>
  );
}
