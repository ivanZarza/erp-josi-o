import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "proveedores",
  nombre: "Proveedores",
  descripcion: "Proveedores comunes a todas las áreas",
  icono: "camion",
  nucleo: true,
  visibleSi: ["bebidas", "comidas", "obrador", "contabilidad"],
  orden: 30,
  menu: [
    { ruta: "/proveedores", titulo: "Proveedores", permiso: "proveedores:ver" },
  ],
  permisos: [
    { clave: "proveedores:ver", descripcion: "Ver proveedores" },
    { clave: "proveedores:editar", descripcion: "Crear y editar proveedores" },
  ],
  integraciones: [
  ],
};
