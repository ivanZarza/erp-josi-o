// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/compras.tsx)
import { PaginaCompra } from "@/modulos/_almacen/paginas/compras";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { params: Promise<{ id: string }>; searchParams: Promise<Busqueda> }) {
  return <PaginaCompra area="BEBIDAS" {...props} />;
}
