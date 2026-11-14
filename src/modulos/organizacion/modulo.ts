import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "organizacion",
  nombre: "Organización",
  descripcion: "Sociedades, marcas, centros y apertura de locales",
  icono: "edificio",
  nucleo: true,
  orden: 1,
  menu: [
    { ruta: "/organizacion", titulo: "Centros", permiso: "organizacion:ver" },
    { ruta: "/organizacion/marcas", titulo: "Marcas", permiso: "organizacion:ver" },
    { ruta: "/organizacion/sociedades", titulo: "Sociedades", permiso: "organizacion:ver" },
    { ruta: "/organizacion/nuevo-local", titulo: "Abrir local", permiso: "organizacion:centros:abrir" },
  ],
  permisos: [
    { clave: "organizacion:ver", descripcion: "Ver la organización" },
    { clave: "organizacion:centros:editar", descripcion: "Editar centros (datos, horario, áreas)" },
    { clave: "organizacion:centros:abrir", descripcion: "Preparar y abrir locales nuevos" },
    { clave: "organizacion:centros:cerrar", descripcion: "Cerrar locales (temporal o definitivo) y reabrirlos" },
    { clave: "organizacion:marcas:editar", descripcion: "Crear y editar marcas" },
    { clave: "organizacion:plantillas:editar", descripcion: "Editar la plantilla de marca" },
    { clave: "organizacion:sociedades:editar", descripcion: "Crear y editar sociedades" },
  ],
  integraciones: [],
};
