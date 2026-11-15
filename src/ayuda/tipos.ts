/**
 * Ayuda de cada pantalla (botón «?» flotante → ventana aparte en /ayuda).
 * Cada área escribe la suya en src/ayuda/contenido/<area>.ts; la clave es la ruta de la pantalla
 * tal como está en src/app, con los parámetros entre corchetes: "/bebidas/bodega/[id]".
 * `npm run ayuda:comprobar` avisa de las pantallas sin ayuda.
 */

/** Un campo, columna, cifra, filtro o botón de la pantalla. */
export interface CampoAyuda {
  /** Tal como se lee en pantalla. */
  nombre: string;
  /** Qué es y qué hay que poner o qué significa. */
  queEs: string;
  /** Cómo se calcula o qué reglas sigue (si no es un dato escrito a mano). */
  logica?: string;
  /** Dónde repercute: otras pantallas, cifras, stock, contabilidad… */
  influye?: string;
}

/** Un bloque de la pantalla: filtros, una tabla, un formulario, los botones… */
export interface SeccionAyuda {
  titulo: string;
  campos: CampoAyuda[];
}

export interface PaginaAyuda {
  titulo: string;
  /** Área a la que pertenece (para el índice): "Bebidas", "Caja"… */
  area: string;
  /** Para qué sirve la pantalla, en dos o tres frases. */
  paraQue: string;
  /** Quién la usa y qué permiso hace falta. */
  quien?: string;
  secciones: SeccionAyuda[];
  /** Reglas y cálculos generales de la pantalla. */
  logica?: string[];
  /** En qué influye lo que se hace aquí, con la pantalla donde se ve. */
  influye?: { texto: string; ruta?: string }[];
  /** Pasos habituales o consejos. */
  comoSeUsa?: string[];
}

export type AyudaArea = Record<string, PaginaAyuda>;
