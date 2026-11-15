import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Campo, Entrada, Selector, AreaTexto, Boton } from "@/ui";
import { marcasYLocales, NOMBRE_TIPO } from "@/modulos/eventos/servicio";
import { crearSolicitudAccion } from "@/modulos/eventos/acciones";
import { AvisosUrl, PestanasEventos, type Busqueda } from "@/modulos/eventos/ui";

export default async function NuevaSolicitud({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("eventos", "eventos:gestionar");
  const sp = await searchParams;
  const { marcas, locales } = await marcasYLocales(ctx);

  return (
    <>
      <Cabecera titulo="Nueva solicitud de evento" subtitulo="Grupos, empresas, Navidad, celebraciones y catering" />
      <PestanasEventos activa="/eventos/nueva" puedeGestionar />
      <AvisosUrl sp={sp} />
      <Tarjeta>
        <form action={crearSolicitudAccion} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Tipo">
            <Selector name="tipo" defaultValue="CELEBRACION">
              {Object.entries(NOMBRE_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Personas"><Entrada type="number" name="personas" min={1} defaultValue={20} required /></Campo>
          <Campo etiqueta="Fecha"><Entrada type="date" name="fecha" /></Campo>
          <Campo etiqueta="Hora"><Entrada type="time" name="hora" step={900} /></Campo>
          <Campo etiqueta="Contacto"><Entrada name="nombreContacto" required /></Campo>
          <Campo etiqueta="Empresa"><Entrada name="empresa" /></Campo>
          <Campo etiqueta="Teléfono" ayuda="Con prefijo: +34…"><Entrada type="tel" name="telefono" /></Campo>
          <Campo etiqueta="Correo"><Entrada type="email" name="email" /></Campo>
          <Campo etiqueta="Marca preferida">
            <Selector name="marcaId" defaultValue="">
              <option value="">Cualquiera</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Local preferido">
            <Selector name="centroId" defaultValue="">
              <option value="">Sin decidir</option>
              {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Presupuesto del cliente (€)" ayuda="Lo que dice que quiere gastar en total">
            <Entrada name="presupuestoCliente" inputMode="decimal" placeholder="1.500,00" />
          </Campo>
          <Campo etiqueta="Origen">
            <Selector name="origen" defaultValue="TELEFONO">
              <option value="TELEFONO">Teléfono</option>
              <option value="CORREO">Correo</option>
              <option value="WEB">Formulario web</option>
              <option value="MANUAL">En persona</option>
            </Selector>
          </Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
            <input type="checkbox" name="recomiendame" /> El cliente pide que le recomendemos local y espacio
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <Campo etiqueta="Notas"><AreaTexto name="notas" rows={3} placeholder="Qué celebran, alergias, montaje, horario…" /></Campo>
          </div>
          <div className="sm:col-span-2 lg:col-span-4"><Boton type="submit">Guardar solicitud</Boton></div>
        </form>
      </Tarjeta>
    </>
  );
}
