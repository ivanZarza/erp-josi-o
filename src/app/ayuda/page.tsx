import type { Metadata } from "next";
import { VentanaAyuda } from "./ventana";

export const metadata: Metadata = { title: "Ayuda · ERP Josiño" };

/** Ventana aparte de ayuda (la abre el botón «?» de cada pantalla). No muestra datos: no pide sesión. */
export default async function PaginaAyuda({ searchParams }: { searchParams: Promise<{ ruta?: string }> }) {
  const { ruta } = await searchParams;
  return <VentanaAyuda rutaInicial={ruta ?? "/"} />;
}
