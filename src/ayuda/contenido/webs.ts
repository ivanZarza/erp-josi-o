import type { AyudaArea } from "../tipos";

export const AYUDA_WEBS: AyudaArea = {
  "/webs": {
    titulo: "Webs",
    area: "Webs",
    paraQue:
      "Área en preparación. Enseña qué webs y páginas generará el ERP (una por marca y una por local) con los datos que ya tiene, para que la dirección, el horario, la carta y los alérgenos sean los mismos en la web, en los PDF y en Google. Todavía no se publica nada.",
    quien: "Hace falta el permiso «Ver webs».",
    secciones: [
      {
        titulo: "Avisos de arriba",
        campos: [
          {
            nombre: "Módulo en preparación (fase 3)",
            queEs: "Explica que las webs se generarán y publicarán más adelante leyendo los datos del ERP.",
          },
          {
            nombre: "Publicación",
            queEs: "Hueco para la conexión que generará y publicará las webs. Aún no está hecha.",
          },
        ],
      },
      {
        titulo: "Tabla de marcas",
        campos: [
          { nombre: "Marca", queEs: "Cada marca activa del grupo." },
          { nombre: "Web", queEs: "Dirección web de la marca, o «—» si no tiene.", influye: "Se cambia en la ficha de la marca, en Organización." },
          {
            nombre: "Locales",
            queEs: "Número de centros de la marca que no están cerrados.",
          },
          { nombre: "Estado", queEs: "Siempre «Por generar» mientras el área esté en preparación." },
        ],
      },
      {
        titulo: "Detalle de la marca",
        campos: [
          { nombre: "Concepto, Lema, Instagram, Colores", queEs: "Datos de la marca que usará su web. Vienen de la ficha de la marca en Organización." },
          {
            nombre: "Páginas que se generarán",
            queEs:
              "Las páginas comunes de la marca (inicio, carta, locales, eventos, historia, contacto) y, por cada local, su página y su página de reservar, con la dirección del edificio.",
            logica: "La dirección de cada página de local sale del código del centro en minúsculas. Si el local no tiene edificio con dirección, sale «sin dirección».",
          },
        ],
      },
    ],
    influye: [
      { texto: "Las marcas y sus datos se cambian en", ruta: "/organizacion/marcas" },
    ],
  },
};
