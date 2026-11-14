import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { fecha, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Boton, Campo, Entrada, Selector, AreaTexto, Etiqueta, Cifra, Rejilla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import * as s from "@/modulos/personal/servicio";
import * as a from "@/modulos/personal/acciones";
import { TIPOS_CONTRATO, NOMBRE_CONTRATO, ESTADOS_CANDIDATO, NOMBRE_ESTADO_CANDIDATO } from "@/modulos/personal/esquemas";
import { hoyMadrid } from "@/modulos/personal/fechas";
import { Mensajes, Volver, Acciones, EtiquetaCandidato, type Busqueda } from "../_componentes/comun";

type Candidato = Awaited<ReturnType<typeof s.bolsaCandidatos>>[number];

export default async function Seleccion({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:seleccion:ver");
  const sp = await searchParams;
  const volver = "/personal/seleccion";
  const editar = ctx.puede("personal:seleccion:editar");
  const contratar = editar && ctx.puede("personal:plantilla:editar");
  const [ofertas, bolsa, puestos, centros] = await Promise.all([s.listarOfertas(ctx), s.bolsaCandidatos(ctx), s.listarPuestos(ctx), s.mapaCentros(ctx)]);
  const abiertas = ofertas.filter((o) => o.estado === "ABIERTA");
  const enProceso = ofertas.flatMap((o) => o.candidatos).filter((c) => ["ENTREVISTA", "PRUEBA", "OFERTA"].includes(c.estado));
  const hoy = hoyMadrid();

  const accionesCandidato = (c: Candidato, centroDefecto?: string, puestoDefecto?: string | null) =>
    editar && c.estado !== "CONTRATADO" ? (
      <div className="flex flex-wrap gap-2">
        <form action={a.estadoCandidatoAccion} className="flex items-end gap-1">
          <Volver a={volver} />
          <input type="hidden" name="candidatoId" value={c.id} />
          <Selector name="estado" defaultValue={c.estado} className="w-36">
            {ESTADOS_CANDIDATO.filter((e) => e !== "CONTRATADO").map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESTADO_CANDIDATO[e]}
              </option>
            ))}
          </Selector>
          <Entrada name="notas" placeholder="Nota" className="w-36" />
          <Boton type="submit" variante="secundario">
            Cambiar
          </Boton>
        </form>
        {contratar && c.estado !== "DESCARTADO" && (
          <form action={a.contratarCandidatoAccion} className="flex items-end gap-1">
            <Volver a={volver} />
            <input type="hidden" name="candidatoId" value={c.id} />
            <Selector name="centroPrincipalId" defaultValue={centroDefecto ?? ctx.centroActivo?.id ?? ""} required className="w-40">
              <option value="">Centro…</option>
              {ctx.centros.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </Selector>
            <Selector name="puestoId" defaultValue={puestoDefecto ?? ""} className="w-40">
              <option value="">Puesto…</option>
              {puestos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
            <Entrada type="date" name="fechaAlta" defaultValue={hoy} className="w-36" required />
            <Boton type="submit">Contratar</Boton>
          </form>
        )}
      </div>
    ) : c.empleadoId ? (
      <Link className="text-acento hover:underline" href={`/personal/empleados/${c.empleadoId}`}>
        Ver ficha
      </Link>
    ) : null;

  const tablaCandidatos = (lista: Candidato[], centroDefecto?: string, puestoDefecto?: string | null) => (
    <Tabla
      filas={lista}
      clave={(c) => c.id}
      vacio="Sin candidatos todavía."
      columnas={[
        { titulo: "Candidato", celda: (c) => `${c.nombre} ${c.apellidos ?? ""}` },
        { titulo: "Contacto", celda: (c) => [c.telefono, c.email].filter(Boolean).join(" · ") },
        { titulo: "Origen", celda: (c) => c.origen ?? "—" },
        { titulo: "Estado", celda: (c) => <EtiquetaCandidato estado={c.estado} /> },
        { titulo: "Datos hasta", celda: (c) => fecha(c.borrarEn) },
        { titulo: "", celda: (c) => accionesCandidato(c, centroDefecto, puestoDefecto) },
      ]}
    />
  );

  return (
    <>
      <Cabecera titulo="Selección" subtitulo="Ofertas de empleo, candidatos y bolsa para cubrir bajas y temporada" />
      <Mensajes sp={sp} />
      <Rejilla columnas={3}>
        <Cifra etiqueta="Ofertas abiertas" valor={abiertas.length} detalle={`${abiertas.reduce((t, o) => t + o.plazas, 0)} plazas`} />
        <Cifra etiqueta="Candidatos en proceso" valor={enProceso.length} detalle="entrevista, prueba u oferta" />
        <Cifra etiqueta="Bolsa de candidatos" valor={bolsa.length} />
      </Rejilla>

      <div className="mt-4">
        <TablaDesplegable
          columnas={[{ titulo: "Oferta" }, { titulo: "Centro" }, { titulo: "Puesto", secundaria: true }, { titulo: "Plazas", alinear: "derecha" }, { titulo: "Candidatos", alinear: "derecha" }, { titulo: "Estado" }]}
          total={`${ofertas.length} ofertas`}
          vacio={editar ? "No hay ofertas. Publica la primera abajo." : "No hay ofertas."}
          filas={ofertas.map((o) => ({
            id: o.id,
            celdas: [
              <span key="t" className="font-medium">
                {o.titulo}
              </span>,
              centros.get(o.centroId)?.nombre ?? "—",
              o.puesto?.nombre ?? "—",
              o.plazas,
              o.candidatos.length,
              <Etiqueta key="e" tono={o.estado === "ABIERTA" ? "info" : o.estado === "CUBIERTA" ? "ok" : "normal"}>
                {o.estado === "ABIERTA" ? "Abierta" : o.estado === "CUBIERTA" ? "Cubierta" : "Cerrada"}
              </Etiqueta>,
            ],
            detalle: (
              <>
                <DatosDetalle
                  datos={[
                    { etiqueta: "Publicada", valor: fecha(o.publicadaEn) },
                    { etiqueta: "Contrato", valor: o.tipoContrato ? NOMBRE_CONTRATO[o.tipoContrato] : "—" },
                    { etiqueta: "Jornada", valor: o.jornada ? `${numero(o.jornada)} h/sem` : "—" },
                    { etiqueta: "Descripción", valor: o.descripcion },
                  ]}
                />
                <div className="mt-4">{tablaCandidatos(o.candidatos, o.centroId, o.puestoId)}</div>
                {editar && (
                  <Acciones>
                    {o.estado === "ABIERTA" && (
                      <form action={a.crearCandidatoAccion} className="flex flex-wrap items-end gap-2">
                        <Volver a={volver} />
                        <input type="hidden" name="ofertaId" value={o.id} />
                        <Campo etiqueta="Nombre">
                          <Entrada name="nombre" required />
                        </Campo>
                        <Campo etiqueta="Apellidos">
                          <Entrada name="apellidos" />
                        </Campo>
                        <Campo etiqueta="Teléfono">
                          <Entrada name="telefono" type="tel" />
                        </Campo>
                        <Campo etiqueta="Correo">
                          <Entrada name="email" type="email" />
                        </Campo>
                        <Campo etiqueta="Origen">
                          <Entrada name="origen" placeholder="Web, InfoJobs…" />
                        </Campo>
                        <label className="flex items-center gap-2 pb-2 text-sm">
                          <input type="checkbox" name="consentimiento" className="h-4 w-4 accent-acento" /> Acepta guardar sus datos un año
                        </label>
                        <Boton type="submit">Añadir candidato</Boton>
                      </form>
                    )}
                    <form action={a.estadoOfertaAccion} className="flex items-end gap-2">
                      <Volver a={volver} />
                      <input type="hidden" name="ofertaId" value={o.id} />
                      {o.estado === "ABIERTA" ? (
                        <>
                          <Boton type="submit" name="estado" value="CUBIERTA" variante="secundario">
                            Marcar cubierta
                          </Boton>
                          <Boton type="submit" name="estado" value="CERRADA" variante="secundario">
                            Cerrar
                          </Boton>
                        </>
                      ) : (
                        <Boton type="submit" name="estado" value="ABIERTA" variante="secundario">
                          Reabrir
                        </Boton>
                      )}
                    </form>
                  </Acciones>
                )}
              </>
            ),
          }))}
        />
      </div>

      <Tarjeta titulo="Bolsa de candidatos (sin oferta concreta)" className="mt-6">
        {tablaCandidatos(bolsa)}
        {editar && (
          <form action={a.crearCandidatoAccion} className="mt-4 flex flex-wrap items-end gap-2">
            <Volver a={volver} />
            <Campo etiqueta="Nombre">
              <Entrada name="nombre" required />
            </Campo>
            <Campo etiqueta="Apellidos">
              <Entrada name="apellidos" />
            </Campo>
            <Campo etiqueta="Teléfono">
              <Entrada name="telefono" type="tel" />
            </Campo>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" />
            </Campo>
            <Campo etiqueta="Notas">
              <Entrada name="notas" placeholder="Puesto que busca, disponibilidad…" />
            </Campo>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="consentimiento" className="h-4 w-4 accent-acento" /> Acepta guardar sus datos un año
            </label>
            <Boton type="submit">Añadir a la bolsa</Boton>
          </form>
        )}
        <p className="mt-2 text-xs text-slate-500">Protección de datos: con consentimiento se guardan un año; sin él, 90 días. Pasada la fecha se deberán borrar (tarea automática pendiente).</p>
      </Tarjeta>

      {editar && (
        <Tarjeta titulo="Publicar oferta de empleo" className="mt-6">
          <form action={a.crearOfertaAccion} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Volver a={volver} />
            <Campo etiqueta="Título">
              <Entrada name="titulo" required placeholder="Camarero/a de sala" />
            </Campo>
            <Campo etiqueta="Centro">
              <Selector name="centroId" required defaultValue={ctx.centroActivo?.id ?? ""}>
                <option value="">Elige…</option>
                {ctx.centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Puesto">
              <Selector name="puestoId" defaultValue="">
                <option value="">Sin puesto</option>
                {puestos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Tipo de contrato">
              <Selector name="tipoContrato" defaultValue="">
                <option value="">Sin indicar</option>
                {TIPOS_CONTRATO.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_CONTRATO[t]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Jornada (h/sem)">
              <Entrada name="jornada" inputMode="decimal" />
            </Campo>
            <Campo etiqueta="Plazas">
              <Entrada name="plazas" type="number" min={1} defaultValue={1} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo etiqueta="Descripción">
                <AreaTexto name="descripcion" rows={2} />
              </Campo>
            </div>
            <div className="flex items-end">
              <Boton type="submit">Publicar oferta</Boton>
            </div>
          </form>
          <p className="mt-2 text-xs text-slate-500">La oferta se publicará en «Trabaja con nosotros» de la web cuando esté el módulo Webs.</p>
        </Tarjeta>
      )}
    </>
  );
}
