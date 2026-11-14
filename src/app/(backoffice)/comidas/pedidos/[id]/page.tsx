// Comidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/pedidos.tsx)
import { PaginaPedido } from "@/modulos/_almacen/paginas/pedidos";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { params: Promise<{ id: string }>; searchParams: Promise<Busqueda> }) {
  return <PaginaPedido area="COMIDAS" {...props} />;
}
