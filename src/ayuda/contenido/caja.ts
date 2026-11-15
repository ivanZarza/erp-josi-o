import type { AyudaArea } from "../tipos";

const AREA = "Caja y ventas";

const QUE_LOCALES =
  "Solo salen los locales (no los obradores) que tienen activada el área Caja y ventas y que entran en el centro elegido arriba. Con «Todos mis centros» salen todos los tuyos.";

export const AYUDA_CAJA: AyudaArea = {
  "/caja": {
    titulo: "Ventas",
    area: AREA,
    paraQue:
      "Muestra lo vendido por cada local en cada jornada (día de negocio). Si el local apunta o importa tickets, la jornada se calcula sola desde ellos; si no, el gerente mete aquí las cifras del día a mano. Es la fuente de las ventas del Cuadro de mando y de la exportación a la gestoría.",
    quien:
      "Para ver hace falta el permiso «Ver ventas». Para meter o corregir las ventas de un día a mano hace falta «Meter a mano las ventas del día». " + QUE_LOCALES,
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Venta de ayer (fecha)",
            queEs: "Venta neta (sin IVA) de ayer, sumando los locales de tu selección.",
            logica:
              "Suma la venta neta de las jornadas de ayer que salen en la tabla de abajo (es decir, dentro de las fechas del filtro). Debajo dice cuántos locales tienen ya la jornada de ayer metida de cuántos hay.",
          },
          {
            nombre: "Venta del periodo",
            queEs: "Venta neta (sin IVA) de todas las jornadas entre «Desde» y «Hasta».",
            logica: "Si no cambias las fechas, son los últimos 30 días hasta hoy.",
          },
          {
            nombre: "Ticket medio",
            queEs: "Lo que deja de media cada cuenta.",
            logica: "Venta del periodo ÷ número de tickets del periodo. Debajo, el número de tickets. Si no hay tickets sale «—».",
          },
          {
            nombre: "Venta por comensal",
            queEs: "Lo que gasta de media cada persona.",
            logica: "Venta del periodo ÷ número de comensales del periodo. Debajo, el número de comensales.",
          },
          {
            nombre: "Aviso «Faltan las ventas de ayer»",
            queEs: "Lista los locales que todavía no tienen ninguna jornada de ayer (ni a mano ni calculada desde tickets).",
            influye: "Mientras falte, ese día sale sin ventas en el Cuadro de mando y en el arqueo de caja.",
          },
        ],
      },
      {
        titulo: "Formulario «Meter las ventas de un día» (locales sin tickets)",
        campos: [
          {
            nombre: "Local",
            queEs: "El local cuyas ventas apuntas.",
            logica: "Sale elegido el centro activo de arriba (o el único que tengas).",
          },
          {
            nombre: "Día de negocio",
            queEs: "El día al que pertenecen las ventas. Por defecto, ayer.",
            logica: "No se admite un día posterior a hoy.",
          },
          {
            nombre: "Venta neta (sin IVA)",
            queEs: "Lo vendido en el día sin IVA. Es obligatorio.",
            influye: "Es la cifra de ventas del Cuadro de mando y de la exportación a la gestoría.",
          },
          { nombre: "IVA de la venta", queEs: "La cuota de IVA de lo vendido. Si se deja vacío se guarda como 0." },
          { nombre: "Comensales", queEs: "Número de personas atendidas. Obligatorio (número entero)." },
          { nombre: "Tickets", queEs: "Número de cuentas cobradas. Obligatorio (número entero)." },
          { nombre: "Venta comida (sin IVA)", queEs: "Opcional. Parte de la venta del turno de comida." },
          { nombre: "Venta cena (sin IVA)", queEs: "Opcional. Parte de la venta del turno de cena.", logica: "El programa no comprueba que comida + cena sumen la venta neta." },
          { nombre: "Descuentos", queEs: "Opcional. Importe descontado en las cuentas del día." },
          { nombre: "Invitaciones", queEs: "Opcional. Importe de lo que se ha invitado." },
          { nombre: "Anulaciones", queEs: "Opcional. Importe de lo anulado en el día." },
          {
            nombre: "Cobros por forma de pago (con IVA)",
            queEs: "Lo cobrado en el día en Efectivo, Tarjeta, Bizum, Vales y tarjetas regalo, A cuenta (crédito) y Otras. Con IVA.",
            logica:
              "Si rellenas el IVA y algún cobro, la suma de los cobros tiene que cuadrar con venta neta + IVA (se admite hasta 1 € de diferencia); si no, sale un error y no se guarda. Los cobros a 0 no se guardan.",
            influye:
              "El efectivo pasa al arqueo de «Apertura y cierres» (efectivo que debería haber en el cajón) y la tarjeta a «Tarjeta que liquidará el banco».",
          },
          { nombre: "Notas", queEs: "Comentario libre sobre el día." },
          {
            nombre: "Guardar ventas / Guardar corrección",
            queEs: "Guarda la jornada del local y día elegidos.",
            logica:
              "Si ese día ya existía metido a mano, se sobrescribe y el cambio queda en el registro de cambios (antes y después). No deja guardar si la jornada se calcula desde tickets o viene del TPV: en ese caso sale un aviso y el formulario no aparece.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Desde", queEs: "Primer día que se enseña. Por defecto, 29 días antes de «Hasta»." },
          { nombre: "Hasta", queEs: "Último día que se enseña. Por defecto, hoy." },
          { nombre: "Filtrar", queEs: "Aplica las fechas a las cifras y a la tabla." },
        ],
      },
      {
        titulo: "Tabla de jornadas",
        campos: [
          { nombre: "Día", queEs: "Día de negocio de la jornada." },
          { nombre: "Local", queEs: "Local de la jornada." },
          { nombre: "Venta neta", queEs: "Venta sin IVA del día." },
          { nombre: "Comensales", queEs: "Personas atendidas ese día." },
          { nombre: "Ticket medio", queEs: "Venta neta ÷ tickets de ese día." },
          {
            nombre: "Origen",
            queEs: "De dónde salen las cifras.",
            logica:
              "«Tickets»: calculada desde los tickets apuntados en el ERP. «Tickets del TPV»: calculada desde tickets importados del programa de caja. «TPV»: traída del TPV sin tickets. «A mano»: metida con el formulario de arriba.",
          },
          {
            nombre: "Detalle de la fila",
            queEs:
              "IVA, Tickets, Venta por comensal, Comida / cena (venta de cada turno), Descuentos, Invitaciones, Anulaciones, Propinas, Coste teórico de lo vendido, cada forma de pago con sus propinas y Notas.",
            logica:
              "Coste teórico de lo vendido: solo existe si la jornada sale de tickets con platos de la carta; es la suma del coste del escandallo de cada línea, y entre paréntesis el % sobre la venta. En las jornadas calculadas, «Notas» dice de cuántos tickets sale (cobrados, abiertos y anulados).",
            influye: "Ese coste teórico es la «Mercancía» del Cuadro de mando en los locales con tickets.",
          },
          {
            nombre: "Ver los tickets",
            queEs: "Solo en jornadas calculadas desde tickets: abre la pantalla Tickets con ese día y ese local elegido para apuntar.",
          },
          {
            nombre: "Corregir",
            queEs: "Solo en jornadas metidas a mano y si tienes permiso: carga ese día en el formulario de arriba para cambiarlo.",
          },
        ],
      },
    ],
    logica: [
      "Día de negocio: lo que pasa antes de la hora de corte del local (por defecto las 05:00) cuenta para el día anterior. Así una cena que acaba a la 1 de la madrugada es del día en que empezó.",
      "Jornada calculada desde tickets: suma solo los tickets cobrados. Los abiertos todavía no son venta y los anulados solo suman en «Anulaciones». Turno de comida: tickets abiertos desde la hora de corte hasta las 17:00; cena, desde las 17:00.",
      "Importes de venta, descuentos, invitaciones y anulaciones van sin IVA; los cobros por forma de pago, con IVA.",
      "Si un día metido a mano recibe después tickets (apuntados o importados), la jornada pasa a calcularse desde los tickets y las cifras puestas a mano se sustituyen.",
    ],
    influye: [
      { texto: "Ventas, comensales, tickets y mercancía del Cuadro de mando", ruta: "/cuadro" },
      { texto: "Efectivo y tarjeta del arqueo de caja", ruta: "/caja/cierres" },
      { texto: "Ventas diarias en el archivo para la gestoría", ruta: "/contabilidad/exportar" },
    ],
    comoSeUsa: [
      "Si el local no tiene tickets: cada mañana mete las cifras de ayer con el formulario (sale ya puesto ayer y tu local).",
      "Si el local tiene tickets: no hace falta tocar nada aquí; para corregir, anula la línea o el ticket en «Tickets».",
      "Revisa el aviso amarillo de «Faltan las ventas de ayer» para que el Cuadro de mando no salga incompleto.",
    ],
  },

  "/caja/tickets": {
    titulo: "Tickets",
    area: AREA,
    paraQue:
      "Lista las cuentas (tickets) de cada local con sus líneas, cobros y propinas. Mientras no haya un programa de caja (TPV) conectado, aquí se apuntan los tickets a mano o se importan en un archivo. Cada línea baja el stock de los productos de su escandallo y anularla lo devuelve. La jornada de venta del día se recalcula sola con cada cambio.",
    quien:
      "Ver: permiso «Ver ventas». Apuntar tickets, añadir líneas y cobrar: «Apuntar tickets, añadir líneas y cobrarlos». Anular líneas o tickets: «Anular líneas o tickets enteros». Importar: «Importar ventas del TPV». " + QUE_LOCALES,
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Tickets cobrados",
            queEs: "Número de tickets cobrados entre «Desde» y «Hasta». Debajo, cuántos siguen abiertos y cuántos están anulados.",
            logica: "Estas cifras solo tienen en cuenta las fechas: el filtro de estado y la búsqueda no las cambian.",
          },
          {
            nombre: "Venta (sin IVA)",
            queEs: "Suma de la venta sin IVA de los tickets cobrados.",
            logica: "Ticket medio = venta ÷ tickets cobrados.",
          },
          { nombre: "Propinas", queEs: "Propinas de los tickets cobrados. No forman parte de la venta." },
          {
            nombre: "Anulaciones",
            queEs: "Importe sin IVA de lo anulado: líneas anuladas y tickets anulados enteros. Debajo, cuántas líneas y tickets, y el importe de las invitaciones (sin IVA) de los tickets cobrados.",
            logica: "Sale en naranja si hay algún ticket anulado. Al pulsarla se filtra la lista por «Con anulaciones».",
          },
        ],
      },
      {
        titulo: "Apuntar un ticket",
        campos: [
          {
            nombre: "Local",
            queEs: "Se apunta en el local elegido arriba o en «Local para apuntar» de los filtros. Sin local elegido no aparece el formulario.",
            logica: "Si el local no tiene ninguna carta activa, sale un aviso: hay que crearla en Comidas o Bebidas.",
          },
          { nombre: "Mesa", queEs: "Opcional. Número o nombre de la mesa." },
          { nombre: "Comensales", queEs: "Personas de la mesa. Obligatorio; por defecto 2." },
          {
            nombre: "Camarero",
            queEs: "Quién atiende la mesa.",
            logica:
              "Si el área Personal está contratada, es una lista de los empleados del local (primero los de sala, barra o sumiller). Si no, se escribe el nombre a mano.",
          },
          {
            nombre: "Descuento a la cuenta (%)",
            queEs: "Opcional, de 0 a 100. Se aplica a cada línea que no sea invitación.",
            logica: "Descuento de cada línea = cantidad × precio × % ÷ 100 (con IVA). Solo se aplica a las líneas de este formulario, no a las que se añadan después.",
          },
          {
            nombre: "Estado",
            queEs: "«Cobrado» si la cuenta ya está pagada; «Abierto (mesa sin cobrar)» si la mesa sigue y se cobrará después.",
            logica: "Un ticket abierto no lleva cobros y todavía no cuenta como venta, aunque su stock ya ha bajado.",
          },
          {
            nombre: "Líneas (plato o bebida, formato y cantidad)",
            queEs:
              "Hasta 10 líneas. En cada una se elige el plato o la bebida con su formato (botella, copa…) y su precio en ese local, agrupados por sección de la carta; la cantidad (por defecto 1) y si es «Invitación».",
            logica:
              "Las filas sin plato no se guardan; hace falta al menos una. El precio es el del local si tiene un precio propio para ese plato (o su primer formato); si no, el de la marca. Solo salen los platos activos de las cartas activas del local y de su marca, menos los marcados como «no se sirve» en el local. La invitación no se cobra, pero su coste sí cuenta.",
            influye: "Cada línea baja el stock de los productos de su escandallo en el almacén por defecto del producto en el local (vinos de la Bodega, cervezas, refrescos y café de la Barra…).",
          },
          {
            nombre: "Forma de pago",
            queEs: "Cómo se ha cobrado: Efectivo, Tarjeta (por defecto), Bizum, Vales y tarjetas regalo, A cuenta (crédito) u Otras. Solo cuenta si se guarda como cobrado.",
          },
          { nombre: "Propina", queEs: "Opcional. Propina aparte de la cuenta; se apunta con la primera forma de pago." },
          {
            nombre: "Segundo cobro (opcional) e Importe del segundo cobro",
            queEs: "Para cuentas pagadas de dos formas (parte en efectivo y parte con tarjeta, por ejemplo).",
            logica: "El importe del segundo cobro (como mucho el total) se cobra con la segunda forma y el resto del total con la primera.",
          },
          { nombre: "Notas", queEs: "Comentario libre." },
          {
            nombre: "Guardar ticket",
            queEs: "Guarda el ticket con su número correlativo (serie TCK) y baja el stock de lo pedido.",
            logica: "Un ticket cobrado tiene que cuadrar: suma de cobros = total del ticket. Queda en el registro de cambios.",
            influye: "Recalcula la jornada de ese día en Ventas, y con ella el Cuadro de mando y el arqueo de caja.",
          },
        ],
      },
      {
        titulo: "Importar ventas del TPV",
        campos: [
          { nombre: "Formato", queEs: "«CSV sencillo (una fila por línea)» o «Formato propio del ERP (JSON)»." },
          { nombre: "Archivo", queEs: "El archivo con los tickets (.csv, .json o .txt). Si eliges archivo, se usa en vez del texto pegado." },
          {
            nombre: "O pega aquí el contenido",
            queEs: "El contenido del archivo pegado a mano.",
            logica:
              "CSV: primera fila con los títulos, separados por punto y coma (o coma). Columnas posibles: ticket; abierto; cobrado; mesa; comensales; camarero; plato; formato; cantidad; precio; descuento; invitacion; anulada; forma_pago; propina. Obligatorias: ticket, abierto, plato y cantidad. Las filas con el mismo «ticket» forman un solo ticket; todos entran como cobrados por el total de sus líneas, con la forma de pago y la propina de su primera fila (por defecto tarjeta). «invitacion» y «anulada»: sí/no o 1/0. Fechas «AAAA-MM-DD HH:MM» en hora de Madrid. El precio va con IVA; si no viene, se usa el de la carta.",
          },
          {
            nombre: "Importar tickets",
            queEs: "Mete los tickets en el local elegido.",
            logica:
              "Cada línea se enlaza con un plato de la carta del local por su nombre (sin tener en cuenta tildes ni mayúsculas) y el formato por su nombre. Lo que no se enlaza entra como «(sin enlazar)»: no baja stock ni tiene coste, y necesita traer precio (si no, ese ticket no se importa). Un ticket que ya se importó (mismo identificador) no se vuelve a meter. Los tickets importados llevan el número «TPV-…» y la etiqueta TPV. Las líneas que llegan anuladas no bajan stock. El día de negocio sale de la hora de apertura y la hora de corte del local.",
            influye: "Baja el stock de lo enlazado y recalcula las jornadas de los días importados.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          {
            nombre: "Local para apuntar",
            queEs: "Solo si tienes varios locales. Elige con qué local (y con qué carta) se apuntan e importan tickets.",
            logica: "No filtra la lista: la lista enseña los tickets de todos los locales de tu selección. Para ver solo un local, elígelo en el selector de centro de arriba.",
          },
          { nombre: "Desde", queEs: "Primer día de negocio. Por defecto, el día antes de «Hasta»." },
          { nombre: "Hasta", queEs: "Último día de negocio. Por defecto, hoy." },
          { nombre: "Estado", queEs: "Todos, Abiertos, Cobrados, Anulados o «Con anulaciones» (tickets anulados o con alguna línea anulada)." },
          {
            nombre: "Mesa, número o camarero",
            queEs: "Busca por la mesa (exacta), por parte del número del ticket o por parte del nombre del camarero escrito a mano.",
          },
        ],
      },
      {
        titulo: "Lista de tickets",
        campos: [
          { nombre: "Hora", queEs: "Fecha y hora en que se abrió el ticket." },
          { nombre: "Ticket", queEs: "Número del ticket (TCK-… si se apuntó aquí; TPV-… si se importó)." },
          { nombre: "Mesa", queEs: "Mesa del ticket." },
          { nombre: "Comensales", queEs: "Personas de la mesa." },
          { nombre: "Total", queEs: "Importe con IVA de la cuenta (sin propina, sin invitaciones ni líneas anuladas)." },
          { nombre: "Propina", queEs: "Propina cobrada con el ticket." },
          {
            nombre: "Estado",
            queEs: "Abierto, Cobrado o Anulado; además, cuántas líneas anuladas tiene y «TPV» si vino importado.",
            logica: "La fila sale en rojo si el ticket está anulado y en naranja si tiene líneas anuladas. Se enseñan como mucho los 300 más recientes: si salen 300, acota las fechas.",
          },
        ],
      },
      {
        titulo: "Detalle del ticket",
        campos: [
          { nombre: "Local", queEs: "Local del ticket." },
          { nombre: "Día de negocio", queEs: "Día al que cuenta y turno (comida hasta las 17:00, cena desde entonces)." },
          { nombre: "Camarero", queEs: "Empleado elegido o nombre escrito." },
          { nombre: "Venta sin IVA", queEs: "Total del ticket sin IVA.", logica: "Cada línea: total con IVA ÷ (1 + IVA del plato)." },
          { nombre: "IVA", queEs: "Total con IVA − venta sin IVA." },
          {
            nombre: "Coste teórico",
            queEs: "Lo que cuesta, según el escandallo, lo servido en el ticket (invitaciones incluidas; lo anulado no). Entre paréntesis, % sobre la venta sin IVA.",
            logica:
              "Para cada producto del escandallo: cantidad que sale × coste medio del producto en el momento de la venta. Plato sin formato: escandallo × cantidad. Formato que es parte del plato (copa = 0,2 de la botella): esa parte. Formato con producto propio (mágnum): unidades de ese producto.",
          },
          { nombre: "Descuentos", queEs: "Importe descontado, sin IVA." },
          { nombre: "Invitaciones", queEs: "Valor de lo invitado, sin IVA." },
          { nombre: "Anulado", queEs: "Valor sin IVA de lo anulado (si el ticket está anulado entero, todo lo que llevaba)." },
          { nombre: "Cobros", queEs: "Cada cobro con su forma de pago, importe y propina; «Sin cobrar» si está abierto." },
          { nombre: "Motivo de la anulación", queEs: "Solo en tickets anulados: motivo, quién y cuándo." },
          { nombre: "Notas", queEs: "Comentario del ticket." },
          {
            nombre: "Tabla de líneas (Línea, Cant., Precio, Total, Coste)",
            queEs:
              "Cada plato o bebida con su cantidad, precio unitario con IVA, total con IVA y coste teórico. Se marca «(invitación)», el descuento, «(sin enlazar con la carta)» si no baja stock, y las anuladas tachadas con su motivo, quién y cuándo.",
          },
        ],
      },
      {
        titulo: "Botones del ticket",
        campos: [
          {
            nombre: "Anular (en cada línea)",
            queEs: "Solo en tickets abiertos y con permiso de anular. Hay que escribir el motivo (al menos 3 letras).",
            logica: "La línea deja de cobrarse y su coste pasa a 0. En un ticket ya cobrado no se anulan líneas sueltas: se anula el ticket entero y se vuelve a apuntar.",
            influye: "Devuelve al almacén el stock que había bajado y recalcula el ticket y la jornada.",
          },
          {
            nombre: "Añadir líneas / Añadir",
            queEs: "Solo en tickets abiertos: añade hasta 3 líneas más.",
            logica: "Solo se puede si el local elegido para apuntar es el del ticket; si no, sale «Elegir este local para añadir».",
            influye: "Bajan el stock en ese momento y se recalculan el ticket y la jornada.",
          },
          {
            nombre: "Cobrar (importe)",
            queEs: "Solo en tickets abiertos: forma de pago, propina y segundo cobro opcional, como al apuntar.",
            logica: "La suma de los cobros tiene que ser el total del ticket.",
            influye: "El ticket pasa a contar como venta del día y sus cobros entran en el arqueo de caja.",
          },
          {
            nombre: "Anular ticket",
            queEs: "Anula el ticket entero, abierto o cobrado. Hay que escribir el motivo.",
            influye: "Devuelve el stock de todas sus líneas vivas, sale de la venta de la jornada (y sus cobros del arqueo) y su importe pasa a «Anulaciones».",
          },
        ],
      },
    ],
    logica: [
      "Todo cambio (apuntar, añadir, cobrar, anular, importar) recalcula al momento la jornada de ese local y día en «Ventas».",
      "Los movimientos de stock son de tipo venta: en negativo al vender y en positivo al anular. Se ven en los movimientos de Bebidas y Comidas.",
      "Todas las acciones quedan en el registro de cambios con el usuario.",
    ],
    influye: [
      { texto: "Jornada de venta del día", ruta: "/caja" },
      { texto: "Venta por plato y consumo teórico", ruta: "/caja/platos" },
      { texto: "Stock de bebidas", ruta: "/bebidas/stock" },
      { texto: "Stock de comidas", ruta: "/comidas/stock" },
      { texto: "Arqueo de caja (efectivo y tarjeta)", ruta: "/caja/cierres" },
      { texto: "Ventas y mercancía del Cuadro de mando", ruta: "/cuadro" },
    ],
    comoSeUsa: [
      "Elige tu local arriba, rellena mesa, comensales y las líneas, y guarda como cobrado (o abierto si la mesa sigue).",
      "Para una mesa abierta: abre su ticket en la lista, añade líneas y, al final, pulsa «Cobrar».",
      "Si algo se apuntó mal en un ticket cobrado, anula el ticket entero con su motivo y vuelve a apuntarlo bien.",
    ],
  },

  "/caja/cierres": {
    titulo: "Apertura y cierres de caja",
    area: AREA,
    paraQue:
      "Controla el dinero del cajón de cada local y día: se abre la caja con el fondo inicial, se apuntan las retiradas y pagos hechos con dinero de caja, y al cerrar se cuenta el efectivo y se compara con lo que debería haber. Después, otra persona (finanzas) valida o rechaza el cierre. Todo descuadre lleva su motivo.",
    quien:
      "Ver: permiso «Ver cierres». Abrir la caja, apuntar movimientos y hacer cierres: «Abrir la caja, apuntar retiradas y pagos, y hacer cierres». Validar: «Validar cierres»; quien hizo el cierre no puede validarlo él mismo, salvo el administrador. " + QUE_LOCALES,
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Pendientes de validar", queEs: "Cierres de la lista que esperan revisión. Al pulsar, filtra por ellos." },
          { nombre: "Cierres con descuadre", queEs: "Cierres de la lista cuyo efectivo contado no coincide con el teórico, de cuántos hay en la lista." },
          {
            nombre: "Descuadre acumulado",
            queEs: "Suma de los descuadres de efectivo de los cierres de la lista.",
            logica: "Negativo (en rojo) = en total ha faltado dinero; positivo = ha sobrado. Depende de los filtros de abajo.",
          },
        ],
      },
      {
        titulo: "Caja del día: apertura, retiradas y pagos",
        campos: [
          { nombre: "Local", queEs: "Solo si tienes varios locales: de cuál ver la caja." },
          { nombre: "Día de negocio", queEs: "Día de la caja. Por defecto, hoy. No admite días futuros." },
          { nombre: "Ver", queEs: "Enseña la caja de ese local y día." },
          { nombre: "Fondo inicial (apertura)", queEs: "Dinero con el que se abrió el cajón y la hora de apertura, o «Sin abrir»." },
          {
            nombre: "Cobros en efectivo",
            queEs: "Lo cobrado en efectivo según la jornada de venta del día (sin propinas).",
            logica: "Sale de los tickets cobrados o de lo metido a mano en Ventas. «Sin ventas» si ese día no tiene jornada.",
          },
          { nombre: "Entradas de cambio", queEs: "Dinero metido en el cajón durante el día (por ejemplo, cambio traído del banco)." },
          { nombre: "Retiradas", queEs: "Dinero sacado del cajón (por ejemplo, a la caja fuerte). Sale en negativo." },
          { nombre: "Pagos con dinero de caja", queEs: "Pagos hechos con el dinero del cajón (repartidor, compras pequeñas…). En negativo." },
          {
            nombre: "Efectivo que debería haber",
            queEs: "Lo que tiene que haber en el cajón al cerrar.",
            logica: "Fondo inicial + cobros en efectivo + entradas de cambio − retiradas − pagos con dinero de caja.",
          },
          {
            nombre: "Tarjeta que liquidará el banco",
            queEs: "Lo que el banco tiene que ingresar por las tarjetas del día.",
            logica: "Cobros con tarjeta + propinas con tarjeta (el banco liquida las dos juntas).",
          },
          { nombre: "Propinas en efectivo (al bote)", queEs: "Propinas en efectivo del día. Van al bote del personal, no cuentan en el cajón." },
          { nombre: "Lista de movimientos", queEs: "Cada retirada, pago o entrada con su hora, tipo, concepto e importe." },
          {
            nombre: "Abrir la caja con un fondo de / Abrir caja",
            queEs: "Abre la caja del día con el fondo que escribas (por defecto 300).",
            logica: "Si ya está abierta, el botón es «Corregir» y cambia el fondo inicial. Si ese día ya tiene cierre, no se puede abrir ni corregir.",
          },
          {
            nombre: "Tipo, Importe, Concepto y Apuntar",
            queEs: "Apunta una «Retirada», un «Pago con dinero de caja» o una «Entrada de cambio».",
            logica:
              "Solo aparece si la caja del día está abierta. El importe tiene que ser mayor que cero y el concepto explicar a quién o para qué (al menos 3 letras). Si el día ya tiene cierre, no se puede apuntar. Los movimientos no se borran desde aquí.",
            influye: "Cambia el efectivo que debería haber y, por tanto, el descuadre del cierre.",
          },
        ],
      },
      {
        titulo: "Hacer cierre de caja",
        campos: [
          { nombre: "Local", queEs: "Local que se cierra." },
          { nombre: "Día de negocio", queEs: "Día que se cierra. Por defecto, ayer (o el día elegido arriba). No admite días futuros en el calendario." },
          { nombre: "Efectivo contado", queEs: "Dinero contado en el cajón al cerrar. Obligatorio." },
          {
            nombre: "Efectivo teórico",
            queEs: "Lo que debería haber. Normalmente se deja vacío.",
            logica:
              "Vacío = el «Efectivo que debería haber» calculado arriba (fondo inicial + efectivo de las ventas + entradas de cambio − retiradas − pagos). Si ese día no tiene ni ventas ni apertura, hay que escribirlo o meter antes la jornada.",
          },
          {
            nombre: "Tarjeta según el banco",
            queEs: "Opcional. Lo que liquida el banco por las tarjetas del día, propinas incluidas.",
            logica: "Si lo pones y hay tarjeta teórica, se compara con ella.",
          },
          { nombre: "Fondo de caja que se deja", queEs: "Dinero que se queda en el cajón para el día siguiente." },
          {
            nombre: "Motivo del descuadre",
            queEs: "Explicación de la diferencia.",
            logica: "Obligatorio si el efectivo contado no coincide con el teórico, o si la tarjeta del banco no coincide con la tarjeta teórica.",
          },
          {
            nombre: "Guardar cierre",
            queEs: "Guarda el cierre como «Pendiente de validar».",
            logica:
              "Descuadre = efectivo contado − efectivo teórico (negativo: falta dinero; positivo: sobra). El cierre guarda una foto del arqueo en ese momento (fondo, efectivo de ventas, retiradas, pagos, propinas). Si el cierre de ese día ya existe y no está validado (pendiente o rechazado), se rehace y vuelve a pendiente, borrando la revisión anterior. Un cierre validado no se puede rehacer.",
            influye: "A partir de ahí ya no se puede cambiar la apertura ni apuntar movimientos de ese día.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Estado", queEs: "Todos, Pendiente de validar, Validado o Rechazado: revisar." },
          { nombre: "Desde", queEs: "Primer día que se enseña. Por defecto, hace 30 días." },
        ],
      },
      {
        titulo: "Lista de cierres",
        campos: [
          { nombre: "Día", queEs: "Día de negocio cerrado." },
          { nombre: "Local", queEs: "Local del cierre." },
          { nombre: "Teórico", queEs: "Efectivo que debería haber." },
          { nombre: "Contado", queEs: "Efectivo contado." },
          { nombre: "Descuadre", queEs: "Contado − teórico. En rojo si falta dinero y en naranja si sobra." },
          { nombre: "Estado", queEs: "Pendiente de validar, Validado o Rechazado: revisar (la fila sale en rojo)." },
          {
            nombre: "Detalle del cierre",
            queEs:
              "Fondo inicial, Efectivo de las ventas, Retiradas y pagos con caja (neto: entradas de cambio − retiradas − pagos), Tarjeta (ventas + propinas), Propinas en efectivo, Tarjeta (banco), Diferencia tarjeta (banco − teórica), Fondo que se deja, Motivo, Cerrado por, Revisado por, Revisado el y Comentario de finanzas.",
          },
          {
            nombre: "Comentario, Validar y Rechazar",
            queEs: "Solo en cierres pendientes y con permiso de validar.",
            logica: "Validar lo da por bueno y ya no se puede rehacer. Rechazar exige comentario: el local tiene que volver a hacer el cierre de ese día.",
          },
        ],
      },
    ],
    logica: [
      "Las propinas en efectivo no van al cajón (van al bote); las de tarjeta las liquida el banco junto con las ventas.",
      "Todo (apertura, corrección del fondo, movimientos, cierres, validaciones) queda en el registro de cambios.",
    ],
    influye: [
      { texto: "El efectivo y la tarjeta salen de la jornada de venta", ruta: "/caja" },
      { texto: "Los tickets cobrados alimentan esa jornada", ruta: "/caja/tickets" },
    ],
    comoSeUsa: [
      "Al abrir el local: elige el día y pulsa «Abrir caja» con el fondo.",
      "Durante el día: apunta cada retirada o pago con dinero de caja.",
      "Al cerrar: cuenta el efectivo, escríbelo en «Hacer cierre de caja» y, si no cuadra, explica el motivo.",
      "Finanzas revisa la lista de «Pendientes de validar» y valida o rechaza con comentario.",
    ],
  },

  "/caja/platos": {
    titulo: "Venta por plato",
    area: AREA,
    paraQue:
      "Dos vistas: «Venta por plato», con lo vendido de cada plato y formato (de los tickets), su coste teórico y su margen; y «Consumo teórico frente a real», que compara lo que debería haber salido del almacén por las ventas con lo que de verdad ha bajado según los inventarios.",
    quien: "Permiso «Ver ventas». " + QUE_LOCALES,
    secciones: [
      {
        titulo: "Pestañas",
        campos: [
          { nombre: "Venta por plato", queEs: "Ventas, coste y margen de cada plato y formato." },
          { nombre: "Consumo teórico frente a real", queEs: "Diferencia entre lo vendido y lo que ha desaparecido del almacén entre dos inventarios." },
        ],
      },
      {
        titulo: "Venta por plato: filtros",
        campos: [
          { nombre: "Desde", queEs: "Primer día de negocio. Por defecto, el día 1 del mes de «Hasta»." },
          { nombre: "Hasta", queEs: "Último día de negocio. Por defecto, ayer." },
          {
            nombre: "Área",
            queEs: "«Comidas y bebidas», «Comidas» o «Bebidas».",
            logica: "Las líneas sin enlazar con la carta no tienen área: solo salen con «Comidas y bebidas».",
          },
          { nombre: "Detalle de cada plato", queEs: "Si el detalle de cada fila se agrupa «Por meses» o «Por días»." },
        ],
      },
      {
        titulo: "Venta por plato: cifras",
        campos: [
          { nombre: "Venta sin IVA", queEs: "Suma de lo vendido en el periodo y área elegidos." },
          {
            nombre: "Coste teórico",
            queEs: "Coste según escandallo de todo lo servido, invitaciones incluidas. Debajo, % sobre la venta.",
          },
          { nombre: "Margen bruto", queEs: "Venta − coste teórico, y su % sobre la venta. En rojo si sale negativo." },
          { nombre: "Unidades vendidas", queEs: "Unidades cobradas (sin contar las invitadas) y número de platos y formatos distintos." },
        ],
      },
      {
        titulo: "Venta por plato: tabla",
        campos: [
          { nombre: "Plato · formato", queEs: "Plato (o bebida, marcada «(bebida)») y formato. Cada formato va en su fila." },
          { nombre: "Unidades", queEs: "Unidades cobradas, sin las invitadas." },
          { nombre: "Venta", queEs: "Venta sin IVA." },
          {
            nombre: "Coste teórico",
            queEs: "Coste del escandallo de lo servido, invitaciones incluidas.",
            logica: "Escandallo del plato (o la parte del formato: copa = 0,2 de la botella) × coste medio de cada producto en el momento de la venta. Se guarda al vender: si luego cambia el coste del producto, no cambia.",
          },
          { nombre: "Margen", queEs: "Venta − coste teórico." },
          { nombre: "% coste", queEs: "Coste ÷ venta × 100. La fila sale en naranja si pasa del 40 %." },
          {
            nombre: "Detalle de la fila",
            queEs:
              "Precio medio sin IVA (venta ÷ unidades), Coste teórico por unidad (coste ÷ unidades servidas, invitadas incluidas), Invitadas, Peso en la venta (% de esta fila sobre la venta total) y una tabla por mes o por día con unidades, venta, coste y margen.",
            logica: "En esa tabla por mes o día, las unidades incluyen las invitadas.",
          },
        ],
      },
      {
        titulo: "Consumo teórico frente a real: filtros",
        campos: [
          { nombre: "Local", queEs: "Local que se analiza (si tienes varios). Hace falta elegir uno." },
          { nombre: "Área", queEs: "Bebidas (por defecto) o Comidas." },
          {
            nombre: "Hasta el inventario",
            queEs: "Inventario cerrado de todo el local con el que termina la comparación. Por defecto, el último.",
            logica: "Solo cuentan los inventarios cerrados de todo el local (no los de un solo almacén). El inicio es el inventario cerrado anterior; si no hay, se empieza desde stock 0.",
          },
        ],
      },
      {
        titulo: "Consumo teórico frente a real: cifras",
        campos: [
          { nombre: "Aviso de arriba", queEs: "Dice entre qué dos inventarios se compara (con fecha y hora de cierre) y cómo se calcula." },
          { nombre: "Consumo teórico (ventas)", queEs: "Valor de lo que ha bajado por las ventas de los tickets.", logica: "Suma de (teórico × coste por unidad) de cada producto." },
          { nombre: "Consumo real (inventarios)", queEs: "Valor de lo que de verdad ha desaparecido.", logica: "Suma de (real × coste por unidad) de cada producto." },
          {
            nombre: "Diferencia sin explicar",
            queEs: "Consumo real − consumo teórico, y su % sobre el teórico.",
            logica: "Sale en naranja si la diferencia es mayor que el 5 % del teórico. Positiva: ha salido más de lo vendido (roturas sin apuntar, invitaciones fuera del TPV, robos, raciones grandes…).",
          },
        ],
      },
      {
        titulo: "Consumo teórico frente a real: tabla",
        campos: [
          { nombre: "Producto", queEs: "Producto del inventario final con su unidad." },
          { nombre: "Teórico", queEs: "Cantidad que ha bajado por las ventas (ventas menos anulaciones)." },
          { nombre: "Real", queEs: "Recuento inicial + entradas − mermas − recuento final." },
          { nombre: "Diferencia", queEs: "Real − teórico, en la unidad del producto." },
          {
            nombre: "Diferencia €",
            queEs: "Diferencia × coste por unidad del inventario final.",
            logica: "La lista va ordenada por la diferencia en euros (la mayor primero) y en naranja las de 50 € o más. Solo salen productos con movimiento real o teórico.",
          },
          {
            nombre: "Detalle de la fila",
            queEs:
              "Referencia, Recuento inicial, Entradas (compras y pedidos), Mermas apuntadas, Recuento final, Coste por unidad y Diferencia sobre el teórico (%).",
            logica:
              "Recuentos: lo contado en el inventario (o el teórico si no se contó). Entradas: compras recibidas y lo recibido de otros centros, menos lo servido a otros centros, más cargas iniciales, producción y traspasos, cada uno con su signo.",
          },
        ],
      },
    ],
    logica: [
      "Solo cuentan los tickets cobrados y sus líneas no anuladas. Las jornadas metidas a mano (sin tickets) no tienen detalle por plato.",
      "Las invitaciones cuentan en el coste, no en la venta.",
    ],
    influye: [
      { texto: "Los tickets son el origen de estos datos", ruta: "/caja/tickets" },
      { texto: "Escandallos y formatos de los platos", ruta: "/comidas/carta" },
      { texto: "Escandallos y formatos de las bebidas", ruta: "/bebidas/carta" },
      { texto: "Inventarios de bebidas", ruta: "/bebidas/inventarios" },
      { texto: "Inventarios de comidas", ruta: "/comidas/inventarios" },
    ],
    comoSeUsa: [
      "Mira los platos en naranja (más del 40 % de coste): conviene revisar su precio o su escandallo.",
      "Tras cada inventario completo, abre «Consumo teórico frente a real» y revisa los productos con más diferencia en euros.",
    ],
  },
};
