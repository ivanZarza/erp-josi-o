import type { AyudaArea } from "../tipos";

const AREA = "Contabilidad";

const AMBITO =
  "Solo ves las sociedades de tus centros. Con un centro elegido arriba, solo salen los documentos de ese centro; con «Todos mis centros», los de tus centros y además los generales de la sociedad (sin centro).";

const CAMPOS_LINEAS = [
  { nombre: "Concepto", queEs: "Qué se factura. Obligatorio en cada línea que se rellene." },
  { nombre: "Cantidad", queEs: "Unidades. Por defecto 1; tiene que ser mayor que cero." },
  { nombre: "Precio sin IVA", queEs: "Precio unitario sin IVA." },
  { nombre: "IVA", queEs: "Tipo de IVA de la línea: 21 %, 10 % (por defecto), 4 % o 0 %." },
];

const LOGICA_LINEAS =
  "Hay 8 filas; las vacías (sin concepto ni precio) no se guardan y hace falta al menos una. Base de la línea = cantidad × precio (redondeada a céntimos); IVA de la línea = base × tipo ÷ 100. Base, IVA y total de la factura son la suma de las líneas; los calcula el programa.";

const CAMPOS_PAGO = (que: string) => [
  { nombre: "Fecha", queEs: `Día en que se ${que}. Por defecto, hoy.` },
  { nombre: "Forma", queEs: "Transferencia (por defecto), Domiciliación, Tarjeta, Efectivo u Otra." },
  { nombre: "Referencia (opcional)", queEs: "Referencia del banco, número de recibo…" },
];

export const AYUDA_CONTABILIDAD: AyudaArea = {
  "/contabilidad": {
    titulo: "Contabilidad · Resumen",
    area: AREA,
    paraQue:
      "Resume por sociedad lo pendiente de pagar y de cobrar y lo comprado y gastado en el mes. El ERP no lleva la contabilidad oficial: registra facturas y gastos y los prepara para la gestoría.",
    quien:
      "Permiso «Ver contabilidad». «Registrar factura recibida» sale con «Registrar y validar facturas» y «Apuntar gasto» con el permiso de gastos. " + AMBITO,
    secciones: [
      {
        titulo: "Botones de arriba",
        campos: [
          { nombre: "Registrar factura recibida", queEs: "Abre el alta de una factura de proveedor. Solo con permiso para registrar facturas." },
          { nombre: "Apuntar gasto", queEs: "Abre la pantalla de Gastos para apuntar alquiler, luz, seguros… Solo con permiso para apuntar gastos." },
        ],
      },
      {
        titulo: "Filtro",
        campos: [
          {
            nombre: "Mes",
            queEs: "Mes del que se enseñan las compras y gastos. Por defecto, el actual.",
            logica: "Solo cambia «Compras del mes» y «Gastos del mes»: lo pendiente de pagar o cobrar es siempre todo lo pendiente, sea del mes que sea.",
          },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Pendiente de pagar",
            queEs: "Total con IVA de las facturas recibidas sin pagar (pendientes de revisar o validadas) más los gastos pendientes de pagar.",
            influye: "Al pulsar, abre Vencimientos.",
          },
          {
            nombre: "Pagos que vencen esta semana",
            queEs: "Total con IVA de los pagos que vencen hasta el domingo de esta semana, incluidos los ya vencidos y los que no tienen fecha.",
            logica:
              "Debajo: número de pagos y cuántos de ellos tienen ya la fecha pasada (solo pagos). En rojo si hay algún pago vencido; en naranja si hay pagos esta semana. Los cobros vencidos se avisan en «Pendiente de cobrar».",
          },
          {
            nombre: "Pendiente de cobrar",
            queEs: "Total con IVA de las facturas emitidas en el programa certificado que aún no se han cobrado.",
            logica: "Si alguna tiene ya el vencimiento pasado, lo dice debajo y sale en naranja (hay que reclamarla).",
          },
          {
            nombre: "Facturas por revisar",
            queEs: "Número de facturas recibidas «Pendiente de revisar». Al pulsar, se listan.",
          },
        ],
      },
      {
        titulo: "Tarjeta de cada sociedad",
        campos: [
          { nombre: "Nombre y CIF", queEs: "Razón social y CIF de la sociedad." },
          { nombre: "Pendiente de pagar", queEs: "Lo mismo que la cifra de arriba, solo de esta sociedad. Enlaza a sus vencimientos." },
          { nombre: "Pendiente de cobrar", queEs: "Facturas emitidas de esta sociedad sin cobrar. Enlaza a ellas." },
          {
            nombre: "Compras del mes (sin IVA)",
            queEs: "Base de las facturas recibidas del mes que no están anuladas, de cualquier categoría (mercancía, suministros…).",
          },
          { nombre: "Gastos del mes (sin IVA)", queEs: "Base de los gastos apuntados del mes que no están anulados." },
          { nombre: "Facturas pendientes de revisar", queEs: "Aviso si la sociedad tiene facturas sin validar." },
          {
            nombre: "Nóminas del mes (Personal)",
            queEs: "Coste empresa (bruto + Seguridad Social de la empresa) de las nóminas del mes calculadas en Personal para los centros de esta sociedad, y cuántas siguen en borrador.",
            logica: "Solo si Personal está contratado y tienes permiso para ver nóminas o costes de personal. Es información: no se suma a «Gastos del mes» ni al Cuadro desde aquí (el Cuadro lee las nóminas de Personal), para no contarlas dos veces.",
            influye: "Enlaza a Personal → Nóminas si tienes permiso.",
          },
          {
            nombre: "Personal apuntado aquí (sin IVA)",
            queEs: "Gastos y líneas de facturas del mes en categorías de Personal (lo que apunta la gestoría: líquido, IRPF, Seguridad Social…).",
            logica: "Si hay nóminas y aún no hay nada apuntado, avisa de que faltan por apuntar. Si las dos cifras se separan más de un 1 % (o de 1 €), avisa en naranja para revisarlo con la gestoría.",
          },
          {
            nombre: "Aviso «Sociedad sin CIF confirmado»",
            queEs: "La sociedad tiene el CIF «PENDIENTE»: hay que revisar en Organización a qué sociedad pertenece cada centro.",
          },
        ],
      },
      {
        titulo: "Conexiones pendientes",
        campos: [
          {
            nombre: "Recuadros de integración",
            queEs:
              "Lectura de facturas con IA, Programa de la gestoría, Verifactu y Bancos: conexiones que aún no están hechas. Mientras, los datos se meten a mano y se exporta un archivo por sociedad y mes.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Lo pendiente de pagar y cobrar, con su fecha", ruta: "/contabilidad/vencimientos" },
      { texto: "Las sociedades se asignan a cada centro en Organización", ruta: "/organizacion" },
    ],
  },

  "/contabilidad/recibidas": {
    titulo: "Facturas recibidas",
    area: AREA,
    paraQue:
      "Lista las facturas de proveedores de cada sociedad. Se registran, alguien las revisa y valida, y después se marcan como pagadas. Además, cada factura se cuadra con sus albaranes de compra (uno o varios: una factura semanal o mensual junta los de su periodo) y el programa avisa de posibles duplicadas y de lo que no cuadra.",
    quien:
      "Ver: permiso «Ver contabilidad». Registrar, validar, pagar y anular: «Registrar y validar facturas». " + AMBITO,
    secciones: [
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Sociedad", queEs: "Una sociedad o «Todas mis sociedades»." },
          { nombre: "Estado", queEs: "Pendiente de revisar, Validada, Pagada o Anulada." },
          { nombre: "Mes", queEs: "Mes de la fecha de la factura. Vacío = todos." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          {
            nombre: "Línea de totales",
            queEs: "Número de facturas, suma con IVA (sin las anuladas) y cuántas tienen avisos de revisión.",
            logica: "Se enseñan como mucho 500 facturas, las más recientes.",
          },
          { nombre: "Fecha", queEs: "Fecha de la factura." },
          { nombre: "Proveedor", queEs: "Nombre del proveedor." },
          { nombre: "Nº proveedor", queEs: "Número de factura que pone el proveedor." },
          { nombre: "Sociedad", queEs: "Sociedad que recibe la factura." },
          { nombre: "Vencimiento", queEs: "Día en que hay que pagarla." },
          { nombre: "Total", queEs: "Importe con IVA." },
          {
            nombre: "Estado",
            queEs: "Pendiente de revisar, Validada, Pagada o Anulada; y «¿Duplicada?», «No cuadra» (importes o productos distintos de los albaranes) o «Revisar» (solo avisos, por ejemplo un albarán del periodo sin facturar) si tiene avisos.",
            logica: "La fila sale en rojo si está vencida sin pagar y en naranja si está pendiente de revisar o tiene avisos.",
          },
        ],
      },
      {
        titulo: "Detalle de la factura",
        campos: [
          {
            nombre: "Aviso «Revisar antes de validar o pagar»",
            queEs: "Solo en facturas pendientes o validadas que tienen algo raro.",
            logica:
              "Posible duplicada: otra factura no anulada del mismo proveedor y sociedad con el mismo número (sin contar guiones, barras ni espacios) o con el mismo total y fecha a menos de 3 días. Con albaranes enlazados: «No cuadra» si el total sin IVA no es lo recibido en sus albaranes (recibido × precio de cada línea) o si, línea a línea por producto, el precio difiere más del 0,5 % de los del albarán, la cantidad facturada no es la recibida, un producto facturado no está en sus albaranes o un producto recibido no está facturado; avisa además si la base de un tipo de IVA no coincide, si un albarán del mismo proveedor y centro del periodo (desde el día siguiente a su factura anterior hasta la fecha de esta) no está en ninguna factura (¿falta en esta?) y si un albarán está también en otra factura. Sin albaranes enlazados (facturas antiguas o de alta sin albaranes): se cruza por fechas con las compras del proveedor y centro desde su factura anterior (o 40 días) solo para los productos facturados, y avisa si esos albaranes ya están en otra factura. Diferencias de menos de 5 céntimos o del 0,5 % se dan por buenas. Los abonos no se cruzan. No hay tarifa pactada con los proveedores en el ERP: el precio se compara con el del albarán.",
          },
          {
            nombre: "Cuadre con sus albaranes",
            queEs: "Tabla de los albaranes de la factura (albarán, compra, día de recepción, importe sin IVA y si está también en otra factura); si están enlazados, base por tipo de IVA y total sin IVA de la factura frente a los albaranes con la diferencia; y línea a línea por producto: cantidad facturada y recibida, precio de la factura y del albarán (medios) y diferencia en euros. Debajo, los albaranes del periodo sin factura.",
            logica: "Las diferencias de 5 céntimos o más salen en rojo. «Por fechas» quiere decir que la factura no tiene albaranes enlazados y se compara con los del proveedor desde su factura anterior.",
          },
          { nombre: "Número interno", queEs: "Número que da el ERP (serie FR), correlativo." },
          { nombre: "CIF del proveedor", queEs: "CIF del proveedor." },
          { nombre: "Centro", queEs: "Centro al que se carga, o «De la sociedad (sin centro)»." },
          { nombre: "Categoría", queEs: "Categoría principal de la factura. Las antiguas sin categoría lo dicen: sus líneas sin categoría propia no suman en el Cuadro." },
          { nombre: "Albaranes", queEs: "Cuántos albaranes están enlazados a la factura (se cuadra con ellos), si es la factura del obrador (va con sus pedidos internos) o si no tiene ninguno (se cruza por fechas)." },
          { nombre: "Base", queEs: "Total sin IVA." },
          { nombre: "IVA", queEs: "Cuota de IVA." },
          { nombre: "Origen", queEs: "Alta a mano, Leída con IA o Factura electrónica." },
          { nombre: "Validada", queEs: "Fecha en que se validó." },
          { nombre: "Pagada", queEs: "Fecha del pago." },
          { nombre: "Notas", queEs: "Comentario libre." },
          { nombre: "Tabla de líneas", queEs: "Concepto, Cantidad, Precio (sin IVA), IVA (%), Base y Categoría de cada línea." },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          {
            nombre: "Validar (revisada y correcta)",
            queEs: "Solo en facturas pendientes de revisar. La da por revisada.",
            logica: "Guarda quién y cuándo. Hace falta validarla antes de poder pagarla.",
          },
          ...CAMPOS_PAGO("pagó"),
          {
            nombre: "Marcar pagada (importe)",
            queEs: "Solo en facturas validadas. Apunta el pago por el total con IVA.",
            logica: "La factura pasa a «Pagada» y se guarda un pago con la fecha, la forma y la referencia.",
            influye: "Sale de lo pendiente de pagar y de Vencimientos.",
          },
          {
            nombre: "Anular",
            queEs: "Solo en facturas pendientes o validadas.",
            logica: "Una factura pagada no se anula: habría que registrar un abono. La anulada no cuenta en sumas, exportación ni Cuadro de mando, y sus albaranes quedan libres para otra factura. El espejo de una factura del obrador no se anula aquí: se anula la factura emitida y se anulan las dos.",
          },
        ],
      },
    ],
    logica: ["Recorrido de una factura: Pendiente de revisar → Validada → Pagada (o Anulada antes de pagarla). Cada paso queda en el registro de cambios."],
    influye: [
      { texto: "Pagos pendientes con su fecha", ruta: "/contabilidad/vencimientos" },
      { texto: "Gastos del Cuadro de mando (si la categoría es de gasto y tiene centro)", ruta: "/cuadro" },
      { texto: "Archivo para la gestoría", ruta: "/contabilidad/exportar" },
    ],
    comoSeUsa: [
      "Registra cada factura al recibirla con «Registrar factura».",
      "Revisa las pendientes (sobre todo las que tienen avisos) y pulsa «Validar».",
      "Cuando se paguen, márcalas como pagadas con la fecha y la forma.",
    ],
  },

  "/contabilidad/recibidas/nueva": {
    titulo: "Registrar factura recibida",
    area: AREA,
    paraQue: "Alta a mano de una factura de proveedor, con los albaranes que factura (uno o varios). Queda «Pendiente de revisar» hasta que alguien la valide.",
    quien: "Permiso «Registrar y validar facturas». Solo puedes registrar en las sociedades de tus centros.",
    secciones: [
      {
        titulo: "1. Albaranes que factura (opcional)",
        campos: [
          { nombre: "Proveedor", queEs: "Proveedor de la factura, para ver sus albaranes sin facturar." },
          { nombre: "Centro", queEs: "Centro que recibió los albaranes, o «Todos los de la sociedad»." },
          { nombre: "Fecha de la factura", queEs: "Hasta qué día cubre la factura (se copia abajo)." },
          {
            nombre: "Ver sus albaranes sin factura",
            queEs: "Enseña las compras recibidas (enteras o en parte) de ese proveedor en tus centros, de los últimos 120 días, que no están en ninguna factura.",
            logica: "Salen marcadas las del periodo: recibidas después de la última factura (sin abonos) del proveedor en ese centro y hasta la fecha de la factura. Puedes marcar y desmarcar.",
          },
          {
            nombre: "Tabla de albaranes",
            queEs: "Casilla para facturarlo, Albarán (ALB-E y, si se apuntó, el número del proveedor), Recibido, Centro, Estado (Recibido o Recibido en parte) e importe Sin IVA (recibido × precio).",
            logica: "Todos tienen que ser del mismo proveedor y de centros de la sociedad elegida; si eliges centro, todos de ese centro (si lo dejas vacío y son de un solo centro, se pone ese). Cada albarán solo puede estar en una factura: si otro ya lo facturó, sale un error con su número. Si dejas las líneas vacías, se copian las de los albaranes marcados (un producto al mismo precio en varias entregas va en una línea, con la cantidad recibida, el precio y el IVA del producto).",
            influye: "La factura queda enlazada a esos albaranes y la lista de facturas recibidas la cuadra con ellos; la ficha de cada compra dice en qué factura está.",
          },
        ],
      },
      {
        titulo: "Datos de la factura",
        campos: [
          { nombre: "Sociedad que la recibe", queEs: "Sociedad a cuyo nombre viene la factura. Obligatorio." },
          {
            nombre: "Centro (opcional)",
            queEs: "Local u obrador al que se carga el gasto. Vacío = gasto general de la sociedad.",
            logica: "Tiene que ser uno de tus centros y pertenecer a la sociedad elegida; si no, sale un error.",
            influye: "Solo las facturas con centro llegan al Cuadro de mando.",
          },
          {
            nombre: "Proveedor dado de alta",
            queEs: "Elige un proveedor de la lista (los activos de Proveedores) o «Otro».",
            logica: "Si eliges uno, se usan su nombre y su CIF (salvo que escribas otro CIF).",
          },
          { nombre: "Otro proveedor", queEs: "Nombre del proveedor si no está en la lista (compañía de la luz, casero…).", logica: "Hace falta elegir un proveedor o escribir su nombre." },
          { nombre: "CIF del proveedor", queEs: "CIF del proveedor." },
          {
            nombre: "Número de factura del proveedor",
            queEs: "El número que pone en la factura. Obligatorio.",
            logica: "Si ya hay otra factura no anulada de esa sociedad con el mismo número y el mismo proveedor, no deja registrarla.",
          },
          { nombre: "Fecha de la factura", queEs: "Fecha que pone la factura. Por defecto, hoy (o la elegida arriba)." },
          { nombre: "Vencimiento", queEs: "Día en que hay que pagarla. Si se deja vacío, sale en Vencimientos como «Sin fecha»." },

          {
            nombre: "Categoría principal",
            queEs: "Categoría contable de la factura (mercancía, suministros, alquiler…). Obligatoria.",
            logica: "Va a las líneas que no tengan categoría propia.",
            influye: "Las facturas suman en el Cuadro línea a línea: cada línea con su categoría o, si no tiene, la de la factura; solo las líneas de Gasto fijo o Gasto variable suman en «Gastos» (una factura que mezcla mercancía y una reparación suma solo la reparación). Lo de la sociedad sin centro sale en el Cuadro en una fila aparte «sin centro», sin repartir entre los locales. La mercancía no suma en «Gastos» (el Cuadro la saca de las compras y los tickets).",
          },
        ],
      },
      {
        titulo: "Líneas",
        campos: [
          ...CAMPOS_LINEAS,
          {
            nombre: "Categoría",
            queEs: "Categoría de la línea; por defecto «La de la factura».",
            influye: "Se usa en el archivo para la gestoría y en el Cuadro de mando: Las facturas suman en el Cuadro línea a línea: cada línea con su categoría o, si no tiene, la de la factura; solo las líneas de Gasto fijo o Gasto variable suman en «Gastos» (una factura que mezcla mercancía y una reparación suma solo la reparación). Lo de la sociedad sin centro sale en el Cuadro en una fila aparte «sin centro», sin repartir entre los locales.",
          },
        ],
      },
      {
        titulo: "Notas y botón",
        campos: [
          { nombre: "Notas", queEs: "Comentario libre." },
          {
            nombre: "Registrar factura",
            queEs: "Guarda la factura con su número interno (serie FR) y vuelve a la lista.",
            logica: LOGICA_LINEAS,
          },
          { nombre: "Volver", queEs: "Vuelve a la lista sin guardar." },
        ],
      },
    ],
    influye: [
      { texto: "Aparece en la lista para validarla y pagarla", ruta: "/contabilidad/recibidas" },
      { texto: "Y en lo pendiente de pagar", ruta: "/contabilidad/vencimientos" },
    ],
  },

  "/contabilidad/emitidas": {
    titulo: "Facturas emitidas",
    area: AREA,
    paraQue:
      "Facturas que emiten las sociedades del grupo: eventos, catering, ventas entre sociedades… El ERP no está certificado para Verifactu: aquí solo se preparan los datos; la factura oficial se emite en un programa certificado (el de la gestoría, Holded, Odoo…) y después se apunta aquí su número oficial y su cobro.",
    quien: "Ver: permiso «Ver contabilidad». Preparar, apuntar como emitida, cobrar y anular: «Registrar y validar facturas». " + AMBITO,
    secciones: [
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Sociedad", queEs: "Una sociedad o «Todas mis sociedades»." },
          { nombre: "Estado", queEs: "Borrador, Preparada (sin emitir), Emitida en programa certificado, Cobrada o Anulada." },
          { nombre: "Mes", queEs: "Mes de la fecha de la factura. Vacío = todos." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Fecha", queEs: "Fecha de la factura." },
          { nombre: "Cliente", queEs: "A quién se factura." },
          {
            nombre: "Referencia / nº oficial",
            queEs: "El número oficial del programa certificado si ya se emitió; si no, la referencia interna «PRE-…», que no es un número de factura.",
          },
          { nombre: "Sociedad", queEs: "Sociedad que factura." },
          { nombre: "Total", queEs: "Importe con IVA." },
          { nombre: "Estado", queEs: "En qué punto está. Las preparadas sin emitir salen en naranja." },
        ],
      },
      {
        titulo: "Detalle de la factura",
        campos: [
          {
            nombre: "Datos",
            queEs:
              "Referencia interna, Número oficial (o «Sin emitir»), Programa emisor, Tipo (Evento, Catering, Entre sociedades del grupo u Otro), CIF del cliente, Sociedad del grupo que recibe, Centro, Vencimiento, Base, IVA, Cobrada (fecha) y Notas.",
          },
          {
            nombre: "Pedidos internos que factura y Espejo en el local",
            queEs: "Solo en las facturas entre sociedades: los pedidos del obrador (con su albarán de salida) que van en la factura y la factura recibida que se creó en la sociedad del local.",
          },
          { nombre: "Tabla de líneas", queEs: "Concepto, Cantidad, Precio (sin IVA), IVA (%) y Base de cada línea." },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          { nombre: "Número oficial", queEs: "Número que ha dado el programa certificado. Obligatorio para apuntarla como emitida." },
          { nombre: "Programa certificado", queEs: "En qué programa se emitió (A3, Holded, Odoo…). Obligatorio." },
          {
            nombre: "Apuntar como emitida",
            queEs: "Solo en facturas preparadas o en borrador. Pasa a «Emitida en programa certificado».",
            influye: "Desde ese momento cuenta como pendiente de cobrar y sale en Vencimientos y en el archivo para la gestoría. En una factura del obrador, el número oficial pasa también a su espejo en el local (como número del proveedor).",
          },
          ...CAMPOS_PAGO("cobró"),
          {
            nombre: "Marcar cobrada (importe)",
            queEs: "Solo en facturas emitidas. Apunta el cobro por el total con IVA y la factura pasa a «Cobrada».",
          },
          {
            nombre: "Anular",
            queEs: "Solo en facturas preparadas o en borrador.",
            logica: "Una factura ya emitida en el programa certificado no se anula aquí: se rectifica en ese programa. Al anular una factura del obrador se anula también su espejo en el local (si el local ya lo pagó, no se puede) y sus pedidos vuelven a estar por facturar.",
          },
          { nombre: "Facturar pedidos del obrador", queEs: "Abre la pantalla que prepara las facturas entre sociedades del obrador a los locales de un mes." },
        ],
      },
    ],
    influye: [
      { texto: "Cobros pendientes", ruta: "/contabilidad/vencimientos" },
      { texto: "Archivo para la gestoría (solo las que tienen número oficial)", ruta: "/contabilidad/exportar" },
    ],
    comoSeUsa: [
      "Prepara la factura con «Preparar factura».",
      "Emítela en el programa certificado y apunta aquí el número oficial y el programa.",
      "Cuando el cliente pague, márcala como cobrada.",
    ],
  },

  "/contabilidad/emitidas/obrador": {
    titulo: "Facturar pedidos del obrador",
    area: AREA,
    paraQue:
      "Prepara la factura entre sociedades del obrador (o almacén central) a cada local de otra sociedad con los pedidos internos del mes: una por local y mes, a la tarifa del obrador, con su espejo como factura recibida en el local.",
    quien: "Permiso «Registrar y validar facturas». Salen los pedidos de los obradores y almacenes de tus centros.",
    secciones: [
      {
        titulo: "Mes",
        campos: [
          {
            nombre: "Mes (según el día en que se sirvió)",
            queEs: "Mes que se factura. Por defecto, el actual.",
            logica: "Un pedido es del mes del día (hora de Madrid) en que el obrador lo sirvió. Fecha de la factura: el último día del mes o, si el mes no ha acabado, hoy.",
          },
          { nombre: "Ver lo que se va a facturar", queEs: "Enseña la vista previa del mes elegido. No guarda nada." },
        ],
      },
      {
        titulo: "Una tarjeta por obrador y local",
        campos: [
          {
            nombre: "Pedidos",
            queEs: "Pedido, Albarán de salida, día en que se sirvió, Diferencias al recibir (líneas con falta o sobra) e importe Sin IVA.",
            logica: "Solo entran los pedidos RECIBIDOS (el local confirmó lo que le llegó) que no están ya en otra factura.",
          },
          {
            nombre: "Líneas",
            queEs: "Producto, Cantidad, Precio, IVA y Base: los pedidos juntos, un producto al mismo precio en una sola línea.",
            logica: "Cantidad = lo servido más lo que llegó de más (la misma regla que el importe del pedido). Lo que faltó al recibir también se factura: salió del obrador y en el local quedó como merma. Precio = el de la línea del pedido (la tarifa del obrador para ese local al servirlo). IVA = el del producto. Debajo, la base y el IVA por tipo y el total.",
          },
          {
            nombre: "Misma sociedad: sin factura",
            queEs: "El obrador y el local son de la misma sociedad: es un traspaso interno y no lleva factura.",
            influye: "Cuenta como venta del obrador (resumen del Obrador) y como mercancía del local (Cuadro de mando), sin factura.",
          },
          { nombre: "No se puede facturar", queEs: "Algún producto con un IVA que no es 21, 10, 4 o 0 %, o un centro sin sociedad asignada. Corrígelo y vuelve a cargar." },
          { nombre: "Facturar", queEs: "Casilla para facturar ese local (marcada por defecto)." },
        ],
      },
      {
        titulo: "Botón y listas de abajo",
        campos: [
          {
            nombre: "Preparar las facturas marcadas",
            queEs: "Crea, por cada local marcado, la factura emitida «Preparada (sin emitir)» (referencia PRE-…) en la sociedad del obrador y su espejo como factura recibida «Pendiente de revisar» en la sociedad del local.",
            logica: "Vence a 30 días. El espejo lleva como número del proveedor la referencia PRE-… hasta que se apunte el número oficial, y categoría de mercancía de comida o de bebida en cada línea. Cada pedido queda enlazado a su factura y no puede entrar en otra: volver a pulsar el mismo mes solo factura los pedidos nuevos.",
            influye: "Las facturas salen en Facturas emitidas y Facturas recibidas; la ficha del pedido dice a qué factura va. El Cuadro de mando no suma las facturas de mercancía (la mercancía del local sale del stock al coste medio o de lo vendido), así que el espejo no se cuenta dos veces.",
          },
          { nombre: "Servidos sin confirmar por el local", queEs: "Pedidos del mes servidos que el local aún no ha confirmado: no entran hasta que los confirme (entonces, en otra factura del mismo mes)." },
          { nombre: "Ya facturado de este mes", queEs: "Facturas ya hechas del mes con pedidos de estos obradores: referencia o número oficial, obrador, cliente, número de pedidos, total y estado." },
        ],
      },
    ],
    logica: [
      "Decisiones a confirmar por Iván: una factura por obrador → local y mes; solo pedidos recibidos; la falta al recibir se factura (merma del local) y la sobra también; vencimiento a 30 días; el IVA es el del producto (a comprobar con la gestoría, igual que el precio entre sociedades vinculadas).",
    ],
    influye: [
      { texto: "Factura emitida para emitir en el programa certificado", ruta: "/contabilidad/emitidas" },
      { texto: "Espejo en el local, para revisar y pagar", ruta: "/contabilidad/recibidas" },
    ],
    comoSeUsa: ["Arriba, elige el obrador o «Todos mis centros»: con un local elegido no sale nada, porque factura el obrador.", "Al acabar el mes, elige el mes y revisa la vista previa.", "Pulsa «Preparar las facturas marcadas».", "Emite cada factura en el programa certificado y apunta su número oficial en Facturas emitidas."],
  },

  "/contabilidad/emitidas/nueva": {
    titulo: "Preparar factura emitida",
    area: AREA,
    paraQue:
      "Guarda los datos de una factura a un cliente para emitirla después en un programa certificado. No es una factura oficial: genera un borrador con referencia «PRE-…».",
    quien: "Permiso «Registrar y validar facturas». Solo puedes preparar facturas de las sociedades de tus centros.",
    secciones: [
      {
        titulo: "Datos",
        campos: [
          { nombre: "Sociedad que factura", queEs: "Sociedad del grupo que emite la factura. Obligatorio." },
          { nombre: "Centro (opcional)", queEs: "Centro al que corresponde.", logica: "Tiene que ser uno de tus centros y de la sociedad elegida." },
          { nombre: "Tipo", queEs: "Evento (por defecto), Catering, Entre sociedades del grupo u Otro.", logica: "Las facturas del obrador a los locales no se preparan aquí a mano: se generan con «Facturar pedidos del obrador» (Facturas emitidas), que las enlaza a sus pedidos y crea el espejo en el local." },
          {
            nombre: "Sociedad del grupo que recibe",
            queEs: "Solo si es entre sociedades del grupo.",
            logica: "Obligatoria si el tipo es «Entre sociedades del grupo». No puede ser la misma que factura (eso sería un traspaso interno, sin factura).",
          },
          { nombre: "Cliente", queEs: "Nombre del cliente. Obligatorio." },
          { nombre: "CIF / NIF del cliente", queEs: "Identificación fiscal del cliente." },
          { nombre: "Fecha", queEs: "Fecha de la factura. Por defecto, hoy." },
          { nombre: "Vencimiento", queEs: "Día en que el cliente debe pagar." },
        ],
      },
      { titulo: "Líneas", campos: CAMPOS_LINEAS },
      {
        titulo: "Notas y botón",
        campos: [
          { nombre: "Notas", queEs: "Comentario libre." },
          {
            nombre: "Preparar factura",
            queEs: "Guarda la factura con referencia interna «PRE-…» y estado «Preparada (sin emitir)» y vuelve a la lista.",
            logica: LOGICA_LINEAS,
          },
          { nombre: "Volver", queEs: "Vuelve a la lista sin guardar." },
        ],
      },
    ],
    influye: [{ texto: "Aparece en la lista para apuntar su número oficial y su cobro", ruta: "/contabilidad/emitidas" }],
  },

  "/contabilidad/gastos": {
    titulo: "Gastos",
    area: AREA,
    paraQue:
      "Gastos que no son mercancía ni vienen en una factura registrada: alquiler, suministros, seguros, mantenimiento… Cada uno con su sociedad, su centro y su categoría, para el Cuadro de mando y la gestoría.",
    quien: "Ver: permiso «Ver contabilidad». Apuntar, pagar, anular y copiar gastos fijos: «Registrar gastos». " + AMBITO,
    secciones: [
      {
        titulo: "Apuntar gasto",
        campos: [
          { nombre: "Sociedad", queEs: "Sociedad que paga el gasto. Obligatorio." },
          {
            nombre: "Centro",
            queEs: "Centro al que se carga, o «De la sociedad» si es general.",
            logica: "Tiene que ser uno de tus centros y de la sociedad elegida.",
            influye: "Los gastos «De la sociedad» no llegan al Cuadro de mando, que va por centros.",
          },
          {
            nombre: "Categoría",
            queEs: "Categoría contable del gasto. Obligatorio.",
            logica: "Salen las categorías activas que no son de Mercancía ni de Ingreso. Si no hay ninguna, sale un enlace para crearlas.",
            influye: "Solo los de grupo Gasto fijo o Gasto variable suman en «Gastos» del Cuadro de mando. Los de Personal solo suman en «Personal» del Cuadro si el área Personal no está contratada; si lo está, el Cuadro usa las nóminas (o las horas) de Personal y no los suma, para no contarlos dos veces. Un gasto sin centro («De la sociedad») sale en el Cuadro en la fila «sin centro» de su sociedad.",
          },
          { nombre: "Concepto", queEs: "Qué es (por ejemplo, «Alquiler de noviembre»). Obligatorio." },
          { nombre: "Proveedor", queEs: "Nombre de quien cobra el gasto (texto libre)." },
          { nombre: "Fecha", queEs: "Fecha del gasto. Por defecto, hoy.", influye: "Decide en qué mes y día cuenta en el Cuadro de mando." },
          { nombre: "Vencimiento", queEs: "Día en que hay que pagarlo." },
          { nombre: "Importe sin IVA", queEs: "Base del gasto. Obligatorio y mayor que cero (los abonos y devoluciones no se apuntan como gasto). Se escribe con coma o punto: 1.250,50 o 1250.5." },
          { nombre: "IVA", queEs: "21 % (por defecto), 10 %, 4 % o 0 % / exento.", logica: "IVA = importe × tipo ÷ 100; total = importe + IVA." },
          { nombre: "Gasto fijo mensual", queEs: "Márcalo si se repite cada mes (alquiler, seguros…) para poder copiarlo al mes siguiente." },
          { nombre: "Guardar gasto", queEs: "Guarda el gasto como «Pendiente de pagar»." },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Sociedad", queEs: "Una sociedad o «Todas mis sociedades»." },
          { nombre: "Estado", queEs: "Pendiente de pagar, Pagado o Anulado." },
          { nombre: "Mes", queEs: "Mes de la fecha del gasto. Por defecto, el actual." },
        ],
      },
      {
        titulo: "Copiar gastos fijos",
        campos: [
          {
            nombre: "Copiar a este mes los gastos fijos del mes anterior",
            queEs: "Crea en el mes elegido una copia de cada gasto marcado como fijo del mes anterior.",
            logica:
              "Copia los fijos no anulados del mes anterior que todavía no estén en este mes (mismo concepto, sociedad y centro). La fecha y el vencimiento pasan al mismo día del mes nuevo (como mucho el día 28). Mismo importe y categoría, en «Pendiente de pagar» y con la nota «Copiado del mes anterior». Solo los de tus centros (o de la sociedad si tienes «Todos mis centros»).",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Línea de totales", queEs: "Número de gastos y suma sin IVA, sin contar los anulados." },
          { nombre: "Fecha", queEs: "Fecha del gasto." },
          { nombre: "Concepto", queEs: "Qué es." },
          { nombre: "Categoría", queEs: "Categoría contable." },
          { nombre: "Centro", queEs: "Centro, o «De la sociedad»." },
          { nombre: "Sin IVA", queEs: "Importe sin IVA." },
          { nombre: "Estado", queEs: "Pendiente de pagar, Pagado o Anulado." },
          {
            nombre: "Detalle de la fila",
            queEs: "Sociedad, Proveedor, Grupo de la categoría, Gasto fijo mensual, IVA, Total, Vencimiento, Pagado (fecha) y Notas.",
          },
          ...CAMPOS_PAGO("pagó"),
          {
            nombre: "Marcar pagado (importe)",
            queEs: "Solo en gastos pendientes. Apunta el pago por el total con IVA y el gasto pasa a «Pagado».",
          },
          { nombre: "Anular", queEs: "Solo en gastos pendientes. Un gasto pagado no se anula. El anulado deja de contar en todas las sumas." },
        ],
      },
    ],
    influye: [
      { texto: "Gastos del Cuadro de mando", ruta: "/cuadro" },
      { texto: "Pagos pendientes", ruta: "/contabilidad/vencimientos" },
      { texto: "Archivo para la gestoría", ruta: "/contabilidad/exportar" },
      { texto: "Categorías de gasto", ruta: "/contabilidad/categorias" },
    ],
    comoSeUsa: [
      "A principio de mes, elige el mes y pulsa «Copiar a este mes los gastos fijos del mes anterior».",
      "Apunta los gastos sueltos según lleguen, siempre con su centro para que salgan en el Cuadro de mando.",
    ],
  },

  "/contabilidad/vencimientos": {
    titulo: "Vencimientos",
    area: AREA,
    paraQue:
      "Lista lo que hay que pagar y cobrar hasta una fecha: facturas recibidas sin pagar, gastos pendientes y facturas emitidas sin cobrar. Incluye lo ya vencido y lo que no tiene fecha. Desde aquí se puede validar, pagar o cobrar.",
    quien:
      "Ver: permiso «Ver contabilidad». Validar y pagar facturas o cobrar emitidas: «Registrar y validar facturas». Pagar gastos: «Registrar gastos». " + AMBITO,
    secciones: [
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Sociedad", queEs: "Una sociedad o «Todas mis sociedades»." },
          { nombre: "Vence hasta", queEs: "Último día de vencimiento que se enseña. Por defecto, el domingo de esta semana." },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "A pagar", queEs: "Total con IVA de los pagos de la lista y cuántos son." },
          {
            nombre: "Pagos ya vencidos",
            queEs: "Total con IVA de los pagos con la fecha de vencimiento ya pasada y cuántos son.",
            logica: "En rojo si hay algún pago vencido.",
          },
          { nombre: "A cobrar", queEs: "Total con IVA de los cobros de la lista y cuántos son." },
          { nombre: "Cobros ya vencidos", queEs: "Total con IVA de los cobros con la fecha ya pasada (hay que reclamarlos).", logica: "En naranja si hay alguno." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          {
            nombre: "Vence",
            queEs: "Fecha de vencimiento, o «Sin fecha».",
            logica: "Ordenado por fecha; los que no tienen fecha salen primero. En rojo los pagos vencidos (fecha anterior a hoy) y en naranja los cobros vencidos.",
          },
          { nombre: "Tipo", queEs: "Pago o Cobro." },
          { nombre: "Tercero", queEs: "Proveedor o cliente." },
          { nombre: "Documento", queEs: "Número interno y número del proveedor, concepto del gasto, o número oficial de la factura emitida." },
          { nombre: "Sociedad", queEs: "Sociedad que paga o cobra." },
          { nombre: "Importe", queEs: "Total con IVA." },
          {
            nombre: "Detalle de la fila",
            queEs: "Origen (Factura recibida, Gasto o Factura emitida), Centro, Estado (Pendiente de revisar, Validada, Emitida sin cobrar o Pendiente) y Vencido (sí o no).",
          },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          { nombre: "Validar factura", queEs: "En facturas recibidas pendientes de revisar: hay que validarlas antes de poder pagarlas." },
          ...CAMPOS_PAGO("pagó o cobró"),
          { nombre: "Marcar pagada", queEs: "En facturas recibidas validadas: apunta el pago y la factura pasa a «Pagada»." },
          { nombre: "Marcar pagado", queEs: "En gastos pendientes: apunta el pago y el gasto pasa a «Pagado»." },
          { nombre: "Marcar cobrada", queEs: "En facturas emitidas: apunta el cobro y la factura pasa a «Cobrada»." },
        ],
      },
    ],
    influye: [
      { texto: "Resumen de lo pendiente por sociedad", ruta: "/contabilidad" },
      { texto: "Facturas recibidas", ruta: "/contabilidad/recibidas" },
      { texto: "Gastos", ruta: "/contabilidad/gastos" },
      { texto: "Facturas emitidas", ruta: "/contabilidad/emitidas" },
    ],
    comoSeUsa: ["Cada lunes, revisa lo que vence en la semana y lo ya vencido, y marca los pagos según se hagan en el banco."],
  },

  "/contabilidad/categorias": {
    titulo: "Categorías contables",
    area: AREA,
    paraQue:
      "Plan de cuentas sencillo para clasificar facturas y gastos. El grupo de cada categoría decide dónde suma en el Cuadro de mando; la cuenta de la gestoría sale en el archivo de exportación.",
    quien: "Ver: permiso «Ver contabilidad». Crear, activar y desactivar: «Registrar gastos».",
    secciones: [
      {
        titulo: "Sin categorías",
        campos: [
          {
            nombre: "Crear las categorías básicas de hostelería",
            queEs: "Solo sale si no hay ninguna categoría. Crea 14 de una vez.",
            logica:
              "Mercancía de bebidas, Mercancía de comida y Consumibles y menaje (Mercancía); Personal (Personal); Alquiler, Suministros, Seguros, Teléfono e internet y Gestoría y asesoría (Gasto fijo); Mantenimiento y reparaciones, Limpieza, Publicidad y marketing, Comisiones bancarias y de tarjeta y Otros gastos (Gasto variable).",
          },
        ],
      },
      {
        titulo: "Nueva categoría",
        campos: [
          { nombre: "Código", queEs: "Código corto (por ejemplo MUSICA). Se guarda en mayúsculas.", logica: "No puede repetirse." },
          { nombre: "Nombre", queEs: "Nombre que se ve en los selectores." },
          {
            nombre: "Grupo",
            queEs: "Mercancía, Personal, Gasto fijo, Gasto variable o Ingreso.",
            influye:
              "Solo Gasto fijo y Gasto variable suman en «Gastos» del Cuadro de mando. Mercancía no (el Cuadro la saca de compras y tickets). Personal solo suma en «Personal» del Cuadro si el área Personal no está contratada (si lo está, mandan sus nóminas o sus horas), para no contar dos veces. Las de Mercancía e Ingreso no salen al apuntar gastos.",
          },
          { nombre: "Cuenta en la gestoría", queEs: "Opcional. Número de cuenta contable que usa la gestoría (por ejemplo 629).", influye: "Sale en el archivo para la gestoría." },
          { nombre: "Añadir", queEs: "Crea la categoría al final de la lista." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Código", queEs: "Código de la categoría." },
          { nombre: "Nombre", queEs: "Nombre." },
          { nombre: "Grupo", queEs: "Grupo al que pertenece." },
          { nombre: "Cuenta gestoría", queEs: "Cuenta de la gestoría, si tiene." },
          { nombre: "Estado", queEs: "Activa o Desactivada." },
          {
            nombre: "Detalle: Orden y Activar / Desactivar",
            queEs: "Orden en que sale en las listas y botón para activarla o desactivarla.",
            logica: "Las categorías no se borran ni se editan. Una desactivada deja de salir para facturas y gastos nuevos; lo ya apuntado la conserva.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Gastos del Cuadro de mando", ruta: "/cuadro" },
      { texto: "Archivo para la gestoría", ruta: "/contabilidad/exportar" },
      { texto: "Selector de categoría de los gastos", ruta: "/contabilidad/gastos" },
    ],
  },

  "/contabilidad/exportar": {
    titulo: "Exportar a la gestoría",
    area: AREA,
    paraQue:
      "Descarga un archivo CSV (se abre con Excel) por sociedad y mes con las facturas recibidas, los gastos, las facturas emitidas y las ventas diarias, para mandarlo a la gestoría.",
    quien: "Permiso «Exportar a la gestoría». Solo salen las sociedades de tus centros y, de cada una, solo lo de los centros de tu selección (el centro elegido arriba, o todos tus centros); con «todos mis centros» también lo de la sociedad sin centro.",
    secciones: [
      {
        titulo: "Descargar",
        campos: [
          { nombre: "Sociedad", queEs: "Sociedad que se exporta." },
          { nombre: "Mes", queEs: "Mes que se exporta. Por defecto, el actual." },
          {
            nombre: "Descargar CSV",
            queEs: "Descarga el archivo «contabilidad_CIF_mes.csv».",
            logica:
              "Columnas: Tipo, Sociedad, CIF sociedad, Fecha, Documento, Número del tercero, Tercero, CIF tercero, Centro, Categoría, Cuenta gestoría, Base, Tipo IVA, Cuota IVA, Total, Estado y Vencimiento. Separado por punto y coma, con coma decimal y fechas dd/mm/aaaa.",
          },
        ],
      },
      {
        titulo: "Qué lleva el archivo",
        campos: [
          {
            nombre: "Factura recibida",
            queEs: "Facturas recibidas del mes no anuladas, una fila por tipo de IVA.",
            logica: "La categoría de cada fila es la de la primera línea de ese tipo de IVA (o la principal de la factura).",
          },
          { nombre: "Gasto", queEs: "Gastos del mes no anulados (los que no van enlazados a una factura)." },
          {
            nombre: "Factura emitida (programa certificado)",
            queEs: "Solo las facturas emitidas con número oficial (emitidas o cobradas), una fila por tipo de IVA. Las preparadas sin emitir no salen.",
          },
          {
            nombre: "Venta diaria (TPV)",
            queEs: "Una fila por local y día con la venta sin IVA, el IVA y el total.",
            logica: "Solo si el área Caja y ventas está contratada, y de los locales de esa sociedad que están en tu selección.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Facturas recibidas", ruta: "/contabilidad/recibidas" },
      { texto: "Gastos", ruta: "/contabilidad/gastos" },
      { texto: "Facturas emitidas", ruta: "/contabilidad/emitidas" },
      { texto: "Ventas diarias", ruta: "/caja" },
      { texto: "Cuentas de la gestoría de cada categoría", ruta: "/contabilidad/categorias" },
    ],
  },
};
