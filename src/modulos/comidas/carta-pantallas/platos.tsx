/**
 * Pantalla principal de la carta de un área (Comidas: platos; Bebidas: vinos, copas, cafés…).
 * Se entra por la sección (tarjetas arriba) y no por una lista alfabética. Respeta el local elegido
 * arriba: con un local, solo sus cartas y las de su marca; sin local, todo lo de mis locales.
 */
import { euros, numero, porcentaje } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, HuecoIntegracion, Rejilla, Selector, Tabla, Tarjeta, Vacio } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { alcanceCarta, cartaPorSecciones, localesVisibles, marcasDeLaCadena, type AreaCarta, type ResumenPlato } from "../carta-servicio";
import { crearPlato } from "../carta-acciones";
import { AREA, AvisoError, exigirCarta, listaAlergenos, param, permisoEditar, PestanasCarta, TarjetaEntrada, unidad, type Busqueda } from "./comun";

const MUCHOS = 80;

function textoFormato(f: { nombre: string; centilitros: number | null }) {
  return f.centilitros ? `${f.nombre} (${numero(f.centilitros, 1)} cl)` : f.nombre;
}

export async function PaginaCarta({ area, searchParams }: { area: AreaCarta; searchParams: Busqueda }) {
  const ctx = await exigirCarta(area);
  const A = AREA[area];
  const sp = await searchParams;
  const [al, marcas] = await Promise.all([alcanceCarta(ctx), marcasDeLaCadena(ctx)]);
  const marcaId = al.centroId ? (al.marcaId ?? "") : (param(sp, "marca") ?? "");
  const q = param(sp, "q") ?? "";
  const verInactivos = param(sp, "inactivos") === "1";
  const pedida = param(sp, "seccion");
  const { grupos, platos } = await cartaPorSecciones(ctx, area, { marcaId: marcaId || null, q: q || undefined, incluirInactivos: verInactivos });
  const puedeEditar = ctx.puede(permisoEditar(area));
  const locales = puedeEditar ? await localesVisibles(ctx) : [];

  const conCoste = platos.filter((p) => p.coste > 0);
  const pctMedio = conCoste.length ? conCoste.reduce((s, p) => s + p.pctCoste, 0) / conCoste.length : 0;
  const sobre = platos.filter((p) => p.sobreObjetivo).length;
  const sinRevisar = platos.filter((p) => !p.alergenosRevisados || p.faltanAlergenos.length > 0).length;
  const sinEscandallo = platos.filter((p) => p.ingredientes.length === 0).length;
  // Con muchos platos se entra por la primera sección (pintarlos todos a la vez es lento); «Todas» sigue a un clic
  const seccion = pedida === "todas" ? "" : (pedida ?? (platos.length > MUCHOS && !q ? (grupos[0]?.clave ?? "") : ""));
  const variasCartas = new Set(grupos.map((g) => g.carta).filter(Boolean)).size > 1;

  const enlace = (s: string) => {
    const u = new URLSearchParams();
    if (s) u.set("seccion", s);
    if (q) u.set("q", q);
    if (!al.centroId && marcaId) u.set("marca", marcaId);
    if (verInactivos) u.set("inactivos", "1");
    const t = u.toString();
    return t ? `${A.base}?${t}` : A.base;
  };
  const mostrados = seccion ? grupos.filter((g) => g.clave === seccion) : grupos;

  const columnas = [
    { titulo: A.Plato },
    ...(al.centroId ? [] : [{ titulo: "Marca", secundaria: true }]),
    { titulo: area === "BEBIDAS" ? "Formatos y precio" : "Precio", alinear: "derecha" as const },
    { titulo: "Coste", alinear: "derecha" as const },
    { titulo: "% coste", alinear: "derecha" as const },
    { titulo: "Alérgenos", secundaria: area === "BEBIDAS" },
  ];

  const fila = (p: ResumenPlato, clave: string) => ({
    id: `${clave}-${p.id}`,
    tono: p.sobreObjetivo ? ("error" as const) : !p.alergenosRevisados || p.faltanAlergenos.length ? ("aviso" as const) : undefined,
    celdas: [
      <span key="n">
        {p.nombre} {!p.activo && <Etiqueta>Retirado</Etiqueta>} {al.centroId && !p.disponibleLocal && <Etiqueta>No se sirve aquí</Etiqueta>}
        {p.local && <Etiqueta tono="info">Solo {p.local}</Etiqueta>}
        {p.etiquetas.includes("bajo demanda") && <Etiqueta tono="info">Bajo demanda</Etiqueta>}
        {p.descripcion && <span className="block max-w-md truncate text-xs text-slate-500">{p.descripcion}</span>}
      </span>,
      ...(al.centroId ? [] : [<span key="m">{p.marca}</span>]),
      p.formatos.length ? (
        <span key="f" className="inline-flex flex-col items-end gap-0.5">
          {p.formatos.map((f) => (
            <span key={f.id} className="whitespace-nowrap">
              <span className="text-xs text-slate-500">{textoFormato(f)}</span> {euros(f.precio)}
            </span>
          ))}
        </span>
      ) : p.precioLocal != null ? (
        <span key="p">
          {euros(p.precioLocal)} <span className="block text-xs text-slate-500">marca {euros(p.precio)}</span>
        </span>
      ) : (
        euros(p.precio)
      ),
      p.ingredientes.length ? euros(p.coste) : <span key="c" className="text-slate-500">Sin escandallo</span>,
      p.coste > 0 ? <Etiqueta key="pc" tono={p.sobreObjetivo ? "error" : "ok"}>{porcentaje(p.pctCoste)}</Etiqueta> : "—",
      !p.alergenosRevisados ? (
        <Etiqueta key="a" tono="aviso">Por revisar</Etiqueta>
      ) : p.faltanAlergenos.length ? (
        <Etiqueta key="a" tono="error">Faltan {numero(p.faltanAlergenos.length)}</Etiqueta>
      ) : (
        <span key="a" className="text-xs">{listaAlergenos(p.alergenos)}</span>
      ),
    ],
    detalle: (
      <div className="space-y-4">
        <DatosDetalle
          datos={[
            { etiqueta: "IVA", valor: porcentaje(p.iva) },
            { etiqueta: "Objetivo de la marca", valor: porcentaje(p.objetivo) },
            { etiqueta: "Coste al último precio", valor: euros(p.costeUltimo) },
            { etiqueta: "Margen bruto", valor: euros((p.precioLocal ?? p.precio) / (1 + p.iva / 100) - p.coste) },
            { etiqueta: "Alérgenos declarados", valor: listaAlergenos(p.alergenos) },
            { etiqueta: "Trazas", valor: listaAlergenos(p.trazas) },
            { etiqueta: "Del escandallo sin declarar", valor: p.faltanAlergenos.length ? listaAlergenos(p.faltanAlergenos) : "—" },
            { etiqueta: "En cartas", valor: p.enCartas.length ? p.enCartas.join(", ") : "En ninguna carta" },
          ]}
        />
        {p.formatos.length > 0 && (
          <Tabla
            clave={(f) => f.id}
            filas={p.formatos}
            columnas={[
              { titulo: "Formato", celda: (f) => textoFormato(f) },
              { titulo: "Precio", alinear: "derecha", celda: (f) => euros(f.precio) },
              { titulo: "Coste", alinear: "derecha", celda: (f) => euros(f.coste) },
              { titulo: "% coste", alinear: "derecha", celda: (f) => (f.coste > 0 ? <Etiqueta tono={f.sobreObjetivo ? "error" : "ok"}>{porcentaje(f.pctCoste)}</Etiqueta> : "—") },
            ]}
          />
        )}
        <Tabla
          clave={(l) => l.id}
          filas={p.ingredientes}
          vacio="Sin escandallo: añade los ingredientes en la ficha."
          columnas={[
            { titulo: "Ingrediente", celda: (l) => (l.elaborado ? `${l.producto} (obrador)` : l.producto) },
            { titulo: "Neta", alinear: "derecha", celda: (l) => `${numero(l.cantidad, 3)} ${unidad(l.unidad)}` },
            { titulo: "Merma", alinear: "derecha", celda: (l) => `${numero(l.mermaPct, 1)} %` },
            { titulo: "Coste", alinear: "derecha", celda: (l) => euros(l.importeMedio) },
          ]}
        />
        <BotonEnlace href={`${A.base}/platos/${p.id}`}>{puedeEditar ? `Editar ${A.plato}, formatos y escandallo` : "Ver ficha"}</BotonEnlace>
      </div>
    ),
  });

  const localesMarca = locales.filter((l) => !marcaId || l.marcaId === marcaId);

  return (
    <>
      <Cabecera
        titulo={A.titulo}
        subtitulo={
          al.centroId
            ? `${al.centroNombre}: sus cartas y las de su marca. Precio, coste y % de coste de cada ${A.plato}.`
            : `Todos tus locales. Elige un local arriba para ver solo su carta.`
        }
      />
      <PestanasCarta activa={A.base} area={area} />
      <AvisoError error={param(sp, "error")} />

      <div className="mb-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta={A.platos[0].toUpperCase() + A.platos.slice(1)} valor={numero(platos.length)} detalle={sinEscandallo ? `${sinEscandallo} sin escandallo` : "Todos con escandallo"} tono={sinEscandallo ? "aviso" : "normal"} />
          <Cifra etiqueta="Coste medio" valor={porcentaje(pctMedio)} detalle="Sobre precio sin IVA" />
          <Cifra etiqueta="Sobre el objetivo" valor={numero(sobre)} detalle={`Con coste por encima del % de la marca`} tono={sobre ? "error" : "ok"} />
          <Cifra etiqueta="Alérgenos por revisar" valor={numero(sinRevisar)} detalle="Los 14 son obligatorios" tono={sinRevisar ? "aviso" : "ok"} />
        </Rejilla>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Secciones</h2>
      {grupos.length === 0 ? (
        <div className="mb-4">
          <Vacio>
            {al.centroId ? `${al.centroNombre} no tiene ${A.platos} en sus cartas ni en las de su marca.` : `No hay ${A.platos} con este filtro.`} Crea una sección en «Cartas» y añade {A.platos} abajo.
          </Vacio>
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <TarjetaEntrada href={enlace(platos.length > MUCHOS ? "todas" : "")} titulo="Todas" subtitulo={`${numero(grupos.length)} secciones`} detalle={`${numero(platos.length)} ${A.platos}`} activa={!seccion} />
          {grupos.map((g) => {
            const sobreG = g.platos.filter((p) => p.sobreObjetivo).length;
            const revisar = g.platos.filter((p) => !p.alergenosRevisados || p.faltanAlergenos.length).length;
            return (
              <TarjetaEntrada
                key={g.clave}
                href={enlace(g.clave)}
                titulo={g.nombre}
                subtitulo={variasCartas ? g.carta : null}
                detalle={`${numero(g.platos.length)} ${A.platos}${sobreG ? ` · ${numero(sobreG)} caros` : ""}`}
                activa={seccion === g.clave}
                tono={sobreG ? "error" : revisar ? "aviso" : undefined}
              />
            );
          })}
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3" action={A.base}>
        {seccion && <input type="hidden" name="seccion" value={seccion} />}
        {!al.centroId && (
          <Campo etiqueta="Marca">
            <Selector name="marca" defaultValue={marcaId}>
              <option value="">Todas las marcas</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} (objetivo {porcentaje(area === "BEBIDAS" ? m.objetivoBebidas : m.objetivo)})
                </option>
              ))}
            </Selector>
          </Campo>
        )}
        <Campo etiqueta="Buscar">
          <Entrada name="q" defaultValue={q} placeholder={`Nombre ${area === "BEBIDAS" ? "de la bebida" : "del plato"}`} />
        </Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={verInactivos} /> Ver retirados
        </label>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <div className="space-y-6">
        {mostrados.map((g) => (
          <section key={g.clave}>
            <h2 className="mb-2 flex flex-wrap items-baseline gap-2 text-base font-semibold text-tinta">
              {g.nombre}
              {g.carta && <span className="text-xs font-normal text-suave">{g.carta}</span>}
            </h2>
            <TablaDesplegable columnas={columnas} vacio={`La sección no tiene ${A.platos}: añádelos en «Cartas».`} total={`${numero(g.platos.length)} ${A.platos}`} filas={g.platos.map((p) => fila(p, g.clave))} />
          </section>
        ))}
      </div>

      {puedeEditar && (
        <div className="mt-6">
          <Tarjeta titulo={area === "BEBIDAS" ? "Nueva bebida" : "Nuevo plato"}>
            <form action={crearPlato} className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
              <input type="hidden" name="volver" value={A.base} />
              <input type="hidden" name="area" value={area} />
              {al.centroId && al.marcaId ? (
                <input type="hidden" name="marcaId" value={al.marcaId} />
              ) : (
                <Campo etiqueta="Marca">
                  <Selector name="marcaId" defaultValue={marcaId || marcas[0]?.id} required>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
              <Campo etiqueta="Para" ayuda="Solo un local: no sale en la carta de los demás locales de la marca">
                <Selector name="centroId" defaultValue={al.centroId ?? ""}>
                  <option value="">Toda la marca</option>
                  {localesMarca.map((l) => (
                    <option key={l.id} value={l.id}>
                      Solo {l.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre (español)">
                <Entrada name="nombre" required placeholder={A.ejemploNombre} />
              </Campo>
              <Campo etiqueta="Nombre (inglés)">
                <Entrada name="nombreEn" placeholder={A.ejemploNombreEn} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Precio (con IVA)">
                  <Entrada name="precio" inputMode="decimal" required placeholder="24,50" />
                </Campo>
                <Campo etiqueta="IVA %">
                  <Entrada name="iva" inputMode="decimal" defaultValue="10" required />
                </Campo>
              </div>
              <Boton type="submit">{area === "BEBIDAS" ? "Crear y poner formatos y escandallo" : "Crear y hacer el escandallo"}</Boton>
            </form>
          </Tarjeta>
        </div>
      )}

      <div className="mt-6">
        <HuecoIntegracion nombre="Carta al TPV" descripcion={`Los ${A.platos}, sus formatos y sus precios por local se enviarán al programa de caja`} />
      </div>
    </>
  );
}
