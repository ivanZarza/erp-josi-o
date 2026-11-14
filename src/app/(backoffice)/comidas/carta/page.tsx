import { exigir } from "@/kernel/contexto";
import { euros, numero, porcentaje } from "@/kernel/formato";
import { Boton, BotonEnlace, Cabecera, Campo, Cifra, Entrada, Etiqueta, HuecoIntegracion, Rejilla, Selector, Tabla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { listarPlatos, marcaDelCentroActivo, marcasDeLaCadena } from "@/modulos/comidas/carta-servicio";
import { crearPlato } from "@/modulos/comidas/carta-acciones";
import { AvisoError, listaAlergenos, param, PestanasCarta, unidad, type Busqueda } from "./_comun";

export default async function CartaPlatos({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("comidas", "comidas:carta:ver");
  const sp = await searchParams;
  const marcas = await marcasDeLaCadena(ctx);
  const marcaCentro = await marcaDelCentroActivo(ctx);
  const marcaId = param(sp, "marca") ?? marcaCentro ?? "";
  const q = param(sp, "q") ?? "";
  const verInactivos = param(sp, "inactivos") === "1";
  const platos = await listarPlatos(ctx, { marcaId: marcaId || null, q: q || undefined, incluirInactivos: verInactivos });
  const puedeEditar = ctx.puede("comidas:carta:editar");

  const conCoste = platos.filter((p) => p.coste > 0);
  const pctMedio = conCoste.length ? conCoste.reduce((s, p) => s + p.pctCoste, 0) / conCoste.length : 0;
  const sobre = platos.filter((p) => p.sobreObjetivo).length;
  const sinRevisar = platos.filter((p) => !p.alergenosRevisados || p.faltanAlergenos.length > 0).length;
  const sinEscandallo = platos.filter((p) => p.ingredientes.length === 0).length;

  return (
    <>
      <Cabecera
        titulo="Carta y escandallos"
        subtitulo={
          ctx.centroActivo
            ? `Precios y % de coste de ${ctx.centroActivo.nombre}. Los platos y escandallos son de la marca.`
            : "Platos de cada marca con su escandallo, coste, % de coste sobre precio sin IVA y alérgenos."
        }
      />
      <PestanasCarta activa="/comidas/carta" />
      <AvisoError error={param(sp, "error")} />

      <div className="mb-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Platos" valor={numero(platos.length)} detalle={sinEscandallo ? `${sinEscandallo} sin escandallo` : "Todos con escandallo"} tono={sinEscandallo ? "aviso" : "normal"} />
          <Cifra etiqueta="Coste medio" valor={porcentaje(pctMedio)} detalle="Sobre precio sin IVA" />
          <Cifra etiqueta="Sobre el objetivo" valor={numero(sobre)} detalle="Platos con coste por encima del % de la marca" tono={sobre ? "error" : "ok"} />
          <Cifra etiqueta="Alérgenos por revisar" valor={numero(sinRevisar)} detalle="Los 14 son obligatorios" tono={sinRevisar ? "aviso" : "ok"} />
        </Rejilla>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" action="/comidas/carta">
        <Campo etiqueta="Marca">
          <Selector name="marca" defaultValue={marcaId}>
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} (objetivo {porcentaje(m.objetivo)})
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Buscar">
          <Entrada name="q" defaultValue={q} placeholder="Nombre del plato" />
        </Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={verInactivos} /> Ver retirados
        </label>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[
          { titulo: "Plato" },
          { titulo: "Marca", secundaria: true },
          { titulo: "Precio", alinear: "derecha" },
          { titulo: "Coste", alinear: "derecha" },
          { titulo: "% coste", alinear: "derecha" },
          { titulo: "Alérgenos" },
        ]}
        vacio="No hay platos con este filtro. Crea uno abajo."
        filas={platos.map((p) => ({
          id: p.id,
          tono: p.sobreObjetivo ? ("error" as const) : !p.alergenosRevisados || p.faltanAlergenos.length ? ("aviso" as const) : undefined,
          celdas: [
            <span key="n">
              {p.nombre} {!p.activo && <Etiqueta>Retirado</Etiqueta>} {ctx.centroActivo && !p.disponibleLocal && <Etiqueta>No se sirve aquí</Etiqueta>}
              {p.nombreEn && <span className="block text-xs text-slate-500">{p.nombreEn}</span>}
            </span>,
            p.marca,
            p.precioLocal != null ? (
              <span key="p">
                {euros(p.precioLocal)} <span className="block text-xs text-slate-500">marca {euros(p.precio)}</span>
              </span>
            ) : (
              euros(p.precio)
            ),
            p.ingredientes.length ? euros(p.coste) : <span className="text-slate-500">Sin escandallo</span>,
            p.coste > 0 ? <Etiqueta tono={p.sobreObjetivo ? "error" : "ok"}>{porcentaje(p.pctCoste)}</Etiqueta> : "—",
            !p.alergenosRevisados ? (
              <Etiqueta tono="aviso">Por revisar</Etiqueta>
            ) : p.faltanAlergenos.length ? (
              <Etiqueta tono="error">Faltan {numero(p.faltanAlergenos.length)}</Etiqueta>
            ) : (
              <span className="text-xs">{listaAlergenos(p.alergenos)}</span>
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
              <Tabla
                clave={(l) => l.id}
                filas={p.ingredientes}
                vacio="Sin escandallo: añade los ingredientes en la ficha del plato."
                columnas={[
                  { titulo: "Ingrediente", celda: (l) => (l.elaborado ? `${l.producto} (obrador)` : l.producto) },
                  { titulo: "Neta", alinear: "derecha", celda: (l) => `${numero(l.cantidad, 3)} ${unidad(l.unidad)}` },
                  { titulo: "Merma", alinear: "derecha", celda: (l) => `${numero(l.mermaPct, 1)} %` },
                  { titulo: "Coste", alinear: "derecha", celda: (l) => euros(l.importeMedio) },
                ]}
              />
              <BotonEnlace href={`/comidas/carta/platos/${p.id}`}>{puedeEditar ? "Editar plato y escandallo" : "Ver ficha"}</BotonEnlace>
            </div>
          ),
        }))}
      />

      {puedeEditar && (
        <div className="mt-6">
          <Tarjeta titulo="Nuevo plato">
            <form action={crearPlato} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
              <input type="hidden" name="volver" value="/comidas/carta" />
              <Campo etiqueta="Marca">
                <Selector name="marcaId" defaultValue={marcaId || marcas[0]?.id} required>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nombre (español)">
                <Entrada name="nombre" required placeholder="Entraña a la parrilla" />
              </Campo>
              <Campo etiqueta="Nombre (inglés)">
                <Entrada name="nombreEn" placeholder="Grilled skirt steak" />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Precio (con IVA)">
                  <Entrada name="precio" inputMode="decimal" required placeholder="24,50" />
                </Campo>
                <Campo etiqueta="IVA %">
                  <Entrada name="iva" inputMode="decimal" defaultValue="10" required />
                </Campo>
              </div>
              <Boton type="submit">Crear y hacer el escandallo</Boton>
            </form>
          </Tarjeta>
        </div>
      )}

      <div className="mt-6">
        <HuecoIntegracion nombre="Carta al TPV" descripcion="Los platos y sus precios por local se enviarán al programa de caja" />
      </div>
    </>
  );
}
