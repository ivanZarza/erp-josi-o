// Comidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/compras.tsx)
import { PaginaCompraNueva } from "@/modulos/_almacen/paginas/compras";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaCompraNueva area="COMIDAS" {...props} />;
}
