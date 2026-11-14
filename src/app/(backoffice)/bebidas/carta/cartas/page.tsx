// Bebidas · Cartas: pantalla compartida con Comidas (src/modulos/comidas/carta-pantallas/cartas.tsx)
import { PaginaCartas } from "@/modulos/comidas/carta-pantallas/cartas";
import type { Busqueda } from "@/modulos/comidas/carta-pantallas/comun";

export default function Pagina(props: { searchParams: Busqueda }) {
  return <PaginaCartas area="BEBIDAS" {...props} />;
}
