import { exigir } from "@/kernel/contexto";
import { Cabecera, Aviso, Entrada, Selector, Boton } from "@/ui";
import { planoDelCentro, franjasDelDia, hoyMadrid, horaMadrid, aMin, deMin } from "@/modulos/reservas/servicio";
import { guardarPosicionesAccion } from "@/modulos/reservas/acciones";
import { PlanoMesas } from "@/modulos/reservas/plano-mesas";
import { AvisosUrl, PestanasReservas, param, type Busqueda } from "@/modulos/reservas/ui";

export default async function Plano({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("reservas", "reservas:ver");
  const sp = await searchParams;
  const pestanas = <PestanasReservas activa="/reservas/plano" puedeReglas={ctx.puede("reservas:reglas:editar")} puedePlanos={ctx.puede("reservas:planos:editar")} />;
  const centro = ctx.centroActivo;
  if (!centro || centro.tipo !== "LOCAL") {
    return (
      <>
        <Cabecera titulo="Plano de mesas" />
        {pestanas}
        <Aviso tono="aviso">Elige un local en el selector de centro de arriba para ver su plano.</Aviso>
      </>
    );
  }

  const hoy = hoyMadrid();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, "fecha") ?? "") ? param(sp, "fecha")! : hoy;
  const turnos = await franjasDelDia(ctx, centro.id, dia);
  const horas = turnos.flatMap((t) => t.franjas.map((f) => f.hora));
  let hora = param(sp, "hora");
  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
    const ahora = deMin(Math.floor(aMin(horaMadrid()) / 15) * 15);
    hora = dia === hoy && horas.includes(ahora) ? ahora : (horas.find((h) => dia !== hoy || h >= ahora) ?? horas[0] ?? "21:00");
  }
  const espacios = await planoDelCentro(ctx, centro.id, dia, hora);

  return (
    <>
      <Cabecera titulo="Plano de mesas" subtitulo={`${centro.nombre} · estado de las mesas a las ${hora}`} />
      {pestanas}
      <AvisosUrl sp={sp} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Entrada type="date" name="fecha" defaultValue={dia} className="w-44" />
        {horas.length > 0 ? (
          <Selector name="hora" defaultValue={hora} className="w-32">
            {turnos.map((t) => (
              <optgroup key={t.turno.id} label={t.turno.nombre}>
                {t.franjas.map((f) => (
                  <option key={f.hora} value={f.hora}>{f.hora}</option>
                ))}
              </optgroup>
            ))}
          </Selector>
        ) : (
          <Entrada type="time" name="hora" step={900} defaultValue={hora} className="w-32" />
        )}
        <Boton variante="secundario" type="submit">Ver franja</Boton>
      </form>
      <PlanoMesas espacios={espacios} puedeEditar={ctx.puede("reservas:planos:editar")} guardar={guardarPosicionesAccion} />
    </>
  );
}
