// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/inventarios.tsx)
import { PaginaInventarios } from "@/modulos/_almacen/paginas/inventarios";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaInventarios area="BEBIDAS" {...props} />;
}
