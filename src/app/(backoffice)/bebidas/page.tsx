// Bebidas · pantalla compartida con la otra área (src/modulos/_almacen/paginas/resumen.tsx)
import { PaginaResumen } from "@/modulos/_almacen/paginas/resumen";
import type { Busqueda } from "@/modulos/_almacen/comun";

export default function Pagina(props: { searchParams: Promise<Busqueda> }) {
  return <PaginaResumen area="BEBIDAS" {...props} />;
}
