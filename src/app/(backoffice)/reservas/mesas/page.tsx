import { exigir } from "@/kernel/contexto";
import { numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, Boton, Aviso, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { espaciosYMesas, NOMBRE_TIPO_ESPACIO } from "@/modulos/reservas/servicio";
import { guardarEspacioAccion, guardarMesaAccion, activarMesaAccion, activarEspacioAccion } from "@/modulos/reservas/acciones";
import { AvisosUrl, PestanasReservas, type Busqueda } from "@/modulos/reservas/ui";

const FORMAS = { CUADRADA: "Cuadrada", REDONDA: "Redonda", RECTANGULAR: "Rectangular" } as const;

function CamposMesa({ m, espacios }: { m?: { id: string; espacioId: string; nombre: string; capacidadMin: number; capacidadMax: number; forma: keyof typeof FORMAS; combinable: boolean; reservableInternet: boolean; especial: string | null }; espacios: { id: string; nombre: string }[] }) {
  return (
    <form action={guardarMesaAccion} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {m && <input type="hidden" name="id" value={m.id} />}
      <Campo etiqueta="Espacio">
        <Selector name="espacioId" defaultValue={m?.espacioId ?? espacios[0]?.id} required>
          {espacios.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Nombre o número">
        <Entrada name="nombre" defaultValue={m?.nombre} required />
      </Campo>
      <Campo etiqueta="Mínimo de personas">
        <Entrada type="number" name="capacidadMin" min={1} defaultValue={m?.capacidadMin ?? 1} required />
      </Campo>
      <Campo etiqueta="Máximo de personas">
        <Entrada type="number" name="capacidadMax" min={1} defaultValue={m?.capacidadMax ?? 4} required />
      </Campo>
      <Campo etiqueta="Forma">
        <Selector name="forma" defaultValue={m?.forma ?? "CUADRADA"}>
          {Object.entries(FORMAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Mesa especial" ayuda="Ventana, chimenea… (opcional)">
        <Entrada name="especial" defaultValue={m?.especial ?? ""} />
      </Campo>
      <div className="flex flex-col justify-center gap-1 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="combinable" defaultChecked={m?.combinable ?? false} /> Se puede juntar con otra</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="reservableInternet" defaultChecked={m?.reservableInternet ?? true} /> Reservable por internet</label>
      </div>
      <div className="flex items-end">
        <Boton type="submit">{m ? "Guardar mesa" : "Añadir mesa"}</Boton>
      </div>
    </form>
  );
}

export default async function EspaciosYMesas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("reservas", "reservas:planos:editar");
  const sp = await searchParams;
  const pestanas = <PestanasReservas activa="/reservas/mesas" puedeReglas={ctx.puede("reservas:reglas:editar")} puedePlanos />;
  const centro = ctx.centroActivo;
  if (!centro || centro.tipo !== "LOCAL")
    return (
      <>
        <Cabecera titulo="Espacios y mesas" />
        {pestanas}
        <Aviso tono="aviso">Elige un local en el selector de centro de arriba.</Aviso>
      </>
    );

  const espacios = await espaciosYMesas(ctx, centro.id);
  const activos = espacios.filter((e) => e.activo);
  const mesas = espacios.flatMap((e) => e.mesas.map((m) => ({ ...m, espacioNombre: e.nombre })));

  return (
    <>
      <Cabecera titulo="Espacios y mesas" subtitulo={`${centro.nombre} · la posición de cada mesa se cambia arrastrando en el plano`} />
      {pestanas}
      <AvisosUrl sp={sp} />

      <div className="space-y-6">
        <Tarjeta titulo="Espacios">
          <TablaDesplegable
            columnas={[{ titulo: "Espacio" }, { titulo: "Tipo" }, { titulo: "Aforo", alinear: "derecha" }, { titulo: "Mesas", alinear: "derecha" }, { titulo: "Plazas", alinear: "derecha" }, { titulo: "Estado" }]}
            vacio="Aún no hay espacios. Crea el primero (por ejemplo «Sala»)."
            filas={espacios.map((e) => ({
              id: e.id,
              celdas: [
                e.nombre,
                NOMBRE_TIPO_ESPACIO[e.tipo],
                numero(e.aforo),
                numero(e.mesas.filter((m) => m.activo).length),
                numero(e.mesas.filter((m) => m.activo).reduce((a, m) => a + m.capacidadMax, 0)),
                e.activo ? <Etiqueta key="a" tono="ok">Activo</Etiqueta> : <Etiqueta key="a">Desactivado</Etiqueta>,
              ],
              detalle: (
                <div className="space-y-3">
                  <form action={guardarEspacioAccion} className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="centroId" value={centro.id} />
                    <Campo etiqueta="Nombre"><Entrada name="nombre" defaultValue={e.nombre} required /></Campo>
                    <Campo etiqueta="Tipo">
                      <Selector name="tipo" defaultValue={e.tipo}>
                        {Object.entries(NOMBRE_TIPO_ESPACIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Selector>
                    </Campo>
                    <Campo etiqueta="Aforo"><Entrada type="number" name="aforo" min={0} defaultValue={e.aforo} /></Campo>
                    <Campo etiqueta="Ancho del plano"><Entrada type="number" name="ancho" min={200} defaultValue={e.ancho} /></Campo>
                    <Campo etiqueta="Alto del plano"><Entrada type="number" name="alto" min={200} defaultValue={e.alto} /></Campo>
                    <div className="flex items-end"><Boton type="submit">Guardar</Boton></div>
                  </form>
                  <form action={activarEspacioAccion}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="activo" value={e.activo ? "0" : "1"} />
                    <Boton type="submit" variante="secundario">{e.activo ? "Desactivar espacio" : "Volver a activar"}</Boton>
                  </form>
                </div>
              ),
            }))}
          />
          <form action={guardarEspacioAccion} className="mt-4 grid grid-cols-2 gap-3 border-t border-borde pt-4 lg:grid-cols-6">
            <input type="hidden" name="centroId" value={centro.id} />
            <Campo etiqueta="Nuevo espacio"><Entrada name="nombre" placeholder="Terraza" required /></Campo>
            <Campo etiqueta="Tipo">
              <Selector name="tipo" defaultValue="SALA">
                {Object.entries(NOMBRE_TIPO_ESPACIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Aforo"><Entrada type="number" name="aforo" min={0} defaultValue={40} /></Campo>
            <Campo etiqueta="Ancho del plano"><Entrada type="number" name="ancho" min={200} defaultValue={800} /></Campo>
            <Campo etiqueta="Alto del plano"><Entrada type="number" name="alto" min={200} defaultValue={500} /></Campo>
            <div className="flex items-end"><Boton type="submit">Crear espacio</Boton></div>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Mesas">
          <TablaDesplegable
            columnas={[{ titulo: "Mesa" }, { titulo: "Espacio" }, { titulo: "Personas", alinear: "derecha" }, { titulo: "Forma", secundaria: true }, { titulo: "Combinable", secundaria: true }, { titulo: "Internet", secundaria: true }, { titulo: "Estado" }]}
            vacio="Aún no hay mesas."
            filas={mesas.map((m) => ({
              id: m.id,
              celdas: [
                <span key="n" className="font-medium">{m.nombre}</span>,
                m.espacioNombre,
                `${m.capacidadMin}–${m.capacidadMax}`,
                FORMAS[m.forma],
                m.combinable ? "Sí" : "No",
                m.reservableInternet ? "Sí" : "No",
                m.activo ? <Etiqueta key="a" tono="ok">Activa</Etiqueta> : <Etiqueta key="a">Desactivada</Etiqueta>,
              ],
              detalle: (
                <div className="space-y-3">
                  <DatosDetalle datos={[{ etiqueta: "Posición", valor: `${m.x}, ${m.y}` }, { etiqueta: "Tamaño", valor: `${m.ancho} × ${m.alto}` }, { etiqueta: "Especial", valor: m.especial ?? "—" }]} />
                  <CamposMesa m={m} espacios={activos} />
                  <form action={activarMesaAccion}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="activo" value={m.activo ? "0" : "1"} />
                    <Boton type="submit" variante="secundario">{m.activo ? "Desactivar mesa" : "Volver a activar"}</Boton>
                  </form>
                </div>
              ),
            }))}
          />
          {activos.length > 0 && (
            <div className="mt-4 border-t border-borde pt-4">
              <CamposMesa espacios={activos} />
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
