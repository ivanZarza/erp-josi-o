import type { AyudaArea } from "../tipos";

export const AYUDA_RESERVAS: AyudaArea = {
  "/reservas": {
    titulo: "Reservas del día",
    area: "Reservas",
    paraQue:
      "Es la libreta de reservas del día. Muestra todas las reservas de una fecha agrupadas por hora, con su mesa y su estado. Desde aquí la sala va cambiando el estado de cada reserva (ha llegado, sentada, terminada…) y cambia las mesas.",
    quien:
      "Para ver la pantalla hace falta el permiso «Ver reservas». Para cambiar estados, cambiar mesas y crear reservas hace falta «Crear y cambiar reservas»; sin él la pantalla es solo de consulta. Las pestañas «Espacios y mesas» y «Turnos y reglas» solo salen a quien tiene esos permisos.",
    secciones: [
      {
        titulo: "Cabecera y pestañas",
        campos: [
          {
            nombre: "Título «Reservas de hoy» o «Reservas del …»",
            queEs: "Dice qué día estás viendo. Debajo sale el local elegido o «Todos tus locales» si en el selector de centro de arriba tienes todos.",
            logica: "Con todos los locales se ven juntas las reservas de todos los locales que tienes asignados.",
          },
          {
            nombre: "Nueva reserva",
            queEs: "Abre el formulario de reserva con la fecha que estás viendo ya puesta.",
            logica: "Solo sale si tienes el permiso «Crear y cambiar reservas».",
          },
          {
            nombre: "Pestañas",
            queEs: "Reservas del día, Nueva reserva, Plano de mesas, Espacios y mesas, Turnos y reglas. Las dos últimas solo si tienes permiso para editarlas.",
          },
        ],
      },
      {
        titulo: "Elegir el día",
        campos: [
          { nombre: "Día anterior / Día siguiente", queEs: "Pasa al día de antes o al de después." },
          { nombre: "Fecha y botón «Ver»", queEs: "Escribe o elige cualquier fecha y pulsa «Ver» para ver sus reservas." },
          { nombre: "Hoy", queEs: "Vuelve al día de hoy. Solo sale cuando estás viendo otro día.", logica: "«Hoy» es el día de hoy en hora de Madrid." },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Reservas",
            queEs: "Número de reservas del día que siguen en pie.",
            logica:
              "Cuenta todas las reservas del día menos las canceladas y las no presentadas. Debajo se dice cuántas canceladas o no presentadas hay.",
          },
          {
            nombre: "Personas",
            queEs: "Suma de personas de las reservas que siguen en pie (sin canceladas ni no presentadas).",
          },
          {
            nombre: "En sala ahora",
            queEs: "Número de reservas que están en estado «Ha llegado» o «Sentada».",
            logica: "Cuenta reservas, no personas. Sale en verde si hay alguna. Se calcula para el día que estás viendo, aunque no sea hoy.",
          },
          {
            nombre: "No presentadas",
            queEs: "Reservas marcadas como «No presentada» ese día. Sale en rojo si hay alguna.",
          },
        ],
      },
      {
        titulo: "Listado por horas",
        campos: [
          {
            nombre: "Encabezado de cada hora (por ejemplo «21:00 · 5 reservas · 18 personas»)",
            queEs: "Las reservas se agrupan por hora en punto: las de 21:00, 21:15 y 21:45 van juntas en el grupo de las 21:00.",
            logica: "El número de reservas cuenta todas las filas de esa hora. Las personas, igual que la cifra «Personas» de arriba, no suman las canceladas ni las no presentadas.",
          },
          { nombre: "Hora", queEs: "Hora a la que llega la reserva." },
          {
            nombre: "Nombre",
            queEs: "Nombre de quien reserva. Si tiene alergias apuntadas sale la palabra «Alergias» en rojo al lado.",
          },
          { nombre: "Pers.", queEs: "Número de personas de la reserva." },
          {
            nombre: "Mesa",
            queEs: "Mesa o mesas asignadas. Si son dos mesas juntas sale «5 + 6». Si no tiene mesa sale «Sin mesa» en naranja.",
            logica: "Una reserva sin mesa (y no cancelada) colorea la fila en naranja para que se le asigne una.",
          },
          {
            nombre: "Zona / Local",
            queEs:
              "Con un local elegido sale la zona (el espacio de la mesa, o la zona que pidió el cliente si aún no tiene mesa). Con todos los locales sale el local de la reserva.",
          },
          {
            nombre: "Estado",
            queEs:
              "Solicitada, Confirmada, Ha llegado, Sentada, Terminada, Cancelada o No presentada. La fila de una no presentada sale en rojo.",
          },
          {
            nombre: "Origen",
            queEs: "Por dónde llegó la reserva: Manual (en el local), Teléfono, Web o CoverManager. Es lo que se eligió al apuntarla.",
            logica: "Las de la web nacen «Solicitada» (hay que confirmarlas); las demás nacen «Confirmada».",
          },
        ],
      },
      {
        titulo: "Detalle de la reserva (al desplegar la fila)",
        campos: [
          { nombre: "Teléfono y Correo", queEs: "Los datos de contacto que se dieron al reservar." },
          {
            nombre: "Duración",
            queEs: "Minutos que se guarda la mesa para esta reserva.",
            logica:
              "Si el local tiene rellenada la «Duración de mesa según personas» (Turnos y reglas), se toma de ahí; si no, de la «Duración de mesa» del turno al que pertenece la hora. Si el local no tiene turnos, 90 minutos. Se fija al crear la reserva.",
            influye: "Durante ese tiempo la mesa no se ofrece a otras reservas y en el plano sale ocupada.",
          },
          { nombre: "Zona", queEs: "Espacio de la mesa, o la zona preferida si aún no hay mesa. «Sin preferencia» si no se pidió ninguna." },
          { nombre: "Notas", queEs: "Lo que se apuntó al reservar: cumpleaños, trona, mesa tranquila…" },
          { nombre: "Alergias", queEs: "Alergias que dijo el cliente, en rojo." },
          {
            nombre: "Cliente",
            queEs: "Enlace «Ver ficha» a la ficha del cliente en el área Clientes.",
            logica: "Solo existe si la cadena tiene el área Clientes: al reservar se busca el cliente por teléfono o correo y, si no existe, se crea.",
          },
          { nombre: "Creada", queEs: "Día y hora en que se apuntó la reserva." },
          {
            nombre: "Botones de estado",
            queEs: "Pasan la reserva al siguiente estado. Solo salen los cambios permitidos desde el estado actual.",
            logica:
              "Desde Solicitada: Confirmada o Cancelada. Desde Confirmada: Ha llegado, Sentada, No presentada o Cancelada. Desde Ha llegado: Sentada o Cancelada. Desde Sentada: Terminada. Desde Cancelada: volver a Confirmada. Desde No presentada: Ha llegado o Confirmada. Una reserva Terminada ya no se puede cambiar.",
            influye:
              "Al pasar a «Terminada» se apunta una visita en la ficha del cliente (suma una visita y cambia la fecha de última visita) y se crea una encuesta pendiente en Clientes → Encuestas. Cancelada y No presentada dejan libre la mesa para otras reservas. Si una cancelada o no presentada vuelve a «Confirmada», se comprueba otra vez que haya sitio: que la franja admita sus cubiertos y que su mesa siga libre (si la ha cogido otra reserva, se le asigna otra libre donde quepa); si no hay mesa, sale un aviso y no se cambia. Si una no presentada pasa a «Ha llegado», conserva su mesa si está libre o se le busca otra; si no queda ninguna, pasa sin mesa para asignarla en sala. Lo que se haga con la mesa queda en el historial.",
          },
          {
            nombre: "Selector de mesa y «Cambiar mesa»",
            queEs:
              "Cambia la mesa de la reserva. Con «Asignar automáticamente» el sistema busca la mejor mesa libre; también puedes elegir una mesa concreta del local.",
            logica:
              "Solo sale en reservas Solicitadas, Confirmadas o que Han llegado. La mesa tiene que estar libre durante toda la duración de la reserva y en ella tiene que caber el grupo (su máximo de personas); si no, sale un aviso y no se cambia. La asignación automática sigue las mismas reglas que al crear la reserva (mesa más pequeña donde quepan o dos mesas juntables del mismo espacio). El cambio queda en el historial como «Cambio de mesa».",
          },
          {
            nombre: "Historial",
            queEs: "Lista de cambios de la reserva: fecha y hora, estado de antes → estado nuevo, y la nota si la hay (por ejemplo «Sin mesa asignada» o «Cambio de mesa»).",
          },
        ],
      },
      {
        titulo: "Abajo",
        campos: [
          {
            nombre: "CoverManager y Reservar con Google",
            queEs: "Huecos para conexiones que aún no están hechas. Cuando se conecten, esas reservas aparecerán aquí solas con su origen.",
          },
          {
            nombre: "Consejo",
            queEs: "Con todos los locales elegidos sale el recordatorio de elegir un local para ver el plano de mesas y la ocupación por franjas.",
          },
        ],
      },
    ],
    logica: [
      "Solo se ven las reservas de los locales elegidos en el selector de centro (o de todos tus locales).",
      "Una reserva ocupa mesa mientras está Solicitada, Confirmada, Ha llegado o Sentada. Terminada, Cancelada y No presentada ya no ocupan mesa.",
      "Las reservas no se borran nunca: se cancelan, y todo cambio queda en su historial.",
    ],
    influye: [
      { texto: "Al terminar una reserva se suma la visita en la ficha del cliente", ruta: "/clientes" },
      { texto: "y se crea la encuesta tras la visita", ruta: "/clientes/encuestas" },
      { texto: "El estado de cada mesa en el plano sale de estas reservas", ruta: "/reservas/plano" },
      { texto: "Las reservas que ocupan un espacio salen en la ficha del evento que lo pide", ruta: "/eventos/[id]" },
    ],
    comoSeUsa: [
      "Al empezar el servicio, abre el día de hoy y revisa las filas en naranja (sin mesa) para asignarles una.",
      "Cuando llega el cliente, despliega su reserva y pulsa «Ha llegado» o directamente «Sentada».",
      "Al irse, pulsa «Terminada»: así cuenta como visita del cliente.",
      "Si no viene, pulsa «No presentada» para que quede constancia y se libere la mesa.",
    ],
  },

  "/reservas/nueva": {
    titulo: "Nueva reserva",
    area: "Reservas",
    paraQue:
      "Formulario para apuntar una reserva (por teléfono, en el local…). El sistema comprueba que haya hueco en la franja, busca la mejor mesa libre y, si el grupo es grande, lo pasa a Eventos.",
    quien: "Hace falta el permiso «Crear y cambiar reservas».",
    secciones: [
      {
        titulo: "Datos de la reserva",
        campos: [
          {
            nombre: "Local",
            queEs: "Local de la reserva. Salen los locales que tienes asignados y que tienen activada el área Reservas.",
            logica: "Si arriba tienes un local elegido, viene puesto. Si no tienes ningún local con Reservas sale un aviso y no hay formulario.",
          },
          { nombre: "Fecha", queEs: "Día de la reserva. Viene puesta la fecha que estabas viendo en la libreta, o hoy." },
          {
            nombre: "Hora",
            queEs: "Hora de llegada (en cuartos de hora). Por defecto 21:00.",
            logica:
              "Si el local tiene turnos, la hora tiene que caer dentro de un turno activo de ese día de la semana (entre la primera y la última entrada); si no, sale «A las … no hay turno abierto ese día».",
          },
          {
            nombre: "Personas",
            queEs: "Número de comensales (de 1 a 500).",
            logica:
              "Si es MAYOR que el número de «Grupos grandes» del local (Turnos y reglas; 10 si no se ha cambiado), no se crea reserva: se crea una solicitud de evento en Eventos y se abre su ficha. Si la cadena no tiene Eventos contratado, sale un error.",
          },
          { nombre: "Nombre", queEs: "Nombre de quien reserva. Obligatorio." },
          {
            nombre: "Teléfono",
            queEs: "Teléfono con prefijo (+34…).",
            logica: "Hace falta teléfono o correo (al menos uno). El teléfono se guarda siempre en formato internacional: un móvil o fijo español de 9 cifras pasa a +34.",
          },
          { nombre: "Correo", queEs: "Correo del cliente. Se comprueba que tenga forma de correo." },
          {
            nombre: "Origen",
            queEs: "Por dónde llega la reserva: Teléfono (por defecto), En el local, Web o CoverManager.",
            logica:
              "Las de la web se guardan como «Solicitada»: el local aún no ha hablado con el cliente y hay que confirmarlas (botón «Confirmada» en la libreta). Las demás se guardan como «Confirmada» (CoverManager ya las confirma al cliente). En los dos casos la mesa y los cubiertos quedan reservados.",
            influye: "Sale en la columna «Origen» de la libreta.",
          },
          {
            nombre: "Zona preferida",
            queEs: "Espacio que pide el cliente (sala, terraza, reservado…). «Sin preferencia» deja que el sistema elija en cualquier espacio.",
            logica: "Con zona elegida, la asignación automática solo busca mesas de ese espacio. La zona tiene que ser un espacio activo del local de la reserva; si no, sale un error.",
          },
          {
            nombre: "Mesa",
            queEs: "Mesa concreta. «Asignar automáticamente» deja que el sistema elija la mejor.",
            logica:
              "Solo se pueden elegir mesas si arriba tienes un local elegido. Si eliges una, tiene que estar libre a esa hora y caber el grupo (máximo de personas de la mesa); si no, sale un error.",
          },
          {
            nombre: "Alergias",
            queEs: "Alergias o intolerancias del grupo.",
            influye: "Se apuntan en la reserva y se añaden a la ficha del cliente si no estaban ya.",
          },
          { nombre: "Notas", queEs: "Cualquier detalle: cumpleaños, trona, mesa tranquila…" },
        ],
      },
      {
        titulo: "Consentimientos (preguntar al cliente)",
        campos: [
          {
            nombre: "Acepta que guardemos sus datos para gestionar la reserva",
            queEs: "Marcado por defecto. Se guarda en la ficha del cliente con la fecha, sea sí o no.",
          },
          {
            nombre: "Quiere recibir ofertas por correo / por WhatsApp",
            queEs: "Solo márcalo si el cliente lo dice. Se apunta en su ficha como aceptado con la fecha de hoy.",
            influye: "Cuenta en las cifras «Aceptan correo» y «Aceptan WhatsApp» de Clientes y en el CSV de exportación.",
          },
          {
            nombre: "Guardar aunque no quede mesa libre",
            queEs: "Si no hay mesa para el grupo, la reserva se guarda igualmente sin mesa para asignarla después en sala.",
            logica: "Sin esta casilla, si no hay mesa sale «No queda mesa libre para ese grupo a esa hora» y no se guarda.",
          },
          {
            nombre: "Guardar reserva",
            queEs: "Comprueba todo y guarda la reserva como «Confirmada» (o «Solicitada» si el origen es Web). Vuelve a la libreta de ese día con el aviso «Reserva guardada» (o que está solicitada, o sin mesa).",
          },
        ],
      },
      {
        titulo: "Ocupación por franjas (a la derecha)",
        campos: [
          {
            nombre: "Fecha y «Ver»",
            queEs: "Cambia el día del que se enseña la ocupación.",
          },
          {
            nombre: "Cada turno (por ejemplo «Cena · máx. 30 cada 15 min»)",
            queEs: "Las franjas de entrada del turno con los cubiertos ya reservados y el máximo: «12 / 30».",
            logica:
              "Cuentan las reservas Solicitadas, Confirmadas, Han llegado, Sentadas y Terminadas que entran en esa franja (no cuentan canceladas ni no presentadas). «Casi llena» desde el 75 % del máximo; «Completa» al llegar al máximo.",
          },
          {
            nombre: "Mensajes sin franjas",
            queEs: "Sin local elegido, pide elegir uno. Si ese día no hay turnos, avisa de que no se limita el número de cubiertos.",
          },
        ],
      },
    ],
    logica: [
      "Regla de cubiertos: si el local tiene turnos, los cubiertos de la franja más los de la nueva reserva no pueden pasar del «Máx. cubiertos por franja». Si pasan, sale «La franja de las … ya tiene X de Y cubiertos. Prueba otra hora».",
      "Duración: la de la tabla «Duración de mesa según personas» del local si está rellenada; si no, la «Duración de mesa» del turno (90 minutos si el local no tiene turnos).",
      "Solapes: una mesa está libre si ninguna reserva activa (Solicitada, Confirmada, Ha llegado, Sentada) la ocupa en algún momento entre la hora de llegada y la hora más la duración.",
      "Mesa automática: primero la mesa libre más pequeña donde quepa el grupo (entre su mínimo y su máximo de personas). Si no hay, dos mesas marcadas como «Se puede juntar con otra», del mismo espacio, con la menor capacidad que sume lo necesario.",
      "Si la cadena tiene Clientes, el cliente se busca por teléfono y, si no, por correo; si no existe se crea con origen «Reserva». Si existe, se le completan el correo, el teléfono o las alergias que falten.",
    ],
    influye: [
      { texto: "La reserva aparece en la libreta del día", ruta: "/reservas" },
      { texto: "y ocupa su mesa en el plano", ruta: "/reservas/plano" },
      { texto: "Crea o completa la ficha del cliente y sus consentimientos", ruta: "/clientes" },
      { texto: "Los grupos grandes se convierten en solicitud de evento", ruta: "/eventos" },
      { texto: "Las franjas y los grupos grandes se configuran en", ruta: "/reservas/reglas" },
    ],
    comoSeUsa: [
      "Elige antes el local arriba: así ves la ocupación por franjas y puedes escoger mesa.",
      "Mira la tarjeta de franjas para proponer al cliente una hora con hueco.",
      "Deja la mesa en automático salvo que el cliente pida una concreta.",
    ],
  },

  "/reservas/plano": {
    titulo: "Plano de mesas",
    area: "Reservas",
    paraQue:
      "Dibujo de cada espacio del local con sus mesas, coloreadas según estén libres u ocupadas en la franja elegida. Quien tenga permiso puede además mover las mesas a su sitio.",
    quien:
      "Para verlo hace falta «Ver reservas». El botón «Mover mesas» solo sale con el permiso «Editar planos de mesas».",
    secciones: [
      {
        titulo: "Elegir local, día y franja",
        campos: [
          {
            nombre: "Local",
            queEs: "El plano es de un solo local: hay que elegirlo en el selector de centro de arriba. Si no, sale un aviso.",
          },
          { nombre: "Fecha", queEs: "Día que quieres ver. Por defecto, hoy." },
          {
            nombre: "Hora",
            queEs: "Franja que quieres ver. Si el local tiene turnos, es una lista con las franjas de cada turno de ese día; si no, se escribe la hora.",
            logica:
              "Al entrar sin elegir hora: hoy se toma la franja actual (redondeada al cuarto de hora) o la siguiente con turno; otro día, la primera franja. Sin turnos, las 21:00.",
          },
          { nombre: "Ver franja", queEs: "Repinta el plano con la fecha y la hora elegidas." },
        ],
      },
      {
        titulo: "Leyenda y botones",
        campos: [
          {
            nombre: "Colores",
            queEs: "Verde: libre. Ámbar: reservada. Azul: ha llegado. Rojo: sentada.",
            logica:
              "Una mesa sale ocupada si tiene asignada una reserva activa cuyo horario (hora de llegada más duración) incluye la hora elegida. «Reservada» es una reserva Solicitada o Confirmada.",
          },
          {
            nombre: "Mover mesas",
            queEs: "Activa el modo de edición: se ve una rejilla y se pueden arrastrar las mesas.",
            logica: "Las mesas se ajustan a una rejilla de 10 unidades y no se pueden sacar del espacio.",
          },
          { nombre: "Descartar", queEs: "Deja las mesas como estaban y sale del modo de edición." },
          {
            nombre: "Guardar posiciones (n)",
            queEs: "Guarda la nueva posición de las mesas movidas (entre paréntesis, cuántas).",
            influye: "La posición se ve también en el detalle de cada mesa en «Espacios y mesas».",
          },
        ],
      },
      {
        titulo: "Cada espacio",
        campos: [
          {
            nombre: "Cabecera del espacio",
            queEs: "Nombre del espacio y «X mesas · Y libres · aforo Z».",
            logica: "Solo salen espacios y mesas activos. «Libres» son las mesas en verde en la franja elegida.",
          },
          {
            nombre: "Cada mesa",
            queEs:
              "Nombre de la mesa y, debajo, su capacidad (mínimo-máximo) si está libre, o la hora y personas de la reserva («21:00 · 4p») si está ocupada.",
            logica:
              "Al dejar el ratón encima se ven la capacidad, si es especial o combinable y el nombre de la reserva. Las mesas redondas se dibujan redondas.",
          },
        ],
      },
    ],
    logica: [
      "Las reservas sin mesa asignada no salen en el plano: asígnales mesa en la libreta del día.",
      "El tamaño de cada espacio (ancho y alto del dibujo) se cambia en «Espacios y mesas».",
    ],
    influye: [
      { texto: "Las mesas y espacios se crean y cambian en", ruta: "/reservas/mesas" },
      { texto: "El estado de cada mesa sale de las reservas del día", ruta: "/reservas" },
    ],
  },

  "/reservas/mesas": {
    titulo: "Espacios y mesas",
    area: "Reservas",
    paraQue:
      "Aquí se dan de alta los espacios del local (sala, terraza, reservado, barra) y las mesas de cada uno, con su capacidad. Es la base para asignar mesas a las reservas y para dibujar el plano.",
    quien: "Hace falta el permiso «Editar planos de mesas». Hay que tener un local elegido en el selector de centro de arriba.",
    secciones: [
      {
        titulo: "Espacios",
        campos: [
          { nombre: "Espacio", queEs: "Nombre del espacio: Sala, Terraza, Reservado…" },
          { nombre: "Tipo", queEs: "Sala, Terraza, Reservado o Barra." },
          {
            nombre: "Aforo",
            queEs: "Número de personas que caben en el espacio. Es un dato informativo que se escribe a mano.",
            influye: "Sale en el plano y en Eventos, que avisa si el grupo es mayor que el aforo del espacio pedido.",
          },
          { nombre: "Mesas", queEs: "Número de mesas activas del espacio." },
          { nombre: "Plazas", queEs: "Suma del máximo de personas de las mesas activas del espacio." },
          { nombre: "Estado", queEs: "Activo o Desactivado." },
          {
            nombre: "Detalle: Nombre, Tipo, Aforo, Ancho del plano, Alto del plano y «Guardar»",
            queEs: "Cambia los datos del espacio. Ancho y alto son el tamaño del dibujo en el plano (de 200 a 3.000).",
          },
          {
            nombre: "Desactivar espacio / Volver a activar",
            queEs: "Un espacio no se borra: se desactiva.",
            logica:
              "Un espacio desactivado y sus mesas dejan de ofrecerse para reservas nuevas, no salen en el plano y no se pueden elegir en Eventos. No se deja desactivar si tiene reservas vivas (Solicitada, Confirmada, Ha llegado o Sentada) de hoy en adelante con mesa en él o que lo piden como zona: sale un aviso con cuántas hay y la primera, para cambiarlas antes.",
          },
          {
            nombre: "Nuevo espacio (Nombre, Tipo, Aforo, Ancho, Alto) y «Crear espacio»",
            queEs: "Crea otro espacio en el local. Por defecto: sala, aforo 40, plano de 800 × 500.",
          },
        ],
      },
      {
        titulo: "Mesas",
        campos: [
          { nombre: "Mesa", queEs: "Nombre o número de la mesa." },
          { nombre: "Espacio", queEs: "Espacio al que pertenece." },
          {
            nombre: "Personas",
            queEs: "Mínimo y máximo de personas («2–4»).",
            logica: "La asignación automática solo pone un grupo en una mesa si el número de personas está entre el mínimo y el máximo.",
          },
          { nombre: "Forma", queEs: "Cuadrada, Redonda o Rectangular." },
          {
            nombre: "Combinable",
            queEs: "Sí si se puede juntar con otra mesa.",
            logica: "Cuando no cabe un grupo en una sola mesa, el sistema prueba con dos mesas combinables del mismo espacio.",
          },
          {
            nombre: "Internet",
            queEs: "Si la mesa se podrá reservar desde la web.",
            logica: "Se guarda para cuando exista la reserva por internet; hoy no cambia nada.",
          },
          { nombre: "Estado", queEs: "Activa o Desactivada." },
          {
            nombre: "Detalle: Posición, Tamaño y Especial",
            queEs: "Dónde está la mesa en el plano y su tamaño de dibujo.",
            logica:
              "El tamaño se calcula solo al guardar la mesa: rectangular 110 × 60; cuadrada o redonda de más de 4 personas 80 × 80; el resto 60 × 60. La posición se cambia arrastrando en el plano.",
          },
          {
            nombre: "Formulario de la mesa: Espacio, Nombre o número, Mínimo de personas, Máximo de personas, Forma, Mesa especial, Se puede juntar con otra, Reservable por internet",
            queEs: "Cambia la mesa (botón «Guardar mesa») o, abajo del todo, crea una nueva («Añadir mesa»).",
            logica:
              "El máximo no puede ser menor que el mínimo. «Mesa especial» es un texto libre (ventana, chimenea…) que sale al pasar el ratón en el plano. Las mesas nuevas se colocan en fila en el plano para luego moverlas. Solo se pueden elegir espacios activos.",
          },
          {
            nombre: "Desactivar mesa / Volver a activar",
            queEs: "Una mesa no se borra: se desactiva.",
            logica:
              "Una mesa desactivada deja de ofrecerse para reservas nuevas y no sale en el plano. No se deja desactivar si tiene reservas vivas (Solicitada, Confirmada, Ha llegado o Sentada) de hoy en adelante: sale un aviso con cuántas hay y la primera, para cambiarlas de mesa en la libreta antes.",
          },
        ],
      },
    ],
    influye: [
      { texto: "El plano se dibuja con estos espacios y mesas", ruta: "/reservas/plano" },
      { texto: "La asignación de mesa al reservar usa estas capacidades", ruta: "/reservas/nueva" },
      { texto: "Los espacios se pueden pedir para un evento", ruta: "/eventos/[id]" },
    ],
    comoSeUsa: [
      "Crea primero los espacios y después las mesas de cada uno.",
      "Luego ve a «Plano de mesas», pulsa «Mover mesas» y colócalas como están en el local.",
    ],
  },

  "/reservas/reglas": {
    titulo: "Turnos y reglas",
    area: "Reservas",
    paraQue:
      "Cada local define aquí sus turnos (comida, cena…), cada cuánto entran mesas y cuántos cubiertos como máximo por franja, para no saturar la cocina. También el tamaño a partir del cual un grupo pasa a Eventos.",
    quien: "Hace falta el permiso «Editar turnos y reglas» y tener un local elegido en el selector de centro de arriba.",
    secciones: [
      {
        titulo: "Turnos (tabla)",
        campos: [
          { nombre: "Turno", queEs: "Nombre del turno: Comida, Cena…" },
          { nombre: "Días", queEs: "Días de la semana en que hay ese turno (L M X J V S D)." },
          { nombre: "Entradas", queEs: "Primera y última hora a la que se aceptan llegadas («13:00 – 15:30»)." },
          { nombre: "Duración", queEs: "Minutos que se guarda la mesa a cada reserva del turno (salvo que el local tenga rellenada la duración según personas)." },
          { nombre: "Cubiertos / franja", queEs: "Máximo de personas que pueden llegar en cada franja («30 cada 15 min»)." },
          { nombre: "Estado", queEs: "Activo o Desactivado." },
          {
            nombre: "Desactivar turno / Volver a activar",
            queEs: "Un turno desactivado deja de contar: no limita cubiertos ni admite reservas en su horario.",
            logica: "Si el local se queda sin ningún turno activo, se aceptan reservas a cualquier hora y sin límite de cubiertos.",
          },
        ],
      },
      {
        titulo: "Formulario de turno (al desplegar o «Nuevo turno»)",
        campos: [
          { nombre: "Nombre", queEs: "Nombre del turno. Obligatorio." },
          {
            nombre: "Primera entrada / Última entrada",
            queEs: "Primera y última hora de llegada del turno, en cuartos de hora.",
            logica: "La última no puede ser antes que la primera. Una reserva a una hora fuera de todos los turnos de ese día no se admite.",
          },
          {
            nombre: "Duración de mesa (min)",
            queEs: "Tiempo que se guarda la mesa (de 15 a 480 minutos). Por defecto 90.",
            logica: "Si en «Reglas del local» está rellenada la duración según personas, manda esa.",
            influye: "Marca cuándo la mesa vuelve a quedar libre para otra reserva y cuánto tiempo sale ocupada en el plano.",
          },
          {
            nombre: "Franja de entradas",
            queEs: "Cada 15 min, cada 30 min o cada hora.",
            logica: "Las franjas empiezan en la primera entrada: con 13:00 y cada 30 min, una reserva a las 13:40 cuenta en la franja de las 13:30.",
          },
          {
            nombre: "Máx. cubiertos por franja",
            queEs: "Máximo de personas que pueden llegar en una misma franja.",
            influye: "Si una reserva nueva hace pasar ese máximo, no se guarda. Se ve en la tarjeta «Ocupación por franjas» de Nueva reserva.",
          },
          { nombre: "Días", queEs: "Marca los días en que hay ese turno. Hay que marcar al menos uno." },
          { nombre: "Crear turno / Guardar turno", queEs: "Guarda el turno." },
        ],
      },
      {
        titulo: "Reglas del local",
        campos: [
          {
            nombre: "Grupos grandes",
            queEs: "Número de personas a partir del cual una reserva se trata como evento. Por defecto 10.",
            logica: "Las reservas de MÁS de estas personas no se apuntan como reserva: se crea una solicitud de evento.",
            influye: "Las solicitudes salen en Eventos con origen «Reserva».",
          },
          {
            nombre: "Antelación mínima por internet (min)",
            queEs: "Minutos de antelación mínima para reservar por la web.",
            logica: "Se guarda para el formulario de la web, que aún no existe. Hoy no limita nada.",
          },
          {
            nombre: "El cliente puede elegir mesa en la web",
            queEs: "Permitirá elegir mesa al reservar por internet.",
            logica: "Se guarda para más adelante; hoy no cambia nada.",
          },
          {
            nombre: "Duración de mesa según personas (Hasta (personas) y Duración (min))",
            queEs: "Opcional. Tabla para que los grupos grandes tengan la mesa más tiempo: cada fila dice hasta cuántas personas y cuántos minutos. Por ejemplo, hasta 2 → 90, hasta 4 → 105, hasta 8 → 120.",
            logica:
              "Se busca la primera fila cuyo «Hasta» sea igual o mayor que las personas de la reserva; los grupos más grandes que la última fila usan la de la última. Las filas se ordenan solas; las vacías no cuentan; cada fila tiene que tener las dos casillas y no puede haber dos con las mismas personas. Si se dejan todas vacías, se usa la duración del turno. Salen siempre dos filas vacías de más para añadir.",
            influye: "Fija la duración de las reservas nuevas (las ya hechas conservan la suya): cuándo vuelve a quedar libre la mesa y cuánto sale ocupada en el plano.",
          },
          { nombre: "Guardar reglas", queEs: "Guarda las reglas del local y la tabla de duraciones." },
        ],
      },
    ],
    influye: [
      { texto: "Limita las reservas nuevas y la ocupación por franjas", ruta: "/reservas/nueva" },
      { texto: "Las franjas son las horas que se eligen en el plano", ruta: "/reservas/plano" },
      { texto: "Los grupos grandes pasan a solicitudes de evento", ruta: "/eventos" },
    ],
    comoSeUsa: [
      "Crea un turno de comida y otro de cena con los días que abre el local.",
      "Ajusta los cubiertos por franja a lo que la cocina saca bien en ese tiempo.",
    ],
  },
};
