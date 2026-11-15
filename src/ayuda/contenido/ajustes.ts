import type { AyudaArea } from "../tipos";

const AREA = "Usuarios y permisos";

/** Qué permite cada rol por defecto (src/kernel/permisos.ts), en lenguaje llano. */
const ROLES_LLANO =
  "Administrador de la cadena: todo, siempre, y ve todos los centros; sus permisos no se pueden recortar. " +
  "Dirección del grupo: todo, pero se le pueden recortar permisos. " +
  "Finanzas / control de gestión: cuadro de mando, contabilidad y caja completos; ver stock de bebidas y comidas, proveedores, costes de personal y nóminas, y exportar la nómina. " +
  "Operaciones: bebidas, comidas, obrador, proveedores y calidad completos; cuadrantes de personal y ver la plantilla; editar centros y cerrarlos o reabrirlos; ver el cuadro de mando. " +
  "Economato / obrador: bebidas, comidas, obrador, proveedores y calidad completos. " +
  "Gerente de local: pedidos, inventarios y compras de bebidas y comidas; registrar mermas y traspasos; ver stock, carta y productos; ver plantilla, cuadrantes, fichajes, ausencias, formación y portal del empleado; reservas, calidad y caja completos; ver eventos y cuadro de mando. " +
  "Jefe de cocina: comidas y calidad completos; pedidos de bebidas. " +
  "Encargado de sala: reservas; pedidos de bebidas; ver eventos y clientes. " +
  "Comercial de eventos: eventos y clientes completos; ver reservas. " +
  "Recursos humanos: personal completo. " +
  "Empleado: solo su portal del empleado. " +
  "Todos menos Empleado pueden ver la Organización. Solo Administrador y Dirección tienen, de partida, permisos de Ajustes y de abrir locales.";

/** Regla contra la escalada de privilegios (src/modulos/usuarios/servicio.ts). */
const NADIE_DA_LO_QUE_NO_TIENE =
  "Nadie puede dar un rol ni un permiso que él mismo no tiene: solo un administrador nombra administradores, y en la lista de roles solo salen los que puedes dar. " +
  "Tampoco puedes cambiar (datos, rol, permisos, contraseña, activar o desactivar) a un administrador si no lo eres, ni a quien tiene permisos que tú no tienes: en su ficha sale el motivo en lugar del formulario.";

export const AYUDA_AJUSTES: AyudaArea = {
  "/ajustes": {
    titulo: "Ajustes",
    area: AREA,
    paraQue:
      "No tiene contenido propio: te lleva sola a la primera sección de Ajustes que puedes ver, en este orden: Usuarios, Módulos contratados, Integraciones y Registro de cambios.",
    quien: "Cualquier usuario. Si no tienes permiso para ninguna de esas secciones, te lleva a la pantalla «Sin permiso».",
    secciones: [
      {
        titulo: "Secciones de Ajustes",
        campos: [
          { nombre: "Usuarios", queEs: "Altas, bajas, rol, centros y contraseñas de cada persona.", logica: "Pide el permiso «Ver usuarios»." },
          { nombre: "Módulos contratados", queEs: "Qué áreas usa la cadena y en qué centros.", logica: "Pide «Ver módulos contratados»." },
          { nombre: "Integraciones", queEs: "Programas externos que se conectarán.", logica: "Pide «Ver integraciones»." },
          { nombre: "Registro de cambios", queEs: "Quién cambió qué y cuándo.", logica: "Pide «Ver el registro de cambios»." },
        ],
      },
    ],
    influye: [
      { texto: "Usuarios", ruta: "/ajustes/usuarios" },
      { texto: "Módulos contratados", ruta: "/ajustes/modulos" },
      { texto: "Integraciones", ruta: "/ajustes/integraciones" },
      { texto: "Registro de cambios", ruta: "/ajustes/registro" },
    ],
  },

  "/ajustes/usuarios": {
    titulo: "Usuarios",
    area: AREA,
    paraQue:
      "Lista de las personas que entran en el ERP. Cada una tiene su usuario, un rol (que le da los permisos de partida) y los centros que ve. Desde aquí se cambian sus datos, se desactivan y se les pone una contraseña temporal.",
    quien:
      "Para verla, «Ver usuarios». Para crear, cambiar, desactivar o cambiar contraseñas, «Crear y editar usuarios»; sin él sale el aviso «Solo lectura».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Ver también desactivados / Solo activos",
            queEs: "Por defecto solo salen los usuarios activos. Este botón añade o quita los desactivados.",
          },
          { nombre: "Nuevo usuario", queEs: "Abre el alta de un usuario.", logica: "Solo con «Crear y editar usuarios»." },
        ],
      },
      {
        titulo: "Lista de usuarios",
        campos: [
          { nombre: "Nombre", queEs: "Nombre de la persona." },
          { nombre: "Correo", queEs: "Correo con el que entra en el ERP." },
          { nombre: "Rol", queEs: "Su puesto, que le da los permisos de partida.", logica: ROLES_LLANO },
          {
            nombre: "Centros",
            queEs: "Códigos de los centros que ve, «Todos» o «Ninguno».",
            logica: "El administrador y quien tiene «Todos los centros» ven todos, también los que se abran después.",
          },
          {
            nombre: "Permisos",
            queEs: "«Los del rol» si usa los permisos de su rol; «A medida» si se le han cambiado casillas; «Ninguno» si se le quitaron todos; «Todos» para el administrador.",
          },
          {
            nombre: "Estado",
            queEs: "«Activo» o «Desactivado». Un usuario desactivado no puede entrar.",
          },
          { nombre: "Total de usuarios (abajo)", queEs: "Cuántos salen en la lista." },
        ],
      },
      {
        titulo: "Detalle al pulsar una fila",
        campos: [
          { nombre: "Correo", queEs: "Correo del usuario." },
          { nombre: "Último acceso", queEs: "Día y hora de la última vez que entró." },
          { nombre: "Alta", queEs: "Cuándo se creó el usuario." },
          { nombre: "Centros", queEs: "Nombres de los centros que ve, o «Todos los centros»." },
          {
            nombre: "Aviso en lugar del formulario",
            queEs: "Sale si no puedes cambiar a esa persona: «Solo un administrador puede cambiar a un administrador» o «Esta persona tiene permisos que tú no tienes…».",
            logica: NADIE_DA_LO_QUE_NO_TIENE,
          },
        ],
      },
      {
        titulo: "Cambiar el usuario (dentro del detalle)",
        campos: [
          { nombre: "Nombre", queEs: "Nombre de la persona. Mínimo 2 letras." },
          {
            nombre: "Correo",
            queEs: "Correo con el que entra.",
            logica: "Se guarda en minúsculas. No puede haber dos usuarios con el mismo correo.",
          },
          {
            nombre: "Rol",
            queEs: "Su puesto.",
            logica:
              "Si el usuario tiene permisos a medida, mandan esos y cambiar el rol no los toca. Si usa los del rol, al cambiar de rol cambian sus permisos. No se puede quitar el rol de administrador al único administrador activo, ni quitárselo uno a sí mismo. Solo salen los roles que tú puedes dar (además del que ya tiene). " +
              NADIE_DA_LO_QUE_NO_TIENE,
            influye: "Lo que puede ver y hacer en todo el ERP.",
          },
          {
            nombre: "Todos los centros (también los que se abran después)",
            queEs: "Si se marca, ve todos los centros y los nuevos que se abran.",
            logica:
              "El administrador siempre tiene todos, aunque no esté marcada. Solo la ve quien también ve todos los centros: si tú no los ves todos, no puedes darla ni quitarla (si la persona ya la tiene, sale un texto que lo dice y se conserva).",
          },
          {
            nombre: "Casillas de centros",
            queEs: "Los centros que ve, uno a uno. Solo salen los centros que ves tú.",
            logica:
              "Si no es administrador ni tiene «Todos los centros», tiene que quedarle al menos uno. Los centros que tiene y tú no ves no salen aquí y no se tocan al guardar: debajo sale «Además tiene acceso a …, que tú no ves». No puedes darle un centro que tú no ves.",
            influye: "Los centros que le salen en el selector de arriba y los datos que ve en cada área.",
          },
          {
            nombre: "Guardar usuario",
            queEs: "Guarda los cambios. Sale «Usuario guardado».",
            logica: "Queda en el registro de cambios lo de antes y lo de después (sin contraseñas).",
          },
        ],
      },
      {
        titulo: "Botones del usuario",
        campos: [
          {
            nombre: "Permisos",
            queEs: "Abre las casillas de permisos de esa persona.",
            logica: "No sale para el administrador, que lo puede todo.",
          },
          {
            nombre: "Desactivar / Activar",
            queEs: "Desactivar le corta el acceso al momento: aunque tenga el ERP abierto, en la siguiente pantalla tendrá que volver a entrar y no podrá. Activar se lo devuelve.",
            logica:
              "No puedes desactivarte a ti mismo, ni desactivar al único administrador activo. No se borra nada. Queda en el registro de cambios.",
          },
          {
            nombre: "Nueva contraseña temporal",
            queEs: "Contraseña nueva para el usuario.",
            logica: "Mínimo 10 caracteres, con letras y números. Se guarda cifrada: nadie puede leerla después.",
          },
          {
            nombre: "Cambiar contraseña",
            queEs: "Pone la contraseña temporal escrita. Dásela a la persona en mano o por teléfono.",
            logica: "En el registro de cambios solo queda que se cambió, nunca la contraseña.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Permisos de cada persona", ruta: "/ajustes/usuarios/[id]/permisos" },
      { texto: "Dar de alta a alguien", ruta: "/ajustes/usuarios/nuevo" },
      { texto: "Los cambios quedan en el registro", ruta: "/ajustes/registro" },
    ],
    comoSeUsa: [
      "Pulsa la fila de la persona para ver su detalle y cambiar sus datos.",
      "Si alguien deja la empresa, pulsa «Desactivar»: no se borra nada y deja de poder entrar.",
    ],
  },

  "/ajustes/usuarios/nuevo": {
    titulo: "Nuevo usuario",
    area: AREA,
    paraQue: "Alta de una persona en el ERP: sus datos, su rol, los centros que ve y una contraseña temporal para el primer acceso.",
    quien: "Solo con el permiso «Crear y editar usuarios».",
    secciones: [
      {
        titulo: "Datos y rol",
        campos: [
          { nombre: "Nombre y apellidos", queEs: "Nombre de la persona. Obligatorio, mínimo 2 letras." },
          {
            nombre: "Correo",
            queEs: "Con él entra en el ERP.",
            logica: "Se guarda en minúsculas. Si ya hay un usuario con ese correo, sale «Ya hay un usuario con ese correo».",
          },
          {
            nombre: "Rol",
            queEs: "Su puesto. Da los permisos de partida, que se pueden cambiar después. Por defecto, Gerente de local (si puedes darlo).",
            logica: `${ROLES_LLANO} ${NADIE_DA_LO_QUE_NO_TIENE}`,
          },
        ],
      },
      {
        titulo: "Centros que ve",
        campos: [
          {
            nombre: "Todos los centros (también los que se abran después)",
            queEs: "Ve todos los centros de la cadena, también los nuevos.",
            logica:
              "Si el rol es Administrador, se marca sola al guardar. Solo sale si tú ves todos los centros; si no, sale «Solo puedes darle acceso a los centros que tú ves».",
          },
          {
            nombre: "Casillas de centros",
            queEs: "Los centros que verá, uno a uno (solo salen los que ves tú).",
            logica: "Si no es administrador ni tiene «Todos los centros», hay que marcar al menos uno: si no, sale «Elige al menos un centro o marca «Todos los centros»».",
            influye: "Los centros de su selector y los datos que ve.",
          },
        ],
      },
      {
        titulo: "Contraseña temporal",
        campos: [
          {
            nombre: "Contraseña temporal",
            queEs: "Contraseña para su primer acceso.",
            logica: "Mínimo 10 caracteres, con letras y números. Se guarda cifrada.",
          },
          { nombre: "Repítela", queEs: "La misma contraseña otra vez. Si no coinciden, sale «Las dos contraseñas no coinciden»." },
          {
            nombre: "Aviso",
            queEs: "Dale la contraseña en mano o por teléfono, nunca por escrito en un documento o un grupo. La invitación por correo con enlace de un solo uso está pendiente.",
          },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          {
            nombre: "Crear usuario",
            queEs: "Crea el usuario y abre directamente sus permisos para revisarlos.",
            logica: "Queda en el registro de cambios (sin la contraseña).",
          },
          { nombre: "Volver a usuarios", queEs: "Vuelve a la lista sin crear nada." },
        ],
      },
    ],
    influye: [
      { texto: "Revisar sus permisos", ruta: "/ajustes/usuarios/[id]/permisos" },
      { texto: "Lista de usuarios", ruta: "/ajustes/usuarios" },
    ],
  },

  "/ajustes/usuarios/[id]/permisos": {
    titulo: "Permisos del usuario",
    area: AREA,
    paraQue:
      "Casillas con todo lo que puede ver y hacer una persona, área por área. Sirve para dar o quitar permisos sueltos sin cambiarle el rol.",
    quien: "Solo con el permiso «Crear y editar usuarios».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Rol y modo",
            queEs:
              "Debajo del nombre pone su rol y si «Usa los permisos de su rol», «Tiene permisos a medida (mandan sobre los del rol)» o «Tiene permisos a medida: ninguno».",
          },
          {
            nombre: "Aviso en lugar de las casillas",
            queEs: "Si no puedes cambiar a esta persona (es administrador o tiene permisos que tú no tienes), sale el motivo y no hay casillas.",
            logica: NADIE_DA_LO_QUE_NO_TIENE,
          },
          { nombre: "Volver a usuarios", queEs: "Vuelve a la lista de usuarios." },
          {
            nombre: "Aviso para el administrador",
            queEs: "Si la persona es Administrador de la cadena, no hay casillas: lo puede todo y no se cambia aquí.",
          },
        ],
      },
      {
        titulo: "Casillas de permisos",
        campos: [
          {
            nombre: "Un recuadro por área",
            queEs: "Cada área contratada con sus permisos. Las áreas no contratadas no salen.",
          },
          {
            nombre: "Cada casilla",
            queEs: "Un permiso, con su descripción y, en gris, su clave interna (por ejemplo «organizacion:ver»).",
            logica:
              "Sale marcada si la persona tiene hoy ese permiso, ya sea por su rol o porque se le dio a medida. Las casillas de permisos que tú no tienes salen apagadas: no puedes darlos.",
          },
          {
            nombre: "Etiqueta «del rol»",
            queEs: "Ese permiso lo trae su rol de partida.",
            logica: ROLES_LLANO,
          },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          {
            nombre: "Guardar permisos",
            queEs: "Las casillas marcadas pasan a ser los permisos de esta persona.",
            logica:
              "Desde ese momento tiene permisos «a medida» y deja de seguir a su rol: si luego cambias el rol, sus permisos no cambian. Si desmarcas todas, se queda sin ningún permiso (no vuelve a los de su rol): solo podrá entrar y ver la pantalla de inicio. Los permisos que tuviera de áreas ahora desactivadas se conservan. Si intentas dar un permiso que tú no tienes, sale «No puedes dar permisos que tú no tienes: …». Queda en el registro de cambios lo de antes y lo de después.",
            influye: "Lo que ve en el menú y lo que puede hacer en cada pantalla, desde la siguiente pantalla que abra.",
          },
          {
            nombre: "Volver a los permisos del rol",
            queEs: "Borra los permisos a medida y vuelve a los de su rol.",
            logica: "Solo sale si tiene permisos a medida (también si se le quitaron todos). Solo funciona si tú tienes todos los permisos de ese rol.",
          },
        ],
      },
    ],
    logica: [
      "Los centros que ve la persona no se eligen aquí, sino en su ficha de la lista de usuarios.",
      "Además del permiso, el área tiene que estar contratada por la cadena y activa en el centro.",
    ],
    influye: [
      { texto: "Rol y centros de la persona", ruta: "/ajustes/usuarios" },
      { texto: "Áreas contratadas (las que salen aquí)", ruta: "/ajustes/modulos" },
      { texto: "Los cambios de permisos quedan registrados", ruta: "/ajustes/registro" },
    ],
  },

  "/ajustes/modulos": {
    titulo: "Módulos contratados",
    area: AREA,
    paraQue:
      "Lista de todas las áreas del ERP: cuáles usa la cadena y en qué centros está activa cada una. Desde aquí se activan y desactivan áreas para toda la cadena o centro a centro. Desactivar nunca borra datos.",
    quien:
      "Para verla, «Ver módulos contratados». Para activar, desactivar o elegir centros, «Activar y desactivar módulos» (por defecto, solo administrador y dirección).",
    secciones: [
      {
        titulo: "Lista de módulos",
        campos: [
          { nombre: "Módulo", queEs: "Nombre del área (Bebidas, Caja, Personal…)." },
          { nombre: "Necesita", queEs: "Otras áreas que tienen que estar activas para usar esta (por ejemplo Obrador necesita Comidas)." },
          {
            nombre: "Dónde",
            queEs: "En qué tipo de centro se usa: «Todos», o solo Local (Caja, Reservas) u Obrador (Obrador).",
          },
          {
            nombre: "Centros activos",
            queEs: "En cuántos centros está activa, de cuántos donde se podría usar. Por ejemplo «5 de 7».",
            logica: "No cuenta los centros cerrados de forma definitiva. Para el núcleo y lo no contratado sale «—».",
          },
          {
            nombre: "Estado",
            queEs: "«Núcleo, siempre» (Organización, Usuarios y permisos, Proveedores: no se pueden desactivar), «Contratado» o «No contratado».",
          },
          { nombre: "Áreas contratadas (abajo)", queEs: "Cuántas áreas, sin contar el núcleo, tiene contratadas la cadena." },
        ],
      },
      {
        titulo: "Detalle al pulsar una fila",
        campos: [
          { nombre: "Qué incluye", queEs: "Para qué sirve el área." },
          { nombre: "Necesita", queEs: "Áreas de las que depende, o «Nada»." },
          { nombre: "Dependen de él", queEs: "Áreas que necesitan esta para funcionar, o «Ninguno»." },
          { nombre: "Desde", queEs: "Fecha en que la cadena la contrató por primera vez." },
          {
            nombre: "Texto del núcleo",
            queEs: "En las áreas del núcleo explica que no se pueden desactivar. Proveedores solo aparece si está contratada Bebidas, Comidas, Obrador o Contabilidad.",
          },
        ],
      },
      {
        titulo: "Activar y desactivar para toda la cadena",
        campos: [
          {
            nombre: "Activar …",
            queEs: "Contrata el área para la cadena.",
            logica:
              "Si necesita otra área que no está activa, sale el aviso «Antes hay que activar: …» y el botón no funciona. Los centros que ya tenían sus áreas elegidas la reciben activa si encaja con su tipo (queda en el historial de cada uno); los demás la usan sin hacer nada. Queda en el registro de cambios.",
            influye: "El área aparece en el menú y en la pantalla de inicio de quien tenga permiso, y sus permisos salen en las casillas de cada usuario.",
          },
          {
            nombre: "Desactivar …",
            queEs: "Quita el área a toda la cadena.",
            logica:
              "No borra nada: al volver a activarla, todo reaparece. Si otras áreas dependen de esta, se desactivan también: sale un aviso y hay que marcar la casilla «Lo entiendo, desactivar también …»; si no se marca, no se desactiva nada. Queda en el registro de cambios cada área desactivada.",
            influye: "El área desaparece del menú y de la pantalla de inicio para todos los usuarios.",
          },
        ],
      },
      {
        titulo: "Centros donde está activo",
        campos: [
          {
            nombre: "Casillas de centros",
            queEs: "En qué centros se usa esta área. Solo salen si el área está contratada y hay centros donde se puede usar.",
            logica:
              "Solo salen los centros del tipo adecuado, no cerrados de forma definitiva y que tú ves. Si no ves todos los centros, sale «Solo salen tus centros…»: en los demás el área se queda como esté. No se puede activar en un centro si el área que necesita no está activa allí, ni desactivarla si otra activa en ese centro depende de ella (sale el motivo con el nombre del centro).",
            influye: "En los centros desmarcados el área deja de salir. No se borra nada.",
          },
          {
            nombre: "Guardar centros",
            queEs:
              "Guarda en qué centros queda activa. Queda en el registro de cambios (qué centros cambiaron) y también en el historial de cada centro que cambia (acción «areas», «desde Módulos contratados»).",
          },
        ],
      },
    ],
    logica: [
      "Desactivar un área, para la cadena o en un centro, nunca borra sus datos.",
      "Lo mismo se puede cambiar centro a centro desde la pestaña «Áreas activas» de la ficha de cada centro.",
    ],
    influye: [
      { texto: "Áreas de cada centro", ruta: "/organizacion" },
      { texto: "Permisos que salen en las casillas", ruta: "/ajustes/usuarios/[id]/permisos" },
      { texto: "Integraciones de las áreas contratadas", ruta: "/ajustes/integraciones" },
    ],
  },

  "/ajustes/integraciones": {
    titulo: "Integraciones",
    area: AREA,
    paraQue:
      "Lista de las conexiones con programas externos (TPV, CoverManager, gestoría, bancos…) que traen las áreas contratadas. Todavía no hay ninguna conectada: aquí solo se apunta qué proveedor usa la cadena y notas. Mientras tanto, los datos se meten a mano.",
    quien:
      "Para verla, «Ver integraciones». Para apuntar proveedor y notas, «Apuntar proveedor y notas de una integración».",
    secciones: [
      {
        titulo: "Aviso",
        campos: [
          {
            nombre: "Nunca escribas claves ni contraseñas",
            queEs: "Aquí solo va el nombre del proveedor y notas. Las claves irán cifradas aparte cuando se haga cada conexión.",
          },
        ],
      },
      {
        titulo: "Lista de integraciones",
        campos: [
          { nombre: "Integración", queEs: "Nombre de la conexión (por ejemplo «Programa de caja (TPV)»)." },
          { nombre: "Módulo", queEs: "Área que la trae. Solo salen las de áreas contratadas." },
          { nombre: "Proveedor", queEs: "Programa o empresa apuntada, o «—»." },
          {
            nombre: "Estado",
            queEs: "«Pendiente» (no conectada), «Configurada», «Activa» o «Con error».",
            logica: "Desde esta pantalla no se cambia: seguirá «Pendiente» hasta que se construya cada conexión.",
          },
          { nombre: "Total (abajo)", queEs: "Cuántas integraciones salen." },
        ],
      },
      {
        titulo: "Detalle al pulsar una fila",
        campos: [
          { nombre: "Para qué", queEs: "Qué hará la conexión." },
          { nombre: "Última sincronización", queEs: "Cuándo se pasaron datos por última vez (vacío mientras no esté conectada)." },
          { nombre: "Último error", queEs: "Último fallo de la conexión, o «—»." },
          { nombre: "Notas", queEs: "Notas apuntadas." },
          {
            nombre: "Proveedor",
            queEs: "Por ejemplo Revo, CoverManager, A3… Máximo 80 caracteres.",
            logica: "Si parece una clave o contraseña, no se guarda y sale «No escribas claves ni contraseñas aquí».",
          },
          {
            nombre: "Notas (sin claves)",
            queEs: "Texto libre, máximo 2.000 caracteres.",
            logica:
              "Si el texto contiene palabras como contraseña, password, token o clave:, o una tira larga de letras y números que parece una clave, no se guarda.",
          },
          { nombre: "Guardar", queEs: "Apunta proveedor y notas. Sale «Integración apuntada». Queda en el registro de cambios el proveedor (no las notas)." },
        ],
      },
    ],
    influye: [
      { texto: "Las integraciones dependen de las áreas contratadas", ruta: "/ajustes/modulos" },
      { texto: "El paso «Conexiones» del asistente de apertura las muestra por local", ruta: "/organizacion/nuevo-local" },
    ],
  },

  "/ajustes/registro": {
    titulo: "Registro de cambios",
    area: AREA,
    paraQue:
      "Historial de quién cambió qué y cuándo en toda la cadena: usuarios, permisos, áreas, centros, marcas, sociedades, integraciones y, de las demás áreas, lo que toca dinero, stock, precios o personal. Muestra los 300 últimos cambios.",
    quien: "Solo con el permiso «Ver el registro de cambios» (por defecto, administrador y dirección).",
    secciones: [
      {
        titulo: "Filtro",
        campos: [
          {
            nombre: "Todo / tipo de dato",
            queEs: "Elige de qué tipo de dato quieres ver los cambios. Los nombres son los internos del programa.",
            logica:
              "Algunos: «Centro» (datos, horario, áreas, estado y usuarios de un centro), «CentroModulo» (centros de un área, desde Módulos contratados), «TenantModulo» (activar o desactivar un área para la cadena), «Usuario», «Marca», «Sociedad», «Integracion». Solo salen los tipos que ya tienen algún cambio.",
          },
          { nombre: "Filtrar", queEs: "Aplica el filtro." },
        ],
      },
      {
        titulo: "Lista de cambios",
        campos: [
          { nombre: "Fecha", queEs: "Día y hora del cambio. Los más recientes, arriba." },
          { nombre: "Qué", queEs: "Tipo de dato cambiado." },
          {
            nombre: "Acción",
            queEs: "Qué se hizo.",
            logica:
              "Por ejemplo: crear, editar, activar, desactivar, permisos, contrasena (cambio de contraseña, sin guardarla), horario, areas, abrir, cerrar, estado, plantilla, centros, usuarios, copiar-productos.",
          },
          { nombre: "Quién", queEs: "Usuario que lo hizo; «Sistema» si lo hizo el programa solo." },
          {
            nombre: "Referencia",
            queEs: "Código interno del dato cambiado (o el nombre interno del área). Sirve para distinguir cambios del mismo tipo.",
          },
          {
            nombre: "Antes / Después (al pulsar la fila)",
            queEs: "Los datos como estaban y como quedaron.",
            logica: "Nunca se guardan contraseñas; del IBAN solo las 4 últimas cifras.",
          },
          { nombre: "Total (abajo)", queEs: "Cuántos cambios salen." },
        ],
      },
    ],
    logica: ["Los cambios no se pueden borrar ni modificar desde el ERP."],
    influye: [
      { texto: "Historial de un centro concreto (pestaña Historial)", ruta: "/organizacion/centros/[id]" },
      { texto: "Cambios de usuarios y permisos", ruta: "/ajustes/usuarios" },
    ],
  },
};
