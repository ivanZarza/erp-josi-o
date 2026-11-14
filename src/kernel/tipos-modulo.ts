/**
 * Ficha técnica (manifiesto) de un módulo contratable. Ver specs/03_arquitectura.md §5.
 * Cada área vive en src/modulos/<id>/ y exporta su manifiesto en modulo.ts.
 */
export type TipoCentro = "LOCAL" | "OBRADOR" | "ALMACEN";

export interface EntradaMenu {
  ruta: string; // /bebidas/stock
  titulo: string; // «Stock»
  permiso: string; // bebidas:stock:ver
}

export interface PermisoModulo {
  clave: string; // modulo:seccion:accion
  descripcion: string;
}

export interface HuecoIntegracion {
  id: string; // "tpv", "covermanager"…
  nombre: string;
  descripcion: string;
  estado: "pendiente"; // todas pendientes por ahora: se conectarán más adelante
}

export interface ManifiestoModulo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string; // nombre corto para el menú (sin emojis)
  nucleo?: boolean; // siempre activo
  requiere?: string[]; // otros módulos necesarios
  mejoraCon?: string[];
  tiposCentro?: TipoCentro[]; // dónde tiene sentido activarlo (vacío = todos)
  visibleSi?: string[]; // núcleo que solo se ve si está contratado alguno de estos módulos
  menu: EntradaMenu[];
  permisos: PermisoModulo[];
  integraciones?: HuecoIntegracion[];
  orden: number;
}
