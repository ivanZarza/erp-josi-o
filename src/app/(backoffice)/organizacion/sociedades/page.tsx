import { exigir } from "@/kernel/contexto";
import { Boton, BotonEnlace, Cabecera, Campo, Entrada, Etiqueta, Rejilla, Tarjeta } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { activarSociedadAccion, guardarSociedadAccion } from "@/modulos/organizacion/acciones";
import { listarSociedades } from "@/modulos/organizacion/servicio";
import { AvisosPagina, type ParametrosPagina } from "@/modulos/organizacion/vistas";

export default async function SociedadesPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("organizacion", "organizacion:ver");
  const sp = await searchParams;
  const sociedades = await listarSociedades(ctx);
  const editar = ctx.puede("organizacion:sociedades:editar");

  return (
    <>
      <Cabecera titulo="Sociedades" subtitulo="Empresas del grupo: cada centro factura con una." />
      <AvisosPagina sp={sp} />
      <TablaDesplegable
        columnas={[{ titulo: "Razón social" }, { titulo: "CIF" }, { titulo: "Centros", alinear: "derecha" }, { titulo: "Estado" }]}
        vacio="Todavía no hay sociedades. Crea la primera abajo."
        total={`${sociedades.length} sociedades`}
        filas={sociedades.map((s) => ({
          id: s.id,
          tono: s.cif === "PENDIENTE" ? ("aviso" as const) : undefined,
          celdas: [
            <span key="r" className="font-medium">{s.razonSocial}</span>,
            <span key="c" className="cifra">{s.cif}</span>,
            s.centros.length,
            s.activo ? <Etiqueta key="e" tono="ok">Activa</Etiqueta> : <Etiqueta key="e">Desactivada</Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Domicilio", valor: s.domicilio ?? "—" },
                  { etiqueta: "Correo", valor: s.email ?? "—" },
                  { etiqueta: "Cuenta bancaria", valor: s.iban ? `…${s.iban.slice(-4)}` : "—" },
                  { etiqueta: "Centros", valor: s.centros.map((c) => c.codigo).join(", ") || "—" },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <BotonEnlace href={`/organizacion/sociedades/${s.id}`}>Ver y editar</BotonEnlace>
                {editar && (
                  <form action={activarSociedadAccion}>
                    <input type="hidden" name="sociedadId" value={s.id} />
                    {!s.activo && <input type="hidden" name="activo" value="on" />}
                    <Boton type="submit" variante="secundario">
                      {s.activo ? "Desactivar" : "Activar"}
                    </Boton>
                  </form>
                )}
              </div>
            </div>
          ),
        }))}
      />

      {editar && (
        <div className="mt-6">
          <Tarjeta titulo="Nueva sociedad">
            <form action={guardarSociedadAccion} className="space-y-4">
              <Rejilla columnas={4}>
                <Campo etiqueta="Razón social">
                  <Entrada name="razonSocial" required />
                </Campo>
                <Campo etiqueta="CIF">
                  <Entrada name="cif" required />
                </Campo>
                <Campo etiqueta="Domicilio">
                  <Entrada name="domicilio" />
                </Campo>
                <Campo etiqueta="Correo">
                  <Entrada name="email" type="email" />
                </Campo>
              </Rejilla>
              <Boton type="submit">Crear sociedad</Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
