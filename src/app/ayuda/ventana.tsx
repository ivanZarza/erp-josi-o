"use client";
/**
 * Ventana de ayuda: sigue a la pantalla abierta en el ERP (canal "erp-ayuda"), con índice de todas las
 * pantallas, buscador y botones para repasarlas una a una.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Search, X } from "lucide-react";
import { AYUDA } from "@/ayuda";
import { claveAyuda } from "@/ayuda/rutas";
import type { PaginaAyuda } from "@/ayuda/tipos";
import { CANAL_AYUDA, type MensajeAyuda } from "@/ui/boton-ayuda";

/** Todas las pantallas en orden: por área y, dentro, por ruta. */
const ORDEN = Object.keys(AYUDA).sort((a, b) => AYUDA[a].area.localeCompare(AYUDA[b].area, "es") || a.localeCompare(b));

function sinTildes(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function textoDePagina(p: PaginaAyuda) {
  return sinTildes(
    [p.titulo, p.area, p.paraQue, p.quien, ...(p.logica ?? []), ...(p.comoSeUsa ?? []), ...(p.influye ?? []).map((i) => i.texto),
      ...p.secciones.flatMap((s) => [s.titulo, ...s.campos.flatMap((c) => [c.nombre, c.queEs, c.logica, c.influye])])]
      .filter(Boolean)
      .join(" "),
  );
}

export function VentanaAyuda({ rutaInicial }: { rutaInicial: string }) {
  const [rutaPantalla, setRutaPantalla] = useState(rutaInicial);
  const [seguir, setSeguir] = useState(true);
  const [clave, setClave] = useState<string | null>(() => claveAyuda(rutaInicial, AYUDA));
  const [busqueda, setBusqueda] = useState("");
  const [indice, setIndice] = useState(false);
  const canal = useRef<BroadcastChannel | null>(null);
  const seguirRef = useRef(seguir);
  seguirRef.current = seguir;

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(CANAL_AYUDA);
    canal.current = c;
    c.onmessage = (e: MessageEvent<MensajeAyuda>) => {
      if (e.data.tipo !== "pantalla") return;
      setRutaPantalla(e.data.ruta);
      if (seguirRef.current) {
        setClave(claveAyuda(e.data.ruta, AYUDA));
        setIndice(false);
        setBusqueda("");
      }
    };
    c.postMessage({ tipo: "hola" } satisfies MensajeAyuda);
    return () => c.close();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [clave, indice]);

  const indiceTexto = useMemo(() => Object.fromEntries(ORDEN.map((k) => [k, textoDePagina(AYUDA[k])])), []);
  const resultados = useMemo(() => {
    const palabras = sinTildes(busqueda).split(/\s+/).filter(Boolean);
    if (!palabras.length) return [];
    return ORDEN.filter((k) => palabras.every((p) => indiceTexto[k].includes(p)));
  }, [busqueda, indiceTexto]);

  const elegir = (k: string) => {
    setClave(k);
    setIndice(false);
    setBusqueda("");
    // si se elige a mano otra pantalla, se deja de seguir para no perderla al moverse por el ERP
    if (k !== claveAyuda(rutaPantalla, AYUDA)) setSeguir(false);
  };
  const irEnElErp = (ruta: string) => canal.current?.postMessage({ tipo: "ir", ruta } satisfies MensajeAyuda);

  const pos = clave ? ORDEN.indexOf(clave) : -1;
  const pagina = clave ? AYUDA[clave] : null;

  return (
    <div className="min-h-screen bg-[var(--color-fondo)] text-[15px] leading-relaxed">
      <header className="sticky top-0 z-10 space-y-2 border-b border-borde bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[var(--color-acento)]">Ayuda del ERP</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-suave" title="Al cambiar de pantalla en el ERP, la ayuda cambia sola">
            <input type="checkbox" checked={seguir} onChange={(e) => {
              setSeguir(e.target.checked);
              if (e.target.checked) setClave(claveAyuda(rutaPantalla, AYUDA));
            }} />
            Seguir la pantalla
          </label>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-2.5 top-2.5 text-suave" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar un campo, una palabra…"
              className="w-full rounded-lg border border-borde py-1.5 pl-8 pr-8 text-sm"
            />
            {busqueda && (
              <button className="absolute right-2 top-2 text-suave" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setIndice(!indice)}
            className={`flex items-center gap-1 rounded-lg border px-3 text-sm ${indice ? "border-[var(--color-acento)] bg-[var(--color-acento-claro)] text-[var(--color-acento)]" : "border-borde"}`}
          >
            <BookOpen size={16} /> Índice
          </button>
        </div>
      </header>

      <main className="px-4 py-4">
        {busqueda ? (
          <Resultados claves={resultados} elegir={elegir} />
        ) : indice ? (
          <Indice actual={clave} elegir={elegir} />
        ) : pagina && clave ? (
          <Pagina p={pagina} clave={clave} irEnElErp={irEnElErp} elegir={elegir} />
        ) : (
          <div className="rounded-lg border border-borde bg-white p-4 text-sm">
            <p className="font-medium">Esta pantalla todavía no tiene ayuda.</p>
            <p className="mt-1 text-suave">Pantalla: {rutaPantalla}</p>
            <button className="mt-3 text-[var(--color-acento)] underline" onClick={() => setIndice(true)}>Ver el índice de todas las pantallas</button>
          </div>
        )}
      </main>

      {!busqueda && !indice && pos >= 0 && (
        <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-borde bg-white px-4 py-2 text-sm">
          <button disabled={pos === 0} onClick={() => elegir(ORDEN[pos - 1])} className="flex items-center gap-1 disabled:opacity-30">
            <ArrowLeft size={16} /> Anterior
          </button>
          <span className="text-suave">{pos + 1} de {ORDEN.length}</span>
          <button disabled={pos === ORDEN.length - 1} onClick={() => elegir(ORDEN[pos + 1])} className="flex items-center gap-1 disabled:opacity-30">
            Siguiente <ArrowRight size={16} />
          </button>
        </footer>
      )}
    </div>
  );
}

function Pagina({ p, clave, irEnElErp, elegir }: { p: PaginaAyuda; clave: string; irEnElErp: (r: string) => void; elegir: (k: string) => void }) {
  const fija = !clave.includes("[");
  return (
    <article className="space-y-5">
      <div>
        <span className="rounded bg-[var(--color-acento-claro)] px-2 py-0.5 text-xs font-medium text-[var(--color-acento)]">{p.area}</span>
        <h1 className="mt-2 text-xl font-semibold">{p.titulo}</h1>
        <p className="mt-2">{p.paraQue}</p>
        {p.quien && <p className="mt-2 text-sm text-suave"><b>Quién la usa:</b> {p.quien}</p>}
        {fija && (
          <button onClick={() => irEnElErp(clave)} className="mt-2 flex items-center gap-1 text-sm text-[var(--color-acento)] underline">
            <ExternalLink size={14} /> Abrir esta pantalla en el ERP
          </button>
        )}
      </div>

      {p.comoSeUsa && p.comoSeUsa.length > 0 && (
        <Bloque titulo="Cómo se usa">
          <ol className="list-decimal space-y-1 pl-5">{p.comoSeUsa.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </Bloque>
      )}

      {p.secciones.map((s, i) => (
        <Bloque key={i} titulo={s.titulo}>
          <div className="space-y-3">
            {s.campos.map((c, j) => (
              <div key={j} className="border-l-2 border-borde pl-3">
                <p className="font-semibold">{c.nombre}</p>
                <p>{c.queEs}</p>
                {c.logica && <p className="mt-1 text-sm"><span className="font-medium text-[var(--color-acento)]">Cómo funciona: </span>{c.logica}</p>}
                {c.influye && <p className="mt-1 text-sm"><span className="font-medium text-[var(--color-ok)]">Influye en: </span>{c.influye}</p>}
              </div>
            ))}
          </div>
        </Bloque>
      ))}

      {p.logica && p.logica.length > 0 && (
        <Bloque titulo="Reglas y cálculos">
          <ul className="list-disc space-y-1 pl-5">{p.logica.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Bloque>
      )}

      {p.influye && p.influye.length > 0 && (
        <Bloque titulo="En qué influye">
          <ul className="list-disc space-y-1 pl-5">
            {p.influye.map((t, i) => (
              <li key={i}>
                {t.texto}
                {t.ruta && AYUDA[t.ruta] && (
                  <button onClick={() => elegir(t.ruta!)} className="ml-1 text-sm text-[var(--color-acento)] underline">
                    ({AYUDA[t.ruta].titulo})
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Bloque>
      )}
    </article>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-borde bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</h2>
      {children}
    </section>
  );
}

function Indice({ actual, elegir }: { actual: string | null; elegir: (k: string) => void }) {
  const areas = new Map<string, string[]>();
  for (const k of ORDEN) areas.set(AYUDA[k].area, [...(areas.get(AYUDA[k].area) ?? []), k]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">{ORDEN.length} pantallas con ayuda. Pulsa una para leerla; con «Anterior» y «Siguiente» se repasan todas en orden.</p>
      {[...areas].map(([area, claves]) => (
        <section key={area}>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-suave">{area}</h2>
          <ul className="rounded-lg border border-borde bg-white">
            {claves.map((k) => (
              <li key={k} className="border-b border-borde last:border-0">
                <button onClick={() => elegir(k)} className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${k === actual ? "font-semibold text-[var(--color-acento)]" : ""}`}>
                  {AYUDA[k].titulo}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Resultados({ claves, elegir }: { claves: string[]; elegir: (k: string) => void }) {
  if (!claves.length) return <p className="text-sm text-suave">Ninguna pantalla habla de eso.</p>;
  return (
    <ul className="space-y-2">
      {claves.map((k) => (
        <li key={k}>
          <button onClick={() => elegir(k)} className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-left hover:bg-slate-50">
            <span className="text-xs text-suave">{AYUDA[k].area}</span>
            <span className="block font-medium">{AYUDA[k].titulo}</span>
            <span className="block truncate text-sm text-suave">{AYUDA[k].paraQue}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
