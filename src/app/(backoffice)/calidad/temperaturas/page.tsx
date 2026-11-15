import { exigir, centrosFiltro } from "@/kernel/contexto";
import { fechaHora, numero } from "@/kernel/formato";
import { Boton, Cabecera, Campo, Entrada, Etiqueta, HuecoIntegracion, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarEquipos, listarEquiposDeBaja } from "@/modulos/calidad/servicio";
import { crearEquipo, desactivarEquipo, reactivarEquipo, registrarTemperatura } from "@/modulos/calidad/acciones";
import { Indicadores, Mensajes, TIPOS_EQUIPO, type Busqueda } from "../_comun";

const grados = (v: number) => `${numero(v, 1)} °C`;

export default async function Temperaturas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("calidad", "calidad:ver");
  const sp = await searchParams;
  const puedeRegistrar = ctx.puede("calidad:registrar");
  const puedeEditar = ctx.puede("calidad:editar");
  const [equipos, deBaja] = await Promise.all([listarEquipos(ctx), puedeEditar ? listarEquiposDeBaja(ctx) : Promise.resolve([])]);
  const volver = "/calidad/temperaturas";
  const centros = ctx.centros.filter((c) => centrosFiltro(ctx).includes(c.id));

  return (
    <>
      <Cabecera titulo="Temperaturas" subtitulo="Registro de cámaras y neveras con su rango. Una lectura fuera de rango abre una incidencia automáticamente." />
      <Mensajes sp={sp} />
      <Indicadores ctx={ctx} />
      <div className="mb-4">
        <HuecoIntegracion nombre="Sondas de temperatura" descripcion="Las sondas conectadas leerán cada cámara y nevera sola y darán la alarma al momento" />
      </div>

      <TablaDesplegable
        columnas={[{ titulo: "Centro" }, { titulo: "Equipo" }, { titulo: "Rango", alinear: "derecha" }, { titulo: "Última", alinear: "derecha" }, { titulo: "Cuándo", secundaria: true }, { titulo: "Estado" }]}
        vacio="No hay equipos de frío dados de alta en tus centros. Añádelos abajo."
        filas={equipos.map((e) => ({
          id: e.id,
          tono: e.ultimo?.fueraDeRango ? ("error" as const) : e.sinRegistroHoy ? ("aviso" as const) : undefined,
          celdas: [
            e.centro,
            `${e.nombre} · ${TIPOS_EQUIPO[e.tipo]}`,
            `${grados(e.minimo)} a ${grados(e.maximo)}`,
            e.ultimo ? grados(e.ultimo.temperatura) : "—",
            e.ultimo ? fechaHora(e.ultimo.createdAt) : "Nunca",
            e.ultimo?.fueraDeRango ? (
              <Etiqueta tono="error">Fuera de rango</Etiqueta>
            ) : e.sinRegistroHoy ? (
              <Etiqueta tono="aviso">Sin lectura en 24 h</Etiqueta>
            ) : (
              <Etiqueta tono="ok">Correcta</Etiqueta>
            ),
          ],
          detalle: (
            <div className="space-y-4">
              {puedeRegistrar && (
                <form action={registrarTemperatura} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="equipoId" value={e.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <Campo etiqueta="Temperatura (°C)">
                    <Entrada name="temperatura" inputMode="decimal" required placeholder="3,5" className="w-32" />
                  </Campo>
                  <div className="min-w-64 flex-1">
                    <Campo etiqueta="Acción correctora (si está fuera de rango)">
                      <Entrada name="accionCorrectora" placeholder="Se avisa al técnico y se pasa el género a la otra cámara" />
                    </Campo>
                  </div>
                  <Boton type="submit">Registrar</Boton>
                </form>
              )}
              <DatosDetalle
                datos={[
                  { etiqueta: "Alarmas en 24 h", valor: numero(e.alarmas24h) },
                  { etiqueta: "Sonda", valor: e.sondaId ?? "Sin sonda (lectura a mano)" },
                ]}
              />
              <Tabla
                clave={(r) => r.id}
                filas={e.registros}
                vacio="Sin lecturas todavía."
                columnas={[
                  { titulo: "Cuándo", celda: (r) => fechaHora(r.createdAt) },
                  { titulo: "Temperatura", alinear: "derecha", celda: (r) => (r.fueraDeRango ? <Etiqueta tono="error">{grados(Number(r.temperatura))}</Etiqueta> : grados(Number(r.temperatura))) },
                  { titulo: "Acción correctora", celda: (r) => r.accionCorrectora ?? "—" },
                  { titulo: "Quién", celda: (r) => r.registradoNombre ?? r.origen },
                ]}
              />
              {puedeEditar && (
                <form action={desactivarEquipo}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <Boton type="submit" variante="secundario">
                    Dar de baja el equipo
                  </Boton>
                </form>
              )}
            </div>
          ),
        }))}
      />

      {puedeEditar && deBaja.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Equipos dados de baja">
            <Tabla
              clave={(e) => e.id}
              filas={deBaja}
              columnas={[
                { titulo: "Centro", celda: (e) => e.centro },
                { titulo: "Equipo", celda: (e) => `${e.nombre} · ${TIPOS_EQUIPO[e.tipo]}` },
                { titulo: "Rango", alinear: "derecha", celda: (e) => `${grados(e.minimo)} a ${grados(e.maximo)}` },
                { titulo: "Última lectura", celda: (e) => (e.ultimaLectura ? fechaHora(e.ultimaLectura) : "Nunca") },
                {
                  titulo: "",
                  celda: (e) => (
                    <form action={reactivarEquipo}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <Boton type="submit" variante="secundario">
                        Volver a dar de alta
                      </Boton>
                    </form>
                  ),
                },
              ]}
            />
          </Tarjeta>
        </div>
      )}

      {puedeEditar && centros.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Nuevo equipo de frío">
            <form action={crearEquipo} className="grid grid-cols-1 items-end gap-3 md:grid-cols-6">
              <input type="hidden" name="volver" value={volver} />
              <Campo etiqueta="Centro">
                <Selector name="centroId" defaultValue={centros[0].id}>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre">
                <Entrada name="nombre" required placeholder="Cámara de carnes" />
              </Campo>
              <Campo etiqueta="Tipo">
                <Selector name="tipo" defaultValue="CAMARA_REFRIGERACION">
                  {Object.entries(TIPOS_EQUIPO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Mínima (°C)">
                <Entrada name="minimo" inputMode="decimal" required defaultValue="0" />
              </Campo>
              <Campo etiqueta="Máxima (°C)">
                <Entrada name="maximo" inputMode="decimal" required defaultValue="4" />
              </Campo>
              <Boton type="submit">Añadir equipo</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
