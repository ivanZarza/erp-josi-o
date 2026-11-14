import { exigir } from "@/kernel/contexto";
import { fechaHora } from "@/kernel/formato";
import { AreaTexto, Aviso, Boton, Cabecera, Campo, Entrada, Etiqueta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { AvisosPagina, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { guardarIntegracionAccion } from "@/modulos/usuarios/acciones";
import { listarIntegraciones } from "@/modulos/usuarios/servicio";

const NOMBRE_ESTADO: Record<string, string> = { NO_CONECTADA: "Pendiente", CONFIGURADA: "Configurada", ACTIVA: "Activa", ERROR: "Con error" };

export default async function IntegracionesPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("usuarios", "ajustes:integraciones:ver");
  const sp = await searchParams;
  const huecos = await listarIntegraciones(ctx);
  const editar = ctx.puede("ajustes:integraciones:editar");

  return (
    <>
      <Cabecera titulo="Integraciones" subtitulo="Conexiones con programas externos que traen los módulos contratados. Todas están pendientes: por ahora los datos se meten a mano." />
      <AvisosPagina sp={sp} />
      <div className="mb-4">
        <Aviso>Aquí solo se apunta qué proveedor usa la cadena y notas. Nunca escribas claves ni contraseñas: irán cifradas aparte cuando se haga cada conexión.</Aviso>
      </div>
      <TablaDesplegable
        columnas={[{ titulo: "Integración" }, { titulo: "Módulo" }, { titulo: "Proveedor" }, { titulo: "Estado" }]}
        vacio="Los módulos contratados no traen integraciones."
        total={`${huecos.length} integraciones`}
        filas={huecos.map((h) => {
          const estado = h.fila?.estado ?? "NO_CONECTADA";
          return {
            id: h.hueco.id,
            celdas: [
              <span key="n" className="font-medium">{h.hueco.nombre}</span>,
              h.modulo.nombre,
              h.fila?.proveedor ?? "—",
              <Etiqueta key="e" tono={estado === "ACTIVA" ? "ok" : estado === "ERROR" ? "error" : "aviso"}>
                {NOMBRE_ESTADO[estado] ?? estado}
              </Etiqueta>,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Para qué", valor: h.hueco.descripcion },
                    { etiqueta: "Última sincronización", valor: fechaHora(h.fila?.ultimaSync) },
                    { etiqueta: "Último error", valor: h.fila?.ultimoError ?? "—" },
                    { etiqueta: "Notas", valor: h.notas || "—" },
                  ]}
                />
                {editar && (
                  <form action={guardarIntegracionAccion} className="space-y-3">
                    <input type="hidden" name="tipo" value={h.hueco.id} />
                    <Campo etiqueta="Proveedor" ayuda="Por ejemplo: Revo, CoverManager, A3…">
                      <Entrada name="proveedor" defaultValue={h.fila?.proveedor ?? ""} maxLength={80} />
                    </Campo>
                    <Campo etiqueta="Notas (sin claves)">
                      <AreaTexto name="notas" rows={3} defaultValue={h.notas} />
                    </Campo>
                    <Boton type="submit" variante="secundario">
                      Guardar
                    </Boton>
                  </form>
                )}
              </div>
            ),
          };
        })}
      />
    </>
  );
}
