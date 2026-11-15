import type { AyudaArea, CampoAyuda } from "../tipos";

/** Textos que se repiten en varias pantallas de Comidas. */
const CENTROS =
  "Las cifras y listados salen del centro elegido arriba en el selector de centro. Con «Todos mis centros» se suman todos los centros que tienes asignados y que tienen activada el área de Comidas.";

const BUSCADOR_CANTIDADES: CampoAyuda[] = [
  {
    nombre: "Buscar producto, referencia o familia",
    queEs: "Filtra la lista mientras escribes. Lo que ya hayas escrito en los productos que se ocultan no se pierde.",
  },
  {
    nombre: "Solo lo elegido",
    queEs: "Enseña solo los productos a los que ya has puesto una cantidad mayor que 0. Útil para repasar antes de guardar.",
  },
  {
    nombre: "Contador «N producto(s) · importe»",
    queEs: "Cuántos productos llevan cantidad y, si hay precios, el importe total.",
    logica: "Importe = suma de cantidad × precio de cada producto elegido.",
  },
  {
    nombre: "Lista por familias",
    queEs: "Los productos agrupados por familia, con referencia y unidad. Escribe la cantidad en la casilla de la derecha (admite decimales con coma: 1,5).",
  },
];

export const AYUDA_COMIDAS: AyudaArea = {
  // ------------------------------------------------------------------ resumen
  "/comidas": {
    titulo: "Comidas · Resumen",
    area: "Comidas",
    paraQue:
      "Primera pantalla del área de Comidas (alimentación de cocina). De un vistazo: cuánto vale el stock, qué falta, qué pedidos de los locales hay que servir, qué compras están por llegar e inventarios sin cerrar.",
    quien: "Quien tenga el permiso «Ver stock de comida». Los botones de arriba solo salen si además puedes pedir al obrador o pedir a proveedores.",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Subtítulo «Datos de…»",
            queEs: "Dice de qué centro son los datos: el elegido arriba o cuántos centros se están sumando.",
            logica: CENTROS,
          },
          {
            nombre: "Nuevo pedido",
            queEs: "Abre la pantalla para que un local pida comida al obrador o al almacén central.",
            influye: "Pedidos de locales.",
          },
          {
            nombre: "Nueva compra",
            queEs: "Abre la pantalla para preparar un pedido a un proveedor.",
            influye: "Compras.",
          },
          {
            nombre: "Aviso verde o rojo de arriba",
            queEs: "Resultado de la última acción hecha (por ejemplo, una merma guardada) o el motivo por el que no se ha podido hacer.",
          },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Valor del stock",
            queEs: "Lo que vale toda la comida que hay en los centros que estás viendo.",
            logica:
              "Para cada producto: stock × coste medio del producto. El stock es la suma de todos sus movimientos (entradas menos salidas). Al pulsar se abre Stock.",
            influye: "Es la misma cifra que la de la pantalla Stock.",
          },
          {
            nombre: "Referencias",
            queEs: "Cuántos productos distintos aparecen en el stock.",
            logica:
              "En obradores y almacenes salen todos los productos; en un local solo los que tienen stock o un mínimo puesto para ese local. Los desactivados solo si aún tienen stock. Debajo, cuánto hay por unidad, cada una por separado (por ejemplo «1.997 kg · 1.366 unidades · 229 litros»; no se suman kilos con litros): solo totales positivos, las tres unidades con más cantidad.",
          },
          {
            nombre: "Bajo mínimo",
            queEs: "Productos que en algún centro están por debajo de su mínimo (pero no a cero).",
            logica:
              "Mínimo de cada centro: el puesto para ese centro en Stock; si no hay, en obradores y almacenes el «Mínimo general» del producto; en un local sin mínimo propio no se avisa. Un producto cuenta si en el peor de sus centros está bajo mínimo. Al pulsar se abre Stock filtrado.",
          },
          {
            nombre: "Sin stock",
            queEs: "Productos que en algún centro tienen stock 0 o negativo.",
            logica: "Al pulsar se abre Stock con el filtro «Sin stock».",
          },
          {
            nombre: "Pedidos por servir",
            queEs: "Pedidos de los locales pendientes de servir por el obrador o almacén de los centros que ves.",
            logica: "Pedidos de Comidas en estado «Por servir» cuyo centro que sirve está entre los que ves.",
          },
          {
            nombre: "Pedidos por confirmar",
            queEs: "Pedidos ya servidos a los que les falta que el local confirme lo recibido.",
            logica: "Pedidos en estado «Servido · por confirmar» cuyo local que pide está entre los que ves.",
          },
          {
            nombre: "Compras por recibir",
            queEs: "Compras a proveedores enviadas que aún no han llegado del todo.",
            logica: "Compras en estado «Enviada · por recibir» o «Recibida en parte» de los centros que ves. Al pulsar se abre Compras con el filtro «Por recibir», que enseña esas mismas.",
          },
          {
            nombre: "Inventarios abiertos",
            queEs: "Inventarios que se están contando o que esperan aprobación.",
            logica:
              "Suma de los inventarios «Contando» y «Pendiente de aprobación» (los cancelados no cuentan). El detalle dice cuántos se están contando y cuántos esperan aprobación, o «ninguno sin cerrar».",
          },
        ],
      },
      {
        titulo: "Pedidos de locales por servir",
        campos: [
          { nombre: "Pedido", queEs: "Número del pedido (serie PL). Al pulsarlo se abre el pedido para servirlo." },
          { nombre: "Local", queEs: "Local que ha hecho el pedido." },
          { nombre: "Líneas", queEs: "Cuántos productos distintos lleva." },
          { nombre: "Hecho", queEs: "Fecha y hora en que el local hizo el pedido. Salen primero los más antiguos." },
          { nombre: "Estado", queEs: "Siempre «Por servir» en esta tabla." },
          { nombre: "Ver todos", queEs: "Abre la lista completa de pedidos de locales." },
        ],
      },
      {
        titulo: "Valor por familia",
        campos: [
          { nombre: "Familia", queEs: "Familia de productos (carnes, pescados, seco…). «Sin familia» junta los que no tienen." },
          { nombre: "Referencias", queEs: "Cuántos productos de esa familia hay en el stock." },
          { nombre: "Valor", queEs: "Valor del stock de esa familia.", logica: "Suma de stock × coste medio de sus productos. Ordenado de mayor a menor." },
        ],
      },
      {
        titulo: "Avisos de stock",
        campos: [
          { nombre: "Producto", queEs: "Producto bajo mínimo o sin stock. Primero los que están sin stock." },
          { nombre: "Stock", queEs: "Lo que hay ahora, con su unidad, sumando los centros que ves." },
          { nombre: "Mínimo", queEs: "Suma de los mínimos de los centros que ves. «—» si no hay ninguno." },
          { nombre: "Proveedor", queEs: "Proveedor habitual del producto." },
          { nombre: "Estado", queEs: "«Sin stock» (rojo) o «Bajo mínimo» (amarillo)." },
          {
            nombre: "Ver en Stock",
            queEs: "Abre Stock con el filtro «Con aviso».",
            logica: "Aquí solo salen los 15 primeros avisos; el total se indica debajo de la tabla.",
          },
        ],
      },
      {
        titulo: "Hueco «Carta al TPV»",
        campos: [
          {
            nombre: "Carta al TPV",
            queEs: "Conexión todavía pendiente: enviará los platos, precios y alérgenos de la carta al programa de caja de cada local. Por ahora no hace nada.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Detalle del stock y avisos", ruta: "/comidas/stock" },
      { texto: "Pedidos de los locales", ruta: "/comidas/pedidos" },
      { texto: "Compras a proveedores", ruta: "/comidas/compras" },
      { texto: "Inventarios", ruta: "/comidas/inventarios" },
    ],
    comoSeUsa: [
      "Elige arriba el centro (por ejemplo, el obrador) para ver solo sus datos.",
      "Pulsa cualquier cifra para ir a la lista que la explica.",
      "Empieza el día sirviendo los pedidos de la tabla «Pedidos de locales por servir».",
    ],
  },

  // ------------------------------------------------------------------ stock
  "/comidas/stock": {
    titulo: "Stock de comidas",
    area: "Comidas",
    paraQue:
      "Cuánta comida hay de cada producto, cuánto vale, dónde está (centro y almacén: cámara, congelador, seco…) y si está por debajo del mínimo. Desde el detalle de cada fila se ponen mínimos, máximos y tarifas por centro y se registran mermas.",
    quien:
      "Ver: permiso «Ver stock de comida». Cambiar mínimos, tarifas y almacén: «Crear y editar productos de comida». Dar de baja una merma: «Registrar mermas de comida».",
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Valor",
            queEs: "Valor de todo lo que sale en la tabla con los filtros puestos.",
            logica: "Suma de stock × coste medio de cada producto. Con filtro de almacén, solo lo de ese almacén.",
          },
          {
            nombre: "Referencias",
            queEs: "Productos de la tabla. Debajo, cuánto hay por unidad (kg, unidades, litros…, cada una por separado; solo totales positivos).",
          },
          { nombre: "Bajo mínimo", queEs: "Productos que en algún centro están por debajo del mínimo sin llegar a cero." },
          { nombre: "Sin stock", queEs: "Productos que en algún centro tienen 0 o menos." },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar", queEs: "Busca por nombre, referencia o código de barras del producto." },
          { nombre: "Familia", queEs: "Solo los productos de una familia." },
          {
            nombre: "Almacén",
            queEs: "Solo lo que hay en los almacenes con ese nombre (por ejemplo «Cámara» junta las cámaras de todos los centros elegidos) o lo que está «Sin ubicar».",
            logica:
              "Con este filtro la columna de stock y el valor son los de ese almacén, y salen los productos que tienen stock allí o que tienen ese almacén como su sitio. El estado se sigue mirando con el total del centro. Solo sale si tus centros tienen almacenes.",
          },
          {
            nombre: "Estado",
            queEs: "«Con aviso» (bajo mínimo o sin stock), «Bajo mínimo», «Sin stock» o «Correcto».",
          },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla de stock",
        campos: [
          { nombre: "Producto", queEs: "Nombre y, debajo, la referencia. «desactivado» si el producto está dado de baja pero aún le queda stock." },
          { nombre: "Familia", queEs: "Familia del producto." },
          { nombre: "Proveedor", queEs: "Proveedor habitual del producto." },
          {
            nombre: "Stock (o «En …» con filtro de almacén)",
            queEs: "Cantidad que hay, con su unidad.",
            logica:
              "Suma de todos los movimientos del producto en los centros que ves: compras recibidas, pedidos servidos y recibidos, producción, ventas de caja, mermas, ajustes de inventario y traspasos. Nunca se escribe a mano. Con filtro de almacén, debajo sale lo que hay en todo el centro.",
          },
          {
            nombre: "Mínimo",
            queEs: "Suma de los mínimos de los centros que ves; «—» si no hay ninguno.",
            logica: "Mínimo de cada centro: el puesto en el detalle de la fila; si no hay, en obradores y almacenes el «Mínimo general» del producto; en locales, ninguno.",
          },
          {
            nombre: "Estado",
            queEs: "«Sin stock», «Bajo mínimo» o «Correcto».",
            logica: "Se calcula centro por centro y se enseña el peor. Sin stock = 0 o menos. Bajo mínimo = por debajo del mínimo de ese centro.",
          },
          { nombre: "Valor", queEs: "Stock × coste medio del producto." },
          { nombre: "Total de la tabla", queEs: "Número de productos y su valor." },
        ],
      },
      {
        titulo: "Detalle de la fila (al abrirla)",
        campos: [
          { nombre: "Referencia, Familia, Proveedor, Unidad", queEs: "Datos del producto (se cambian en Productos)." },
          {
            nombre: "Coste medio",
            queEs: "Precio medio al que está valorado el producto, o «Sin coste».",
            logica: "Se recalcula solo al recibir compras (media ponderada) y, si es un elaborado, al cerrar producción en el obrador.",
          },
          { nombre: "Mínimo general", queEs: "El mínimo del producto que se aplica en obrador y almacenes sin mínimo propio." },
          { nombre: "Código de barras", queEs: "El del producto, si lo tiene." },
          { nombre: "Ver movimientos", queEs: "Abre Movimientos con solo los de este producto: cada entrada y salida con fecha, documento y usuario." },
          { nombre: "Tabla por centro: Centro, Stock, Estado", queEs: "Lo que hay en cada centro y su estado con el mínimo de ese centro." },
          {
            nombre: "Por almacén",
            queEs: "Reparto del stock del centro por almacenes. «· su sitio» marca el almacén por defecto del producto en ese centro. «Sin ubicar» es stock antiguo sin almacén.",
          },
          {
            nombre: "Mínimo · máximo",
            queEs: "Mínimo y máximo de ese producto en ese centro. Vacío = sin mínimo propio (en un local, sin control de mínimo).",
            logica: "El máximo no puede ser menor que el mínimo.",
            influye:
              "El mínimo decide los avisos de stock y la propuesta «Rellenar con lo que está bajo mínimo» de las compras. El máximo es hasta dónde se propone comprar o traspasar.",
          },
          {
            nombre: "Tarifa al centro (€ tarifa)",
            queEs: "Precio al que el obrador o almacén sirve este producto a ese centro. Vacío = se usa el coste medio.",
            influye:
              "Es el precio de las líneas de los pedidos de ese local y lo que suma la «Venta a locales» del Obrador. Ojo: si el producto tiene una tarifa «A coste» o «Coste + %» en Obrador → Tarifas, se vuelve a calcular sola y pisa lo que pongas aquí.",
          },
          {
            nombre: "pedible",
            queEs: "Si está marcado, ese centro puede pedir el producto al obrador. Desmarcado, no le sale al hacer pedidos.",
          },
          {
            nombre: "Su sitio",
            queEs: "Almacén donde entra el producto en ese centro (compras, pedidos, producción) y del que sale primero.",
            logica:
              "«Por familia» lo decide solo: congelados y helados al Congelador, seco y despensa al Seco, el resto (carnes, pescados, verduras, lácteos…) a la Cámara. Si el centro no tiene ese almacén, el primero que encaje.",
          },
          { nombre: "Guardar", queEs: "Guarda los ajustes del producto en ese centro. Queda anotado quién y cuándo." },
        ],
      },
      {
        titulo: "Registrar rotura o merma (dentro del detalle)",
        campos: [
          {
            nombre: "De dónde",
            queEs: "Centro y almacén del que se da de baja, con lo que hay en cada uno. Solo salen los sitios con stock de tus centros.",
          },
          { nombre: "Cantidad", queEs: "Cuánto se tira o se pierde, en la unidad del producto. Tiene que ser mayor que 0 y no más de lo que hay allí." },
          { nombre: "Motivo", queEs: "Obligatorio: rotura, caducidad, desperdicio, invitación, consumo de personal, error de cocina o barra, u otro." },
          { nombre: "Nota", queEs: "Explicación opcional; se guarda junto al motivo." },
          {
            nombre: "Dar de baja",
            queEs: "Resta el stock con un movimiento «Merma» y un documento MER-….",
            logica: "Se valora al coste medio del producto. No se puede deshacer desde aquí: si te equivocas, se corrige con un inventario.",
            influye: "Baja el stock y su valor; aparece en Movimientos con el motivo.",
          },
        ],
      },
    ],
    logica: [
      "El stock es siempre la suma de los movimientos: nadie lo escribe a mano.",
      CENTROS,
    ],
    influye: [
      { texto: "Historial de cada producto", ruta: "/comidas/movimientos" },
      { texto: "Propuesta de compra con lo que está bajo mínimo", ruta: "/comidas/compras/nueva" },
      { texto: "Tarifas del obrador a los locales", ruta: "/obrador/tarifas" },
    ],
    comoSeUsa: [
      "Filtra por «Con aviso» para ver qué hay que comprar o pedir.",
      "Abre una fila para ver en qué centro y almacén está cada cosa.",
      "Para un mínimo en un local que no aparece, elige ese local arriba en el selector de centro.",
    ],
  },

  // ------------------------------------------------------------------ pedidos
  "/comidas/pedidos": {
    titulo: "Pedidos de comidas",
    area: "Comidas",
    paraQue:
      "Lista de lo que piden los locales al obrador o al almacén central. Cada pedido pasa por: por servir → servido (el obrador lo manda) → recibido (el local confirma). Mientras no se sirve, el local puede cambiarlo o cancelarlo.",
    quien: "Permiso «Ver pedidos de comida». El botón «Nuevo pedido» necesita «Pedir comida al obrador».",
    secciones: [
      {
        titulo: "Filtro",
        campos: [
          {
            nombre: "Estado",
            queEs: "Todos, Por servir, Servidos por confirmar, Recibidos, Rechazados o Cancelados.",
          },
          { nombre: "Filtrar", queEs: "Aplica el filtro." },
        ],
      },
      {
        titulo: "Tabla de pedidos",
        campos: [
          { nombre: "Pedido", queEs: "Número (serie PL). Al pulsarlo se abre el pedido." },
          { nombre: "Pide", queEs: "Local que hace el pedido." },
          { nombre: "Sirve", queEs: "Obrador o almacén central que lo sirve." },
          { nombre: "Líneas", queEs: "Productos distintos del pedido." },
          {
            nombre: "Importe",
            queEs: "Lo que vale el pedido a precio de tarifa.",
            logica:
              "Si aún no se ha servido: cantidad pedida × precio. Servido: cantidad servida × precio. Recibido: lo servido más lo que llegó de más (lo que faltó sigue contando: salió del obrador). Precio = tarifa del obrador para ese local o, si no tiene, el coste medio.",
          },
          { nombre: "Fecha", queEs: "Día en que se hizo." },
          { nombre: "Estado", queEs: "Por servir, Servido · por confirmar, Recibido, Rechazado o Cancelado. Los pendientes de servir se marcan en amarillo." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Hecho, Servido", queEs: "Fecha y hora en que se hizo y en que se sirvió." },
          { nombre: "Albarán", queEs: "Albarán de salida (serie ALB-S) que se crea al servir." },
          { nombre: "Notas", queEs: "Notas del local, motivo de rechazo y notas de la recepción." },
          {
            nombre: "Tabla Producto · Pedido · Servido · Recibido · Precio",
            queEs: "Lo que se pidió, lo que mandó el obrador, lo que confirmó el local y el precio de cada línea.",
          },
          { nombre: "Abrir…", queEs: "Abre el pedido para servirlo, cambiarlo o confirmarlo." },
        ],
      },
    ],
    logica: [
      "Salen los pedidos en los que el centro que pide o el que sirve está entre los centros que ves (el elegido arriba o todos los tuyos). Se ven los 200 más recientes.",
    ],
    influye: [
      { texto: "Hacer un pedido nuevo", ruta: "/comidas/pedidos/nuevo" },
      { texto: "Venta del obrador a los locales", ruta: "/obrador" },
    ],
  },

  "/comidas/pedidos/nuevo": {
    titulo: "Nuevo pedido al obrador",
    area: "Comidas",
    paraQue: "Para que un local pida comida al obrador o al almacén central. Se escriben solo las cantidades de lo que se necesita.",
    quien: "Permiso «Pedir comida al obrador» y acceso al local que pide.",
    secciones: [
      {
        titulo: "Paso 1: local que pide",
        campos: [
          {
            nombre: "Local que pide",
            queEs: "Si tienes varios locales, elige para cuál es el pedido. Con un solo local se salta este paso.",
            logica:
              "Solo salen tus centros con Comidas activa que no son obrador ni almacén. Si arriba tienes elegido un obrador, no podrás pedir: elige un local.",
          },
          { nombre: "Seguir", queEs: "Pasa a la lista de productos." },
        ],
      },
      {
        titulo: "Centro que sirve",
        campos: [
          {
            nombre: "Pedir a …",
            queEs: "Si la cadena tiene varios obradores o almacenes, elige a cuál se pide y pulsa «Cambiar».",
            logica: "Salen los obradores y almacenes centrales abiertos (ni cerrados ni en preparación) que tienen activada el área de Comidas.",
          },
        ],
      },
      {
        titulo: "Lista de productos",
        campos: [
          ...BUSCADOR_CANTIDADES,
          {
            nombre: "hay N / sin existencias",
            queEs: "Lo que tiene ahora el centro que sirve.",
            logica: "Si pides más de lo que hay, sale el aviso «se servirá lo disponible»: al servir, cada línea se recorta al stock.",
          },
          {
            nombre: "Precio (junto a la referencia)",
            queEs: "Precio al que el obrador cobra ese producto a este local.",
            logica: "Tarifa del obrador para este local o, si no tiene, el coste medio del producto.",
          },
          {
            nombre: "Productos que salen",
            queEs: "Los productos activos de Comidas, menos los que están marcados como no «pedible» para este local en Stock.",
          },
        ],
      },
      {
        titulo: "Final",
        campos: [
          { nombre: "Notas para el obrador", queEs: "Opcional: hora de reparto, observaciones…" },
          {
            nombre: "Enviar pedido",
            queEs: "Crea el pedido (número PL-…) en estado «Por servir» y abre su ficha.",
            logica: "Tiene que llevar al menos una cantidad. Si repites un producto, se suman. No mueve stock todavía: el stock se mueve al servir.",
            influye: "Aparece en «Pedidos por servir» del resumen de Comidas y del Obrador.",
          },
        ],
      },
    ],
    influye: [{ texto: "Lista de pedidos", ruta: "/comidas/pedidos" }],
  },

  "/comidas/pedidos/[id]": {
    titulo: "Pedido de un local",
    area: "Comidas",
    paraQue:
      "Ficha de un pedido. Según el estado y tus permisos, aquí el obrador lo sirve o lo rechaza, el local lo cambia o lo cancela mientras no está servido, y el local confirma lo que le ha llegado.",
    quien:
      "Ver: «Ver pedidos de comida» y acceso al local o al obrador. Servir y rechazar: «Servir pedidos de comida» y acceso al centro que sirve. Cambiar y cancelar: «Pedir comida al obrador» y acceso al local. Confirmar: «Confirmar la recepción de pedidos de comida en el local» y acceso al local.",
    secciones: [
      {
        titulo: "Datos del pedido",
        campos: [
          { nombre: "Estado", queEs: "Por servir, Servido · por confirmar, Recibido, Rechazado o Cancelado." },
          { nombre: "Importe", queEs: "Cantidad pedida (o servida, si ya se sirvió; ya recibido, lo servido más lo que llegó de más) × precio de tarifa de cada línea." },
          { nombre: "Albarán de salida", queEs: "Número ALB-S que se crea al servir." },
          {
            nombre: "Factura entre sociedades",
            queEs: "Solo con Contabilidad contratada: en qué factura del obrador va el pedido (y su espejo en el local), «Pendiente de facturar» si ya está recibido y aún no se ha facturado, «Se factura cuando el local confirme la recepción», o «Sin factura» si el obrador y el local son de la misma sociedad (traspaso interno).",
            logica: "Las facturas se preparan en Contabilidad → Facturas emitidas → Facturar pedidos del obrador: una por local y mes con los pedidos recibidos.",
          },
          { nombre: "Servido", queEs: "Cuándo se sirvió." },
          { nombre: "Notas", queEs: "Notas del local, el motivo si se rechazó y la nota de la recepción." },
        ],
      },
      {
        titulo: "Servir (lo ve el obrador mientras está por servir)",
        campos: [
          { nombre: "Pedido", queEs: "Lo que pidió el local." },
          { nombre: "Hay", queEs: "Stock del producto en todo el centro que sirve. En naranja si no llega a lo pedido." },
          {
            nombre: "Servir",
            queEs: "Cantidad que se manda. Viene propuesta con lo pedido, recortado a lo que hay.",
            logica: "Al servir, cada cantidad se vuelve a recortar sola al stock disponible (del almacén elegido o de todo el centro).",
          },
          {
            nombre: "Sale de",
            queEs: "Almacén del obrador del que sale todo. «Cada producto de su almacén» deja que salga de su sitio y, si no hay bastante, de los demás.",
          },
          {
            nombre: "Servir y hacer albarán",
            queEs: "Manda el pedido.",
            logica:
              "Crea el albarán ALB-S, resta el stock del obrador (movimiento «Salida a local») y lo suma en el local en el almacén de cada producto (movimiento «Entrada de pedido»), los dos valorados al coste medio del producto, que es uno solo para toda la cadena. El precio de cada línea se fija con la tarifa de ese momento: es la venta del obrador al local (importe del pedido), no el coste del producto en el local. Si no se puede servir nada, da error: entonces hay que rechazarlo. No se puede deshacer.",
            influye:
              "Stock del obrador y del local; «Venta a locales» del Obrador; en el cuadro de mando, la mercancía del local sube y la del obrador baja (a coste).",
          },
          { nombre: "Motivo del rechazo", queEs: "Obligatorio para rechazar; lo verá el local en las notas." },
          { nombre: "Rechazar pedido", queEs: "Deja el pedido en «Rechazado» sin mover stock." },
        ],
      },
      {
        titulo: "Confirmar lo recibido (lo ve el local cuando está servido)",
        campos: [
          { nombre: "Pedido, Servido", queEs: "Lo que se pidió y lo que mandó el obrador." },
          {
            nombre: "Recibido",
            queEs: "Lo que ha llegado de verdad. Viene con lo servido.",
            logica:
              "Si llega MENOS de lo servido, lo que falta se da de baja en el local como merma (movimiento «Merma» con el motivo «Falta al recibir…»): salió del obrador y no ha llegado, así la pérdida se ve en las mermas. Si llega MÁS, la diferencia sale también del obrador («Salida a local») y entra en el local («Entrada de pedido»). Todo al coste medio.",
          },
          { nombre: "Nota sobre la recepción", queEs: "Por ejemplo «2 bandejas rotas». Se guarda en las notas del pedido y en el motivo de la merma o de la sobra." },
          { nombre: "Confirmar recepción", queEs: "Deja el pedido en «Recibido». No se puede deshacer." },
        ],
      },
      {
        titulo: "Cambiar el pedido (lo ve el local mientras está por servir)",
        campos: [
          ...BUSCADOR_CANTIDADES,
          { nombre: "Notas", queEs: "Notas para el obrador." },
          { nombre: "Guardar cambios", queEs: "Sustituye todas las líneas por las de la lista y recalcula los precios con la tarifa actual." },
          { nombre: "Cancelar el pedido", queEs: "Lo deja en «Cancelado». Solo mientras no se ha servido. No mueve stock." },
        ],
      },
      {
        titulo: "Líneas (cuando no hay nada que hacer)",
        campos: [
          { nombre: "Producto, Pedido, Servido, Recibido, Precio", queEs: "Lo que se pidió, mandó y recibió de cada producto y su precio." },
        ],
      },
    ],
    influye: [
      { texto: "Stock de los dos centros", ruta: "/comidas/stock" },
      { texto: "Movimientos del pedido", ruta: "/comidas/movimientos" },
      { texto: "Venta del obrador a los locales", ruta: "/obrador" },
      { texto: "Mercancía en el cuadro de mando", ruta: "/cuadro" },
    ],
  },

  // ------------------------------------------------------------------ compras
  "/comidas/compras": {
    titulo: "Compras de comidas",
    area: "Comidas",
    paraQue: "Pedidos a los proveedores de comida. Pasan de «Sin enviar» a «Enviada · por recibir» y a «Recibida». Solo suman stock cuando se recibe la mercancía.",
    quien: "Permiso «Ver compras de comida». «Nueva compra» necesita «Pedir a proveedores de comida».",
    secciones: [
      {
        titulo: "Filtro",
        campos: [
          { nombre: "Estado", queEs: "Todas, Por recibir (enviadas y recibidas en parte), Sin enviar, Enviadas por recibir, Recibidas en parte, Recibidas o Canceladas." },
          { nombre: "Filtrar", queEs: "Aplica el filtro." },
        ],
      },
      {
        titulo: "Tabla de compras",
        campos: [
          { nombre: "Compra", queEs: "Número (serie PC). Al pulsarlo se abre la compra." },
          { nombre: "Proveedor", queEs: "A quién se compra." },
          { nombre: "Recibe", queEs: "Centro donde se recibe la mercancía." },
          { nombre: "Líneas", queEs: "Productos distintos." },
          {
            nombre: "Importe",
            queEs: "Valor de la compra.",
            logica:
              "Sin recibir: cantidad pedida × precio de cada línea. Recibida (en parte o del todo): cantidad RECIBIDA × precio, donde el precio de la línea es el medio de lo recibido (si llegó en dos entregas a precios distintos, la media).",
          },
          { nombre: "Fecha", queEs: "Día en que se preparó." },
          { nombre: "Estado", queEs: "Sin enviar, Enviada · por recibir, Recibida en parte, Recibida o Cancelada." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Enviada", queEs: "Cuándo se marcó como enviada y por dónde (WhatsApp, correo o teléfono)." },
          { nombre: "Recibida", queEs: "Cuándo fue la última recepción." },
          { nombre: "Albaranes de entrada", queEs: "Números ALB-E de cada recepción (puede haber varios si llegó en partes)." },
          { nombre: "Notas", queEs: "Notas de la compra y números de albarán del proveedor." },
          { nombre: "Tabla Producto · Pedido · Recibido · Precio", queEs: "Cantidades pedidas y recibidas, y precio por unidad." },
          { nombre: "Abrir…", queEs: "Abre la compra para enviarla, recibirla o verla." },
        ],
      },
    ],
    logica: [
      "Salen las compras de los centros que ves (el elegido arriba o todos los tuyos con Comidas). Se ven las 200 más recientes.",
      "Se puede cancelar mientras no se ha recibido nada; una recibida en parte se cierra sin lo que falta desde su ficha.",
    ],
    influye: [
      { texto: "Nueva compra", ruta: "/comidas/compras/nueva" },
      { texto: "Proveedores", ruta: "/proveedores" },
    ],
  },

  "/comidas/compras/nueva": {
    titulo: "Nueva compra a proveedor",
    area: "Comidas",
    paraQue: "Preparar un pedido a un proveedor de comida: se elige proveedor y centro que recibe, y se escriben cantidades y precios.",
    quien: "Permiso «Pedir a proveedores de comida».",
    secciones: [
      {
        titulo: "Paso 1: a quién y dónde",
        campos: [
          { nombre: "Proveedor", queEs: "Proveedores de comida dados de alta en Proveedores. Si no hay ninguno, sale un enlace para crearlo." },
          {
            nombre: "Centro que recibe",
            queEs: "Dónde llegará la mercancía. Viene propuesto el obrador o almacén. Con un solo centro, se elige solo.",
          },
          { nombre: "Seguir", queEs: "Pasa a la lista de productos." },
        ],
      },
      {
        titulo: "Botones de arriba",
        campos: [
          {
            nombre: "Ver todos los productos del área / Ver solo los productos de este proveedor",
            queEs: "Por defecto salen solo los productos que tienen a este proveedor como habitual. Con este botón ves todo el catálogo de Comidas.",
          },
          {
            nombre: "Rellenar con lo que está bajo mínimo",
            queEs: "Pone sola la cantidad de los productos que en el centro que recibe están por debajo del mínimo.",
            logica:
              "Mínimo del centro (o, en obrador y almacén, el mínimo general). Cantidad propuesta = máximo del centro − stock actual (o mínimo − stock si no hay máximo), redondeada hacia arriba a formatos de compra completos («Unidades por formato de compra»: con sacos de 25 kg, si faltan 30 se proponen 50). Si no hay nada bajo mínimo, sale un aviso.",
          },
          { nombre: "Cambiar proveedor", queEs: "Vuelve al paso 1." },
        ],
      },
      {
        titulo: "Lista de productos",
        campos: [
          ...BUSCADOR_CANTIDADES,
          {
            nombre: "€/ud",
            queEs: "Precio por unidad de stock. Viene el coste medio actual; cámbialo si el proveedor tiene otro precio.",
            logica: "No puede ser negativo. El precio definitivo es el que se escriba al recibir.",
          },
        ],
      },
      {
        titulo: "Final",
        campos: [
          { nombre: "Notas para el proveedor", queEs: "Opcional. Salen en el mensaje de WhatsApp (por ejemplo, «entregar antes de las 11:00»)." },
          {
            nombre: "Preparar compra",
            queEs: "Crea la compra (número PC-…) en «Sin enviar» y abre su ficha para enviarla.",
            logica: "Tiene que llevar al menos una cantidad. El proveedor tiene que estar activo. No mueve stock.",
          },
        ],
      },
    ],
    influye: [{ texto: "Ficha de la compra para enviar y recibir", ruta: "/comidas/compras" }],
  },

  "/comidas/compras/[id]": {
    titulo: "Compra a proveedor",
    area: "Comidas",
    paraQue: "Ficha de una compra: se envía al proveedor (WhatsApp, correo o teléfono), se cambia mientras no ha llegado y se recibe la mercancía, que es lo que suma stock y recalcula el coste.",
    quien:
      "Ver: «Ver compras de comida» y acceso al centro que recibe. Enviar, cambiar y cancelar: «Pedir a proveedores de comida». Recibir: «Recepcionar compras de comida».",
    secciones: [
      {
        titulo: "Datos",
        campos: [
          { nombre: "Estado", queEs: "Sin enviar, Enviada · por recibir, Recibida en parte, Recibida o Cancelada." },
          {
            nombre: "Importe / Importe recibido e Importe pedido",
            queEs: "Sin recibir: lo pedido × precio. Ya recibida (en parte o del todo): «Importe recibido» = lo recibido × precio medio de lo recibido, e «Importe pedido» = lo pedido × ese precio.",
          },
          { nombre: "Enviada", queEs: "Cuándo y por dónde se envió." },
          { nombre: "Albaranes de entrada", queEs: "Números ALB-E de cada recepción." },
          { nombre: "Factura del proveedor", queEs: "Solo con Contabilidad contratada y la compra recibida: en qué factura recibida está este albarán, o «Sin facturar todavía». Un albarán solo puede estar en una factura." },
          { nombre: "Contacto, Correo, Días de reparto", queEs: "Datos del proveedor (se cambian en Proveedores)." },
          {
            nombre: "Pedido mínimo",
            queEs: "Importe mínimo que pide el proveedor. Si la compra (aún sin recibir) no llega, sale un aviso (no impide enviarla).",
          },
        ],
      },
      {
        titulo: "Enviar al proveedor (mientras no se ha recibido nada)",
        campos: [
          {
            nombre: "Texto del pedido",
            queEs: "Mensaje ya escrito con saludo al contacto, número de compra, centro, líneas y notas.",
            logica: "Si el producto tiene «Unidades por formato de compra» mayor que 1, al lado de la cantidad sale en formatos: 60 kg en sacos de 25 → «(2 × 25 + 10)».",
          },
          {
            nombre: "Abrir WhatsApp con el pedido",
            queEs: "Abre WhatsApp con el mensaje escrito para el teléfono del proveedor. Tú lo envías desde WhatsApp.",
            logica: "Solo sale si el teléfono del proveedor está en formato +34…; si no, sale un aviso para corregirlo en Proveedores.",
          },
          { nombre: "Enviado por", queEs: "Cómo se ha hecho llegar: WhatsApp, correo o teléfono." },
          {
            nombre: "Marcar como enviada / Cambiar cómo se envió",
            queEs: "Pasa la compra a «Enviada · por recibir» y apunta la fecha y la vía. No envía nada por sí mismo.",
          },
        ],
      },
      {
        titulo: "Recibir mercancía",
        campos: [
          { nombre: "Pedido", queEs: "Cantidad pedida de cada producto (y en formatos de compra si el producto los tiene, por ejemplo «(2 × 25)»)." },
          { nombre: "Ya recibido", queEs: "Lo que llegó en recepciones anteriores." },
          { nombre: "Llega ahora", queEs: "Lo que ha llegado en esta entrega. Viene propuesto lo que falta." },
          { nombre: "€/ud", queEs: "Precio por unidad del albarán. Cámbialo si no es el previsto." },
          { nombre: "Número del albarán del proveedor", queEs: "Opcional. Se guarda en las notas y en el motivo del movimiento." },
          { nombre: "Entra en", queEs: "Almacén del centro donde entra todo. «Cada producto en su almacén» lo coloca en el sitio de cada producto." },
          {
            nombre: "Cerrar la compra aunque falte algo",
            queEs: "Márcalo si lo que falta ya no va a llegar: la compra queda «Recibida». Si no, queda «Recibida en parte» y se puede volver a recibir.",
            logica: "En una compra «Recibida en parte» sirve también sin que llegue nada en esta entrega (deja todo a 0 y marca la casilla).",
          },
          {
            nombre: "Guardar recepción",
            queEs: "Suma el stock y recalcula el coste del producto.",
            logica:
              "Crea un albarán de entrada ALB-E y un movimiento «Entrada de compra» por producto, valorado al precio escrito. Coste medio nuevo = (stock de toda la cadena × coste actual + recibido × precio) / (stock + recibido); si el stock era 0 o negativo, o el producto no tenía coste, el coste nuevo es el precio de esta compra. Si el coste cambia, se recalculan solas las tarifas del obrador «A coste» y «Coste + %» de ese producto. Solo cambia el precio de las líneas que reciben algo: su €/ud pasa a ser el precio medio de todo lo recibido de esa línea. Tiene que llegar algo (salvo para cerrar una compra recibida en parte). No se puede deshacer: un error se corrige con un inventario o una merma.",
            influye:
              "Stock y valor del stock; coste de los escandallos de la carta y de las recetas del obrador; tarifas del obrador a los locales que van a coste; mercancía del centro en el cuadro de mando (compras recibidas).",
          },
        ],
      },
      {
        titulo: "Cerrar la compra sin lo que falta (recibida en parte)",
        campos: [
          { nombre: "Motivo", queEs: "Opcional: por qué no va a llegar lo que falta. Se guarda en las notas de la compra." },
          {
            nombre: "Cerrar la compra sin lo que falta",
            queEs: "Deja la compra «Recibida» con lo que ya llegó. No mueve stock ni cambia costes.",
            logica: "Una compra recibida en parte no se puede cancelar (ya entró mercancía): se cierra así.",
          },
        ],
      },
      {
        titulo: "Líneas (si no puedes recibir)",
        campos: [{ nombre: "Producto, Pedido, Recibido, €/ud, Importe", queEs: "Detalle de cada línea. Importe = recibido × precio si la compra está recibida (en parte o del todo); si no, pedido × precio." }],
      },
      {
        titulo: "Cambiar la compra (sin enviar o enviada, antes de recibir)",
        campos: [
          ...BUSCADOR_CANTIDADES,
          { nombre: "€/ud", queEs: "Precio de cada línea." },
          { nombre: "Notas", queEs: "Notas para el proveedor." },
          { nombre: "Guardar cambios", queEs: "Sustituye las líneas por las de la lista. Salen los productos de este proveedor y los que ya estaban en la compra." },
          { nombre: "Cancelar la compra", queEs: "La deja «Cancelada». Solo si no se ha recibido nada. No mueve stock." },
        ],
      },
    ],
    influye: [
      { texto: "Stock", ruta: "/comidas/stock" },
      { texto: "Coste de los platos", ruta: "/comidas/carta" },
      { texto: "Coste de las recetas del obrador", ruta: "/obrador/recetas" },
      { texto: "Mercancía en el cuadro de mando", ruta: "/cuadro" },
    ],
  },

  // ------------------------------------------------------------------ inventarios
  "/comidas/inventarios": {
    titulo: "Inventarios de comidas",
    area: "Comidas",
    paraQue:
      "Contar lo que hay de verdad y ajustar el stock a lo contado. Se puede contar todo un centro o un solo almacén (por ejemplo, solo la Cámara). Si el descuadre pasa de 500 €, el cierre necesita aprobación.",
    quien: "Ver: «Ver inventarios de comida». Empezar y contar: «Hacer inventarios de comida». Aprobar los de más de 500 €: «Cerrar inventarios de comida».",
    secciones: [
      {
        titulo: "Empezar inventario",
        campos: [
          {
            nombre: "Qué se cuenta",
            queEs: "El centro entero («todos los almacenes») o un solo almacén de un centro.",
            logica:
              "Al empezar se guarda el stock teórico de ese momento y el coste de cada producto. En un local se cuentan los productos con stock o con mínimo propio; en obrador y almacén, todos los activos. De un almacén: los que tienen stock allí o lo tienen como su sitio. No puede haber dos inventarios sin cerrar del mismo almacén, ni uno del centro a la vez que uno de un almacén: si uno se quedó a medias, se cancela desde su ficha.",
          },
          { nombre: "Nombre", queEs: "Viene «Semana N · año» (semana de hoy en Madrid). Si es de un almacén, se le pone delante el nombre del almacén." },
          { nombre: "Empezar a contar", queEs: "Crea el inventario (número INV-…) y abre la pantalla de recuento." },
        ],
      },
      {
        titulo: "Tabla de inventarios",
        campos: [
          { nombre: "Inventario", queEs: "Nombre. Al pulsarlo se abre." },
          { nombre: "Centro · almacén", queEs: "Dónde se cuenta; «todo» si es el centro entero." },
          { nombre: "Contadas", queEs: "Líneas contadas de las que tiene el inventario." },
          {
            nombre: "Diferencia",
            queEs: "Valor de lo que sobra (verde) o falta (rojo). Mientras se cuenta pone «a ciegas»; en uno cancelado, «—».",
            logica: "Suma de (contado − teórico) × coste de las líneas contadas. Solo se enseña cuando el recuento ha terminado (pendiente de aprobación o cerrado), para que nadie cuente mirando el descuadre.",
          },
          { nombre: "Fecha", queEs: "Día en que se empezó." },
          { nombre: "Estado", queEs: "Contando, Pendiente de aprobación, Cerrado o Cancelado." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Número, Abierto, Cerrado (o Cancelado)", queEs: "Número INV y fechas." },
          { nombre: "Diferencias", queEs: "Mientras se cuenta o si está cancelado, en vez de las cifras de abajo sale por qué no se ven." },
          { nombre: "Líneas con diferencia", queEs: "Productos contados cuyo recuento no coincide con el teórico." },
          { nombre: "Diferencia en unidades", queEs: "Suma con signo de las diferencias (mezcla unidades: orientativo)." },
          { nombre: "Diferencia en €", queEs: "Lo que sobra menos lo que falta, en euros." },
          {
            nombre: "Descuadre (suma sin signo)",
            queEs: "Suma de todas las diferencias en euros sin compensar sobras con faltas.",
            logica: "Es la cifra que se compara con los 500 € para pedir aprobación.",
          },
          { nombre: "Seguir contando / Ver inventario", queEs: "Abre el inventario." },
        ],
      },
    ],
    logica: ["Salen los 100 inventarios más recientes de los centros que ves."],
    influye: [{ texto: "Stock ajustado al cerrar", ruta: "/comidas/stock" }],
  },

  "/comidas/inventarios/[id]": {
    titulo: "Recuento de inventario",
    area: "Comidas",
    paraQue: "Pantalla para contar (pensada para el móvil) y, al terminar, cerrar el inventario: el stock se ajusta a lo contado.",
    quien:
      "Ver: «Ver inventarios de comida». Contar, terminar y cancelar uno que se está contando: «Hacer inventarios de comida». Ver las diferencias de uno pendiente, aprobar, devolver a recuento y cancelar uno pendiente: «Cerrar inventarios de comida».",
    secciones: [
      {
        titulo: "Cabecera y avisos",
        campos: [
          { nombre: "Estado y «N de M contadas»", queEs: "En qué punto está el recuento." },
          {
            nombre: "Aviso de movimientos desde que se abrió",
            queEs: "Ha entrado o salido stock en ese centro o almacén después de empezar el inventario (compras, ventas, pedidos…).",
            logica:
              "El ajuste se calcula contra el stock del momento de abrirlo: cuenta lo que había entonces o vuelve a empezar el inventario, porque si no el ajuste saldrá mal.",
          },
        ],
      },
      {
        titulo: "Recuento",
        campos: [
          { nombre: "Buscar producto o referencia", queEs: "Filtra la lista." },
          { nombre: "Contadas N de M y barra", queEs: "Avance del recuento." },
          { nombre: "Solo sin contar", queEs: "Esconde lo ya contado." },
          {
            nombre: "Casilla de cada producto con − y +",
            queEs: "Lo que has contado. Los botones restan o suman 1. Vacía (—) = sin contar.",
            logica: "Es a ciegas: no se enseña el stock teórico para no influir. Una línea sin contar no se ajusta.",
          },
          { nombre: "Guardar recuento", queEs: "Guarda lo contado; se puede guardar tantas veces como haga falta." },
          {
            nombre: "Guardar y terminar",
            queEs: "Guarda y cierra el recuento.",
            logica:
              "Si el descuadre (suma sin signo en €) es de 500 € o menos, se cierra y se ajusta el stock. Si pasa de 500 €, queda «Pendiente de aprobación» y ya no se puede contar. Tiene que haber algo contado.",
            influye: "Ver «Al cerrar».",
          },
        ],
      },
      {
        titulo: "Diferencias (pendiente de aprobación con permiso de cerrar, o ya cerrado)",
        campos: [
          { nombre: "Diferencia", queEs: "Valor neto: sobras menos faltas." },
          { nombre: "Descuadre sin signo", queEs: "Suma de todas las diferencias en euros sin compensar." },
          { nombre: "Líneas con diferencia", queEs: "Productos contados que no cuadran." },
          { nombre: "Unidades", queEs: "Suma con signo de las diferencias en cantidad." },
          {
            nombre: "Tabla Producto · Teórico · Contado · Diferencia · €",
            queEs: "Cada producto que no cuadra, de mayor a menor importe. € = diferencia × coste guardado al abrir.",
          },
        ],
      },
      {
        titulo: "Aprobación (descuadre de más de 500 €)",
        campos: [
          { nombre: "Aprobar y cerrar", queEs: "Cierra el inventario y ajusta el stock. Solo con permiso de cerrar inventarios." },
          { nombre: "Devolver a recuento", queEs: "Vuelve a «Contando» para revisar las líneas con más diferencia." },
        ],
      },
      {
        titulo: "Cancelar el inventario (contando o pendiente de aprobación)",
        campos: [
          { nombre: "Motivo", queEs: "Opcional: por qué se cancela. Queda en el registro de cambios." },
          {
            nombre: "Cancelar sin ajustar el stock",
            queEs: "Deja el inventario «Cancelado»: no crea ningún ajuste y deja empezar otro en ese centro o almacén. Lo contado se conserva para el historial.",
            logica: "Contando: quien hace inventarios. Pendiente de aprobación: solo quien puede cerrarlos. No se puede deshacer.",
          },
        ],
      },
    ],
    logica: [
      "Es a ciegas: mientras se cuenta nadie ve el teórico ni las diferencias (tampoco quien puede cerrar). Se ven al terminar, si queda pendiente de aprobación, o ya cerrado.",
      "Al cerrar: por cada línea contada con diferencia se crea un movimiento «Ajuste de inventario» (contado − teórico) valorado al coste guardado al abrir. Si el inventario es de un almacén, el ajuste va a ese almacén; si es del centro, las sobras entran en el sitio de cada producto y las faltas salen primero de su sitio.",
      "Un inventario cerrado no se puede reabrir.",
    ],
    influye: [
      { texto: "Stock y su valor", ruta: "/comidas/stock" },
      { texto: "Movimientos de ajuste", ruta: "/comidas/movimientos" },
    ],
  },

  // ------------------------------------------------------------------ traspasos
  "/comidas/traspasos": {
    titulo: "Traspasos de comidas",
    area: "Comidas",
    paraQue: "Pasar comida de un almacén a otro del mismo centro (por ejemplo, de la Cámara al Congelador). El stock total del centro no cambia, solo dónde está.",
    quien: "Ver: «Ver stock de comida». Hacer traspasos: «Pasar comida de un almacén a otro del mismo centro».",
    secciones: [
      {
        titulo: "Nuevo traspaso: elegir de dónde a dónde",
        campos: [
          { nombre: "Centro", queEs: "Solo salen tus centros con almacenes. Si solo hay uno, no se enseña el selector." },
          {
            nombre: "De",
            queEs: "Almacén de origen, o «Sin ubicar». Viene propuesta la Cámara (en un centro con un solo almacén, «Sin ubicar»).",
            logica: "«Sin ubicar» es el stock del centro que no está en ningún almacén (lo que entró antes de que el centro tuviera almacenes): así se coloca en su sitio.",
          },
          { nombre: "A", queEs: "Almacén de destino. Viene propuesto el Congelador. Tiene que ser distinto del origen." },
          { nombre: "Ver productos", queEs: "Carga los productos que hay en el almacén de origen." },
        ],
      },
      {
        titulo: "Productos a pasar",
        campos: [
          ...BUSCADOR_CANTIDADES,
          { nombre: "hay N", queEs: "Lo que queda en el almacén de origen. Si escribes más, sale el aviso de que no se podrá hacer." },
          { nombre: "· en (destino): N", queEs: "Lo que ya hay en el almacén de destino." },
          {
            nombre: "Cantidades propuestas",
            queEs: "Si el destino es el sitio del producto y el centro tiene máximo (o mínimo) puesto, viene la cantidad para reponer.",
            logica: "Propuesta = máximo (o mínimo) − lo que hay en destino, sin pasar de lo que hay en origen.",
          },
          { nombre: "Nota", queEs: "Opcional; se guarda en el motivo." },
          {
            nombre: "Hacer traspaso",
            queEs: "Mueve las cantidades.",
            logica:
              "Crea un documento TRA-… con dos movimientos «Traspaso» por producto: salida del origen y entrada en el destino, al coste medio. No deja pasar más de lo que hay en origen. No se puede deshacer (se hace otro traspaso al revés).",
          },
        ],
      },
      {
        titulo: "Traspasos hechos",
        campos: [
          { nombre: "Traspaso", queEs: "Número del documento TRA." },
          { nombre: "Fecha, Centro", queEs: "Cuándo y en qué centro." },
          { nombre: "De → a", queEs: "Almacén de origen y de destino." },
          { nombre: "Productos", queEs: "Cuántos productos se pasaron." },
          { nombre: "Valor", queEs: "Suma de cantidad × coste medio de lo pasado." },
          { nombre: "Detalle: Motivo, Usuario y tabla de productos", queEs: "Quién lo hizo, la nota y cada producto con su cantidad." },
        ],
      },
    ],
    influye: [{ texto: "Stock por almacén", ruta: "/comidas/stock" }],
  },

  // ------------------------------------------------------------------ movimientos
  "/comidas/movimientos": {
    titulo: "Movimientos de comidas",
    area: "Comidas",
    paraQue: "El historial de todo lo que entra y sale del stock: qué, cuánto, dónde, cuándo, con qué documento, quién y por qué. Es solo de consulta.",
    quien: "Permiso «Ver stock de comida».",
    secciones: [
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar producto o referencia", queEs: "Solo movimientos de productos cuyo nombre o referencia contengan el texto." },
          {
            nombre: "Tipo",
            queEs:
              "Entrada de compra, Salida a local, Entrada de pedido, Consumo en producción, Entrada de producción, Merma, Ajuste de inventario, Consumo del local, Venta en caja, Carga inicial o Traspaso entre almacenes.",
          },
          { nombre: "Almacén", queEs: "Solo los de los almacenes con ese nombre, o los «Sin ubicar»." },
          { nombre: "Desde · Hasta", queEs: "Rango de días; los dos incluidos.", logica: "Días de Madrid: «desde» empieza a las 00:00 y «hasta» acaba a las 24:00, hora de Madrid (en verano y en invierno)." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
          { nombre: "Solo (producto)", queEs: "Si vienes desde «Ver movimientos» de Stock, se ven solo los de ese producto." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Fecha", queEs: "Fecha y hora del movimiento. Primero los más recientes." },
          { nombre: "Producto", queEs: "Producto que se mueve." },
          { nombre: "Centro · almacén", queEs: "Dónde entra o sale." },
          { nombre: "Tipo", queEs: "Qué lo ha provocado (compra, pedido, venta, merma…)." },
          { nombre: "Cantidad", queEs: "En verde con «+» lo que entra; en rojo lo que sale." },
          { nombre: "Documento", queEs: "Número del papel que lo origina: ALB-E (compra), ALB-S (pedido), OP (producción), MER (merma), INV (inventario), TRA (traspaso)…" },
          { nombre: "Valor", queEs: "Cantidad × coste unitario del movimiento." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Coste unitario", queEs: "Precio por unidad con el que se valoró el movimiento." },
          { nombre: "Motivo", queEs: "Explicación: compra y albarán del proveedor, pedido, motivo de la merma, inventario…" },
          { nombre: "Usuario", queEs: "Quién lo hizo; «Sistema» si fue automático." },
        ],
      },
    ],
    logica: ["Se ven como mucho los 300 últimos movimientos que cumplen el filtro, de los centros que ves.", "Un movimiento nunca se borra ni se cambia."],
    influye: [{ texto: "El stock es la suma de estos movimientos", ruta: "/comidas/stock" }],
  },

  // ------------------------------------------------------------------ productos
  "/comidas/productos": {
    titulo: "Productos de comidas",
    area: "Comidas",
    paraQue: "Catálogo de productos de alimentación: referencia, familia, proveedor, unidad, coste, IVA y mínimo. Un producto con historial no se borra: se desactiva.",
    quien: "Ver: «Ver productos de comida». Crear, cambiar y desactivar: «Crear y editar productos de comida».",
    secciones: [
      {
        titulo: "Aviso de costes a 0",
        campos: [
          {
            nombre: "N producto(s) activos tienen coste 0…",
            queEs: "Productos sin coste que no están marcados como «Sin coste». Hay que corregirlos para que el valor del stock y el coste de los platos sean reales. Esas filas salen en amarillo.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar", queEs: "Por nombre, referencia o código de barras." },
          { nombre: "Familia", queEs: "Solo los de una familia." },
          { nombre: "Ver desactivados", queEs: "Enseña también los productos dados de baja (tachados)." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Referencia", queEs: "Código único del producto en toda la cadena." },
          { nombre: "Producto", queEs: "Nombre; tachado si está desactivado." },
          { nombre: "Familia, Proveedor", queEs: "Familia y proveedor habitual." },
          { nombre: "Coste", queEs: "Coste medio por unidad de stock, o «Sin coste»." },
          { nombre: "Estado", queEs: "Activo o Desactivado." },
        ],
      },
      {
        titulo: "Detalle de la fila y formulario",
        campos: [
          { nombre: "Unidad, Por formato de compra, IVA, Mínimo general", queEs: "Datos actuales del producto." },
          { nombre: "Por qué no tiene coste", queEs: "Solo en los marcados «Sin coste»: el motivo guardado." },
          { nombre: "Referencia", queEs: "Obligatoria y única en toda la cadena (no puede repetirse ni con Bebidas)." },
          { nombre: "Nombre", queEs: "Obligatorio, al menos 2 letras." },
          { nombre: "Familia", queEs: "Familia del producto." },
          {
            nombre: "O familia nueva",
            queEs: "Si la escribes, se crea esa familia (o se usa si ya existe con ese nombre) en vez de la elegida.",
            influye: "La familia decide el almacén por defecto (congelados al Congelador, seco al Seco, el resto a la Cámara) y el agrupado de listas.",
          },
          {
            nombre: "Proveedor habitual",
            queEs: "Proveedor al que se suele comprar.",
            influye: "En «Nueva compra» salen por defecto los productos de ese proveedor.",
          },
          {
            nombre: "Unidad de stock",
            queEs: "En qué se cuenta el producto: kg, unidades, litros, cajas, bandejas…",
            influye: "Las cantidades de compras, pedidos, inventarios y escandallos van en esta unidad. Cambiarla con stock no convierte nada.",
          },
          {
            nombre: "Unidades por formato de compra",
            queEs: "Por ejemplo, 6 unidades por caja o 25 kg por saco. Mayor que 0.",
            logica: "Las compras se piden en la unidad de stock, pero «Rellenar con lo que está bajo mínimo» redondea hacia arriba a formatos completos y el texto del pedido al proveedor dice cuántos formatos son («60 kg (2 × 25 + 10)»).",
          },
          {
            nombre: "Coste por unidad (€)",
            queEs: "Coste medio por unidad de stock. Obligatorio salvo que se marque «Sin coste».",
            logica: "Se recalcula solo al recibir compras. Si lo cambias a mano, queda anotado como cambio de coste.",
            influye: "Valor del stock, coste de los platos y de las recetas, precio de pedidos sin tarifa, valor de mermas y traspasos.",
          },
          { nombre: "IVA", queEs: "0, 4, 10 o 21 %. Por defecto 10 % en comida." },
          {
            nombre: "Mínimo general",
            queEs: "Mínimo que se aplica en obrador y almacenes que no tengan uno propio. En los locales se pone en Stock.",
          },
          { nombre: "Código de barras", queEs: "Opcional; sirve para buscar." },
          {
            nombre: "Sin coste (muestra, regalo…) y motivo",
            queEs: "Permite dejar el coste en 0. El motivo es obligatorio y se guarda en el producto (sale en la casilla y en el detalle).",
            logica: "Si se quita la marca, el motivo se borra. Al recibir una compra con precio, el producto deja de estar «sin coste» solo.",
          },
          { nombre: "Guardar cambios", queEs: "Guarda la ficha. Queda anotado quién y qué cambió." },
          {
            nombre: "Desactivar / Volver a activar",
            queEs: "Da de baja el producto sin borrarlo: sus movimientos se conservan. Desactivado no sale para pedir ni para comprar, ni en inventarios nuevos (salvo que tenga stock).",
          },
        ],
      },
      {
        titulo: "Botón de arriba",
        campos: [{ nombre: "Nuevo producto", queEs: "Abre el alta de un producto." }],
      },
    ],
    influye: [
      { texto: "Stock", ruta: "/comidas/stock" },
      { texto: "Escandallos de la carta", ruta: "/comidas/carta" },
      { texto: "Alérgenos de los ingredientes", ruta: "/comidas/carta/alergenos" },
    ],
  },

  "/comidas/productos/nuevo": {
    titulo: "Nuevo producto de comidas",
    area: "Comidas",
    paraQue: "Dar de alta un producto en el catálogo de Comidas. El stock no se escribe aquí: entra con compras, pedidos, producción o inventarios.",
    quien: "Permiso «Crear y editar productos de comida».",
    secciones: [
      {
        titulo: "Formulario",
        campos: [
          { nombre: "Referencia", queEs: "Código único en toda la cadena. Obligatorio." },
          { nombre: "Nombre", queEs: "Obligatorio." },
          { nombre: "Familia / O familia nueva", queEs: "Elige una familia o escribe una nueva (se crea al guardar)." },
          { nombre: "Proveedor habitual", queEs: "Opcional." },
          { nombre: "Unidad de stock", queEs: "Por defecto kg." },
          { nombre: "Unidades por formato de compra", queEs: "Por defecto 1. Por ejemplo 25 si se compra en sacos de 25 kg: la propuesta de compra pedirá sacos completos." },
          {
            nombre: "Coste por unidad (€)",
            queEs: "Obligatorio y mayor que 0, salvo que marques «Sin coste» y escribas el motivo.",
            influye: "Es el coste de partida; al recibir compras se recalcula la media.",
          },
          { nombre: "IVA", queEs: "Por defecto 10 %." },
          { nombre: "Mínimo general", queEs: "Para obrador y almacenes. Por defecto 0 (sin aviso)." },
          { nombre: "Código de barras", queEs: "Opcional." },
          { nombre: "Sin coste y motivo", queEs: "Solo para productos que de verdad no cuestan (muestras, regalos). El motivo es obligatorio y queda guardado en el producto." },
          { nombre: "Dar de alta", queEs: "Crea el producto y vuelve a la lista de Productos." },
          { nombre: "Volver", queEs: "Vuelve a Productos sin guardar." },
        ],
      },
    ],
    influye: [{ texto: "Catálogo de productos", ruta: "/comidas/productos" }],
  },

  // ------------------------------------------------------------------ carta
  "/comidas/carta": {
    titulo: "Carta de comidas: platos y escandallos",
    area: "Comidas",
    paraQue:
      "Los platos de la carta de cada marca o local con su precio, su coste (escandallo), el % de coste sobre el precio y los alérgenos. Se entra por secciones de la carta. Aquí también se crean platos nuevos.",
    quien: "Ver: «Ver carta y escandallos». Crear y cambiar platos: «Editar carta, alérgenos y escandallos».",
    secciones: [
      {
        titulo: "Pestañas",
        campos: [
          { nombre: "Platos y escandallos", queEs: "Esta pantalla." },
          { nombre: "Cartas", queEs: "Las cartas con sus secciones y qué platos lleva cada una." },
          { nombre: "Pan y aperitivo", queEs: "Recargo por persona de cada local (Caja lo cobra solo en cada ticket)." },
          { nombre: "Alérgenos de ingredientes", queEs: "Alérgenos de cada producto del catálogo." },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Platos", queEs: "Platos que se ven con los filtros. El detalle dice cuántos no tienen escandallo." },
          {
            nombre: "Coste medio",
            queEs: "% de coste medio de los platos.",
            logica: "Media simple del % de coste de los platos que tienen coste (cada plato pesa igual, se venda mucho o poco).",
          },
          {
            nombre: "Sobre el objetivo",
            queEs: "Platos cuyo % de coste pasa del objetivo de su marca (o algún formato suyo lo pasa).",
          },
          {
            nombre: "Alérgenos por revisar",
            queEs: "Platos sin la casilla «Revisados» o con alérgenos de los ingredientes que el plato no declara.",
          },
        ],
      },
      {
        titulo: "Secciones",
        campos: [
          {
            nombre: "Tarjetas de sección",
            queEs: "Cada sección de las cartas que ves, con el número de platos y cuántos están «caros» (sobre el objetivo). Borde rojo si hay caros, amarillo si hay alérgenos por revisar.",
            logica:
              "Primero las cartas del local y luego las de la marca. Los platos que no están en ninguna sección visible van a «Sin sección». Con más de 80 platos se abre directamente la primera sección.",
          },
          { nombre: "Todas", queEs: "Enseña todas las secciones a la vez." },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          {
            nombre: "Marca",
            queEs: "Solo los platos de una marca (con su objetivo de coste). No sale si arriba tienes elegido un local: entonces se ven sus platos y los de su marca.",
          },
          { nombre: "Buscar", queEs: "Por nombre del plato en español o en inglés." },
          { nombre: "Ver retirados", queEs: "Incluye los platos retirados de la carta." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla de platos (una por sección)",
        campos: [
          {
            nombre: "Plato",
            queEs: "Nombre y descripción. Etiquetas: «Retirado», «No se sirve aquí» (el local elegido lo tiene desactivado), «Solo (local)» si es un plato de un solo local, «Bajo demanda».",
          },
          { nombre: "Marca", queEs: "Solo sale si no hay un local elegido arriba." },
          {
            nombre: "Precio",
            queEs: "Precio de venta con IVA.",
            logica: "Si el local elegido tiene precio propio, sale ese y debajo el de la marca. Si el plato tiene formatos (ración, media…), salen todos con su precio.",
          },
          {
            nombre: "Coste",
            queEs: "Lo que cuesta hacer el plato, o «Sin escandallo».",
            logica:
              "Suma de cada ingrediente: cantidad bruta × coste medio del producto. Cantidad bruta = neta / (1 − merma %). Con formatos, el coste del primer formato.",
          },
          {
            nombre: "% coste",
            queEs: "Coste sobre el precio sin IVA. Verde si está dentro del objetivo de la marca, rojo si lo pasa.",
            logica: "% = coste / (precio / (1 + IVA)) × 100. Se usa el precio del local elegido si lo tiene.",
          },
          { nombre: "Alérgenos", queEs: "Los declarados, «Por revisar» si no están revisados, o «Faltan N» si los ingredientes llevan alérgenos que el plato no declara." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "IVA", queEs: "IVA del plato." },
          { nombre: "Objetivo de la marca", queEs: "% de coste máximo que se ha puesto para la marca (30 % si no se ha puesto)." },
          { nombre: "Coste al último precio", queEs: "Coste si cada ingrediente se valorase al precio de su última compra o producción, en vez del medio." },
          { nombre: "Margen bruto", queEs: "Precio sin IVA − coste." },
          { nombre: "Alérgenos declarados, Trazas", queEs: "Lo declarado en la ficha del plato." },
          { nombre: "Del escandallo sin declarar", queEs: "Alérgenos que llevan los ingredientes y el plato no declara. Hay que revisarlo." },
          { nombre: "En cartas", queEs: "Cartas en las que está el plato." },
          { nombre: "Tabla de formatos", queEs: "Si los tiene: cada formato con precio, coste y % de coste." },
          { nombre: "Tabla de ingredientes", queEs: "Ingrediente (con «(obrador)» si es un elaborado), cantidad neta, merma y coste." },
          { nombre: "Editar plato… / Ver ficha", queEs: "Abre la ficha del plato." },
        ],
      },
      {
        titulo: "Nuevo plato",
        campos: [
          { nombre: "Marca", queEs: "Marca a la que pertenece. Si tienes un local elegido arriba, es la suya." },
          { nombre: "Para", queEs: "«Toda la marca» o «Solo (local)»: un plato de un solo local no sale en las cartas de los demás." },
          { nombre: "Nombre (español), Nombre (inglés)", queEs: "El español es obligatorio." },
          { nombre: "Precio (con IVA)", queEs: "Precio de venta de la marca. No puede ser negativo." },
          { nombre: "IVA %", queEs: "Por defecto 10 %." },
          { nombre: "Crear y hacer el escandallo", queEs: "Crea el plato (sin alérgenos y sin revisar) y abre su ficha para poner ingredientes." },
        ],
      },
      {
        titulo: "Hueco «Carta al TPV»",
        campos: [{ nombre: "Carta al TPV", queEs: "Conexión pendiente: enviará platos, formatos y precios por local al programa de caja." }],
      },
    ],
    influye: [
      { texto: "Las ventas de caja descuentan del stock los ingredientes del escandallo", ruta: "/caja/tickets" },
      { texto: "Coste teórico de lo vendido en el cuadro de mando", ruta: "/cuadro" },
    ],
  },

  "/comidas/carta/cartas": {
    titulo: "Cartas de comidas",
    area: "Comidas",
    paraQue:
      "Las cartas de cada marca o de cada local (permanentes o temporales con fechas), sus secciones de platos y qué platos lleva cada sección. También el objetivo de % de coste de cada marca.",
    quien:
      "Ver: «Ver carta y escandallos». Cambiar: «Editar carta, alérgenos y escandallos» (crear y editar cartas también lo puede quien edite la carta de Bebidas; el objetivo de coste de platos, solo quien edite la de Comidas).",
    secciones: [
      {
        titulo: "Filtro",
        campos: [
          {
            nombre: "Marca",
            queEs: "Solo las cartas de una marca. No sale si tienes un local elegido arriba: entonces se ven las cartas de ese local y las activas de su marca.",
          },
        ],
      },
      {
        titulo: "Tabla de cartas",
        campos: [
          { nombre: "Carta", queEs: "Nombre." },
          { nombre: "De", queEs: "«Marca (toda la marca)» o «Solo (local)»." },
          { nombre: "Tipo", queEs: "Permanente o Temporal." },
          { nombre: "Fechas", queEs: "Inicio y fin de una carta temporal." },
          { nombre: "Secciones", queEs: "Secciones de comida de la carta (las de bebidas se ven en Bebidas)." },
          { nombre: "Platos", queEs: "Platos en esas secciones." },
          {
            nombre: "Estado",
            queEs: "En vigor, Próxima (temporal que aún no empieza), Terminada (temporal ya pasada) o Desactivada.",
            logica: "Una permanente activa siempre está en vigor; una temporal activa, entre su fecha de inicio y la de fin (hora de Madrid).",
          },
        ],
      },
      {
        titulo: "Detalle de la carta: secciones y platos",
        campos: [
          { nombre: "Sección", queEs: "Nombre en español y en inglés." },
          {
            nombre: "Confirmo quitarla y Quitar sección",
            queEs: "Quita la sección de la carta. Hay que marcar la casilla. No se borra: queda en «Secciones quitadas» con sus platos y se puede recuperar.",
            influye: "La sección deja de verse en la carta, en la lista de platos por secciones y en «En cartas» de cada plato.",
          },
          {
            nombre: "Secciones quitadas y Recuperar",
            queEs: "Secciones que se quitaron de esta carta, con cuántos platos guardan. «Recuperar» la vuelve a poner como estaba.",
          },
          {
            nombre: "Cada plato",
            queEs: "Nombre (enlace a su ficha), formatos con precio, alérgenos, precio de la marca y % de coste (verde o rojo según el objetivo).",
          },
          { nombre: "Quitar", queEs: "Saca el plato de la sección (el plato sigue existiendo)." },
          {
            nombre: "Añadir un plato de (marca)…",
            queEs: "Mete un plato en la sección.",
            logica:
              "Salen los platos de la misma marca que aún no están en esta carta. Un plato de un solo local solo puede ir en una carta de ese local. No puede repetirse en la misma sección.",
          },
          { nombre: "Nueva sección de platos y En inglés", queEs: "Crea una sección nueva al final de la carta." },
          { nombre: "Nombre, Tipo, Desde, Hasta y Guardar", queEs: "Cambia los datos de la carta. Una temporal necesita las dos fechas y la de fin no puede ser anterior." },
          { nombre: "Platos que pueden ir y no están", queEs: "Cuántos platos de la marca aún no están en esta carta." },
          {
            nombre: "Desactivar carta / Activar carta",
            queEs: "Una carta desactivada no está en vigor y, con un local elegido, no se ve la de la marca. Desactiva la carta entera, también sus secciones de bebidas.",
            logica:
              "Si la carta tiene secciones de bebidas, sale la casilla «También tiene N sección(es) de bebidas: dejarán de verse», que hay que marcar; y solo puede hacerlo quien edite también la carta de Bebidas. Para quitar solo lo de comidas, usa «Quitar sección».",
          },
        ],
      },
      {
        titulo: "Nueva carta",
        campos: [
          { nombre: "Marca", queEs: "Marca de la carta." },
          { nombre: "Para", queEs: "Toda la marca (la ven todos sus locales) o solo un local." },
          { nombre: "Nombre", queEs: "Obligatorio." },
          { nombre: "Tipo", queEs: "Permanente o Temporal (con fechas)." },
          { nombre: "Desde, Hasta", queEs: "Obligatorias si es temporal." },
          { nombre: "Crear carta", queEs: "Crea la carta vacía; luego se le añaden secciones." },
        ],
      },
      {
        titulo: "Objetivo de coste de platos por marca",
        campos: [
          {
            nombre: "% de cada marca y Guardar",
            queEs: "% máximo de coste sobre el precio sin IVA que se quiere para los platos de la marca (de 1 a 100, admite decimales con coma). Si no se pone, es 30 %.",
            logica: "Es el objetivo de Comidas. Las bebidas tienen el suyo (Bebidas → Carta → Cartas); si una marca no lo tiene, las bebidas usan este.",
            influye: "Decide qué platos salen en rojo «sobre el objetivo» en la carta y en las fichas.",
          },
        ],
      },
    ],
    influye: [{ texto: "Platos agrupados por estas secciones", ruta: "/comidas/carta" }],
  },

  "/comidas/carta/platos/[id]": {
    titulo: "Ficha del plato",
    area: "Comidas",
    paraQue: "Todo de un plato: precio, coste y margen, formatos de venta (ración, media ración…), escandallo con sus ingredientes, precio en cada local, alérgenos y datos.",
    quien: "Ver: «Ver carta y escandallos». Cambiar: «Editar carta, alérgenos y escandallos».",
    secciones: [
      {
        titulo: "Botones de arriba",
        campos: [
          { nombre: "Volver a la carta", queEs: "Vuelve a la lista de platos." },
          { nombre: "Retirar plato / Recuperar plato", queEs: "Retira el plato de la carta sin borrarlo (deja de salir en las listas salvo con «Ver retirados»)." },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          {
            nombre: "Precio (con IVA)",
            queEs: "Precio del plato (si hay formatos, el del primero). Debajo, sin IVA.",
            logica: "Si arriba tienes elegido un local con precio propio para el plato, es el de ese local (y debajo, el de la marca). Si no, el de la marca. El % de coste, el margen y el aviso usan este mismo precio.",
          },
          {
            nombre: "Coste por ración",
            queEs: "Coste del escandallo (o del primer formato). Debajo, el coste al último precio de compra.",
            logica: "Suma de cantidad bruta × coste medio de cada ingrediente. Al último precio: con el último precio de entrada de cada ingrediente; si el formato principal vende otro producto, con el de ese producto.",
          },
          { nombre: "% de coste", queEs: "Coste sobre el precio sin IVA (el de la cifra «Precio»), comparado con el objetivo de la marca." },
          { nombre: "Margen bruto", queEs: "Precio sin IVA − coste." },
          { nombre: "Avisos", queEs: "Rojo si el coste pasa del objetivo; amarillo si hay ingredientes sin coste (el coste del plato sale más bajo de lo real)." },
        ],
      },
      {
        titulo: "Formatos de venta",
        campos: [
          { nombre: "Formato", queEs: "Nombre (Ración, Media ración…), «Principal» en el primero, y qué parte del escandallo lleva." },
          { nombre: "Precio · cantidad y Guardar", queEs: "Precio con IVA del formato y parte del escandallo (1 = entero, 0,5 = la mitad)." },
          {
            nombre: "Coste, % coste",
            queEs: "Coste del formato y su % sobre el precio sin IVA.",
            logica: "Coste = parte × coste del escandallo (o unidades × coste del producto propio, si lo tiene).",
          },
          { nombre: "Poner primero", queEs: "Lo hace formato principal: su precio pasa a ser el precio del plato." },
          { nombre: "Quitar", queEs: "Desactiva el formato." },
          {
            nombre: "Añadir formato: Formato, Precio, Parte del escandallo, Otro producto",
            queEs: "Crea un formato. «Otro producto» vende ese producto en vez del escandallo (por ejemplo, otra pieza).",
            influye: "Al vender en caja, se descuenta del stock la parte del escandallo de ese formato (o el producto propio).",
          },
        ],
      },
      {
        titulo: "Escandallo (por ración)",
        campos: [
          { nombre: "Ingrediente", queEs: "Producto del catálogo, con «Obrador» si es un elaborado, y sus alérgenos debajo." },
          {
            nombre: "Neta · merma % y Guardar",
            queEs: "Cantidad que lleva el plato ya limpia (en la unidad del producto) y % que se pierde al limpiar o cocinar (0 a 95 %).",
          },
          { nombre: "Bruta", queEs: "Lo que hay que sacar del almacén.", logica: "Bruta = neta / (1 − merma / 100)." },
          { nombre: "Precio medio", queEs: "Coste medio del producto por unidad, o «Sin coste»." },
          { nombre: "Coste", queEs: "Bruta × precio medio." },
          { nombre: "% del plato", queEs: "Peso de ese ingrediente en el coste total." },
          { nombre: "Quitar", queEs: "Quita el ingrediente del escandallo." },
          {
            nombre: "Añadir: Ingrediente, Cantidad neta, Merma %",
            queEs: "Añade un ingrediente: productos de Comidas, elaborados del obrador o productos de Bebidas.",
            logica: "Al añadir un ingrediente, los alérgenos del plato vuelven a quedar «por revisar».",
            influye: "Coste del plato; lo que se descuenta del stock en cada venta de caja; coste teórico del cuadro de mando.",
          },
        ],
      },
      {
        titulo: "Precio por local",
        campos: [
          { nombre: "Local", queEs: "Locales abiertos de la marca (o solo el local del plato)." },
          { nombre: "Precio", queEs: "En negrita si el local tiene precio propio; si no, el de la marca." },
          { nombre: "% coste", queEs: "% de coste con el precio de ese local." },
          {
            nombre: "Cambiar en este local: precio, Se sirve y Guardar",
            queEs: "Precio propio del local (vacío = el de la marca) y si el plato se sirve en ese local.",
            influye: "La caja de ese local cobra este precio; si no «Se sirve», no deja meterlo a mano en un ticket.",
          },
        ],
      },
      {
        titulo: "Alérgenos (14 obligatorios)",
        campos: [
          { nombre: "Aviso rojo", queEs: "El escandallo lleva alérgenos que el plato no declara." },
          { nombre: "Contiene, Trazas", queEs: "Casillas de los 14 alérgenos. «(escandallo)» marca los que vienen de los ingredientes." },
          { nombre: "Revisados por cocina", queEs: "Confirma que cocina los ha revisado. Se desmarca solo al añadir ingredientes o cambiar los alérgenos de un ingrediente." },
          { nombre: "Guardar alérgenos", queEs: "Guarda lo marcado. Queda anotado quién lo cambió." },
          { nombre: "Copiar los del escandallo", queEs: "Añade a lo declarado los alérgenos y trazas de los ingredientes y deja el plato «por revisar»." },
        ],
      },
      {
        titulo: "Datos del plato",
        campos: [
          { nombre: "Marca", queEs: "Marca del plato." },
          { nombre: "Nombre y descripción (español e inglés)", queEs: "Textos de la carta." },
          { nombre: "Precio (con IVA)", queEs: "Precio de la marca. Si hay formatos, se cambia en «Formatos de venta»." },
          { nombre: "IVA %", queEs: "De 0 a 21." },
          { nombre: "Etiquetas", queEs: "Separadas por comas: sin gluten, vegetariano, picante… «bajo demanda» se marca en la lista." },
          { nombre: "Guardar datos", queEs: "Guarda. Los cambios de precio o IVA quedan anotados." },
        ],
      },
    ],
    influye: [
      { texto: "Cobros y descuento de stock en caja", ruta: "/caja/tickets" },
      { texto: "Coste teórico en el cuadro de mando", ruta: "/cuadro" },
      { texto: "Alérgenos de los ingredientes", ruta: "/comidas/carta/alergenos" },
    ],
  },

  "/comidas/carta/recargos": {
    titulo: "Pan y aperitivo",
    area: "Comidas",
    paraQue:
      "Importe fijo por persona que cobra cada local por el pan y el aperitivo, con su IVA, si está activo y, si se quiere, el plato con su escandallo. Si está activo, Caja lo añade solo a cada ticket que se apunta: importe por persona × comensales.",
    quien: "Ver: «Ver carta y escandallos». Cambiar: «Editar carta, alérgenos y escandallos» y acceso al local.",
    secciones: [
      {
        titulo: "Tabla de locales",
        campos: [
          { nombre: "Local, Marca", queEs: "Locales abiertos que ves (o el elegido arriba)." },
          { nombre: "Por persona", queEs: "Importe con IVA por comensal; «—» si no se ha definido." },
          { nombre: "IVA", queEs: "IVA del recargo (10 % si no se ha definido)." },
          { nombre: "Escandallo", queEs: "Plato de la carta cuyo escandallo es lo que se sirve (pan, aceitunas, aceite…), o «Sin escandallo»." },
          { nombre: "Estado", queEs: "Activo, Desactivado o Sin definir (en amarillo). Solo los activos con importe se cobran en Caja." },
        ],
      },
      {
        titulo: "Detalle de la fila (para cambiarlo)",
        campos: [
          { nombre: "Importe por persona (IVA incluido)", queEs: "Obligatorio, no negativo. Con coma decimal: 3,20." },
          { nombre: "IVA %", queEs: "De 0 a 21." },
          {
            nombre: "Escandallo (plato de la carta)",
            queEs: "Opcional. Un plato de comidas de la marca del local (o del propio local) con el escandallo de lo que se sirve por persona.",
            logica: "Con plato, cada línea de pan y aperitivo baja el stock de su escandallo por comensal y tiene coste teórico; ese plato deja de salir en la lista de líneas de Caja (para no cobrarlo dos veces). Sin plato, no baja stock y su coste es 0.",
          },
          {
            nombre: "Activo (se cobra en este local)",
            queEs: "Si está marcado, Caja añade la línea a cada ticket nuevo del local; si está desmarcado, no se cobra.",
            logica: "Los tickets ya apuntados no cambian: el cambio de importe o de estado vale para los siguientes.",
          },
          { nombre: "Guardar", queEs: "Guarda y anota quién lo cambió. Debajo, la fecha de la última modificación." },
        ],
      },
    ],
    logica: [
      "Caja → Tickets añade la línea «Pan y aperitivo» = importe × comensales al apuntar un ticket; se ajusta si cambian los comensales de un ticket abierto y se puede quitar con un motivo (la línea queda anulada y auditada).",
      "En los tickets importados del TPV no se añade: manda el TPV. Si el ticket ya la trae, se reconoce y no se duplica; si no, se avisa.",
      "Cuenta como venta (jornada, ticket medio, Cuadro de mando) y sale en su propia fila en Caja → Venta por plato.",
    ],
  },

  "/comidas/carta/alergenos": {
    titulo: "Alérgenos de los ingredientes",
    area: "Comidas",
    paraQue:
      "Declarar los alérgenos y trazas de cada producto de Comidas. Lo que se declara aquí lo heredan los escandallos de los platos y las recetas del obrador.",
    quien: "Ver: «Ver carta y escandallos». Cambiar: «Editar carta, alérgenos y escandallos».",
    secciones: [
      {
        titulo: "Buscador",
        campos: [{ nombre: "Buscar ingrediente y Buscar", queEs: "Filtra por nombre del producto." }],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Producto", queEs: "Nombre y referencia de los productos activos de Comidas." },
          { nombre: "Familia", queEs: "Familia del producto." },
          { nombre: "Alérgenos, Trazas", queEs: "Lo declarado; «Ninguno» si no hay." },
          {
            nombre: "Estado",
            queEs: "Declarado, Sin declarar (en amarillo) o Desde la receta (los elaborados del obrador, que se calculan solos).",
          },
          { nombre: "Total", queEs: "Productos que salen y cuántos están sin declarar." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Casillas «sí» y «trazas» de los 14 alérgenos", queEs: "Marca lo que contiene y lo que puede tener en trazas. Una traza que ya está como «sí» se ignora." },
          {
            nombre: "Guardar alérgenos de (producto)",
            queEs: "Guarda la declaración.",
            influye: "Todos los platos que llevan este ingrediente quedan «por revisar» y, si el alérgeno no está en el plato, sale el aviso «Faltan». Las recetas del obrador lo suman a sus elaborados.",
          },
          { nombre: "Elaborado del obrador", queEs: "No se edita aquí: sus alérgenos salen de su receta (Obrador → Recetas)." },
        ],
      },
    ],
    influye: [
      { texto: "Platos de la carta", ruta: "/comidas/carta" },
      { texto: "Recetas del obrador", ruta: "/obrador/recetas" },
    ],
  },
};
