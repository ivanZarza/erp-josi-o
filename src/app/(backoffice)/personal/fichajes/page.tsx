import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Etiqueta, Boton, BotonEnlace, Campo, Entrada, Selector, HuecoIntegracion, Cifra, Rejilla, Aviso } from "@/ui";
import { TablaDesplegable } from "@/ui/tabla-desplegable";
import * as s from "@/modulos/personal/servicio";
import { ficharAccion, corregirFichajeAccion, anularFichajeAccion, fichajeManualAccion } from "@/modulos/personal/acciones";
import { NOMBRE_FICHAJE, TIPOS_FICHAJE } from "@/modulos/personal/esquemas";
import { esDia, hoyMadrid, sumarDias, partesMadrid, NOMBRES_DIA, diaSemana } from "@/modulos/personal/fechas";
import { Mensajes, Volver, Acciones, horasTexto, param, type Busqueda } from "../_componentes/comun";

const ESTADO_DIF: Record<s.Diferencia["estado"], { texto: string; tono: "ok" | "aviso" | "error" | "normal" }> = {
  OK: { texto: "Correcto", tono: "ok" },
  RETRASO: { texto: "Retraso", tono: "aviso" },
  SALIDA_ANTES: { texto: "Salió antes", tono: "aviso" },
  HORAS_DE_MAS: { texto: "Horas de más", tono: "aviso" },
  SIN_FICHAR: { texto: "Sin fichar", tono: "error" },
  SIN_TURNO: { texto: "Fichó sin turno", tono: "normal" },
  INCOMPLETA: { texto: "Jornada incompleta", tono: "error" },
};

export default async function Fichajes({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:fichajes:ver");
  const sp = await searchParams;
  const hoy = hoyMadrid();
  const diaP = param(sp, "dia");
  const dia = esDia(diaP) ? diaP : hoy;
  const volver = `/personal/fichajes?dia=${dia}`;
  const corregir = ctx.puede("personal:fichajes:corregir");

  const [jornadas, diferencias, centros] = await Promise.all([s.jornadasRango(ctx, dia, dia), s.diferenciasCuadranteFichaje(ctx, sumarDias(dia, -6), dia), s.mapaCentros(ctx)]);
  const plantilla = ctx.centroActivo ? await s.empleadosDelCentro(ctx, ctx.centroActivo.id) : [];
  const ids = Array.from(new Set([...jornadas.map((j) => j.empleadoId), ...diferencias.map((d) => d.empleadoId)]));
  const nombres = new Map((await s.listarEmpleados(ctx, { estado: "todos" })).filter((e) => ids.includes(e.id)).map((e) => [e.id, s.nombreCompleto(e)]));
  const autores = await s.nombresUsuarios(ctx, jornadas.flatMap((j) => j.fichajes.map((f) => f.corregidoPor)));
  const incidencias = diferencias.filter((d) => d.estado !== "OK");

  return (
    <>
      <Cabecera
        titulo="Fichajes"
        subtitulo={`${ctx.centroActivo?.nombre ?? "Todos tus centros"} · ${NOMBRES_DIA[diaSemana(dia)]} ${fecha(dia + "T12:00:00Z")}`}
        acciones={
          <>
            <BotonEnlace href={`/personal/fichajes?dia=${sumarDias(dia, -1)}`} variante="secundario">
              Día anterior
            </BotonEnlace>
            <BotonEnlace href="/personal/fichajes" variante="secundario">
              Hoy
            </BotonEnlace>
            {dia < hoy && (
              <BotonEnlace href={`/personal/fichajes?dia=${sumarDias(dia, 1)}`} variante="secundario">
                Día siguiente
              </BotonEnlace>
            )}
          </>
        }
      />
      <Mensajes sp={sp} />

      {ctx.centroActivo ? (
        <Tarjeta titulo={`Fichar en ${ctx.centroActivo.nombre} (tableta del local)`} className="mb-4">
          <form action={ficharAccion} className="flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <input type="hidden" name="centroId" value={ctx.centroActivo.id} />
            <input type="hidden" name="origen" value="TABLETA" />
            <div className="min-w-64">
              <Campo etiqueta="Persona">
                <Selector name="empleadoId" required defaultValue="">
                  <option value="">Elige…</option>
                  {plantilla.map((e) => (
                    <option key={e.id} value={e.id}>
                      {s.nombreCompleto(e)}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
            <Campo etiqueta="PIN">
              <Entrada name="pin" type="password" inputMode="numeric" maxLength={4} className="w-24" />
            </Campo>
            {TIPOS_FICHAJE.map((t) => (
              <Boton key={t} type="submit" name="tipo" value={t} variante={t === "ENTRADA" || t === "SALIDA" ? "principal" : "secundario"}>
                {NOMBRE_FICHAJE[t]}
              </Boton>
            ))}
          </form>
          <p className="mt-2 text-xs text-slate-500">Si la persona tiene PIN en su ficha, se le pide. El sistema comprueba el orden: entrada, pausas y salida.</p>
        </Tarjeta>
      ) : (
        <Aviso tono="info">Elige un centro arriba para fichar desde la tableta del local.</Aviso>
      )}

      <div className="my-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Jornadas del día" valor={jornadas.length} />
          <Cifra etiqueta="Horas fichadas" valor={horasTexto(jornadas.reduce((t, j) => t + j.horas, 0))} />
          <Cifra etiqueta="Incompletas" valor={jornadas.filter((j) => j.incompleta).length} tono={jornadas.some((j) => j.incompleta) ? "aviso" : "ok"} />
          <Cifra etiqueta="Diferencias (7 días)" valor={incidencias.length} tono={incidencias.some((d) => ESTADO_DIF[d.estado].tono === "error") ? "error" : incidencias.length ? "aviso" : "ok"} />
        </Rejilla>
      </div>

      <TablaDesplegable
        columnas={[{ titulo: "Persona" }, { titulo: "Centro", secundaria: true }, { titulo: "Entrada" }, { titulo: "Salida" }, { titulo: "Pausas", alinear: "derecha", secundaria: true }, { titulo: "Horas", alinear: "derecha" }, { titulo: "Estado" }]}
        total={`${jornadas.length} jornadas`}
        vacio="Nadie ha fichado este día."
        filas={jornadas.map((j) => ({
          id: `${j.empleadoId}-${j.dia}`,
          tono: j.incompleta ? "aviso" : undefined,
          celdas: [
            <Link key="n" className="font-medium text-acento hover:underline" href={`/personal/empleados/${j.empleadoId}?pestana=fichajes`}>
              {nombres.get(j.empleadoId) ?? "—"}
            </Link>,
            centros.get(j.centroId)?.nombre ?? "—",
            j.entrada ? partesMadrid(j.entrada).hora : "—",
            j.salida ? partesMadrid(j.salida).hora : "—",
            `${Math.round(j.minutosPausa)} min`,
            horasTexto(j.horas),
            j.incompleta ? <Etiqueta key="e" tono="aviso">Incompleta</Etiqueta> : <Etiqueta key="e" tono="ok">Cerrada</Etiqueta>,
          ],
          detalle: (
            <>
              <Tabla
                filas={j.fichajes}
                clave={(f) => f.id}
                columnas={[
                  { titulo: "Tipo", celda: (f) => NOMBRE_FICHAJE[f.tipo as keyof typeof NOMBRE_FICHAJE] },
                  { titulo: "Hora", celda: (f) => (f.anulado ? <s className="text-slate-400">{fechaHora(f.momento)}</s> : fechaHora(f.momento)) },
                  { titulo: "Origen", celda: (f) => f.origen.toLowerCase() },
                  { titulo: "Corrección", celda: (f) => (f.motivoCorreccion ? `${f.anulado ? "Anulado" : f.corrigeAId ? "Corrige otro" : "Añadido a mano"} · ${autores.get(f.corregidoPor ?? "") ?? "—"} · ${fechaHora(f.corregidoEn)} · ${f.motivoCorreccion}` : "") },
                  {
                    titulo: "",
                    celda: (f) =>
                      corregir && !f.anulado ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={corregirFichajeAccion} className="flex items-end gap-1">
                            <Volver a={volver} />
                            <input type="hidden" name="fichajeId" value={f.id} />
                            <input type="hidden" name="dia" value={partesMadrid(f.momento).dia} />
                            <Selector name="tipo" defaultValue={f.tipo} className="w-36">
                              {TIPOS_FICHAJE.map((t) => (
                                <option key={t} value={t}>
                                  {NOMBRE_FICHAJE[t]}
                                </option>
                              ))}
                            </Selector>
                            <Entrada name="hora" type="time" defaultValue={partesMadrid(f.momento).hora} className="w-28" required />
                            <Entrada name="motivo" placeholder="Motivo" className="w-36" required />
                            <Boton variante="secundario" type="submit">
                              Corregir
                            </Boton>
                          </form>
                          <form action={anularFichajeAccion} className="flex items-end gap-1">
                            <Volver a={volver} />
                            <input type="hidden" name="fichajeId" value={f.id} />
                            <Entrada name="motivo" placeholder="Motivo" className="w-32" required />
                            <Boton variante="secundario" type="submit">
                              Anular
                            </Boton>
                          </form>
                        </div>
                      ) : null,
                  },
                ]}
              />
              {corregir && (
                <Acciones>
                  <form action={fichajeManualAccion} className="flex flex-wrap items-end gap-2">
                    <Volver a={volver} />
                    <input type="hidden" name="empleadoId" value={j.empleadoId} />
                    <input type="hidden" name="centroId" value={j.centroId} />
                    <input type="hidden" name="dia" value={j.dia} />
                    <Campo etiqueta="Añadir fichaje olvidado">
                      <Selector name="tipo" defaultValue="SALIDA">
                        {TIPOS_FICHAJE.map((t) => (
                          <option key={t} value={t}>
                            {NOMBRE_FICHAJE[t]}
                          </option>
                        ))}
                      </Selector>
                    </Campo>
                    <Campo etiqueta="Hora">
                      <Entrada type="time" name="hora" required />
                    </Campo>
                    <Campo etiqueta="Motivo">
                      <Entrada name="motivo" required />
                    </Campo>
                    <Boton type="submit">Añadir</Boton>
                  </form>
                </Acciones>
              )}
            </>
          ),
        }))}
      />

      <Tarjeta titulo="Diferencias entre cuadrante y fichajes (últimos 7 días)" className="mt-6">
        <Tabla
          filas={incidencias}
          clave={(d) => `${d.empleadoId}-${d.dia}-${d.estado}`}
          vacio="Todo cuadra: cada turno tiene su fichaje dentro de la tolerancia de 5 minutos."
          columnas={[
            { titulo: "Día", celda: (d) => `${NOMBRES_DIA[diaSemana(d.dia)]} ${fecha(d.dia + "T12:00:00Z")}` },
            { titulo: "Persona", celda: (d) => nombres.get(d.empleadoId) ?? "—" },
            { titulo: "Centro", celda: (d) => centros.get(d.centroId)?.nombre ?? "—" },
            { titulo: "Previsto", celda: (d) => (d.previsto ? `${d.previsto.inicio}–${d.previsto.fin} (${horasTexto(d.previsto.horas)})` : "—") },
            { titulo: "Real", celda: (d) => (d.real ? `${d.real.entrada ? partesMadrid(d.real.entrada).hora : "?"}–${d.real.salida ? partesMadrid(d.real.salida).hora : "?"} (${horasTexto(d.real.horas)})` : "—") },
            { titulo: "Diferencia", celda: (d) => horasTexto(d.diferenciaHoras), alinear: "derecha" },
            { titulo: "Estado", celda: (d) => <Etiqueta tono={ESTADO_DIF[d.estado].tono}>{ESTADO_DIF[d.estado].texto}{d.estado === "RETRASO" ? ` ${d.retrasoMin} min` : d.estado === "SALIDA_ANTES" ? ` ${d.salidaAntesMin} min` : ""}</Etiqueta> },
          ]}
        />
      </Tarjeta>

      <div className="mt-6">
        <HuecoIntegracion nombre="Sesame / Factorial" descripcion="Para las cadenas que ya fichan con Sesame HR o Factorial, se leerán de allí los fichajes y ausencias (origen «importado»)" />
      </div>
    </>
  );
}
