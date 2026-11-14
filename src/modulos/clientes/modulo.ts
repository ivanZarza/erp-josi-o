import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "clientes",
  nombre: "Clientes",
  descripcion: "Fichas, consentimientos, encuestas y tarjetas regalo",
  icono: "persona",
  orden: 22,
  menu: [
    { ruta: "/clientes", titulo: "Clientes", permiso: "clientes:ver" },
    { ruta: "/clientes/encuestas", titulo: "Encuestas", permiso: "clientes:ver" },
    { ruta: "/clientes/tarjetas-regalo", titulo: "Tarjetas regalo", permiso: "clientes:ver" },
  ],
  permisos: [
    { clave: "clientes:ver", descripcion: "Ver clientes" },
    { clave: "clientes:editar", descripcion: "Editar clientes" },
    { clave: "clientes:exportar", descripcion: "Exportar clientes" },
    { clave: "clientes:tarjetas:gestionar", descripcion: "Gestionar tarjetas regalo" },
  ],
  integraciones: [
    { id: "brevo", nombre: "Brevo", descripcion: "Boletines por correo", estado: "pendiente" },
    { id: "whatsapp", nombre: "WhatsApp", descripcion: "Confirmaciones y encuestas", estado: "pendiente" },
    { id: "google-resenas", nombre: "Reseñas de Google", descripcion: "Nota y reseñas por local", estado: "pendiente" },
  ],
};
