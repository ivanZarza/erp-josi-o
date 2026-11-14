import { exigir } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { Cabecera, Aviso, HuecoIntegracion, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";

/**
 * Webs (fase 3, specs: docs/specs/modulos/webs/README.md y general/02_marca_marketing.md §3–§5).
 * De momento muestra qué webs y páginas generará el ERP con los datos que ya tiene.
 */
export default async function Webs() {
  const ctx = await exigir("webs", "webs:ver");
  const prisma = await db();
  const marcas = await prisma.marca.findMany({
    where: { tenantId: ctx.tenant.id, activo: true },
    include: { centros: { where: { estado: { notIn: ["CERRADO"] } }, include: { edificio: true }, orderBy: { nombre: "asc" } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <Cabecera titulo="Webs" subtitulo="Web del grupo, una web por marca y una página por local, generadas con los datos del ERP." />
      <div className="mb-4 space-y-3">
        <Aviso titulo="Módulo en preparación (fase 3)">
          Las webs se generarán con Astro y se publicarán en Cloudflare. Leerán del ERP la dirección, el horario, los espacios, la carta y los alérgenos de cada local,
          para que no haya datos distintos entre webs, PDF y Google. Abajo tienes las páginas que saldrán con lo que ya hay en el ERP.
        </Aviso>
        <HuecoIntegracion nombre="Publicación" descripcion="Generar y publicar las webs en Cloudflare a partir de los datos del ERP" />
      </div>
      <TablaDesplegable
        columnas={[{ titulo: "Marca" }, { titulo: "Web" }, { titulo: "Locales", alinear: "derecha" }, { titulo: "Estado" }]}
        filas={marcas.map((m) => ({
          id: m.id,
          celdas: [m.nombre, m.web ?? "—", m.centros.length, <Etiqueta key="e" tono="aviso">Por generar</Etiqueta>],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Concepto", valor: m.concepto },
                  { etiqueta: "Lema", valor: m.lema },
                  { etiqueta: "Instagram", valor: m.instagram },
                  { etiqueta: "Colores", valor: [m.colorPrincipal, m.colorFondo].filter(Boolean).join(" · ") || "—" },
                ]}
              />
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Páginas que se generarán</div>
                <ul className="space-y-1 text-sm">
                  <li>/ · /carta · /locales · /eventos · /historia · /contacto</li>
                  {m.centros.map((c) => (
                    <li key={c.id}>
                      /{c.codigo.toLowerCase()} — {c.nombre} ({c.edificio?.direccion ?? "sin dirección"}) · /{c.codigo.toLowerCase()}/reservar
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ),
        }))}
        vacio="No hay marcas activas."
      />
    </>
  );
}
