/** Piezas compartidas por las pantallas del Obrador (no es una ruta). */
import { Aviso, Vacio } from "@/ui";
import type { Contexto } from "@/kernel/contexto";
import { obradoresVisibles } from "@/modulos/obrador/servicio";

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

/** El obrador solo tiene sentido en centros tipo OBRADOR: si el centro elegido es un local, se avisa. */
export function SinObrador({ ctx }: { ctx: Contexto }) {
  if (obradoresVisibles(ctx).length > 0) return null;
  return (
    <Vacio>
      {ctx.centroActivo
        ? `${ctx.centroActivo.nombre} no es un obrador. Elige el obrador en el selector de centro de arriba.`
        : "No tienes ningún obrador entre tus centros. Pide acceso al obrador a la administración de la cadena."}
    </Vacio>
  );
}

export const UNIDADES: Record<string, string> = { UD: "ud", KG: "kg", L: "l", RACION: "ración", BOTELLA: "bot.", CAJA: "caja" };
export function unidad(u: string) {
  return UNIDADES[u] ?? u.toLowerCase();
}
