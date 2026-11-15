import { exigir } from "@/kernel/contexto";
import { moduloPorId } from "@/kernel/registro";
import { Boton, BotonEnlace, Cabecera, Cifra, Etiqueta, Rejilla, Selector } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { fecha } from "@/kernel/formato";
import { areasActivas, datosExtra, FILTRO_ABIERTOS, listarCentros, listarMarcas, listarSociedades, NOMBRE_ESTADO, NOMBRE_TIPO } from "@/modulos/organizacion/servicio";
import { AvisosPagina, EtiquetaEstado, param, textoHorario, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { ESTADOS_CENTRO } from "@/modulos/organizacion/esquemas";

export default async function CentrosPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:ver");
  const sp = await searchParams;
  const filtro = { estado: param(sp, "estado"), marcaId: param(sp, "marca"), sociedadId: param(sp, "sociedad") };
  const [centros, todos, marcas, sociedades] = await Promise.all([listarCentros(ctx, filtro), listarCentros(ctx), listarMarcas(ctx), listarSociedades(ctx)]);
  const cuenta = (e: string) => todos.filter((c) => c.estado === e).length;

  return (
    <>
      <Cabecera
        titulo="Centros"
        subtitulo={`Locales, obrador y almacenes de ${ctx.tenant.nombre}. Cerrar un centro no borra nada.`}
        acciones={ctx.puede("organizacion:centros:abrir") ? <BotonEnlace href="/organizacion/nuevo-local">Abrir un local nuevo</BotonEnlace> : undefined}
      />
      <AvisosPagina sp={sp} />
      <div className="mb-4">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Abiertos" valor={cuenta("ABIERTO") + cuenta("TEMPORADA")} tono="ok" href={`/organizacion?estado=${FILTRO_ABIERTOS}`} />
          <Cifra etiqueta="En preparación" valor={cuenta("PREPARACION")} tono={cuenta("PREPARACION") ? "aviso" : "normal"} href="/organizacion?estado=PREPARACION" />
          <Cifra etiqueta="Cerrados temporalmente" valor={cuenta("CERRADO_TEMPORAL")} href="/organizacion?estado=CERRADO_TEMPORAL" />
          <Cifra etiqueta="Cerrados" valor={cuenta("CERRADO")} href="/organizacion?estado=CERRADO" />
        </Rejilla>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <Selector name="estado" defaultValue={filtro.estado ?? ""} className="w-auto">
          <option value="">Todos los estados</option>
          <option value={FILTRO_ABIERTOS}>Abiertos y de temporada</option>
          {ESTADOS_CENTRO.map((e) => (
            <option key={e} value={e}>
              {NOMBRE_ESTADO[e]}
            </option>
          ))}
        </Selector>
        <Selector name="marca" defaultValue={filtro.marcaId ?? ""} className="w-auto">
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </Selector>
        <Selector name="sociedad" defaultValue={filtro.sociedadId ?? ""} className="w-auto">
          <option value="">Todas las sociedades</option>
          {sociedades.map((s) => (
            <option key={s.id} value={s.id}>
              {s.razonSocial}
            </option>
          ))}
        </Selector>
        <Boton variante="secundario" type="submit">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Código" }, { titulo: "Nombre" }, { titulo: "Marca", secundaria: true }, { titulo: "Sociedad", secundaria: true }, { titulo: "Estado" }, { titulo: "Ciudad", secundaria: true }]}
        vacio="No hay centros con ese filtro. Para dar de alta uno, pulsa «Abrir un local nuevo»."
        total={`${centros.length} centros`}
        filas={centros.map((c) => {
          const extra = datosExtra(c.datos);
          const areas = areasActivas(c, ctx.contratados);
          return {
            id: c.id,
            tono: c.estado === "PREPARACION" ? ("aviso" as const) : undefined,
            celdas: [
              <span key="c" className="cifra font-medium">{c.codigo}</span>,
              <span key="n">
                {c.nombre} <span className="text-xs text-suave">· {NOMBRE_TIPO[c.tipo]}</span>
              </span>,
              c.marca?.nombre ?? "—",
              c.sociedad?.razonSocial ?? "—",
              <EtiquetaEstado key="e" estado={c.estado} />,
              c.edificio?.ciudad ?? "—",
            ],
            detalle: (
              <div className="space-y-4">
                <DatosDetalle
                  datos={[
                    { etiqueta: "Dirección", valor: c.edificio ? `${c.edificio.direccion}${c.edificio.cp ? `, ${c.edificio.cp}` : ""} ${c.edificio.ciudad}` : "Sin dirección" },
                    { etiqueta: "Teléfono", valor: c.telefono ?? "—" },
                    { etiqueta: "Correo", valor: c.email ?? "—" },
                    { etiqueta: "Apertura", valor: fecha(c.aperturaEn) },
                    { etiqueta: "Horario", valor: textoHorario(extra.horario) },
                    { etiqueta: "Hora de corte", valor: c.horaCorte },
                    { etiqueta: "Productos configurados", valor: c._count.ajustesProducto },
                    { etiqueta: "Usuarios con acceso propio", valor: c._count.ambitos },
                  ]}
                />
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Áreas activas en el centro</div>
                  <div className="flex flex-wrap gap-1">
                    {areas.length ? areas.map((a) => <Etiqueta key={a} tono="info">{moduloPorId(a)?.nombre ?? a}</Etiqueta>) : <span className="text-sm text-suave">Ninguna</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BotonEnlace href={`/organizacion/centros/${c.id}`}>Ver ficha</BotonEnlace>
                  {c.estado === "PREPARACION" && ctx.puede("organizacion:centros:abrir") && (
                    <BotonEnlace href={`/organizacion/nuevo-local/${c.id}`} variante="secundario">
                      Seguir con el asistente
                    </BotonEnlace>
                  )}
                  {c.estado !== "PREPARACION" && ctx.puede("organizacion:centros:cerrar") && (
                    <BotonEnlace href={`/organizacion/centros/${c.id}?pestana=estado`} variante="secundario">
                      Cambiar estado o cerrar
                    </BotonEnlace>
                  )}
                </div>
              </div>
            ),
          };
        })}
      />
    </>
  );
}
