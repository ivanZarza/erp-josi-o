import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "reservas",
  nombre: "Reservas",
  descripcion: "Reservas, plano de mesas y elección de mesa",
  icono: "calendario",
  tiposCentro: ["LOCAL"],
  mejoraCon: ["clientes", "eventos"],
  orden: 20,
  menu: [
    { ruta: "/reservas", titulo: "Reservas de hoy", permiso: "reservas:ver" },
    { ruta: "/reservas/nueva", titulo: "Nueva reserva", permiso: "reservas:gestionar" },
    { ruta: "/reservas/plano", titulo: "Plano de mesas", permiso: "reservas:ver" },
    { ruta: "/reservas/mesas", titulo: "Espacios y mesas", permiso: "reservas:planos:editar" },
    { ruta: "/reservas/reglas", titulo: "Turnos y reglas", permiso: "reservas:reglas:editar" },
  ],
  permisos: [
    { clave: "reservas:ver", descripcion: "Ver reservas" },
    { clave: "reservas:gestionar", descripcion: "Crear y cambiar reservas" },
    { clave: "reservas:planos:editar", descripcion: "Editar planos de mesas" },
    { clave: "reservas:reglas:editar", descripcion: "Editar turnos y reglas" },
  ],
  integraciones: [
    { id: "covermanager", nombre: "CoverManager", descripcion: "Leer y crear reservas de CoverManager", estado: "pendiente" },
    { id: "google-reservas", nombre: "Reservar con Google", descripcion: "Botón de reserva en la ficha de Google", estado: "pendiente" },
  ],
};
