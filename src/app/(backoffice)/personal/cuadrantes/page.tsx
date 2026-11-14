import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora } from "@/kernel/formato";
import { Cabecera, Aviso, Boton, BotonEnlace, Etiqueta, Tarjeta, Tabla, Campo, Entrada, Cifra, Rejilla } from "@/ui";
import { cuadranteSemana, listarTurnosTipo } from "@/modulos/personal/servicio";
import { guardarAsignacionAccion, quitarAsignacionAccion, copiarSemanaAccion, publicarCuadranteAccion, crearTurnoTipoAccion, desactivarTurnoTipoAccion } from "@/modulos/personal/acciones";
import { NOMBRE_AUSENCIA } from "@/modulos/personal/esquemas";
import { esDia, hoyMadrid, lunesDe, sumarDias, NOMBRES_DIA } from "@/modulos/personal/fechas";
import { RejillaCuadrante } from "../_componentes/rejilla-cuadrante";
import { Mensajes, Volver, horasTexto, param, type Busqueda } from "../_componentes/comun";

export default async function Cuadrantes({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:cuadrantes:ver");
  const sp = await searchParams;
  if (!ctx.centroActivo) {
    return (
      <>
        <Cabecera titulo="Cuadrantes" subtitulo="Turnos semanales por centro" />
        <Aviso tono="aviso" titulo="Elige un centro">
          El cuadrante se monta centro a centro. Elige el centro en el selector de arriba para ver y editar su semana.
        </Aviso>
      </>
    );
  }
  const centro = ctx.centroActivo;
  const semanaParam = param(sp, "semana");
  const lunes = lunesDe(esDia(semanaParam) ? semanaParam : hoyMadrid());
  const [c, turnosTipo] = await Promise.all([cuadranteSemana(ctx, centro.id, lunes), listarTurnosTipo(ctx, centro.id)]);
  const editable = ctx.puede("personal:cuadrantes:editar");
  const verCostes = ctx.puede("personal:costes:ver");
  const volver = `/personal/cuadrantes?semana=${lunes}`;

  const avisosPorCelda: Record<string, string[]> = {};
  for (const a of c.avisos) if (a.dia) (avisosPorCelda[`${a.empleadoId}|${a.dia}`] ??= []).push(a.texto);
  const totalHoras = c.totalesDia.reduce((s, d) => s + d.horas, 0);
  const totalCoste = c.totalesDia.reduce((s, d) => s + d.coste, 0);

  return (
    <>
      <Cabecera
        titulo={`Cuadrante · ${centro.nombre}`}
        subtitulo={`Semana del ${fecha(lunes + "T12:00:00Z")} al ${fecha(sumarDias(lunes, 6) + "T12:00:00Z")}`}
        acciones={
          <>
            <BotonEnlace href={`/personal/cuadrantes?semana=${sumarDias(lunes, -7)}`} variante="secundario">
              Semana anterior
            </BotonEnlace>
            <BotonEnlace href="/personal/cuadrantes" variante="secundario">
              Esta semana
            </BotonEnlace>
            <BotonEnlace href={`/personal/cuadrantes?semana=${sumarDias(lunes, 7)}`} variante="secundario">
              Semana siguiente
            </BotonEnlace>
          </>
        }
      />
      <Mensajes sp={sp} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {c.estado === "PUBLICADO" ? <Etiqueta tono="ok">Publicado {fechaHora(c.publicadoEn)}</Etiqueta> : <Etiqueta tono="aviso">Borrador</Etiqueta>}
        {editable && (
          <>
            <form action={copiarSemanaAccion}>
              <Volver a={volver} />
              <input type="hidden" name="centroId" value={centro.id} />
              <input type="hidden" name="lunes" value={lunes} />
              <Boton type="submit" variante="secundario">
                Copiar la semana anterior
              </Boton>
            </form>
            <form action={publicarCuadranteAccion}>
              <Volver a={volver} />
              <input type="hidden" name="centroId" value={centro.id} />
              <input type="hidden" name="lunes" value={lunes} />
              <Boton type="submit">{c.estado === "PUBLICADO" ? "Volver a publicar" : "Publicar"}</Boton>
            </form>
          </>
        )}
      </div>

      <Rejilla columnas={verCostes ? 4 : 3}>
        <Cifra etiqueta="Personas" valor={c.filas.length} detalle="pueden trabajar en este centro" />
        <Cifra etiqueta="Horas previstas" valor={horasTexto(totalHoras)} />
        <Cifra etiqueta="Avisos" valor={c.avisos.length} tono={c.avisos.some((a) => a.tono === "error") ? "error" : c.avisos.length ? "aviso" : "ok"} />
        {verCostes && <Cifra etiqueta="Coste previsto" valor={euros(totalCoste, 0)} detalle="horas × coste/hora del contrato" />}
      </Rejilla>

      <div className="mt-4">
        {c.filas.length === 0 ? (
          <Aviso tono="aviso">No hay personas activas en este centro. Da de alta empleados o añade este centro a su ficha para prestarlos.</Aviso>
        ) : (
          <RejillaCuadrante
            centroId={centro.id}
            dias={c.dias}
            filas={c.filas.map((f) => ({ empleado: f.empleado, jornadaSemanal: f.jornadaSemanal, horasSemana: f.horasSemana, celdas: f.celdas }))}
            turnosTipo={turnosTipo.map((t) => ({ id: t.id, nombre: t.nombre, inicio: t.inicio, fin: t.fin, inicio2: t.inicio2, fin2: t.fin2 }))}
            nombresAusencia={NOMBRE_AUSENCIA}
            avisosPorCelda={avisosPorCelda}
            editable={editable}
            volver={volver}
            guardar={guardarAsignacionAccion}
            quitar={quitarAsignacionAccion}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Avisos legales del cuadrante">
          <Tabla
            filas={c.avisos}
            clave={(a) => `${a.empleadoId}-${a.dia}-${a.texto}`}
            vacio="Sin avisos: descansos, horas y días libres correctos."
            columnas={[
              { titulo: "Persona", celda: (a) => a.empleado },
              { titulo: "Día", celda: (a) => (a.dia ? NOMBRES_DIA[c.dias.indexOf(a.dia)] : "Semana") },
              { titulo: "Aviso", celda: (a) => <Etiqueta tono={a.tono}>{a.texto}</Etiqueta> },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo="Totales por día">
          <Tabla
            filas={c.dias.map((d, i) => ({ d, i, ...c.totalesDia[i] }))}
            clave={(x) => x.d}
            columnas={[
              { titulo: "Día", celda: (x) => NOMBRES_DIA[x.i] },
              { titulo: "Personas", celda: (x) => x.personas, alinear: "derecha" },
              { titulo: "Horas", celda: (x) => horasTexto(x.horas), alinear: "derecha" },
              ...(verCostes ? [{ titulo: "Coste previsto", celda: (x: { coste: number }) => euros(x.coste), alinear: "derecha" as const }] : []),
            ]}
          />
        </Tarjeta>
      </div>

      {editable && (
        <Tarjeta titulo="Turnos tipo del centro (atajos para el cuadrante)" className="mt-4">
          <Tabla
            filas={turnosTipo}
            clave={(t) => t.id}
            vacio="Sin turnos tipo. Crea los habituales (mañana, tarde, partido…)."
            columnas={[
              { titulo: "Nombre", celda: (t) => t.nombre },
              { titulo: "Horario", celda: (t) => `${t.inicio}–${t.fin}${t.inicio2 ? ` y ${t.inicio2}–${t.fin2}` : ""}` },
              { titulo: "Ámbito", celda: (t) => (t.centroId ? "Este centro" : "Todos los centros") },
              {
                titulo: "",
                celda: (t) => (
                  <form action={desactivarTurnoTipoAccion}>
                    <Volver a={volver} />
                    <input type="hidden" name="turnoId" value={t.id} />
                    <Boton type="submit" variante="secundario">
                      Retirar
                    </Boton>
                  </form>
                ),
              },
            ]}
          />
          <form action={crearTurnoTipoAccion} className="mt-4 flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <input type="hidden" name="centroId" value={centro.id} />
            <Campo etiqueta="Nombre">
              <Entrada name="nombre" required placeholder="Mañana" />
            </Campo>
            <Campo etiqueta="Entrada">
              <Entrada type="time" name="inicio" required />
            </Campo>
            <Campo etiqueta="Salida">
              <Entrada type="time" name="fin" required />
            </Campo>
            <Campo etiqueta="Vuelve (partido)">
              <Entrada type="time" name="inicio2" />
            </Campo>
            <Campo etiqueta="Sale (partido)">
              <Entrada type="time" name="fin2" />
            </Campo>
            <Boton type="submit">Crear turno tipo</Boton>
          </form>
        </Tarjeta>
      )}
    </>
  );
}
