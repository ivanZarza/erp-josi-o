import type { Metadata } from "next";
import "./globals.css";
import { BotonAyuda } from "@/ui/boton-ayuda";

export const metadata: Metadata = {
  title: "ERP Josiño",
  description: "ERP modular para cadenas de restauración",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {children}
        <BotonAyuda />
      </body>
    </html>
  );
}
