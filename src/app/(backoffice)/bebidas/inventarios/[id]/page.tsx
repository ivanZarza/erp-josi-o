// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/inventarios.tsx)
import { PaginaInventario } from "@/modulos/_almacen/paginas/inventarios";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { params: Promise<{ id: string }>; searchParams: Promise<Busqueda> }) {
  return <PaginaInventario area="BEBIDAS" {...props} />;
}
