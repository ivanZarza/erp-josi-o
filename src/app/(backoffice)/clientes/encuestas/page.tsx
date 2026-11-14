import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Boton, BotonEnlace, Entrada, Selector, Etiqueta, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarEncuestas, NOTA_AVISO, NOTA_RESENA } from "@/modulos/clientes/servicio";
import { responderEncuestaAccion, gestionarEncuestaAccion } from "@/modulos/clientes/acciones";
import { AvisosUrl, PestanasClientes, Estrellas, param, type Busqueda } from "@/modulos/clientes/ui";

const ESTADOS = { PENDIENTE: "Sin respuesta", RESPONDIDA: "Respondida", GESTIONADA: "Gestionada" } as const;

export default async function Encuestas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("clientes", "clientes:ver");
  const sp = await searchParams;
  const estado = param(sp, "estado");
  const { encuestas, media, respuestas } = await listarEncuestas(ctx, estado);
  const puede = ctx.puede("clientes:editar");
  const nombreCentro = Object.fromEntries(ctx.centros.map((c) => [c.id, c.nombre]));
  const bajasSinGestionar = encuestas.filter((e) => e.avisoGerencia && e.estado === "RESPONDIDA").length;
  const invitaciones = encuestas.filter((e) => e.invitadoResena).length;

  return (
    <>
      <Cabecera titulo="Encuestas tras la visita" subtitulo={`Nota de 1 a 5. ${NOTA_RESENA} o más: se invita a dejar reseña en Google. ${NOTA_AVISO} o menos: aviso a gerencia.`} />
      <PestanasClientes activa="/clientes/encuestas" />
      <AvisosUrl sp={sp} />
      <div className="mb-6">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Nota media" valor={media === null ? "—" : `${numero(media, 1)} / 5`} detalle={`${numero(respuestas)} respuestas`} tono={media === null ? "normal" : media >= 4 ? "ok" : media <= 2.5 ? "error" : "aviso"} />
          <Cifra etiqueta="Sin respuesta" valor={numero(encuestas.filter((e) => e.estado === "PENDIENTE").length)} href="/clientes/encuestas?estado=PENDIENTE" />
          <Cifra etiqueta="Notas bajas por atender" valor={numero(bajasSinGestionar)} tono={bajasSinGestionar ? "error" : "ok"} href="/clientes/encuestas?estado=RESPONDIDA" />
          <Cifra etiqueta="Invitados a reseña" valor={numero(invitaciones)} />
        </Rejilla>
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <Selector name="estado" defaultValue={estado ?? ""} className="w-48">
          <option value="">Todas</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selector>
        <Boton variante="secundario" type="submit">Filtrar</Boton>
        {estado && <BotonEnlace variante="secundario" href="/clientes/encuestas">Quitar filtro</BotonEnlace>}
      </form>
      <TablaDesplegable
        columnas={[{ titulo: "Enviada" }, { titulo: "Cliente" }, { titulo: "Local", secundaria: true }, { titulo: "Nota" }, { titulo: "Siguiente paso" }, { titulo: "Estado" }]}
        vacio="No hay encuestas. Se crean solas cuando una reserva pasa a «Terminada»."
        filas={encuestas.map((e) => ({
          id: e.id,
          tono: e.avisoGerencia && e.estado === "RESPONDIDA" ? ("error" as const) : undefined,
          celdas: [
            fecha(e.enviadaEn),
            e.cliente ? <Link key="c" href={`/clientes/${e.cliente.id}`} className="text-acento hover:underline">{e.cliente.nombre} {e.cliente.apellidos ?? ""}</Link> : "Anónima",
            nombreCentro[e.centroId] ?? "—",
            <Estrellas key="n" nota={e.nota} />,
            e.invitadoResena ? <Etiqueta key="s" tono="ok">Reseña en Google</Etiqueta> : e.avisoGerencia ? <Etiqueta key="s" tono="error">Aviso a gerencia</Etiqueta> : "—",
            <Etiqueta key="e" tono={e.estado === "PENDIENTE" ? "aviso" : e.estado === "GESTIONADA" ? "ok" : "normal"}>{ESTADOS[e.estado]}</Etiqueta>,
          ],
          detalle: (
            <div className="space-y-3">
              <DatosDetalle
                datos={[
                  { etiqueta: "Comentario", valor: e.comentario ?? "—" },
                  { etiqueta: "Respondida", valor: fechaHora(e.respondidaEn) },
                  { etiqueta: "Teléfono", valor: e.cliente?.telefono ?? "—" },
                  { etiqueta: "Seguimiento", valor: e.seguimiento ?? "—" },
                ]}
              />
              {puede && e.estado === "PENDIENTE" && (
                <form action={responderEncuestaAccion} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <Selector name="nota" defaultValue="5" className="w-24">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Selector>
                  <Entrada name="comentario" placeholder="Comentario del cliente" className="w-80" />
                  <Boton type="submit">Apuntar respuesta</Boton>
                </form>
              )}
              {puede && e.estado === "RESPONDIDA" && e.avisoGerencia && (
                <form action={gestionarEncuestaAccion} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <Entrada name="seguimiento" placeholder="Qué se ha hecho: llamada, invitación…" className="w-96" required />
                  <Boton type="submit">Marcar como gestionada</Boton>
                </form>
              )}
            </div>
          ),
        }))}
      />
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HuecoIntegracion nombre="WhatsApp" descripcion="La encuesta se enviará sola al día siguiente de la visita y la respuesta llegará aquí" />
        <HuecoIntegracion nombre="Reseñas de Google" descripcion="Con nota alta se mandará el enlace de reseña del local; aquí se verán la nota y las reseñas de Google por local y mes" />
      </div>
    </>
  );
}
