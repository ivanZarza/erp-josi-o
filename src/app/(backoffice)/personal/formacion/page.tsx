import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { fecha } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Boton, Campo, Entrada, Selector, Cifra, Rejilla, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import * as s from "@/modulos/personal/servicio";
import { crearCertificadoAccion, desactivarCertificadoAccion } from "@/modulos/personal/acciones";
import { TIPOS_CERTIFICADO, NOMBRE_CERTIFICADO } from "@/modulos/personal/esquemas";
import { Mensajes, Volver, Acciones, EtiquetaCaducidad, param, type Busqueda } from "../_componentes/comun";

export default async function Formacion({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:formacion:ver");
  const sp = await searchParams;
  const estado = (param(sp, "estado") ?? "todos") as "caducados" | "proximos" | "vigentes" | "todos";
  const tipo = param(sp, "tipo") ?? "";
  const volver = `/personal/formacion?estado=${estado}&tipo=${tipo}`;
  const editar = ctx.puede("personal:formacion:editar");
  const [lista, caducados, proximos, faltas, empleados, centros] = await Promise.all([
    s.listarCertificados(ctx, { estado, tipo: tipo || undefined }),
    s.listarCertificados(ctx, { estado: "caducados" }),
    s.listarCertificados(ctx, { estado: "proximos" }),
    s.faltasCertificados(ctx),
    s.listarEmpleados(ctx, { estado: "activos" }),
    s.mapaCentros(ctx),
  ]);

  return (
    <>
      <Cabecera titulo="Formación y certificados" subtitulo="Carnés obligatorios con caducidad (manipulador, alérgenos, PRL, carretillero…) y formaciones internas" />
      <Mensajes sp={sp} />
      <Rejilla columnas={3}>
        <Cifra etiqueta="Caducados" valor={caducados.length} tono={caducados.length ? "error" : "ok"} href="/personal/formacion?estado=caducados" />
        <Cifra etiqueta="Caducan en 30 días" valor={proximos.length} tono={proximos.length ? "aviso" : "ok"} href="/personal/formacion?estado=proximos" />
        <Cifra etiqueta="Personas sin manipulador o alérgenos" valor={faltas.length} tono={faltas.length ? "error" : "ok"} detalle="cocina, sala, barra, office y obrador" />
      </Rejilla>

      {faltas.length > 0 && (
        <Tarjeta titulo="Les falta un certificado obligatorio en vigor" className="mt-4">
          <Tabla
            filas={faltas}
            clave={(f) => f.empleado.id}
            columnas={[
              { titulo: "Persona", celda: (f) => <Link className="text-acento hover:underline" href={`/personal/empleados/${f.empleado.id}?pestana=formacion`}>{s.nombreCompleto(f.empleado)}</Link> },
              { titulo: "Puesto", celda: (f) => f.empleado.puesto?.nombre ?? "—" },
              { titulo: "Centro", celda: (f) => centros.get(f.empleado.centroPrincipalId)?.nombre ?? "—" },
              { titulo: "Falta", celda: (f) => f.faltan.map((t) => <Etiqueta key={t} tono="error">{NOMBRE_CERTIFICADO[t as keyof typeof NOMBRE_CERTIFICADO]}</Etiqueta>) },
            ]}
          />
        </Tarjeta>
      )}

      <form className="my-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado}>
            <option value="todos">Todos</option>
            <option value="caducados">Caducados</option>
            <option value="proximos">Caducan en 30 días</option>
            <option value="vigentes">En vigor</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Tipo">
          <Selector name="tipo" defaultValue={tipo}>
            <option value="">Todos</option>
            {TIPOS_CERTIFICADO.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_CERTIFICADO[t]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Boton variante="secundario" type="submit">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Persona" }, { titulo: "Certificado" }, { titulo: "Centro", secundaria: true }, { titulo: "Obtenido", secundaria: true }, { titulo: "Caducidad" }]}
        total={`${lista.length} certificados`}
        vacio="No hay certificados con este filtro."
        filas={lista.map((c) => ({
          id: c.id,
          tono: c.caducaEn && c.caducaEn < new Date() ? "error" : undefined,
          celdas: [s.nombreCompleto(c.empleado), c.nombre, centros.get(c.empleado.centroPrincipalId)?.nombre ?? "—", fecha(c.obtenidoEn), <EtiquetaCaducidad key="c" caducaEn={c.caducaEn} />],
          detalle: (
            <>
              <DatosDetalle
                datos={[
                  { etiqueta: "Tipo", valor: NOMBRE_CERTIFICADO[c.tipo as keyof typeof NOMBRE_CERTIFICADO] ?? c.tipo },
                  { etiqueta: "Entidad", valor: c.entidad },
                  { etiqueta: "Puesto", valor: c.empleado.puesto?.nombre },
                  { etiqueta: "Registrado", valor: fecha(c.createdAt) },
                ]}
              />
              {editar && (
                <Acciones>
                  <form action={desactivarCertificadoAccion}>
                    <Volver a={volver} />
                    <input type="hidden" name="certificadoId" value={c.id} />
                    <Boton variante="secundario" type="submit">
                      Retirar
                    </Boton>
                  </form>
                </Acciones>
              )}
            </>
          ),
        }))}
      />

      {editar && (
        <Tarjeta titulo="Registrar certificado o formación" className="mt-6">
          <form action={crearCertificadoAccion} className="flex flex-wrap items-end gap-3">
            <Volver a={volver} />
            <div className="min-w-64">
              <Campo etiqueta="Persona">
                <Selector name="empleadoId" required defaultValue="">
                  <option value="">Elige…</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {s.nombreCompleto(e)}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
            <Campo etiqueta="Tipo">
              <Selector name="tipo">
                {TIPOS_CERTIFICADO.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_CERTIFICADO[t]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Nombre (opcional)">
              <Entrada name="nombre" />
            </Campo>
            <Campo etiqueta="Entidad">
              <Entrada name="entidad" />
            </Campo>
            <Campo etiqueta="Obtenido">
              <Entrada type="date" name="obtenidoEn" />
            </Campo>
            <Campo etiqueta="Caduca">
              <Entrada type="date" name="caducaEn" />
            </Campo>
            <Boton type="submit">Guardar</Boton>
          </form>
          <p className="mt-2 text-xs text-slate-500">Un certificado nuevo sustituye al anterior del mismo tipo (el viejo queda en el historial).</p>
        </Tarjeta>
      )}
    </>
  );
}
