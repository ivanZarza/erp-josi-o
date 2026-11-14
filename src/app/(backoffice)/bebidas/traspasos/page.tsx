// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/traspasos.tsx)
import { PaginaTraspasos } from "@/modulos/_almacen/paginas/traspasos";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaTraspasos area="BEBIDAS" {...props} />;
}
