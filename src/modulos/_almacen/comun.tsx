/**
 * Piezas comunes de las páginas de Bebidas y Comidas (Server Components).
 */
import { Aviso, Etiqueta, Selector } from "@/ui";
import type { Contexto } from "@/kernel/contexto";
import { moduloDeArea, type AreaAlmacen } from "@/nucleo/comun-almacen";
import type { EstadoStock } from "@/nucleo/stock";

export type Busqueda = Record<string, string | string[] | undefined>;

export interface PropsPagina {
  area: AreaAlmacen;
  searchParams: Promise<Busqueda>;
}
export interface PropsPaginaId extends PropsPagina {
  params: Promise<{ id: string }>;
}

export function uno(sp: Busqueda, clave: string): string {
  const v = sp[clave];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function textosArea(area: AreaAlmacen) {
  const m = moduloDeArea(area);
  return area === "BEBIDAS"
    ? { m, nombre: "Bebidas", articulo: "la bebida", productos: "bebidas", unidadTipica: "BOTELLA" }
    : { m, nombre: "Comidas", articulo: "la comida", productos: "productos de alimentación", unidadTipica: "KG" };
}

/** Aviso de resultado de la última acción (?ok=… / ?error=…). */
export function Mensajes({ sp }: { sp: Busqueda }) {
  const ok = uno(sp, "ok");
  const error = uno(sp, "error");
  if (!ok && !error) return null;
  return (
    <div className="mb-4">
      {error ? (
        <Aviso tono="error" titulo="No se ha podido hacer">
          {error}
        </Aviso>
      ) : (
        <Aviso tono="ok">{ok}</Aviso>
      )}
    </div>
  );
}

/** Ruta actual con su búsqueda, sin ok/error (para volver tras una acción). */
export function rutaVolver(base: string, sp: Busqueda): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "ok" || k === "error" || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
  }
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

/** Campos ocultos que llevan todas las acciones: área y página a la que volver. */
export function Ocultos({ area, volver, id }: { area: AreaAlmacen; volver: string; id?: string }) {
  return (
    <>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="volver" value={volver} />
      {id && <input type="hidden" name="id" value={id} />}
    </>
  );
}

export function EtiquetaStock({ estado }: { estado: EstadoStock }) {
  if (estado === "SIN") return <Etiqueta tono="error">Sin stock</Etiqueta>;
  if (estado === "BAJO") return <Etiqueta tono="aviso">Bajo mínimo</Etiqueta>;
  return <Etiqueta tono="ok">Correcto</Etiqueta>;
}

const PEDIDO: Record<string, { texto: string; tono: "normal" | "ok" | "aviso" | "error" | "info" }> = {
  BORRADOR: { texto: "Borrador", tono: "normal" },
  PENDIENTE: { texto: "Por servir", tono: "aviso" },
  SERVIDO: { texto: "Servido · por confirmar", tono: "info" },
  RECIBIDO: { texto: "Recibido", tono: "ok" },
  RECHAZADO: { texto: "Rechazado", tono: "error" },
  CANCELADO: { texto: "Cancelado", tono: "normal" },
};
export function EtiquetaPedido({ estado }: { estado: string }) {
  const e = PEDIDO[estado] ?? { texto: estado, tono: "normal" as const };
  return <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>;
}

const COMPRA: Record<string, { texto: string; tono: "normal" | "ok" | "aviso" | "error" | "info" }> = {
  BORRADOR: { texto: "Sin enviar", tono: "normal" },
  ENVIADO: { texto: "Enviada · por recibir", tono: "aviso" },
  RECIBIDO_PARCIAL: { texto: "Recibida en parte", tono: "info" },
  RECIBIDO: { texto: "Recibida", tono: "ok" },
  CANCELADO: { texto: "Cancelada", tono: "normal" },
};
export function EtiquetaCompra({ estado }: { estado: string }) {
  const e = COMPRA[estado] ?? { texto: estado, tono: "normal" as const };
  return <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>;
}

const INVENTARIO: Record<string, { texto: string; tono: "normal" | "ok" | "aviso" | "error" | "info" }> = {
  ABIERTO: { texto: "Contando", tono: "info" },
  PENDIENTE_APROBACION: { texto: "Pendiente de aprobación", tono: "aviso" },
  CERRADO: { texto: "Cerrado", tono: "ok" },
};
export function EtiquetaInventario({ estado }: { estado: string }) {
  const e = INVENTARIO[estado] ?? { texto: estado, tono: "normal" as const };
  return <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>;
}

export const TIPOS_MOVIMIENTO: Record<string, string> = {
  ENTRADA_COMPRA: "Entrada de compra",
  SALIDA_PEDIDO: "Salida a local",
  ENTRADA_PEDIDO: "Entrada de pedido",
  PRODUCCION_CONSUMO: "Consumo en producción",
  PRODUCCION_ENTRADA: "Entrada de producción",
  MERMA: "Merma",
  AJUSTE_INVENTARIO: "Ajuste de inventario",
  CONSUMO: "Consumo del local",
  VENTA: "Venta en caja",
  CARGA_INICIAL: "Carga inicial",
  TRASPASO: "Traspaso entre almacenes",
};

/**
 * Selector de almacén de un centro para entradas y salidas. La primera opción (valor vacío) deja que
 * el motor use el almacén por defecto de cada producto (ver src/nucleo/regla-almacen.ts).
 */
export function SelectorAlmacen({
  name = "almacenId",
  almacenes,
  textoDefecto = "Cada producto en su almacén",
  defaultValue = "",
}: {
  name?: string;
  almacenes: { id: string; nombre: string }[];
  textoDefecto?: string;
  defaultValue?: string;
}) {
  if (almacenes.length === 0) return null;
  return (
    <Selector name={name} defaultValue={defaultValue} className="w-auto" aria-label="Almacén">
      <option value="">{textoDefecto}</option>
      {almacenes.map((a) => (
        <option key={a.id} value={a.id}>
          {a.nombre}
        </option>
      ))}
    </Selector>
  );
}

export const NOMBRE_UNIDAD: Record<string, string> = {
  UD: "unidades",
  BOTELLA: "botellas",
  KG: "kg",
  L: "litros",
  CAJA: "cajas",
  LATA: "latas",
  BARRIL: "barriles",
  PAQUETE: "paquetes",
  BANDEJA: "bandejas",
};
export function unidad(u: string): string {
  return NOMBRE_UNIDAD[u] ?? u.toLowerCase();
}

/** ¿Ve este usuario el centro? */
export function veCentro(ctx: Contexto, centroId: string): boolean {
  return ctx.centros.some((c) => c.id === centroId);
}

/** Valor para una casilla editable: coma decimal y SIN separador de miles (para que se lea bien al guardar). */
export function paraCampo(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(Math.round(n * 10000) / 10000).replace(".", ",");
}
