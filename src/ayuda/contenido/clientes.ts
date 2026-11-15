import type { AyudaArea } from "../tipos";

export const AYUDA_CLIENTES: AyudaArea = {
  "/clientes": {
    titulo: "Clientes",
    area: "Clientes",
    paraQue:
      "Lista de los clientes del grupo. Cada cliente tiene una sola ficha para todos los locales, con sus visitas, alergias, preferencias y lo que ha aceptado recibir (consentimientos). Las fichas se crean solas al reservar o pedir un evento, o a mano.",
    quien:
      "Para verla hace falta «Ver clientes». El botón «Nuevo cliente» necesita «Editar clientes» y el botón «Exportar CSV» necesita «Exportar clientes».",
    secciones: [
      {
        titulo: "Botones de arriba",
        campos: [
          {
            nombre: "Exportar CSV",
            queEs: "Descarga un archivo con todos los clientes activos para abrir en Excel.",
            logica:
              "Columnas: Nombre, Apellidos, Teléfono, Correo, Etiquetas, Visitas, Última visita, Alergias y los tres consentimientos (Sí o No con su fecha, o «Sin dato»). Separado por punto y coma y con fechas dd/mm/aaaa. Exporta todos los clientes, sin tener en cuenta la búsqueda.",
            influye: "Cada exportación queda anotada en el registro de cambios (protección de datos).",
          },
          { nombre: "Nuevo cliente", queEs: "Abre el formulario para dar de alta un cliente a mano." },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Clientes encontrados",
            queEs: "Número de clientes que cumplen la búsqueda y la etiqueta elegidas.",
            logica: "La tabla enseña como mucho 200; si hay más, debajo sale «se muestran 200».",
          },
          {
            nombre: "Aceptan correo",
            queEs: "Cuántos de los clientes mostrados en la tabla tienen aceptado recibir ofertas por correo.",
            logica: "Se mira el último consentimiento de correo apuntado de cada cliente (el general, no el de una marca concreta).",
          },
          { nombre: "Aceptan WhatsApp", queEs: "Igual, para ofertas por WhatsApp. Cuenta solo los mostrados." },
          { nombre: "Con alergias", queEs: "Cuántos de los mostrados tienen alergias apuntadas. Sale en naranja si hay alguno." },
        ],
      },
      {
        titulo: "Búsqueda",
        campos: [
          {
            nombre: "Nombre, teléfono o correo",
            queEs: "Busca en nombre, apellidos, correo y teléfono. No distingue mayúsculas; en el teléfono no importan los espacios.",
          },
          { nombre: "Etiquetas", queEs: "Muestra solo los clientes con esa etiqueta (VIP, Empresa…). Salen las etiquetas que ya se usan." },
          { nombre: "Buscar / Quitar filtros", queEs: "Aplica la búsqueda o vuelve a la lista completa." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Cliente", queEs: "Nombre y apellidos. Al pulsarlo se abre su ficha." },
          { nombre: "Teléfono", queEs: "Teléfono en formato internacional (+34…)." },
          { nombre: "Correo", queEs: "Correo del cliente." },
          {
            nombre: "Visitas",
            queEs: "Número de visitas registradas.",
            logica: "Suma una cada vez que una reserva suya pasa a «Terminada» en Reservas.",
          },
          { nombre: "Última visita", queEs: "Día de la última visita registrada." },
          { nombre: "Etiquetas", queEs: "Etiquetas del cliente. VIP sale en azul." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Alergias", queEs: "Alergias apuntadas, en rojo." },
          { nombre: "Preferencias", queEs: "Gustos del cliente: mesa de ventana, vino tinto…" },
          { nombre: "Notas de sala", queEs: "Notas internas para el equipo de sala." },
          {
            nombre: "Origen",
            queEs: "Cómo se creó la ficha, tal como está guardado: MANUAL (a mano), RESERVA (al reservar) o EVENTO (al pedir un evento).",
          },
          {
            nombre: "Consentimiento reserva, Correo comercial, WhatsApp comercial",
            queEs: "Último «Sí» o «No» apuntado de cada consentimiento, con su fecha, o «Sin dato».",
          },
          { nombre: "Alta", queEs: "Día en que se creó la ficha." },
          { nombre: "Abrir ficha", queEs: "Abre la ficha completa." },
        ],
      },
      {
        titulo: "Abajo",
        campos: [
          {
            nombre: "Brevo, WhatsApp y Reseñas de Google",
            queEs: "Conexiones que aún no están hechas: envío de boletines a quien acepta correo, avisos y encuestas por WhatsApp, y nota de Google de cada local.",
          },
        ],
      },
    ],
    logica: [
      "Los clientes son de todo el grupo: no se filtran por el local elegido arriba.",
      "Los clientes con los datos suprimidos (protección de datos) no salen en la lista.",
      "El orden es por última visita (los más recientes primero) y luego por nombre.",
    ],
    influye: [
      { texto: "Las fichas se crean al apuntar reservas", ruta: "/reservas/nueva" },
      { texto: "y solicitudes de evento", ruta: "/eventos/nueva" },
      { texto: "La exportación queda en el registro de cambios", ruta: "/ajustes/registro" },
    ],
  },

  "/clientes/nuevo": {
    titulo: "Nuevo cliente",
    area: "Clientes",
    paraQue: "Dar de alta a mano un cliente que no ha llegado por una reserva ni por un evento.",
    quien: "Hace falta el permiso «Editar clientes».",
    secciones: [
      {
        titulo: "Formulario",
        campos: [
          { nombre: "Nombre", queEs: "Nombre del cliente. Obligatorio." },
          { nombre: "Apellidos", queEs: "Apellidos." },
          {
            nombre: "Teléfono",
            queEs: "Teléfono con prefijo (+34…).",
            logica:
              "Se guarda en formato internacional: sin espacios ni puntos, «00» pasa a «+» y un número español de 9 cifras recibe el +34. Si ya hay otro cliente activo con ese teléfono, sale «Ya hay un cliente con ese teléfono» y no se crea.",
            influye: "Es el dato con el que las reservas encuentran a este cliente.",
          },
          {
            nombre: "Correo",
            queEs: "Correo del cliente. Se guarda en minúsculas.",
            influye: "Si la reserva no trae teléfono, se busca al cliente por el correo.",
          },
          { nombre: "Cumpleaños", queEs: "Fecha de nacimiento." },
          { nombre: "Etiquetas", queEs: "Separadas por comas: VIP, Empresa, Habitual. Las repetidas se quitan.", influye: "Sirven para filtrar la lista de clientes." },
          { nombre: "Alergias", queEs: "Alergias o intolerancias.", influye: "Salen en rojo en la lista y en la ficha." },
          { nombre: "Preferencias", queEs: "Gustos del cliente: mesa de ventana, vino tinto…" },
          { nombre: "Notas de sala", queEs: "Notas internas para el equipo." },
          { nombre: "Crear cliente", queEs: "Crea la ficha y la abre." },
        ],
      },
    ],
    logica: ["Los consentimientos no se piden aquí: se apuntan después en la ficha, cada uno con su fecha."],
    influye: [
      { texto: "El cliente aparece en la lista", ruta: "/clientes" },
      { texto: "Los consentimientos se apuntan en su ficha", ruta: "/clientes/[id]" },
    ],
  },

  "/clientes/[id]": {
    titulo: "Ficha del cliente",
    area: "Clientes",
    paraQue:
      "Todo lo de un cliente: datos de contacto, alergias, preferencias, visitas en cada local, encuestas respondidas y consentimientos. También se atiende aquí su derecho a que se borren sus datos.",
    quien:
      "Para verla hace falta «Ver clientes». Para cambiar datos, consentimientos o suprimir datos hace falta «Editar clientes». Si el cliente tiene los datos suprimidos, la ficha ya no se puede cambiar.",
    secciones: [
      {
        titulo: "Cabecera y avisos",
        campos: [
          { nombre: "Título", queEs: "Nombre y apellidos; debajo teléfono y correo, o «Sin datos de contacto»." },
          { nombre: "Volver", queEs: "Vuelve a la lista de clientes." },
          { nombre: "Aviso de supresión", queEs: "Sale si el cliente pidió borrar sus datos: solo queda su historia sin datos personales." },
          { nombre: "Aviso «Alergias»", queEs: "Sale en rojo arriba si tiene alergias apuntadas." },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Visitas", queEs: "Número de visitas registradas y, debajo, en cuántos locales distintos.", logica: "Los locales se cuentan entre las 50 últimas visitas." },
          { nombre: "Última visita", queEs: "Día de la última visita." },
          {
            nombre: "Gasto registrado",
            queEs: "Suma del importe de las visitas que lo tienen.",
            logica: "Las visitas que vienen de Reservas no traen importe: esta cifra se llenará cuando el programa de caja (TPV) dé el gasto de cada cliente.",
          },
          {
            nombre: "Nota media",
            queEs: "Media de las notas de sus encuestas respondidas (de 1 a 5).",
            logica: "Usa las 20 encuestas más recientes. Verde desde 4; rojo con 2 o menos; naranja en medio.",
          },
        ],
      },
      {
        titulo: "Datos",
        campos: [
          {
            nombre: "Formulario (Nombre, Apellidos, Teléfono, Correo, Cumpleaños, Etiquetas, Alergias, Preferencias, Notas de sala)",
            queEs: "Los mismos campos que al dar de alta. Pulsa «Guardar cambios» para guardar.",
            logica:
              "El teléfono se pasa a formato internacional. Los campos que dejes vacíos se borran. Sin permiso de edición solo se ven las preferencias y las notas.",
            influye: "Las alergias salen en rojo en la lista de clientes y en el aviso de arriba de la ficha. Las reservas no las toman de aquí: se apuntan en cada reserva.",
          },
          { nombre: "Etiquetas (arriba a la derecha)", queEs: "Etiquetas del cliente; VIP en azul." },
        ],
      },
      {
        titulo: "Visitas",
        campos: [
          { nombre: "Fecha, Local, Personas", queEs: "Día de la visita, local y número de personas de la reserva." },
          { nombre: "Importe", queEs: "Lo que gastó, si se conoce." },
          { nombre: "Origen", queEs: "De dónde viene la visita (RESERVA cuando sale de una reserva terminada)." },
          {
            nombre: "Cómo se apuntan",
            queEs: "Se crean solas cuando una reserva del cliente pasa a «Terminada». Se ven las 50 más recientes.",
            logica: "Una misma reserva solo cuenta una visita aunque se marque varias veces.",
          },
        ],
      },
      {
        titulo: "Encuestas",
        campos: [
          { nombre: "Enviada", queEs: "Día en que se creó la encuesta (el día en que terminó la reserva)." },
          { nombre: "Local", queEs: "Local de la visita." },
          { nombre: "Nota", queEs: "Nota de 1 a 5 o «—» si no ha respondido." },
          { nombre: "Comentario", queEs: "Lo que dijo el cliente." },
        ],
      },
      {
        titulo: "Consentimientos",
        campos: [
          {
            nombre: "Datos para gestionar reservas, Ofertas por correo, Ofertas por WhatsApp",
            queEs: "Lo último que ha dicho el cliente sobre cada cosa: «Sí» o «No» con la fecha, o «Sin dato».",
            logica: "Cada cambio se apunta como un registro nuevo con fecha; nunca se borra lo anterior. Vale para todo el grupo.",
            influye: "Decide si el cliente cuenta en «Aceptan correo» y «Aceptan WhatsApp» de la lista y lo que sale en el CSV.",
          },
          {
            nombre: "Lo acepta / Retirar",
            queEs: "Apunta que el cliente acepta o que retira su permiso, con la fecha y hora de ahora.",
          },
          {
            nombre: "Historial de consentimientos",
            queEs: "Al desplegarlo: cada registro con fecha y hora, tipo, si acepta o no, si era solo para una marca, origen y texto.",
          },
        ],
      },
      {
        titulo: "Derecho de supresión (RGPD)",
        campos: [
          {
            nombre: "El cliente lo ha pedido",
            queEs: "Casilla de confirmación. Sin marcarla no se suprime nada y sale un aviso.",
          },
          {
            nombre: "Suprimir datos",
            queEs: "Borra nombre (pasa a «Cliente suprimido»), apellidos, teléfono, correo, cumpleaños, alergias, preferencias, notas y etiquetas. No se puede deshacer.",
            logica:
              "Las visitas y encuestas se quedan sin datos personales. Se apunta un «No» en los tres consentimientos y el borrado queda en el registro de cambios con los datos de antes.",
            influye: "El cliente desaparece de la lista y del CSV. Si vuelve a reservar se le creará una ficha nueva.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Las visitas llegan al terminar reservas", ruta: "/reservas" },
      { texto: "Las encuestas se responden en", ruta: "/clientes/encuestas" },
      { texto: "Las supresiones quedan en el registro de cambios", ruta: "/ajustes/registro" },
    ],
  },

  "/clientes/encuestas": {
    titulo: "Encuestas tras la visita",
    area: "Clientes",
    paraQue:
      "Encuestas de satisfacción después de cada visita, con nota de 1 a 5. Las notas altas invitan a dejar reseña en Google y las bajas avisan a gerencia para llamar al cliente.",
    quien:
      "Para verla hace falta «Ver clientes». Para apuntar respuestas y marcar como gestionadas hace falta «Editar clientes».",
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Nota media",
            queEs: "Media de todas las encuestas respondidas de los locales elegidos, y cuántas respuestas hay.",
            logica: "No depende del filtro de estado. Verde desde 4; rojo con 2,5 o menos; naranja en medio.",
          },
          {
            nombre: "Sin respuesta",
            queEs: "Encuestas de la lista que aún no tienen respuesta. Al pulsarla filtra por ellas.",
          },
          {
            nombre: "Notas bajas por atender",
            queEs: "Encuestas de la lista con nota de 2 o menos que aún no se han gestionado. Sale en rojo si hay alguna.",
            logica: "Al pulsarla filtra por «Respondida».",
          },
          { nombre: "Invitados a reseña", queEs: "Encuestas de la lista con nota de 4 o 5." },
        ],
      },
      {
        titulo: "Filtro",
        campos: [
          { nombre: "Estado", queEs: "Todas, Sin respuesta, Respondida o Gestionada." },
          { nombre: "Filtrar / Quitar filtro", queEs: "Aplica o quita el filtro." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Enviada", queEs: "Día en que se creó la encuesta (al terminar la reserva)." },
          { nombre: "Cliente", queEs: "Cliente de la visita, con enlace a su ficha." },
          { nombre: "Local", queEs: "Local de la visita." },
          { nombre: "Nota", queEs: "Nota de 1 a 5 (verde 4 y 5, naranja 3, rojo 1 y 2)." },
          {
            nombre: "Siguiente paso",
            queEs: "«Reseña en Google» si la nota es 4 o 5; «Aviso a gerencia» si es 1 o 2.",
            logica: "Hoy es solo una marca: el envío del enlace de reseña y el aviso automático llegarán con las conexiones de WhatsApp y Google.",
          },
          {
            nombre: "Estado",
            queEs: "Sin respuesta, Respondida o Gestionada. Las notas bajas sin gestionar salen en rojo.",
          },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Comentario, Respondida, Teléfono, Seguimiento", queEs: "Lo que dijo el cliente, cuándo se apuntó la respuesta, su teléfono y qué se hizo." },
          {
            nombre: "Nota, Comentario del cliente y «Apuntar respuesta»",
            queEs: "Para encuestas sin respuesta: apunta a mano la nota (1 a 5) y el comentario que dio el cliente.",
            logica: "La encuesta pasa a «Respondida». Con 4 o 5 se marca para reseña; con 1 o 2 se marca aviso a gerencia.",
            influye: "Cuenta en la nota media de aquí y en la de la ficha del cliente.",
          },
          {
            nombre: "Qué se ha hecho y «Marcar como gestionada»",
            queEs: "Para notas bajas respondidas: escribe qué se hizo (llamada, invitación…) y se da por gestionada.",
            logica: "El texto es obligatorio.",
          },
        ],
      },
      {
        titulo: "Abajo",
        campos: [
          {
            nombre: "WhatsApp y Reseñas de Google",
            queEs: "Conexiones pendientes: envío automático de la encuesta al día siguiente de la visita y enlace de reseña del local.",
          },
        ],
      },
    ],
    logica: [
      "Las encuestas se crean solas cuando una reserva de un cliente pasa a «Terminada». Hoy no se envían: la respuesta se apunta a mano.",
      "Solo salen las encuestas de los locales elegidos en el selector de centro, y como mucho las 200 más recientes.",
      "Las cifras «Sin respuesta», «Notas bajas por atender» e «Invitados a reseña» cuentan solo las encuestas de la lista que se ve.",
    ],
    influye: [
      { texto: "Las encuestas nacen al terminar una reserva", ruta: "/reservas" },
      { texto: "La nota sale en la ficha del cliente", ruta: "/clientes/[id]" },
    ],
  },

  "/clientes/tarjetas-regalo": {
    titulo: "Tarjetas regalo",
    area: "Clientes",
    paraQue:
      "Emitir tarjetas regalo con un código único, ir descontando lo que se gasta (canjes) y ver el saldo que queda pendiente. Pueden valer en todo el grupo o solo en una marca.",
    quien:
      "Para verla hace falta «Ver clientes». Para emitir, canjear y anular hace falta «Gestionar tarjetas regalo».",
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Activas", queEs: "Tarjetas de la lista que están activas." },
          {
            nombre: "Saldo pendiente de canjear",
            queEs: "Suma del saldo de las tarjetas activas de la lista: dinero cobrado que aún se puede gastar.",
          },
          {
            nombre: "Emitido (listado)",
            queEs: "Suma del importe inicial de todas las tarjetas de la lista, en cualquier estado.",
            logica: "Depende de la búsqueda y del estado elegidos.",
          },
          { nombre: "Caducan en 30 días", queEs: "Tarjetas activas que caducan en los próximos 30 días." },
        ],
      },
      {
        titulo: "Búsqueda",
        campos: [
          { nombre: "Código, comprador o destinatario", queEs: "Busca por código o por nombre del comprador o del destinatario." },
          { nombre: "Estado", queEs: "Todas, Activa, Agotada, Caducada o Anulada." },
          { nombre: "Buscar / Quitar filtros", queEs: "Aplica o quita la búsqueda." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Código", queEs: "Código único de la tarjeta, por ejemplo GR-ABCD-EFGH.", logica: "Se genera al azar sin letras que se confunden (ni 0/O ni 1/I) y nunca se repite." },
          { nombre: "Para", queEs: "Destinatario, o el comprador si no hay destinatario." },
          { nombre: "Validez", queEs: "«Todo el grupo» o el nombre de la marca en la que vale." },
          { nombre: "Importe", queEs: "Importe con el que se emitió." },
          { nombre: "Saldo", queEs: "Lo que queda por gastar." },
          { nombre: "Caduca", queEs: "Fecha de caducidad." },
          {
            nombre: "Estado",
            queEs: "Activa, Agotada (saldo a cero), Caducada o Anulada.",
            logica: "Al abrir esta pantalla, las tarjetas activas con la fecha de caducidad ya pasada se marcan solas como caducadas.",
          },
        ],
      },
      {
        titulo: "Detalle de la tarjeta",
        campos: [
          { nombre: "Comprador, Correo comprador, Mensaje, Origen", queEs: "Datos de la venta. Origen MANUAL es emitida desde aquí." },
          {
            nombre: "Movimientos (Fecha, Movimiento, Local, Importe, Saldo, Nota)",
            queEs: "Cada operación: Emisión, Canje o Anulación, con el local, el importe (en negativo lo que se descuenta) y el saldo que quedó.",
          },
          {
            nombre: "Canjear (€), Local, nota y «Canjear»",
            queEs: "Descuenta un importe del saldo cuando el cliente paga con la tarjeta. Solo en tarjetas activas.",
            logica:
              "El importe tiene que ser mayor que cero y no superar el saldo. No se puede si está caducada. Si la tarjeta es de una marca, el local tiene que ser de esa marca. Si el saldo llega a cero, la tarjeta pasa a «Agotada». Si no eliges local, se usa el local elegido arriba.",
            influye: "Queda en los movimientos de la tarjeta y en el registro de cambios.",
          },
          {
            nombre: "Motivo de la anulación y «Anular»",
            queEs: "Anula la tarjeta: el saldo pasa a cero y ya no se puede usar. El motivo es obligatorio.",
            influye: "Queda en los movimientos y en el registro de cambios con el saldo que tenía.",
          },
        ],
      },
      {
        titulo: "Emitir tarjeta",
        campos: [
          { nombre: "Importe (€)", queEs: "Valor de la tarjeta (mayor que cero, hasta 5.000 €). Por defecto 100." },
          { nombre: "Caduca", queEs: "Fecha de caducidad. Por defecto, dentro de un año." },
          { nombre: "Válida en", queEs: "«Todo el grupo» o «Solo» una marca." },
          { nombre: "Para (destinatario)", queEs: "A quién se regala." },
          { nombre: "Comprador y Correo del comprador", queEs: "Quién la compra." },
          { nombre: "Mensaje", queEs: "Dedicatoria." },
          {
            nombre: "Emitir tarjeta",
            queEs: "Crea la tarjeta activa con el saldo igual al importe y enseña su código arriba.",
            influye: "Queda un movimiento de emisión y una anotación en el registro de cambios.",
          },
        ],
      },
    ],
    logica: [
      "Las tarjetas son de todo el grupo: no se filtran por el local elegido arriba. Se ven como mucho las 200 más recientes.",
      "Esta pantalla no cobra ni apunta la venta en Caja ni en Contabilidad: solo lleva el control del código y del saldo.",
    ],
    influye: [{ texto: "Emisiones, canjes y anulaciones quedan en el registro de cambios", ruta: "/ajustes/registro" }],
  },
};
