import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, BotonEnlace, Boton, Entrada, Selector, Campo, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarEmpleados, listarPuestos, mapaCentros, contratoVigente, costeHoraContrato, nombreCompleto } from "@/modulos/personal/servicio";
import { bajaEmpleadoAccion } from "@/modulos/personal/acciones";
import { DEPARTAMENTOS, NOMBRE_DEPARTAMENTO, NOMBRE_CONTRATO, NOMBRE_CERTIFICADO } from "@/modulos/personal/esquemas";
import { hoyMadrid, aDia, sumarDias } from "@/modulos/personal/fechas";
import { Mensajes, Volver, Acciones, EtiquetaContrato, param, type Busqueda } from "../_componentes/comun";

export default async function Empleados({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:plantilla:ver");
  const sp = await searchParams;
  const texto = param(sp, "q") ?? "";
  const estado = (param(sp, "estado") ?? "activos") as "activos" | "bajas" | "todos";
  const departamento = param(sp, "departamento") ?? "";
  const [empleados, puestos, centros] = await Promise.all([listarEmpleados(ctx, { texto, estado, departamento: departamento || undefined }), listarPuestos(ctx), mapaCentros(ctx)]);
  const verSalarios = ctx.puede("personal:salarios:ver");
  const editar = ctx.puede("personal:plantilla:editar");
  const hoy = hoyMadrid();
  const en30 = aDia(sumarDias(hoy, 30));
  const volver = `/personal/empleados?${new URLSearchParams({ q: texto, estado, departamento }).toString()}`;

  return (
    <>
      <Cabecera titulo="Empleados" subtitulo={ctx.centroActivo ? `Plantilla de ${ctx.centroActivo.nombre} (incluye quien puede trabajar aquí)` : "Plantilla de todos tus centros"} acciones={editar ? <BotonEnlace href="/personal/empleados/nuevo">Alta de empleado</BotonEnlace> : undefined} />
      <Mensajes sp={sp} />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Campo etiqueta="Buscar">
            <Entrada name="q" defaultValue={texto} placeholder="Nombre, DNI o código" />
          </Campo>
        </div>
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado}>
            <option value="activos">Activos</option>
            <option value="bajas">De baja</option>
            <option value="todos">Todos</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Departamento">
          <Selector name="departamento" defaultValue={departamento}>
            <option value="">Todos</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>
                {NOMBRE_DEPARTAMENTO[d]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Boton variante="secundario" type="submit">
          Filtrar
        </Boton>
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Nombre" }, { titulo: "Puesto" }, { titulo: "Centro" }, { titulo: "Contrato" }, { titulo: "Jornada", alinear: "derecha", secundaria: true }, { titulo: "Estado" }]}
        total={`${empleados.length} personas`}
        vacio={editar ? "No hay empleados con este filtro. Da de alta al primero con «Alta de empleado»." : "No hay empleados con este filtro."}
        filas={empleados.map((e) => {
          const c = contratoVigente(e.contratos, hoy);
          const vence = c?.fechaFin && c.fechaFin <= en30;
          const caducados = e.certificados.filter((x) => x.caducaEn && x.caducaEn < aDia(hoy));
          const coste = costeHoraContrato(c);
          return {
            id: e.id,
            tono: !e.activo ? undefined : !c || caducados.length ? "error" : vence ? "aviso" : undefined,
            celdas: [
              <span key="n" className="font-medium">
                {nombreCompleto(e)}
                <span className="ml-2 text-xs text-slate-500">{e.codigo}</span>
              </span>,
              e.puesto?.nombre ?? "—",
              <span key="c">
                {centros.get(e.centroPrincipalId)?.nombre ?? "—"}
                {e.centros.length > 0 && <span className="ml-1 text-xs text-slate-500">+{e.centros.length}</span>}
              </span>,
              <EtiquetaContrato key="t" tipo={c?.tipo} />,
              c ? `${numero(c.jornadaSemanal)} h` : "—",
              !e.activo ? <Etiqueta key="e">Baja {fecha(e.fechaBaja)}</Etiqueta> : vence ? <Etiqueta key="e" tono="aviso">Vence {fecha(c!.fechaFin)}</Etiqueta> : caducados.length ? <Etiqueta key="e" tono="error">Certificado caducado</Etiqueta> : <Etiqueta key="e" tono="ok">Activo</Etiqueta>,
            ],
            detalle: (
              <>
                <DatosDetalle
                  datos={[
                    { etiqueta: "DNI / NIE", valor: e.dni },
                    { etiqueta: "Teléfono", valor: e.telefono },
                    { etiqueta: "Correo", valor: e.email },
                    { etiqueta: "Alta", valor: fecha(e.fechaAlta) },
                    { etiqueta: "Departamento", valor: e.puesto ? NOMBRE_DEPARTAMENTO[e.puesto.departamento] : null },
                    { etiqueta: "Categoría", valor: e.categoria ? `${e.categoria.nombre} · ${e.categoria.convenio.nombre}` : null },
                    { etiqueta: "Otros centros", valor: e.centros.map((x) => centros.get(x.centroId)?.nombre).filter(Boolean).join(", ") || "Ninguno" },
                    { etiqueta: "Contrato", valor: c ? `${NOMBRE_CONTRATO[c.tipo]} desde ${fecha(c.fechaInicio)}${c.fechaFin ? ` hasta ${fecha(c.fechaFin)}` : ""}` : "Sin contrato en vigor" },
                    { etiqueta: "Periodo de prueba", valor: c?.finPeriodoPrueba ? `Hasta ${fecha(c.finPeriodoPrueba)}` : "—" },
                    { etiqueta: "Certificados", valor: e.certificados.map((x) => NOMBRE_CERTIFICADO[x.tipo as keyof typeof NOMBRE_CERTIFICADO] ?? x.nombre).join(", ") || "Ninguno" },
                    ...(verSalarios ? [{ etiqueta: "Salario bruto anual", valor: c?.salarioBrutoAnual ? euros(c.salarioBrutoAnual) : "—" }, { etiqueta: "Coste empresa / hora", valor: coste !== null ? euros(coste) : "—" }] : []),
                    ...(!e.activo ? [{ etiqueta: "Motivo de baja", valor: e.motivoBaja }] : []),
                  ]}
                />
                <Acciones>
                  <BotonEnlace href={`/personal/empleados/${e.id}`}>Abrir ficha</BotonEnlace>
                  <BotonEnlace href={`/personal/empleados/${e.id}?pestana=contratos`} variante="secundario">
                    Contratos
                  </BotonEnlace>
                  {editar && e.activo && (
                    <form action={bajaEmpleadoAccion} className="flex flex-wrap items-end gap-2">
                      <Volver a={volver} />
                      <input type="hidden" name="empleadoId" value={e.id} />
                      <Campo etiqueta="Fecha de baja">
                        <Entrada type="date" name="fecha" defaultValue={hoy} required />
                      </Campo>
                      <Campo etiqueta="Motivo">
                        <Entrada name="motivo" placeholder="Fin de contrato, voluntaria…" required />
                      </Campo>
                      <Boton variante="peligro" type="submit">
                        Dar de baja
                      </Boton>
                    </form>
                  )}
                </Acciones>
              </>
            ),
          };
        })}
      />
      {puestos.length === 0 && editar && <p className="mt-3 text-sm text-slate-500">Aún no hay puestos: créalos en «Puestos y convenios».</p>}
    </>
  );
}
