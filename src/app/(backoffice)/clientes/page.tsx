import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { exigir } from "@/kernel/contexto";
import { fecha, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Boton, BotonEnlace, Entrada, Selector, Etiqueta, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarClientes, etiquetasUsadas } from "@/modulos/clientes/servicio";
import { AvisosUrl, PestanasClientes, EtiquetaConsentimiento, param, type Busqueda } from "@/modulos/clientes/ui";

export default async function Clientes({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("clientes", "clientes:ver");
  const sp = await searchParams;
  const q = param(sp, "q");
  const etiqueta = param(sp, "etiqueta");
  const [{ total, clientes }, etiquetas] = await Promise.all([listarClientes(ctx, { q, etiqueta, take: 200 }), etiquetasUsadas(ctx)]);
  const conCorreo = clientes.filter((c) => c.vigentes.CORREO?.otorgado).length;
  const conWhatsapp = clientes.filter((c) => c.vigentes.WHATSAPP?.otorgado).length;
  const conAlergias = clientes.filter((c) => c.alergias).length;

  return (
    <>
      <Cabecera
        titulo="Clientes"
        subtitulo="Un cliente para todo el grupo, con sus visitas en cada local"
        acciones={
          <>
            {ctx.puede("clientes:exportar") && (
              <a href="/clientes/exportar" className="inline-flex min-h-10 items-center justify-center rounded-md border border-borde bg-white px-4 text-sm font-medium hover:bg-stone-50">
                <Download size={16} className="mr-1" /> Exportar CSV
              </a>
            )}
            {ctx.puede("clientes:editar") && <BotonEnlace href="/clientes/nuevo"><Plus size={16} className="mr-1" />Nuevo cliente</BotonEnlace>}
          </>
        }
      />
      <PestanasClientes activa="/clientes" />
      <AvisosUrl sp={sp} />

      <div className="mb-6">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Clientes encontrados" valor={numero(total)} detalle={clientes.length < total ? `se muestran ${numero(clientes.length)}` : undefined} />
          <Cifra etiqueta="Aceptan correo" valor={numero(conCorreo)} detalle="de los mostrados" />
          <Cifra etiqueta="Aceptan WhatsApp" valor={numero(conWhatsapp)} detalle="de los mostrados" />
          <Cifra etiqueta="Con alergias" valor={numero(conAlergias)} tono={conAlergias ? "aviso" : "normal"} />
        </Rejilla>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Entrada name="q" defaultValue={q} placeholder="Nombre, teléfono o correo" className="w-72" />
        <Selector name="etiqueta" defaultValue={etiqueta ?? ""} className="w-44">
          <option value="">Todas las etiquetas</option>
          {etiquetas.map((e) => <option key={e} value={e}>{e}</option>)}
        </Selector>
        <Boton variante="secundario" type="submit">Buscar</Boton>
        {(q || etiqueta) && <BotonEnlace variante="secundario" href="/clientes">Quitar filtros</BotonEnlace>}
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Cliente" }, { titulo: "Teléfono" }, { titulo: "Correo", secundaria: true }, { titulo: "Visitas", alinear: "derecha" }, { titulo: "Última visita", secundaria: true }, { titulo: "Etiquetas", secundaria: true }]}
        total={`${numero(total)} clientes`}
        vacio={q ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes. Se crean solos con cada reserva o desde «Nuevo cliente»."}
        filas={clientes.map((c) => ({
          id: c.id,
          celdas: [
            <Link key="n" href={`/clientes/${c.id}`} className="font-medium text-acento hover:underline">{c.nombre} {c.apellidos ?? ""}</Link>,
            c.telefono ?? "—",
            c.email ?? "—",
            numero(c.visitas),
            fecha(c.ultimaVisita),
            <span key="e" className="flex flex-wrap gap-1">{c.etiquetas.map((e) => <Etiqueta key={e} tono={e === "VIP" ? "info" : "normal"}>{e}</Etiqueta>)}</span>,
          ],
          detalle: (
            <div className="space-y-3">
              <DatosDetalle
                datos={[
                  { etiqueta: "Alergias", valor: c.alergias ? <span className="text-error">{c.alergias}</span> : "—" },
                  { etiqueta: "Preferencias", valor: c.preferencias ?? "—" },
                  { etiqueta: "Notas de sala", valor: c.notas ?? "—" },
                  { etiqueta: "Origen", valor: c.origen },
                  { etiqueta: "Consentimiento reserva", valor: <EtiquetaConsentimiento c={c.vigentes.RESERVA} /> },
                  { etiqueta: "Correo comercial", valor: <EtiquetaConsentimiento c={c.vigentes.CORREO} /> },
                  { etiqueta: "WhatsApp comercial", valor: <EtiquetaConsentimiento c={c.vigentes.WHATSAPP} /> },
                  { etiqueta: "Alta", valor: fecha(c.createdAt) },
                ]}
              />
              <BotonEnlace href={`/clientes/${c.id}`}>Abrir ficha</BotonEnlace>
            </div>
          ),
        }))}
      />

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HuecoIntegracion nombre="Brevo" descripcion="Los clientes que aceptan correo comercial se enviarán a las listas de Brevo por marca y local para los boletines" />
        <HuecoIntegracion nombre="WhatsApp" descripcion="Confirmación y recordatorio de reservas, y encuesta tras la visita por WhatsApp" />
        <HuecoIntegracion nombre="Reseñas de Google" descripcion="Nota y número de reseñas de cada local por mes, con aviso de las reseñas malas" />
      </div>
    </>
  );
}
