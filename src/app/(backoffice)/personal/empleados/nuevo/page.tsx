import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, Boton, BotonEnlace, Campo, Entrada } from "@/ui";
import { listarPuestos, listarConvenios, listarSociedades, usuariosParaEnlazar } from "@/modulos/personal/servicio";
import { altaEmpleadoAccion } from "@/modulos/personal/acciones";
import { hoyMadrid } from "@/modulos/personal/fechas";
import { CamposEmpleado, CamposContrato } from "../../_componentes/formulario-empleado";
import { Mensajes, Volver, type Busqueda } from "../../_componentes/comun";

export default async function NuevoEmpleado({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:plantilla:editar");
  const sp = await searchParams;
  const [puestos, convenios, sociedades, usuarios] = await Promise.all([listarPuestos(ctx), listarConvenios(ctx), listarSociedades(ctx), usuariosParaEnlazar(ctx)]);
  const hoy = hoyMadrid();

  return (
    <>
      <Cabecera titulo="Alta de empleado" subtitulo="Datos de la ficha y, si ya lo tienes, su primer contrato." acciones={<BotonEnlace href="/personal/empleados" variante="secundario">Volver</BotonEnlace>} />
      <Mensajes sp={sp} />
      <form action={altaEmpleadoAccion} className="space-y-4">
        <Volver a="/personal/empleados/nuevo" />
        <Tarjeta titulo="Ficha">
          <div className="mb-4 w-56">
            <Campo etiqueta="Fecha de alta">
              <Entrada type="date" name="fechaAlta" defaultValue={hoy} required />
            </Campo>
          </div>
          <CamposEmpleado centros={ctx.centros} puestos={puestos} convenios={convenios} sociedades={sociedades} usuarios={usuarios} />
        </Tarjeta>
        <Tarjeta titulo="Contrato">
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="conContrato" defaultChecked className="h-4 w-4 accent-acento" />
            Registrar el contrato ahora (si lo quitas, el empleado queda sin contrato y saldrá en los avisos)
          </label>
          <CamposContrato convenios={convenios} sociedades={sociedades} verSalarios={ctx.puede("personal:salarios:ver")} fechaInicio={hoy} />
        </Tarjeta>
        <div className="flex justify-end">
          <Boton type="submit">Dar de alta</Boton>
        </div>
      </form>
    </>
  );
}
