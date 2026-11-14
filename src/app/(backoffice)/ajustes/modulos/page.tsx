import { exigir } from "@/kernel/contexto";
import { moduloPorId } from "@/kernel/registro";
import { fecha } from "@/kernel/formato";
import { Aviso, Boton, Cabecera, Etiqueta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { areasActivas, listarCentros, NOMBRE_TIPO } from "@/modulos/organizacion/servicio";
import { AvisosPagina, Casilla, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { activarModuloAccion, desactivarModuloAccion, guardarCentrosModuloAccion } from "@/modulos/usuarios/acciones";
import { estadoModulos } from "@/modulos/usuarios/servicio";

export default async function ModulosPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("usuarios", "ajustes:modulos:ver");
  const sp = await searchParams;
  const [modulos, centros] = await Promise.all([estadoModulos(ctx), listarCentros(ctx)]);
  const editar = ctx.puede("ajustes:modulos:editar");
  const nombres = (ids: string[]) => ids.map((i) => moduloPorId(i)?.nombre ?? i).join(", ");
  const vivos = centros.filter((c) => c.estado !== "CERRADO");

  return (
    <>
      <Cabecera titulo="Módulos contratados" subtitulo="Áreas que usa la cadena y en qué centros. Desactivar nunca borra datos: al reactivar, todo vuelve a aparecer." />
      <AvisosPagina sp={sp} />
      <TablaDesplegable
        columnas={[{ titulo: "Módulo" }, { titulo: "Necesita", secundaria: true }, { titulo: "Dónde", secundaria: true }, { titulo: "Centros activos", alinear: "derecha" }, { titulo: "Estado" }]}
        total={`${modulos.filter((m) => m.contratado && !m.manifiesto.nucleo).length} áreas contratadas`}
        filas={modulos.map(({ manifiesto: m, contratado, fila, requiere, dependientes }) => {
          const aplicables = vivos.filter((c) => !m.tiposCentro || m.tiposCentro.length === 0 || m.tiposCentro.includes(c.tipo));
          const enCentros = aplicables.filter((c) => areasActivas(c, ctx.contratados).includes(m.id));
          const dependientesActivos = dependientes.filter((d) => ctx.tieneModulo(d));
          return {
            id: m.id,
            celdas: [
              <span key="n" className="font-medium">{m.nombre}</span>,
              requiere.length ? nombres(requiere) : "—",
              m.tiposCentro?.length ? m.tiposCentro.map((t) => NOMBRE_TIPO[t]).join(", ") : "Todos",
              m.nucleo ? "—" : contratado ? `${enCentros.length} de ${aplicables.length}` : "—",
              m.nucleo ? <Etiqueta key="e" tono="info">Núcleo, siempre</Etiqueta> : contratado ? <Etiqueta key="e" tono="ok">Contratado</Etiqueta> : <Etiqueta key="e">No contratado</Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Qué incluye", valor: m.descripcion },
                    { etiqueta: "Necesita", valor: requiere.length ? nombres(requiere) : "Nada" },
                    { etiqueta: "Dependen de él", valor: dependientes.length ? nombres(dependientes) : "Ninguno" },
                    { etiqueta: "Desde", valor: fila ? fecha(fila.desde) : "—" },
                  ]}
                />
                {m.nucleo ? (
                  <p className="text-sm text-suave">{m.visibleSi ? `Aparece si está contratado alguno de: ${nombres(m.visibleSi)}.` : "Forma parte del núcleo: no se puede desactivar."}</p>
                ) : (
                  editar && (
                    <>
                      {contratado ? (
                        <form action={desactivarModuloAccion} className="space-y-2">
                          <input type="hidden" name="modulo" value={m.id} />
                          {dependientesActivos.length > 0 && (
                            <>
                              <Aviso tono="aviso">Si lo desactivas, también se desactivará: {nombres(dependientesActivos)}. Sus datos se conservan.</Aviso>
                              <Casilla nombre="confirmar">Lo entiendo, desactivar también {nombres(dependientesActivos)}</Casilla>
                            </>
                          )}
                          <Boton type="submit" variante="peligro">
                            Desactivar {m.nombre}
                          </Boton>
                        </form>
                      ) : (
                        <form action={activarModuloAccion} className="space-y-2">
                          <input type="hidden" name="modulo" value={m.id} />
                          {requiere.some((r) => !ctx.tieneModulo(r)) && <Aviso tono="aviso">Antes hay que activar: {nombres(requiere.filter((r) => !ctx.tieneModulo(r)))}.</Aviso>}
                          <Boton type="submit" disabled={requiere.some((r) => !ctx.tieneModulo(r))}>
                            Activar {m.nombre}
                          </Boton>
                        </form>
                      )}
                      {contratado && aplicables.length > 0 && (
                        <form action={guardarCentrosModuloAccion} className="space-y-2 border-t border-slate-100 pt-3">
                          <input type="hidden" name="modulo" value={m.id} />
                          <div className="text-sm font-medium">Centros donde está activo</div>
                          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
                            {aplicables.map((c) => (
                              <Casilla key={c.id} nombre="centros" valor={c.id} marcada={enCentros.some((x) => x.id === c.id)}>
                                {c.nombre} <span className="text-xs text-suave">({c.codigo})</span>
                              </Casilla>
                            ))}
                          </div>
                          <Boton type="submit" variante="secundario">
                            Guardar centros
                          </Boton>
                        </form>
                      )}
                    </>
                  )
                )}
              </div>
            ),
          };
        })}
      />
    </>
  );
}
