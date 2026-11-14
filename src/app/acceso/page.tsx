import { entrar } from "./acciones";
import { Boton, Campo, Entrada } from "@/ui";

export default async function Acceso({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={entrar} className="w-full max-w-sm space-y-4 rounded-lg border border-borde bg-white p-6">
        <div>
          <h1 className="text-xl font-semibold">ERP Josiño</h1>
          <p className="text-sm text-suave">Entra con tu correo y tu contraseña.</p>
        </div>
        <Campo etiqueta="Correo">
          <Entrada name="email" type="email" required autoComplete="username" />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada name="password" type="password" required autoComplete="current-password" />
        </Campo>
        {error && <p className="text-sm text-error">Correo o contraseña incorrectos.</p>}
        <Boton type="submit" className="w-full">
          Entrar
        </Boton>
      </form>
    </main>
  );
}
