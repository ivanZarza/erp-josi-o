import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Boton, Campo, Entrada, Aviso } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { indicadoresDiariosGuardados, mesValido, nombreMes } from "@/modulos/cuadro/servicio";
import { accionRecalcularIndicadores } from "@/modulos/cuadro/acciones";
import { Avisos, param, type ParametrosBusqueda } from "../_comun";

const valor = (v: { toString(): string } | null) => (v === null ? "sin datos" : euros(v));

export default async function DiaADia({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("cuadro", "cuadro:ver");
  const sp = await searchParams;
  const mes = mesValido(param(sp, "mes"));
  const filas = await indicadoresDiariosGuardados(ctx, mes);
  const nombre = new Map(ctx.centros.map((c) => [c.id, c.nombre]));
  const ultimo = filas.reduce<Date | null>((m, f) => (!m || f.calculadoEn > m ? f.calculadoEn : m), null);

  return (
    <>
      <Cabecera
        titulo="Día a día"
        subtitulo={`Indicadores guardados de ${nombreMes(mes)} por centro y día. Es una foto: recalcula si se han metido o corregido datos.`}
        acciones={
          <form action={accionRecalcularIndicadores}>
            <input type="hidden" name="mes" value={mes} />
            <Boton type="submit">Recalcular el mes</Boton>
          </form>
        }
      />
      <Avisos sp={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Mes">
          <Entrada type="month" name="mes" defaultValue={mes} />
        </Campo>
        <Boton type="submit" variante="secundario">
          Ver
        </Boton>
      </form>
      <div className="mb-4">
        <Aviso>
          {ultimo ? `Último cálculo: ${fechaHora(ultimo)}.` : "Este mes aún no se ha calculado."} El cálculo automático cada noche está pendiente (hará falta una tarea programada); mientras tanto, pulsa «Recalcular el mes».
        </Aviso>
      </div>
      <TablaDesplegable
        vacio="Sin indicadores guardados para este mes. Pulsa «Recalcular el mes»."
        columnas={[{ titulo: "Día" }, { titulo: "Centro" }, { titulo: "Ventas", alinear: "derecha" }, { titulo: "Comensales", alinear: "derecha", secundaria: true }, { titulo: "Mercancía", alinear: "derecha", secundaria: true }, { titulo: "Gastos", alinear: "derecha", secundaria: true }]}
        filas={filas.map((f) => ({
          id: f.id,
          celdas: [fecha(f.fecha), nombre.get(f.centroId) ?? "—", valor(f.ventas), f.comensales === null ? "sin datos" : numero(f.comensales), valor(f.mercancia), valor(f.gastos)],
          detalle: (
            <DatosDetalle
              datos={[
                { etiqueta: "Tickets", valor: f.tickets === null ? "sin datos" : numero(f.tickets) },
                { etiqueta: "Ticket medio", valor: f.tickets && f.ventas !== null ? euros(Number(f.ventas) / f.tickets) : "—" },
                { etiqueta: "Personal", valor: valor(f.personal) },
                { etiqueta: "Calculado", valor: fechaHora(f.calculadoEn) },
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
