import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta } from "@/ui";
import { crearClienteAccion } from "@/modulos/clientes/acciones";
import { FormularioCliente } from "@/modulos/clientes/formulario-cliente";
import { AvisosUrl, PestanasClientes, type Busqueda } from "@/modulos/clientes/ui";

export default async function NuevoCliente({ searchParams }: { searchParams: Busqueda }) {
  await exigir("clientes", "clientes:editar");
  const sp = await searchParams;
  return (
    <>
      <Cabecera titulo="Nuevo cliente" subtitulo="Los consentimientos se registran después en la ficha, con su fecha" />
      <PestanasClientes activa="/clientes" />
      <AvisosUrl sp={sp} />
      <Tarjeta>
        <FormularioCliente accion={crearClienteAccion} boton="Crear cliente" />
      </Tarjeta>
    </>
  );
}
