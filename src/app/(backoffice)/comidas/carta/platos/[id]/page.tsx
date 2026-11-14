// Comidas · Ficha del plato: pantalla compartida con Bebidas (src/modulos/comidas/carta-pantallas/ficha.tsx)
import { PaginaFichaPlato } from "@/modulos/comidas/carta-pantallas/ficha";
import type { Busqueda } from "@/modulos/comidas/carta-pantallas/comun";

export default function Pagina(props: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  return <PaginaFichaPlato area="COMIDAS" {...props} />;
}
