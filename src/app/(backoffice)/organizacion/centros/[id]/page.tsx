import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { moduloPorId } from "@/kernel/registro";
import { fecha, fechaHora } from "@/kernel/formato";
import { Aviso, AreaTexto, Boton, BotonEnlace, Cabecera, Campo, Etiqueta, Pestanas, Selector, Tarjeta, Vacio } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import {
  areasActivas,
  areasPosibles,
  datosExtra,
  estadosSiguientes,
  listarEdificios,
  listarMarcas,
  listarSociedades,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  obtenerCentro,
} from "@/modulos/organizacion/servicio";
import { cambiarEstadoAccion, guardarAreasAccion, guardarDatosCentroAccion, guardarHorarioAccion } from "@/modulos/organizacion/acciones";
import { AvisosPagina, CamposCentro, CamposHorario, Casilla, EtiquetaEstado, param, textoHorario, textoServicios, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { listarAuditoria } from "@/modulos/usuarios/servicio";

export default async function FichaCentro({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:ver");
  const { id } = await params;
  const sp = await searchParams;
  const centro = await obtenerCentro(ctx, id).catch(() => null);
  if (!centro) notFound();
  const pestana = param(sp, "pestana") ?? "datos";
  const base = `/organizacion/centros/${id}`;
  const extra = datosExtra(centro.datos);
  const editar = ctx.puede("organizacion:centros:editar");

  const pestanas = [
    { href: base, titulo: "Datos" },
    { href: `${base}?pestana=horario`, titulo: "Horario y espacios" },
    { href: `${base}?pestana=areas`, titulo: "Áreas activas" },
    { href: `${base}?pestana=estado`, titulo: "Estado" },
    ...(ctx.puede("ajustes:registro:ver") ? [{ href: `${base}?pestana=historial`, titulo: "Historial" }] : []),
  ];
  const activa = pestana === "datos" ? base : `${base}?pestana=${pestana}`;

  return (
    <>
      <Cabecera
        titulo={`${centro.nombre} (${centro.codigo})`}
        subtitulo={`${NOMBRE_TIPO[centro.tipo]}${centro.marca ? ` de ${centro.marca.nombre}` : ""}${centro.sociedad ? ` · ${centro.sociedad.razonSocial}` : ""}`}
        acciones={
          <>
            <EtiquetaEstado estado={centro.estado} />
            {centro.estado === "PREPARACION" && ctx.puede("organizacion:centros:abrir") && <BotonEnlace href={`/organizacion/nuevo-local/${id}`}>Seguir con el asistente</BotonEnlace>}
            <BotonEnlace href="/organizacion" variante="secundario">
              Volver a centros
            </BotonEnlace>
          </>
        }
      />
      <AvisosPagina sp={sp} />
      <Pestanas items={pestanas} activa={activa} />

      {pestana === "datos" && (
        <Tarjeta titulo="Datos del centro">
          {editar ? (
            <form action={guardarDatosCentroAccion} className="space-y-4">
              <input type="hidden" name="centroId" value={id} />
              <input type="hidden" name="volver" value={base} />
              <DatosEdicion ctxTenant={ctx} centro={centro} />
              <Boton type="submit">Guardar datos</Boton>
            </form>
          ) : (
            <DatosDetalle
              datos={[
                { etiqueta: "Código", valor: centro.codigo },
                { etiqueta: "Tipo", valor: NOMBRE_TIPO[centro.tipo] },
                { etiqueta: "Marca", valor: centro.marca?.nombre ?? "—" },
                { etiqueta: "Sociedad", valor: centro.sociedad?.razonSocial ?? "—" },
                { etiqueta: "Dirección", valor: centro.edificio ? `${centro.edificio.direccion}, ${centro.edificio.ciudad}` : "—" },
                { etiqueta: "Teléfono", valor: centro.telefono ?? "—" },
                { etiqueta: "Correo", valor: centro.email ?? "—" },
                { etiqueta: "Apertura", valor: fecha(centro.aperturaEn) },
              ]}
            />
          )}
        </Tarjeta>
      )}

      {pestana === "horario" && (
        <Tarjeta titulo="Horario, espacios y servicios">
          {editar ? (
            <form action={guardarHorarioAccion} className="space-y-4">
              <input type="hidden" name="centroId" value={id} />
              <input type="hidden" name="volver" value={`${base}?pestana=horario`} />
              <CamposHorario extra={extra} horaCorte={centro.horaCorte} />
              <Boton type="submit">Guardar horario</Boton>
            </form>
          ) : (
            <DatosDetalle
              columnas={3}
              datos={[
                { etiqueta: "Horario", valor: textoHorario(extra.horario) },
                { etiqueta: "Espacios", valor: extra.espacios?.length ? extra.espacios.map((e) => `${e.nombre} (${e.sentados} sentados, ${e.dePie} de pie)`).join(" · ") : "—" },
                { etiqueta: "Servicios", valor: textoServicios(extra.servicios) },
              ]}
            />
          )}
        </Tarjeta>
      )}

      {pestana === "areas" && <AreasCentro ctxContratados={ctx.contratados} centro={centro} editable={editar && (ctx.puede("ajustes:modulos:editar") || ctx.puede("organizacion:centros:abrir"))} volver={`${base}?pestana=areas`} />}

      {pestana === "estado" && <EstadoCentroBloque centro={centro} puedeAbrir={ctx.puede("organizacion:centros:abrir")} puedeCerrar={ctx.puede("organizacion:centros:cerrar")} volver={`${base}?pestana=estado`} />}

      {pestana === "historial" && ctx.puede("ajustes:registro:ver") && <HistorialCentro ctx={ctx} id={id} />}
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof exigir>>;
type CentroFicha = Awaited<ReturnType<typeof obtenerCentro>>;

async function DatosEdicion({ ctxTenant, centro }: { ctxTenant: Ctx; centro: CentroFicha }) {
  const [marcas, sociedades, edificios] = await Promise.all([listarMarcas(ctxTenant), listarSociedades(ctxTenant), listarEdificios(ctxTenant)]);
  return (
    <CamposCentro
      v={centro}
      marcas={marcas.filter((m) => m.activo || m.id === centro.marcaId).map((m) => ({ id: m.id, nombre: m.nombre }))}
      sociedades={sociedades.filter((s) => s.activo || s.id === centro.sociedadId).map((s) => ({ id: s.id, nombre: `${s.razonSocial} (${s.cif})` }))}
      edificios={edificios.filter((e) => e.id !== centro.edificioId).map((e) => ({ id: e.id, nombre: `${e.direccion}, ${e.ciudad}${e.centros.length ? ` (${e.centros.map((c) => c.codigo).join(", ")})` : ""}` }))}
    />
  );
}

function AreasCentro({ ctxContratados, centro, editable, volver }: { ctxContratados: string[]; centro: CentroFicha; editable: boolean; volver: string }) {
  const posibles = areasPosibles(ctxContratados, centro.tipo);
  const activas = areasActivas(centro, ctxContratados);
  if (!posibles.length) return <Vacio>La cadena no tiene contratada ninguna área que se use en un {NOMBRE_TIPO[centro.tipo].toLowerCase()}.</Vacio>;
  return (
    <Tarjeta titulo="Áreas activas en este centro">
      <p className="mb-3 text-sm text-suave">
        Solo aparecen las áreas contratadas por la cadena que tienen sentido en un {NOMBRE_TIPO[centro.tipo].toLowerCase()}. Desactivar un área en el centro no borra sus datos.
        {centro.modulos.length === 0 && " Ahora mismo el centro usa todas las contratadas (no tiene áreas propias guardadas)."}
      </p>
      <form action={guardarAreasAccion} className="space-y-4">
        <input type="hidden" name="centroId" value={centro.id} />
        <input type="hidden" name="volver" value={volver} />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
          {posibles.map((a) => {
            const m = moduloPorId(a);
            return (
              <Casilla key={a} nombre="areas" valor={a} marcada={activas.includes(a)} deshabilitada={!editable}>
                <span className="font-medium">{m?.nombre ?? a}</span>
                {m?.requiere?.length ? <span className="block text-xs text-suave">Necesita {m.requiere.map((r) => moduloPorId(r)?.nombre ?? r).join(", ")}</span> : null}
              </Casilla>
            );
          })}
        </div>
        {editable && <Boton type="submit">Guardar áreas</Boton>}
      </form>
    </Tarjeta>
  );
}

function EstadoCentroBloque({ centro, puedeAbrir, puedeCerrar, volver }: { centro: CentroFicha; puedeAbrir: boolean; puedeCerrar: boolean; volver: string }) {
  const siguientes = estadosSiguientes(centro.estado).filter((e) => (centro.estado === "PREPARACION" && e === "ABIERTO" ? puedeAbrir : puedeCerrar));
  return (
    <Tarjeta titulo="Estado del centro">
      <div className="mb-4 flex items-center gap-2 text-sm">
        Estado actual: <EtiquetaEstado estado={centro.estado} />
      </div>
      <Aviso>
        Cerrar un centro <strong>no borra nada</strong>: su historial, stock, pedidos y documentos se conservan. Un centro cerrado deja de salir en el selector de centros y en los pedidos; se puede reabrir.
      </Aviso>
      {centro.estado === "PREPARACION" && (
        <p className="mt-3 text-sm text-suave">Para abrirlo, termina el asistente de apertura: el último paso revisa lo que falta y tiene el botón «Abrir local».</p>
      )}
      {siguientes.length > 0 ? (
        <form action={cambiarEstadoAccion} className="mt-4 space-y-3">
          <input type="hidden" name="centroId" value={centro.id} />
          <input type="hidden" name="desde" value={centro.estado} />
          <input type="hidden" name="volver" value={volver} />
          <Campo etiqueta="Nuevo estado">
            <Selector name="estado" defaultValue={siguientes[0]}>
              {siguientes.map((e) => (
                <option key={e} value={e}>
                  {NOMBRE_ESTADO[e]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Motivo" ayuda="Queda en el historial">
            <AreaTexto name="motivo" rows={2} />
          </Campo>
          {siguientes.includes("CERRADO") && (
            <Casilla nombre="confirmar">Si elijo «Cerrado» (definitivo), confirmo que el local deja de operar. No se borra nada.</Casilla>
          )}
          <Boton type="submit" variante="secundario">
            Cambiar estado
          </Boton>
        </form>
      ) : (
        <p className="mt-3 text-sm text-suave">No tienes permiso para cambiar el estado de este centro.</p>
      )}
    </Tarjeta>
  );
}

async function HistorialCentro({ ctx, id }: { ctx: Ctx; id: string }) {
  const { filas } = await listarAuditoria(ctx, { entidad: "Centro", entidadId: id, limite: 100 });
  return (
    <TablaDesplegable
      columnas={[{ titulo: "Fecha" }, { titulo: "Acción" }, { titulo: "Quién" }]}
      vacio="Sin cambios registrados todavía."
      filas={filas.map((f) => ({
        id: f.id,
        celdas: [fechaHora(f.createdAt), <Etiqueta key="a">{f.accion}</Etiqueta>, f.usuario ?? "—"],
        detalle: (
          <DatosDetalle
            columnas={2}
            datos={[
              { etiqueta: "Antes", valor: <pre className="whitespace-pre-wrap break-all text-xs">{f.antes ? JSON.stringify(f.antes, null, 2) : "—"}</pre> },
              { etiqueta: "Después", valor: <pre className="whitespace-pre-wrap break-all text-xs">{f.despues ? JSON.stringify(f.despues, null, 2) : "—"}</pre> },
            ]}
          />
        ),
      }))}
    />
  );
}
