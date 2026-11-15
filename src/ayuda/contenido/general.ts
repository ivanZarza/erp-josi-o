import type { AyudaArea } from "../tipos";

export const AYUDA_GENERAL: AyudaArea = {
  "/": {
    titulo: "Inicio",
    area: "General",
    paraQue:
      "Es la primera pantalla al entrar. Muestra las áreas del ERP que tu cadena tiene contratadas y que tú puedes ver, y los ajustes de la cadena. Desde aquí se entra en cada área.",
    quien: "Todos los usuarios. Cada uno ve solo las áreas para las que tiene permiso.",
    secciones: [
      {
        titulo: "Cabecera de todas las pantallas",
        campos: [
          {
            nombre: "Nombre de la cadena (arriba a la izquierda)",
            queEs: "Vuelve a esta pantalla de inicio desde cualquier sitio.",
          },
          {
            nombre: "Iconos de las áreas",
            queEs: "Accesos directos a cada área (Bebidas, Comidas, Caja…). En el móvil están en el botón de la rejilla.",
            logica: "Solo salen las áreas que la cadena tiene contratadas y para las que tu usuario tiene permiso.",
            influye: "Las áreas contratadas se cambian en Ajustes → Módulos; los permisos, en Ajustes → Usuarios.",
          },
          {
            nombre: "Selector de centro",
            queEs:
              "Elige qué local u obrador quieres ver. «Todos mis centros» junta los datos de todos los centros que tienes asignados.",
            logica:
              "La elección se guarda en tu sesión y se aplica a todas las pantallas: listados, cifras, stock y cuadro de mando se filtran por ese centro. Si solo tienes un centro, se elige solo.",
            influye: "Todo lo que ves y, en muchas pantallas, el centro en el que se crean los documentos nuevos (compras, pedidos, inventarios…).",
          },
          { nombre: "Tu nombre", queEs: "El usuario con el que has entrado." },
          { nombre: "Salir (icono de la puerta)", queEs: "Cierra la sesión y vuelve a la pantalla de acceso." },
          {
            nombre: "Botón «?» (abajo a la derecha)",
            queEs:
              "Abre esta ayuda en una ventana aparte. Con «Seguir la pantalla» marcado, la ayuda cambia sola cuando cambias de pantalla en el ERP.",
          },
        ],
      },
      {
        titulo: "Tarjetas de las áreas",
        campos: [
          {
            nombre: "Cada tarjeta",
            queEs: "Un área del ERP con una frase de lo que hace. Al pulsarla se abre su primera pantalla.",
            logica: "Salen las áreas contratadas y permitidas, menos las de ajustes (que van abajo). Proveedores sale como un área más.",
          },
        ],
      },
      {
        titulo: "Ajustes de la cadena",
        campos: [
          {
            nombre: "Botones «Área · Pantalla»",
            queEs: "Accesos a las pantallas de configuración común: organización (sociedades, marcas, locales), usuarios, módulos, integraciones…",
            logica: "Solo salen si tienes permiso para alguna de ellas.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Las áreas que salen dependen de lo contratado", ruta: "/ajustes/modulos" },
      { texto: "y de los permisos de tu usuario", ruta: "/ajustes/usuarios" },
    ],
  },

  "/acceso": {
    titulo: "Entrar en el ERP",
    area: "General",
    paraQue: "Pantalla para identificarse con el correo y la contraseña.",
    quien: "Cualquier persona con un usuario dado de alta en Ajustes → Usuarios.",
    secciones: [
      {
        titulo: "Formulario",
        campos: [
          { nombre: "Correo", queEs: "El correo con el que se dio de alta tu usuario." },
          {
            nombre: "Contraseña",
            queEs: "Tu contraseña personal. Se guarda cifrada: nadie, ni el administrador, puede leerla.",
          },
          {
            nombre: "Entrar",
            queEs: "Comprueba el correo y la contraseña y abre la pantalla de inicio.",
            logica:
              "El usuario y su cadena tienen que estar activos. Si algo no cuadra sale «Correo o contraseña incorrectos» (no se dice cuál de los dos, por seguridad). Al entrar se apunta la fecha del último acceso.",
            influye: "La fecha de último acceso se ve en Ajustes → Usuarios.",
          },
        ],
      },
    ],
    influye: [{ texto: "Altas, bajas y permisos de usuarios", ruta: "/ajustes/usuarios" }],
  },

  "/sin-permiso": {
    titulo: "Sin permiso",
    area: "General",
    paraQue:
      "Sale cuando intentas abrir una pantalla para la que tu usuario no tiene permiso, o de un área que la cadena no tiene contratada.",
    secciones: [
      {
        titulo: "Pantalla",
        campos: [
          {
            nombre: "Volver al inicio",
            queEs: "Te lleva a la pantalla de inicio.",
            logica: "Si necesitas esa pantalla, el administrador de la cadena puede darte el permiso en Ajustes → Usuarios → Permisos.",
          },
        ],
      },
    ],
    influye: [{ texto: "Los permisos de cada usuario", ruta: "/ajustes/usuarios" }],
  },
};
