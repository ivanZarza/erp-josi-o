import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "eventos",
  nombre: "Eventos",
  descripcion: "Grupos, empresas, Navidad y catering",
  icono: "estrella",
  orden: 21,
  mejoraCon: ["reservas", "clientes"],
  menu: [
    { ruta: "/eventos", titulo: "Solicitudes", permiso: "eventos:ver" },
    { ruta: "/eventos/nueva", titulo: "Nueva solicitud", permiso: "eventos:gestionar" },
    { ruta: "/eventos/menus", titulo: "Menús de grupo", permiso: "eventos:ver" },
  ],
  permisos: [
    { clave: "eventos:ver", descripcion: "Ver eventos" },
    { clave: "eventos:gestionar", descripcion: "Gestionar solicitudes y presupuestos" },
    { clave: "eventos:menus:editar", descripcion: "Editar menús de grupo" },
  ],
  integraciones: [
  ],
};
