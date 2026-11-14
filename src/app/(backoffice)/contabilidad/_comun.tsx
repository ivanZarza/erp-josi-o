/** Piezas comunes de las pantallas de Contabilidad (solo de este módulo). */
import type { ReactNode } from "react";
import { Aviso, Boton, Campo, Entrada, Selector } from "@/ui";
import { euros } from "@/kernel/formato";
import type { EstadoFacturaRecibida, EstadoFacturaEmitida, EstadoGastoContable } from "@/generated/prisma/client";

export type ParametrosBusqueda = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

/** Mensajes ?ok= y ?error= que dejan las acciones. */
export function Avisos({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = param(sp, "ok");
  const error = param(sp, "error");
  if (!ok && !error) return null;
  return (
    <div className="mb-4">
      {error ? <Aviso tono="error">{error}</Aviso> : <Aviso tono="ok">{ok}</Aviso>}
    </div>
  );
}

/** Fila de filtros (formulario GET). */
export function Filtros({ children }: { children: ReactNode }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {children}
      <Boton type="submit" variante="secundario">
        Filtrar
      </Boton>
    </form>
  );
}

export function FiltroSociedad({ sociedades, valor }: { sociedades: { id: string; razonSocial: string }[]; valor?: string }) {
  return (
    <div className="min-w-56">
      <Campo etiqueta="Sociedad">
        <Selector name="sociedad" defaultValue={valor ?? ""}>
          <option value="">Todas mis sociedades</option>
          {sociedades.map((s) => (
            <option key={s.id} value={s.id}>
              {s.razonSocial}
            </option>
          ))}
        </Selector>
      </Campo>
    </div>
  );
}

export function FiltroMes({ valor, nombre = "mes", etiqueta = "Mes" }: { valor?: string; nombre?: string; etiqueta?: string }) {
  return (
    <div>
      <Campo etiqueta={etiqueta}>
        <Entrada type="month" name={nombre} defaultValue={valor ?? ""} />
      </Campo>
    </div>
  );
}

export const ESTADO_RECIBIDA: Record<EstadoFacturaRecibida, { texto: string; tono: "normal" | "ok" | "aviso" | "error" | "info" }> = {
  PENDIENTE: { texto: "Pendiente de revisar", tono: "aviso" },
  VALIDADA: { texto: "Validada", tono: "info" },
  PAGADA: { texto: "Pagada", tono: "ok" },
  ANULADA: { texto: "Anulada", tono: "normal" },
};

export const ESTADO_EMITIDA: Record<EstadoFacturaEmitida, { texto: string; tono: "normal" | "ok" | "aviso" | "error" | "info" }> = {
  BORRADOR: { texto: "Borrador", tono: "normal" },
  PREPARADA: { texto: "Preparada (sin emitir)", tono: "aviso" },
  EMITIDA_FUERA: { texto: "Emitida en programa certificado", tono: "info" },
  COBRADA: { texto: "Cobrada", tono: "ok" },
  ANULADA: { texto: "Anulada", tono: "normal" },
};

export const ESTADO_GASTO: Record<EstadoGastoContable, { texto: string; tono: "normal" | "ok" | "aviso" | "error" | "info" }> = {
  PENDIENTE: { texto: "Pendiente de pagar", tono: "aviso" },
  PAGADO: { texto: "Pagado", tono: "ok" },
  ANULADO: { texto: "Anulado", tono: "normal" },
};

export const FORMAS_PAGO: { valor: string; texto: string }[] = [
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "DOMICILIACION", texto: "Domiciliación" },
  { valor: "TARJETA", texto: "Tarjeta" },
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "OTRA", texto: "Otra" },
];

/** Formulario corto para registrar un pago o un cobro (fecha + forma + referencia). */
export function FormularioPago({ accion, id, volver, hoy, total, texto }: { accion: (f: FormData) => Promise<void>; id: string; volver: string; hoy: string; total: number; texto: string }) {
  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volver" value={volver} />
      <div className="w-40">
        <Campo etiqueta="Fecha">
          <Entrada type="date" name="fecha" defaultValue={hoy} required />
        </Campo>
      </div>
      <div className="w-44">
        <Campo etiqueta="Forma">
          <Selector name="forma" defaultValue="TRANSFERENCIA">
            {FORMAS_PAGO.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.texto}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <div className="w-48">
        <Campo etiqueta="Referencia (opcional)">
          <Entrada name="referencia" />
        </Campo>
      </div>
      <Boton type="submit">
        {texto} {euros(total)}
      </Boton>
    </form>
  );
}

/** Botón suelto que lanza una acción con el id (validar, anular…). */
export function BotonAccion({ accion, id, volver, texto, variante = "secundario" }: { accion: (f: FormData) => Promise<void>; id: string; volver: string; texto: string; variante?: "principal" | "secundario" | "peligro" }) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volver" value={volver} />
      <Boton type="submit" variante={variante}>
        {texto}
      </Boton>
    </form>
  );
}

/**
 * Filas de líneas de factura para los formularios de alta (las vacías se ignoran).
 * Rejilla de campos (no tabla): en @/ui falta un componente de «líneas editables»; se pedirá al coordinador.
 */
export function LineasFormulario({ categorias, filas = 8 }: { categorias?: { id: string; nombre: string }[]; filas?: number }) {
  const columnas = categorias ? "sm:grid-cols-[1fr_6rem_8rem_6rem_14rem]" : "sm:grid-cols-[1fr_6rem_8rem_6rem]";
  return (
    <div className="space-y-2">
      <div className={`hidden gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid ${columnas}`}>
        <span>Concepto</span>
        <span className="text-right">Cantidad</span>
        <span className="text-right">Precio sin IVA</span>
        <span>IVA</span>
        {categorias && <span>Categoría</span>}
      </div>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className={`grid grid-cols-2 gap-2 border-b border-slate-100 pb-2 sm:border-0 sm:pb-0 ${columnas}`}>
          <Entrada name={`linea_concepto_${i}`} placeholder={i === 0 ? "Por ejemplo: carne de vacuno" : "Concepto"} className="col-span-2 sm:col-span-1" />
          <Entrada name={`linea_cantidad_${i}`} defaultValue="1" inputMode="decimal" className="text-right" aria-label="Cantidad" />
          <Entrada name={`linea_precio_${i}`} inputMode="decimal" placeholder="0,00" className="text-right" aria-label="Precio sin IVA" />
          <Selector name={`linea_iva_${i}`} defaultValue="10" aria-label="IVA">
            <option value="21">21 %</option>
            <option value="10">10 %</option>
            <option value="4">4 %</option>
            <option value="0">0 %</option>
          </Selector>
          {categorias && (
            <Selector name={`linea_categoria_${i}`} defaultValue="" aria-label="Categoría">
              <option value="">La de la factura</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          )}
        </div>
      ))}
      <p className="text-xs text-slate-500">Las filas vacías no se guardan. Base, IVA y total los calcula el programa.</p>
    </div>
  );
}
