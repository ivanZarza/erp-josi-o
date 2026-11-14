import { exigir } from "@/kernel/contexto";
import { numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, Boton, Aviso, Etiqueta } from "@/ui";
import { TablaDesplegable } from "@/ui/tabla-desplegable";
import { turnosYAjustes } from "@/modulos/reservas/servicio";
import { guardarTurnoAccion, activarTurnoAccion, guardarAjustesAccion } from "@/modulos/reservas/acciones";
import { AvisosUrl, PestanasReservas, type Busqueda } from "@/modulos/reservas/ui";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function FormTurno({ centroId, t }: { centroId: string; t?: { id: string; nombre: string; dias: number[]; horaInicio: string; horaFin: string; duracionMin: number; intervaloMin: number; maxCubiertosFranja: number } }) {
  return (
    <form action={guardarTurnoAccion} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <input type="hidden" name="centroId" value={centroId} />
      <Campo etiqueta="Nombre"><Entrada name="nombre" defaultValue={t?.nombre ?? ""} placeholder="Comida" required /></Campo>
      <Campo etiqueta="Primera entrada"><Entrada type="time" name="horaInicio" step={900} defaultValue={t?.horaInicio ?? "13:00"} required /></Campo>
      <Campo etiqueta="Última entrada"><Entrada type="time" name="horaFin" step={900} defaultValue={t?.horaFin ?? "15:30"} required /></Campo>
      <Campo etiqueta="Duración de mesa (min)"><Entrada type="number" name="duracionMin" min={15} step={15} defaultValue={t?.duracionMin ?? 90} required /></Campo>
      <Campo etiqueta="Franja de entradas">
        <Selector name="intervaloMin" defaultValue={String(t?.intervaloMin ?? 15)}>
          <option value="15">Cada 15 min</option>
          <option value="30">Cada 30 min</option>
          <option value="60">Cada hora</option>
        </Selector>
      </Campo>
      <Campo etiqueta="Máx. cubiertos por franja" ayuda="Para no saturar la cocina"><Entrada type="number" name="maxCubiertosFranja" min={1} defaultValue={t?.maxCubiertosFranja ?? 30} required /></Campo>
      <fieldset className="col-span-2">
        <legend className="mb-1 text-sm font-medium">Días</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {DIAS.map((d, i) => (
            <label key={d} className="flex items-center gap-1">
              <input type="checkbox" name="dias" value={i + 1} defaultChecked={t ? t.dias.includes(i + 1) : true} /> {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="col-span-2 lg:col-span-4"><Boton type="submit">{t ? "Guardar turno" : "Crear turno"}</Boton></div>
    </form>
  );
}

export default async function TurnosYReglas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("reservas", "reservas:reglas:editar");
  const sp = await searchParams;
  const pestanas = <PestanasReservas activa="/reservas/reglas" puedeReglas puedePlanos={ctx.puede("reservas:planos:editar")} />;
  const centro = ctx.centroActivo;
  if (!centro || centro.tipo !== "LOCAL")
    return (
      <>
        <Cabecera titulo="Turnos y reglas" />
        {pestanas}
        <Aviso tono="aviso">Elige un local en el selector de centro de arriba: cada local tiene sus turnos y reglas.</Aviso>
      </>
    );
  const { turnos, ajustes } = await turnosYAjustes(ctx, centro.id);

  return (
    <>
      <Cabecera titulo="Turnos y reglas" subtitulo={centro.nombre} />
      {pestanas}
      <AvisosUrl sp={sp} />
      <div className="space-y-6">
        <Tarjeta titulo="Turnos">
          <TablaDesplegable
            columnas={[{ titulo: "Turno" }, { titulo: "Días" }, { titulo: "Entradas" }, { titulo: "Duración", alinear: "derecha" }, { titulo: "Cubiertos / franja", alinear: "derecha" }, { titulo: "Estado" }]}
            vacio="Sin turnos: el local acepta reservas a cualquier hora y sin límite de cubiertos."
            filas={turnos.map((t) => ({
              id: t.id,
              celdas: [
                <span key="n" className="font-medium">{t.nombre}</span>,
                DIAS.filter((_, i) => t.dias.includes(i + 1)).join(" "),
                `${t.horaInicio} – ${t.horaFin}`,
                `${numero(t.duracionMin)} min`,
                `${numero(t.maxCubiertosFranja)} cada ${t.intervaloMin} min`,
                t.activo ? <Etiqueta key="e" tono="ok">Activo</Etiqueta> : <Etiqueta key="e">Desactivado</Etiqueta>,
              ],
              detalle: (
                <div className="space-y-3">
                  <FormTurno centroId={centro.id} t={t} />
                  <form action={activarTurnoAccion}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="activo" value={t.activo ? "0" : "1"} />
                    <Boton type="submit" variante="secundario">{t.activo ? "Desactivar turno" : "Volver a activar"}</Boton>
                  </form>
                </div>
              ),
            }))}
          />
          <div className="mt-4 border-t border-borde pt-4">
            <div className="mb-2 text-sm font-semibold">Nuevo turno</div>
            <FormTurno centroId={centro.id} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Reglas del local">
          <form action={guardarAjustesAccion} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input type="hidden" name="centroId" value={centro.id} />
            <Campo etiqueta="Grupos grandes" ayuda="Las reservas de MÁS de estas personas se convierten en solicitud de evento">
              <Entrada type="number" name="grupoMaximo" min={1} defaultValue={ajustes.grupoMaximo} required />
            </Campo>
            <Campo etiqueta="Antelación mínima por internet (min)" ayuda="Se aplicará al formulario de la web">
              <Entrada type="number" name="antelacionMinutos" min={0} step={15} defaultValue={ajustes.antelacionMinutos} required />
            </Campo>
            <div className="flex items-center text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="elegirMesaInternet" defaultChecked={ajustes.elegirMesaInternet} /> El cliente puede elegir mesa en la web (fase R3)
              </label>
            </div>
            <div className="sm:col-span-3"><Boton type="submit">Guardar reglas</Boton></div>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
