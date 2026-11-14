import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "calidad",
  nombre: "Calidad",
  descripcion: "APPCC, temperaturas, incidencias y mantenimiento",
  icono: "escudo",
  orden: 16,
  menu: [
    { ruta: "/calidad", titulo: "Tareas de hoy", permiso: "calidad:ver" },
    { ruta: "/calidad/temperaturas", titulo: "Temperaturas", permiso: "calidad:ver" },
    { ruta: "/calidad/incidencias", titulo: "Incidencias", permiso: "calidad:ver" },
    { ruta: "/calidad/mantenimiento", titulo: "Mantenimiento", permiso: "calidad:ver" },
    { ruta: "/calidad/plantillas", titulo: "Plantillas APPCC", permiso: "calidad:editar" },
  ],
  permisos: [
    { clave: "calidad:ver", descripcion: "Ver calidad" },
    { clave: "calidad:registrar", descripcion: "Registrar controles" },
    { clave: "calidad:incidencias:gestionar", descripcion: "Gestionar incidencias" },
    { clave: "calidad:editar", descripcion: "Editar plan APPCC" },
  ],
  integraciones: [
    { id: "sondas", nombre: "Sondas de temperatura", descripcion: "Lectura automática de cámaras", estado: "pendiente" },
  ],
};
