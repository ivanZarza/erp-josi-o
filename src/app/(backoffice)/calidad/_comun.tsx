/** Piezas compartidas por las pantallas de Calidad (no es una ruta). */
import { Aviso, Cifra, Rejilla } from "@/ui";
import type { Contexto } from "@/kernel/contexto";
import { numero } from "@/kernel/formato";
import { indicadoresCalidad } from "@/modulos/calidad/servicio";

export type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  return Array.isArray(v) ? v[0] : v;
}

export function Mensajes({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = param(sp, "error");
  const aviso = param(sp, "aviso");
  if (!error && !aviso) return null;
  return (
    <div className="mb-4">
      {error ? (
        <Aviso tono="error" titulo="No se ha podido guardar">
          {error}
        </Aviso>
      ) : (
        <Aviso tono="aviso">{aviso}</Aviso>
      )}
    </div>
  );
}

export async function Indicadores({ ctx, pendientesHoy }: { ctx: Contexto; pendientesHoy?: number }) {
  const i = await indicadoresCalidad(ctx);
  return (
    <div className="mb-6">
      <Rejilla columnas={4}>
        <Cifra etiqueta="Listas pendientes hoy" valor={pendientesHoy == null ? "—" : numero(pendientesHoy)} tono={pendientesHoy ? "aviso" : "ok"} href="/calidad" />
        <Cifra etiqueta="Alarmas de temperatura (24 h)" valor={numero(i.alarmas)} tono={i.alarmas ? "error" : "ok"} href="/calidad/temperaturas" />
        <Cifra etiqueta="Incidencias abiertas" valor={numero(i.incidencias)} tono={i.incidencias ? "aviso" : "ok"} href="/calidad/incidencias" />
        <Cifra etiqueta="Mantenimientos vencidos" valor={numero(i.mantenimientoVencido)} tono={i.mantenimientoVencido ? "error" : "ok"} href="/calidad/mantenimiento" />
      </Rejilla>
    </div>
  );
}

export const TIPOS_LISTA: Record<string, string> = { APERTURA: "Apertura", CIERRE: "Cierre", LIMPIEZA: "Limpieza", RECEPCION: "Recepción de mercancía", OTRA: "Otra" };
export const TIPOS_EQUIPO: Record<string, string> = {
  CAMARA_REFRIGERACION: "Cámara de refrigeración",
  CAMARA_CONGELACION: "Cámara de congelación",
  NEVERA: "Nevera",
  ARCON_CONGELADOR: "Arcón congelador",
  MESA_FRIA: "Mesa fría",
  OTRO: "Otro",
};
export const TIPOS_INCIDENCIA: Record<string, string> = {
  AVERIA: "Avería",
  QUEJA: "Queja",
  ACCIDENTE: "Accidente",
  SEGURIDAD_ALIMENTARIA: "Seguridad alimentaria",
  TEMPERATURA: "Temperatura",
  OTRA: "Otra",
};
export const ESTADOS_INCIDENCIA: Record<string, { texto: string; tono: "error" | "aviso" | "ok" | "normal" }> = {
  ABIERTA: { texto: "Abierta", tono: "error" },
  EN_CURSO: { texto: "En curso", tono: "aviso" },
  RESUELTA: { texto: "Resuelta", tono: "ok" },
  ANULADA: { texto: "Anulada", tono: "normal" },
};
