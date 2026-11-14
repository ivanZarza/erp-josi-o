"use client";
/** Botón de imprimir la etiqueta (necesita el navegador). */
import { Printer } from "lucide-react";

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-acento px-4 text-sm font-medium text-white hover:opacity-90">
      <Printer size={16} /> Imprimir
    </button>
  );
}
