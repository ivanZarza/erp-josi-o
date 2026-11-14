import { exigir } from "@/kernel/contexto";
import { Cabecera, Tarjeta, BotonEnlace } from "@/ui";
import { accionCrearProveedor } from "@/modulos/proveedores/acciones";
import { FormularioProveedor } from "@/modulos/proveedores/formulario";
import { Mensajes, type Busqueda } from "@/modulos/_almacen/comun";

export default async function PaginaNuevoProveedor({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await exigir("proveedores", "proveedores:editar");
  const sp = await searchParams;
  return (
    <>
      <Cabecera
        titulo="Nuevo proveedor"
        acciones={
          <BotonEnlace href="/proveedores" variante="secundario">
            Volver
          </BotonEnlace>
        }
      />
      <Mensajes sp={sp} />
      <Tarjeta>
        <FormularioProveedor
          accion={accionCrearProveedor}
          volver="/proveedores/nuevo"
          boton="Dar de alta"
          valores={{ nombre: "", cif: null, contacto: null, telefono: null, email: null, areas: [], diasReparto: null, pedidoMinimo: "", notas: null }}
        />
      </Tarjeta>
    </>
  );
}
