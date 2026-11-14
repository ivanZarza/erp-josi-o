import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fecha } from "@/kernel/formato";
import { Cabecera, Selector, Entrada, Boton, BotonEnlace, Etiqueta, Cifra, Rejilla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarProveedores } from "@/modulos/proveedores/servicio";
import { normalizarTelefono } from "@/modulos/proveedores/esquemas";
import { accionEditarProveedor, accionActivarProveedor } from "@/modulos/proveedores/acciones";
import { FormularioProveedor } from "@/modulos/proveedores/formulario";
import { Mensajes, rutaVolver, uno, paraCampo, type Busqueda } from "@/modulos/_almacen/comun";
import { num } from "@/nucleo/comun-almacen";

const NOMBRE_AREA: Record<string, string> = { BEBIDAS: "Bebidas", COMIDAS: "Comidas", CONSUMIBLES: "Consumibles" };

export default async function PaginaProveedores({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const ctx = await exigir("proveedores", "proveedores:ver");
  const sp = await searchParams;
  const prisma = await db();
  const verInactivos = uno(sp, "inactivos") === "1";
  const proveedores = await listarProveedores(prisma, ctx.tenant.id, { texto: uno(sp, "q"), area: uno(sp, "area") || undefined, incluirInactivos: verInactivos });
  const puedeEditar = ctx.puede("proveedores:editar");
  const volver = rutaVolver("/proveedores", sp);
  const activos = proveedores.filter((p) => p.activo);
  const telefonoMal = activos.filter((p) => p.telefono && !normalizarTelefono(p.telefono).ok).length;
  const sinTelefono = activos.filter((p) => !p.telefono).length;

  return (
    <>
      <Cabecera
        titulo="Proveedores"
        subtitulo="Comunes a todas las áreas. El teléfono va siempre con +34 para que el pedido por WhatsApp llegue a quien debe."
        acciones={puedeEditar && <BotonEnlace href="/proveedores/nuevo">Nuevo proveedor</BotonEnlace>}
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <Rejilla columnas={3}>
          <Cifra etiqueta="Proveedores activos" valor={numero(activos.length)} />
          <Cifra etiqueta="Sin teléfono" valor={numero(sinTelefono)} tono={sinTelefono ? "aviso" : "ok"} detalle="no se les puede pedir por WhatsApp" />
          <Cifra etiqueta="Teléfono mal escrito" valor={numero(telefonoMal)} tono={telefonoMal ? "error" : "ok"} detalle="sin prefijo de país" />
        </Rejilla>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Entrada name="q" type="search" defaultValue={uno(sp, "q")} placeholder="Buscar por nombre, contacto o CIF" />
          </div>
          <Selector name="area" defaultValue={uno(sp, "area")} className="w-auto">
            <option value="">Todas las áreas</option>
            {Object.entries(NOMBRE_AREA).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
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
            { titulo: "Proveedor" },
            { titulo: "Contacto", secundaria: true },
            { titulo: "Teléfono" },
            { titulo: "Áreas", secundaria: true },
            { titulo: "Productos", alinear: "derecha", secundaria: true },
            { titulo: "Estado" },
          ]}
          vacio={uno(sp, "q") || uno(sp, "area") ? "No hay proveedores con ese filtro." : "No hay proveedores. Da de alta el primero con «Nuevo proveedor»."}
          filas={proveedores.map((p) => {
            const tel = p.telefono ? normalizarTelefono(p.telefono) : null;
            return {
              id: p.id,
              tono: tel && !tel.ok ? ("error" as const) : undefined,
              celdas: [
                <span key="n" className={p.activo ? "font-medium" : "text-slate-400 line-through"}>
                  {p.nombre}
                </span>,
                p.contacto ?? "—",
                p.telefono ? tel && !tel.ok ? <span key="t" className="text-red-600">{p.telefono} · revisar</span> : p.telefono : "—",
                p.areas.map((a) => NOMBRE_AREA[a] ?? a).join(", ") || "—",
                numero(p._count.productos),
                p.activo ? <Etiqueta key="e" tono="ok">Activo</Etiqueta> : <Etiqueta key="e">Desactivado</Etiqueta>,
              ],
              detalle: (
                <div className="space-y-4">
                  <DatosDetalle
                    datos={[
                      { etiqueta: "CIF", valor: p.cif ?? "—" },
                      { etiqueta: "Correo", valor: p.email ?? "—" },
                      { etiqueta: "Días de reparto", valor: p.diasReparto ?? "—" },
                      { etiqueta: "Pedido mínimo", valor: p.pedidoMinimo ? euros(num(p.pedidoMinimo)) : "—" },
                      { etiqueta: "Compras hechas", valor: numero(p._count.pedidos) },
                      { etiqueta: "Alta", valor: fecha(p.createdAt) },
                      { etiqueta: "Notas", valor: p.notas ?? "—" },
                    ]}
                  />
                  {tel && !tel.ok && <p className="text-sm text-red-600">{tel.error}</p>}
                  {puedeEditar && (
                    <>
                      <FormularioProveedor
                        accion={accionEditarProveedor}
                        volver={volver}
                        boton="Guardar cambios"
                        valores={{
                          id: p.id,
                          nombre: p.nombre,
                          cif: p.cif,
                          contacto: p.contacto,
                          telefono: p.telefono,
                          email: p.email,
                          areas: p.areas,
                          diasReparto: p.diasReparto,
                          pedidoMinimo: p.pedidoMinimo ? paraCampo(num(p.pedidoMinimo)) : "",
                          notas: p.notas,
                        }}
                      />
                      <form action={accionActivarProveedor} className="border-t border-slate-200 pt-3">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="volver" value={volver} />
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
      </div>
    </>
  );
}
