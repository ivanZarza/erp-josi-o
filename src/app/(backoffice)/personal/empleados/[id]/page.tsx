import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { euros, fecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Etiqueta, Boton, BotonEnlace, Campo, Entrada, Selector, Pestanas, Cifra, Rejilla, Aviso, Vacio } from "@/ui";
import { DatosDetalle } from "@/ui/tabla-desplegable";
import * as s from "@/modulos/personal/servicio";
import * as a from "@/modulos/personal/acciones";
import { NOMBRE_CONTRATO, NOMBRE_DEPARTAMENTO, NOMBRE_FICHAJE, TIPOS_AUSENCIA, NOMBRE_AUSENCIA, TIPOS_CERTIFICADO, NOMBRE_CERTIFICADO, TIPOS_DOCUMENTO, NOMBRE_DOCUMENTO, TIPOS_FICHAJE } from "@/modulos/personal/esquemas";
import { hoyMadrid, sumarDias, diaISO, NOMBRES_DIA, diaSemana, partesMadrid } from "@/modulos/personal/fechas";
import { CamposEmpleado, CamposContrato } from "../../_componentes/formulario-empleado";
import { Mensajes, Volver, Acciones, EtiquetaContrato, EtiquetaAusencia, EtiquetaCaducidad, nombreAusencia, horasTexto, param, type Busqueda } from "../../_componentes/comun";

export default async function FichaEmpleado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:plantilla:ver");
  const { id } = await params;
  const sp = await searchParams;
  const e = await s.obtenerEmpleado(ctx, id);
  if (!e) notFound();
  const pestana = param(sp, "pestana") ?? "datos";
  const base = `/personal/empleados/${id}`;
  const volver = `${base}?pestana=${pestana}`;
  const hoy = hoyMadrid();
  const centros = await s.mapaCentros(ctx);
  const contrato = s.contratoVigente(e.contratos, hoy);
  const editar = ctx.puede("personal:plantilla:editar");
  const verSalarios = ctx.puede("personal:salarios:ver");

  const pestanas = [
    { clave: "datos", titulo: "Datos" },
    { clave: "contratos", titulo: "Contratos" },
    ...(ctx.puede("personal:cuadrantes:ver") ? [{ clave: "turnos", titulo: "Turnos" }] : []),
    ...(ctx.puede("personal:fichajes:ver") ? [{ clave: "fichajes", titulo: "Fichajes" }] : []),
    ...(ctx.puede("personal:ausencias:ver") ? [{ clave: "ausencias", titulo: "Ausencias" }] : []),
    ...(ctx.puede("personal:formacion:ver") ? [{ clave: "formacion", titulo: "Formación" }] : []),
    ...(ctx.puede("personal:documentos:ver") ? [{ clave: "documentos", titulo: "Documentos" }] : []),
    ...(ctx.puede("personal:nominas:ver") ? [{ clave: "nominas", titulo: "Nóminas" }] : []),
  ];

  return (
    <>
      <Cabecera
        titulo={s.nombreCompleto(e)}
        subtitulo={`${e.codigo} · ${e.puesto?.nombre ?? "Sin puesto"} · ${centros.get(e.centroPrincipalId)?.nombre ?? "—"}`}
        acciones={
          <>
            {e.activo ? <Etiqueta tono="ok">Activo</Etiqueta> : <Etiqueta>Baja el {fecha(e.fechaBaja)}</Etiqueta>}
            <EtiquetaContrato tipo={contrato?.tipo} />
            <BotonEnlace href="/personal/empleados" variante="secundario">
              Volver
            </BotonEnlace>
          </>
        }
      />
      <Mensajes sp={sp} />
      <Pestanas items={pestanas.map((p) => ({ href: `${base}?pestana=${p.clave}`, titulo: p.titulo }))} activa={`${base}?pestana=${pestana}`} />

      {pestana === "datos" && (
        <div className="space-y-4">
          {!e.activo && (
            <Aviso tono="aviso" titulo="Empleado de baja">
              Motivo: {e.motivoBaja ?? "—"}. Su historial se conserva.
              {editar && (
                <form action={a.reactivarEmpleadoAccion} className="mt-3 flex flex-wrap items-end gap-2">
                  <Volver a={volver} />
                  <input type="hidden" name="empleadoId" value={e.id} />
                  <Campo etiqueta="Fecha de reingreso">
                    <Entrada type="date" name="fecha" defaultValue={hoy} required />
                  </Campo>
                  <Boton type="submit" variante="secundario">
                    Reactivar
                  </Boton>
                </form>
              )}
            </Aviso>
          )}
          {editar ? (
            <form action={a.editarEmpleadoAccion}>
              <Volver a={volver} />
              <input type="hidden" name="empleadoId" value={e.id} />
              <Tarjeta titulo="Ficha" acciones={<Boton type="submit">Guardar</Boton>}>
                <p className="mb-4 text-sm text-slate-500">
                  Alta: {fecha(e.fechaAlta)}
                  {e.fechaAntiguedad ? ` · Antigüedad desde el ${fecha(e.fechaAntiguedad)} (reingreso)` : ""}
                </p>
                <CamposEmpleado e={e} centros={ctx.centros} puestos={await s.listarPuestos(ctx)} convenios={await s.listarConvenios(ctx)} sociedades={await s.listarSociedades(ctx)} usuarios={await s.usuariosParaEnlazar(ctx, e.id)} />
              </Tarjeta>
            </form>
          ) : (
            <Tarjeta titulo="Ficha">
              <DatosDetalle
                datos={[
                  { etiqueta: "DNI / NIE", valor: e.dni },
                  { etiqueta: "Teléfono", valor: e.telefono },
                  { etiqueta: "Correo", valor: e.email },
                  { etiqueta: "Alta", valor: fecha(e.fechaAlta) },
                  { etiqueta: "Antigüedad", valor: fecha(e.fechaAntiguedad ?? e.fechaAlta) },
                  { etiqueta: "Usuario de acceso", valor: e.usuarioId ? "Enlazado (puede usar «Fichar»)" : "Sin usuario" },
                  { etiqueta: "Puesto", valor: e.puesto ? `${e.puesto.nombre} · ${NOMBRE_DEPARTAMENTO[e.puesto.departamento]}` : null },
                  { etiqueta: "Categoría", valor: e.categoria?.nombre },
                  { etiqueta: "Otros centros", valor: e.centros.map((x) => centros.get(x.centroId)?.nombre).join(", ") || "Ninguno" },
                  { etiqueta: "Contacto de emergencia", valor: e.contactoEmergencia },
                ]}
              />
            </Tarjeta>
          )}
          {editar && e.activo && (
            <Tarjeta titulo="Baja">
              <form action={a.bajaEmpleadoAccion} className="flex flex-wrap items-end gap-3">
                <Volver a={volver} />
                <input type="hidden" name="empleadoId" value={e.id} />
                <Campo etiqueta="Fecha de baja">
                  <Entrada type="date" name="fecha" defaultValue={hoy} required />
                </Campo>
                <div className="min-w-64 flex-1">
                  <Campo etiqueta="Motivo" ayuda="Se finaliza su contrato (y se anulan los que aún no habían empezado), se quitan sus turnos posteriores, se anulan sus peticiones pendientes y se desactiva al momento su usuario de acceso. Nada se borra.">
                    <Entrada name="motivo" required />
                  </Campo>
                </div>
                <Boton variante="peligro" type="submit">
                  Dar de baja
                </Boton>
              </form>
            </Tarjeta>
          )}
        </div>
      )}

      {pestana === "contratos" && (
        <div className="space-y-4">
          <Tabla
            filas={e.contratos}
            clave={(c) => c.id}
            vacio="Sin contratos registrados."
            columnas={[
              { titulo: "Tipo", celda: (c) => NOMBRE_CONTRATO[c.tipo] },
              { titulo: "Jornada", celda: (c) => `${numero(c.jornadaSemanal)} h/sem`, alinear: "derecha" },
              { titulo: "Desde", celda: (c) => fecha(c.fechaInicio) },
              { titulo: "Hasta", celda: (c) => (!c.fechaFin ? "Indefinido" : c.fechaFin < c.fechaInicio ? "Anulado antes de empezar" : fecha(c.fechaFin)) },
              { titulo: "Prueba hasta", celda: (c) => fecha(c.finPeriodoPrueba) },
              { titulo: "Convenio", celda: (c) => [c.convenio?.nombre, c.categoria?.nombre].filter(Boolean).join(" · ") || "—" },
              ...(verSalarios
                ? [
                    { titulo: "Salario anual", celda: (c: (typeof e.contratos)[number]) => (c.salarioBrutoAnual ? euros(c.salarioBrutoAnual) : "—"), alinear: "derecha" as const },
                    { titulo: "Coste/hora", celda: (c: (typeof e.contratos)[number]) => { const v = s.costeHoraContrato(c); return v !== null ? euros(v) : "—"; }, alinear: "derecha" as const },
                  ]
                : []),
              { titulo: "Estado", celda: (c) => (c.activo ? <Etiqueta tono="ok">En vigor</Etiqueta> : <Etiqueta>{c.motivoFin ?? "Finalizado"}</Etiqueta>) },
              {
                titulo: "",
                celda: (c) =>
                  editar && c.activo ? (
                    <form action={a.finalizarContratoAccion} className="flex items-end gap-2">
                      <Volver a={volver} />
                      <input type="hidden" name="contratoId" value={c.id} />
                      <Entrada type="date" name="fecha" defaultValue={c.fechaFin ? diaISO(c.fechaFin) : hoy} required className="w-36" />
                      <Entrada name="motivo" placeholder="Motivo" required className="w-40" />
                      <Boton variante="secundario" type="submit">
                        Finalizar
                      </Boton>
                    </form>
                  ) : null,
              },
            ]}
          />
          {editar && e.activo && (
            <form action={a.crearContratoAccion}>
              <Volver a={volver} />
              <input type="hidden" name="empleadoId" value={e.id} />
              <Tarjeta titulo="Nuevo contrato (renovación, cambio de jornada o de tipo)" acciones={<Boton type="submit">Guardar contrato</Boton>}>
                <p className="mb-3 text-xs text-slate-500">El contrato en vigor se cierra automáticamente el día antes del inicio del nuevo.</p>
                <CamposContrato convenios={await s.listarConvenios(ctx)} sociedades={await s.listarSociedades(ctx)} verSalarios={verSalarios} fechaInicio={hoy} />
              </Tarjeta>
            </form>
          )}
        </div>
      )}

      {pestana === "turnos" && <PestanaTurnos empleadoId={e.id} />}
      {pestana === "fichajes" && <PestanaFichajes e={e} volver={volver} />}
      {pestana === "ausencias" && <PestanaAusencias e={e} volver={volver} />}
      {pestana === "formacion" && (
        <div className="space-y-4">
          <Tabla
            filas={e.certificados}
            clave={(c) => c.id}
            vacio="Sin certificados ni formaciones."
            columnas={[
              { titulo: "Tipo", celda: (c) => NOMBRE_CERTIFICADO[c.tipo as keyof typeof NOMBRE_CERTIFICADO] ?? c.tipo },
              { titulo: "Nombre", celda: (c) => c.nombre },
              { titulo: "Entidad", celda: (c) => c.entidad ?? "—" },
              { titulo: "Obtenido", celda: (c) => fecha(c.obtenidoEn) },
              { titulo: "Caducidad", celda: (c) => (c.activo ? <EtiquetaCaducidad caducaEn={c.caducaEn} /> : <Etiqueta>Sustituido</Etiqueta>) },
              {
                titulo: "",
                celda: (c) =>
                  c.activo && ctx.puede("personal:formacion:editar") ? (
                    <form action={a.desactivarCertificadoAccion}>
                      <Volver a={volver} />
                      <input type="hidden" name="certificadoId" value={c.id} />
                      <Boton variante="secundario" type="submit">
                        Retirar
                      </Boton>
                    </form>
                  ) : null,
              },
            ]}
          />
          {ctx.puede("personal:formacion:editar") && (
            <Tarjeta titulo="Añadir certificado o formación">
              <form action={a.crearCertificadoAccion} className="flex flex-wrap items-end gap-3">
                <Volver a={volver} />
                <input type="hidden" name="empleadoId" value={e.id} />
                <Campo etiqueta="Tipo">
                  <Selector name="tipo">
                    {TIPOS_CERTIFICADO.map((t) => (
                      <option key={t} value={t}>
                        {NOMBRE_CERTIFICADO[t]}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Nombre (opcional)">
                  <Entrada name="nombre" />
                </Campo>
                <Campo etiqueta="Entidad">
                  <Entrada name="entidad" />
                </Campo>
                <Campo etiqueta="Obtenido">
                  <Entrada type="date" name="obtenidoEn" />
                </Campo>
                <Campo etiqueta="Caduca">
                  <Entrada type="date" name="caducaEn" />
                </Campo>
                <Boton type="submit">Añadir</Boton>
              </form>
            </Tarjeta>
          )}
        </div>
      )}
      {pestana === "nominas" && ctx.puede("personal:nominas:ver") && <PestanaNominas empleadoId={e.id} />}
      {pestana === "documentos" && ctx.puede("personal:documentos:ver") && (
        <div className="space-y-4">
          <Aviso>Por ahora solo se guardan los datos del documento. Los archivos se subirán al almacén de archivos (R2) cuando esté conectado.</Aviso>
          <Tabla
            filas={e.documentos}
            clave={(d) => d.id}
            vacio="Sin documentos registrados."
            columnas={[
              { titulo: "Tipo", celda: (d) => NOMBRE_DOCUMENTO[d.tipo as keyof typeof NOMBRE_DOCUMENTO] ?? d.tipo },
              { titulo: "Documento", celda: (d) => d.nombre },
              { titulo: "Registrado", celda: (d) => fecha(d.createdAt) },
              { titulo: "Caducidad", celda: (d) => (d.activo ? (d.caducaEn ? <EtiquetaCaducidad caducaEn={d.caducaEn} /> : "—") : <Etiqueta>Retirado</Etiqueta>) },
              {
                titulo: "",
                celda: (d) =>
                  d.activo ? (
                    <form action={a.desactivarDocumentoAccion}>
                      <Volver a={volver} />
                      <input type="hidden" name="documentoId" value={d.id} />
                      <Boton variante="secundario" type="submit">
                        Retirar
                      </Boton>
                    </form>
                  ) : null,
              },
            ]}
          />
          <Tarjeta titulo="Registrar documento">
            <form action={a.registrarDocumentoAccion} className="flex flex-wrap items-end gap-3">
              <Volver a={volver} />
              <input type="hidden" name="empleadoId" value={e.id} />
              <Campo etiqueta="Tipo">
                <Selector name="tipo">
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t} value={t}>
                      {NOMBRE_DOCUMENTO[t]}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre">
                <Entrada name="nombre" required />
              </Campo>
              <Campo etiqueta="Caduca">
                <Entrada type="date" name="caducaEn" />
              </Campo>
              <Boton type="submit">Registrar</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}

async function PestanaTurnos({ empleadoId }: { empleadoId: string }) {
  const ctx = await exigir("personal", "personal:cuadrantes:ver");
  const desde = sumarDias(hoyMadrid(), -7);
  const turnos = await s.turnosEmpleado(ctx, empleadoId, desde, 28);
  return (
    <Tabla
      filas={turnos}
      clave={(t) => t.id}
      vacio="Sin turnos en las últimas y próximas semanas."
      columnas={[
        { titulo: "Día", celda: (t) => `${NOMBRES_DIA[diaSemana(t.dia)]} ${fecha(t.fecha)}` },
        { titulo: "Centro", celda: (t) => t.centro },
        { titulo: "Horario", celda: (t) => `${t.inicio}–${t.fin}${t.inicio2 ? ` y ${t.inicio2}–${t.fin2}` : ""}` },
        { titulo: "Horas", celda: (t) => horasTexto(t.horas), alinear: "derecha" },
        { titulo: "Cuadrante", celda: (t) => (t.publicado ? <Etiqueta tono="ok">Publicado</Etiqueta> : <Etiqueta tono="aviso">Borrador</Etiqueta>) },
        { titulo: "Notas", celda: (t) => t.notas ?? "" },
      ]}
    />
  );
}

async function PestanaFichajes({ e, volver }: { e: s.EmpleadoFicha; volver: string }) {
  const ctx = await exigir("personal", "personal:fichajes:ver");
  const hoy = hoyMadrid();
  const [jornadas, estado] = await Promise.all([s.jornadasRango(ctx, sumarDias(hoy, -30), hoy, e.id), s.estadoFichaje(ctx, e.id)]);
  const autores = await s.nombresUsuarios(ctx, jornadas.flatMap((j) => j.fichajes.map((f) => f.corregidoPor)));
  const centros = await s.mapaCentros(ctx);
  const corregir = ctx.puede("personal:fichajes:corregir");
  const total = jornadas.reduce((t, j) => t + j.horas, 0);
  return (
    <div className="space-y-4">
      {e.activo && corregir && (
        <Tarjeta titulo="Fichar ahora (por esta persona)">
          <form action={a.ficharAccion} className="flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <input type="hidden" name="empleadoId" value={e.id} />
            <input type="hidden" name="origen" value="PANTALLA" />
            <Campo etiqueta="Centro">
              <Selector name="centroId" defaultValue={ctx.centroActivo?.id ?? e.centroPrincipalId}>
                {[e.centroPrincipalId, ...e.centros.map((c) => c.centroId)].map((c) => (
                  <option key={c} value={c}>
                    {centros.get(c)?.nombre ?? c}
                  </option>
                ))}
              </Selector>
            </Campo>
            {estado.permitidos.map((t) => (
              <Boton key={t} type="submit" name="tipo" value={t} variante={t === "ENTRADA" || t === "SALIDA" ? "principal" : "secundario"}>
                {NOMBRE_FICHAJE[t]}
              </Boton>
            ))}
            <span className="text-sm text-slate-500">
              {estado.ultimo ? `Último: ${NOMBRE_FICHAJE[estado.ultimo.tipo]} ${fechaHora(estado.ultimo.momento)}` : "Sin fichajes"}
              {estado.olvido ? " (parece que olvidó fichar la salida)" : ""}
            </span>
          </form>
        </Tarjeta>
      )}
      <Rejilla columnas={3}>
        <Cifra etiqueta="Jornadas (30 días)" valor={jornadas.length} />
        <Cifra etiqueta="Horas fichadas" valor={horasTexto(total)} />
        <Cifra etiqueta="Jornadas incompletas" valor={jornadas.filter((j) => j.incompleta).length} tono={jornadas.some((j) => j.incompleta) ? "aviso" : "ok"} />
      </Rejilla>
      {jornadas.length === 0 ? (
        <Vacio>Sin fichajes en los últimos 30 días.</Vacio>
      ) : (
        <Tabla
          filas={jornadas.flatMap((j) => j.fichajes.map((f) => ({ j, f })))}
          clave={(x) => x.f.id}
          columnas={[
            { titulo: "Jornada", celda: (x) => fecha(x.j.dia + "T12:00:00Z") },
            { titulo: "Tipo", celda: (x) => NOMBRE_FICHAJE[x.f.tipo as keyof typeof NOMBRE_FICHAJE] },
            { titulo: "Hora", celda: (x) => (x.f.anulado ? <s className="text-slate-400">{fechaHora(x.f.momento)}</s> : fechaHora(x.f.momento)) },
            { titulo: "Centro", celda: (x) => centros.get(x.f.centroId)?.nombre ?? "—" },
            { titulo: "Origen", celda: (x) => x.f.origen.toLowerCase() },
            { titulo: "Corrección", celda: (x) => (x.f.motivoCorreccion ? `${x.f.anulado ? "Anulado" : "Corregido"} por ${autores.get(x.f.corregidoPor ?? "") ?? "—"}: ${x.f.motivoCorreccion}` : "") },
            {
              titulo: "",
              celda: (x) =>
                corregir && !x.f.anulado ? (
                  <form action={a.corregirFichajeAccion} className="flex items-end gap-1">
                    <Volver a={volver} />
                    <input type="hidden" name="fichajeId" value={x.f.id} />
                    <input type="hidden" name="tipo" value={x.f.tipo} />
                    <input type="hidden" name="dia" value={partesMadrid(x.f.momento).dia} />
                    <Entrada name="hora" type="time" defaultValue={partesMadrid(x.f.momento).hora} className="w-28" required />
                    <Entrada name="motivo" placeholder="Motivo" className="w-36" required />
                    <Boton variante="secundario" type="submit">
                      Corregir
                    </Boton>
                  </form>
                ) : null,
            },
          ]}
        />
      )}
      {corregir && (
        <Tarjeta titulo="Añadir fichaje olvidado">
          <form action={a.fichajeManualAccion} className="flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <input type="hidden" name="empleadoId" value={e.id} />
            <input type="hidden" name="centroId" value={ctx.centroActivo?.id ?? e.centroPrincipalId} />
            <Campo etiqueta="Tipo">
              <Selector name="tipo">
                {TIPOS_FICHAJE.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_FICHAJE[t]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Día">
              <Entrada type="date" name="dia" defaultValue={hoy} required />
            </Campo>
            <Campo etiqueta="Hora">
              <Entrada type="time" name="hora" required />
            </Campo>
            <Campo etiqueta="Motivo">
              <Entrada name="motivo" required />
            </Campo>
            <Boton type="submit">Añadir</Boton>
          </form>
        </Tarjeta>
      )}
    </div>
  );
}

async function PestanaAusencias({ e, volver }: { e: s.EmpleadoFicha; volver: string }) {
  const ctx = await exigir("personal", "personal:ausencias:ver");
  const saldo = await s.saldoVacaciones(ctx, e.id);
  const aprobar = ctx.puede("personal:ausencias:aprobar");
  return (
    <div className="space-y-4">
      {saldo && (
        <Rejilla columnas={4}>
          <Cifra etiqueta={`Vacaciones ${saldo.anio}`} valor={`${saldo.derecho} días`} detalle="según convenio y fecha de alta" />
          <Cifra etiqueta="Aprobadas" valor={saldo.disfrutados} />
          <Cifra etiqueta="Pedidas" valor={saldo.pedidos} tono={saldo.pedidos ? "aviso" : "normal"} />
          <Cifra etiqueta="Quedan" valor={saldo.quedan} tono={saldo.quedan < 0 ? "error" : "ok"} />
        </Rejilla>
      )}
      <Tabla
        filas={e.ausencias}
        clave={(x) => x.id}
        vacio="Sin ausencias."
        columnas={[
          { titulo: "Tipo", celda: (x) => nombreAusencia(x.tipo) },
          { titulo: "Desde", celda: (x) => fecha(x.desde) },
          { titulo: "Hasta", celda: (x) => fecha(x.hasta) },
          { titulo: "Días", celda: (x) => x.dias, alinear: "derecha" },
          { titulo: "Estado", celda: (x) => <EtiquetaAusencia estado={x.estado} /> },
          { titulo: "Comentario", celda: (x) => x.motivoRechazo ?? x.comentario ?? "" },
          {
            titulo: "",
            celda: (x) =>
              aprobar && (x.estado === "PEDIDA" || x.estado === "APROBADA") ? (
                <form action={a.resolverAusenciaAccion} className="flex gap-1">
                  <Volver a={volver} />
                  <input type="hidden" name="ausenciaId" value={x.id} />
                  {x.estado === "PEDIDA" && (
                    <Boton type="submit" name="decision" value="APROBAR">
                      Aprobar
                    </Boton>
                  )}
                  <Boton type="submit" name="decision" value="ANULAR" variante="secundario">
                    Anular
                  </Boton>
                </form>
              ) : null,
          },
        ]}
      />
      {e.activo && (
        <Tarjeta titulo="Nueva ausencia">
          <form action={a.pedirAusenciaAccion} className="flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <input type="hidden" name="empleadoId" value={e.id} />
            <Campo etiqueta="Tipo">
              <Selector name="tipo">
                {TIPOS_AUSENCIA.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_AUSENCIA[t]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Desde">
              <Entrada type="date" name="desde" required />
            </Campo>
            <Campo etiqueta="Hasta">
              <Entrada type="date" name="hasta" required />
            </Campo>
            <Campo etiqueta="Comentario">
              <Entrada name="comentario" />
            </Campo>
            {aprobar && (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name="aprobarYa" className="h-4 w-4 accent-acento" /> Aprobar ya
              </label>
            )}
            <Boton type="submit">Guardar</Boton>
          </form>
        </Tarjeta>
      )}
    </div>
  );
}

/** Nóminas del empleado (las últimas 24), con enlace al mes en la pantalla de Nóminas. */
async function PestanaNominas({ empleadoId }: { empleadoId: string }) {
  const ctx = await exigir("personal", "personal:nominas:ver");
  const nominas = await s.nominasEmpleado(ctx, empleadoId);
  const estado = { BORRADOR: "Borrador", CERRADA: "Cerrada", PAGADA: "Pagada" } as Record<string, string>;
  return (
    <Tabla
      filas={nominas}
      clave={(n) => n.id}
      vacio="Todavía no tiene nóminas calculadas."
      columnas={[
        { titulo: "Mes", celda: (n) => <BotonEnlace href={`/personal/nominas?mes=${n.periodo}&centroId=${n.centroId}`} variante="secundario">{n.periodo.split("-").reverse().join("/")}</BotonEnlace> },
        { titulo: "Días", celda: (n) => `${n.diasCotizados}${n.diasIT ? ` (${n.diasIT} IT)` : ""}`, alinear: "derecha" },
        { titulo: "Horas extra", celda: (n) => (Number(n.horasExtra) ? horasTexto(Number(n.horasExtra)) : "—"), alinear: "derecha" },
        { titulo: "Bruto", celda: (n) => euros(n.devengado), alinear: "derecha" },
        { titulo: "Neto", celda: (n) => euros(n.neto), alinear: "derecha" },
        { titulo: "Coste empresa", celda: (n) => euros(n.costeEmpresa), alinear: "derecha" },
        { titulo: "Estado", celda: (n) => <Etiqueta tono={n.estado === "PAGADA" ? "ok" : n.estado === "CERRADA" ? "info" : "aviso"}>{estado[n.estado] ?? n.estado}</Etiqueta> },
        { titulo: "Pagada", celda: (n) => (n.fechaPago ? fecha(n.fechaPago) : "—") },
      ]}
    />
  );
}
