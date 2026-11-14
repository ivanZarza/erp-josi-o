import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fechaHora } from "@/kernel/formato";
import { Cabecera, Entrada, Selector, Boton } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarMovimientos, almacenesDeCentros, SIN_UBICAR } from "@/nucleo/stock";
import { num } from "@/nucleo/comun-almacen";
import { Mensajes, TIPOS_MOVIMIENTO, textosArea, uno, unidad, type PropsPagina } from "../comun";
import { centrosDelArea } from "./resumen";

/** Fecha «aaaa-mm-dd» del filtro a Date (medianoche en la hora del servidor; `sumar` días para el «hasta» inclusivo). */
function dia(s: string, sumar = 0): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + sumar);
  return d;
}

export async function PaginaMovimientos({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:stock:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const ids = centros.map((c) => c.id);
  const productoId = uno(sp, "producto");
  const almacen = uno(sp, "almacen");
  const [movs, usuarios, producto, almacenes] = await Promise.all([
    listarMovimientos(prisma, ctx.tenant.id, area, ids, {
      tipo: uno(sp, "tipo") || undefined,
      texto: uno(sp, "q"),
      productoId: productoId || undefined,
      desde: dia(uno(sp, "desde")),
      hasta: dia(uno(sp, "hasta"), 1),
      almacen: almacen || undefined,
    }),
    prisma.usuario.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, nombre: true } }),
    productoId ? prisma.producto.findFirst({ where: { id: productoId, tenantId: ctx.tenant.id, area }, select: { nombre: true } }) : null,
    almacenesDeCentros(prisma, ids, { conInactivos: true }),
  ]);
  const nombresAlmacen = Array.from(new Set(almacenes.map((a) => a.nombre))).sort((a, b) => a.localeCompare(b, "es"));
  const quien = new Map(usuarios.map((u) => [u.id, u.nombre]));

  return (
    <>
      <Cabecera titulo={`Movimientos de ${t.nombre.toLowerCase()}`} subtitulo={producto ? `Solo ${producto.nombre}.` : "Todo lo que entra y sale, con quién, cuándo y por qué. Se ven los 300 últimos con el filtro."} />
      <Mensajes sp={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        {productoId && <input type="hidden" name="producto" value={productoId} />}
        <div className="min-w-48 flex-1">
          <Entrada name="q" type="search" defaultValue={uno(sp, "q")} placeholder="Buscar producto o referencia" />
        </div>
        <Selector name="tipo" defaultValue={uno(sp, "tipo")} className="w-auto">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
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
        <Entrada type="date" name="desde" defaultValue={uno(sp, "desde")} className="w-auto" aria-label="Desde" />
        <Entrada type="date" name="hasta" defaultValue={uno(sp, "hasta")} className="w-auto" aria-label="Hasta" />
        <Boton variante="secundario" type="submit">
          Filtrar
        </Boton>
      </form>
      <TablaDesplegable
        columnas={[
          { titulo: "Fecha" },
          { titulo: "Producto" },
          { titulo: "Centro · almacén", secundaria: true },
          { titulo: "Tipo" },
          { titulo: "Cantidad", alinear: "derecha" },
          { titulo: "Documento", secundaria: true },
          { titulo: "Valor", alinear: "derecha", secundaria: true },
        ]}
        vacio="No hay movimientos con ese filtro."
        filas={movs.map((m) => {
          const cant = num(m.cantidad);
          return {
            id: m.id,
            celdas: [
              fechaHora(m.createdAt),
              m.producto.nombre,
              `${m.centro.nombre} · ${m.almacen?.nombre ?? "sin ubicar"}`,
              TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo,
              <span key="c" className={cant < 0 ? "text-red-600" : "text-emerald-700"}>
                {cant > 0 ? "+" : ""}
                {numero(cant, 3)}
              </span>,
              m.documento ?? "—",
              euros(cant * num(m.costeUnitario)),
            ],
            detalle: (
              <DatosDetalle
                datos={[
                  { etiqueta: "Producto", valor: `${m.producto.nombre} (${m.producto.referencia})` },
                  { etiqueta: "Centro", valor: m.centro.nombre },
                  { etiqueta: "Almacén", valor: m.almacen?.nombre ?? "Sin ubicar" },
                  { etiqueta: "Cantidad", valor: `${numero(cant, 3)} ${unidad(m.producto.unidad)}` },
                  { etiqueta: "Coste unitario", valor: euros(num(m.costeUnitario), 4) },
                  { etiqueta: "Documento", valor: m.documento ?? "—" },
                  { etiqueta: "Motivo", valor: m.motivo ?? "—" },
                  { etiqueta: "Usuario", valor: m.usuarioId ? (quien.get(m.usuarioId) ?? "—") : "Sistema" },
                ]}
              />
            ),
          };
        })}
      />
    </>
  );
}
