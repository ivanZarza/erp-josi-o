import Link from "next/link";

export default function SinPermiso() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">No tienes permiso para ver esto</h1>
        <p className="mt-2 text-sm text-slate-500">Si lo necesitas, pide acceso al administrador de tu cadena.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-[var(--color-acento)]">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
