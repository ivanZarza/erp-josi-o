import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, Boton, Etiqueta, Vacio, BotonEnlace } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarGastos, sociedadesVisibles, diccionarios, hoyISO, mesActual, redondear, NOMBRE_GRUPO } from "@/modulos/contabilidad/servicio";
import { accionCrearGasto, accionPagarGasto, accionAnularGasto, accionCopiarGastosFijos } from "@/modulos/contabilidad/acciones";
import { Avisos, Filtros, FiltroSociedad, FiltroMes, FormularioPago, BotonAccion, ESTADO_GASTO, param, type ParametrosBusqueda } from "../_comun";

export default async function Gastos({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("contabilidad", "contabilidad:ver");
  const sp = await searchParams;
  const filtro = { sociedadId: param(sp, "sociedad"), estado: param(sp, "estado"), mes: param(sp, "mes") ?? mesActual() };
  const [gastos, sociedades, d] = await Promise.all([listarGastos(ctx, filtro), sociedadesVisibles(ctx), diccionarios(ctx)]);
  const puedeEditar = ctx.puede("contabilidad:gastos:editar");
  const hoy = hoyISO();
  const volver = `/contabilidad/gastos?${new URLSearchParams(Object.entries(filtro).filter(([, v]) => v) as [string, string][]).toString()}`;
  const suma = redondear(gastos.filter((g) => g.estado !== "ANULADO").reduce((s, g) => s + Number(g.base), 0));
  const categoriasGasto = d.listaCategorias.filter((c) => c.grupo !== "MERCANCIA" && c.grupo !== "INGRESO");

  return (
    <>
      <Cabecera titulo="Gastos" subtitulo="Alquiler, suministros, seguros, mantenimiento… lo que no es mercancía. Con su centro y su categoría para el Cuadro de mando." />
      <Avisos sp={sp} />

      {puedeEditar &&
        (categoriasGasto.length === 0 ? (
          <div className="mb-4">
            <Vacio>
              No hay categorías de gasto. <BotonEnlace href="/contabilidad/categorias">Crear categorías</BotonEnlace>
            </Vacio>
          </div>
        ) : (
          <Tarjeta titulo="Apuntar gasto" className="mb-4">
            <form action={accionCrearGasto} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Sociedad">
                <Selector name="sociedadId" required defaultValue={filtro.sociedadId ?? (sociedades.length === 1 ? sociedades[0].id : "")}>
                  <option value="">Elige…</option>
                  {sociedades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Centro">
                <Selector name="centroId" defaultValue={ctx.centroActivo?.id ?? ""}>
                  <option value="">De la sociedad</option>
                  {ctx.centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Categoría">
                <Selector name="categoriaId" required defaultValue="">
                  <option value="">Elige…</option>
                  {categoriasGasto.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <div className="lg:col-span-2">
                <Campo etiqueta="Concepto">
                  <Entrada name="concepto" required placeholder="Alquiler de noviembre" />
                </Campo>
              </div>
              <Campo etiqueta="Proveedor">
                <Entrada name="proveedorNombre" />
              </Campo>
              <Campo etiqueta="Fecha">
                <Entrada type="date" name="fecha" required defaultValue={hoy} />
              </Campo>
              <Campo etiqueta="Vencimiento">
                <Entrada type="date" name="vencimiento" />
              </Campo>
              <Campo etiqueta="Importe sin IVA">
                <Entrada name="base" required inputMode="decimal" placeholder="0,00" className="text-right" />
              </Campo>
              <Campo etiqueta="IVA">
                <Selector name="tipoIva" defaultValue="21">
                  <option value="21">21 %</option>
                  <option value="10">10 %</option>
                  <option value="4">4 %</option>
                  <option value="0">0 % / exento</option>
                </Selector>
              </Campo>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="recurrente" className="h-4 w-4" /> Gasto fijo mensual
              </label>
              <div className="self-end">
                <Boton type="submit">Guardar gasto</Boton>
              </div>
            </form>
          </Tarjeta>
        ))}

      <Filtros>
        <FiltroSociedad sociedades={sociedades} valor={filtro.sociedadId} />
        <div className="min-w-44">
          <Campo etiqueta="Estado">
            <Selector name="estado" defaultValue={filtro.estado ?? ""}>
              <option value="">Todos</option>
              {Object.entries(ESTADO_GASTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.texto}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        <FiltroMes valor={filtro.mes} />
      </Filtros>
      {puedeEditar && (
        <form action={accionCopiarGastosFijos} className="mb-4">
          <input type="hidden" name="mes" value={filtro.mes} />
          <Boton type="submit" variante="secundario">
            Copiar a este mes los gastos fijos del mes anterior
          </Boton>
        </form>
      )}

      <TablaDesplegable
        total={`${numero(gastos.length)} gastos · ${euros(suma)} sin IVA (sin anulados)`}
        vacio="No hay gastos en este mes. Apunta el primero arriba o copia los fijos del mes anterior."
        columnas={[{ titulo: "Fecha" }, { titulo: "Concepto" }, { titulo: "Categoría" }, { titulo: "Centro", secundaria: true }, { titulo: "Sin IVA", alinear: "derecha" }, { titulo: "Estado" }]}
        filas={gastos.map((g) => {
          const cat = d.categorias.get(g.categoriaId);
          return {
            id: g.id,
            celdas: [
              fecha(g.fecha),
              g.concepto,
              cat?.nombre ?? "—",
              g.centroId ? (d.centros.get(g.centroId)?.nombre ?? "—") : "De la sociedad",
              euros(g.base),
              <Etiqueta key="e" tono={ESTADO_GASTO[g.estado].tono}>
                {ESTADO_GASTO[g.estado].texto}
              </Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Sociedad", valor: d.sociedades.get(g.sociedadId)?.razonSocial ?? "—" },
                    { etiqueta: "Proveedor", valor: g.proveedorNombre ?? "—" },
                    { etiqueta: "Grupo", valor: cat ? NOMBRE_GRUPO[cat.grupo] : "—" },
                    { etiqueta: "Gasto fijo mensual", valor: g.recurrente ? "Sí" : "No" },
                    { etiqueta: "IVA", valor: euros(g.cuotaIva) },
                    { etiqueta: "Total", valor: euros(g.total) },
                    { etiqueta: "Vencimiento", valor: fecha(g.vencimiento) },
                    { etiqueta: "Pagado", valor: g.pagadoEn ? fecha(g.pagadoEn) : "—" },
                    { etiqueta: "Notas", valor: g.notas ?? "—" },
                  ]}
                />
                {puedeEditar && g.estado === "PENDIENTE" && (
                  <div className="flex flex-wrap items-end gap-3">
                    <FormularioPago accion={accionPagarGasto} id={g.id} volver={volver} hoy={hoy} total={Number(g.total)} texto="Marcar pagado" />
                    <BotonAccion accion={accionAnularGasto} id={g.id} volver={volver} texto="Anular" variante="peligro" />
                  </div>
                )}
              </div>
            ),
          };
        })}
      />
    </>
  );
}
