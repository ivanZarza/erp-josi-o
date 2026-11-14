import { exigir } from "@/kernel/contexto";
import { euros, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Boton, Campo, Entrada, Selector, Etiqueta } from "@/ui";
import { listarPuestos, listarConvenios } from "@/modulos/personal/servicio";
import { crearPuestoAccion, cambiarPuestoAccion, crearConvenioAccion, crearCategoriaAccion } from "@/modulos/personal/acciones";
import { DEPARTAMENTOS, NOMBRE_DEPARTAMENTO } from "@/modulos/personal/esquemas";
import { Mensajes, Volver, type Busqueda } from "../_componentes/comun";

export default async function AjustesPersonal({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:plantilla:editar");
  const sp = await searchParams;
  const volver = "/personal/ajustes";
  const [puestos, convenios] = await Promise.all([listarPuestos(ctx, false), listarConvenios(ctx)]);
  const verSalarios = ctx.puede("personal:salarios:ver");
  type FilaConvenio = { c: (typeof convenios)[number]; k: (typeof convenios)[number]["categorias"][number] | null };
  const filasConvenio: FilaConvenio[] = convenios.flatMap((c): FilaConvenio[] => (c.categorias.length ? c.categorias.map((k) => ({ c, k })) : [{ c, k: null }]));

  return (
    <>
      <Cabecera titulo="Puestos y convenios" subtitulo="Catálogos de la cadena para las fichas y los contratos" />
      <Mensajes sp={sp} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Puestos">
          <Tabla
            filas={puestos}
            clave={(p) => p.id}
            vacio="Sin puestos."
            columnas={[
              { titulo: "Puesto", celda: (p) => p.nombre },
              { titulo: "Departamento", celda: (p) => NOMBRE_DEPARTAMENTO[p.departamento] },
              { titulo: "Personas", celda: (p) => p._count.empleados, alinear: "derecha" },
              { titulo: "Estado", celda: (p) => (p.activo ? <Etiqueta tono="ok">Activo</Etiqueta> : <Etiqueta>Retirado</Etiqueta>) },
              {
                titulo: "",
                celda: (p) => (
                  <form action={cambiarPuestoAccion}>
                    <Volver a={volver} />
                    <input type="hidden" name="puestoId" value={p.id} />
                    <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                    <Boton type="submit" variante="secundario">{p.activo ? "Retirar" : "Reactivar"}</Boton>
                  </form>
                ),
              },
            ]}
          />
          <form action={crearPuestoAccion} className="mt-4 flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <Campo etiqueta="Nuevo puesto">
              <Entrada name="nombre" required />
            </Campo>
            <Campo etiqueta="Departamento">
              <Selector name="departamento">
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>{NOMBRE_DEPARTAMENTO[d]}</option>
                ))}
              </Selector>
            </Campo>
            <Boton type="submit">Crear</Boton>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Convenios y categorías">
          <Tabla
            filas={filasConvenio}
            clave={(x) => `${x.c.id}-${x.k?.id ?? "nada"}`}
            vacio="Sin convenios."
            columnas={[
              { titulo: "Convenio", celda: (x) => `${x.c.nombre}${x.c.comunidad ? ` (${x.c.comunidad})` : ""}` },
              { titulo: "Vacaciones", celda: (x) => `${x.c.diasVacaciones} días`, alinear: "derecha" },
              { titulo: "Descanso mín.", celda: (x) => `${numero(x.c.descansoMinimoHoras)} h`, alinear: "derecha" },
              { titulo: "Categoría", celda: (x) => (x.k ? `${x.k.nombre}${x.k.nivel ? ` · ${x.k.nivel}` : ""}` : "—") },
              ...(verSalarios ? [{ titulo: "Salario base", celda: (x: FilaConvenio) => (x.k?.salarioBaseAnual ? euros(x.k.salarioBaseAnual) : "—"), alinear: "derecha" as const }] : []),
            ]}
          />
          <form action={crearConvenioAccion} className="mt-4 flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <Campo etiqueta="Nuevo convenio">
              <Entrada name="nombre" required placeholder="Hostelería de Madrid" />
            </Campo>
            <Campo etiqueta="Comunidad">
              <Entrada name="comunidad" />
            </Campo>
            <Campo etiqueta="Días de vacaciones">
              <Entrada name="diasVacaciones" inputMode="numeric" placeholder="30" className="w-24" />
            </Campo>
            <Campo etiqueta="Descanso mínimo (h)">
              <Entrada name="descansoMinimoHoras" inputMode="decimal" placeholder="12" className="w-24" />
            </Campo>
            <Campo etiqueta="Horas al año">
              <Entrada name="horasAnuales" inputMode="numeric" className="w-24" />
            </Campo>
            <Boton type="submit">Crear</Boton>
          </form>
          {convenios.length > 0 && (
            <form action={crearCategoriaAccion} className="mt-4 flex flex-wrap items-end gap-3">
              <Volver a={volver} />
              <Campo etiqueta="Convenio">
                <Selector name="convenioId">
                  {convenios.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nueva categoría">
                <Entrada name="nombre" required />
              </Campo>
              <Campo etiqueta="Nivel">
                <Entrada name="nivel" className="w-24" />
              </Campo>
              {verSalarios && (
                <Campo etiqueta="Salario base anual (€)">
                  <Entrada name="salarioBaseAnual" inputMode="decimal" className="w-32" />
                </Campo>
              )}
              <Boton type="submit">Añadir</Boton>
            </form>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
