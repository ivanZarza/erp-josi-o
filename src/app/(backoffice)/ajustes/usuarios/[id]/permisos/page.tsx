import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { leerPermisosGuardados, ROLES, tienePermiso } from "@/kernel/permisos";
import { Aviso, Boton, BotonEnlace, Cabecera, Etiqueta, Tarjeta } from "@/ui";
import { AvisosPagina, Casilla, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { guardarPermisosAccion } from "@/modulos/usuarios/acciones";
import { catalogoPermisos, motivoNoPuedeGestionar, obtenerUsuario, permisosEfectivos } from "@/modulos/usuarios/servicio";

/** Página de permisos con casillas, generada desde MODULOS (solo módulos contratados). */
export default async function PermisosUsuarioPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosPagina }) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  const { id } = await params;
  const sp = await searchParams;
  const u = await obtenerUsuario(ctx, id).catch(() => null);
  if (!u) notFound();
  // lista (aunque esté vacía) = a medida; null = los de su rol
  const guardados = leerPermisosGuardados(u.permisos);
  const bloqueo = motivoNoPuedeGestionar(ctx, u);
  const marcadas = permisosEfectivos(ctx, u.rol, guardados);
  const catalogo = catalogoPermisos(ctx);
  const rol = ROLES[u.rol as keyof typeof ROLES] ?? u.rol;

  return (
    <>
      <Cabecera
        titulo={`Permisos de ${u.nombre}`}
        subtitulo={`Rol: ${rol}. ${guardados ? (guardados.length ? "Tiene permisos a medida (mandan sobre los del rol)." : "Tiene permisos a medida: ninguno.") : "Usa los permisos de su rol."}`}
        acciones={
          <BotonEnlace href="/ajustes/usuarios" variante="secundario">
            Volver a usuarios
          </BotonEnlace>
        }
      />
      <AvisosPagina sp={sp} />
      {u.rol === "admin" ? (
        <Aviso>El administrador de la cadena lo puede todo; sus permisos no se cambian aquí.</Aviso>
      ) : bloqueo ? (
        <Aviso tono="aviso">{bloqueo}.</Aviso>
      ) : (
        <form action={guardarPermisosAccion} className="space-y-4">
          <input type="hidden" name="usuarioId" value={u.id} />
          <Aviso>
            Al guardar, las casillas marcadas pasan a ser los permisos de esta persona y dejan de seguir a su rol. Si las desmarcas todas, se queda sin ningún permiso (para volver a
            los de su rol, usa «Volver a los permisos del rol»). Solo puedes marcar permisos que tú tienes. Solo salen los módulos contratados; los permisos guardados de módulos
            desactivados se conservan. Los centros que ve se eligen en la ficha del usuario.
          </Aviso>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {catalogo.map((m) => (
              <Tarjeta key={m.id} titulo={m.nombre}>
                <div className="space-y-0.5">
                  {m.permisos.map((p) => (
                    <Casilla key={p.clave} nombre="permisos" valor={p.clave} marcada={marcadas[p.clave]} deshabilitada={!ctx.puede(p.clave)}>
                      {p.descripcion}
                      <span className="ml-2 text-xs text-suave">{p.clave}</span>
                      {tienePermiso(u.rol, null, p.clave) && (
                        <span className="ml-2">
                          <Etiqueta>del rol</Etiqueta>
                        </span>
                      )}
                    </Casilla>
                  ))}
                </div>
              </Tarjeta>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" name="modo" value="casillas">
              Guardar permisos
            </Boton>
            {guardados && (
              <Boton type="submit" name="modo" value="rol" variante="secundario">
                Volver a los permisos del rol
              </Boton>
            )}
          </div>
        </form>
      )}
    </>
  );
}
