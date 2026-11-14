// Comidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/movimientos.tsx)
import { PaginaMovimientos } from "@/modulos/_almacen/paginas/movimientos";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaMovimientos area="COMIDAS" {...props} />;
}
