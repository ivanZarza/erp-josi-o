/** Piezas compartidas por las pantallas de Carta y escandallos (no es una ruta). */
import { Aviso, Pestanas } from "@/ui";
import { nombreAlergeno } from "@/modulos/comidas/carta-alergenos";

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  return Array.isArray(v) ? v[0] : v;
}

export function AvisoError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="mb-4">
      <Aviso tono="error" titulo="No se ha podido guardar">
        {error}
      </Aviso>
    </div>
  );
}

export function PestanasCarta({ activa }: { activa: string }) {
  return (
    <Pestanas
      activa={activa}
      items={[
        { href: "/comidas/carta", titulo: "Platos y escandallos" },
        { href: "/comidas/carta/cartas", titulo: "Cartas" },
        { href: "/comidas/carta/recargos", titulo: "Pan y aperitivo" },
        { href: "/comidas/carta/alergenos", titulo: "Alérgenos de ingredientes" },
      ]}
    />
  );
}

export function listaAlergenos(claves: string[]) {
  return claves.length ? claves.map(nombreAlergeno).join(", ") : "Ninguno";
}

export const UNIDADES: Record<string, string> = { UD: "ud", KG: "kg", L: "l", RACION: "ración", BOTELLA: "bot.", CAJA: "caja" };
export function unidad(u: string) {
  return UNIDADES[u] ?? u.toLowerCase();
}
