import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { Cabecera, Tarjeta, Selector, Boton, BotonEnlace, Campo, Entrada, Etiqueta, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarProductos, listarFamilias } from "@/nucleo/productos";
import { num, type AreaAlmacen } from "@/nucleo/comun-almacen";
import { proveedoresDeArea } from "@/modulos/proveedores/servicio";
import { accionCrearProducto, accionEditarProducto, accionActivarProducto } from "../acciones";
import { UNIDADES, TIPOS_IVA } from "../esquemas";
import { Mensajes, Ocultos, rutaVolver, textosArea, uno, unidad, paraCampo, NOMBRE_UNIDAD, type PropsPagina } from "../comun";

interface ValoresProducto {
  id?: string;
  referencia: string;
  nombre: string;
  familiaId: string | null;
  proveedorId: string | null;
  unidad: string;
  unidadesCompra: number;
  costeUnitario: number | null;
  sinCoste: boolean;
  motivoSinCoste: string | null;
  iva: number;
  stockMinimo: number;
  codigoBarras: string | null;
}

function FormularioProducto({
  area,
  volver,
  valores,
  familias,
  proveedores,
  accion,
  boton,
}: {
  area: AreaAlmacen;
  volver: string;
  valores: ValoresProducto;
  familias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  accion: (f: FormData) => Promise<never>;
  boton: string;
}) {
  return (
    <form action={accion} className="space-y-3">
      <Ocultos area={area} volver={volver} id={valores.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Referencia">
          <Entrada name="referencia" required defaultValue={valores.referencia} />
        </Campo>
        <div className="sm:col-span-1 lg:col-span-3">
          <Campo etiqueta="Nombre">
            <Entrada name="nombre" required defaultValue={valores.nombre} />
          </Campo>
        </div>
        <Campo etiqueta="Familia">
          <Selector name="familiaId" defaultValue={valores.familiaId ?? ""}>
            <option value="">Sin familia</option>
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="O familia nueva" ayuda="Si la escribes, se crea y se usa esta">
          <Entrada name="nuevaFamilia" />
        </Campo>
        <Campo etiqueta="Proveedor habitual">
          <Selector name="proveedorId" defaultValue={valores.proveedorId ?? ""}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Unidad de stock">
          <Selector name="unidad" defaultValue={valores.unidad}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {NOMBRE_UNIDAD[u] ?? u}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Unidades por formato de compra" ayuda="Por ejemplo, 6 botellas por caja. La propuesta de compra pide cajas completas">
          <Entrada name="unidadesCompra" inputMode="decimal" defaultValue={paraCampo(valores.unidadesCompra)} />
        </Campo>
        <Campo etiqueta="Coste por unidad (€)" ayuda="Coste medio; se recalcula solo al recibir compras">
          <Entrada name="costeUnitario" inputMode="decimal" defaultValue={paraCampo(valores.costeUnitario)} />
        </Campo>
        <Campo etiqueta="IVA">
          <Selector name="iva" defaultValue={String(valores.iva)}>
            {TIPOS_IVA.map((i) => (
              <option key={i} value={i}>
                {i} %
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Mínimo general" ayuda="En obrador y almacenes; en cada local se pone en Stock">
          <Entrada name="stockMinimo" inputMode="decimal" defaultValue={paraCampo(valores.stockMinimo)} />
        </Campo>
        <Campo etiqueta="Código de barras">
          <Entrada name="codigoBarras" defaultValue={valores.codigoBarras ?? ""} />
        </Campo>
        <div className="space-y-1 lg:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sinCoste" defaultChecked={valores.sinCoste} /> Sin coste (muestra, regalo…)
          </label>
          <Entrada name="motivoSinCoste" defaultValue={valores.motivoSinCoste ?? ""} placeholder="Motivo, obligatorio si no tiene coste" />
        </div>
      </div>
      <Boton type="submit">{boton}</Boton>
    </form>
  );
}

export async function PaginaProductos({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:productos:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const verInactivos = uno(sp, "inactivos") === "1";
  const [productos, familias, proveedores] = await Promise.all([
    listarProductos(prisma, ctx.tenant.id, area, { texto: uno(sp, "q"), familiaId: uno(sp, "familia") || undefined, incluirInactivos: verInactivos }),
    listarFamilias(prisma, ctx.tenant.id, area),
    proveedoresDeArea(prisma, ctx.tenant.id, area),
  ]);
  const volver = rutaVolver(`/${t.m}/productos`, sp);
  const puedeEditar = ctx.puede(`${t.m}:productos:editar`);
  const sinCosteReal = productos.filter((p) => p.activo && num(p.costeUnitario) === 0 && !p.sinCoste).length;

  return (
    <>
      <Cabecera
        titulo={`Productos de ${t.nombre.toLowerCase()}`}
        subtitulo="Catálogo del área. Un producto con historial no se borra: se desactiva."
        acciones={puedeEditar && <BotonEnlace href={`/${t.m}/productos/nuevo`}>Nuevo producto</BotonEnlace>}
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        {sinCosteReal > 0 && (
          <Tarjeta>
            <span className="text-sm text-amber-700">
              {numero(sinCosteReal)} producto(s) activos tienen coste 0 sin estar marcados como «sin coste». Corrígelos para que el valor del stock sea real.
            </span>
          </Tarjeta>
        )}
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Entrada name="q" type="search" defaultValue={uno(sp, "q")} placeholder="Buscar por nombre, referencia o código de barras" />
          </div>
          <Selector name="familia" defaultValue={uno(sp, "familia")} className="w-auto">
            <option value="">Todas las familias</option>
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </Selector>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={verInactivos} /> Ver desactivados
          </label>
          <Boton variante="secundario" type="submit">
            Filtrar
          </Boton>
        </form>
        <TablaDesplegable
          columnas={[
            { titulo: "Referencia", secundaria: true },
            { titulo: "Producto" },
            { titulo: "Familia", secundaria: true },
            { titulo: "Proveedor", secundaria: true },
            { titulo: "Coste", alinear: "derecha" },
            { titulo: "Estado" },
          ]}
          vacio={uno(sp, "q") || uno(sp, "familia") ? "No hay productos con ese filtro." : "No hay productos todavía. Da de alta el primero con «Nuevo producto»."}
          filas={productos.map((p) => {
            const coste = num(p.costeUnitario);
            return {
              id: p.id,
              tono: p.activo && coste === 0 && !p.sinCoste ? ("aviso" as const) : undefined,
              celdas: [
                p.referencia,
                <span key="n" className={p.activo ? "font-medium" : "text-slate-400 line-through"}>
                  {p.nombre}
                </span>,
                p.familia?.nombre ?? "—",
                p.proveedor?.nombre ?? "—",
                p.sinCoste ? "Sin coste" : euros(coste, coste < 1 ? 4 : 2),
                p.activo ? <Etiqueta key="e" tono="ok">Activo</Etiqueta> : <Etiqueta key="e">Desactivado</Etiqueta>,
              ],
              detalle: (
                <div className="space-y-4">
                  <DatosDetalle
                    datos={[
                      { etiqueta: "Unidad", valor: unidad(p.unidad) },
                      { etiqueta: "Por formato de compra", valor: numero(num(p.unidadesCompra), 3) },
                      { etiqueta: "IVA", valor: porcentaje(num(p.iva), 0) },
                      { etiqueta: "Mínimo general", valor: numero(num(p.stockMinimo), 3) },
                      ...(p.sinCoste ? [{ etiqueta: "Por qué no tiene coste", valor: p.motivoSinCoste ?? "— (sin motivo guardado)" }] : []),
                    ]}
                  />
                  {puedeEditar && (
                    <>
                      <FormularioProducto
                        area={area}
                        volver={volver}
                        accion={accionEditarProducto}
                        boton="Guardar cambios"
                        familias={familias}
                        proveedores={proveedores}
                        valores={{
                          id: p.id,
                          referencia: p.referencia,
                          nombre: p.nombre,
                          familiaId: p.familiaId,
                          proveedorId: p.proveedorId,
                          unidad: p.unidad,
                          unidadesCompra: num(p.unidadesCompra),
                          costeUnitario: coste,
                          sinCoste: p.sinCoste,
                          motivoSinCoste: p.motivoSinCoste,
                          iva: num(p.iva),
                          stockMinimo: num(p.stockMinimo),
                          codigoBarras: p.codigoBarras,
                        }}
                      />
                      <form action={accionActivarProducto} className="border-t border-slate-200 pt-3">
                        <Ocultos area={area} volver={volver} id={p.id} />
                        <input type="hidden" name="activo" value={p.activo ? "0" : "1"} />
                        <Boton type="submit" variante={p.activo ? "peligro" : "secundario"}>
                          {p.activo ? "Desactivar" : "Volver a activar"}
                        </Boton>
                      </form>
                    </>
                  )}
                </div>
              ),
            };
          })}
        />
        {area === "BEBIDAS" && <HuecoIntegracion nombre="Importar BODEGA 360" descripcion="Traerá los productos y proveedores de la app actual, corrigiendo teléfonos sin +34, costes a 0 y productos que no son bebida" />}
      </div>
    </>
  );
}

export async function PaginaProductoNuevo({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:productos:editar`);
  const sp = await searchParams;
  const prisma = await db();
  const [familias, proveedores] = await Promise.all([listarFamilias(prisma, ctx.tenant.id, area), proveedoresDeArea(prisma, ctx.tenant.id, area)]);
  return (
    <>
      <Cabecera
        titulo="Nuevo producto"
        subtitulo={`Alta en el catálogo de ${t.nombre.toLowerCase()}. El stock no se escribe aquí: entra con compras, pedidos o inventarios.`}
        acciones={
          <BotonEnlace href={`/${t.m}/productos`} variante="secundario">
            Volver
          </BotonEnlace>
        }
      />
      <Mensajes sp={sp} />
      <Tarjeta>
        <FormularioProducto
          area={area}
          volver={`/${t.m}/productos/nuevo`}
          accion={accionCrearProducto}
          boton="Dar de alta"
          familias={familias}
          proveedores={proveedores}
          valores={{
            referencia: "",
            nombre: "",
            familiaId: null,
            proveedorId: null,
            unidad: t.unidadTipica,
            unidadesCompra: 1,
            costeUnitario: null,
            sinCoste: false,
            motivoSinCoste: null,
            iva: area === "BEBIDAS" ? 21 : 10,
            stockMinimo: 0,
            codigoBarras: null,
          }}
        />
      </Tarjeta>
    </>
  );
}
