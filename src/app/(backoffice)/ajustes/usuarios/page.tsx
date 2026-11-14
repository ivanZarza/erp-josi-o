import { exigir } from "@/kernel/contexto";
import { ROLES } from "@/kernel/permisos";
import { fechaHora } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Entrada, Etiqueta, Rejilla, Selector, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarCentros } from "@/modulos/organizacion/servicio";
import { AvisosPagina, Casilla, param, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { actualizarUsuarioAccion, cambiarActivoUsuarioAccion, restablecerContrasenaAccion } from "@/modulos/usuarios/acciones";
import { listarUsuarios } from "@/modulos/usuarios/servicio";

export default async function UsuariosPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:ver");
  const sp = await searchParams;
  const verInactivos = param(sp, "inactivos") === "1";
  const [usuarios, centros] = await Promise.all([listarUsuarios(ctx, verInactivos ? undefined : { activos: true }), listarCentros(ctx)]);
  const editar = ctx.puede("ajustes:usuarios:editar");
  const nombreRol = (r: string) => ROLES[r as keyof typeof ROLES] ?? r;

  return (
    <>
      <Cabecera
        titulo="Usuarios"
        subtitulo="Cada persona con su propio usuario, su rol y los centros que ve. Desactivar corta su acceso al momento."
        acciones={
          <>
            <BotonEnlace href={verInactivos ? "/ajustes/usuarios" : "/ajustes/usuarios?inactivos=1"} variante="secundario">
              {verInactivos ? "Solo activos" : "Ver también desactivados"}
            </BotonEnlace>
            {editar && <BotonEnlace href="/ajustes/usuarios/nuevo">Nuevo usuario</BotonEnlace>}
          </>
        }
      />
      <AvisosPagina sp={sp} />
      <TablaDesplegable
        columnas={[{ titulo: "Nombre" }, { titulo: "Correo", secundaria: true }, { titulo: "Rol" }, { titulo: "Centros" }, { titulo: "Permisos", secundaria: true }, { titulo: "Estado" }]}
        vacio="No hay usuarios. Crea el primero con «Nuevo usuario»."
        total={`${usuarios.length} usuarios`}
        filas={usuarios.map((u) => {
          const todos = u.todosCentros || u.rol === "admin";
          const propios = Array.isArray(u.permisos) && (u.permisos as unknown[]).length > 0;
          return {
            id: u.id,
            celdas: [
              <span key="n" className="font-medium">{u.nombre}</span>,
              u.email,
              nombreRol(u.rol),
              todos ? "Todos" : u.centros.map((c) => c.centro.codigo).join(", ") || "Ninguno",
              u.rol === "admin" ? "Todos" : propios ? <Etiqueta key="p" tono="info">A medida</Etiqueta> : "Los del rol",
              u.activo ? <Etiqueta key="e" tono="ok">Activo</Etiqueta> : <Etiqueta key="e" tono="error">Desactivado</Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Correo", valor: u.email },
                    { etiqueta: "Último acceso", valor: fechaHora(u.ultimoAcceso) },
                    { etiqueta: "Alta", valor: fechaHora(u.createdAt) },
                    { etiqueta: "Centros", valor: todos ? "Todos los centros" : u.centros.map((c) => c.centro.nombre).join(", ") || "Ninguno" },
                  ]}
                />
                {editar && (
                  <>
                    <form action={actualizarUsuarioAccion} className="space-y-3 border-t border-slate-100 pt-3">
                      <input type="hidden" name="usuarioId" value={u.id} />
                      <Rejilla columnas={3}>
                        <Campo etiqueta="Nombre">
                          <Entrada name="nombre" required defaultValue={u.nombre} />
                        </Campo>
                        <Campo etiqueta="Correo">
                          <Entrada name="email" type="email" required defaultValue={u.email} />
                        </Campo>
                        <Campo etiqueta="Rol">
                          <Selector name="rol" defaultValue={u.rol}>
                            {Object.entries(ROLES).map(([id, nombre]) => (
                              <option key={id} value={id}>
                                {nombre}
                              </option>
                            ))}
                          </Selector>
                        </Campo>
                      </Rejilla>
                      <Casilla nombre="todosCentros" marcada={u.todosCentros}>
                        Todos los centros (también los que se abran después)
                      </Casilla>
                      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
                        {centros.map((c) => (
                          <Casilla key={c.id} nombre="centros" valor={c.id} marcada={u.centros.some((x) => x.centro.id === c.id)}>
                            {c.nombre} <span className="text-xs text-suave">({c.codigo})</span>
                          </Casilla>
                        ))}
                      </div>
                      <Boton type="submit">Guardar usuario</Boton>
                    </form>
                    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                      {u.rol !== "admin" && <BotonEnlace href={`/ajustes/usuarios/${u.id}/permisos`}>Permisos</BotonEnlace>}
                      <form action={cambiarActivoUsuarioAccion}>
                        <input type="hidden" name="usuarioId" value={u.id} />
                        {!u.activo && <input type="hidden" name="activo" value="on" />}
                        <Boton type="submit" variante={u.activo ? "peligro" : "secundario"}>
                          {u.activo ? "Desactivar" : "Activar"}
                        </Boton>
                      </form>
                      <form action={restablecerContrasenaAccion} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="usuarioId" value={u.id} />
                        <Campo etiqueta="Nueva contraseña temporal" ayuda="Mínimo 10, con letras y números. Dásela en persona.">
                          <Entrada name="contrasena" type="password" autoComplete="new-password" minLength={10} />
                        </Campo>
                        <Boton type="submit" variante="secundario">
                          Cambiar contraseña
                        </Boton>
                      </form>
                    </div>
                  </>
                )}
              </div>
            ),
          };
        })}
      />
      {!editar && (
        <div className="mt-4">
          <Tarjeta>
            <p className="text-sm text-suave">Solo lectura: para crear o cambiar usuarios hace falta el permiso «Crear y editar usuarios».</p>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
