import { exigir } from "@/kernel/contexto";
import { ROLES } from "@/kernel/permisos";
import { Aviso, Boton, BotonEnlace, Cabecera, Campo, Entrada, Rejilla, Selector, Tarjeta } from "@/ui";
import { listarCentros } from "@/modulos/organizacion/servicio";
import { AvisosPagina, Casilla, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { crearUsuarioAccion } from "@/modulos/usuarios/acciones";

export default async function NuevoUsuarioPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("usuarios", "ajustes:usuarios:editar");
  const sp = await searchParams;
  const centros = await listarCentros(ctx);

  return (
    <>
      <Cabecera
        titulo="Nuevo usuario"
        subtitulo="Después de crearlo, revisa sus permisos."
        acciones={
          <BotonEnlace href="/ajustes/usuarios" variante="secundario">
            Volver a usuarios
          </BotonEnlace>
        }
      />
      <AvisosPagina sp={sp} />
      <form action={crearUsuarioAccion} className="space-y-4">
        <Tarjeta titulo="Datos y rol">
          <Rejilla columnas={3}>
            <Campo etiqueta="Nombre y apellidos">
              <Entrada name="nombre" required />
            </Campo>
            <Campo etiqueta="Correo" ayuda="Con él entra en el ERP">
              <Entrada name="email" type="email" required autoComplete="off" />
            </Campo>
            <Campo etiqueta="Rol" ayuda="Da los permisos de partida; se pueden cambiar después">
              <Selector name="rol" defaultValue="gerente">
                {Object.entries(ROLES).map(([id, nombre]) => (
                  <option key={id} value={id}>
                    {nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          </Rejilla>
        </Tarjeta>
        <Tarjeta titulo="Centros que ve">
          <Casilla nombre="todosCentros">Todos los centros (también los que se abran después)</Casilla>
          <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
            {centros.map((c) => (
              <Casilla key={c.id} nombre="centros" valor={c.id}>
                {c.nombre} <span className="text-xs text-suave">({c.codigo})</span>
              </Casilla>
            ))}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Contraseña temporal">
          <div className="space-y-3">
            <Aviso tono="aviso">
              Dásela a la persona en mano o por teléfono, nunca en un documento ni por escrito en un grupo. La invitación por correo con enlace de un solo uso está pendiente.
            </Aviso>
            <Rejilla columnas={2}>
              <Campo etiqueta="Contraseña temporal" ayuda="Mínimo 10 caracteres, con letras y números">
                <Entrada name="contrasena" type="password" required minLength={10} autoComplete="new-password" />
              </Campo>
              <Campo etiqueta="Repítela">
                <Entrada name="contrasena2" type="password" required minLength={10} autoComplete="new-password" />
              </Campo>
            </Rejilla>
          </div>
        </Tarjeta>
        <Boton type="submit">Crear usuario</Boton>
      </form>
    </>
  );
}
