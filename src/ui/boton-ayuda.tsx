"use client";
/**
 * Botón «?» flotante en todas las pantallas. Abre la ayuda en una ventana aparte (/ayuda) que sigue
 * a la pantalla: cada cambio de ruta se avisa por el canal "erp-ayuda", y desde la ayuda se puede
 * pedir a esta ventana que vaya a otra pantalla.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { CircleHelp } from "lucide-react";

export const CANAL_AYUDA = "erp-ayuda";

export type MensajeAyuda = { tipo: "pantalla"; ruta: string } | { tipo: "ir"; ruta: string } | { tipo: "hola" };

export function BotonAyuda() {
  const ruta = usePathname();
  const router = useRouter();
  const canal = useRef<BroadcastChannel | null>(null);
  // la propia ventana de ayuda no es una pantalla del ERP: ni escucha órdenes ni avisa de cambios
  const esAyuda = ruta.startsWith("/ayuda");

  useEffect(() => {
    if (esAyuda || typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(CANAL_AYUDA);
    canal.current = c;
    c.onmessage = (e: MessageEvent<MensajeAyuda>) => {
      if (e.data.tipo === "ir") router.push(e.data.ruta);
      // la ventana de ayuda recién abierta pregunta en qué pantalla estamos
      if (e.data.tipo === "hola") c.postMessage({ tipo: "pantalla", ruta: location.pathname } satisfies MensajeAyuda);
    };
    return () => {
      c.close();
      canal.current = null;
    };
  }, [router, esAyuda]);

  useEffect(() => {
    canal.current?.postMessage({ tipo: "pantalla", ruta } satisfies MensajeAyuda);
  }, [ruta]);

  if (esAyuda) return null;

  const abrir = () => {
    const ancho = 520;
    const izquierda = Math.max(0, window.screenX + window.outerWidth - ancho);
    const v = window.open(
      `/ayuda?ruta=${encodeURIComponent(ruta)}`,
      "erp-ayuda",
      `popup,width=${ancho},height=${window.outerHeight},left=${izquierda},top=${window.screenY}`,
    );
    v?.focus();
  };

  return (
    <button
      type="button"
      onClick={abrir}
      title="Ayuda de esta pantalla (se abre en otra ventana)"
      aria-label="Ayuda de esta pantalla"
      className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-acento)] text-white shadow-lg ring-4 ring-white transition hover:scale-105 print:hidden"
    >
      <CircleHelp size={24} />
    </button>
  );
}
