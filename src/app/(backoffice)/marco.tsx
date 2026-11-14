"use client";
/**
 * Marco del backoffice (estructura de Tramidocs, specs/06_diseno.md §2):
 * cabecera blanca con lanzador de módulos + barra lateral oscura con las secciones del módulo abierto.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2, KeyRound, Truck, Wine, UtensilsCrossed, CookingPot, Receipt, Users, BookOpen, BarChart3,
  ShieldCheck, CalendarDays, Star, UserRound, Globe, LayoutGrid, PanelLeftClose, PanelLeftOpen, Menu, X, Home, LogOut,
  type LucideIcon,
} from "lucide-react";

const ICONOS: Record<string, LucideIcon> = {
  edificio: Building2, llave: KeyRound, camion: Truck, copa: Wine, plato: UtensilsCrossed, horno: CookingPot,
  caja: Receipt, personas: Users, libro: BookOpen, grafica: BarChart3, escudo: ShieldCheck, calendario: CalendarDays,
  estrella: Star, persona: UserRound, globo: Globe,
};

export interface ModuloMarco {
  id: string;
  nombre: string;
  icono: string;
  menu: { ruta: string; titulo: string }[];
}

interface Props {
  modulos: ModuloMarco[];
  cadena: string;
  usuario: string;
  centros: { id: string; nombre: string; tipo: string }[];
  centroActivo: string | null;
  cambiarCentro: (form: FormData) => Promise<void>;
  salir: () => Promise<void>;
  children: ReactNode;
}

function raizModulo(m: ModuloMarco): string {
  return m.menu[0]?.ruta.split("/").slice(0, 2).join("/") ?? "";
}

export function Marco({ modulos, cadena, usuario, centros, centroActivo, cambiarCentro, salir, children }: Props) {
  const ruta = usePathname();
  const [plegada, setPlegada] = useState(false);
  const [lateralMovil, setLateralMovil] = useState(false);
  const [lanzador, setLanzador] = useState(false);

  // módulo abierto = el que tiene la entrada de menú con el prefijo más largo que encaja con la ruta
  let actual: ModuloMarco | undefined;
  let mejor = 0;
  for (const m of modulos)
    for (const e of m.menu)
      if ((ruta === e.ruta || ruta.startsWith(e.ruta + "/")) && e.ruta.length > mejor) {
        actual = m;
        mejor = e.ruta.length;
      }

  const entradaActiva = (r: string) => {
    if (!actual) return false;
    const candidatas = actual.menu.filter((e) => ruta === e.ruta || ruta.startsWith(e.ruta + "/"));
    const larga = candidatas.sort((a, b) => b.ruta.length - a.ruta.length)[0];
    return larga?.ruta === r;
  };

  const IconoActual = actual ? (ICONOS[actual.icono] ?? LayoutGrid) : Home;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Barra lateral (solo si hay módulo abierto) */}
      {actual && (
        <>
          {lateralMovil && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setLateralMovil(false)} />}
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-white transition-[width] lg:sticky lg:top-0 lg:h-screen ${plegada ? "lg:w-20" : "lg:w-64"} ${lateralMovil ? "w-64" : "hidden lg:flex"}`}
          >
            <div className={`flex h-16 shrink-0 items-center border-b border-slate-800 ${plegada ? "justify-center" : "justify-between px-4"}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-acento)]">
                  <IconoActual size={18} />
                </span>
                {!plegada && <span className="text-lg font-semibold tracking-tight">{actual.nombre}</span>}
              </div>
              <button className="hidden rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:block" onClick={() => setPlegada(!plegada)} aria-label="Plegar menú">
                {plegada ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button className="rounded-md p-2 text-slate-400 lg:hidden" onClick={() => setLateralMovil(false)} aria-label="Cerrar menú">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {actual.menu.map((e) => {
                const act = entradaActiva(e.ruta);
                return (
                  <Link
                    key={e.ruta}
                    href={e.ruta}
                    onClick={() => setLateralMovil(false)}
                    title={e.titulo}
                    className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${act ? "bg-slate-800 font-medium text-white ring-1 ring-[var(--color-acento)]" : "text-slate-300 hover:bg-slate-800 hover:text-white"} ${plegada ? "justify-center" : ""}`}
                  >
                    {plegada ? e.titulo.slice(0, 2) : e.titulo}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-slate-800 p-3 text-xs text-slate-500">{!plegada && cadena}</div>
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera */}
        <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center gap-3 border-b border-slate-200 bg-white px-3 md:px-5">
          {actual && (
            <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setLateralMovil(true)} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <Link href="/" className="mr-2 whitespace-nowrap text-base font-semibold text-slate-900">
            {cadena}
          </Link>

          {/* Lanzador de módulos: iconos en escritorio, rejilla en móvil */}
          <nav className="hidden min-w-0 items-center gap-1 overflow-x-auto border-l border-slate-200 pl-3 lg:flex">
            {modulos.map((m) => {
              const I = ICONOS[m.icono] ?? LayoutGrid;
              const act = actual?.id === m.id;
              return (
                <Link
                  key={m.id}
                  href={m.menu[0]?.ruta ?? "/"}
                  title={m.nombre}
                  className={`rounded-lg p-2 transition-colors ${act ? "bg-[var(--color-acento-claro)] text-[var(--color-acento)]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
                >
                  <I size={19} />
                </Link>
              );
            })}
          </nav>
          <div className="relative lg:hidden">
            <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setLanzador(!lanzador)} aria-label="Módulos">
              <LayoutGrid size={20} />
            </button>
            {lanzador && (
              <div className="absolute left-0 top-11 z-50 grid w-72 grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {modulos.map((m) => {
                  const I = ICONOS[m.icono] ?? LayoutGrid;
                  return (
                    <Link key={m.id} href={m.menu[0]?.ruta ?? "/"} onClick={() => setLanzador(false)} className="flex flex-col items-center gap-1 rounded-lg p-2 text-center text-xs text-slate-700 hover:bg-slate-100">
                      <I size={20} />
                      {m.nombre}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <form action={cambiarCentro}>
              <select
                name="centroId"
                defaultValue={centroActivo ?? ""}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="max-w-[11rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm md:max-w-xs"
                aria-label="Centro"
              >
                {centros.length > 1 && <option value="">Todos mis centros ({centros.length})</option>}
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.tipo === "OBRADOR" ? " · obrador" : ""}
                  </option>
                ))}
              </select>
            </form>
            <span className="hidden text-sm text-slate-600 lg:inline">{usuario}</span>
            <form action={salir}>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Salir" aria-label="Salir">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export { raizModulo };
