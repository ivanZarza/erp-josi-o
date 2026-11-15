import type { AyudaArea } from "../tipos";

const OBRADORES =
  "Se ven los obradores entre tus centros: el elegido arriba si es un obrador, o todos tus obradores si eliges «Todos mis centros». Si arriba hay un local elegido, sale el aviso de que no es un obrador.";

export const AYUDA_OBRADOR: AyudaArea = {
  "/obrador": {
    titulo: "Obrador · Resumen",
    area: "Obrador",
    paraQue: "Resumen del día del obrador: qué hay que producir hoy, qué lotes están a punto de caducar, cuánto se ha vendido a los locales este mes y cuántos pedidos esperan.",
    quien: "Permiso «Ver el obrador».",
    secciones: [
      {
        titulo: "Botones de arriba",
        campos: [
          { nombre: "Planificar producción", queEs: "Abre Producción." },
          { nombre: "Tarifas a locales", queEs: "Abre los precios a los que el obrador vende a cada local." },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          {
            nombre: "Producción de hoy",
            queEs: "Órdenes de producción con fecha de hoy (hora de Madrid), con cuántas están cerradas y cuántas por hacer.",
          },
          {
            nombre: "Lotes que caducan",
            queEs: "Lotes vigentes que caducan en los próximos 3 días o que caducaron en los 2 últimos días.",
            logica: "Los lotes retirados no cuentan. Al pulsar se abre Lotes.",
          },
          {
            nombre: "Venta a locales (mes)",
            queEs: "Lo servido a los locales desde el día 1 del mes (00:00, hora de Madrid) a precio de tarifa.",
            logica:
              "Suma de cantidad servida × precio de la línea de los pedidos servidos o recibidos que salen de tus obradores (Comidas y Bebidas). El detalle «Margen sobre coste» = venta − cantidad servida × coste del producto el día en que se sirvió (el de la salida del obrador, movimiento «Salida por pedido»), no el coste medio de hoy.",
          },
          { nombre: "Pedidos por servir", queEs: "Pedidos de los locales a tus obradores que aún están por servir (Comidas y Bebidas)." },
        ],
      },
      {
        titulo: "Producción de hoy",
        campos: [
          { nombre: "Orden", queEs: "Número de la orden (serie OP)." },
          { nombre: "Elaborado", queEs: "Producto que sale de la receta." },
          { nombre: "Cantidad", queEs: "Producida (si está cerrada) o prevista." },
          { nombre: "Estado", queEs: "Por hacer, Cerrada o Anulada." },
          {
            nombre: "Detalle: Receta, Tandas, Coste, Lote",
            queEs: "Receta usada, número de tandas, coste real (o estimado si aún no se ha cerrado) y código del lote creado.",
          },
        ],
      },
      {
        titulo: "Lotes que caducan",
        campos: [
          { nombre: "Lote, Producto, Cantidad", queEs: "Código del lote, elaborado y cantidad producida." },
          { nombre: "Caduca", queEs: "Fecha de caducidad; en rojo «Caducado» si ya pasó." },
          {
            nombre: "Detalle: Elaborado, Orden, Conservación, Enviado a",
            queEs: "Cuándo se hizo, orden de la que sale, cómo se conserva y locales a los que se sirvió ese producto mientras el lote estaba vigente (aproximado).",
          },
        ],
      },
      {
        titulo: "Venta a locales este mes",
        campos: [
          { nombre: "Local", queEs: "Local que ha recibido pedidos." },
          { nombre: "Líneas servidas", queEs: "Líneas de pedido servidas este mes." },
          { nombre: "Importe", queEs: "Cantidad servida × precio de tarifa. Ordenado de mayor a menor." },
        ],
      },
    ],
    logica: [OBRADORES],
    influye: [
      { texto: "Producción", ruta: "/obrador/produccion" },
      { texto: "Lotes", ruta: "/obrador/lotes" },
      { texto: "Pedidos de los locales por servir", ruta: "/comidas/pedidos" },
    ],
  },

  "/obrador/produccion": {
    titulo: "Producción",
    area: "Obrador",
    paraQue:
      "Planificar órdenes de producción (qué receta, qué día y cuántas tandas) y cerrarlas al terminar: salen del stock los ingredientes y entra el elaborado con su lote y caducidad.",
    quien: "Ver: «Ver producción». Planificar, cerrar y anular: «Planificar y cerrar producción».",
    secciones: [
      {
        titulo: "Planificar producción",
        campos: [
          { nombre: "Receta", queEs: "Recetas activas de tus obradores, con lo que rinde cada tanda." },
          { nombre: "Día", queEs: "Día en que se va a producir. Por defecto, hoy." },
          { nombre: "Tandas", queEs: "Cuántas veces se hace la receta. Admite decimales (0,5 = media tanda). Mayor que 0." },
          { nombre: "Notas", queEs: "Para qué es: un pedido, el reparto del jueves…" },
          {
            nombre: "Planificar",
            queEs: "Crea la orden (serie OP) en estado «Planificada».",
            logica: "Cantidad prevista = rendimiento de la receta × tandas. No mueve stock.",
          },
        ],
      },
      {
        titulo: "Pestañas",
        campos: [{ nombre: "Por hacer, Cerradas, Anuladas, Todas", queEs: "Filtra las órdenes por estado. Se ven las 200 más recientes." }],
      },
      {
        titulo: "Tabla de órdenes",
        campos: [
          { nombre: "Orden", queEs: "Número OP." },
          { nombre: "Día", queEs: "Día planificado. En amarillo si está planificada para un día que ya pasó." },
          { nombre: "Elaborado", queEs: "Producto que sale." },
          { nombre: "Tandas", queEs: "Número de tandas." },
          { nombre: "Cantidad", queEs: "Real si está cerrada; prevista si no." },
          {
            nombre: "Coste",
            queEs: "Coste real (cerrada) o estimado en gris (sin cerrar).",
            logica: "Estimado = suma de cantidad bruta × tandas × coste medio actual de cada ingrediente.",
          },
          { nombre: "Estado", queEs: "Planificada, Cerrada o Anulada." },
        ],
      },
      {
        titulo: "Detalle de la orden",
        campos: [
          { nombre: "Receta", queEs: "Enlace a la receta." },
          { nombre: "Obrador", queEs: "Obrador de la receta." },
          { nombre: "Cantidad prevista, Cantidad real", queEs: "Lo planificado y lo que salió de verdad." },
          { nombre: "Coste por unidad", queEs: "Coste total / cantidad real (al cerrar)." },
          { nombre: "Cerrada", queEs: "Cuándo se cerró." },
          { nombre: "Lote", queEs: "Código del lote creado; enlace a Lotes." },
          {
            nombre: "Ingredientes que saldrán del stock / Ingredientes previstos",
            queEs: "Cada ingrediente con su cantidad bruta para todas las tandas y su coste al precio medio actual.",
            logica: "Bruta = neta / (1 − merma %) × tandas.",
          },
          { nombre: "Imprimir etiqueta del lote", queEs: "Abre la etiqueta del lote para imprimir." },
        ],
      },
      {
        titulo: "Cerrar o anular (orden planificada)",
        campos: [
          { nombre: "Cantidad producida", queEs: "Lo que ha salido de verdad, en la unidad del elaborado. Viene la prevista. Mayor que 0." },
          {
            nombre: "Cerrar aunque falte stock",
            queEs: "Permite cerrar aunque el stock del obrador no llegue para algún ingrediente (por ejemplo, si el recuento no está al día). Ese stock quedará en negativo.",
          },
          {
            nombre: "Cerrar y crear lote",
            queEs: "Termina la producción.",
            logica:
              "1) Comprueba que hay stock de cada ingrediente en el obrador (si no y no has marcado la casilla, avisa de qué falta). 2) Resta cada ingrediente (movimiento «Consumo en producción») a su coste medio. 3) Coste total = suma de esas salidas; coste por unidad = coste total / cantidad producida. 4) Suma el elaborado al stock del obrador (movimiento «Entrada de producción») a ese coste. 5) Crea el lote (serie LOTE) con caducidad = momento del cierre + vida útil de la receta, sus alérgenos y su conservación. 6) Nuevo coste medio del elaborado = (stock anterior en el obrador × coste anterior + producido × coste por unidad) / total. 7) Recalcula las tarifas «A coste» y «Coste + %» de ese elaborado. No se puede deshacer.",
            influye:
              "Stock del obrador (ingredientes y elaborado), coste de los platos que llevan el elaborado, precios a los locales y Lotes.",
          },
          { nombre: "Anular", queEs: "Deja la orden «Anulada». Solo si está planificada. No mueve stock." },
        ],
      },
    ],
    logica: [OBRADORES],
    influye: [
      { texto: "Stock de comidas del obrador", ruta: "/comidas/stock" },
      { texto: "Lotes creados", ruta: "/obrador/lotes" },
      { texto: "Tarifas a locales", ruta: "/obrador/tarifas" },
      { texto: "Coste de los platos con elaborados", ruta: "/comidas/carta" },
    ],
    comoSeUsa: [
      "Por la mañana, planifica las órdenes del día.",
      "Al terminar cada una, abre su fila, escribe lo que ha salido y pulsa «Cerrar y crear lote».",
      "Imprime la etiqueta del lote y pégala en el envase.",
    ],
  },

  "/obrador/recetas": {
    titulo: "Recetas de producción",
    area: "Obrador",
    paraQue: "Las recetas del obrador: ingredientes con cantidad neta y merma, lo que rinde cada tanda, vida útil, conservación y alérgenos. Cada receta produce un elaborado del catálogo.",
    quien: "Ver: «Ver recetas de producción». Crear y cambiar: «Editar recetas».",
    secciones: [
      {
        titulo: "Botón de arriba",
        campos: [{ nombre: "Ver desactivadas / Ocultar desactivadas", queEs: "Enseña u oculta las recetas desactivadas." }],
      },
      {
        titulo: "Tabla de recetas",
        campos: [
          { nombre: "Receta", queEs: "Nombre; «Desactivada» si lo está. En amarillo si algún ingrediente no tiene coste." },
          { nombre: "Elaborado", queEs: "Producto que sale y su referencia." },
          { nombre: "Rinde", queEs: "Cantidad del elaborado que sale de una tanda." },
          { nombre: "Coste tanda", queEs: "Suma de cantidad bruta × coste medio de cada ingrediente." },
          { nombre: "Coste unidad", queEs: "Coste tanda / rendimiento." },
          { nombre: "Vida útil", queEs: "Días que dura el elaborado; da la caducidad del lote." },
          { nombre: "Alérgenos", queEs: "Los de los ingredientes más los que añade la elaboración." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Obrador, Conservación, Tiempo", queEs: "Datos de la receta." },
          {
            nombre: "Precio medio actual",
            queEs: "Coste medio del elaborado en el catálogo, que sale de las producciones cerradas (puede diferir del coste unidad de la receta).",
          },
          { nombre: "Coste al último precio", queEs: "Coste de la tanda con el precio de la última compra o producción de cada ingrediente." },
          { nombre: "Trazas", queEs: "Trazas que vienen de los ingredientes." },
          { nombre: "Ingredientes sin coste", queEs: "Ingredientes con coste 0: el coste de la receta sale más bajo de lo real." },
          { nombre: "Tabla de ingredientes", queEs: "Neta, merma %, bruta y coste de cada uno." },
          { nombre: "Pasos", queEs: "Cómo se hace." },
          { nombre: "Editar receta / Ver receta", queEs: "Abre la ficha." },
        ],
      },
      {
        titulo: "Nueva receta",
        campos: [
          { nombre: "Obrador", queEs: "Obrador al que pertenece." },
          { nombre: "Nombre de la receta", queEs: "Obligatorio." },
          {
            nombre: "Elaborado de salida (si ya existe)",
            queEs: "Producto de Comidas que produce la receta. Un producto solo puede tener una receta.",
          },
          {
            nombre: "Nombre del producto nuevo y Unidad del elaborado",
            queEs: "Si no eliges uno existente, se crea un producto nuevo en Comidas con este nombre, esta unidad, la familia «Elaborados del obrador», una referencia OB-EL automática, IVA 10 % y coste 0 hasta la primera producción.",
          },
          { nombre: "Rendimiento por tanda", queEs: "Cuánto elaborado sale de una tanda. Mayor que 0." },
          { nombre: "Vida útil (días)", queEs: "Días enteros, de 0 a 730." },
          { nombre: "Conservación", queEs: "Por ejemplo «Refrigerado de 0 a 4 °C». Sale en la etiqueta del lote." },
          { nombre: "Crear receta y añadir ingredientes", queEs: "Crea la receta y abre su ficha." },
        ],
      },
    ],
    logica: [OBRADORES],
    influye: [
      { texto: "Planificar producción", ruta: "/obrador/produccion" },
      { texto: "El elaborado se puede usar en los escandallos de la carta", ruta: "/comidas/carta" },
    ],
  },

  "/obrador/recetas/[id]": {
    titulo: "Ficha de la receta",
    area: "Obrador",
    paraQue: "Editar una receta: sus ingredientes por tanda, rendimiento, vida útil, conservación, tiempo, pasos y alérgenos que añade la elaboración.",
    quien: "Ver: «Ver recetas de producción». Cambiar: «Editar recetas» y acceso al obrador de la receta.",
    secciones: [
      {
        titulo: "Botones de arriba",
        campos: [
          { nombre: "Volver a recetas", queEs: "Vuelve a la lista." },
          { nombre: "Desactivar receta / Activar receta", queEs: "Una receta desactivada no se puede planificar. No se borra." },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Coste por tanda", queEs: "Suma de bruta × coste medio. Debajo, al último precio." },
          { nombre: "Coste por (unidad)", queEs: "Coste por tanda / rendimiento." },
          { nombre: "Vida útil", queEs: "Días y conservación." },
          { nombre: "Alérgenos", queEs: "Cuántos y cuáles lleva el elaborado." },
        ],
      },
      {
        titulo: "Ingredientes por tanda",
        campos: [
          { nombre: "Ingrediente", queEs: "Producto, con «Elaborado» si sale de otra receta, y sus alérgenos." },
          { nombre: "Neta · merma % y Guardar", queEs: "Cantidad limpia que lleva una tanda y % que se pierde (0 a 95)." },
          { nombre: "Bruta", queEs: "Lo que sale del almacén: neta / (1 − merma / 100)." },
          { nombre: "Precio medio", queEs: "Coste medio del producto, o «Sin coste»." },
          { nombre: "Coste", queEs: "Bruta × precio medio." },
          { nombre: "Quitar", queEs: "Quita el ingrediente; los alérgenos del elaborado se recalculan." },
          {
            nombre: "Añadir: Ingrediente, Cantidad neta, Merma %",
            queEs: "Añade un producto de Comidas, de Bebidas u otro elaborado (no el mismo elaborado de la receta).",
            logica: "Al añadir o quitar, los alérgenos del elaborado se recalculan y se guardan en su ficha de alérgenos.",
            influye: "Lo que se resta del stock al cerrar cada producción y el coste del lote.",
          },
        ],
      },
      {
        titulo: "Datos de la receta",
        campos: [
          { nombre: "Nombre", queEs: "Nombre de la receta." },
          { nombre: "Rendimiento", queEs: "Cuánto elaborado sale por tanda. Mayor que 0. Afecta a la cantidad prevista de las órdenes nuevas." },
          { nombre: "Vida útil (días)", queEs: "Días enteros de 0 a 730. Da la caducidad de los lotes nuevos." },
          { nombre: "Conservación", queEs: "Sale en la etiqueta del lote." },
          { nombre: "Tiempo (min)", queEs: "Minutos que lleva hacerla. Informativo." },
          { nombre: "Pasos", queEs: "Cómo se hace." },
          {
            nombre: "Alérgenos",
            queEs: "Los grises vienen de los ingredientes y no se pueden quitar aquí. Marca además los que añade la elaboración.",
            influye: "Ficha de alérgenos del elaborado, platos que lo llevan y etiqueta de los lotes nuevos.",
          },
          { nombre: "Guardar receta", queEs: "Guarda los datos y recalcula los alérgenos del elaborado." },
        ],
      },
    ],
    influye: [
      { texto: "Producción", ruta: "/obrador/produccion" },
      { texto: "Alérgenos de los ingredientes", ruta: "/comidas/carta/alergenos" },
    ],
  },

  "/obrador/tarifas": {
    titulo: "Tarifas a locales",
    area: "Obrador",
    paraQue:
      "Precio al que el obrador vende cada artículo (sus elaborados y artículos de reventa) a cada local: a coste, coste más un porcentaje o precio fijo.",
    quien: "Ver: «Ver tarifas». Aplicar y recalcular: «Editar tarifas a locales».",
    secciones: [
      {
        titulo: "Arriba",
        campos: [
          {
            nombre: "Recalcular con el coste actual",
            queEs: "Vuelve a calcular todos los precios «A coste» y «Coste + %» de este obrador con el coste medio de hoy.",
            logica:
              "Útil para artículos de reventa: su coste cambia al recibir compras pero el precio a los locales no se recalcula solo. Si el precio de un local se cambió a mano en Stock («Tarifa al centro»), no se pisa: esa tarifa pasa a «Precio fijo» con el precio puesto a mano.",
          },
          { nombre: "Pestañas de obradores", queEs: "Si tienes varios obradores, elige de cuál ver las tarifas." },
          {
            nombre: "Aviso",
            queEs:
              "«A coste» y «Coste + %» se recalculan solos al cerrar cada producción del elaborado y con «Recalcular». «Precio fijo» no cambia hasta que lo edites. El precio es el mismo dato que la «Tarifa al centro» de Stock: si se cambia allí a mano, se respeta. Los cambios aún no avisan a los locales, no tienen fecha de entrada en vigor y no se hace la factura entre sociedades al servir (pendiente).",
          },
        ],
      },
      {
        titulo: "Tabla de artículos",
        campos: [
          { nombre: "Artículo", queEs: "Nombre y referencia." },
          { nombre: "Tipo", queEs: "Elaborado (tiene receta activa en este obrador) o Reventa." },
          { nombre: "Coste", queEs: "Coste medio por unidad." },
          { nombre: "Modo", queEs: "Modos de tarifa usados en los locales, o «Sin tarifa»." },
          { nombre: "Locales con precio", queEs: "Cuántos locales tienen precio para este artículo. En amarillo si falta alguno." },
          { nombre: "Precio", queEs: "Precio (o el más bajo y el más alto si varía entre locales)." },
        ],
      },
      {
        titulo: "Qué es este precio",
        campos: [
          {
            nombre: "Tarifa (precio de venta al local)",
            queEs: "Es el precio de las líneas del pedido interno: lo que vale el pedido del local al obrador y la «Venta a locales» del resumen.",
            logica: "El stock que entra en el local NO se valora a esta tarifa: entra al coste medio del producto, que es uno solo en toda la cadena.",
          },
        ],
      },
      {
        titulo: "Detalle del artículo",
        campos: [
          { nombre: "Familia, Unidad, Coste medio", queEs: "Datos del producto." },
          { nombre: "Locales sin precio", queEs: "Locales a los que aún no se ha puesto precio: se les cobrará al coste medio." },
          {
            nombre: "Aplicar a",
            queEs: "Todos los locales, los de una marca o un local.",
            logica: "Cuenta todos los locales abiertos de la cadena.",
          },
          { nombre: "Modo", queEs: "A coste, Coste + % o Precio fijo." },
          { nombre: "% o precio (€)", queEs: "Porcentaje sobre el coste (Coste + %) o precio por unidad (Precio fijo). No hace falta con «A coste»." },
          {
            nombre: "Aplicar tarifa",
            queEs: "Guarda el modo para esos locales y calcula su precio.",
            logica:
              "Coste + % = coste × (1 + % / 100). El precio resultante tiene que ser mayor que 0 (si el artículo aún no tiene coste, usa precio fijo o produce un lote antes).",
            influye:
              "Es la «Tarifa al centro» del producto en cada local (se ve en Stock): el precio de las líneas de los pedidos de ese local y la «Venta a locales» del resumen. El stock que entra en el local se sigue valorando al coste medio.",
          },
          {
            nombre: "Tabla Local · Marca · Modo · Precio · Margen",
            queEs: "Tarifa de cada local. «Cambiado a mano» (amarillo) si el precio del local ya no es el que puso el obrador porque alguien lo cambió en Stock; al recalcular se respeta y la tarifa pasa a «Precio fijo».",
            logica: "Margen = (precio − coste) / precio × 100, es decir, sobre el precio de venta.",
          },
        ],
      },
      {
        titulo: "Añadir un artículo de reventa",
        campos: [
          { nombre: "Artículo", queEs: "Producto de Comidas o Bebidas que aún no está en la lista (vino, seco…)." },
          { nombre: "Aplicar a, Modo, % o precio", queEs: "Igual que en el detalle." },
          { nombre: "Añadir con esta tarifa", queEs: "Pone la tarifa y el artículo pasa a la lista." },
        ],
      },
    ],
    logica: [OBRADORES],
    influye: [
      { texto: "Precio de los pedidos de los locales", ruta: "/comidas/pedidos" },
      { texto: "Tarifa al centro en el detalle del stock", ruta: "/comidas/stock" },
      { texto: "Venta a locales del mes", ruta: "/obrador" },
    ],
  },

  "/obrador/lotes": {
    titulo: "Lotes",
    area: "Obrador",
    paraQue:
      "Cada producción cerrada crea un lote con su caducidad. Aquí se ve qué ingredientes llevaba, a qué locales pudo ir, se imprime la etiqueta y se retira un lote si hay una alerta.",
    quien: "Ver: «Ver lotes y trazabilidad». Retirar: «Retirar un lote (alerta de calidad)». Imprimir: «Imprimir etiquetas de lote».",
    secciones: [
      {
        titulo: "Pestañas y buscador",
        campos: [
          {
            nombre: "Vigentes, Caducados, Retirados, Todos",
            queEs: "Vigentes = no retirados y sin caducar; Caducados = no retirados con la caducidad ya pasada.",
          },
          { nombre: "Buscar por código de lote", queEs: "Filtra por el código (LOTE-…)." },
        ],
      },
      {
        titulo: "Tabla de lotes",
        campos: [
          { nombre: "Lote", queEs: "Código del lote." },
          { nombre: "Producto, Cantidad", queEs: "Elaborado y cantidad producida." },
          { nombre: "Elaborado", queEs: "Día en que se cerró la producción." },
          { nombre: "Caduca", queEs: "Fecha de caducidad = cierre + vida útil de la receta." },
          { nombre: "Estado", queEs: "Vigente, Caducado o Retirado. En amarillo si caduca en un día o menos; en rojo si está retirado." },
        ],
      },
      {
        titulo: "Detalle del lote",
        campos: [
          { nombre: "Orden, Obrador, Elaborado", queEs: "Orden de producción, obrador y fecha y hora de elaboración." },
          { nombre: "Coste por unidad", queEs: "Coste de los ingredientes / cantidad producida." },
          { nombre: "Alérgenos, Conservación", queEs: "Los que tenía el elaborado al cerrar la producción." },
          { nombre: "Retirado", queEs: "Fecha y motivo de la retirada." },
          { nombre: "Ingredientes que llevaba", queEs: "Cantidad de cada ingrediente usado y su coste." },
          {
            nombre: "Posibles destinos",
            queEs: "Pedidos servidos de ese producto desde este obrador entre la elaboración y la caducidad del lote.",
            logica: "Es aproximado: el pedido todavía no guarda qué lote se sirvió.",
          },
          { nombre: "Imprimir etiqueta", queEs: "Abre la etiqueta del lote." },
          {
            nombre: "Motivo de la retirada",
            queEs: "Por qué se retira (obligatorio). Se guarda en el lote y en la merma.",
          },
          {
            nombre: "Dar de baja en el obrador",
            queEs: "Cantidad del lote que queda en el obrador y se tira. Viene propuesta; 0 = no tocar el stock.",
            logica:
              "Propuesta = lo producido en el lote − lo servido a locales mientras estaba vigente, sin pasar del stock que hay en el obrador (el stock no se lleva por lote). No se puede dar de baja más de lo producido ni más de lo que hay.",
          },
          {
            nombre: "Retirar lote",
            queEs: "Marca el lote como retirado y saca del stock del obrador la cantidad indicada.",
            logica: "La baja es una merma (documento MER, motivo «Retirada de lote», al coste medio). Lo que ya se sirvió a los locales lo tiene que dar de baja cada local como merma.",
            influye:
              "Stock y mermas del obrador. Si la cadena tiene Calidad, se crea sola una incidencia de seguridad alimentaria para comprobar la retirada en los locales. El aviso automático a los locales todavía no existe (pendiente).",
          },
        ],
      },
    ],
    logica: [OBRADORES, "Se ven los 300 lotes más recientes."],
    influye: [
      { texto: "Incidencias de calidad", ruta: "/calidad/incidencias" },
      { texto: "Stock del obrador (baja por la retirada)", ruta: "/comidas/stock" },
    ],
  },

  "/obrador/lotes/[id]/etiqueta": {
    titulo: "Etiqueta del lote",
    area: "Obrador",
    paraQue: "Vista de la etiqueta adhesiva del lote (100 × 70 mm) para imprimir y pegar en el envase.",
    quien: "Permiso «Imprimir etiquetas de lote» y acceso al obrador del lote.",
    secciones: [
      {
        titulo: "Botones",
        campos: [
          { nombre: "Volver a lotes", queEs: "Vuelve a la lista de lotes." },
          { nombre: "Imprimir", queEs: "Abre la impresión del navegador; solo se imprime la etiqueta." },
        ],
      },
      {
        titulo: "Etiqueta",
        campos: [
          { nombre: "Nombre del producto, Ref. y cantidad", queEs: "Elaborado, referencia y cantidad del lote." },
          { nombre: "Lote", queEs: "Código del lote." },
          { nombre: "Elaboración", queEs: "Fecha y hora en que se cerró la producción." },
          { nombre: "Consumir antes de", queEs: "Fecha de caducidad." },
          { nombre: "Alérgenos", queEs: "En mayúsculas, o «sin alérgenos declarados». Las trazas no salen en la etiqueta." },
          { nombre: "Conservación", queEs: "La de la receta." },
          { nombre: "Pie", queEs: "Cadena, obrador y su dirección." },
          { nombre: "Aviso de lote retirado", queEs: "Si el lote está retirado, sale en rojo que no se etiquete ni se sirva." },
        ],
      },
    ],
    influye: [{ texto: "Lotes", ruta: "/obrador/lotes" }],
  },
};
