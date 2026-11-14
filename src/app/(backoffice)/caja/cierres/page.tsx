import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton, Cifra, Rejilla, Etiqueta, Vacio, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarCierres, centrosCaja, hoyISO, sumarDias, nombresUsuarios } from "@/modulos/caja/servicio";
import { accionCrearCierre, accionValidarCierre } from "@/modulos/caja/acciones";
import { Avisos, param, type ParametrosBusqueda } from "../_comun";

const ESTADO = {
  PENDIENTE: { texto: "Pendiente de validar", tono: "aviso" as const },
  VALIDADO: { texto: "Validado", tono: "ok" as const },
  RECHAZADO: { texto: "Rechazado: revisar", tono: "error" as const },
};

export default async function Cierres({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("caja", "caja:cierres:ver");
  const sp = await searchParams;
  const hoy = hoyISO();
  const estado = param(sp, "estado");
  const desde = param(sp, "desde") ?? sumarDias(hoy, -30);
  const centros = centrosCaja(ctx);
  const cierres = await listarCierres(ctx, { estado, desde });
  const usuarios = await nombresUsuarios(ctx, cierres.flatMap((c) => [c.cerradoPor, c.validadoPor]));
  const nombre = new Map(centros.map((c) => [c.id, c.nombre]));
  const puedeCrear = ctx.puede("caja:cierres:crear");
  const puedeValidar = ctx.puede("caja:cierres:validar");
  const volver = `/caja/cierres?${new URLSearchParams({ desde, ...(estado ? { estado } : {}) }).toString()}`;
  const pendientes = cierres.filter((c) => c.estado === "PENDIENTE").length;
  const conDescuadre = cierres.filter((c) => Number(c.descuadre) !== 0);
  const descuadreTotal = conDescuadre.reduce((s, c) => s + Number(c.descuadre), 0);

  if (centros.length === 0)
    return (
      <>
        <Cabecera titulo="Cierres de caja" />
        <Vacio>No hay locales con Caja y ventas en tu selección.</Vacio>
      </>
    );

  return (
    <>
      <Cabecera titulo="Cierres de caja" subtitulo="El gerente cuenta el efectivo y lo compara con lo que dice la venta; finanzas lo valida. Todo descuadre lleva su motivo." />
      <Avisos sp={sp} />
      <Rejilla columnas={3}>
        <Cifra etiqueta="Pendientes de validar" valor={numero(pendientes)} tono={pendientes ? "aviso" : "ok"} href="/caja/cierres?estado=PENDIENTE" />
        <Cifra etiqueta="Cierres con descuadre" valor={numero(conDescuadre.length)} detalle={`de ${numero(cierres.length)} en la lista`} tono={conDescuadre.length ? "aviso" : "ok"} />
        <Cifra etiqueta="Descuadre acumulado" valor={euros(descuadreTotal)} tono={descuadreTotal < 0 ? "error" : "normal"} />
      </Rejilla>

      {puedeCrear && (
        <Tarjeta titulo="Hacer cierre de caja" className="mt-4">
          <form action={accionCrearCierre} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <input type="hidden" name="volver" value={volver} />
            <Campo etiqueta="Local">
              <Selector name="centroId" required defaultValue={ctx.centroActivo?.id ?? (centros.length === 1 ? centros[0].id : "")}>
                <option value="">Elige…</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Día de negocio">
              <Entrada type="date" name="fecha" required defaultValue={sumarDias(hoy, -1)} max={hoy} />
            </Campo>
            <Campo etiqueta="Efectivo contado">
              <Entrada name="efectivoContado" required inputMode="decimal" className="text-right" />
            </Campo>
            <Campo etiqueta="Efectivo teórico" ayuda="Vacío = el efectivo de las ventas de ese día">
              <Entrada name="efectivoTeorico" inputMode="decimal" className="text-right" />
            </Campo>
            <Campo etiqueta="Tarjeta según el banco" ayuda="Opcional">
              <Entrada name="tarjetaBanco" inputMode="decimal" className="text-right" />
            </Campo>
            <Campo etiqueta="Fondo de caja que se deja">
              <Entrada name="fondoCaja" inputMode="decimal" className="text-right" />
            </Campo>
            <div className="col-span-2 sm:col-span-3 lg:col-span-5">
              <Campo etiqueta="Motivo del descuadre" ayuda="Obligatorio si lo contado no cuadra">
                <AreaTexto name="motivo" rows={1} />
              </Campo>
            </div>
            <div className="self-end">
              <Boton type="submit">Guardar cierre</Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      <form method="get" className="mb-4 mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado ?? ""}>
            <option value="">Todos</option>
            {Object.entries(ESTADO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.texto}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Desde">
          <Entrada type="date" name="desde" defaultValue={desde} />
        </Campo>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        vacio="No hay cierres en estas fechas."
        columnas={[{ titulo: "Día" }, { titulo: "Local" }, { titulo: "Teórico", alinear: "derecha", secundaria: true }, { titulo: "Contado", alinear: "derecha", secundaria: true }, { titulo: "Descuadre", alinear: "derecha" }, { titulo: "Estado" }]}
        filas={cierres.map((c) => {
          const desc = Number(c.descuadre);
          return {
            id: c.id,
            tono: c.estado === "RECHAZADO" ? ("error" as const) : desc !== 0 ? ("aviso" as const) : undefined,
            celdas: [
              fecha(c.fecha),
              nombre.get(c.centroId) ?? "—",
              euros(c.efectivoTeorico),
              euros(c.efectivoContado),
              <span key="d" className={desc < 0 ? "text-red-600" : desc > 0 ? "text-amber-600" : ""}>
                {euros(desc)}
              </span>,
              <Etiqueta key="e" tono={ESTADO[c.estado].tono}>
                {ESTADO[c.estado].texto}
              </Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Tarjeta (ventas)", valor: c.tarjetaTeorico !== null ? euros(c.tarjetaTeorico) : "—" },
                    { etiqueta: "Tarjeta (banco)", valor: c.tarjetaBanco !== null ? euros(c.tarjetaBanco) : "—" },
                    { etiqueta: "Diferencia tarjeta", valor: c.tarjetaTeorico !== null && c.tarjetaBanco !== null ? euros(Number(c.tarjetaBanco) - Number(c.tarjetaTeorico)) : "—" },
                    { etiqueta: "Fondo de caja", valor: euros(c.fondoCaja) },
                    { etiqueta: "Motivo", valor: c.motivo ?? "—" },
                    { etiqueta: "Cerrado por", valor: (c.cerradoPor && usuarios.get(c.cerradoPor)) || "—" },
                    { etiqueta: "Revisado por", valor: (c.validadoPor && usuarios.get(c.validadoPor)) || "—" },
                    { etiqueta: "Revisado el", valor: c.validadoEn ? fechaHora(c.validadoEn) : "—" },
                    { etiqueta: "Comentario de finanzas", valor: c.comentarioValidacion ?? "—" },
                  ]}
                />
                {puedeValidar && c.estado === "PENDIENTE" && (
                  <form action={accionValidarCierre} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="volver" value={volver} />
                    <div className="min-w-72">
                      <Campo etiqueta="Comentario (obligatorio para rechazar)">
                        <Entrada name="comentario" />
                      </Campo>
                    </div>
                    <Boton type="submit" name="decision" value="VALIDADO">
                      Validar
                    </Boton>
                    <Boton type="submit" name="decision" value="RECHAZADO" variante="peligro">
                      Rechazar
                    </Boton>
                  </form>
                )}
              </div>
            ),
          };
        })}
      />
      <div className="mt-4">
        <HuecoIntegracion nombre="Programa de caja (TPV)" descripcion="Traer del TPV el efectivo y la tarjeta teóricos de cada cierre (cierre Z)" />
      </div>
    </>
  );
}
