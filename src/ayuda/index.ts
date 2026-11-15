/** Registro de la ayuda de todas las pantallas (ver tipos.ts). */
import type { AyudaArea, PaginaAyuda } from "./tipos";
import { claveAyuda } from "./rutas";
import { AYUDA_GENERAL } from "./contenido/general";
import { AYUDA_BEBIDAS } from "./contenido/bebidas";
import { AYUDA_COMIDAS } from "./contenido/comidas";
import { AYUDA_OBRADOR } from "./contenido/obrador";
import { AYUDA_CAJA } from "./contenido/caja";
import { AYUDA_CONTABILIDAD } from "./contenido/contabilidad";
import { AYUDA_CUADRO } from "./contenido/cuadro";
import { AYUDA_PROVEEDORES } from "./contenido/proveedores";
import { AYUDA_PERSONAL } from "./contenido/personal";
import { AYUDA_RESERVAS } from "./contenido/reservas";
import { AYUDA_EVENTOS } from "./contenido/eventos";
import { AYUDA_CLIENTES } from "./contenido/clientes";
import { AYUDA_CALIDAD } from "./contenido/calidad";
import { AYUDA_WEBS } from "./contenido/webs";
import { AYUDA_ORGANIZACION } from "./contenido/organizacion";
import { AYUDA_AJUSTES } from "./contenido/ajustes";

export type { PaginaAyuda, AyudaArea } from "./tipos";

export const AYUDA: AyudaArea = {
  ...AYUDA_GENERAL,
  ...AYUDA_BEBIDAS,
  ...AYUDA_COMIDAS,
  ...AYUDA_OBRADOR,
  ...AYUDA_CAJA,
  ...AYUDA_CONTABILIDAD,
  ...AYUDA_CUADRO,
  ...AYUDA_PROVEEDORES,
  ...AYUDA_PERSONAL,
  ...AYUDA_RESERVAS,
  ...AYUDA_EVENTOS,
  ...AYUDA_CLIENTES,
  ...AYUDA_CALIDAD,
  ...AYUDA_WEBS,
  ...AYUDA_ORGANIZACION,
  ...AYUDA_AJUSTES,
};

export { claveAyuda } from "./rutas";

export function buscarAyuda(ruta: string): PaginaAyuda | null {
  const clave = claveAyuda(ruta, AYUDA);
  return clave ? AYUDA[clave] : null;
}
