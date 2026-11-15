import type { AyudaArea, CampoAyuda } from "../tipos";

/*
 * Ayuda de las pantallas de Bebidas. Casi todas son pantallas compartidas con Comidas
 * (src/modulos/_almacen/paginas/* y src/modulos/comidas/carta-pantallas/*); aquí se describen
 * tal como funcionan con el área Bebidas.
 */

const AREA = "Bebidas";

/** Qué centros se ven en las pantallas de almacén de Bebidas. */
const CENTROS_DEL_AREA =
  "Se ven los datos del centro elegido arriba en el selector de centro; con «Todos mis centros», los de todos tus centros. En los dos casos solo cuentan los centros que tienen activada el área de Bebidas.";

/** Lista de productos con casillas (pedidos, compras y traspasos). */
const SELECTOR_CANTIDADES: CampoAyuda[] = [
  {
    nombre: "Buscar producto, referencia o familia",
    queEs: "Filtra la lista mientras escribes. Lo que ya hayas escrito en productos que se ocultan no se pierde.",
  },
  {
    nombre: "Solo lo elegido",
    queEs: "Deja a la vista solo los productos con cantidad mayor que 0, para repasar antes de enviar.",
  },
  {
    nombre: "Contador «N producto(s)» y su importe",
    queEs: "Cuántos productos llevan cantidad y, si hay precio, cuánto suma.",
    logica: "Importe = suma de cantidad × precio de cada producto elegido.",
  },
  {
    nombre: "Casilla de cantidad (a la derecha de cada producto)",
    queEs: "Cuánto quieres. Admite decimales con coma (1,5). Vacía o 0 = no se pide.",
    logica: "Si un producto se repite, las cantidades se suman. Si escribes algo que no es un número, sale el aviso «Hay cantidades que no son números» y no se guarda nada.",
  },
];

// ---------------------------------------------------------------------------------------------

export const AYUDA_BEBIDAS: AyudaArea = {
  // =========================================================================== RESUMEN
  "/bebidas": {
    titulo: "Resumen de Bebidas",
    area: AREA,
    paraQue:
      "Es la portada del área de Bebidas: de un vistazo, cuánto vale la bebida que tienes, qué está bajo mínimo o agotado, qué pedidos de los locales faltan por servir y qué compras faltan por llegar. Cada cifra es un enlace a la pantalla con el detalle.",
    quien: "Quien tenga el permiso «Ver stock de bebidas». Los botones «Nuevo pedido» y «Nueva compra» solo salen si además se tiene permiso para pedir al almacén o para pedir a proveedores.",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Subtítulo «Datos de…»",
            queEs: "Dice de qué centros son las cifras: el elegido arriba o «N centro(s)» si estás en «Todos mis centros».",
            logica: CENTROS_DEL_AREA,
          },
          {
            nombre: "Nuevo pedido",
            queEs: "Abre el formulario para que un local pida bebida al obrador o al almacén central.",
            influye: "Crea un pedido de local «Por servir».",
          },
          {
            nombre: "Nueva compra",
            queEs: "Abre el formulario para pedir bebida a un proveedor.",
            influye: "Crea una compra «Sin enviar».",
          },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Valor del stock",
            queEs: "Lo que vale toda la bebida que hay en los centros que ves.",
            logica: "Suma, producto a producto, de stock × coste medio actual del producto. El stock es la suma de todos sus movimientos (entradas menos salidas). Es el mismo número que la cifra «Valor» de Stock.",
          },
          {
            nombre: "Referencias",
            queEs: "Cuántos productos distintos se controlan en esos centros. Debajo, cuánto hay en total por unidad (por ejemplo «812 botellas · 40 latas · 12 litros»).",
            logica:
              "Cuenta los productos que tienen stock o mínimo en algún centro (en obradores y almacenes cuentan todos). Los desactivados solo cuentan si aún tienen stock. Debajo se suman solo los totales positivos y cada unidad por separado (no se suman botellas con litros); salen las tres unidades con más cantidad.",
          },
          {
            nombre: "Bajo mínimo",
            queEs: "Productos que en algún centro tienen menos de su mínimo (pero más de 0).",
            logica:
              "Mínimo que se aplica en cada centro: el puesto para ese centro en Stock; si no hay, en obradores y almacenes el «Mínimo general» del producto; en un local sin mínimo propio no se avisa. Un producto cuenta con el peor estado de sus centros.",
            influye: "Pulsa la cifra para ver la lista en Stock.",
          },
          {
            nombre: "Sin stock",
            queEs: "Productos con 0 o menos en algún centro donde se controlan.",
            influye: "Pulsa la cifra para ver la lista en Stock.",
          },
          {
            nombre: "Pedidos por servir",
            queEs: "Pedidos de los locales que esperan a que el obrador o almacén central (de los que ves) los sirva.",
            logica: "Pedidos en estado «Por servir» cuyo centro que sirve es uno de los tuyos.",
          },
          {
            nombre: "Pedidos por confirmar",
            queEs: "Pedidos ya servidos en los que falta que el local diga lo que le ha llegado.",
            logica: "Pedidos en estado «Servido · por confirmar» cuyo local que pide es uno de los tuyos.",
          },
          {
            nombre: "Compras por recibir",
            queEs: "Compras a proveedor enviadas y todavía sin recibir del todo.",
            logica: "Cuenta las compras «Enviada · por recibir» y «Recibida en parte». Al pulsarla se abre el listado de compras filtrado por «Por recibir», que enseña esas mismas dos.",
          },
          {
            nombre: "Inventarios abiertos",
            queEs: "Inventarios sin cerrar: los que se están contando y los pendientes de aprobación.",
            logica:
              "Debajo, cuántos se están contando y cuántos esperan aprobación (o «ninguno sin cerrar»). Si hay alguno pendiente de aprobación, la cifra sale en ámbar. Los cancelados no cuentan.",
          },
        ],
      },
      {
        titulo: "Pedidos de locales por servir",
        campos: [
          { nombre: "Pedido", queEs: "Número del pedido (PL-…). Al pulsarlo se abre para servirlo." },
          { nombre: "Local", queEs: "El local que ha pedido." },
          { nombre: "Líneas", queEs: "Cuántos productos distintos lleva el pedido." },
          { nombre: "Hecho", queEs: "Fecha y hora en que el local hizo el pedido. Salen primero los más antiguos." },
          { nombre: "Estado", queEs: "Siempre «Por servir» en esta tabla." },
          { nombre: "Ver todos", queEs: "Abre el listado completo de pedidos de locales." },
        ],
      },
      {
        titulo: "Valor por familia",
        campos: [
          { nombre: "Familia", queEs: "Grupo de productos (vinos tintos, cervezas, refrescos…). «Sin familia» junta los que no tienen." },
          { nombre: "Referencias", queEs: "Cuántos productos de esa familia se controlan." },
          { nombre: "Valor", queEs: "Lo que vale el stock de esa familia.", logica: "Suma de stock × coste medio de sus productos. Ordenadas de más a menos valor." },
        ],
      },
      {
        titulo: "Avisos de stock",
        campos: [
          { nombre: "Producto", queEs: "Producto sin stock o bajo mínimo. Salen primero los agotados." },
          { nombre: "Stock", queEs: "Lo que hay en total en los centros que ves, en su unidad (botellas, cajas…)." },
          { nombre: "Mínimo", queEs: "Suma de los mínimos que se aplican en esos centros. «—» si ningún centro tiene mínimo." },
          { nombre: "Proveedor", queEs: "Proveedor habitual del producto (para saber a quién pedirlo)." },
          { nombre: "Estado", queEs: "«Sin stock» (rojo) o «Bajo mínimo» (ámbar)." },
          {
            nombre: "Ver en Stock",
            queEs: "Abre Stock con el filtro «Con aviso».",
            logica: "Aquí se ven solo los 15 primeros; si hay más, abajo lo dice.",
          },
        ],
      },
      {
        titulo: "Importar BODEGA 360",
        campos: [
          {
            nombre: "Hueco de integración",
            queEs: "Aviso de una conexión que todavía no está hecha: traerá productos, proveedores, stock, movimientos y albaranes de la aplicación actual. Hoy no hace nada; los datos se meten a mano.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Detalle del stock y de los mínimos", ruta: "/bebidas/stock" },
      { texto: "Pedidos de los locales", ruta: "/bebidas/pedidos" },
      { texto: "Compras a proveedores", ruta: "/bebidas/compras" },
      { texto: "Inventarios", ruta: "/bebidas/inventarios" },
    ],
    comoSeUsa: [
      "Elige arriba el centro que quieres mirar, o «Todos mis centros» para ver la cadena entera.",
      "Empieza por las cifras en rojo o ámbar: sin stock, bajo mínimo, pedidos por servir.",
      "Desde «Avisos de stock» decide qué hay que comprar o pedir.",
    ],
  },

  // =========================================================================== STOCK
  "/bebidas/stock": {
    titulo: "Stock de bebidas",
    area: AREA,
    paraQue:
      "Muestra cuánto hay de cada bebida, en qué centro y en qué almacén (Bodega, Barra…), si está bajo mínimo y cuánto vale. Al abrir una fila se ajustan los mínimos, máximos y la tarifa de cada centro y se apuntan roturas y mermas.",
    quien:
      "Verla: permiso «Ver stock de bebidas». Cambiar mínimo, máximo, tarifa, «pedible» y almacén: «Crear y editar productos de bebida». Apuntar roturas: «Registrar roturas y mermas».",
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Valor", queEs: "Lo que vale lo que sale en la tabla (con los filtros puestos).", logica: "Suma de stock × coste medio de cada producto." },
          { nombre: "Referencias", queEs: "Número de productos de la tabla. Debajo, cuánto hay por unidad (botellas, latas, litros…, cada una por separado; solo totales positivos)." },
          { nombre: "Bajo mínimo", queEs: "Productos de la tabla con menos de su mínimo en algún centro." },
          { nombre: "Sin stock", queEs: "Productos de la tabla con 0 o menos en algún centro donde se controlan." },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar por nombre, referencia o código de barras", queEs: "Busca el texto dentro del nombre o la referencia (sin importar mayúsculas) o dentro del código de barras." },
          { nombre: "Todas las familias", queEs: "Deja solo una familia de productos." },
          {
            nombre: "Todos los almacenes",
            queEs: "Deja solo lo que hay en un almacén (por nombre: «Barra» junta las barras de todos los centros elegidos). «Sin ubicar» es el stock antiguo que no tiene almacén.",
            logica:
              "Con este filtro, la columna de stock pasa a llamarse «En …» y el valor es solo el de ese almacén; salen los productos que tienen algo allí o que tienen ese almacén como su sitio. Debajo de la cantidad se ve lo que hay en todo el centro si es distinto.",
          },
          {
            nombre: "Todos los estados",
            queEs: "«Con aviso» (sin stock o bajo mínimo), «Bajo mínimo», «Sin stock» o «Correcto».",
          },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Producto", queEs: "Nombre y, debajo, referencia. «desactivado» si el producto está dado de baja (solo sale si aún tiene stock)." },
          { nombre: "Familia", queEs: "Familia del producto." },
          { nombre: "Proveedor", queEs: "Proveedor habitual." },
          {
            nombre: "Stock",
            queEs: "Lo que hay en total en los centros que ves, en su unidad.",
            logica: "Stock = suma de todos los movimientos del producto en esos centros (compras recibidas, pedidos, ventas, mermas, inventarios…). Nunca se escribe a mano.",
          },
          { nombre: "Mínimo", queEs: "Suma de los mínimos que se aplican en esos centros. «—» si no hay ninguno." },
          {
            nombre: "Estado",
            queEs: "«Sin stock», «Bajo mínimo» o «Correcto».",
            logica: "Sin stock: 0 o menos. Bajo mínimo: menos que el mínimo (si el mínimo es mayor que 0). Si hay varios centros, manda el peor.",
          },
          { nombre: "Valor", queEs: "Stock × coste medio del producto." },
          { nombre: "Total de abajo", queEs: "Número de productos y valor total de la tabla." },
        ],
      },
      {
        titulo: "Detalle de la fila (al abrirla)",
        campos: [
          { nombre: "Referencia, Familia, Proveedor, Unidad", queEs: "Datos del producto (se cambian en Productos)." },
          {
            nombre: "Coste medio",
            queEs: "Lo que cuesta de media cada unidad. «Sin coste» si el producto está marcado así.",
            logica: "Se recalcula solo cada vez que se recibe una compra (coste medio ponderado). Ver la ayuda de la ficha de compra.",
          },
          { nombre: "Mínimo general", queEs: "Mínimo del producto que se aplica en obradores y almacenes cuando no tienen uno propio." },
          { nombre: "Código de barras", queEs: "El del producto, si lo tiene." },
          { nombre: "Ver movimientos", queEs: "Abre Movimientos con solo este producto: todo lo que ha entrado y salido." },
          { nombre: "Centro", queEs: "Cada centro donde se controla el producto." },
          { nombre: "Stock (por centro)", queEs: "Lo que hay en ese centro." },
          { nombre: "Estado (por centro)", queEs: "Sin stock, bajo mínimo o correcto, mirando el total del centro." },
          {
            nombre: "Por almacén",
            queEs: "Cuánto hay en cada almacén del centro. «· su sitio» marca el almacén donde entra el producto. «Sin ubicar» (en ámbar) es stock antiguo sin almacén.",
          },
          {
            nombre: "mín. y máx.",
            queEs: "Mínimo y máximo del producto en ese centro.",
            logica:
              "Vacío en un local = sin control de mínimo (no avisa). El máximo no puede ser menor que el mínimo. El máximo es hasta dónde se propone reponer en «Rellenar con lo que está bajo mínimo» de las compras y en los traspasos.",
            influye: "Estado y avisos de Stock y del Resumen, propuesta de compra y propuesta de traspaso.",
          },
          {
            nombre: "€ tarifa",
            queEs: "Precio al que el obrador o almacén central le sirve este producto a ese centro.",
            logica: "Vacío = se usa el coste medio. La tarifa también la puede recalcular Obrador → Tarifas.",
            influye: "Precio de las líneas de los pedidos de ese local, importe de los pedidos y el aviso a Contabilidad cuando se sirve.",
          },
          {
            nombre: "pedible",
            queEs: "Si está marcado, el local puede pedir este producto. Desmarcado, no le sale en «Nuevo pedido».",
          },
          {
            nombre: "Su sitio",
            queEs: "Almacén del centro donde entra el producto (compras, pedidos) y del que sale primero (ventas, pedidos servidos).",
            logica:
              "«Por familia» lo decide solo: cervezas, refrescos, aguas, zumos y cafetería van a la Barra (si no hay, a la Bodega); el resto (vinos, licores…) a la Bodega (si no hay, a la Barra). Solo sale si el centro tiene almacenes.",
          },
          { nombre: "Guardar", queEs: "Guarda los ajustes de ese producto en ese centro. Queda apuntado quién lo cambió." },
        ],
      },
      {
        titulo: "Registrar rotura o merma (dentro del detalle)",
        campos: [
          {
            nombre: "De dónde",
            queEs: "Centro y almacén del que se da de baja. Solo salen los sitios con stock, con lo que hay entre paréntesis.",
          },
          { nombre: "Cantidad", queEs: "Cuánto se pierde. Obligatoria y mayor que 0.", logica: "No se puede dar de baja más de lo que hay en ese sitio." },
          { nombre: "Motivo", queEs: "Obligatorio: rotura, caducidad, desperdicio, invitación, consumo de personal, error de cocina o barra u otro." },
          { nombre: "Nota (opcional)", queEs: "Explicación libre; se añade al motivo." },
          {
            nombre: "Dar de baja",
            queEs: "Resta el stock con un documento de merma (MER-…).",
            logica: "Crea un movimiento «Merma» en negativo valorado al coste medio del producto. No se puede deshacer desde aquí: si fue un error, se corrige con un inventario.",
            influye: "Baja el stock y el valor; sale en Movimientos con el tipo «Merma».",
          },
        ],
      },
    ],
    logica: [CENTROS_DEL_AREA, "En un local, un producto sin stock y sin mínimo propio no se enseña (no se controla allí). En obradores y almacenes salen todos."],
    influye: [
      { texto: "Historial de cada producto", ruta: "/bebidas/movimientos" },
      { texto: "La propuesta de compra usa mínimos y máximos", ruta: "/bebidas/compras/nueva" },
      { texto: "Los locales piden con la tarifa y «pedible»", ruta: "/bebidas/pedidos/nuevo" },
      { texto: "Tarifas del obrador", ruta: "/obrador/tarifas" },
      { texto: "Almacenes de cada centro", ruta: "/organizacion" },
    ],
  },

  // =========================================================================== PEDIDOS
  "/bebidas/pedidos": {
    titulo: "Pedidos de locales",
    area: AREA,
    paraQue:
      "Lista de lo que piden los locales al obrador o al almacén central. Desde aquí se abre cada pedido para servirlo, cambiarlo o confirmar lo recibido.",
    quien: "Permiso «Ver pedidos de bebida». El botón «Nuevo pedido» sale con «Pedir bebida al almacén».",
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
        titulo: "Tabla",
        campos: [
          { nombre: "Pedido", queEs: "Número (PL-…). Al pulsarlo se abre el pedido." },
          { nombre: "Pide", queEs: "Local que hace el pedido." },
          { nombre: "Sirve", queEs: "Obrador o almacén central que lo sirve." },
          { nombre: "Líneas", queEs: "Productos distintos del pedido." },
          {
            nombre: "Importe",
            queEs: "Lo que vale el pedido a precio de tarifa.",
            logica: "Antes de servir: cantidad pedida × precio. Servido: cantidad servida × precio. Recibido: lo servido más lo que llegó de más (lo que faltó sigue contando: salió del obrador). El precio es la tarifa del obrador para ese local o, si no hay, el coste medio.",
          },
          { nombre: "Fecha", queEs: "Día en que se hizo." },
          {
            nombre: "Estado",
            queEs:
              "Por servir (ámbar), Servido · por confirmar, Recibido, Rechazado o Cancelado. Las filas «Por servir» salen resaltadas.",
          },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Hecho / Servido", queEs: "Fecha y hora del pedido y de cuando se sirvió." },
          { nombre: "Albarán", queEs: "Albarán de salida (ALB-S-…) que se hace al servir." },
          { nombre: "Notas", queEs: "Notas del local, motivo de rechazo y nota de la recepción, si las hay." },
          { nombre: "Pedido · Servido · Recibido · Precio", queEs: "Por producto: lo que se pidió, lo que se mandó, lo que el local dijo que le llegó y el precio por unidad." },
          { nombre: "Abrir…", queEs: "Abre la ficha del pedido." },
        ],
      },
    ],
    logica: [
      "Salen los pedidos en los que el centro que pide o el que sirve es uno de los que ves (con el selector de centro de arriba). Se ven como mucho los 200 más recientes.",
      "Recorrido de un pedido: Por servir → (el obrador lo sirve) Servido · por confirmar → (el local confirma) Recibido. También puede acabar Rechazado (por el obrador) o Cancelado (por el local).",
    ],
    influye: [{ texto: "Hacer un pedido nuevo", ruta: "/bebidas/pedidos/nuevo" }],
  },

  "/bebidas/pedidos/nuevo": {
    titulo: "Nuevo pedido de bebida",
    area: AREA,
    paraQue: "Un local pide bebida al obrador o al almacén central. Se escriben solo las cantidades de lo que se necesita.",
    quien: "Permiso «Pedir bebida al almacén». Solo puede pedir un local que tú veas y que tenga activada el área de Bebidas.",
    secciones: [
      {
        titulo: "Paso 1: local que pide",
        campos: [
          {
            nombre: "Local que pide",
            queEs: "Para qué local es el pedido. Si solo ves un local, se elige solo.",
            logica: "No pueden pedir los obradores ni los almacenes centrales (son los que sirven). Si arriba tienes elegido un obrador, sale el aviso de que hay que elegir un local.",
          },
          { nombre: "Seguir", queEs: "Pasa a la lista de productos." },
        ],
      },
      {
        titulo: "Centro que sirve",
        campos: [
          {
            nombre: "Pedir a…",
            queEs: "Obrador o almacén central al que se pide. Solo sale si hay más de uno; si no, se usa el único.",
            logica: "Salen los obradores y almacenes centrales abiertos que tienen activada el área de Bebidas (un obrador que solo hace comida no sale aquí).",
          },
          { nombre: "Cambiar", queEs: "Vuelve a cargar la lista con lo que hay en el centro elegido." },
        ],
      },
      {
        titulo: "Lista de productos",
        campos: [
          ...SELECTOR_CANTIDADES,
          {
            nombre: "hay N / sin existencias",
            queEs: "Lo que tiene ahora el centro que sirve. Si pides más, sale el aviso «se servirá lo disponible».",
          },
          {
            nombre: "Precio de cada producto",
            queEs: "Tarifa del obrador para este local; si no tiene, el coste medio.",
          },
        ],
      },
      {
        titulo: "Final",
        campos: [
          { nombre: "Notas para el obrador (opcional)", queEs: "Cualquier aviso para quien sirve." },
          {
            nombre: "Enviar pedido",
            queEs: "Crea el pedido con número PL-… en estado «Por servir» y abre su ficha.",
            logica:
              "Hace falta al menos un producto con cantidad. Solo valen productos activos y marcados como «pedible» para ese local. El precio de cada línea se fija ahora con la tarifa del local. No mueve stock todavía.",
            influye: "Sale en «Pedidos por servir» del Resumen y de Pedidos del obrador.",
          },
        ],
      },
    ],
    logica: ["En la lista salen los productos activos de Bebidas que no estén desmarcados como «pedible» para ese local (se cambia en Stock)."],
    comoSeUsa: ["Elige el local, escribe las cantidades, revisa con «Solo lo elegido» y pulsa «Enviar pedido».", "Mientras no se sirva, el pedido se puede cambiar o cancelar desde su ficha."],
    influye: [{ texto: "Qué productos puede pedir cada local y a qué tarifa", ruta: "/bebidas/stock" }],
  },

  "/bebidas/pedidos/[id]": {
    titulo: "Ficha del pedido de local",
    area: AREA,
    paraQue:
      "Un pedido de un local al obrador. Según el estado y tus permisos, aquí se sirve (y se hace el albarán), se rechaza, se cambia, se cancela o se confirma lo que ha llegado.",
    quien:
      "Verla: «Ver pedidos de bebida» y ver el centro que pide o el que sirve. Servir y rechazar: «Servir pedidos de bebida» y ver el centro que sirve. Cambiar y cancelar: «Pedir bebida al almacén» y ver el local. Confirmar: «Confirmar la recepción de pedidos de bebida en el local» y ver el local.",
    secciones: [
      {
        titulo: "Datos del pedido",
        campos: [
          { nombre: "Estado", queEs: "Por servir, Servido · por confirmar, Recibido, Rechazado o Cancelado." },
          { nombre: "Importe", queEs: "Antes de servir: pedido × precio. Servido: servido × precio. Recibido: lo servido más lo que llegó de más, × precio." },
          { nombre: "Albarán de salida", queEs: "Número ALB-S-… que se crea al servir." },
          {
            nombre: "Factura entre sociedades",
            queEs: "Solo con Contabilidad contratada: en qué factura del obrador va el pedido (y su espejo en el local), «Pendiente de facturar» si ya está recibido y aún no se ha facturado, «Se factura cuando el local confirme la recepción», o «Sin factura» si el obrador y el local son de la misma sociedad (traspaso interno).",
            logica: "Las facturas se preparan en Contabilidad → Facturas emitidas → Facturar pedidos del obrador: una por local y mes con los pedidos recibidos.",
          },
          { nombre: "Servido", queEs: "Fecha y hora en que se sirvió." },
          { nombre: "Notas", queEs: "Notas del local, motivo de rechazo y nota de la recepción." },
        ],
      },
      {
        titulo: "Servir (lo ve el obrador con el pedido «Por servir»)",
        campos: [
          { nombre: "Pedido", queEs: "Cantidad que pidió el local." },
          { nombre: "Hay", queEs: "Lo que tiene ahora todo el centro que sirve. En ámbar si es menos de lo pedido." },
          {
            nombre: "Servir",
            queEs: "Cuánto se manda. Viene propuesto: lo pedido, sin pasar de lo que hay.",
            logica: "Si escribes más de lo que hay, se recorta solo a lo disponible y el mensaje final dice cuántas líneas se ajustaron.",
          },
          {
            nombre: "Sale de",
            queEs: "Almacén del que sale. «Cada producto de su almacén» = sale de su sitio y, si no basta, de los demás almacenes del centro.",
            logica: "Si eliges un almacén, solo se sirve lo que hay en él. En el local, la bebida entra en el almacén de cada producto.",
          },
          {
            nombre: "Servir y hacer albarán",
            queEs: "Manda la mercancía: pone el pedido en «Servido · por confirmar» y crea el albarán ALB-S-….",
            logica:
              "Por cada línea con cantidad crea dos movimientos: «Salida a local» (resta en el obrador) y «Entrada de pedido» (suma en el local), los dos valorados al coste medio del producto (uno solo para toda la cadena). El importe del pedido (la venta del obrador al local) se calcula con la tarifa; la tarifa no cambia el coste del producto en el local. Si no queda nada que servir, no deja: hay que rechazarlo.",
            influye:
              "Stock del obrador y del local; Cuadro de mando (la mercancía de cada centro: lo recibido suma y lo servido a otro centro resta) y aviso a Contabilidad para la venta del obrador entre sociedades.",
          },
          { nombre: "Motivo del rechazo", queEs: "Obligatorio para rechazar. Lo verá el local en las notas." },
          { nombre: "Rechazar pedido", queEs: "Deja el pedido en «Rechazado» sin mover stock. No se puede deshacer." },
        ],
      },
      {
        titulo: "Confirmar lo recibido (lo ve el local con el pedido servido)",
        campos: [
          { nombre: "Pedido / Servido", queEs: "Lo que pidió y lo que le mandaron." },
          {
            nombre: "Recibido",
            queEs: "Lo que ha llegado de verdad. Viene puesto lo servido.",
            logica:
              "Si llega MENOS de lo servido, lo que falta se da de baja en el local como merma (movimiento «Merma» con el motivo «Falta al recibir…» y la nota): salió del obrador y no ha llegado, así la pérdida se ve en las mermas. Si llega MÁS, la diferencia sale también del obrador («Salida a local») y entra en el local («Entrada de pedido»): el obrador mandó más de lo apuntado. Todo al coste medio.",
          },
          { nombre: "Nota sobre la recepción", queEs: "Por ejemplo «2 botellas rotas». Se guarda en las notas del pedido y en el motivo de la merma o de la sobra." },
          {
            nombre: "Confirmar recepción",
            queEs: "Pone el pedido en «Recibido». Es el último paso; no se puede deshacer.",
            influye: "Stock del local (y del obrador si llegó de más); mermas del local si faltó algo; importe del pedido si llegó de más.",
          },
        ],
      },
      {
        titulo: "Líneas (cuando no se puede hacer nada más)",
        campos: [
          { nombre: "Producto, Pedido, Servido, Recibido, Precio", queEs: "Resumen de cada línea. Si falta un paso de otra persona, debajo lo dice (por ejemplo «Pendiente de que lo sirva…»)." },
        ],
      },
      {
        titulo: "Cambiar el pedido (lo ve el local mientras está «Por servir»)",
        campos: [
          ...SELECTOR_CANTIDADES,
          { nombre: "Notas", queEs: "Notas del pedido." },
          {
            nombre: "Guardar cambios",
            queEs: "Cambia las cantidades; poner 0 o vaciar quita la línea.",
            logica: "Los precios se vuelven a poner con la tarifa de ese momento. Queda apuntado el antes y el después.",
          },
          { nombre: "Cancelar el pedido", queEs: "Deja el pedido en «Cancelado». Solo mientras no se ha servido; no se puede deshacer." },
        ],
      },
    ],
    influye: [
      { texto: "Stock del obrador y del local", ruta: "/bebidas/stock" },
      { texto: "Movimientos del albarán", ruta: "/bebidas/movimientos" },
      { texto: "Mercancía en el cuadro de mando", ruta: "/cuadro" },
    ],
  },

  // =========================================================================== COMPRAS
  "/bebidas/compras": {
    titulo: "Compras de bebida",
    area: AREA,
    paraQue: "Pedidos a proveedores de bebida. Una compra solo suma stock cuando se recibe la mercancía.",
    quien: "Permiso «Ver compras de bebida». El botón «Nueva compra» sale con «Pedir a proveedores de bebida».",
    secciones: [
      {
        titulo: "Filtro",
        campos: [
          {
            nombre: "Estado",
            queEs: "Todas, Por recibir (enviadas y recibidas en parte: lo que aún puede llegar), Sin enviar, Enviadas por recibir, Recibidas en parte, Recibidas o Canceladas.",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Compra", queEs: "Número (PC-…). Al pulsarlo se abre." },
          { nombre: "Proveedor", queEs: "A quién se compra." },
          { nombre: "Recibe", queEs: "Centro donde se recibe la mercancía." },
          { nombre: "Líneas", queEs: "Productos distintos." },
          {
            nombre: "Importe",
            queEs: "Valor de la compra.",
            logica:
              "Sin recibir: cantidad pedida × precio de cada línea. Recibida (en parte o del todo): cantidad RECIBIDA × precio, donde el precio de la línea es el medio de lo recibido (si llegó en dos entregas a precios distintos, la media de las dos).",
          },
          { nombre: "Fecha", queEs: "Día en que se preparó." },
          { nombre: "Estado", queEs: "Sin enviar, Enviada · por recibir, Recibida en parte, Recibida o Cancelada." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Enviada", queEs: "Cuándo y cómo se envió (WhatsApp, correo o teléfono)." },
          { nombre: "Recibida", queEs: "Fecha de la última recepción." },
          { nombre: "Albaranes de entrada", queEs: "Números ALB-E-… de cada recepción (una compra puede tener varios)." },
          { nombre: "Notas", queEs: "Notas de la compra y número del albarán del proveedor." },
          { nombre: "Pedido · Recibido · Precio", queEs: "Por producto: lo pedido, lo recibido hasta ahora y el precio por unidad." },
          { nombre: "Abrir…", queEs: "Abre la ficha de la compra para enviarla o recibirla." },
        ],
      },
    ],
    logica: [
      "Salen las compras de los centros que ves (como mucho, las 200 más recientes).",
      "Recorrido: Sin enviar → Enviada · por recibir → Recibida en parte → Recibida. Se puede cancelar mientras no se ha recibido nada; una recibida en parte se cierra sin lo que falta desde su ficha.",
    ],
    influye: [
      { texto: "Nueva compra", ruta: "/bebidas/compras/nueva" },
      { texto: "Las facturas de proveedor se cruzan con las compras recibidas", ruta: "/contabilidad/recibidas" },
    ],
  },

  "/bebidas/compras/nueva": {
    titulo: "Nueva compra de bebida",
    area: AREA,
    paraQue: "Prepara un pedido a un proveedor: a quién, dónde se recibe y qué cantidades. Después se envía desde su ficha.",
    quien: "Permiso «Pedir a proveedores de bebida».",
    secciones: [
      {
        titulo: "Paso 1: proveedor y centro",
        campos: [
          {
            nombre: "Proveedor",
            queEs: "A quién se compra.",
            logica: "Salen los proveedores activos que tienen marcada el área de Bebidas o que no tienen ningún área marcada. Si no hay ninguno, sale un enlace para dar de alta uno.",
          },
          {
            nombre: "Centro que recibe",
            queEs: "Dónde llega la mercancía. Viene propuesto el primer obrador o almacén que veas.",
            logica: "Solo centros con el área de Bebidas activa. Si solo ves uno, se elige solo.",
          },
          { nombre: "Seguir", queEs: "Pasa a la lista de productos." },
        ],
      },
      {
        titulo: "Botones de arriba",
        campos: [
          { nombre: "Ver todos los productos del área / Ver solo los productos de este proveedor", queEs: "Por defecto salen solo los productos que tienen a este proveedor como habitual; con el botón, todos los de Bebidas." },
          {
            nombre: "Rellenar con lo que está bajo mínimo",
            queEs: "Pone sola la cantidad de lo que en el centro que recibe está por debajo de su mínimo.",
            logica:
              "Cantidad propuesta = máximo del centro − stock (o mínimo − stock si no hay máximo), redondeado hacia arriba a formatos de compra completos («Unidades por formato de compra» del producto: con cajas de 6, si faltan 7 se proponen 12). Mínimo: el del centro en Stock; si no hay, en obradores y almacenes el mínimo general del producto. Si no hay nada bajo mínimo, lo avisa.",
          },
          { nombre: "Cambiar proveedor", queEs: "Vuelve al paso 1." },
        ],
      },
      {
        titulo: "Lista de productos",
        campos: [
          ...SELECTOR_CANTIDADES,
          {
            nombre: "€/ud",
            queEs: "Precio por unidad de stock. Viene el coste medio actual; cámbialo si el proveedor tiene otro.",
            logica: "No puede ser negativo. Es el precio del pedido; el definitivo se pone al recibir.",
          },
        ],
      },
      {
        titulo: "Final",
        campos: [
          { nombre: "Notas para el proveedor (opcional)", queEs: "Salen en el mensaje de WhatsApp (por ejemplo, la hora de entrega)." },
          {
            nombre: "Preparar compra",
            queEs: "Crea la compra con número PC-… en estado «Sin enviar» y abre su ficha.",
            logica: "Necesita al menos una línea con cantidad y un proveedor activo. No suma stock.",
          },
        ],
      },
    ],
    influye: [{ texto: "Mínimos y máximos de cada centro", ruta: "/bebidas/stock" }, { texto: "Proveedores y sus teléfonos", ruta: "/proveedores" }],
  },

  "/bebidas/compras/[id]": {
    titulo: "Ficha de la compra",
    area: AREA,
    paraQue:
      "Una compra a proveedor: aquí se envía por WhatsApp, se apunta cómo se envió, se recibe la mercancía (lo que suma stock y recalcula el coste) y, mientras no llega, se cambia o se cancela.",
    quien:
      "Verla: «Ver compras de bebida» y ver el centro que recibe. Enviar, cambiar y cancelar: «Pedir a proveedores de bebida». Recibir: «Recepcionar compras de bebida».",
    secciones: [
      {
        titulo: "Datos de la compra",
        campos: [
          { nombre: "Estado", queEs: "Sin enviar, Enviada · por recibir, Recibida en parte, Recibida o Cancelada." },
          {
            nombre: "Importe / Importe recibido e Importe pedido",
            queEs: "Sin recibir: lo pedido × precio. Ya recibida (en parte o del todo): «Importe recibido» = lo recibido × precio medio de lo recibido, e «Importe pedido» = lo pedido × ese precio.",
          },
          { nombre: "Enviada", queEs: "Cuándo y por qué vía." },
          { nombre: "Albaranes de entrada", queEs: "ALB-E-… de cada recepción." },
          { nombre: "Factura del proveedor", queEs: "Solo con Contabilidad contratada y la compra recibida: en qué factura recibida está este albarán, o «Sin facturar todavía». Un albarán solo puede estar en una factura." },
          { nombre: "Contacto, Correo, Días de reparto, Pedido mínimo", queEs: "Datos del proveedor (se cambian en Proveedores)." },
          { nombre: "Aviso de pedido mínimo", queEs: "Sale mientras la compra no se ha recibido si el importe no llega al pedido mínimo del proveedor. Es solo un aviso: deja seguir." },
        ],
      },
      {
        titulo: "Enviar al proveedor (sin enviar o enviada)",
        campos: [
          {
            nombre: "Texto del pedido",
            queEs: "Mensaje ya escrito: saludo al contacto, número de compra, centro, cada producto con cantidad y referencia, y las notas.",
            logica: "Si el producto tiene «Unidades por formato de compra» mayor que 1, al lado de la cantidad sale en formatos: 14 botellas con 6 por caja → «(2 × 6 + 2)».",
          },
          {
            nombre: "Abrir WhatsApp con el pedido",
            queEs: "Abre WhatsApp con el mensaje escrito para el teléfono del proveedor. Hay que darle a enviar en WhatsApp.",
            logica: "Solo sale si el teléfono del proveedor está en formato internacional (+34…). Si no, sale un aviso para corregirlo en Proveedores.",
          },
          { nombre: "Enviado por…", queEs: "Cómo se ha mandado: WhatsApp, correo o teléfono." },
          {
            nombre: "Marcar como enviada / Cambiar cómo se envió",
            queEs: "Pone la compra en «Enviada · por recibir» con la fecha y la vía. Abrir WhatsApp no la marca solo.",
          },
        ],
      },
      {
        titulo: "Recibir mercancía (enviada, sin enviar o recibida en parte)",
        campos: [
          { nombre: "Pedido", queEs: "Lo que se pidió (y en formatos de compra si el producto los tiene, por ejemplo «(2 × 6)»)." },
          { nombre: "Ya recibido", queEs: "Lo recibido en recepciones anteriores." },
          { nombre: "Llega ahora", queEs: "Lo que llega en esta entrega. Viene lo que falta; vacío o 0 = no ha llegado." },
          { nombre: "€/ud", queEs: "Precio real del albarán por unidad. Viene el precio de la compra." },
          { nombre: "Número del albarán del proveedor", queEs: "Opcional. Se guarda en las notas y en el motivo de los movimientos." },
          {
            nombre: "Entra en",
            queEs: "Almacén del centro donde entra todo. «Cada producto en su almacén» = cada uno a su sitio. Solo sale si el centro tiene almacenes.",
          },
          {
            nombre: "Cerrar la compra aunque falte algo",
            queEs: "Marca la compra como «Recibida» aunque no haya llegado todo: lo que falta ya no se espera.",
            logica: "En una compra «Recibida en parte» sirve también sin que llegue nada en esta entrega (deja todo a 0 y marca la casilla).",
          },
          {
            nombre: "Guardar recepción",
            queEs: "Suma al stock lo que ha llegado y crea el albarán de entrada ALB-E-….",
            logica:
              "Cada producto recibido genera un movimiento «Entrada de compra» al precio del albarán. Coste medio nuevo = (stock de toda la cadena × coste actual + recibido × precio) ÷ (stock + recibido); si el stock era 0 o negativo, o el producto no tenía coste, el coste nuevo es el precio de esta compra. Si el coste cambia, se recalculan solas las tarifas del obrador «A coste» y «Coste + %» de ese producto. Solo cambia el precio de las líneas que reciben algo: su €/ud pasa a ser el precio medio de todo lo recibido de esa línea; las que no reciben nada conservan el suyo. Si falta algo y no marcas «Cerrar», queda «Recibida en parte» y se puede recibir otra vez. Hay que recibir al menos una unidad (salvo para cerrar una compra recibida en parte).",
            influye:
              "Stock y valor del stock; coste medio del producto (y con él el coste de la carta, el % de coste de la Bodega, los mínimos valorados y los inventarios); tarifas del obrador a los locales que van a coste; Cuadro de mando (mercancía comprada) y cruce con la factura del proveedor en Contabilidad.",
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
        titulo: "Líneas (compras recibidas o canceladas, o sin permiso de recibir)",
        campos: [{ nombre: "Producto, Pedido, Recibido, €/ud, Importe", queEs: "Resumen de cada línea. Importe = recibido × precio si la compra está recibida (en parte o del todo); si no, pedido × precio." }],
      },
      {
        titulo: "Cambiar la compra (sin enviar o enviada)",
        campos: [
          ...SELECTOR_CANTIDADES,
          { nombre: "€/ud", queEs: "Precio por unidad de cada producto." },
          { nombre: "Notas", queEs: "Notas de la compra." },
          { nombre: "Guardar cambios", queEs: "Rehace las líneas con lo escrito. Salen los productos de este proveedor y los que ya estaban en la compra." },
          { nombre: "Cancelar la compra", queEs: "La deja «Cancelada». Solo si no se ha recibido nada; no se puede deshacer." },
        ],
      },
    ],
    influye: [
      { texto: "Stock y coste medio", ruta: "/bebidas/stock" },
      { texto: "Movimientos «Entrada de compra»", ruta: "/bebidas/movimientos" },
      { texto: "Facturas de proveedor", ruta: "/contabilidad/recibidas" },
      { texto: "Mercancía en el cuadro de mando", ruta: "/cuadro" },
    ],
  },

  // =========================================================================== INVENTARIOS
  "/bebidas/inventarios": {
    titulo: "Inventarios de bebida",
    area: AREA,
    paraQue:
      "Contar lo que hay de verdad en un centro (o en un solo almacén, como la Barra) y ajustar el stock a lo contado. Se cuenta a ciegas: quien cuenta no ve lo que debería haber.",
    quien: "Ver: «Ver inventarios de bebida». Empezar y contar: «Hacer inventarios de bebida». Aprobar los de descuadre grande: «Cerrar inventarios de bebida».",
    secciones: [
      {
        titulo: "Empezar inventario",
        campos: [
          {
            nombre: "Qué se cuenta",
            queEs: "Un centro entero («todos los almacenes») o solo un almacén de un centro («solo Barra»).",
            logica:
              "Al empezar se guarda lo que debería haber (stock teórico) y el coste medio de ese momento. En un local salen los productos con stock o con mínimo propio; en obrador y almacén, todos los activos. Si es de un almacén, salen los que tienen stock allí o lo tienen como su sitio. No puede haber dos inventarios sin cerrar del mismo almacén, ni uno del centro y otro de un almacén a la vez: si uno se quedó a medias, se cancela desde su ficha.",
          },
          { nombre: "Nombre", queEs: "Viene «Semana N · año» (semana de hoy en Madrid). Si es de un almacén, se le pone delante el nombre del almacén." },
          { nombre: "Empezar a contar", queEs: "Crea el inventario INV-… «Contando» y abre la pantalla de recuento." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Inventario", queEs: "Nombre; al pulsarlo se abre." },
          { nombre: "Centro · almacén", queEs: "Dónde se cuenta («· todo» = el centro entero)." },
          { nombre: "Contadas", queEs: "Líneas contadas de todas las del inventario." },
          {
            nombre: "Diferencia",
            queEs: "Lo que sobra (verde) o falta (rojo) en euros. Mientras se cuenta pone «a ciegas»; en uno cancelado, «—».",
            logica: "Suma de (contado − teórico) × coste de las líneas contadas. Solo se enseña cuando el recuento ha terminado (pendiente de aprobación o cerrado), para que nadie cuente mirando el descuadre.",
          },
          { nombre: "Fecha", queEs: "Día en que se empezó." },
          { nombre: "Estado", queEs: "Contando, Pendiente de aprobación, Cerrado o Cancelado." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Número, Abierto, Cerrado (o Cancelado)", queEs: "Número INV-… y fechas." },
          { nombre: "Diferencias", queEs: "Mientras se cuenta o si está cancelado, en vez de las cifras de abajo sale por qué no se ven." },
          { nombre: "Líneas con diferencia", queEs: "Productos contados que no cuadran." },
          { nombre: "Diferencia en unidades", queEs: "Suma con signo de lo que sobra y falta." },
          { nombre: "Diferencia en €", queEs: "Suma con signo: lo que sobra resta a lo que falta." },
          {
            nombre: "Descuadre (suma sin signo)",
            queEs: "Suma de todas las diferencias en euros como si fueran positivas.",
            logica: "Si pasa de 500 €, el inventario necesita aprobación para cerrarse.",
          },
          { nombre: "Seguir contando / Ver inventario", queEs: "Abre el inventario." },
        ],
      },
    ],
    logica: ["Se ven los 100 inventarios más recientes de los centros que ves.", "Las líneas que se dejan sin contar no se ajustan."],
  },

  "/bebidas/inventarios/[id]": {
    titulo: "Recuento de inventario",
    area: AREA,
    paraQue: "Pantalla para contar desde el móvil, terminar el inventario y, si el descuadre es grande, aprobarlo o devolverlo a recuento.",
    quien:
      "Verla: «Ver inventarios de bebida» y ver el centro. Contar, terminar y cancelar uno que se está contando: «Hacer inventarios de bebida». Ver las diferencias de uno pendiente, aprobar, devolver a recuento y cancelar uno pendiente: «Cerrar inventarios de bebida».",
    secciones: [
      {
        titulo: "Cabecera y avisos",
        campos: [
          { nombre: "Estado y «N de M contadas»", queEs: "Cómo va el inventario." },
          {
            nombre: "Aviso de movimientos desde que se abrió",
            queEs: "Sale si ha habido movimientos de stock en ese centro (o almacén) después de empezar.",
            logica:
              "El ajuste se calcula contra el stock del momento de abrir. Lo que se haya vendido, recibido o servido después no está en el teórico: o cuentas lo que había entonces o empiezas otro inventario.",
          },
        ],
      },
      {
        titulo: "Recuento (inventario «Contando»)",
        campos: [
          { nombre: "Buscar producto o referencia", queEs: "Filtra la lista." },
          { nombre: "Contadas N de M y barra", queEs: "Avance del recuento." },
          { nombre: "Solo sin contar", queEs: "Deja solo los productos con la casilla vacía." },
          {
            nombre: "Casilla de cada producto, − y +",
            queEs: "Lo que hay contado, en la unidad del producto. Los botones restan o suman 1.",
            logica: "Vacía = sin contar (no se ajusta). 0 = contado y no hay ninguno. No admite negativos.",
          },
          { nombre: "Guardar recuento", queEs: "Guarda lo contado; se puede guardar las veces que haga falta. No mueve stock." },
          {
            nombre: "Guardar y terminar",
            queEs: "Guarda y cierra el recuento.",
            logica:
              "Si el descuadre sin signo pasa de 500 €, queda «Pendiente de aprobación». Si no, se cierra: por cada línea contada con diferencia crea un movimiento «Ajuste de inventario» (contado − teórico) al coste guardado al abrir. En un inventario de un almacén el ajuste va a ese almacén; en uno de todo el centro, lo sobrante entra en el sitio de cada producto y lo que falta sale primero de su sitio. Hace falta haber contado al menos una línea.",
            influye: "Stock y valor del stock; Movimientos con el tipo «Ajuste de inventario».",
          },
        ],
      },
      {
        titulo: "Cifras y diferencias (pendiente de aprobación con permiso de cerrar, o ya cerrado)",
        campos: [
          { nombre: "Diferencia", queEs: "Suma con signo en euros de lo que sobra y falta." },
          { nombre: "Descuadre sin signo", queEs: "Suma de las diferencias en euros sin signo. En ámbar si pasa de 500 €." },
          { nombre: "Líneas con diferencia", queEs: "Productos que no cuadran." },
          { nombre: "Unidades", queEs: "Suma con signo de las diferencias en unidades." },
          {
            nombre: "Tabla de diferencias",
            queEs: "Teórico, Contado, Diferencia (contado − teórico) y € (diferencia × coste) de cada producto que no cuadra, de mayor a menor importe.",
          },
        ],
      },
      {
        titulo: "Aprobación (pendiente de aprobación)",
        campos: [
          { nombre: "Aprobar y cerrar", queEs: "Cierra el inventario y hace los ajustes de stock igual que «Guardar y terminar». No se puede deshacer." },
          { nombre: "Devolver a recuento", queEs: "Lo vuelve a «Contando» para revisar las líneas con más diferencia. No mueve stock." },
        ],
      },
      {
        titulo: "Cancelar el inventario (contando o pendiente de aprobación)",
        campos: [
          { nombre: "Motivo", queEs: "Opcional: por qué se cancela (se empezó mal, hay que repetirlo…). Queda en el registro de cambios." },
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
      "Un inventario cerrado no se puede reabrir ni anular.",
      "El teórico y el coste de cada línea se fijan al empezar el inventario.",
    ],
    influye: [
      { texto: "Stock ajustado a lo contado", ruta: "/bebidas/stock" },
      { texto: "Movimientos de ajuste", ruta: "/bebidas/movimientos" },
    ],
  },

  // =========================================================================== TRASPASOS
  "/bebidas/traspasos": {
    titulo: "Traspasos entre almacenes",
    area: AREA,
    paraQue: "Pasar bebida de un almacén a otro del mismo centro (por ejemplo, de la Bodega a la Barra al reponer). El stock total del centro no cambia.",
    quien: "Ver la lista: «Ver stock de bebidas». Hacer traspasos: «Pasar bebida de un almacén a otro del mismo centro».",
    secciones: [
      {
        titulo: "Nuevo traspaso: elegir",
        campos: [
          {
            nombre: "Centro",
            queEs: "Centro donde se traspasa. Solo salen centros con almacenes (y el selector solo si hay más de uno).",
            logica: "Viene propuesto el elegido arriba o el primer local.",
          },
          {
            nombre: "De",
            queEs: "Almacén del que sale, o «Sin ubicar». Viene la Bodega si existe (en un centro con un solo almacén, «Sin ubicar»).",
            logica: "«Sin ubicar» es el stock del centro que no está en ningún almacén (lo que entró antes de que el centro tuviera almacenes): así se coloca en su sitio.",
          },
          { nombre: "A", queEs: "Almacén al que entra. Viene la Barra si existe." },
          { nombre: "Ver productos", queEs: "Carga la lista de lo que hay en el almacén de origen." },
        ],
      },
      {
        titulo: "Nuevo traspaso: productos",
        campos: [
          ...SELECTOR_CANTIDADES,
          { nombre: "hay N", queEs: "Lo que queda en el almacén de origen. En el nombre se ve también lo que ya hay en el destino." },
          {
            nombre: "Cantidades propuestas",
            queEs: "Algunas vienen rellenas para reponer.",
            logica:
              "Solo si el destino es el sitio del producto y el centro tiene máximo (o mínimo) puesto en Stock: propuesta = máximo (o mínimo) − lo que hay en destino, sin pasar de lo que hay en origen.",
          },
          { nombre: "Nota (opcional)", queEs: "Se añade al motivo del traspaso." },
          {
            nombre: "Hacer traspaso",
            queEs: "Mueve las cantidades con un documento TRA-….",
            logica: "Por cada producto: un movimiento «Traspaso» en negativo en el origen y otro en positivo en el destino, al coste medio. No deja pasar más de lo que hay en el origen.",
            influye: "Stock por almacén (en Stock y en el recuento de inventarios de un almacén). No cambia el valor ni el stock del centro.",
          },
        ],
      },
      {
        titulo: "Traspasos hechos",
        campos: [
          { nombre: "Traspaso", queEs: "Número TRA-…." },
          { nombre: "Fecha, Centro", queEs: "Cuándo y dónde." },
          { nombre: "De → a", queEs: "Almacén de origen y de destino." },
          { nombre: "Productos", queEs: "Productos distintos traspasados." },
          { nombre: "Valor", queEs: "Suma de cantidad × coste medio de lo traspasado." },
          { nombre: "Detalle: Motivo, Usuario, cantidades", queEs: "Nota, quién lo hizo y cuánto de cada producto." },
        ],
      },
    ],
    logica: ["Se ven los 50 traspasos más recientes de los centros que ves.", "Un traspaso no se puede deshacer: si te equivocas, haz otro al revés."],
    influye: [{ texto: "Stock por almacén", ruta: "/bebidas/stock" }],
  },

  // =========================================================================== MOVIMIENTOS
  "/bebidas/movimientos": {
    titulo: "Movimientos de bebida",
    area: AREA,
    paraQue: "Historial de todo lo que entra y sale de stock: compras, pedidos, ventas en caja, mermas, inventarios y traspasos, con quién, cuándo y por qué. Es la base del stock: el stock es la suma de estos movimientos.",
    quien: "Permiso «Ver stock de bebidas». Es solo para mirar: aquí no se cambia nada.",
    secciones: [
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar producto o referencia", queEs: "Filtra por nombre o referencia del producto." },
          {
            nombre: "Todos los tipos",
            queEs: "Deja un tipo: Entrada de compra, Salida a local, Entrada de pedido, Consumo en producción, Entrada de producción, Merma, Ajuste de inventario, Consumo del local, Venta en caja, Carga inicial o Traspaso entre almacenes.",
          },
          { nombre: "Todos los almacenes", queEs: "Deja un almacén por nombre, o «Sin ubicar»." },
          { nombre: "Desde / Hasta", queEs: "Fechas, las dos incluidas.", logica: "Días de Madrid: «desde» empieza a las 00:00 y «hasta» acaba a las 24:00, hora de Madrid (en verano y en invierno)." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
          {
            nombre: "Solo un producto",
            queEs: "Si vienes de «Ver movimientos» en Stock, el subtítulo dice «Solo …» y se mantiene ese producto al filtrar.",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Fecha", queEs: "Día y hora del movimiento. Los más recientes primero." },
          { nombre: "Producto", queEs: "Producto que se mueve." },
          { nombre: "Centro · almacén", queEs: "Dónde. «sin ubicar» = sin almacén (movimientos antiguos)." },
          { nombre: "Tipo", queEs: "Qué ha pasado (ver los tipos en el filtro)." },
          { nombre: "Cantidad", queEs: "En verde con + si entra; en rojo si sale." },
          { nombre: "Documento", queEs: "Papel que lo justifica: ALB-E (compra), ALB-S (pedido), MER (merma), INV (inventario), TRA (traspaso), ticket…" },
          {
            nombre: "Valor",
            queEs: "Cantidad × coste unitario guardado en el movimiento.",
            logica: "En las compras es el precio del albarán; en el resto, el coste medio del producto en ese momento.",
          },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Producto, Centro, Almacén, Cantidad", queEs: "Datos completos del movimiento." },
          { nombre: "Coste unitario", queEs: "Coste por unidad con el que se valoró." },
          { nombre: "Documento, Motivo", queEs: "Número del documento y explicación (compra y albarán del proveedor, pedido, motivo de la merma…)." },
          { nombre: "Usuario", queEs: "Quién lo hizo. «Sistema» si fue automático (por ejemplo, ventas importadas)." },
        ],
      },
    ],
    logica: [CENTROS_DEL_AREA, "Se ven como mucho los 300 últimos movimientos con el filtro puesto.", "Los movimientos no se borran ni se cambian: los errores se corrigen con otro movimiento (un inventario, una merma…)."],
    influye: [{ texto: "El stock es la suma de estos movimientos", ruta: "/bebidas/stock" }],
  },

  // =========================================================================== PRODUCTOS
  "/bebidas/productos": {
    titulo: "Productos de bebida",
    area: AREA,
    paraQue: "Catálogo de bebidas: alta, cambios y baja (desactivar). Un producto con historial nunca se borra, se desactiva.",
    quien: "Ver: «Ver productos de bebida». Dar de alta, cambiar y desactivar: «Crear y editar productos de bebida».",
    secciones: [
      {
        titulo: "Aviso de costes",
        campos: [
          {
            nombre: "Productos activos con coste 0",
            queEs: "Sale si hay productos con coste 0 sin estar marcados como «sin coste». Esas filas salen en ámbar.",
            influye: "Con coste 0 el valor del stock, las mermas, los inventarios y el coste de la carta salen más bajos de lo real.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar por nombre, referencia o código de barras", queEs: "Busca el texto en esos datos." },
          { nombre: "Todas las familias", queEs: "Deja una familia." },
          { nombre: "Ver desactivados", queEs: "Añade los productos dados de baja (salen tachados)." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Referencia", queEs: "Código interno, único en toda la cadena." },
          { nombre: "Producto", queEs: "Nombre." },
          { nombre: "Familia, Proveedor", queEs: "Grupo y proveedor habitual." },
          { nombre: "Coste", queEs: "Coste medio por unidad de stock, o «Sin coste»." },
          { nombre: "Estado", queEs: "Activo o Desactivado." },
        ],
      },
      {
        titulo: "Detalle y formulario de cambio (al abrir la fila)",
        campos: [
          { nombre: "Unidad, Por formato de compra, IVA, Mínimo general", queEs: "Datos que no salen en la fila." },
          { nombre: "Por qué no tiene coste", queEs: "Solo en los marcados «Sin coste»: el motivo guardado." },
          { nombre: "Referencia", queEs: "Obligatoria. No puede repetirse con otro producto." },
          { nombre: "Nombre", queEs: "Obligatorio (al menos 2 letras)." },
          { nombre: "Familia", queEs: "Grupo del producto.", influye: "Decide a qué almacén va si no se elige otro (vinos a la Bodega, cervezas y refrescos a la Barra) y si sale en la Bodega (familias de vino)." },
          { nombre: "O familia nueva", queEs: "Si la escribes, se crea (o se usa la que ya tenga ese nombre) y manda sobre la elegida." },
          { nombre: "Proveedor habitual", queEs: "A quién se compra normalmente.", influye: "En «Nueva compra» salen por defecto los productos de ese proveedor; en Stock y Resumen se enseña." },
          { nombre: "Unidad de stock", queEs: "Cómo se cuenta: botellas, unidades, litros, cajas, latas, barriles…", influye: "Todas las cantidades (stock, pedidos, compras, inventarios, escandallos) van en esta unidad." },
          {
            nombre: "Unidades por formato de compra",
            queEs: "Por ejemplo, 6 botellas por caja. Mínimo 0,001.",
            logica: "Las compras se piden en la unidad de stock, pero «Rellenar con lo que está bajo mínimo» redondea hacia arriba a cajas completas (faltan 7 con cajas de 6 → 12) y el texto del pedido al proveedor dice cuántas cajas son («14 bot. (2 × 6 + 2)»).",
          },
          {
            nombre: "Coste por unidad (€)",
            queEs: "Coste medio. Obligatorio salvo que se marque «Sin coste».",
            logica: "Se recalcula solo al recibir compras. Si lo cambias a mano, queda apuntado como cambio de coste.",
            influye: "Valor del stock, valor de mermas e inventarios, coste de la carta y % de coste de la Bodega.",
          },
          { nombre: "IVA", queEs: "0, 4, 10 o 21 %." },
          { nombre: "Mínimo general", queEs: "Mínimo en obradores y almacenes. En cada local se pone en Stock." },
          { nombre: "Código de barras", queEs: "Opcional; sirve para buscar." },
          {
            nombre: "Sin coste (muestra, regalo…) y motivo",
            queEs: "Para productos que de verdad no cuestan nada. El motivo es obligatorio y se guarda en el producto (sale en la casilla y en el detalle).",
            logica: "Si se quita la marca, el motivo se borra. Al recibir una compra con precio, el producto deja de estar «sin coste» solo.",
          },
          { nombre: "Guardar cambios", queEs: "Guarda el producto. Queda apuntado quién lo cambió y qué había antes." },
          {
            nombre: "Desactivar / Volver a activar",
            queEs: "Da de baja el producto o lo recupera. Sus movimientos se conservan.",
            influye: "Un producto desactivado no se puede pedir ni comprar, no sale en inventarios nuevos (salvo que tenga stock) y en Stock solo sale si aún tiene existencias.",
          },
        ],
      },
      {
        titulo: "Importar BODEGA 360",
        campos: [{ nombre: "Hueco de integración", queEs: "Conexión pendiente que traerá los productos y proveedores de la aplicación actual. Hoy no hace nada." }],
      },
    ],
    influye: [
      { texto: "Mínimos y almacén de cada centro", ruta: "/bebidas/stock" },
      { texto: "Ficha de vino (D.O., añada, capacidad)", ruta: "/bebidas/bodega" },
    ],
  },

  "/bebidas/productos/nuevo": {
    titulo: "Nuevo producto de bebida",
    area: AREA,
    paraQue: "Dar de alta una bebida en el catálogo. El stock no se escribe aquí: entra con compras, pedidos o inventarios.",
    quien: "Permiso «Crear y editar productos de bebida».",
    secciones: [
      {
        titulo: "Formulario",
        campos: [
          { nombre: "Referencia", queEs: "Código interno. Obligatoria y única en toda la cadena." },
          { nombre: "Nombre", queEs: "Obligatorio (al menos 2 letras)." },
          { nombre: "Familia", queEs: "Grupo (tintos, cervezas…).", influye: "Decide el almacén por defecto y si sale en la Bodega." },
          { nombre: "O familia nueva", queEs: "Si la escribes, se crea y se usa en vez de la elegida." },
          { nombre: "Proveedor habitual", queEs: "Opcional." },
          { nombre: "Unidad de stock", queEs: "Viene «botellas»." },
          { nombre: "Unidades por formato de compra", queEs: "Viene 1. Por ejemplo, 6 si se compra en cajas de 6: la propuesta de compra pedirá cajas completas." },
          { nombre: "Coste por unidad (€)", queEs: "Obligatorio y no negativo, salvo «Sin coste». Después se recalcula solo con las compras." },
          { nombre: "IVA", queEs: "Viene 21 %." },
          { nombre: "Mínimo general", queEs: "Viene 0. Se aplica en obradores y almacenes." },
          { nombre: "Código de barras", queEs: "Opcional." },
          { nombre: "Sin coste y motivo", queEs: "Si se marca, el motivo es obligatorio y queda guardado en el producto." },
          {
            nombre: "Dar de alta",
            queEs: "Crea el producto activo y vuelve a Productos.",
            logica: "Si la referencia ya existe, avisa con el nombre del otro producto. Queda apuntado quién lo creó.",
          },
          { nombre: "Volver", queEs: "Vuelve a Productos sin guardar." },
        ],
      },
    ],
    comoSeUsa: ["Si es un vino, después hazle la ficha de vino en Bodega para poder vender por copa en centilitros."],
    influye: [{ texto: "Lista de productos", ruta: "/bebidas/productos" }],
  },

  // =========================================================================== CARTA
  "/bebidas/carta": {
    titulo: "Carta de bebidas",
    area: AREA,
    paraQue:
      "Las bebidas que se venden en los locales, por secciones (tintos, cervezas, cafés…), con sus formatos (botella, copa…), precio, coste y % de coste. Desde aquí se crean bebidas nuevas.",
    quien: "Ver: «Ver la carta de bebidas, sus formatos (botella, copa…) y escandallos». Crear bebidas: «Editar la carta de bebidas, formatos, precios y escandallos».",
    secciones: [
      {
        titulo: "Pestañas",
        campos: [
          { nombre: "Bebidas de la carta", queEs: "Esta pantalla." },
          { nombre: "Cartas", queEs: "Las cartas, sus secciones y qué bebidas lleva cada una." },
          { nombre: "Bodega", queEs: "Los vinos con su ficha, stock y precio en carta." },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Bebidas", queEs: "Cuántas bebidas se ven. Debajo, cuántas no tienen escandallo (sin escandallo no hay coste)." },
          {
            nombre: "Coste medio",
            queEs: "Media del % de coste de las bebidas que tienen coste.",
            logica: "% de coste = coste ÷ precio sin IVA × 100. Precio sin IVA = precio ÷ (1 + IVA/100). Es la media simple, sin pesar por ventas.",
          },
          { nombre: "Sobre el objetivo", queEs: "Bebidas cuyo % de coste (de la bebida o de alguno de sus formatos) pasa del objetivo de la marca." },
          { nombre: "Alérgenos por revisar", queEs: "Bebidas sin marcar como revisadas o con alérgenos del escandallo sin declarar." },
        ],
      },
      {
        titulo: "Secciones (tarjetas)",
        campos: [
          {
            nombre: "Todas / cada sección",
            queEs: "Se entra por la sección. Cada tarjeta dice cuántas bebidas tiene y cuántas están caras.",
            logica: "Roja si alguna está sobre el objetivo; ámbar si hay alérgenos por revisar. Con más de 80 bebidas se abre solo la primera sección. «Sin sección» junta las bebidas que no están en ninguna carta que se vea.",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Marca", queEs: "Solo sale si arriba no hay un local elegido. Con un local, se ven sus cartas y las de su marca." },
          { nombre: "Buscar", queEs: "Nombre de la bebida (en español o inglés)." },
          { nombre: "Ver retirados", queEs: "Añade las bebidas retiradas." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla de cada sección",
        campos: [
          {
            nombre: "Bebida",
            queEs: "Nombre y descripción. Etiquetas: «Retirado», «No se sirve aquí» (en el local elegido), «Solo …» (bebida de un solo local), «Bajo demanda».",
          },
          { nombre: "Marca", queEs: "Solo sin local elegido." },
          {
            nombre: "Formatos y precio",
            queEs: "Cada formato con su precio con IVA (y centilitros si el vino tiene ficha). Sin formatos, el precio de la bebida; si el local elegido tiene precio propio, sale ese y debajo el de la marca.",
            logica: "El precio propio del local se aplica al primer formato.",
          },
          {
            nombre: "Coste",
            queEs: "Coste del escandallo; con formatos, el del primer formato. «Sin escandallo» si no tiene ingredientes.",
            logica: "Coste = suma de cantidad bruta × coste medio de cada ingrediente. Bruta = neta ÷ (1 − merma %).",
          },
          { nombre: "% coste", queEs: "Coste ÷ precio sin IVA. En rojo si pasa del objetivo de la marca." },
          { nombre: "Alérgenos", queEs: "Los declarados, «Por revisar» o «Faltan N» (los del escandallo que no están declarados)." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "IVA", queEs: "IVA de la bebida." },
          { nombre: "Objetivo de la marca", queEs: "% de coste máximo de bebidas de la marca (si no tiene, el de sus comidas; si tampoco, 30 %). Se cambia en Cartas." },
          {
            nombre: "Coste al último precio",
            queEs: "Coste con el último precio de entrada (compra, producción o carga) en vez del medio.",
            logica: "Si el formato principal vende otro producto (mágnum…), es el último precio de ese producto, no el del escandallo.",
          },
          { nombre: "Margen bruto", queEs: "Precio sin IVA − coste.", logica: "Usa el precio del local elegido si tiene uno propio." },
          { nombre: "Alérgenos declarados, Trazas, Del escandallo sin declarar", queEs: "Situación de los 14 alérgenos." },
          { nombre: "En cartas", queEs: "Cartas en las que está." },
          { nombre: "Tabla de formatos", queEs: "Formato, precio, coste y % de coste de cada uno." },
          { nombre: "Tabla de ingredientes", queEs: "Ingrediente, cantidad neta, merma y coste." },
          { nombre: "Editar bebida, formatos y escandallo / Ver ficha", queEs: "Abre la ficha de la bebida." },
        ],
      },
      {
        titulo: "Nueva bebida",
        campos: [
          { nombre: "Marca", queEs: "De qué marca es. Con un local elegido, se usa su marca." },
          { nombre: "Para", queEs: "«Toda la marca» o «Solo» un local: entonces no sale en la carta de los demás locales." },
          { nombre: "Nombre (español)", queEs: "Obligatorio." },
          { nombre: "Nombre (inglés)", queEs: "Opcional, para la carta en inglés." },
          { nombre: "Precio (con IVA)", queEs: "Obligatorio, no negativo. Si luego se ponen formatos, manda el precio del primero." },
          { nombre: "IVA %", queEs: "Viene 10. Entre 0 y 21." },
          { nombre: "Crear y poner formatos y escandallo", queEs: "Crea la bebida (sin ingredientes ni formatos) y abre su ficha para completarla." },
        ],
      },
      {
        titulo: "Carta al TPV",
        campos: [{ nombre: "Hueco de integración", queEs: "Conexión pendiente: las bebidas, sus formatos y precios por local se enviarán al programa de caja." }],
      },
    ],
    logica: ["Con un local elegido arriba se ven sus cartas y las activas de su marca; sin local, todo lo de tus locales y marcas."],
    influye: [
      { texto: "Las ventas en caja descuentan stock según el escandallo y el formato", ruta: "/caja" },
      { texto: "Precio y % de coste de cada vino", ruta: "/bebidas/bodega" },
      { texto: "Coste teórico de lo vendido en el cuadro de mando", ruta: "/cuadro" },
    ],
  },

  "/bebidas/carta/cartas": {
    titulo: "Cartas (bebidas)",
    area: AREA,
    paraQue: "Las cartas de cada marca o de cada local, con sus secciones de bebidas y las bebidas de cada sección. Aquí se crean cartas y secciones, se ponen y quitan bebidas y se fija el objetivo de coste de cada marca.",
    quien:
      "Ver: «Ver la carta de bebidas…». Cambiar secciones, bebidas y el objetivo de coste de bebidas: «Editar la carta de bebidas…». Crear o cambiar cartas: permiso de editar la carta de Bebidas o la de Comidas.",
    secciones: [
      {
        titulo: "Filtro",
        campos: [{ nombre: "Marca", queEs: "Solo sale sin local elegido arriba. Con un local, se ven sus cartas y las activas de su marca." }],
      },
      {
        titulo: "Tabla de cartas",
        campos: [
          { nombre: "Carta", queEs: "Nombre." },
          { nombre: "De", queEs: "«Marca (toda la marca)» o «Solo» un local." },
          { nombre: "Tipo y Fechas", queEs: "Permanente, o Temporal con fecha de inicio y de fin." },
          { nombre: "Secciones", queEs: "Secciones de bebidas de la carta (las de comidas no se ven aquí)." },
          { nombre: "Bebidas", queEs: "Bebidas en esas secciones." },
          {
            nombre: "Estado",
            queEs: "Desactivada, En vigor, Próxima o Terminada.",
            logica: "En vigor: activa y permanente, o temporal con hoy entre sus fechas. Próxima: temporal que aún no ha empezado.",
          },
        ],
      },
      {
        titulo: "Detalle de la carta",
        campos: [
          { nombre: "Cada sección", queEs: "Nombre (y en inglés) con sus bebidas: formatos y precios, alérgenos, precio de la marca y % de coste." },
          {
            nombre: "Confirmo quitarla y Quitar sección",
            queEs: "Quita la sección de la carta. Hay que marcar la casilla. No se borra: queda en «Secciones quitadas» con sus bebidas y se puede recuperar. No toca las secciones de comidas.",
          },
          { nombre: "Secciones quitadas y Recuperar", queEs: "Secciones de bebidas quitadas de esta carta, con cuántas bebidas guardan. «Recuperar» la vuelve a poner como estaba." },
          { nombre: "Quitar (bebida)", queEs: "Saca la bebida de esa sección." },
          {
            nombre: "Añadir una bebida…",
            queEs: "Pone una bebida en la sección.",
            logica: "Solo bebidas de la misma marca; las de un solo local, solo en cartas de ese local. Salen las que aún no están en esta carta.",
          },
          { nombre: "Nueva sección de bebidas y En inglés", queEs: "Crea una sección al final de la carta." },
          {
            nombre: "Nombre, Tipo, Desde, Hasta, Guardar",
            queEs: "Cambia los datos de la carta.",
            logica: "Una temporal necesita las dos fechas y el fin no puede ser antes del inicio. La carta es la misma que ve Comidas.",
          },
          { nombre: "Bebidas que pueden ir y no están", queEs: "Cuántas bebidas de la marca faltan en esta carta." },
          {
            nombre: "Desactivar carta / Activar carta",
            queEs: "Apaga o enciende la carta entera (es la misma que ve Comidas).",
            logica:
              "Si la carta tiene secciones de comidas, sale la casilla «También tiene N sección(es) de comidas: dejarán de verse», que hay que marcar; y solo puede hacerlo quien edite también la carta de Comidas. Para apagar solo lo de bebidas, usa «Quitar sección» en cada una.",
            influye: "Una carta de marca desactivada deja de verse en los locales.",
          },
        ],
      },
      {
        titulo: "Nueva carta",
        campos: [
          { nombre: "Marca", queEs: "Con un local elegido, se usa su marca." },
          { nombre: "Para", queEs: "Toda la marca (la ven todos sus locales) o solo un local." },
          { nombre: "Nombre", queEs: "Obligatorio." },
          { nombre: "Tipo, Desde, Hasta", queEs: "Permanente o temporal (con las dos fechas)." },
          { nombre: "Crear carta", queEs: "Crea la carta vacía; después se le añaden secciones." },
        ],
      },
      {
        titulo: "Objetivo de coste de bebidas por marca",
        campos: [
          {
            nombre: "% de cada marca y Guardar",
            queEs: "% de coste máximo que quiere la marca para sus bebidas (entre 1 y 100, admite decimales con coma). Vacío = el mismo que las comidas de la marca (que sale en gris).",
            logica: "Cada marca tiene un objetivo para comidas y otro para bebidas. El de comidas se cambia en Comidas → Carta → Cartas.",
            influye: "Decide qué bebida sale en rojo («sobre el objetivo») en la Carta de bebidas, en sus fichas y en la Bodega.",
          },
        ],
      },
    ],
    influye: [{ texto: "Lo que se ve en Carta de bebidas", ruta: "/bebidas/carta" }],
  },

  "/bebidas/carta/platos/[id]": {
    titulo: "Ficha de la bebida",
    area: AREA,
    paraQue:
      "Todo de una bebida de la carta: formatos de venta (botella, copa, mágnum…) con su precio y su parte del escandallo, escandallo (qué producto y cuánto), precio en cada local, alérgenos y datos.",
    quien: "Ver: «Ver la carta de bebidas…». Cambiar: «Editar la carta de bebidas, formatos, precios y escandallos». Si abres un plato de comida desde aquí, te lleva a Comidas.",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Volver a la carta", queEs: "Vuelve a Carta de bebidas." },
          { nombre: "Retirar bebida / Recuperar bebida", queEs: "Retira la bebida de la venta (no se borra) o la recupera." },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          {
            nombre: "Precio",
            queEs: "Precio con IVA (con formatos, el del primero). Debajo, sin IVA.",
            logica: "Si arriba tienes elegido un local con precio propio, es el de ese local (y debajo, el de la marca); si no, el de la marca. El % de coste, el margen y el aviso usan este mismo precio.",
          },
          {
            nombre: "Coste",
            queEs: "Coste del escandallo (con formatos, el del primero). Debajo, el coste al último precio de entrada.",
            logica: "Si el formato principal vende otro producto (mágnum…), el coste al último precio es el de ese producto.",
          },
          { nombre: "% de coste", queEs: "Coste ÷ precio sin IVA (el de la cifra «Precio»). Debajo, el objetivo de bebidas de la marca." },
          { nombre: "Margen bruto", queEs: "Precio sin IVA − coste." },
          { nombre: "Avisos", queEs: "«Coste por encima del objetivo» y «Ingredientes sin coste en el catálogo» (el coste sale más bajo de lo real)." },
        ],
      },
      {
        titulo: "Formatos de venta",
        campos: [
          {
            nombre: "Formato (tabla)",
            queEs: "Cada forma de vender la bebida. «Principal» marca el primero, que da el precio de la bebida. Debajo, cuánto lleva: parte del escandallo, o unidades de otro producto, y centilitros si se saben.",
          },
          {
            nombre: "Precio · cantidad y Guardar",
            queEs: "Cambia el precio con IVA y la cantidad del formato.",
            logica: "Cantidad: 1 = el escandallo entero (la botella); 0,2 = una copa de 15 cl en una botella de 75 cl. El precio de la bebida se iguala siempre al del primer formato.",
          },
          { nombre: "Coste", queEs: "Cantidad × coste del escandallo, o cantidad × coste medio del otro producto." },
          { nombre: "% coste", queEs: "Coste del formato ÷ su precio sin IVA. En rojo si pasa del objetivo." },
          { nombre: "Poner primero", queEs: "Lo hace principal: su precio pasa a ser el de la bebida y el precio propio de cada local se aplica a él." },
          { nombre: "Quitar", queEs: "Retira el formato (no se borra del todo: se podrá recuperar añadiéndolo con el mismo nombre)." },
          { nombre: "Formato (añadir)", queEs: "Nombre: botella, copa, media botella, mágnum, caña, doble, jarra, chupito…" },
          { nombre: "Precio (con IVA)", queEs: "Obligatorio." },
          {
            nombre: "Centilitros",
            queEs: "Solo sale si el escandallo es un vino con ficha (y su capacidad). Se escribe la medida y el programa calcula la parte de la botella.",
            logica: "Parte = centilitros ÷ capacidad de la botella ÷ cantidad del escandallo.",
          },
          { nombre: "Parte del escandallo", queEs: "1 = entero; 0,5 = la mitad. Hace falta esto o los centilitros." },
          {
            nombre: "Otro producto (opcional)",
            queEs: "Para el mágnum u otra botella: el formato vende ese producto en vez del escandallo y la cantidad son unidades de ese producto.",
          },
          { nombre: "Añadir formato", queEs: "Crea el formato. No puede haber dos con el mismo nombre." },
        ],
      },
      {
        titulo: "Escandallo",
        campos: [
          { nombre: "Ingrediente", queEs: "Producto del catálogo (de Bebidas, de Comidas o elaborado del obrador) y sus alérgenos." },
          { nombre: "Neta · merma %", queEs: "Cantidad que lleva, en la unidad del producto, y % que se pierde. La merma va de 0 a 95 %." },
          { nombre: "Bruta", queEs: "Lo que hay que sacar del almacén: neta ÷ (1 − merma %)." },
          { nombre: "Precio medio", queEs: "Coste medio del producto por unidad. «Sin coste» si es 0." },
          { nombre: "Coste", queEs: "Bruta × precio medio." },
          { nombre: "% del plato", queEs: "Parte del coste total que pone este ingrediente." },
          { nombre: "Quitar", queEs: "Saca el ingrediente del escandallo." },
          {
            nombre: "Añadir ingrediente",
            queEs: "Elige el producto, la cantidad neta (obligatoria, mayor que 0) y la merma.",
            logica: "Al añadir un ingrediente, los alérgenos vuelven a quedar «por revisar».",
          },
        ],
      },
      {
        titulo: "Precio por local",
        campos: [
          { nombre: "Local", queEs: "Locales abiertos de la marca (o solo el suyo si la bebida es de un local)." },
          { nombre: "Precio", queEs: "El del local en negrita si tiene uno propio; si no, el de la marca." },
          { nombre: "% coste", queEs: "Coste ÷ precio sin IVA de ese local." },
          {
            nombre: "Precio propio, Se sirve y Guardar",
            queEs: "Precio distinto para ese local (vacío = el de la marca) y si se vende allí.",
            influye: "Con «Se sirve» desmarcado, la bebida sale como «No se sirve aquí» y no cuenta en la Bodega de ese local.",
          },
        ],
      },
      {
        titulo: "Alérgenos (14 obligatorios)",
        campos: [
          { nombre: "Aviso", queEs: "Sale si el escandallo lleva alérgenos que la bebida no declara." },
          { nombre: "Contiene / Trazas", queEs: "Marca cada uno de los 14. «(escandallo)» dice que viene de un ingrediente." },
          { nombre: "Revisados por barra", queEs: "Confirma que alguien los ha revisado." },
          { nombre: "Guardar alérgenos", queEs: "Guarda lo marcado. Queda apuntado." },
          { nombre: "Copiar los del escandallo", queEs: "Añade los alérgenos y trazas de los ingredientes y deja la bebida «por revisar»." },
        ],
      },
      {
        titulo: "Datos de la bebida",
        campos: [
          { nombre: "Marca", queEs: "Marca de la bebida." },
          { nombre: "Nombre y Descripción (español e inglés)", queEs: "Textos de la carta. El nombre en español es obligatorio." },
          { nombre: "Precio (con IVA)", queEs: "Si tiene formatos, no se cambia aquí sino en «Formatos de venta»." },
          { nombre: "IVA %", queEs: "Entre 0 y 21." },
          { nombre: "Etiquetas", queEs: "Separadas por comas: sin gluten, vegano, bajo demanda…" },
          { nombre: "Guardar datos", queEs: "Guarda. Los cambios de precio o IVA quedan apuntados." },
        ],
      },
    ],
    influye: [
      { texto: "Las ventas en caja descuentan stock con este escandallo y formato", ruta: "/caja" },
      { texto: "Precio de la botella y de la copa en la Bodega", ruta: "/bebidas/bodega" },
      { texto: "Coste teórico de lo vendido", ruta: "/cuadro" },
    ],
  },

  // =========================================================================== BODEGA
  "/bebidas/bodega": {
    titulo: "Bodega",
    area: AREA,
    paraQue: "Los vinos de la cadena con su D.O., añada, stock, coste, precio en la carta, % de coste y precio por copa. Se entra por el tipo de vino.",
    quien: "Ver: «Ver productos de bebida». Hacer o cambiar fichas de vino: «Crear y editar productos de bebida».",
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Vinos", queEs: "Vinos de la lista. Debajo, cuántos no tienen ficha o la tienen sin tipo o sin D.O." },
          { nombre: "Valor en bodega", queEs: "Stock × coste medio (el stock negativo cuenta como 0)." },
          { nombre: "En la carta", queEs: "Vinos que se venden en alguna carta que veas. Debajo, la media del % de coste de la botella." },
          { nombre: "Coste alto", queEs: "Vinos cuya botella pasa del objetivo de coste de bebidas de su marca (el mismo de la Carta de bebidas)." },
        ],
      },
      {
        titulo: "Tarjetas por tipo",
        campos: [{ nombre: "Todos, Tintos, Blancos, Rosados, Espumosos, Generosos, Dulces, Sin tipo", queEs: "Deja solo ese tipo. Cada tarjeta dice cuántos hay. «Sin tipo» (ámbar) son vinos sin ficha o sin tipo." }],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar", queEs: "Nombre del vino." },
          { nombre: "D.O. o región", queEs: "Deja una denominación (sale la lista de las que hay en las fichas)." },
          { nombre: "Solo los que están en la carta", queEs: "Quita los vinos que no se venden en ninguna carta que veas." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Vino", queEs: "Nombre y, debajo, bodega, tipo, crianza y capacidad si no es 75 cl. «Sin ficha» en ámbar si falta." },
          { nombre: "D.O.", queEs: "Denominación de origen o región." },
          { nombre: "Añada", queEs: "Año de la cosecha, si se controla." },
          { nombre: "Stock", queEs: "Botellas en el centro elegido arriba o en todos tus centros. Solo cuentan los centros con el área de Bebidas activada." },
          { nombre: "Coste", queEs: "Coste medio de la botella." },
          {
            nombre: "En carta",
            queEs: "Precio de la botella entera en la carta, «Solo por copa» o «No está».",
            logica: "Es el formato que vende una botella entera. Con un local elegido, se usa su precio propio.",
          },
          {
            nombre: "% coste",
            queEs: "Coste de la botella ÷ precio de la botella sin IVA.",
            logica: "Verde hasta el objetivo de coste de bebidas de la marca de la carta donde se vende la botella; rojo por encima (el mismo criterio que la Carta de bebidas).",
          },
          { nombre: "Copa", queEs: "Precio de la copa (formato llamado «copa» o que vende menos de media botella)." },
        ],
      },
      {
        titulo: "Detalle de la fila",
        campos: [
          { nombre: "Referencia, Familia, Uva, Capacidad", queEs: "Datos del producto y de la ficha." },
          { nombre: "Stock por centro", queEs: "Botellas en cada centro que ves con el área de Bebidas activada." },
          { nombre: "Copa", queEs: "Precio de la copa y sus centilitros." },
          { nombre: "Maridaje, Para recomendarlo, notas de cata", queEs: "Textos de la ficha para los camareros." },
          { nombre: "En la carta · Formato · Precio · Botellas", queEs: "Cada bebida y formato donde se vende el vino, su precio y qué parte de botella gasta." },
          { nombre: "Editar ficha / Hacer la ficha / Ver ficha", queEs: "Abre la ficha de vino." },
        ],
      },
      {
        titulo: "Ficha de vino para otro producto",
        campos: [
          {
            nombre: "Producto de Bebidas sin ficha y Hacer la ficha",
            queEs: "Para un vino que está en otra familia, un vermut, un oporto…: abre su ficha para hacerla. Desde entonces sale en la Bodega.",
          },
        ],
      },
    ],
    logica: [
      "Salen los productos activos de Bebidas que tienen ficha de vino o cuya familia es de vino (vino, espumoso, champán, cava, generoso, dulce, jerez, oporto).",
      "Solo cuentan las bebidas de la carta cuyo escandallo es ese vino solo, o los formatos que venden ese producto.",
    ],
    influye: [
      { texto: "El precio y los formatos se cambian en la carta", ruta: "/bebidas/carta" },
      { texto: "El coste baja o sube con las compras recibidas", ruta: "/bebidas/compras" },
    ],
  },

  "/bebidas/bodega/[id]": {
    titulo: "Ficha de vino",
    area: AREA,
    paraQue: "Datos del vino para la carta y los camareros (D.O., uva, añada, capacidad, notas, maridaje), con su stock y dónde se vende.",
    quien: "Ver: «Ver productos de bebida». Guardar la ficha: «Crear y editar productos de bebida».",
    secciones: [
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Stock", queEs: "Botellas en el centro elegido arriba o en todos tus centros. Solo cuentan los centros con el área de Bebidas activada." },
          { nombre: "Coste de la botella", queEs: "Coste medio de compra." },
          { nombre: "Precio en carta", queEs: "Precio de la botella entera en la carta. Debajo, el de la copa." },
          { nombre: "% de coste", queEs: "Coste de la botella ÷ precio sin IVA. Rojo si pasa del objetivo de coste de bebidas de la marca (sale debajo)." },
        ],
      },
      {
        titulo: "Ficha de vino",
        campos: [
          { nombre: "Tipo", queEs: "Tinto, blanco, rosado, espumoso, generoso o dulce.", influye: "Tarjeta en la que sale en la Bodega." },
          { nombre: "D.O. o región", queEs: "Por ejemplo, Ribera del Duero.", influye: "Filtro «D.O. o región» de la Bodega." },
          { nombre: "Bodega", queEs: "Quién lo elabora." },
          { nombre: "Uva", queEs: "Una o varias." },
          { nombre: "Añada", queEs: "Año de 1900 a 2100. Vacío si no tiene o no se controla." },
          {
            nombre: "Capacidad (cl)",
            queEs: "75 normal, 150 mágnum, 37,5 media. Si se deja vacía, se guarda 75.",
            logica: "Entre 5 y 2.000 cl.",
            influye: "Permite poner los formatos de la carta en centilitros (copa de 15 cl = 0,2 de una botella de 75 cl) y enseñar los centilitros de cada formato.",
          },
          { nombre: "Crianza", queEs: "Joven, roble, crianza, reserva, gran reserva… (se puede escribir otra)." },
          { nombre: "Maridaje, Notas de cata, Argumento de venta", queEs: "Textos cortos para la carta y para que el camarero lo recomiende." },
          { nombre: "Guardar ficha", queEs: "Crea o cambia la ficha y vuelve con el aviso «Ficha de vino guardada»." },
        ],
      },
      {
        titulo: "En la carta",
        campos: [
          { nombre: "Bebida y formato", queEs: "Dónde se vende (con enlace a la ficha de la bebida) y sus centilitros." },
          { nombre: "Precio", queEs: "Precio con IVA de ese formato." },
          { nombre: "% coste", queEs: "Coste de la parte de botella ÷ precio sin IVA. Rojo si pasa del objetivo de coste de bebidas de la marca de esa carta." },
        ],
      },
      {
        titulo: "Stock por centro",
        campos: [{ nombre: "Centro y Botellas", queEs: "Lo que hay en cada centro que ves (solo los que tienen algo)." }],
      },
    ],
    influye: [
      { texto: "Formatos en centilitros de la carta", ruta: "/bebidas/carta" },
      { texto: "Lista de vinos", ruta: "/bebidas/bodega" },
    ],
  },
};
