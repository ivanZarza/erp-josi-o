import Link from "next/link";
import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { Aviso, Boton, BotonEnlace, Cabecera, Campo, Entrada, Rejilla, Tarjeta } from "@/ui";
import { DatosDetalle } from "@/ui/tabla-desplegable";
import { guardarSociedadAccion } from "@/modulos/organizacion/acciones";
import { obtenerSociedad } from "@/modulos/organizacion/servicio";
import { CIF_PENDIENTE } from "@/modulos/organizacion/esquemas";
import { AvisosPagina, EtiquetaEstado, type ParametrosPagina } from "@/modulos/organizacion/vistas";

export default async function SociedadPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:ver");
  const { id } = await params;
  const sp = await searchParams;
  const s = await obtenerSociedad(ctx, id).catch(() => null);
  if (!s) notFound();
  const editar = ctx.puede("organizacion:sociedades:editar");

  return (
    <>
      <Cabecera
        titulo={s.razonSocial}
        subtitulo={`CIF ${s.cif}`}
        acciones={
          <BotonEnlace href="/organizacion/sociedades" variante="secundario">
            Volver a sociedades
          </BotonEnlace>
        }
      />
      <AvisosPagina sp={sp} />
      <div className="space-y-4">
        {s.cif === CIF_PENDIENTE && <Aviso tono="aviso">Esta sociedad tiene el CIF pendiente: complétalo para poder usarla en facturas.</Aviso>}
        <Tarjeta titulo="Datos fiscales">
          {editar ? (
            <form action={guardarSociedadAccion} className="space-y-4">
              <input type="hidden" name="sociedadId" value={s.id} />
              <Rejilla columnas={3}>
                <Campo etiqueta="Razón social">
                  <Entrada name="razonSocial" required defaultValue={s.razonSocial} />
                </Campo>
                <Campo etiqueta="CIF" ayuda="Si aún no lo sabes, déjalo en blanco: se guarda como pendiente">
                  <Entrada name="cif" defaultValue={s.cif === CIF_PENDIENTE ? "" : s.cif} />
                </Campo>
                <Campo etiqueta="Correo">
                  <Entrada name="email" type="email" defaultValue={s.email ?? ""} />
                </Campo>
                <Campo etiqueta="Domicilio fiscal">
                  <Entrada name="domicilio" defaultValue={s.domicilio ?? ""} />
                </Campo>
                <Campo etiqueta="Cuenta bancaria (IBAN)" ayuda="En el historial solo se guardan las 4 últimas cifras">
                  <Entrada name="iban" defaultValue={s.iban ?? ""} />
                </Campo>
              </Rejilla>
              <Boton type="submit">Guardar sociedad</Boton>
            </form>
          ) : (
            <DatosDetalle
              datos={[
                { etiqueta: "Razón social", valor: s.razonSocial },
                { etiqueta: "CIF", valor: s.cif },
                { etiqueta: "Domicilio", valor: s.domicilio ?? "—" },
                { etiqueta: "Correo", valor: s.email ?? "—" },
              ]}
            />
          )}
          <p className="mt-3 text-xs text-suave">Series de documentos y programa de contabilidad: los aportará Contabilidad.</p>
        </Tarjeta>
        <Tarjeta titulo={`Centros (${s.centros.length})`}>
          {s.centros.length ? (
            <ul className="divide-y divide-slate-100">
              {s.centros.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/organizacion/centros/${c.id}`} className="text-acento hover:underline">
                    {c.nombre} ({c.codigo})
                  </Link>
                  <EtiquetaEstado estado={c.estado} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Ningún centro factura todavía con esta sociedad.</p>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
