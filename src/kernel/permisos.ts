/**
 * Roles y resolución de permisos. Ver specs/05_seguridad_permisos_api.md §2–§3.
 * Clave de permiso: "modulo:seccion:accion". Comodín: "modulo:*" o "*".
 */
export const ROLES = {
  admin: "Administrador de la cadena",
  direccion: "Dirección del grupo",
  finanzas: "Finanzas / control de gestión",
  operaciones: "Operaciones",
  economato: "Economato / obrador",
  gerente: "Gerente de local",
  cocina: "Jefe de cocina",
  sala: "Encargado de sala",
  eventos: "Comercial de eventos",
  rrhh: "Recursos humanos",
  empleado: "Empleado",
} as const;

export type Rol = keyof typeof ROLES;

/** Permisos por defecto de cada rol (se pueden cambiar usuario a usuario). */
export const PERMISOS_ROL: Record<Rol, string[]> = {
  admin: ["*"],
  direccion: ["*"],
  finanzas: ["cuadro:*", "contabilidad:*", "caja:*", "bebidas:stock:ver", "comidas:stock:ver", "proveedores:ver", "personal:costes:ver", "personal:nomina:exportar", "personal:nominas:ver", "organizacion:ver"],
  operaciones: ["bebidas:*", "comidas:*", "obrador:*", "proveedores:*", "calidad:*", "personal:cuadrantes:*", "personal:plantilla:ver", "organizacion:ver", "organizacion:centros:editar", "organizacion:centros:cerrar", "cuadro:ver"],
  economato: ["bebidas:*", "comidas:*", "obrador:*", "proveedores:*", "calidad:*", "organizacion:ver"],
  gerente: ["bebidas:stock:ver", "bebidas:pedidos:*", "bebidas:inventarios:*", "bebidas:mermas:crear", "bebidas:traspasos:crear", "bebidas:compras:*", "bebidas:carta:ver", "bebidas:productos:ver", "comidas:stock:ver", "comidas:pedidos:*", "comidas:inventarios:*", "comidas:mermas:crear", "comidas:traspasos:crear", "comidas:compras:*", "comidas:carta:ver", "personal:plantilla:ver", "personal:cuadrantes:*", "personal:fichajes:*", "personal:ausencias:*", "personal:formacion:ver", "personal:portal:*", "reservas:*", "eventos:ver", "calidad:*", "caja:*", "cuadro:ver", "organizacion:ver"],
  cocina: ["comidas:*", "bebidas:pedidos:*", "calidad:*", "organizacion:ver"],
  sala: ["reservas:*", "eventos:ver", "bebidas:pedidos:*", "clientes:ver", "organizacion:ver"],
  eventos: ["eventos:*", "reservas:ver", "clientes:*", "organizacion:ver"],
  rrhh: ["personal:*", "organizacion:ver"],
  empleado: ["personal:portal:*"],
};

function encaja(patron: string, clave: string): boolean {
  if (patron === "*" || patron === clave) return true;
  if (patron.endsWith(":*")) return clave.startsWith(patron.slice(0, -1));
  return false;
}

/**
 * ¿Tiene el usuario este permiso?
 * 1. admin → sí. 2. Si el usuario tiene permisos a medida (una lista, aunque esté vacía), mandan esos:
 *    lista vacía = ningún permiso. 3. Si no tiene lista (null: «los del rol»), los de su rol.
 * (El módulo contratado y el ámbito de centros se comprueban aparte: contexto.ts)
 */
export function tienePermiso(rol: string, guardados: string[] | null | undefined, clave: string): boolean {
  if (rol === "admin") return true;
  const lista = Array.isArray(guardados) ? guardados : (PERMISOS_ROL[rol as Rol] ?? []);
  return lista.some((p) => encaja(p, clave));
}

/** Lee Usuario.permisos de la base: lista (a medida, puede estar vacía) o null (los del rol). */
export function leerPermisosGuardados(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}
