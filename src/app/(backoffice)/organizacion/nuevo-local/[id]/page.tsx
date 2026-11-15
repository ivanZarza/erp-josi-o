import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { moduloPorId } from "@/kernel/registro";
import { ROLES } from "@/kernel/permisos";
import { Aviso, Boton, BotonEnlace, Cabecera, Campo, Etiqueta, HuecoIntegracion, Selector, Tarjeta, Vacio, cx } from "@/ui";
import { copiarProductosAccion, cambiarEstadoAccion, guardarAreasAccion, guardarDatosCentroAccion, guardarHorarioAccion, guardarUsuariosCentroAccion } from "@/modulos/organizacion/acciones";
import { pasosVisibles } from "@/modulos/organizacion/asistente";
import {
  areasActivas,
  areasPosibles,
  datosExtra,
  listarCentros,
  listarEdificios,
  listarMarcas,
  listarSociedades,
  NOMBRE_TIPO,
  obtenerCentro,
  opcionesEdificio,
  revisionApertura,
} from "@/modulos/organizacion/servicio";
import { AvisosPagina, CamposCentro, CamposHorario, Casilla, EtiquetaEstado, param, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { elegibleParaCentro, listarIntegraciones, listarUsuarios, motivoNoPuedeGestionar } from "@/modulos/usuarios/servicio";

type Ctx = Awaited<ReturnType<typeof exigir>>;
type CentroFicha = Awaited<ReturnType<typeof obtenerCentro>>;

export default async function AsistentePagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:centros:abrir");
  const { id } = await params;
  const sp = await searchParams;
  const centro = await obtenerCentro(ctx, id).catch(() => null);
  if (!centro) notFound();

  const pasos = pasosVisibles(ctx.contratados);
  const actual = pasos.find((p) => p.id === param(sp, "paso")) ?? pasos[0];
  const i = pasos.indexOf(actual);
  const anterior = pasos[i - 1];
  const siguiente = pasos[i + 1];
  const ruta = (paso: string) => `/organizacion/nuevo-local/${id}?paso=${paso}`;
  const volver = ruta(actual.id);

  return (
    <>
      <Cabecera
        titulo={`Abrir ${centro.nombre}`}
        subtitulo={`${NOMBRE_TIPO[centro.tipo]}${centro.marca ? ` de ${centro.marca.nombre}` : ""} · código ${centro.codigo}`}
        acciones={
          <>
            <EtiquetaEstado estado={centro.estado} />
            <BotonEnlace href={`/organizacion/centros/${id}`} variante="secundario">
              Ver ficha
            </BotonEnlace>
          </>
        }
      />
      <AvisosPagina sp={sp} />
      {centro.estado !== "PREPARACION" && (
        <div className="mb-4">
          <Aviso tono="ok">Este local ya no está en preparación. Puedes seguir ajustando sus datos aquí o en su ficha.</Aviso>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <nav className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <ol className="space-y-0.5">
            {pasos.map((p) => (
              <li key={p.id}>
                <Link
                  href={ruta(p.id)}
                  className={cx("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm", p.id === actual.id ? "bg-acento-claro font-medium text-acento" : "text-slate-700 hover:bg-slate-50")}
                >
                  <span>
                    {p.orden}. {p.titulo}
                  </span>
                  {!p.hecho && <span className="text-xs text-suave">pendiente</span>}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-4">
          <Tarjeta titulo={`Paso ${actual.orden} de ${pasos.length} · ${actual.titulo}`}>
            <p className="mb-4 text-sm text-suave">{actual.descripcion}.</p>
            {actual.id === "datos" && <PasoDatos ctx={ctx} centro={centro} volver={volver} />}
            {actual.id === "horario" &&
              (ctx.puede("organizacion:centros:editar") ? (
                <form action={guardarHorarioAccion} className="space-y-4">
                  <input type="hidden" name="centroId" value={id} />
                  <input type="hidden" name="volver" value={siguiente ? ruta(siguiente.id) : volver} />
                  <CamposHorario extra={datosExtra(centro.datos)} horaCorte={centro.horaCorte} />
                  <Boton type="submit">Guardar y seguir</Boton>
                </form>
              ) : (
                <Aviso>Para guardar el horario necesitas el permiso «Editar centros (datos, horario, áreas)». Pídeselo a un administrador o sigue con el siguiente paso.</Aviso>
              ))}
            {actual.id === "areas" && <PasoAreas ctx={ctx} centro={centro} volver={siguiente ? ruta(siguiente.id) : volver} />}
            {actual.id === "productos" && <PasoProductos ctx={ctx} centro={centro} volver={volver} />}
            {actual.id === "usuarios" && <PasoUsuarios ctx={ctx} centro={centro} volver={volver} />}
            {actual.id === "conexiones" && <PasoConexiones ctx={ctx} centro={centro} />}
            {actual.id === "revision" && <PasoRevision ctx={ctx} centro={centro} />}
            {!actual.hecho && (
              <Aviso tono="aviso" titulo="Paso pendiente de construir">
                Lo aportará {(actual.modulos ?? []).filter((m) => ctx.tieneModulo(m)).map((m) => moduloPorId(m)?.nombre ?? m).join(" / ")} cuando esa parte esté hecha. Mientras tanto se
                configura después, desde el propio módulo. Puedes seguir con el siguiente paso.
              </Aviso>
            )}
          </Tarjeta>

          <div className="flex justify-between gap-2">
            {anterior ? (
              <BotonEnlace href={ruta(anterior.id)} variante="secundario">
                Anterior: {anterior.titulo}
              </BotonEnlace>
            ) : (
              <span />
            )}
            {siguiente && (
              <BotonEnlace href={ruta(siguiente.id)} variante="secundario">
                Siguiente: {siguiente.titulo}
              </BotonEnlace>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

async function PasoDatos({ ctx, centro, volver }: { ctx: Ctx; centro: CentroFicha; volver: string }) {
  if (!ctx.puede("organizacion:centros:editar")) return <Aviso>No tienes permiso para editar los datos del centro.</Aviso>;
  const [marcas, sociedades, edificios] = await Promise.all([listarMarcas(ctx), listarSociedades(ctx), listarEdificios(ctx)]);
  const edificio = opcionesEdificio(edificios, centro);
  return (
    <form action={guardarDatosCentroAccion} className="space-y-4">
      <input type="hidden" name="centroId" value={centro.id} />
      <input type="hidden" name="volver" value={volver} />
      <CamposCentro
        v={centro}
        marcas={marcas.filter((m) => m.activo || m.id === centro.marcaId).map((m) => ({ id: m.id, nombre: m.nombre }))}
        sociedades={sociedades.filter((s) => s.activo || s.id === centro.sociedadId).map((s) => ({ id: s.id, nombre: `${s.razonSocial} (${s.cif})` }))}
        edificios={edificio.opciones}
        edificioSeleccionado={edificio.seleccionado}
      />
      <Boton type="submit">Guardar datos</Boton>
    </form>
  );
}

function PasoAreas({ ctx, centro, volver }: { ctx: Ctx; centro: CentroFicha; volver: string }) {
  const posibles = areasPosibles(ctx.contratados, centro.tipo);
  const activas = areasActivas(centro, ctx.contratados);
  if (!posibles.length) return <Vacio>No hay áreas contratadas que se usen en este tipo de centro.</Vacio>;
  // mismo requisito que la acción guardarAreasAccion
  if (!ctx.puede("organizacion:centros:editar"))
    return <Aviso>Para cambiar las áreas necesitas el permiso «Editar centros (datos, horario, áreas)». Pídeselo a un administrador o sigue con el siguiente paso.</Aviso>;
  return (
    <form action={guardarAreasAccion} className="space-y-4">
      <input type="hidden" name="centroId" value={centro.id} />
      <input type="hidden" name="volver" value={volver} />
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {posibles.map((a) => (
          <Casilla key={a} nombre="areas" valor={a} marcada={activas.includes(a)}>
            {moduloPorId(a)?.nombre ?? a}
          </Casilla>
        ))}
      </div>
      <Boton type="submit">Guardar y seguir</Boton>
    </form>
  );
}

async function PasoProductos({ ctx, centro, volver }: { ctx: Ctx; centro: CentroFicha; volver: string }) {
  const centros = (await listarCentros(ctx)).filter((c) => c.id !== centro.id && c._count.ajustesProducto > 0);
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Este local tiene <strong>{centro._count.ajustesProducto}</strong> productos configurados (qué puede pedir, con mínimo y máximo). El stock no se copia: empieza en cero y solo cambia con
        movimientos.
      </p>
      {centros.length > 0 ? (
        <form action={copiarProductosAccion} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="centroId" value={centro.id} />
          <input type="hidden" name="volver" value={volver} />
          <Campo etiqueta="Copiar los ajustes de">
            <Selector name="origenId" defaultValue="">
              <option value="">Elige un local</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c._count.ajustesProducto} productos)
                </option>
              ))}
            </Selector>
          </Campo>
          <Boton type="submit" variante="secundario">
            Copiar
          </Boton>
        </form>
      ) : (
        <Vacio>Ningún otro centro tiene productos configurados todavía.</Vacio>
      )}
      <p className="text-xs text-suave">Los mínimos de cada producto se ajustan después en Bebidas o Comidas. Los almacenes del local (bodega, cámara, seco) se crearán allí.</p>
    </div>
  );
}

async function PasoUsuarios({ ctx, centro, volver }: { ctx: Ctx; centro: CentroFicha; volver: string }) {
  if (!ctx.puede("ajustes:usuarios:editar")) return <Aviso>Para dar acceso a usuarios necesitas el permiso «Crear y editar usuarios».</Aviso>;
  const usuarios = await listarUsuarios(ctx, { activos: true });
  const conTodos = usuarios.filter((u) => u.rol !== "empleado" && (u.todosCentros || u.rol === "admin"));
  // misma regla que guardarUsuariosDeCentro: desactivados y empleados no salen y no se tocan
  const elegibles = usuarios.filter(elegibleParaCentro);
  return (
    <div className="space-y-4">
      {conTodos.length > 0 && <p className="text-sm text-suave">Ya ven todos los centros: {conTodos.map((u) => u.nombre).join(", ")}.</p>}
      {elegibles.length > 0 ? (
        <form action={guardarUsuariosCentroAccion} className="space-y-3">
          <input type="hidden" name="centroId" value={centro.id} />
          <input type="hidden" name="volver" value={volver} />
          <p className="text-sm text-suave">Solo salen usuarios activos que no son empleados. Al guardar no se toca a nadie más (ni desactivados ni empleados).</p>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {elegibles.map((u) => {
              const bloqueo = motivoNoPuedeGestionar(ctx, u);
              return (
                <Casilla key={u.id} nombre="usuarios" valor={u.id} marcada={u.centros.some((c) => c.centro.id === centro.id)} deshabilitada={!!bloqueo}>
                  {u.nombre} <span className="text-xs text-suave">· {ROLES[u.rol as keyof typeof ROLES] ?? u.rol}</span>
                  {bloqueo && <span className="block text-xs text-suave">Tiene permisos que tú no tienes: no puedes cambiar su acceso.</span>}
                </Casilla>
              );
            })}
          </div>
          <Boton type="submit">Guardar acceso</Boton>
        </form>
      ) : (
        <Vacio>No hay usuarios con acceso por centros. Créalos en Ajustes › Usuarios.</Vacio>
      )}
      <BotonEnlace href="/ajustes/usuarios/nuevo" variante="secundario">
        Crear un usuario nuevo
      </BotonEnlace>
    </div>
  );
}

async function PasoConexiones({ ctx, centro }: { ctx: Ctx; centro: CentroFicha }) {
  const areas = areasActivas(centro, ctx.contratados);
  const huecos = (await listarIntegraciones(ctx)).filter((h) => areas.includes(h.modulo.id));
  if (!huecos.length) return <Vacio>Las áreas activas en este local no tienen conexiones externas.</Vacio>;
  return (
    <div className="space-y-3">
      {huecos.map((h) => (
        <HuecoIntegracion key={h.hueco.id} nombre={`${h.hueco.nombre} (${h.modulo.nombre})`} descripcion={h.hueco.descripcion} />
      ))}
    </div>
  );
}

async function PasoRevision({ ctx, centro }: { ctx: Ctx; centro: CentroFicha }) {
  const puntos = await revisionApertura(ctx, centro.id);
  const bloquean = puntos.filter((p) => p.grave && !p.ok);
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {puntos.map((p) => (
          <li key={p.texto} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>{p.texto}</span>
            <span className="flex items-center gap-2">
              {p.ok ? <Etiqueta tono="ok">Hecho</Etiqueta> : <Etiqueta tono={p.grave ? "error" : "aviso"}>{p.grave ? "Falta (obligatorio)" : "Falta"}</Etiqueta>}
              {!p.ok && (
                <Link className="text-xs text-acento underline" href={`/organizacion/nuevo-local/${centro.id}?paso=${p.paso}`}>
                  Arreglar
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
      {centro.estado === "PREPARACION" ? (
        <form action={cambiarEstadoAccion} className="space-y-2">
          <input type="hidden" name="centroId" value={centro.id} />
          <input type="hidden" name="desde" value="PREPARACION" />
          <input type="hidden" name="estado" value="ABIERTO" />
          <input type="hidden" name="volver" value={`/organizacion/nuevo-local/${centro.id}?paso=revision`} />
          <p className="text-sm text-suave">
            Al abrirlo: pasa a «abierto», aparece en el selector de centros, en los pedidos y (si Webs está contratado) en la web. Queda en el historial quién lo abrió y cuándo.
          </p>
          <Boton type="submit" disabled={bloquean.length > 0}>
            Abrir local
          </Boton>
          {bloquean.length > 0 && <p className="text-sm text-error">Antes de abrir completa lo marcado como obligatorio.</p>}
        </form>
      ) : (
        <Aviso tono="ok">El local ya está abierto.</Aviso>
      )}
    </div>
  );
}
