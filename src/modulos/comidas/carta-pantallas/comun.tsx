/**
 * Piezas comunes de las pantallas de la carta. La carta la comparten dos áreas:
 * Comidas (/comidas/carta: platos) y Bebidas (/bebidas/carta: vinos, copas, cafés…).
 */
import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { Aviso, Pestanas, cx } from "@/ui";
import { nombreAlergeno } from "../carta-alergenos";
import type { AreaCarta } from "../carta-servicio";

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  return Array.isArray(v) ? v[0] : v;
}

/** Textos y rutas de cada área. */
export const AREA = {
  COMIDAS: {
    modulo: "comidas",
    base: "/comidas/carta",
    titulo: "Carta de comidas",
    plato: "plato",
    platos: "platos",
    Plato: "Plato",
    ejemploNombre: "Entraña a la parrilla",
    ejemploNombreEn: "Grilled skirt steak",
  },
  BEBIDAS: {
    modulo: "bebidas",
    base: "/bebidas/carta",
    titulo: "Carta de bebidas",
    plato: "bebida",
    platos: "bebidas",
    Plato: "Bebida",
    ejemploNombre: "Viña Ardanza",
    ejemploNombreEn: "",
  },
} as const;

/** Permiso para ver (o editar) la carta del área. */
export function exigirCarta(area: AreaCarta) {
  const m = AREA[area].modulo;
  return exigir(m, `${m}:carta:ver`);
}
export function permisoEditar(area: AreaCarta) {
  return `${AREA[area].modulo}:carta:editar`;
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

export function PestanasCarta({ activa, area = "COMIDAS" }: { activa: string; area?: AreaCarta }) {
  const items =
    area === "BEBIDAS"
      ? [
          { href: "/bebidas/carta", titulo: "Bebidas de la carta" },
          { href: "/bebidas/carta/cartas", titulo: "Cartas" },
          { href: "/bebidas/bodega", titulo: "Bodega" },
        ]
      : [
          { href: "/comidas/carta", titulo: "Platos y escandallos" },
          { href: "/comidas/carta/cartas", titulo: "Cartas" },
          { href: "/comidas/carta/recargos", titulo: "Pan y aperitivo" },
          { href: "/comidas/carta/alergenos", titulo: "Alérgenos de ingredientes" },
        ];
  return <Pestanas activa={activa} items={items} />;
}

export function listaAlergenos(claves: string[]) {
  return claves.length ? claves.map(nombreAlergeno).join(", ") : "Ninguno";
}

export const UNIDADES: Record<string, string> = { UD: "ud", KG: "kg", L: "l", RACION: "ración", BOTELLA: "bot.", CAJA: "caja", BARRIL: "barril" };
export function unidad(u: string) {
  return UNIDADES[u] ?? u.toLowerCase();
}

/** Tarjeta pulsable para entrar en una sección o en un tipo (estilo «entrar por el área y la sección»). */
export function TarjetaEntrada({ href, titulo, subtitulo, detalle, activa, tono }: { href: string; titulo: string; subtitulo?: string | null; detalle?: string; activa?: boolean; tono?: "aviso" | "error" }) {
  return (
    <Link
      href={href}
      className={cx(
        "block rounded-xl border bg-white p-3 shadow-sm transition hover:border-acento hover:shadow",
        activa ? "border-acento ring-1 ring-acento" : tono === "error" ? "border-red-300" : tono === "aviso" ? "border-amber-300" : "border-slate-200",
      )}
    >
      <span className="block text-sm font-semibold text-tinta">{titulo}</span>
      {subtitulo && <span className="block truncate text-xs text-suave">{subtitulo}</span>}
      {detalle && <span className="mt-1 block text-xs text-slate-600">{detalle}</span>}
    </Link>
  );
}
