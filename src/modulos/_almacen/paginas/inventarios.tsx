import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { euros, numero, fecha, fechaHora } from "@/kernel/formato";
import { Cabecera, Tarjeta, Selector, Boton, BotonEnlace, Campo, Entrada, Aviso, Tabla, Cifra, Rejilla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarInventarios, leerInventario, cuentasInventario, nombrePorDefecto, movimientosDesdeApertura } from "@/nucleo/inventarios";
import { UMBRAL_APROBACION_INVENTARIO, num, r3 } from "@/nucleo/comun-almacen";
import { accionCrearInventario, accionGuardarRecuento, accionAprobarInventario, accionReabrirInventario } from "../acciones";
import { Recuento } from "../recuento";
import { EtiquetaInventario, Mensajes, Ocultos, rutaVolver, textosArea, unidad, veCentro, type PropsPagina, type PropsPaginaId } from "../comun";
import { centrosDelArea } from "./resumen";

export async function PaginaInventarios({ area, searchParams }: PropsPagina) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:inventarios:ver`);
  const sp = await searchParams;
  const prisma = await db();
  const centros = centrosDelArea(ctx, area);
  const inventarios = await listarInventarios(prisma, ctx.tenant.id, area, centros.map((c) => c.id));
  const volver = rutaVolver(`/${t.m}/inventarios`, sp);

  return (
    <>
      <Cabecera titulo={`Inventarios de ${t.nombre.toLowerCase()}`} subtitulo={`Se cuenta a ciegas; al cerrar, el stock se ajusta a lo contado. Si el descuadre pasa de ${euros(UMBRAL_APROBACION_INVENTARIO, 0)}, necesita aprobación.`} />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        {ctx.puede(`${t.m}:inventarios:crear`) && centros.length > 0 && (
          <Tarjeta titulo="Empezar inventario">
            <form action={accionCrearInventario} className="flex flex-wrap items-end gap-2">
              <Ocultos area={area} volver={volver} />
              <div className="w-64">
                <Campo etiqueta="Centro">
                  <Selector name="centroId" defaultValue={ctx.centroActivo?.id ?? centros.find((c) => c.tipo !== "LOCAL")?.id ?? centros[0].id}>
                    {centros.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              </div>
              <div className="w-64">
                <Campo etiqueta="Nombre">
                  <Entrada name="nombre" defaultValue={nombrePorDefecto()} />
                </Campo>
              </div>
              <Boton type="submit">Empezar a contar</Boton>
            </form>
          </Tarjeta>
        )}
        <TablaDesplegable
          columnas={[
            { titulo: "Inventario" },
            { titulo: "Centro" },
            { titulo: "Contadas", alinear: "derecha", secundaria: true },
            { titulo: "Diferencia", alinear: "derecha" },
            { titulo: "Fecha", secundaria: true },
            { titulo: "Estado" },
          ]}
          vacio="Todavía no hay inventarios."
          filas={inventarios.map((i) => {
            const c = cuentasInventario(i.lineas);
            return {
              id: i.id,
              tono: i.estado === "PENDIENTE_APROBACION" ? ("aviso" as const) : undefined,
              celdas: [
                <Link key="n" href={`/${t.m}/inventarios/${i.id}`} className="font-medium text-acento">
                  {i.nombre}
                </Link>,
                i.centro.nombre,
                `${numero(c.contadas)} de ${numero(c.lineas)}`,
                <span key="d" className={c.diferenciaEuros < 0 ? "text-red-600" : c.diferenciaEuros > 0 ? "text-emerald-600" : ""}>
                  {euros(c.diferenciaEuros)}
                </span>,
                fecha(i.createdAt),
                <EtiquetaInventario key="e" estado={i.estado} />,
              ],
              detalle: (
                <div className="space-y-3">
                  <DatosDetalle
                    datos={[
                      { etiqueta: "Número", valor: i.numero },
                      { etiqueta: "Abierto", valor: fechaHora(i.createdAt) },
                      { etiqueta: "Cerrado", valor: i.cerradoEn ? fechaHora(i.cerradoEn) : "—" },
                      { etiqueta: "Líneas con diferencia", valor: numero(c.conDiferencia) },
                      { etiqueta: "Diferencia en unidades", valor: numero(c.diferenciaUnidades, 3) },
                      { etiqueta: "Diferencia en €", valor: euros(c.diferenciaEuros) },
                      { etiqueta: "Descuadre (suma sin signo)", valor: euros(c.descuadreEuros) },
                    ]}
                  />
                  <BotonEnlace href={`/${t.m}/inventarios/${i.id}`}>{i.estado === "ABIERTO" ? "Seguir contando" : "Ver inventario"}</BotonEnlace>
                </div>
              ),
            };
          })}
        />
      </div>
    </>
  );
}

export async function PaginaInventario({ area, searchParams, params }: PropsPaginaId) {
  const t = textosArea(area);
  const ctx = await exigir(t.m, `${t.m}:inventarios:ver`);
  const sp = await searchParams;
  const { id } = await params;
  const prisma = await db();
  const inv = await leerInventario(prisma, ctx.tenant.id, area, id);
  if (!inv || !veCentro(ctx, inv.centroId)) notFound();
  const volver = rutaVolver(`/${t.m}/inventarios/${inv.id}`, sp);
  const c = cuentasInventario(inv.lineas);
  const puedeContar = inv.estado === "ABIERTO" && ctx.puede(`${t.m}:inventarios:crear`);
  const puedeCerrar = ctx.puede(`${t.m}:inventarios:cerrar`);
  const movidos = inv.estado !== "CERRADO" ? await movimientosDesdeApertura(prisma, ctx.tenant.id, area, inv) : 0;

  const lineas = [...inv.lineas].sort(
    (a, b) => (a.producto.familia?.orden ?? 99) - (b.producto.familia?.orden ?? 99) || a.producto.nombre.localeCompare(b.producto.nombre),
  );
  const diferencias = lineas
    .filter((l) => l.contado !== null && r3(num(l.contado) - num(l.teorico)) !== 0)
    .map((l) => ({ l, dif: r3(num(l.contado) - num(l.teorico)), euros: (num(l.contado) - num(l.teorico)) * num(l.coste) }))
    .sort((a, b) => Math.abs(b.euros) - Math.abs(a.euros));

  return (
    <>
      <Cabecera
        titulo={inv.nombre}
        subtitulo={`${inv.centro.nombre} · ${inv.numero} · abierto ${fechaHora(inv.createdAt)}`}
        acciones={
          <BotonEnlace href={`/${t.m}/inventarios`} variante="secundario">
            Volver
          </BotonEnlace>
        }
      />
      <Mensajes sp={sp} />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <EtiquetaInventario estado={inv.estado} />
          <span className="text-sm text-slate-500">
            {numero(c.contadas)} de {numero(c.lineas)} contadas
          </span>
        </div>
        {movidos > 0 && (
          <Aviso tono="aviso">
            Ha habido {numero(movidos)} movimiento(s) de stock en este centro desde que se abrió el inventario. El ajuste se calcula contra el stock del momento de abrirlo: cuenta lo
            que había entonces o vuelve a empezar el inventario.
          </Aviso>
        )}

        {puedeContar ? (
          <form action={accionGuardarRecuento} className="space-y-3 pb-28">
            <Ocultos area={area} volver={volver} id={inv.id} />
            <Recuento
              lineas={lineas.map((l) => ({
                id: l.id,
                nombre: l.producto.nombre,
                referencia: l.producto.referencia,
                unidad: unidad(l.producto.unidad),
                familia: l.producto.familia?.nombre ?? "Sin familia",
                contado: l.contado === null ? null : num(l.contado),
              }))}
            />
            <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-slate-200 bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
              <Boton type="submit" variante="secundario" className="flex-1 md:flex-none">
                Guardar recuento
              </Boton>
              <Boton type="submit" name="terminar" value="1" className="flex-1 md:flex-none">
                Guardar y terminar
              </Boton>
            </div>
            <p className="text-xs text-slate-500">
              Lo que se deje sin contar no se ajusta. Al terminar, si el descuadre supera {euros(UMBRAL_APROBACION_INVENTARIO, 0)} queda pendiente de aprobación.
            </p>
          </form>
        ) : null}

        {inv.estado === "PENDIENTE_APROBACION" && (
          <Aviso tono="aviso" titulo="Pendiente de aprobación">
            El descuadre es de {euros(c.descuadreEuros)} (más de {euros(UMBRAL_APROBACION_INVENTARIO, 0)}).{" "}
            {puedeCerrar ? "Revisa las diferencias de abajo antes de aprobar." : "Lo tiene que aprobar alguien con permiso para cerrar inventarios."}
          </Aviso>
        )}

        {(puedeCerrar || inv.estado === "CERRADO") && (
          <>
            <Rejilla columnas={4}>
              <Cifra etiqueta="Diferencia" valor={euros(c.diferenciaEuros)} tono={c.diferenciaEuros < 0 ? "error" : "normal"} />
              <Cifra etiqueta="Descuadre sin signo" valor={euros(c.descuadreEuros)} tono={c.descuadreEuros > UMBRAL_APROBACION_INVENTARIO ? "aviso" : "normal"} />
              <Cifra etiqueta="Líneas con diferencia" valor={numero(c.conDiferencia)} />
              <Cifra etiqueta="Unidades" valor={numero(c.diferenciaUnidades, 3)} />
            </Rejilla>
            <Tarjeta titulo="Diferencias (de mayor a menor importe)">
              <Tabla
                clave={(d) => d.l.id}
                filas={diferencias}
                vacio="Sin diferencias en lo contado."
                columnas={[
                  { titulo: "Producto", celda: (d) => d.l.producto.nombre },
                  { titulo: "Teórico", alinear: "derecha", celda: (d) => numero(num(d.l.teorico), 3) },
                  { titulo: "Contado", alinear: "derecha", celda: (d) => numero(num(d.l.contado), 3) },
                  { titulo: "Diferencia", alinear: "derecha", celda: (d) => numero(d.dif, 3) },
                  { titulo: "€", alinear: "derecha", celda: (d) => <span className={d.euros < 0 ? "text-red-600" : "text-emerald-600"}>{euros(d.euros)}</span> },
                ]}
              />
            </Tarjeta>
          </>
        )}

        {inv.estado === "PENDIENTE_APROBACION" && puedeCerrar && (
          <div className="flex flex-wrap gap-2">
            <form action={accionAprobarInventario}>
              <Ocultos area={area} volver={volver} id={inv.id} />
              <Boton type="submit">Aprobar y cerrar</Boton>
            </form>
            <form action={accionReabrirInventario}>
              <Ocultos area={area} volver={volver} id={inv.id} />
              <Boton type="submit" variante="secundario">
                Devolver a recuento
              </Boton>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
