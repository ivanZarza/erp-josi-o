import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "usuarios",
  nombre: "Usuarios y permisos",
  descripcion: "Usuarios, roles, permisos y módulos contratados",
  icono: "llave",
  nucleo: true,
  orden: 99,
  menu: [
    { ruta: "/ajustes/usuarios", titulo: "Usuarios", permiso: "ajustes:usuarios:ver" },
    { ruta: "/ajustes/modulos", titulo: "Módulos contratados", permiso: "ajustes:modulos:ver" },
    { ruta: "/ajustes/integraciones", titulo: "Integraciones", permiso: "ajustes:integraciones:ver" },
    { ruta: "/ajustes/registro", titulo: "Registro de cambios", permiso: "ajustes:registro:ver" },
  ],
  permisos: [
    { clave: "ajustes:usuarios:ver", descripcion: "Ver usuarios" },
    { clave: "ajustes:usuarios:editar", descripcion: "Crear y editar usuarios, sus centros y sus permisos" },
    { clave: "ajustes:modulos:ver", descripcion: "Ver módulos contratados" },
    { clave: "ajustes:modulos:editar", descripcion: "Activar y desactivar módulos (cadena y centros)" },
    { clave: "ajustes:integraciones:ver", descripcion: "Ver integraciones" },
    { clave: "ajustes:integraciones:editar", descripcion: "Apuntar proveedor y notas de una integración" },
    { clave: "ajustes:registro:ver", descripcion: "Ver el registro de cambios" },
  ],
  integraciones: [],
};
