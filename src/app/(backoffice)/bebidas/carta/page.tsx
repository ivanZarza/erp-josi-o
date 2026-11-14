// Bebidas · Carta de bebidas: pantalla compartida con Comidas (src/modulos/comidas/carta-pantallas/platos.tsx)
import { PaginaCarta } from "@/modulos/comidas/carta-pantallas/platos";
import type { Busqueda } from "@/modulos/comidas/carta-pantallas/comun";

export default function Pagina(props: { searchParams: Busqueda }) {
  return <PaginaCarta area="BEBIDAS" {...props} />;
}
