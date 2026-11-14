/** Campos de la ficha de cliente (alta y edición). Server Component. */
import { Campo, Entrada, AreaTexto, Boton } from "@/ui";

export interface ValoresCliente {
  id?: string;
  nombre?: string;
  apellidos?: string | null;
  telefono?: string | null;
  email?: string | null;
  fechaNacimiento?: Date | null;
  preferencias?: string | null;
  alergias?: string | null;
  notas?: string | null;
  etiquetas?: string[];
}

export function FormularioCliente({ accion, v = {}, boton }: { accion: (f: FormData) => Promise<void>; v?: ValoresCliente; boton: string }) {
  return (
    <form action={accion} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <Campo etiqueta="Nombre"><Entrada name="nombre" defaultValue={v.nombre ?? ""} required /></Campo>
      <Campo etiqueta="Apellidos"><Entrada name="apellidos" defaultValue={v.apellidos ?? ""} /></Campo>
      <Campo etiqueta="Teléfono" ayuda="Con prefijo: +34…"><Entrada type="tel" name="telefono" defaultValue={v.telefono ?? ""} /></Campo>
      <Campo etiqueta="Correo"><Entrada type="email" name="email" defaultValue={v.email ?? ""} /></Campo>
      <Campo etiqueta="Cumpleaños"><Entrada type="date" name="fechaNacimiento" defaultValue={v.fechaNacimiento ? v.fechaNacimiento.toISOString().slice(0, 10) : ""} /></Campo>
      <Campo etiqueta="Etiquetas" ayuda="Separadas por comas: VIP, Empresa, Habitual"><Entrada name="etiquetas" defaultValue={(v.etiquetas ?? []).join(", ")} /></Campo>
      <Campo etiqueta="Alergias"><Entrada name="alergias" defaultValue={v.alergias ?? ""} /></Campo>
      <Campo etiqueta="Preferencias"><Entrada name="preferencias" defaultValue={v.preferencias ?? ""} placeholder="Mesa de ventana, vino tinto…" /></Campo>
      <div className="sm:col-span-2 lg:col-span-4"><Campo etiqueta="Notas de sala"><AreaTexto name="notas" rows={2} defaultValue={v.notas ?? ""} /></Campo></div>
      <div className="sm:col-span-2 lg:col-span-4"><Boton type="submit">{boton}</Boton></div>
    </form>
  );
}
