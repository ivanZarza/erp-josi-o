// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/stock.tsx)
import { PaginaStock } from "@/modulos/_almacen/paginas/stock";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaStock area="BEBIDAS" {...props} />;
}
