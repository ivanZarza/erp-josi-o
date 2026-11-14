import Link from "next/link";
import { Plus } from "lucide-react";
import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, euros, numero } from "@/kernel/formato";
import { Cabecera, Cifra, BotonEnlace, Boton, Entrada, Selector, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarSolicitudes, marcasYLocales, estadosSiguientes, NOMBRE_ESTADO, NOMBRE_TIPO, ORDEN_EMBUDO, type EstadoEvento, type TipoEvento } from "@/modulos/eventos/servicio";
import { cambiarEstadoAccion } from "@/modulos/eventos/acciones";
import { AvisosUrl, EtiquetaEstadoEvento, PestanasEventos, param, type Busqueda } from "@/modulos/eventos/ui";

export default async function Solicitudes({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("eventos", "eventos:ver");
  const sp = await searchParams;
  const estado = param(sp, "estado");
  const tipo = param(sp, "tipo");
  const q = param(sp, "q");
  const [{ solicitudes, embudo }, { marcas, locales }] = await Promise.all([listarSolicitudes(ctx, { estado, tipo, q }), marcasYLocales(ctx)]);
  const puedeGestionar = ctx.puede("eventos:gestionar");
  const nombreMarca = Object.fromEntries(marcas.map((m) => [m.id, m.nombre]));
  const nombreLocal = Object.fromEntries(locales.map((l) => [l.id, l.nombre]));
  const enlace = (e?: string) => {
    const p = new URLSearchParams();
    if (e) p.set("estado", e);
    if (tipo) p.set("tipo", tipo);
    if (q) p.set("q", q);
    return `/eventos${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <Cabecera
        titulo="Eventos y grupos"
        subtitulo="Todas las solicitudes de grupos, empresas, Navidad y catering del grupo"
        acciones={puedeGestionar ? <BotonEnlace href="/eventos/nueva"><Plus size={16} className="mr-1" />Nueva solicitud</BotonEnlace> : undefined}
      />
      <PestanasEventos activa="/eventos" puedeGestionar={puedeGestionar} />
      <AvisosUrl sp={sp} />

      {/* Embudo: una cifra por estado; pulsar filtra */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...ORDEN_EMBUDO, "PERDIDA" as EstadoEvento].map((e) => (
          <Cifra
            key={e}
            href={enlace(estado === e ? undefined : e)}
            etiqueta={NOMBRE_ESTADO[e]}
            valor={numero(embudo[e]?.n ?? 0)}
            detalle={`${numero(embudo[e]?.personas ?? 0)} personas${estado === e ? " · filtrado" : ""}`}
            tono={e === "PERDIDA" ? "error" : e === "ACEPTADA" ? "ok" : e === "NUEVA" && (embudo.NUEVA?.n ?? 0) > 0 ? "aviso" : "normal"}
          />
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <Entrada name="q" defaultValue={q} placeholder="Buscar por contacto, empresa o número" className="w-72" />
        <Selector name="tipo" defaultValue={tipo ?? ""} className="w-44">
          <option value="">Todos los tipos</option>
          {Object.entries(NOMBRE_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selector>
        <Boton variante="secundario" type="submit">Filtrar</Boton>
        {(estado || tipo || q) && <BotonEnlace variante="secundario" href="/eventos">Quitar filtros</BotonEnlace>}
      </form>

      <TablaDesplegable
        columnas={[
          { titulo: "Número" },
          { titulo: "Fecha" },
          { titulo: "Contacto" },
          { titulo: "Tipo", secundaria: true },
          { titulo: "Pers.", alinear: "derecha" },
          { titulo: "Local / marca", secundaria: true },
          { titulo: "Presupuesto", alinear: "derecha", secundaria: true },
          { titulo: "Estado" },
        ]}
        vacio={puedeGestionar ? <>No hay solicitudes con estos filtros. <Link className="text-acento underline" href="/eventos/nueva">Crea una</Link>.</> : "No hay solicitudes con estos filtros."}
        filas={solicitudes.map((s) => {
          const ultimo = s.presupuestos[0];
          return {
            id: s.id,
            tono: s.estado === "NUEVA" ? ("aviso" as const) : undefined,
            celdas: [
              <Link key="n" href={`/eventos/${s.id}`} className="font-medium text-acento hover:underline">{s.numero}</Link>,
              s.fecha ? `${fecha(s.fecha)}${s.hora ? ` ${s.hora}` : ""}` : "Sin fecha",
              <span key="c">{s.nombreContacto}{s.empresa && <span className="text-suave"> · {s.empresa}</span>}</span>,
              NOMBRE_TIPO[s.tipo as TipoEvento],
              numero(s.personas),
              s.centroId ? nombreLocal[s.centroId] ?? "—" : s.marcaId ? nombreMarca[s.marcaId] : s.recomiendame ? <Etiqueta key="r" tono="info">Recomendar</Etiqueta> : "—",
              ultimo ? euros(ultimo.total) : s.presupuestoCliente ? <span className="text-suave">{euros(s.presupuestoCliente)}*</span> : "—",
              <EtiquetaEstadoEvento key="e" estado={s.estado} />,
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Teléfono", valor: s.telefono ?? "—" },
                    { etiqueta: "Correo", valor: s.email ?? "—" },
                    { etiqueta: "Origen", valor: s.origen },
                    { etiqueta: "Marca", valor: s.marcaId ? nombreMarca[s.marcaId] : "—" },
                    { etiqueta: "Lo que quiere gastar", valor: s.presupuestoCliente ? euros(s.presupuestoCliente) : "—" },
                    { etiqueta: "Último presupuesto", valor: ultimo ? `${ultimo.numero} (v${ultimo.version}) · ${euros(ultimo.total)}` : "—" },
                    { etiqueta: "Motivo de pérdida", valor: s.motivoPerdida ?? "—" },
                    { etiqueta: "Recibida", valor: fechaHora(s.createdAt) },
                  ]}
                />
                {s.notas && <p className="whitespace-pre-line text-sm text-suave">{s.notas}</p>}
                <div className="flex flex-wrap items-end gap-2">
                  <BotonEnlace href={`/eventos/${s.id}`}>Abrir y presupuestar</BotonEnlace>
                  {puedeGestionar &&
                    estadosSiguientes(s.estado)
                      .filter((e) => e !== "PERDIDA")
                      .map((e) => (
                        <form key={e} action={cambiarEstadoAccion}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="estado" value={e} />
                          <input type="hidden" name="volver" value={enlace(estado)} />
                          <Boton type="submit" variante="secundario">Pasar a «{NOMBRE_ESTADO[e]}»</Boton>
                        </form>
                      ))}
                </div>
              </div>
            ),
          };
        })}
      />
      <p className="mt-2 text-xs text-suave">* Presupuesto indicado por el cliente (todavía sin presupuesto nuestro).</p>
    </>
  );
}
