import { Boton, Campo, Entrada, AreaTexto } from "@/ui";

export interface ValoresProveedor {
  id?: string;
  nombre: string;
  cif: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  areas: string[];
  diasReparto: string | null;
  pedidoMinimo: string;
  notas: string | null;
}

const AREAS: [string, string][] = [
  ["BEBIDAS", "Bebidas"],
  ["COMIDAS", "Comidas"],
  // el área de consumibles (menaje, limpieza…) aún no tiene módulo de compras: se puede marcar, pero no hace nada todavía
  ["CONSUMIBLES", "Consumibles (aún sin compras: solo informativo)"],
];

/** Formulario de alta y edición de proveedor (Server Component). */
export function FormularioProveedor({ accion, valores, volver, boton }: { accion: (f: FormData) => Promise<never>; valores: ValoresProveedor; volver: string; boton: string }) {
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="volver" value={volver} />
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Campo etiqueta="Nombre">
            <Entrada name="nombre" required defaultValue={valores.nombre} />
          </Campo>
        </div>
        <Campo etiqueta="CIF">
          <Entrada name="cif" defaultValue={valores.cif ?? ""} />
        </Campo>
        <Campo etiqueta="Persona de contacto">
          <Entrada name="contacto" defaultValue={valores.contacto ?? ""} />
        </Campo>
        <Campo etiqueta="Teléfono (WhatsApp)" ayuda="Formato internacional: +34 600 000 000">
          <Entrada name="telefono" type="tel" inputMode="tel" placeholder="+34…" defaultValue={valores.telefono ?? ""} />
        </Campo>
        <Campo etiqueta="Correo de pedidos">
          <Entrada name="email" type="email" defaultValue={valores.email ?? ""} />
        </Campo>
        <Campo etiqueta="Días de reparto">
          <Entrada name="diasReparto" placeholder="Por ejemplo: lunes y jueves" defaultValue={valores.diasReparto ?? ""} />
        </Campo>
        <Campo etiqueta="Pedido mínimo (€)" ayuda="Con coma o punto: 150 o 150,50">
          <Entrada name="pedidoMinimo" inputMode="decimal" defaultValue={valores.pedidoMinimo} />
        </Campo>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">Qué nos sirve (sale en las compras de esas áreas)</legend>
          <div className="flex flex-wrap gap-4">
            {AREAS.map(([v, n]) => (
              <label key={v} className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="areas" value={v} defaultChecked={valores.areas.includes(v)} /> {n}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Campo etiqueta="Notas">
            <AreaTexto name="notas" rows={2} defaultValue={valores.notas ?? ""} />
          </Campo>
        </div>
      </div>
      <Boton type="submit">{boton}</Boton>
    </form>
  );
}
