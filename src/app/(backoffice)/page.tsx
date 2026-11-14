import Link from "next/link";
import { contexto, modulosVisibles } from "@/kernel/contexto";
import { Cabecera, Tarjeta } from "@/ui";

export default async function Inicio() {
  const ctx = await contexto();
  const modulos = modulosVisibles(ctx).filter((m) => !m.nucleo || m.id === "proveedores");
  const ajustes = modulosVisibles(ctx).filter((m) => m.nucleo && m.id !== "proveedores");

  return (
    <>
      <Cabecera
        titulo={`Hola, ${ctx.usuario.nombre}`}
        subtitulo={ctx.centroActivo ? `Estás viendo ${ctx.centroActivo.nombre}.` : `Estás viendo tus ${ctx.centros.length} centros. Elige uno arriba para filtrar.`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modulos.map((m) => (
          <Link key={m.id} href={m.menu[0]?.ruta ?? "/"} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
            <div className="text-base font-semibold">{m.nombre}</div>
            <p className="mt-1 line-clamp-3 text-sm text-slate-500">{m.descripcion}</p>
          </Link>
        ))}
      </div>
      {ajustes.length > 0 && (
        <div className="mt-6">
          <Tarjeta titulo="Ajustes de la cadena">
            <div className="flex flex-wrap gap-2">
              {ajustes.flatMap((m) =>
                m.menu.map((e) => (
                  <Link key={e.ruta} href={e.ruta} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">
                    {m.nombre} · {e.titulo}
                  </Link>
                )),
              )}
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
