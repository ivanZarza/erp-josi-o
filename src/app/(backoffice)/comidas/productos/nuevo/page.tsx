// Comidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/productos.tsx)
import { PaginaProductoNuevo } from "@/modulos/_almacen/paginas/productos";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaProductoNuevo area="COMIDAS" {...props} />;
}
