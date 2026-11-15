import type { AyudaArea } from "../tipos";

export const AYUDA_EVENTOS: AyudaArea = {
  "/eventos": {
    titulo: "Solicitudes de eventos",
    area: "Eventos",
    paraQue:
      "Lista de todas las peticiones de grupos, comidas de empresa, Navidad, celebraciones y catering del grupo, con el embudo de ventas: cuántas hay en cada paso, desde que entran hasta que se celebran o se pierden.",
    quien:
      "Para verla hace falta el permiso «Ver eventos». Para crear solicitudes y cambiar su estado hace falta «Gestionar solicitudes y presupuestos».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Nueva solicitud",
            queEs: "Abre el formulario para apuntar una petición nueva. Solo sale con el permiso de gestionar.",
          },
        ],
      },
      {
        titulo: "Embudo (cifras de arriba)",
        campos: [
          {
            nombre: "Nueva, Contactada, Presupuesto enviado, Aceptada, Celebrada, Perdida",
            queEs: "Número de solicitudes en cada estado y, debajo, la suma de personas de esas solicitudes.",
            logica:
              "Cuentan todas las solicitudes que puedes ver, sin tener en cuenta la búsqueda ni el tipo elegidos abajo. «Nueva» sale en naranja si hay alguna sin atender; «Aceptada» en verde; «Perdida» en rojo.",
          },
          {
            nombre: "Pulsar una cifra",
            queEs: "Filtra la lista por ese estado (sale «filtrado» debajo). Volver a pulsarla quita el filtro.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar por contacto, empresa o número", queEs: "Busca en el nombre de contacto, la empresa o el número de solicitud (EV-…). No distingue mayúsculas." },
          { nombre: "Tipo", queEs: "Empresa, Celebración, Navidad, Catering u Otro. «Todos los tipos» quita el filtro." },
          { nombre: "Filtrar", queEs: "Aplica la búsqueda y el tipo (respetando el estado elegido en el embudo)." },
          { nombre: "Quitar filtros", queEs: "Vuelve a la lista completa." },
        ],
      },
      {
        titulo: "Tabla de solicitudes",
        campos: [
          { nombre: "Número", queEs: "Número de la solicitud (serie EV). Al pulsarlo se abre su ficha." },
          { nombre: "Fecha", queEs: "Día y hora del evento, o «Sin fecha» si aún no se sabe." },
          { nombre: "Contacto", queEs: "Persona de contacto y, en gris, la empresa." },
          { nombre: "Tipo", queEs: "Tipo de evento." },
          { nombre: "Pers.", queEs: "Número de personas." },
          {
            nombre: "Local / marca",
            queEs: "Local asignado; si no hay, la marca preferida; si el cliente pidió que le recomendemos, la etiqueta «Recomendar».",
          },
          {
            nombre: "Presupuesto",
            queEs: "Total del último presupuesto hecho. Si aún no hay, lo que el cliente dijo que quería gastar, en gris y con asterisco (*).",
          },
          { nombre: "Estado", queEs: "Estado de la solicitud. Las filas en estado «Nueva» salen en naranja." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Teléfono y Correo", queEs: "Datos de contacto." },
          {
            nombre: "Origen",
            queEs: "Por dónde llegó, tal como está guardado: TELEFONO, CORREO, WEB, MANUAL (en persona) o RESERVA (grupo grande que venía de Reservas).",
          },
          { nombre: "Marca", queEs: "Marca preferida o asignada." },
          { nombre: "Lo que quiere gastar", queEs: "Presupuesto total que indicó el cliente." },
          { nombre: "Último presupuesto", queEs: "Número, versión y total del último presupuesto hecho." },
          { nombre: "Motivo de pérdida", queEs: "Por qué se perdió (solo si está perdida)." },
          { nombre: "Recibida", queEs: "Día y hora en que se apuntó la solicitud." },
          { nombre: "Notas", queEs: "Notas de la solicitud, debajo de los datos." },
          { nombre: "Abrir y presupuestar", queEs: "Abre la ficha completa de la solicitud." },
          {
            nombre: "Pasar a «…»",
            queEs: "Cambia la solicitud al siguiente estado permitido.",
            logica:
              "Aquí no sale «Perdida» porque pide el motivo: eso se hace en la ficha. Los pasos permitidos son los mismos que en la ficha.",
          },
        ],
      },
    ],
    logica: [
      "Se ven las solicitudes de los locales elegidos en el selector de centro y también las que aún no tienen local.",
      "La lista se ordena por fecha del evento (las que no tienen fecha al final) y enseña como mucho 300.",
      "Estados: Nueva → Contactada → Presupuesto enviado → Aceptada → Celebrada. En cualquier momento antes de celebrarse se puede marcar como Perdida, y una perdida puede volver a Nueva.",
    ],
    influye: [
      { texto: "Los grupos grandes de Reservas entran aquí como solicitudes nuevas", ruta: "/reservas/reglas" },
      { texto: "Cada solicitud crea o reutiliza la ficha del cliente", ruta: "/clientes" },
    ],
    comoSeUsa: [
      "Empieza cada día por las solicitudes en «Nueva» (pulsa la cifra naranja).",
      "Llama al cliente, pásala a «Contactada» y prepara el presupuesto en su ficha.",
    ],
  },

  "/eventos/nueva": {
    titulo: "Nueva solicitud de evento",
    area: "Eventos",
    paraQue: "Formulario para apuntar una petición de grupo, empresa, Navidad, celebración o catering que llega por teléfono, correo, web o en persona.",
    quien: "Hace falta el permiso «Gestionar solicitudes y presupuestos».",
    secciones: [
      {
        titulo: "Datos de la solicitud",
        campos: [
          { nombre: "Tipo", queEs: "Empresa, Celebración (por defecto), Navidad, Catering u Otro." },
          { nombre: "Personas", queEs: "Número de personas (de 1 a 2.000). Por defecto 20." },
          { nombre: "Fecha y Hora", queEs: "Día y hora del evento. Se pueden dejar en blanco si aún no se saben." },
          { nombre: "Contacto", queEs: "Nombre de la persona de contacto. Obligatorio." },
          { nombre: "Empresa", queEs: "Empresa que organiza, si la hay." },
          {
            nombre: "Teléfono y Correo",
            queEs: "Datos de contacto. Hace falta al menos uno de los dos.",
            logica: "El teléfono se guarda en la ficha del cliente en formato internacional (+34…).",
          },
          {
            nombre: "Marca preferida",
            queEs: "Marca en la que quiere el evento, o «Cualquiera».",
            logica: "Si no se elige marca pero sí local, se toma la marca del local.",
            influye: "En la ficha, los menús de grupo que se ofrecen para el presupuesto son los de esa marca y los generales.",
          },
          { nombre: "Local preferido", queEs: "Local concreto, o «Sin decidir». Salen los locales abiertos que tienes asignados." },
          {
            nombre: "Presupuesto del cliente (€)",
            queEs: "Lo que el cliente dice que quiere gastar en total. Es solo informativo.",
            influye: "Sale en la lista con asterisco mientras no haya un presupuesto nuestro.",
          },
          { nombre: "Origen", queEs: "Teléfono (por defecto), Correo, Formulario web o En persona." },
          { nombre: "El cliente pide que le recomendemos local y espacio", queEs: "Márcalo si no sabe dónde: en la lista sale la etiqueta «Recomendar»." },
          { nombre: "Notas", queEs: "Qué celebran, alergias, montaje, horario…" },
          {
            nombre: "Guardar solicitud",
            queEs: "Guarda la solicitud en estado «Nueva» con su número (serie EV) y abre su ficha.",
            logica:
              "Si la cadena tiene Clientes, se busca el cliente por teléfono o correo y, si no existe, se crea con origen «Evento». El usuario que la crea queda como responsable.",
          },
        ],
      },
    ],
    influye: [
      { texto: "La solicitud aparece en la lista y en el embudo", ruta: "/eventos" },
      { texto: "Crea o reutiliza la ficha del cliente", ruta: "/clientes" },
    ],
  },

  "/eventos/[id]": {
    titulo: "Ficha del evento",
    area: "Eventos",
    paraQue:
      "Todo lo de una solicitud de evento: datos del cliente, cambio de estado, presupuestos con menú de grupo y extras, local y espacio asignados, ocupación del espacio ese día e historial.",
    quien:
      "Para verla hace falta «Ver eventos». Para cambiar estado, asignar local y hacer presupuestos hace falta «Gestionar solicitudes y presupuestos».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Título", queEs: "Número de la solicitud y contacto. Debajo: tipo, personas, fecha y hora." },
          { nombre: "Volver", queEs: "Vuelve a la lista de solicitudes." },
        ],
      },
      {
        titulo: "Solicitud",
        campos: [
          { nombre: "Estado (arriba a la derecha)", queEs: "Estado actual de la solicitud." },
          { nombre: "Contacto, Empresa, Teléfono, Correo", queEs: "Datos de contacto." },
          { nombre: "Marca", queEs: "Marca del evento, o «Pide recomendación» si el cliente lo pidió." },
          { nombre: "Local", queEs: "Local asignado o «Sin asignar»." },
          { nombre: "Espacio", queEs: "Espacio asignado (del área Reservas) con su aforo." },
          { nombre: "Quiere gastar", queEs: "Presupuesto total que indicó el cliente." },
          { nombre: "Origen", queEs: "Por dónde llegó (TELEFONO, CORREO, WEB, MANUAL o RESERVA)." },
          { nombre: "Cliente", queEs: "Enlace «Ver ficha» a la ficha del cliente." },
          { nombre: "Motivo de pérdida", queEs: "Por qué se perdió, si está perdida." },
          { nombre: "Recibida", queEs: "Cuándo se apuntó." },
          {
            nombre: "Pasar a «…»",
            queEs: "Cambia al siguiente estado permitido.",
            logica:
              "Desde Nueva: Contactada o Presupuesto enviado. Desde Contactada: Presupuesto enviado. Desde Presupuesto enviado: Aceptada o volver a Contactada. Desde Aceptada: Celebrada. Desde Perdida: volver a Nueva (se borra el motivo). Una celebrada ya no cambia.",
          },
          {
            nombre: "Motivo y «Marcar como perdida»",
            queEs: "Da la solicitud por perdida. El motivo es obligatorio (precio, fecha, otro local…).",
            logica: "Se puede desde cualquier estado menos Celebrada y Perdida.",
            influye: "El motivo sale en la lista y en el historial; cuenta en la cifra «Perdida» del embudo.",
          },
        ],
      },
      {
        titulo: "Presupuestos",
        campos: [
          { nombre: "Número", queEs: "Número del presupuesto (serie PRE)." },
          { nombre: "Versión", queEs: "v1, v2… cada presupuesto nuevo de la misma solicitud es una versión más." },
          { nombre: "Total", queEs: "Suma de los importes de todas las líneas, con IVA incluido." },
          { nombre: "Señal", queEs: "Importe de señal pedido al cliente, si se puso." },
          { nombre: "Estado", queEs: "Borrador, Enviado, Aceptado o Rechazado." },
          { nombre: "Fecha", queEs: "Día en que se hizo." },
          {
            nombre: "Líneas del presupuesto (al desplegar): Concepto, Cantidad, Precio, IVA, Importe",
            queEs: "Cada línea: el menú (cantidad = personas) y los extras.",
            logica: "Importe = cantidad × precio, redondeado a céntimos. Los precios llevan el IVA incluido. Los extras se guardan con IVA del 10 %.",
          },
          { nombre: "Condiciones", queEs: "Texto de condiciones del presupuesto." },
          { nombre: "Enviado / Aceptado", queEs: "Fecha y hora en que se marcó como enviado y como aceptado." },
          {
            nombre: "Marcar como enviado",
            queEs: "Sale en los borradores. Apunta la fecha de envío.",
            logica: "Si la solicitud estaba en Nueva o Contactada, pasa sola a «Presupuesto enviado» (queda en el historial).",
          },
          {
            nombre: "El cliente lo acepta / El cliente lo rechaza",
            queEs: "Salen en los presupuestos enviados.",
            logica:
              "Al aceptar se apunta la fecha y la solicitud pasa sola a «Aceptada» (si no estaba celebrada). Rechazar solo cambia el presupuesto; la solicitud sigue igual.",
          },
        ],
      },
      {
        titulo: "Nuevo presupuesto",
        campos: [
          {
            nombre: "Menú de grupo",
            queEs: "Menú cerrado con su precio por persona. Salen los menús activos de la marca del evento y los que valen para todas las marcas.",
            logica: "Si el número de personas es menor que el mínimo del menú, sale un error.",
          },
          { nombre: "Personas", queEs: "Personas a las que se aplica el menú. Viene puesto el número de la solicitud." },
          { nombre: "Señal (€)", queEs: "Señal que se pide para bloquear la fecha. Opcional." },
          {
            nombre: "Extras",
            queEs: "Una línea por extra, con este formato: concepto;cantidad;precio con IVA. Ejemplo: Barra libre 1 h;40;12,50",
            logica: "Admite coma decimal. Si una línea no tiene ese formato, sale un error que la señala. Hace falta un menú o al menos un extra.",
          },
          { nombre: "Condiciones", queEs: "Texto que acompaña al presupuesto. Viene un texto habitual que puedes cambiar." },
          {
            nombre: "Crear presupuesto",
            queEs: "Crea el presupuesto en estado Borrador como versión siguiente.",
            logica: "Solo se puede mientras la solicitud no esté Celebrada ni Perdida. Queda registrado en el registro de cambios de la cadena.",
          },
        ],
      },
      {
        titulo: "Local, espacio y fecha",
        campos: [
          { nombre: "Local", queEs: "Local donde se hará el evento. «Sin asignar» lo deja sin local." },
          {
            nombre: "Espacio",
            queEs: "Espacio del local (del área Reservas), con su tipo y aforo. Solo sale si la cadena tiene Reservas.",
          },
          { nombre: "Fecha y Hora", queEs: "Día y hora del evento. Si se dejan en blanco, se mantienen las que había." },
          {
            nombre: "Guardar",
            queEs: "Guarda local, espacio, fecha y hora.",
            logica: "Si se elige local, la marca del evento pasa a ser la del local. Solo se puede mientras la solicitud no esté Celebrada ni Perdida.",
          },
        ],
      },
      {
        titulo: "Ocupación del espacio ese día",
        campos: [
          {
            nombre: "Aviso de aforo",
            queEs: "Sale en rojo si el aforo del espacio es menor que el número de personas del grupo.",
          },
          {
            nombre: "Lista de reservas",
            queEs: "Reservas de ese espacio ese día (hora, nombre y personas), o «Sin reservas en este espacio ese día».",
            logica:
              "Cuentan las reservas activas (Solicitada, Confirmada, Ha llegado, Sentada) que piden ese espacio o tienen mesa en él, a cualquier hora del día. No incluye otros eventos.",
          },
        ],
      },
      {
        titulo: "Historial",
        campos: [
          {
            nombre: "Cada línea",
            queEs: "Fecha y hora, estado de antes → estado nuevo y la nota (motivo de pérdida, presupuesto enviado o aceptado, grupo pasado desde Reservas…).",
          },
        ],
      },
    ],
    logica: [
      "Aceptar un evento no bloquea mesas ni crea reservas en el área Reservas: hay que tenerlo en cuenta al dar reservas ese día en ese espacio.",
    ],
    influye: [
      { texto: "El estado cuenta en el embudo de la lista", ruta: "/eventos" },
      { texto: "Los menús que se ofrecen se crean en", ruta: "/eventos/menus" },
      { texto: "Los espacios y su aforo vienen de", ruta: "/reservas/mesas" },
      { texto: "Las reservas del día del espacio se ven en", ruta: "/reservas" },
    ],
    comoSeUsa: [
      "Asigna local, espacio y fecha y mira la ocupación del espacio.",
      "Crea el presupuesto con un menú y extras, envíalo y márcalo como enviado.",
      "Cuando el cliente confirme, pulsa «El cliente lo acepta»; después del evento, «Pasar a Celebrada».",
    ],
  },

  "/eventos/menus": {
    titulo: "Menús de grupo",
    area: "Eventos",
    paraQue: "Menús cerrados para grupos, con precio por persona y mínimo de comensales, que se usan para hacer presupuestos de eventos.",
    quien: "Para verlos hace falta «Ver eventos». Para crearlos, cambiarlos o desactivarlos hace falta el permiso «Editar menús de grupo».",
    secciones: [
      {
        titulo: "Tabla de menús",
        campos: [
          { nombre: "Menú", queEs: "Nombre del menú." },
          { nombre: "Marca", queEs: "Marca a la que pertenece, o «Todas» si vale para todas." },
          { nombre: "Precio / persona", queEs: "Precio por comensal con IVA incluido." },
          { nombre: "Mínimo", queEs: "Número mínimo de personas para poder ofrecerlo." },
          { nombre: "Estado", queEs: "Activo o Desactivado." },
          { nombre: "Detalle: Descripción, IVA y platos", queEs: "Texto del menú, su tipo de IVA y la lista de platos." },
          {
            nombre: "Desactivar menú / Volver a activar",
            queEs: "Un menú no se borra: se desactiva.",
            logica: "Un menú desactivado ya no se ofrece en los presupuestos nuevos. Los presupuestos ya hechos no cambian.",
          },
        ],
      },
      {
        titulo: "Formulario del menú (al desplegar o «Nuevo menú»)",
        campos: [
          { nombre: "Nombre", queEs: "Nombre del menú. Obligatorio." },
          {
            nombre: "Marca",
            queEs: "Marca del menú o «Todas las marcas».",
            influye: "En la ficha del evento solo se ofrecen los menús de la marca del evento y los de todas las marcas.",
          },
          { nombre: "Precio por persona (IVA incl.)", queEs: "Precio por comensal. Tiene que ser mayor que cero." },
          { nombre: "IVA %", queEs: "Tipo de IVA del menú (de 0 a 21). Por defecto 10." },
          { nombre: "Mínimo de personas", queEs: "Mínimo de comensales. Por defecto 10." },
          { nombre: "Descripción", queEs: "Frase corta que describe el menú." },
          { nombre: "Platos", queEs: "Un plato por línea." },
          {
            nombre: "Crear menú / Guardar menú",
            queEs: "Guarda el menú.",
            logica: "Crear un menú y cambiar su precio quedan anotados en el registro de cambios de la cadena, con el precio de antes y el nuevo.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Los menús activos se usan al presupuestar cada evento", ruta: "/eventos/[id]" },
      { texto: "Cambios de precio en el registro de cambios", ruta: "/ajustes/registro" },
    ],
  },
};
