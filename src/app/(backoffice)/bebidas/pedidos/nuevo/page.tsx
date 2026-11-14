// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/pedidos.tsx)
import { PaginaPedidoNuevo } from "@/modulos/_almacen/paginas/pedidos";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaPedidoNuevo area="BEBIDAS" {...props} />;
}
