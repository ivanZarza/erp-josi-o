import type { AyudaArea } from "../tipos";

const AREA = "Organización";

/** Explicación común de los estados de un centro. */
const ESTADOS =
  "«En preparación»: se está montando con el asistente; no sale en el selector de centros ni en los pedidos. «Abierto»: funciona con normalidad. «Temporada»: abierto solo una parte del año (sigue saliendo en el selector). «Cerrado temporalmente»: parado por obras, vacaciones…; sigue saliendo en el selector. «Cerrado»: cierre definitivo; deja de salir en el selector y en los pedidos, pero no se borra nada y se puede reabrir.";

/** Campos de datos de un centro (ficha y paso 1 del asistente ya creado). */
const CAMPOS_DATOS_CENTRO = [
  {
    nombre: "Código",
    queEs: "Abreviatura corta del centro, por ejemplo VA-AYA u OB.",
    logica:
      "Letras, números y guiones, máximo 12 caracteres; se pasa a mayúsculas. No puede repetirse dentro de la cadena.",
    influye: "Sale en listados, filtros, usuarios y módulos para reconocer el centro de un vistazo.",
  },
  {
    nombre: "Nombre comercial",
    queEs: "El nombre con el que se conoce el local (por ejemplo «Vaca Ayala»). Mínimo 2 letras.",
    influye: "Es el nombre que sale en el selector de centros de arriba y en todas las pantallas.",
  },
  {
    nombre: "Tipo",
    queEs: "Local (restaurante), Obrador (cocina central) o Almacén.",
    logica:
      "El tipo decide qué áreas tienen sentido en el centro: por ejemplo Caja y Reservas solo existen en locales, y Obrador solo en obradores. Si el centro ya tiene sus áreas guardadas, no deja cambiar el tipo: sale «Para cambiar el tipo de centro, revisa antes sus áreas activas».",
    influye: "Las áreas que se pueden activar en la pestaña «Áreas activas» y en Ajustes → Módulos contratados.",
  },
  {
    nombre: "Hora de corte",
    queEs: "Hora a la que termina la jornada del local. Por defecto 05:00.",
    logica:
      "Lo que pasa antes de esa hora cuenta como el día anterior: una venta a las 02:00 del sábado es del viernes.",
    influye: "Caja usa esta hora para saber a qué día de negocio y a qué turno (comida o cena) pertenece cada venta.",
  },
  {
    nombre: "Marca",
    queEs: "La marca a la que pertenece el local. «Sin marca» si no tiene (obrador, almacén).",
    logica: "Solo salen las marcas activas (y la que ya tuviera el centro).",
    influye:
      "Agrupa los locales en la pantalla de Marcas y en el cuadro de mando por marca. Para abrir un local (tipo Local) es obligatorio tener marca.",
  },
  {
    nombre: "Sociedad",
    queEs: "La empresa del grupo con la que factura y contrata este centro.",
    logica: "Solo salen las sociedades activas (y la que ya tuviera el centro), con su CIF entre paréntesis.",
    influye:
      "Contabilidad lleva todo por sociedad; Personal la usa como sociedad por defecto en las nóminas de quien trabaja aquí; el cuadro de mando agrupa por sociedad. Es obligatoria para abrir el local.",
  },
  {
    nombre: "Teléfono",
    queEs: "Teléfono del local, con prefijo internacional.",
    logica:
      "Si escribes 9 cifras españolas se le pone +34 solo. Admite espacios y guiones. No puede repetirse con otro centro de la cadena (sale «El teléfono ya lo usa …»).",
  },
  {
    nombre: "Correo",
    queEs: "Correo del local.",
    logica: "Se guarda en minúsculas. No puede repetirse con otro centro de la cadena.",
  },
  {
    nombre: "Fecha de apertura",
    queEs: "Día en que abrió o abrirá el local.",
    logica: "Si al abrir el local está vacía, se pone sola la fecha del día en que se pulsa «Abrir local».",
  },
  {
    nombre: "Edificio compartido",
    queEs:
      "Si este centro está en el mismo edificio que otro (por ejemplo un local y un almacén en la misma dirección), elige ese edificio. Si no, deja «Dirección propia» y escríbela abajo.",
    logica:
      "Junto a cada edificio salen los códigos de los otros centros que ya están en él. Si el centro ya comparte edificio, sale elegido el suyo (marcado «el actual») y al guardar sigue compartiéndolo. Si eliges un edificio, se ignoran los campos de dirección de abajo. Si pasas a «Dirección propia», el centro se separa del edificio compartido con la dirección escrita abajo.",
  },
  {
    nombre: "Dirección, Código postal, Ciudad, Provincia",
    queEs: "Dirección del centro.",
    logica:
      "Hacen falta la dirección (mínimo 3 letras) y la ciudad, o elegir un edificio. El código postal, si se pone, debe tener 5 cifras. Si la dirección solo la usa este centro, se corrige; si la comparte con otro, se crea una dirección nueva solo para este.",
    influye: "La ciudad sale en el listado de centros. Sin dirección no se puede abrir un local.",
  },
  {
    nombre: "Comunidad autónoma",
    queEs: "Comunidad donde está el centro.",
    logica: "Sirve para saber qué festivos y qué convenio le tocan.",
  },
];

const CAMPOS_HORARIO = [
  {
    nombre: "Lunes … Domingo",
    queEs: "Horario de cada día.",
    logica:
      "Tramos separados por comas, con horas de 00:00 a 23:59: por ejemplo «13:00-16:00, 20:00-00:30». Escribe «cerrado» los días que no abre. Vacío = sin horario ese día. Si el formato no es correcto, sale «Horario no válido».",
    influye: "En la revisión de apertura cuenta como hecho si al menos un día tiene horario que no sea «cerrado».",
  },
  {
    nombre: "Hora de corte de la jornada",
    queEs: "Hora a la que termina la jornada (la misma que en Datos).",
    influye: "Caja la usa para saber a qué día y turno pertenece cada venta.",
  },
  {
    nombre: "Festivos y cierres por temporada",
    queEs: "Texto libre, uno por línea: «24/12 cierra a las 18:00», «agosto cerrado»… Máximo 2.000 caracteres.",
  },
  {
    nombre: "Espacios",
    queEs:
      "Salas del local, una por línea: nombre, aforo sentado y aforo de pie, separados por comas. Ejemplo: «Terraza, 40, 10».",
    logica: "Si falta un número, cuenta como 0. Máximo 50 espacios.",
  },
  {
    nombre: "Servicios",
    queEs:
      "Casillas con lo que ofrece el local: Parking, Aparcacoches, Accesible, Opciones para celíacos, Admite perros, Terraza climatizada, Animación infantil.",
  },
];

export const AYUDA_ORGANIZACION: AyudaArea = {
  "/organizacion": {
    titulo: "Centros",
    area: AREA,
    paraQue:
      "Lista de todos los centros de la cadena: locales, obrador y almacenes, en cualquier estado. Desde aquí se ve de un vistazo cuántos hay abiertos, en preparación o cerrados, y se entra en la ficha de cada uno.",
    quien:
      "Quien tenga el permiso «Ver la organización» (lo tienen casi todos los roles, menos Empleado). El botón «Abrir un local nuevo» solo sale con «Preparar y abrir locales nuevos». Cada usuario ve solo los centros que tiene asignados, salvo el administrador y quien tenga «Todos los centros».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Abrir un local nuevo",
            queEs: "Lleva al asistente para dar de alta un local.",
            logica: "Solo sale si tienes el permiso «Preparar y abrir locales nuevos».",
          },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          {
            nombre: "Abiertos",
            queEs: "Centros en estado «Abierto» más los de «Temporada».",
            logica: "Al pulsarla filtra la lista por «Abiertos y de temporada»: salen los mismos centros que cuenta la cifra.",
          },
          {
            nombre: "En preparación",
            queEs: "Locales que se están montando con el asistente y aún no se han abierto. Sale en naranja si hay alguno.",
          },
          { nombre: "Cerrados temporalmente", queEs: "Centros parados de forma temporal." },
          { nombre: "Cerrados", queEs: "Centros cerrados de forma definitiva (no se borran)." },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Todos los estados", queEs: "Muestra solo los centros en el estado elegido.", logica: ESTADOS },
          { nombre: "Todas las marcas", queEs: "Muestra solo los centros de la marca elegida." },
          { nombre: "Todas las sociedades", queEs: "Muestra solo los centros que facturan con la sociedad elegida." },
          { nombre: "Filtrar", queEs: "Aplica los tres filtros a la vez." },
        ],
      },
      {
        titulo: "Lista de centros",
        campos: [
          { nombre: "Código", queEs: "Abreviatura del centro." },
          { nombre: "Nombre", queEs: "Nombre comercial y, en gris, el tipo (Local, Obrador o Almacén)." },
          { nombre: "Marca", queEs: "Marca del centro, o «—» si no tiene." },
          { nombre: "Sociedad", queEs: "Empresa con la que factura, o «—» si no tiene." },
          { nombre: "Estado", queEs: "Situación del centro.", logica: ESTADOS },
          { nombre: "Ciudad", queEs: "Ciudad de su dirección." },
          { nombre: "Total de centros (abajo)", queEs: "Cuántos centros salen con el filtro actual." },
          {
            nombre: "Fila en naranja",
            queEs: "El centro está en preparación: todavía no se ha abierto.",
          },
        ],
      },
      {
        titulo: "Detalle al pulsar una fila",
        campos: [
          { nombre: "Dirección, Teléfono, Correo, Apertura", queEs: "Datos de contacto y fecha de apertura del centro." },
          { nombre: "Horario", queEs: "Horario de cada día, o «Sin horario»." },
          { nombre: "Hora de corte", queEs: "Hora a la que termina la jornada del centro." },
          {
            nombre: "Productos configurados",
            queEs: "Cuántos productos tiene ajustados el centro (si puede pedirlos y con qué mínimo y máximo).",
          },
          {
            nombre: "Usuarios con acceso propio",
            queEs: "Cuántos usuarios tienen este centro asignado uno a uno.",
            logica: "No cuenta a los administradores ni a quien tiene «Todos los centros», que también lo ven.",
          },
          {
            nombre: "Áreas activas en el centro",
            queEs: "Áreas del ERP que se usan en este centro (Bebidas, Caja…).",
            logica:
              "Si el centro nunca ha tenido áreas guardadas, usa todas las contratadas que encajan con su tipo.",
          },
          { nombre: "Ver ficha", queEs: "Abre la ficha completa del centro." },
          {
            nombre: "Seguir con el asistente",
            queEs: "Solo en centros en preparación: vuelve al asistente de apertura donde se dejó.",
            logica: "Hace falta el permiso «Preparar y abrir locales nuevos».",
          },
          {
            nombre: "Cambiar estado o cerrar",
            queEs: "Lleva a la pestaña «Estado» de la ficha.",
            logica: "Solo sale en centros que no están en preparación y con el permiso «Cerrar locales».",
          },
        ],
      },
    ],
    logica: [
      "Cerrar un centro nunca borra nada: su historial, stock, pedidos y documentos se conservan.",
      "La lista se ordena primero por tipo y luego por código.",
    ],
    influye: [
      { texto: "Crear un local nuevo", ruta: "/organizacion/nuevo-local" },
      { texto: "Marcas de la cadena", ruta: "/organizacion/marcas" },
      { texto: "Sociedades del grupo", ruta: "/organizacion/sociedades" },
      { texto: "En qué centros se usa cada área", ruta: "/ajustes/modulos" },
    ],
    comoSeUsa: [
      "Pulsa una cifra de arriba para ver solo los centros de ese estado.",
      "Pulsa una fila para ver su resumen y sus botones; «Ver ficha» para cambiar datos.",
    ],
  },

  "/organizacion/centros/[id]": {
    titulo: "Ficha del centro",
    area: AREA,
    paraQue:
      "Todo lo de un centro en pestañas: sus datos, su horario y espacios, las áreas del ERP que usa, su estado (abrir, cerrar, reabrir) y el historial de cambios.",
    quien:
      "Para verla, el permiso «Ver la organización» y tener acceso a ese centro. Para cambiar datos y horario, «Editar centros». Para las áreas, además de «Editar centros», hace falta «Activar y desactivar módulos» o «Preparar y abrir locales». Para el estado, ver la pestaña Estado. La pestaña Historial solo sale con «Ver el registro de cambios».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Título", queEs: "Nombre y código del centro; debajo, tipo, marca y sociedad." },
          { nombre: "Etiqueta de estado", queEs: "Estado actual del centro.", logica: ESTADOS },
          {
            nombre: "Seguir con el asistente",
            queEs: "Solo si el centro está en preparación y tienes el permiso «Preparar y abrir locales»: vuelve al asistente.",
          },
          { nombre: "Volver a centros", queEs: "Vuelve a la lista de centros." },
        ],
      },
      {
        titulo: "Pestaña Datos",
        campos: [
          ...CAMPOS_DATOS_CENTRO,
          {
            nombre: "Guardar datos",
            queEs: "Guarda los cambios. Sale «Datos guardados» o el motivo por el que no se ha podido.",
            logica: "Queda en el historial lo que había antes y lo que hay después.",
          },
          {
            nombre: "Vista sin permiso de edición",
            queEs: "Si no tienes «Editar centros», ves los datos en modo lectura, sin formulario.",
          },
        ],
      },
      {
        titulo: "Pestaña Horario y espacios",
        campos: [
          ...CAMPOS_HORARIO,
          {
            nombre: "Guardar horario",
            queEs: "Guarda horario, hora de corte, festivos, espacios y servicios.",
            logica: "Queda en el historial (hora de corte, horario y espacios de antes y de después).",
          },
        ],
      },
      {
        titulo: "Pestaña Áreas activas",
        campos: [
          {
            nombre: "Casillas de áreas",
            queEs: "Las áreas del ERP que se usan en este centro.",
            logica:
              "Solo salen las áreas contratadas por la cadena que tienen sentido en este tipo de centro. Debajo de cada una pone si «Necesita» otra: no se puede activar un área sin activar también la que necesita (por ejemplo Obrador necesita Comidas). Si el centro no tiene áreas propias guardadas, se avisa de que usa todas las contratadas.",
            influye:
              "Un área desactivada deja de salir en este centro para todos los usuarios. Desactivar no borra sus datos: al volver a activarla, todo reaparece.",
          },
          {
            nombre: "Guardar áreas",
            queEs: "Guarda qué áreas quedan activas.",
            logica:
              "Si no tienes permiso, las casillas salen en gris y sin botón. Queda en el historial con la lista de antes y la de después.",
          },
        ],
      },
      {
        titulo: "Pestaña Estado",
        campos: [
          { nombre: "Estado actual", queEs: "Situación del centro.", logica: ESTADOS },
          {
            nombre: "Aviso «Cerrar un centro no borra nada»",
            queEs:
              "Recuerda que cerrar no borra historial, stock, pedidos ni documentos. Un centro «Cerrado» (definitivo) deja de salir en el selector de centros y en los pedidos; uno «Cerrado temporalmente» sigue saliendo.",
          },
          {
            nombre: "Nuevo estado",
            queEs: "Los estados a los que puede pasar desde el actual.",
            logica:
              "Desde En preparación: Abierto o Cerrado. Desde Abierto: Temporada, Cerrado temporalmente o Cerrado. Desde Temporada: Abierto, Cerrado temporalmente o Cerrado. Desde Cerrado temporalmente: Abierto, Temporada o Cerrado. Desde Cerrado: Abierto o Cerrado temporalmente. Pasar de En preparación a Abierto pide el permiso «Preparar y abrir locales»; todos los demás cambios, «Cerrar locales». Si no tienes ninguno, sale «No tienes permiso para cambiar el estado».",
          },
          { nombre: "Motivo", queEs: "Por qué se cambia el estado. Máximo 500 caracteres.", influye: "Queda guardado en el historial." },
          {
            nombre: "Casilla de confirmación del cierre definitivo",
            queEs: "Obligatoria si eliges «Cerrado». Sin marcarla sale «Marca la casilla para confirmar el cierre definitivo».",
          },
          {
            nombre: "Cambiar estado",
            queEs: "Aplica el nuevo estado.",
            logica:
              "Para pasar de En preparación a Abierto, el local debe tener marca (si es un local), sociedad y dirección; si falta algo sale «Antes de abrir falta: …». Al abrir, si no tenía fecha de apertura se pone la de hoy.",
            influye:
              "Al abrir o reabrir, el centro sale en el selector de centros y en los pedidos. Al cerrar de forma definitiva, deja de salir en ellos.",
          },
        ],
      },
      {
        titulo: "Pestaña Historial",
        campos: [
          { nombre: "Fecha", queEs: "Día y hora del cambio." },
          {
            nombre: "Acción",
            queEs:
              "Qué se hizo: crear, editar, horario, areas, abrir, cerrar, estado, copiar-productos o usuarios (cambio de quién tiene acceso al local).",
          },
          { nombre: "Quién", queEs: "Usuario que hizo el cambio." },
          { nombre: "Antes / Después (al pulsar la fila)", queEs: "Los datos tal como estaban y como quedaron." },
        ],
      },
    ],
    logica: [
      "Solo puedes abrir la ficha de un centro al que tengas acceso (el administrador y quien tiene «Todos los centros» ven todos).",
      "El historial muestra los 100 últimos cambios del centro, también los cambios de áreas hechos desde Ajustes → Módulos contratados (en «Después» pone «desde Módulos contratados»).",
      "Cerrar nunca borra nada.",
    ],
    influye: [
      { texto: "Las áreas por centro también se cambian desde aquí", ruta: "/ajustes/modulos" },
      { texto: "Sociedad con la que factura", ruta: "/organizacion/sociedades" },
      { texto: "Marca y su plantilla", ruta: "/organizacion/marcas" },
      { texto: "Todos los cambios de la cadena", ruta: "/ajustes/registro" },
    ],
  },

  "/organizacion/marcas": {
    titulo: "Marcas",
    area: AREA,
    paraQue:
      "Lista de las marcas del grupo (Vaca, La Paloma…), con su identidad y su plantilla para abrir locales. Desde aquí se crean marcas nuevas y se activan o desactivan.",
    quien:
      "Para verla, «Ver la organización». Para crear, activar o desactivar marcas, «Crear y editar marcas».",
    secciones: [
      {
        titulo: "Lista de marcas",
        campos: [
          { nombre: "Marca", queEs: "Nombre de la marca, con un punto de su color principal." },
          { nombre: "Lema", queEs: "Lema de la marca; si no tiene, su concepto; si no, «—»." },
          { nombre: "Web", queEs: "Dirección de su página web." },
          {
            nombre: "Locales",
            queEs: "Cuántos centros de la marca no están cerrados de forma definitiva.",
            logica: "Cuenta también los que están en preparación o cerrados temporalmente.",
          },
          {
            nombre: "Estado",
            queEs: "«Activa» o «Desactivada».",
            influye: "Una marca desactivada no sale para elegirla al abrir un local ni en la ficha de un centro nuevo. Sus locales no cambian.",
          },
        ],
      },
      {
        titulo: "Detalle al pulsar una fila",
        campos: [
          { nombre: "Concepto", queEs: "Descripción de la marca." },
          { nombre: "Instagram", queEs: "Cuenta de Instagram." },
          { nombre: "Color principal / Color de fondo", queEs: "Colores de la marca, con su muestra y su código." },
          {
            nombre: "Plantilla",
            queEs: "Resumen de la plantilla: si tiene local modelo y cuántas áreas marca; o «Sin plantilla».",
          },
          { nombre: "Centros", queEs: "Códigos de todos los centros de la marca." },
          { nombre: "Ver y editar", queEs: "Abre la ficha de la marca." },
          {
            nombre: "Desactivar / Activar",
            queEs: "Cambia el estado de la marca. No borra nada.",
            logica: "Solo con permiso «Crear y editar marcas». Queda en el registro de cambios.",
          },
        ],
      },
      {
        titulo: "Nueva marca",
        campos: [
          { nombre: "Nombre", queEs: "Nombre de la marca. Obligatorio, mínimo 2 letras, no puede repetirse." },
          { nombre: "Lema", queEs: "Frase de la marca. Máximo 200 caracteres." },
          { nombre: "Web", queEs: "Por ejemplo razamadrid.com. Se guarda en minúsculas." },
          { nombre: "Instagram", queEs: "Por ejemplo @razamadrid. Si no pones la @, se añade sola." },
          {
            nombre: "Crear marca",
            queEs: "Crea la marca y abre su ficha para completar colores, concepto y plantilla.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Los locales de cada marca", ruta: "/organizacion" },
      { texto: "Abrir un local con la plantilla de su marca", ruta: "/organizacion/nuevo-local" },
    ],
  },

  "/organizacion/marcas/[id]": {
    titulo: "Ficha de la marca",
    area: AREA,
    paraQue:
      "Identidad de una marca (nombre, lema, web, colores, concepto), su plantilla para abrir locales nuevos y la lista de sus centros.",
    quien:
      "Para verla, «Ver la organización». Para cambiar la identidad, «Crear y editar marcas». Para cambiar la plantilla, «Editar la plantilla de marca». Sin esos permisos se ve en modo lectura.",
    secciones: [
      {
        titulo: "Identidad",
        campos: [
          { nombre: "Nombre", queEs: "Nombre de la marca. Obligatorio y sin repetir." },
          { nombre: "Lema", queEs: "Frase de la marca. Máximo 200 caracteres." },
          { nombre: "Web", queEs: "Por ejemplo marca.com." },
          { nombre: "Instagram", queEs: "Por ejemplo @marca. La @ se añade sola si falta." },
          {
            nombre: "Color principal / Color de fondo",
            queEs: "Colores de la marca en formato #RRGGBB (por ejemplo #7a1f2b).",
            logica: "Si el formato no es correcto sale «Color no válido».",
          },
          { nombre: "Concepto", queEs: "Descripción de la marca. Máximo 300 caracteres.", influye: "Sale como subtítulo de la ficha." },
          { nombre: "Vista", queEs: "Muestra de los colores guardados." },
          { nombre: "Guardar marca", queEs: "Guarda la identidad.", logica: "Queda en el registro de cambios con lo de antes y lo de después." },
        ],
      },
      {
        titulo: "Plantilla de marca",
        campos: [
          {
            nombre: "Para qué sirve",
            queEs:
              "Es lo que hereda un local nuevo de esta marca cuando se abre con el asistente eligiendo «Plantilla de su marca». Se copia al local: si luego cambias la plantilla, los locales ya creados no cambian.",
          },
          {
            nombre: "Local modelo",
            queEs: "Un local de la cadena que sirve de ejemplo.",
            logica:
              "Del local modelo se copian al local nuevo los productos que puede pedir, con sus mínimos y máximos (el stock no). También su hora de corte y su horario si la plantilla no los tiene.",
          },
          {
            nombre: "Hora de corte tipo",
            queEs: "Hora de fin de jornada que tendrá el local nuevo.",
            logica: "Si se deja vacía, se usa la del local modelo, y si no hay, las 05:00.",
          },
          {
            nombre: "Áreas activas en un local de la marca",
            queEs: "Las áreas que nacerán activas en un local nuevo de la marca.",
            logica:
              "Solo salen las áreas contratadas que se usan en un local. Si la plantilla aún no tiene áreas guardadas, salen todas marcadas.",
          },
          {
            nombre: "Horario tipo",
            queEs: "Horario de cada día que tendrá el local nuevo. Mismo formato que en la ficha del centro: «13:00-16:00, 20:00-00:30» o «cerrado».",
            logica:
              "Los días en blanco no se guardan. Si los dejas todos en blanco, la plantilla no tiene horario y el local nuevo toma el del local modelo (si lo hay).",
          },
          { nombre: "Notas para quien abra un local", queEs: "Texto libre con indicaciones. Máximo 2.000 caracteres." },
          { nombre: "Guardar plantilla", queEs: "Guarda la plantilla.", logica: "Queda en el registro de cambios." },
          {
            nombre: "Vista sin permiso",
            queEs: "Sin permiso se ve el local modelo, las áreas («Todas las contratadas» si no hay elegidas) y el horario tipo.",
          },
        ],
      },
      {
        titulo: "Centros de la marca",
        campos: [
          { nombre: "Lista", queEs: "Cada centro de la marca con su estado. Al pulsar el nombre se abre su ficha." },
        ],
      },
    ],
    logica: [
      "Carta, organigrama, cuadrante, APPCC, plano de reservas y web tipo todavía no forman parte de la plantilla: los aportará cada área cuando esté hecha.",
    ],
    influye: [
      { texto: "Abrir un local con esta plantilla", ruta: "/organizacion/nuevo-local" },
      { texto: "Lista de marcas", ruta: "/organizacion/marcas" },
    ],
  },

  "/organizacion/sociedades": {
    titulo: "Sociedades",
    area: AREA,
    paraQue:
      "Lista de las empresas del grupo. Cada centro factura y contrata con una de ellas. Desde aquí se crean sociedades nuevas y se activan o desactivan.",
    quien:
      "Para verla, «Ver la organización». Para crear, activar o desactivar, «Crear y editar sociedades».",
    secciones: [
      {
        titulo: "Lista de sociedades",
        campos: [
          { nombre: "Razón social", queEs: "Nombre legal de la empresa." },
          {
            nombre: "CIF",
            queEs: "Identificación fiscal.",
            logica: "Si pone «PENDIENTE», la fila sale en naranja: falta completar el CIF para poder usarla en facturas.",
          },
          { nombre: "Centros", queEs: "Cuántos centros (en cualquier estado) facturan con ella." },
          {
            nombre: "Estado",
            queEs: "«Activa» o «Desactivada».",
            influye:
              "Una sociedad desactivada no sale para elegirla al abrir un local ni al editar un centro. Los centros que ya la tienen no cambian.",
          },
        ],
      },
      {
        titulo: "Detalle al pulsar una fila",
        campos: [
          { nombre: "Domicilio", queEs: "Domicilio fiscal." },
          { nombre: "Correo", queEs: "Correo de la sociedad." },
          { nombre: "Cuenta bancaria", queEs: "Solo se enseñan las 4 últimas cifras del IBAN, por seguridad." },
          { nombre: "Centros", queEs: "Códigos de los centros que facturan con ella." },
          { nombre: "Ver y editar", queEs: "Abre la ficha de la sociedad." },
          {
            nombre: "Desactivar / Activar",
            queEs: "Cambia el estado de la sociedad. No borra nada.",
            logica: "Solo con permiso «Crear y editar sociedades». Queda en el registro de cambios.",
          },
        ],
      },
      {
        titulo: "Nueva sociedad",
        campos: [
          { nombre: "Razón social", queEs: "Nombre legal. Obligatorio, mínimo 3 letras." },
          {
            nombre: "CIF",
            queEs: "Por ejemplo B88600374. Si aún no lo sabes, déjalo en blanco: se guarda como «PENDIENTE».",
            logica:
              "Se quitan espacios, puntos y guiones y se pasa a mayúsculas. Se comprueba la forma (letra y cifras), no el dígito de control. No puede repetirse: sale «El CIF … ya es de …» (por eso solo puede haber una sociedad con el CIF pendiente).",
          },
          { nombre: "Domicilio", queEs: "Domicilio fiscal (opcional)." },
          { nombre: "Correo", queEs: "Correo de la sociedad (opcional)." },
          {
            nombre: "Crear sociedad",
            queEs: "Crea la sociedad y abre su ficha, donde se puede añadir la cuenta bancaria.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Elegir la sociedad de cada centro", ruta: "/organizacion" },
    ],
  },

  "/organizacion/sociedades/[id]": {
    titulo: "Ficha de la sociedad",
    area: AREA,
    paraQue: "Datos fiscales de una empresa del grupo y lista de los centros que facturan con ella.",
    quien:
      "Para verla, «Ver la organización». Para cambiar datos, «Crear y editar sociedades»; sin él se ve en modo lectura (sin la cuenta bancaria).",
    secciones: [
      {
        titulo: "Aviso de CIF pendiente",
        campos: [
          {
            nombre: "Esta sociedad tiene el CIF pendiente",
            queEs: "Sale si el CIF guardado es «PENDIENTE». Hay que escribir el CIF real para poder usarla en facturas.",
          },
        ],
      },
      {
        titulo: "Datos fiscales",
        campos: [
          { nombre: "Razón social", queEs: "Nombre legal. Obligatorio, mínimo 3 letras.", influye: "Sale como título de la ficha y en listados y filtros." },
          {
            nombre: "CIF",
            queEs: "Identificación fiscal. Si aún no lo sabes, déjalo en blanco: se guarda como «PENDIENTE».",
            logica:
              "Si está pendiente, el campo sale vacío: puedes guardar el resto de datos sin escribirlo. Se comprueba la forma, no el dígito de control. No puede repetirse con otra sociedad.",
          },
          { nombre: "Correo", queEs: "Correo de la sociedad." },
          { nombre: "Domicilio fiscal", queEs: "Dirección fiscal." },
          {
            nombre: "Cuenta bancaria (IBAN)",
            queEs: "IBAN de la sociedad. Se quitan los espacios.",
            logica: "Si el formato no es correcto, sale «IBAN no válido». En el registro de cambios solo se guardan las 4 últimas cifras.",
          },
          { nombre: "Guardar sociedad", queEs: "Guarda los datos. Queda en el registro de cambios." },
        ],
      },
      {
        titulo: "Centros",
        campos: [
          {
            nombre: "Lista",
            queEs: "Centros que facturan con esta sociedad, con su estado. Al pulsar el nombre se abre su ficha.",
            influye: "La sociedad de cada centro se cambia en la ficha del centro.",
          },
        ],
      },
    ],
    logica: ["Las series de documentos y el programa de contabilidad de cada sociedad los aportará Contabilidad."],
    influye: [
      { texto: "Volver a la lista de sociedades", ruta: "/organizacion/sociedades" },
      { texto: "Centros de la cadena", ruta: "/organizacion" },
    ],
  },

  "/organizacion/nuevo-local": {
    titulo: "Abrir un local nuevo",
    area: AREA,
    paraQue:
      "Primer paso del asistente de apertura. Se elige marca, sociedad y de dónde parte el local, y se rellenan sus datos. Al guardar, el local se crea «en preparación» y se sigue con el resto de pasos. Se puede dejar a medias.",
    quien: "Solo quien tenga el permiso «Preparar y abrir locales nuevos» (por defecto, administrador y dirección).",
    secciones: [
      {
        titulo: "Locales a medio preparar",
        campos: [
          {
            nombre: "Lista",
            queEs: "Sale solo si hay locales en preparación: nombre y código, marca y fecha en que se crearon.",
          },
          { nombre: "Seguir", queEs: "Vuelve al asistente de ese local." },
        ],
      },
      {
        titulo: "Paso 1 · Marca y sociedad",
        campos: [
          {
            nombre: "Marca",
            queEs: "Elige una marca activa, o deja «Marca nueva» y escribe su nombre debajo.",
            logica: "Para un local (tipo Local) es obligatorio elegir una marca o escribir una nueva. Para obrador o almacén no.",
          },
          {
            nombre: "Nombre de la marca nueva",
            queEs: "Solo si la marca no está en la lista. Se crea al guardar; luego podrás completar colores, web y plantilla.",
            logica: "Si ya existe una marca con ese nombre, sale «Ya existe la marca …: elígela de la lista». Si has elegido una marca de la lista, esto se ignora.",
          },
          {
            nombre: "Sociedad",
            queEs: "Elige una sociedad activa, o deja «Sociedad nueva (escríbela abajo) o sin sociedad todavía».",
            logica:
              "Si no eliges ninguna ni escribes una nueva, el local se crea sin sociedad. Se puede poner después, pero sin sociedad no se puede abrir.",
          },
          {
            nombre: "Razón social nueva / CIF",
            queEs: "Para crear una sociedad nueva a la vez que el local.",
            logica:
              "Si escribes uno de los dos, hace falta el otro: sin razón social sale «Has escrito un CIF pero falta la razón social…» y sin CIF, «Falta el CIF de la sociedad nueva…». El CIF debe tener formato válido, o escribe «PENDIENTE» si aún no lo sabes (solo puede haber una sociedad pendiente). Si el CIF ya existe sale «Ya existe una sociedad con el CIF …: elígela de la lista».",
          },
          {
            nombre: "¿De dónde parte?",
            queEs: "Qué hereda el local nuevo. Se copia (no queda enlazado).",
            logica:
              "«Plantilla de su marca»: áreas de la plantilla, horario tipo y hora de corte; y, si la plantilla tiene local modelo, los productos que puede pedir con sus mínimos y máximos. Si la marca no tiene plantilla, se activan todas las áreas contratadas. «Copiar de otro local»: copia de ese local sus áreas activas, horario, espacios, servicios, hora de corte y productos con mínimos y máximos. «Empezar en blanco»: todas las áreas contratadas activas y nada más. El stock nunca se copia.",
          },
          {
            nombre: "Local del que copiar",
            queEs: "Solo si eliges «Copiar de otro local». Si no lo eliges, sale «Elige el local del que copiar».",
          },
          {
            nombre: "Plantillas de marca (texto gris)",
            queEs: "Resumen de la plantilla de cada marca activa: qué local modelo copia y cuántas áreas tiene.",
          },
        ],
      },
      {
        titulo: "Paso 2 · Datos del local",
        campos: [
          {
            nombre: "Código",
            queEs: "Abreviatura corta y única, por ejemplo VA-VAL.",
            logica: "Letras, números y guiones, máximo 12. Si ya existe sale «Ya hay un centro con el código …».",
          },
          { nombre: "Nombre comercial", queEs: "Nombre del local. Obligatorio." },
          { nombre: "Tipo", queEs: "Local, Obrador o Almacén.", logica: "Decide qué áreas se pueden usar en el centro." },
          { nombre: "Apertura prevista", queEs: "Fecha en que se espera abrir. Si queda vacía, al abrir se pone la de ese día." },
          { nombre: "Teléfono", queEs: "Con prefijo +34. No puede repetirse con otro centro." },
          { nombre: "Correo del local", queEs: "No puede repetirse con otro centro." },
          {
            nombre: "Edificio compartido",
            queEs: "Si el local está en el mismo edificio que otro centro, elígelo; si no, «Dirección propia».",
          },
          {
            nombre: "Dirección, Código postal, Ciudad, Provincia, Comunidad autónoma",
            queEs: "Dirección del local.",
            logica:
              "Hacen falta la dirección y la ciudad, o elegir un edificio. El código postal, si se pone, de 5 cifras. La comunidad sirve para festivos y convenio.",
          },
        ],
      },
      {
        titulo: "Botón final",
        campos: [
          {
            nombre: "Crear en preparación y seguir",
            queEs: "Crea el local en estado «En preparación» y pasa al paso «Horario y espacios».",
            logica:
              "Todo se hace de una vez: si algo falla, no se crea nada y sale el motivo arriba. Queda en el registro de cambios la creación del local (y de la marca o sociedad nuevas), de dónde parte, las áreas y cuántos productos se copiaron.",
          },
          { nombre: "Siguientes pasos", queEs: "Lista de los pasos que vienen después." },
        ],
      },
    ],
    logica: [
      "Los pasos del asistente dependen de las áreas contratadas: los de áreas no contratadas no salen.",
      "Un local en preparación no sale en el selector de centros ni en los pedidos hasta que se abre.",
    ],
    influye: [
      { texto: "El local aparece en la lista de centros como «En preparación»", ruta: "/organizacion" },
      { texto: "Plantilla de cada marca", ruta: "/organizacion/marcas" },
      { texto: "Sociedades del grupo", ruta: "/organizacion/sociedades" },
    ],
    comoSeUsa: [
      "Elige marca y sociedad (o escribe las nuevas).",
      "Elige de dónde parte: lo más rápido es la plantilla de la marca o copiar un local parecido.",
      "Rellena código, nombre y dirección y pulsa «Crear en preparación y seguir».",
    ],
  },

  "/organizacion/nuevo-local/[id]": {
    titulo: "Asistente de apertura",
    area: AREA,
    paraQue:
      "Pasos para dejar listo un local creado «en preparación»: datos, horario, áreas, productos, usuarios, conexiones y revisión final con el botón «Abrir local». Se puede ir y volver a cualquier paso.",
    quien:
      "Hace falta «Preparar y abrir locales nuevos» y tener acceso al local. Algunos pasos piden además: Datos, Horario y Áreas, «Editar centros»; Áreas, también «Activar y desactivar módulos» o el de abrir locales; Usuarios, «Crear y editar usuarios».",
    secciones: [
      {
        titulo: "Cabecera y lista de pasos",
        campos: [
          { nombre: "Título", queEs: "«Abrir» y el nombre del local; debajo tipo, marca y código." },
          { nombre: "Etiqueta de estado", queEs: "Estado del local. Si ya no está en preparación, sale un aviso verde: se puede seguir ajustando aquí o en su ficha." },
          { nombre: "Ver ficha", queEs: "Abre la ficha del centro." },
          {
            nombre: "Lista de pasos (izquierda)",
            queEs:
              "Todos los pasos, numerados. Al pulsar uno se va a él. Los marcados «pendiente» aún no están construidos.",
            logica:
              "Siempre: Marca, sociedad y datos; Horario y espacios; Áreas del local; Usuarios; Conexiones; Revisión y apertura. Según lo contratado: Carta (Comidas), Bebidas y productos (Bebidas o Comidas), Equipo y Cuadrante (Personal), Calidad, Reservas, Web (Webs) y Presupuesto (Cuadro de mando o Contabilidad).",
          },
          { nombre: "Anterior / Siguiente", queEs: "Botones de abajo para moverse de paso sin guardar." },
        ],
      },
      {
        titulo: "Paso Marca, sociedad y datos",
        campos: [
          ...CAMPOS_DATOS_CENTRO,
          {
            nombre: "Guardar datos",
            queEs: "Guarda los datos del local y se queda en este paso.",
            logica: "Sin el permiso «Editar centros» sale un aviso en lugar del formulario.",
          },
        ],
      },
      {
        titulo: "Paso Horario y espacios",
        campos: [
          ...CAMPOS_HORARIO,
          { nombre: "Guardar y seguir", queEs: "Guarda y pasa al siguiente paso.", logica: "Sin el permiso «Editar centros» sale un aviso en lugar del formulario." },
        ],
      },
      {
        titulo: "Paso Áreas del local",
        campos: [
          {
            nombre: "Casillas de áreas",
            queEs: "Qué áreas contratadas se usan en este local.",
            logica:
              "Solo salen las que encajan con el tipo de centro. No se puede activar un área sin la que necesita (por ejemplo Obrador sin Comidas).",
            influye: "Las áreas desactivadas no salen en este local. Desactivar no borra datos.",
          },
          { nombre: "Guardar y seguir", queEs: "Guarda las áreas y pasa al siguiente paso.", logica: "Sin el permiso «Editar centros» sale un aviso en lugar de las casillas." },
        ],
      },
      {
        titulo: "Paso Bebidas y productos",
        campos: [
          {
            nombre: "Productos configurados",
            queEs: "Cuántos productos tiene ya ajustados el local (si puede pedirlos y con qué mínimo y máximo).",
            logica: "El stock no se copia: empieza en cero y solo cambia con movimientos (compras, traspasos…).",
          },
          {
            nombre: "Copiar los ajustes de",
            queEs: "Elige otro centro que ya tenga productos configurados; al lado sale cuántos tiene.",
          },
          {
            nombre: "Copiar",
            queEs: "Copia a este local, de cada producto, si está activo y su mínimo y máximo.",
            logica:
              "Si el local ya tenía ese producto, se sobrescriben sus ajustes; los que no estén en el otro centro no se tocan. Sale «Copiados los ajustes de N productos». Queda en el historial del centro.",
            influye: "Los mínimos se ajustan después en Bebidas o Comidas, donde también se crean los almacenes del local (bodega, cámara, seco).",
          },
        ],
      },
      {
        titulo: "Paso Usuarios",
        campos: [
          {
            nombre: "Ya ven todos los centros",
            queEs: "Usuarios activos que ya tienen acceso a este local sin hacer nada: administradores y quien tiene «Todos los centros».",
          },
          {
            nombre: "Casillas de usuarios",
            queEs: "Usuarios activos con centros asignados uno a uno (sin contar empleados), con su rol. Marca los que deben ver este local.",
            logica:
              "Los que tienen permisos que tú no tienes salen apagados: no puedes cambiar su acceso.",
            influye: "El usuario marcado verá este local en su selector de centros cuando se abra.",
          },
          {
            nombre: "Guardar acceso",
            queEs: "Guarda quién tiene acceso. Queda en el historial del centro.",
            logica: "Solo cambia a los usuarios de la lista: a los desactivados y a los empleados que tengan acceso a este local no se les quita.",
          },
          { nombre: "Crear un usuario nuevo", queEs: "Abre el alta de usuarios." },
        ],
      },
      {
        titulo: "Paso Conexiones",
        campos: [
          {
            nombre: "Conexiones",
            queEs: "Programas externos que traen las áreas activas del local (TPV, CoverManager, WhatsApp…).",
            logica: "Todas están pendientes de conectar: por ahora es solo información y los datos se meten a mano.",
          },
        ],
      },
      {
        titulo: "Paso Revisión y apertura",
        campos: [
          {
            nombre: "Lista de comprobación",
            queEs: "Lo que tiene el local y lo que falta, con «Hecho», «Falta» o «Falta (obligatorio)».",
            logica:
              "Obligatorios (impiden abrir): Marca (solo en locales), Sociedad y Dirección. Recomendados: CIF de la sociedad (solo sale si está «PENDIENTE»), Teléfono, Correo, Fecha de apertura prevista, Horario, Áreas activas, Productos que puede pedir (si hay Bebidas o Comidas) y Usuarios con acceso al local.",
          },
          { nombre: "Arreglar", queEs: "Lleva al paso donde se completa lo que falta." },
          {
            nombre: "Abrir local",
            queEs: "Pasa el local a «Abierto».",
            logica:
              "Está desactivado mientras falte algo obligatorio. Al abrir: si no tenía fecha de apertura se pone la de hoy, queda en el historial quién lo abrió y cuándo, y te lleva a la ficha del centro.",
            influye:
              "El local aparece en el selector de centros, en los pedidos y, si Webs está contratado, en la web.",
          },
        ],
      },
      {
        titulo: "Pasos pendientes de construir",
        campos: [
          {
            nombre: "Aviso «Paso pendiente de construir»",
            queEs:
              "Carta, Equipo, Cuadrante, Calidad, Reservas, Web y Presupuesto todavía no se hacen aquí. Se configuran después desde su propia área. Puedes pasar al siguiente paso.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Ficha del centro", ruta: "/organizacion/centros/[id]" },
      { texto: "Usuarios y su acceso a centros", ruta: "/ajustes/usuarios" },
      { texto: "Integraciones", ruta: "/ajustes/integraciones" },
    ],
    comoSeUsa: [
      "Ve paso a paso con «Guardar y seguir» o salta a cualquiera desde la lista de la izquierda.",
      "En «Revisión y apertura» pulsa «Arreglar» en lo que falte y, cuando no quede nada obligatorio, «Abrir local».",
    ],
  },
};
