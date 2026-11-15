import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Boton, Campo, Entrada, Selector, Aviso, Cifra, Rejilla } from "@/ui";
import * as s from "@/modulos/personal/servicio";
import { ficharPropioAccion, pedirAusenciaPropiaAccion } from "@/modulos/personal/acciones";
import { NOMBRE_FICHAJE, TIPOS_AUSENCIA, NOMBRE_AUSENCIA } from "@/modulos/personal/esquemas";
import { hoyMadrid, NOMBRES_DIA, diaSemana } from "@/modulos/personal/fechas";
import { Mensajes, Volver, EtiquetaAusencia, nombreAusencia, horasTexto, type Busqueda } from "../_componentes/comun";

/** Portal del empleado (primera versión): fichar, ver sus turnos y pedir vacaciones. Pensado para el móvil. */
export default async function MiPortal({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:portal:usar");
  const sp = await searchParams;
  const yo = await s.empleadoDelUsuario(ctx);
  if (!yo) {
    return (
      <>
        <Cabecera titulo="Fichar" />
        <Aviso tono="aviso" titulo="Tu usuario no tiene ficha de empleado">
          Pide a Recursos Humanos que vincule tu usuario a tu ficha para poder fichar y ver tus turnos.
        </Aviso>
      </>
    );
  }
  const hoy = hoyMadrid();
  const [estado, turnos, saldo, ausencias, centros] = await Promise.all([
    s.estadoFichaje(ctx, yo.id),
    s.turnosEmpleado(ctx, yo.id, hoy, 14, { soloPublicados: true }),
    s.saldoVacaciones(ctx, yo.id),
    s.listarAusencias(ctx, { empleadoId: yo.id, desde: hoy }),
    s.mapaCentros(ctx),
  ]);
  const misCentros = [yo.centroPrincipalId, ...yo.centros.map((c) => c.centroId)];
  const turnoHoy = turnos.find((t) => t.dia === hoy);
  // el centro por defecto para fichar sale del turno de hoy aunque su semana aún no esté publicada
  const turnoHoyCualquiera = turnoHoy ?? (await s.turnosEmpleado(ctx, yo.id, hoy, 1)).find((t) => t.dia === hoy);

  return (
    <div className="mx-auto max-w-2xl">
      <Cabecera titulo={`Hola, ${yo.nombre}`} subtitulo={turnoHoy ? `Hoy trabajas en ${turnoHoy.centro} de ${turnoHoy.inicio} a ${turnoHoy.fin2 ?? turnoHoy.fin}` : "Hoy no tienes turno"} />
      <Mensajes sp={sp} />
      <Tarjeta titulo="Fichar">
        <form action={ficharPropioAccion} className="space-y-3">
          <Volver a="/personal/fichar" />
          {misCentros.length > 1 ? (
            <Campo etiqueta="Centro">
              <Selector name="centroId" defaultValue={turnoHoyCualquiera?.centroId ?? yo.centroPrincipalId}>
                {misCentros.map((c) => (
                  <option key={c} value={c}>{centros.get(c)?.nombre ?? c}</option>
                ))}
              </Selector>
            </Campo>
          ) : (
            <input type="hidden" name="centroId" value={yo.centroPrincipalId} />
          )}
          <div className="grid grid-cols-2 gap-3">
            {estado.permitidos.map((t) => (
              <Boton key={t} type="submit" name="tipo" value={t} className="min-h-16 text-base" variante={t === "ENTRADA" || t === "SALIDA" ? "principal" : "secundario"}>
                {NOMBRE_FICHAJE[t]}
              </Boton>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            {estado.ultimo ? `Último fichaje: ${NOMBRE_FICHAJE[estado.ultimo.tipo]} · ${fechaHora(estado.ultimo.momento)}` : "Aún no has fichado."}
            {estado.olvido ? " Parece que no fichaste la salida: avisa a tu encargado." : ""}
          </p>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Mis próximos turnos" className="mt-4">
        <Tabla
          filas={turnos}
          clave={(t) => t.id}
          vacio="No tienes turnos publicados en los próximos 14 días (los cuadrantes en borrador no salen hasta que se publican)."
          columnas={[
            { titulo: "Día", celda: (t) => `${NOMBRES_DIA[diaSemana(t.dia)]} ${fecha(t.fecha)}` },
            { titulo: "Centro", celda: (t) => t.centro },
            { titulo: "Horario", celda: (t) => `${t.inicio}–${t.fin}${t.inicio2 ? ` y ${t.inicio2}–${t.fin2}` : ""}` },
            { titulo: "Horas", celda: (t) => horasTexto(t.horas), alinear: "derecha" },
          ]}
        />
      </Tarjeta>

      {saldo && (
        <div className="mt-4">
          <Rejilla columnas={3}>
            <Cifra etiqueta={`Vacaciones ${saldo.anio}`} valor={`${saldo.derecho} días`} />
            <Cifra etiqueta="Aprobadas y pedidas" valor={saldo.disfrutados + saldo.pedidos} />
            <Cifra etiqueta="Te quedan" valor={saldo.quedan} tono={saldo.quedan < 0 ? "error" : "ok"} />
          </Rejilla>
        </div>
      )}

      <Tarjeta titulo="Pedir vacaciones o permiso" className="mt-4">
        <form action={pedirAusenciaPropiaAccion} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Volver a="/personal/fichar" />
          <Campo etiqueta="Tipo">
            <Selector name="tipo">
              {TIPOS_AUSENCIA.filter((t) => ["VACACIONES", "ASUNTOS_PROPIOS", "PERMISO_RETRIBUIDO"].includes(t)).map((t) => (
                <option key={t} value={t}>{NOMBRE_AUSENCIA[t]}</option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Comentario">
            <Entrada name="comentario" />
          </Campo>
          <Campo etiqueta="Desde">
            <Entrada type="date" name="desde" required />
          </Campo>
          <Campo etiqueta="Hasta">
            <Entrada type="date" name="hasta" required />
          </Campo>
          <Boton type="submit">Enviar petición</Boton>
        </form>
        <div className="mt-4">
          <Tabla
            filas={ausencias}
            clave={(a) => a.id}
            vacio="No tienes ausencias próximas."
            columnas={[
              { titulo: "Tipo", celda: (a) => nombreAusencia(a.tipo) },
              { titulo: "Fechas", celda: (a) => `${fecha(a.desde)} – ${fecha(a.hasta)}` },
              { titulo: "Estado", celda: (a) => <EtiquetaAusencia estado={a.estado} /> },
            ]}
          />
        </div>
      </Tarjeta>
    </div>
  );
}
