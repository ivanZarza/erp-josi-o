import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "obrador",
  nombre: "Obrador",
  descripcion: "Producción, lotes, tarifas y venta a los locales",
  icono: "horno",
  requiere: ["comidas"],
  tiposCentro: ["OBRADOR"],
  orden: 12,
  menu: [
    { ruta: "/obrador", titulo: "Resumen", permiso: "obrador:ver" },
    { ruta: "/obrador/produccion", titulo: "Producción", permiso: "obrador:produccion:ver" },
    { ruta: "/obrador/recetas", titulo: "Recetas", permiso: "obrador:recetas:ver" },
    { ruta: "/obrador/tarifas", titulo: "Tarifas a locales", permiso: "obrador:tarifas:ver" },
    { ruta: "/obrador/lotes", titulo: "Lotes", permiso: "obrador:lotes:ver" },
  ],
  permisos: [
    { clave: "obrador:ver", descripcion: "Ver el obrador" },
    { clave: "obrador:produccion:ver", descripcion: "Ver producción" },
    { clave: "obrador:produccion:crear", descripcion: "Planificar y cerrar producción" },
    { clave: "obrador:recetas:ver", descripcion: "Ver recetas de producción" },
    { clave: "obrador:recetas:editar", descripcion: "Editar recetas" },
    { clave: "obrador:tarifas:ver", descripcion: "Ver tarifas" },
    { clave: "obrador:tarifas:editar", descripcion: "Editar tarifas a locales" },
    { clave: "obrador:lotes:ver", descripcion: "Ver lotes y trazabilidad" },
    { clave: "obrador:lotes:retirar", descripcion: "Retirar un lote (alerta de calidad)" },
    { clave: "obrador:etiquetas:imprimir", descripcion: "Imprimir etiquetas de lote" },
  ],
  integraciones: [
  ],
};
