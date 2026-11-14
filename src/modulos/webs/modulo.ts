import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "webs",
  nombre: "Webs",
  descripcion: "Webs del grupo, de cada marca y de cada local",
  icono: "globo",
  orden: 23,
  menu: [
    { ruta: "/webs", titulo: "Webs", permiso: "webs:ver" },
  ],
  permisos: [
    { clave: "webs:ver", descripcion: "Ver webs" },
    { clave: "webs:editar", descripcion: "Editar contenidos" },
    { clave: "webs:publicar", descripcion: "Publicar" },
  ],
  integraciones: [
    { id: "cloudflare-pages", nombre: "Publicación", descripcion: "Generar y publicar las webs", estado: "pendiente" },
  ],
};
