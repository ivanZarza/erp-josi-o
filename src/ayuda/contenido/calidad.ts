import type { AyudaArea, SeccionAyuda } from "../tipos";

/** Las cuatro cifras que salen arriba en Tareas de hoy, Temperaturas, Incidencias y Mantenimiento. */
const CIFRAS_CALIDAD: SeccionAyuda = {
  titulo: "Cifras de arriba",
  campos: [
    {
      nombre: "Listas pendientes hoy",
      queEs: "Listas APPCC de la jornada que aún no se han firmado. Al pulsarla va a «Tareas de hoy».",
      logica: "Solo se calcula en «Tareas de hoy»; en las otras pantallas sale «—».",
    },
    {
      nombre: "Alarmas de temperatura (24 h)",
      queEs: "Lecturas de temperatura fuera de rango en las últimas 24 horas. Rojo si hay alguna. Al pulsarla va a «Temperaturas».",
    },
    {
      nombre: "Incidencias abiertas",
      queEs: "Incidencias en estado Abierta o En curso. Naranja si hay alguna. Al pulsarla va a «Incidencias».",
    },
    {
      nombre: "Mantenimientos vencidos",
      queEs: "Tareas de mantenimiento activas cuya próxima fecha es anterior a la jornada en curso de su centro. Rojo si hay alguna. Al pulsarla va a «Mantenimiento».",
    },
  ],
};

export const AYUDA_CALIDAD: AyudaArea = {
  "/calidad": {
    titulo: "Calidad · tareas de hoy",
    area: "Calidad",
    paraQue:
      "Las listas de comprobación de higiene (APPCC) que cada centro tiene que hacer hoy: apertura, cierre, limpieza, recepción de mercancía… Aquí se rellenan y se firman, y se ve lo hecho en los últimos 7 días.",
    quien:
      "Para verla hace falta «Ver calidad». Para rellenar y firmar listas hace falta «Registrar controles».",
    secciones: [
      CIFRAS_CALIDAD,
      {
        titulo: "Listas de hoy",
        campos: [
          {
            nombre: "Centro",
            queEs: "Centro donde hay que hacer la lista.",
            logica: "Una lista para «todos los centros» sale una vez por cada centro elegido arriba.",
          },
          { nombre: "Lista", queEs: "Nombre de la lista." },
          { nombre: "Tipo", queEs: "Apertura, Cierre, Limpieza, Recepción de mercancía u Otra." },
          { nombre: "Puntos", queEs: "Número de puntos a comprobar." },
          {
            nombre: "Estado",
            queEs: "Pendiente, Hecha (todo correcto) o Con fallos (alguno no conforme; la fila sale en rojo).",
          },
          { nombre: "Hecha por", queEs: "Quién la firmó y cuándo." },
          {
            nombre: "Total (abajo)",
            queEs: "Número de listas del día y cuántas siguen pendientes.",
          },
        ],
      },
      {
        titulo: "Rellenar una lista (al desplegar una pendiente)",
        campos: [
          {
            nombre: "Casilla de cada punto",
            queEs: "Marcada quiere decir correcto. Vienen todas marcadas: desmarca las que no estén bien.",
          },
          {
            nombre: "Dato (°C, n.º albarán…)",
            queEs: "Sale en los puntos que piden un dato. Es obligatorio.",
          },
          {
            nombre: "Observaciones",
            queEs: "Qué pasa y qué se ha hecho.",
            logica: "Obligatorias si algún punto queda sin marcar.",
          },
          {
            nombre: "Firmar la lista",
            queEs: "Guarda la lista de hoy a tu nombre, con fecha y hora.",
            logica:
              "Cada lista se puede firmar una sola vez por centro y jornada; después ya no se puede cambiar. Si hay puntos no conformes, se abre sola una incidencia de seguridad alimentaria de prioridad media con plazo de un día, con los puntos fallidos y las observaciones.",
            influye: "La incidencia aparece en Incidencias con origen «Lista APPCC».",
          },
          {
            nombre: "Lista ya hecha (al desplegar)",
            queEs: "Cada punto con su dato y su resultado (Correcto o No conforme), y las observaciones.",
          },
        ],
      },
      {
        titulo: "Últimos 7 días",
        campos: [
          { nombre: "Día, Centro, Lista", queEs: "Jornada, centro y nombre de la lista firmada." },
          { nombre: "Resultado", queEs: "Correcta o Con fallos (fila en rojo)." },
          { nombre: "Hecha por", queEs: "Quién la firmó." },
          { nombre: "Detalle", queEs: "Al desplegar: cada punto, su dato y su resultado, y las observaciones." },
        ],
      },
    ],
    logica: [
      "Cada centro cierra la jornada a su hora de corte (la de su ficha en Organización; 05:00 si no se ha cambiado), en hora de Madrid: lo que se firma de madrugada, antes de esa hora, cuenta para el día anterior. Si los centros elegidos están en jornadas distintas, cada fila dice la suya.",
      "Salen las listas activas que valen para todos los centros o para cada centro elegido arriba, con sus puntos activos.",
      "Si un día no se firma una lista, queda sin hacer: no se puede firmar después para ese día.",
    ],
    influye: [
      { texto: "Las listas y sus puntos se preparan en", ruta: "/calidad/plantillas" },
      { texto: "Los fallos abren incidencias", ruta: "/calidad/incidencias" },
    ],
    comoSeUsa: [
      "Al abrir, el encargado despliega la lista de apertura, revisa cada punto y la firma.",
      "Si algo no está bien, desmarca el punto y explica en observaciones qué se ha hecho.",
    ],
  },

  "/calidad/temperaturas": {
    titulo: "Temperaturas",
    area: "Calidad",
    paraQue:
      "Registro de la temperatura de cámaras, neveras y arcones de cada centro, con su rango permitido. Una lectura fuera de rango abre sola una incidencia.",
    quien:
      "Para verla hace falta «Ver calidad». Para apuntar lecturas, «Registrar controles». Para dar de alta o de baja equipos, «Editar plan APPCC».",
    secciones: [
      CIFRAS_CALIDAD,
      {
        titulo: "Equipos de frío",
        campos: [
          { nombre: "Centro", queEs: "Centro del equipo." },
          { nombre: "Equipo", queEs: "Nombre y tipo: cámara de refrigeración, de congelación, nevera, arcón congelador, mesa fría u otro." },
          { nombre: "Rango", queEs: "Temperatura mínima y máxima permitidas." },
          { nombre: "Última", queEs: "Última temperatura apuntada." },
          { nombre: "Cuándo", queEs: "Día y hora de la última lectura, o «Nunca»." },
          {
            nombre: "Estado",
            queEs: "Correcta, Fuera de rango (fila en rojo) o Sin lectura en 24 h (fila en naranja).",
            logica: "«Fuera de rango» mira solo la última lectura. «Sin lectura en 24 h» sale si la última lectura tiene más de 24 horas o no hay ninguna.",
          },
        ],
      },
      {
        titulo: "Detalle del equipo",
        campos: [
          {
            nombre: "Temperatura (°C)",
            queEs: "Lectura que marca el termómetro. Admite coma decimal (3,5).",
            logica: "Tiene que estar entre −60 y 80 °C.",
          },
          {
            nombre: "Acción correctora (si está fuera de rango)",
            queEs: "Qué se ha hecho: avisar al técnico, pasar el género a otra cámara…",
            logica: "Obligatoria si la lectura queda por debajo de la mínima o por encima de la máxima.",
          },
          {
            nombre: "Registrar",
            queEs: "Guarda la lectura a tu nombre con la hora de ahora.",
            logica:
              "Si está fuera de rango, se abre sola una incidencia de tipo Temperatura, prioridad alta y plazo de un día, con el rango y la acción correctora, y sale el aviso «se ha abierto una incidencia».",
            influye: "Cuenta en «Alarmas de temperatura (24 h)» y la incidencia aparece en Incidencias.",
          },
          { nombre: "Alarmas en 24 h", queEs: "Lecturas fuera de rango de este equipo en las últimas 24 horas (entre las 10 últimas)." },
          { nombre: "Sonda", queEs: "Sonda automática conectada, o «Sin sonda (lectura a mano)»." },
          {
            nombre: "Tabla de lecturas (Cuándo, Temperatura, Acción correctora, Quién)",
            queEs: "Las 10 últimas lecturas. Las fuera de rango salen en rojo.",
          },
          {
            nombre: "Dar de baja el equipo",
            queEs: "Quita el equipo de la lista. Sus lecturas se conservan.",
            logica: "No se borra: pasa a la tabla «Equipos dados de baja», desde donde se puede volver a dar de alta.",
          },
        ],
      },
      {
        titulo: "Equipos dados de baja",
        campos: [
          { nombre: "Centro, Equipo, Rango, Última lectura", queEs: "Equipos de los centros elegidos arriba que se dieron de baja. Solo sale la tabla si hay alguno y tienes permiso «Editar plan APPCC»." },
          {
            nombre: "Volver a dar de alta",
            queEs: "Devuelve el equipo a la lista con su rango y sus lecturas de antes.",
            influye: "Vuelve a contar en el estado «Sin lectura en 24 h» y en las alarmas.",
          },
        ],
      },
      {
        titulo: "Nuevo equipo de frío",
        campos: [
          { nombre: "Centro", queEs: "Centro donde está. Salen los centros elegidos arriba." },
          { nombre: "Nombre", queEs: "Cómo lo llamáis: Cámara de carnes…" },
          { nombre: "Tipo", queEs: "Tipo de equipo." },
          {
            nombre: "Mínima (°C) / Máxima (°C)",
            queEs: "Rango permitido. Por defecto de 0 a 4 °C.",
            logica: "La mínima tiene que ser menor que la máxima.",
          },
          { nombre: "Añadir equipo", queEs: "Da de alta el equipo." },
        ],
      },
      {
        titulo: "Abajo de las cifras",
        campos: [{ nombre: "Sondas de temperatura", queEs: "Conexión pendiente: las sondas leerán cada equipo solas y darán la alarma al momento." }],
      },
    ],
    influye: [{ texto: "Las lecturas fuera de rango abren incidencias", ruta: "/calidad/incidencias" }],
  },

  "/calidad/incidencias": {
    titulo: "Incidencias",
    area: "Calidad",
    paraQue:
      "Averías, quejas, accidentes, fallos de seguridad alimentaria y alarmas de temperatura, cada una con su responsable, prioridad y plazo, hasta que se resuelven.",
    quien:
      "Para verla hace falta «Ver calidad». Para abrir incidencias, «Registrar controles». Para cambiarlas (estado, responsable, plazo, solución), «Gestionar incidencias».",
    secciones: [
      CIFRAS_CALIDAD,
      {
        titulo: "Pestañas",
        campos: [
          { nombre: "Pendientes", queEs: "Incidencias Abiertas y En curso. Es la vista por defecto." },
          { nombre: "Resueltas / Anuladas / Todas", queEs: "Las resueltas, las anuladas o todas." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Número", queEs: "Número de la incidencia (serie INC)." },
          { nombre: "Centro", queEs: "Centro donde pasa." },
          { nombre: "Qué pasa", queEs: "Título de la incidencia." },
          { nombre: "Tipo", queEs: "Avería, Queja, Accidente, Seguridad alimentaria, Temperatura u Otra." },
          { nombre: "Responsable", queEs: "Persona encargada, o «Sin asignar»." },
          {
            nombre: "Plazo",
            queEs: "Fecha límite para resolverla.",
            logica: "Si está Abierta o En curso y el plazo es anterior a la jornada en curso de su centro (hora de Madrid y hora de corte del centro), sale «Vencida» en rojo y la fila en rojo.",
          },
          {
            nombre: "Estado",
            queEs: "Abierta, En curso, Resuelta o Anulada.",
            logica: "Una incidencia Abierta de prioridad alta sale con la fila en naranja.",
          },
        ],
      },
      {
        titulo: "Detalle de la incidencia",
        campos: [
          { nombre: "Prioridad", queEs: "Alta, media o baja." },
          {
            nombre: "Origen",
            queEs: "Dada de alta a mano, Lista APPCC (un punto no conforme), Alarma de temperatura o Retirada de lote del obrador.",
          },
          { nombre: "Abierta por", queEs: "Quién la abrió y cuándo." },
          { nombre: "Resuelta", queEs: "Cuándo se dio por resuelta." },
          { nombre: "Foto", queEs: "Aún no se pueden subir fotos." },
          { nombre: "Descripción", queEs: "Texto de la incidencia (en las automáticas, los puntos fallidos o la temperatura y la acción correctora)." },
          {
            nombre: "Estado, Prioridad, Responsable, Plazo, Solución o motivo y «Guardar»",
            queEs: "Cambian la incidencia. Solo salen mientras está Abierta o En curso.",
            logica:
              "Para pasarla a «Resuelta» hay que escribir la solución (se apunta la fecha de resolución); para «Anulada», el motivo en la misma casilla. Una vez Resuelta o Anulada ya no se puede cambiar ni volver a abrir: si el problema vuelve, se abre una incidencia nueva. Dejar el plazo o la solución en blanco no borra lo que ya había. El responsable tiene que ver el centro de la incidencia. Cada cambio de estado queda en el registro de cambios (con el motivo, si se anula).",
            influye: "Cuenta en «Incidencias abiertas» mientras esté Abierta o En curso.",
          },
          { nombre: "Solución / Motivo de la anulación", queEs: "En las resueltas y anuladas, o sin permiso de gestión, solo se ve el texto: la solución o el motivo de la anulación." },
        ],
      },
      {
        titulo: "Nueva incidencia",
        campos: [
          { nombre: "Centro", queEs: "Centro donde pasa. Salen los centros elegidos arriba." },
          { nombre: "Tipo", queEs: "Tipo de incidencia. Por defecto Avería." },
          { nombre: "Qué ha pasado", queEs: "Título corto. Obligatorio." },
          { nombre: "Detalle", queEs: "Explicación más larga." },
          { nombre: "Prioridad", queEs: "Alta, Media (por defecto) o Baja." },
          { nombre: "Responsable", queEs: "Usuario encargado.", logica: "Con un solo centro elegido arriba, salen los usuarios activos que ven ese centro (los que lo tienen asignado y los que ven todos los centros); con varios, los que ven alguno de ellos. Si eliges a alguien que no ve el centro de la incidencia, sale un aviso y no se guarda." },
          { nombre: "Plazo", queEs: "Fecha límite. Opcional." },
          { nombre: "Abrir incidencia", queEs: "Crea la incidencia en estado Abierta con su número." },
        ],
      },
    ],
    logica: [
      "Solo salen las incidencias de los centros elegidos arriba, las 300 más recientes.",
      "Las incidencias no se borran: se resuelven o se anulan.",
      "Las automáticas (APPCC, temperatura, lote) se abren con plazo hasta el día siguiente a la jornada en curso de su centro.",
    ],
    influye: [
      { texto: "Llegan solas de las listas APPCC con fallos", ruta: "/calidad" },
      { texto: "de las lecturas fuera de rango", ruta: "/calidad/temperaturas" },
      { texto: "y de las retiradas de lotes del obrador", ruta: "/obrador/lotes" },
      { texto: "Los cambios de estado quedan en el registro de cambios", ruta: "/ajustes/registro" },
    ],
  },

  "/calidad/mantenimiento": {
    titulo: "Mantenimiento preventivo",
    area: "Calidad",
    paraQue:
      "Tareas que hay que repetir cada cierto tiempo (campanas, extintores, cámaras, desratización…) con la empresa que las hace, para que no se pase ninguna fecha.",
    quien:
      "Para verla hace falta «Ver calidad». Para marcar una tarea como hecha, «Registrar controles». Para crear o dar de baja tareas, «Editar plan APPCC».",
    secciones: [
      CIFRAS_CALIDAD,
      {
        titulo: "Calendario de 3 meses",
        campos: [
          {
            nombre: "Tarjeta de cada mes",
            queEs: "Las tareas que tocan ese mes (fecha, tarea y centro), del mes actual y los dos siguientes.",
            logica: "Las vencidas se ponen en el mes actual con la etiqueta «Vencida».",
          },
        ],
      },
      {
        titulo: "Tabla de tareas",
        campos: [
          { nombre: "Centro", queEs: "Centro de la tarea." },
          { nombre: "Tarea", queEs: "Nombre de la tarea y el equipo, si se indicó." },
          {
            nombre: "Periodicidad",
            queEs: "Cada cuánto se hace, en palabras.",
            logica: "Múltiplos de 365 días salen como años, de 30 como meses y de 7 como semanas; si no, en días.",
          },
          { nombre: "Empresa", queEs: "Empresa que lo hace, o «Personal propio»." },
          { nombre: "Última vez", queEs: "Fecha de la última vez que se hizo." },
          {
            nombre: "Próxima",
            queEs: "Fecha en que toca la próxima vez.",
            logica: "En rojo si ya pasó (vencida) y en naranja si falta una semana o menos. La fila se colorea igual.",
          },
        ],
      },
      {
        titulo: "Detalle de la tarea",
        campos: [
          { nombre: "Notas", queEs: "Notas de la tarea." },
          { nombre: "Días para la próxima", queEs: "Días que faltan. En negativo, días de retraso." },
          { nombre: "Hecho el", queEs: "Día en que se hizo. Viene puesta la jornada de hoy." },
          { nombre: "Coste (€)", queEs: "Lo que costó. Opcional; admite coma decimal." },
          { nombre: "Nota", queEs: "Número de certificado, incidencias…" },
          {
            nombre: "Marcar como hecho",
            queEs: "Apunta que se hizo y calcula la próxima vez.",
            logica: "Próxima vez = día en que se hizo + los días de la periodicidad. Si hay coste, queda en el registro de cambios.",
            influye: "El coste solo se guarda aquí: no pasa a Contabilidad ni al cuadro de mando.",
          },
          { nombre: "Historial (Fecha, Coste, Nota, Quién)", queEs: "Las 5 últimas veces que se hizo." },
          { nombre: "Dar de baja la tarea", queEs: "Quita la tarea. Su historial se conserva." },
        ],
      },
      {
        titulo: "Nuevo mantenimiento",
        campos: [
          { nombre: "Centro", queEs: "Centro. Salen los centros elegidos arriba." },
          { nombre: "Tarea", queEs: "Qué hay que hacer. Obligatorio." },
          { nombre: "Equipo", queEs: "Sobre qué equipo, si aplica." },
          { nombre: "Empresa", queEs: "Empresa que lo hace. En blanco = personal propio." },
          { nombre: "Cada cuántos días", queEs: "Periodicidad en días (de 1 a 1.825). Por defecto 90." },
          { nombre: "Próxima vez", queEs: "Primera fecha en que toca. Por defecto hoy." },
          { nombre: "Notas", queEs: "Cualquier dato útil." },
          { nombre: "Añadir", queEs: "Crea la tarea." },
        ],
      },
    ],
    influye: [{ texto: "Los costes con importe quedan en el registro de cambios", ruta: "/ajustes/registro" }],
  },

  "/calidad/plantillas": {
    titulo: "Plantillas APPCC",
    area: "Calidad",
    paraQue:
      "Aquí se preparan las listas de comprobación (apertura, cierre, limpieza, recepción…) y sus puntos. Cada lista puede valer para todos los centros o solo para uno, y aparece cada día en «Tareas de hoy».",
    quien: "Hace falta el permiso «Editar plan APPCC».",
    secciones: [
      {
        titulo: "Tabla de listas",
        campos: [
          { nombre: "Lista", queEs: "Nombre de la lista." },
          { nombre: "Tipo", queEs: "Apertura, Cierre, Limpieza, Recepción de mercancía u Otra." },
          { nombre: "Centro", queEs: "Centro en el que vale, o «Todos los centros»." },
          { nombre: "Puntos", queEs: "Número de puntos activos." },
          { nombre: "Veces hecha", queEs: "Cuántas veces se ha firmado en total." },
          { nombre: "Estado", queEs: "Activa o Desactivada." },
        ],
      },
      {
        titulo: "Detalle de la lista",
        campos: [
          {
            nombre: "Puntos",
            queEs: "Cada cosa a comprobar. «Pide dato» indica que al firmar hay que escribir un valor (temperatura, n.º de albarán…).",
          },
          {
            nombre: "Quitar / Recuperar",
            queEs: "Quita un punto de la lista (sale tachado) o lo vuelve a poner.",
            logica: "Los puntos no se borran porque las listas ya firmadas los citan.",
          },
          { nombre: "Nuevo punto, Pide un dato y «Añadir punto»", queEs: "Añade un punto al final de la lista." },
          {
            nombre: "Desactivar lista / Activar lista",
            queEs: "Una lista desactivada deja de salir en «Tareas de hoy». Lo ya firmado se conserva.",
          },
        ],
      },
      {
        titulo: "Nueva lista",
        campos: [
          { nombre: "Nombre", queEs: "Nombre de la lista. Obligatorio." },
          { nombre: "Tipo", queEs: "Tipo de lista." },
          { nombre: "Centro", queEs: "«Todos los centros» o uno de tus centros." },
          { nombre: "Crear lista", queEs: "Crea la lista vacía; después se le añaden los puntos desplegándola." },
        ],
      },
    ],
    logica: ["Los cambios de puntos valen para las listas que se firmen a partir de ahora; las ya firmadas guardan el texto de cada punto tal como estaba."],
    influye: [{ texto: "Las listas activas salen cada día para firmar", ruta: "/calidad" }],
  },
};
