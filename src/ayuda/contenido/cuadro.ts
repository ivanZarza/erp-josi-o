import type { AyudaArea } from "../tipos";

const AREA = "Cuadro de mando";

const CENTROS = "Las cifras son de los centros elegidos arriba en el selector de centro («Todos mis centros» = todos los tuyos).";

const FUENTES = [
  "Ventas, comensales y tickets: jornadas de Caja y ventas (sin IVA). Si Caja no está contratada, «sin datos».",
  "Mercancía: en los locales con tickets de Caja, el coste teórico de lo vendido (cada línea × su escandallo) desde su primer día con tickets del mes; en el resto de días y centros, compras recibidas + lo recibido de otros centros − lo servido a otros centros (así el obrador no cuenta dos veces). Si no hay Caja ni Bebidas, Comidas u Obrador, «sin datos».",
  "Gastos: gastos de Contabilidad y facturas recibidas cuya categoría (la principal) es de grupo Gasto fijo o Gasto variable, sin IVA, y que tienen centro. Lo general de la sociedad (sin centro) no entra.",
  "Personal: horas fichadas (o las del cuadrante si no hay fichaje) × coste por hora del contrato, del área Personal.",
  "Si un área no está contratada, su cifra sale «sin datos», nunca como cero.",
];

export const AYUDA_CUADRO: AyudaArea = {
  "/cuadro": {
    titulo: "Cuadro de mando · Indicadores",
    area: AREA,
    paraQue:
      "Junta en una pantalla las ventas, la mercancía, el personal y los gastos del mes de cada centro, marca o sociedad, con el resultado de gestión y la comparación con el presupuesto. Cada cifra sale de su área y enlaza a su detalle.",
    quien: "Permiso «Ver el cuadro de mando». " + CENTROS,
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Subtítulo", queEs: "Mes que se ve y el centro elegido (o cuántos centros entran)." },
          { nombre: "Mes anterior / Mes siguiente", queEs: "Cambian de mes manteniendo la vista (centro, marca o sociedad)." },
          {
            nombre: "Aviso «Cifras sin datos»",
            queEs: "Sale si alguna fuente no existe porque su área no está contratada, y dice cuál y por qué.",
          },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Ventas de ayer (fecha)",
            queEs: "Venta sin IVA de ayer de todos los centros de tu selección. Debajo, comensales y ticket medio (venta ÷ tickets).",
            influye: "Al pulsar, abre Caja y ventas.",
          },
          {
            nombre: "Ventas del mes",
            queEs: "Venta sin IVA del mes. Debajo, el presupuesto de ventas y la desviación en %.",
            logica:
              "En el mes en curso las cifras llegan hasta hoy y el presupuesto se reparte por días («presupuesto a fecha» = presupuesto del mes × días transcurridos, hoy incluido ÷ días del mes). Verde si se llega al presupuesto; naranja si no. Al pulsar, abre Presupuestos.",
          },
          {
            nombre: "Mercancía sobre ventas",
            queEs: "Mercancía ÷ ventas × 100. Debajo, el importe y qué criterio se ha usado (coste teórico, compras o mixto).",
          },
          {
            nombre: "Resultado de gestión",
            queEs: "Ventas − mercancía − personal − gastos.",
            logica: "Si falta alguna fuente se calcula con lo que hay y avisa «resultado incompleto». Verde si es positivo y rojo si es negativo.",
          },
        ],
      },
      {
        titulo: "Pestañas y filtro",
        campos: [
          { nombre: "Por centro / Por marca / Por sociedad", queEs: "Cómo se agrupan las filas de la tabla." },
          { nombre: "Mes", queEs: "Mes que se ve. Por defecto, el actual." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Centro / Marca / Sociedad", queEs: "Nombre de la fila. La última es el Total." },
          {
            nombre: "Ventas",
            queEs: "Venta sin IVA del mes.",
            logica: "En la vista por centro, cada importe enlaza a su detalle (lista de jornadas, documentos o apuntes).",
          },
          { nombre: "Vs. presupuesto", queEs: "Desviación de las ventas frente al presupuesto (a fecha): (real − previsto) ÷ previsto. Verde si es positiva." },
          { nombre: "Mercancía", queEs: "Coste de la mercancía del mes según el criterio explicado abajo." },
          { nombre: "% merc.", queEs: "Mercancía ÷ ventas × 100." },
          { nombre: "Gastos", queEs: "Gastos sin IVA del mes." },
          {
            nombre: "Resultado",
            queEs: "Ventas − mercancía − personal − gastos.",
            logica: "Con asterisco si falta alguna fuente. La fila sale en naranja si el resultado es negativo.",
          },
          {
            nombre: "Detalle de la fila",
            queEs:
              "Detalle (marca y sociedad, o número de centros), Mercancía según (criterio), Comensales, Tickets, Ticket medio, Venta por comensal, Personal, % personal, % gastos y los presupuestos de ventas, mercancía, personal y gastos con su desviación.",
            logica:
              "Ticket medio = ventas ÷ tickets; venta por comensal = ventas ÷ comensales. En mercancía, personal y gastos la desviación es buena (verde) si se gasta menos de lo previsto. En las vistas por marca o sociedad no hay enlaces: hay que abrir la vista por centro.",
          },
        ],
      },
    ],
    logica: FUENTES,
    influye: [
      { texto: "Ventas: Caja y ventas", ruta: "/caja" },
      { texto: "Gastos: Contabilidad", ruta: "/contabilidad/gastos" },
      { texto: "Presupuestos de cada centro", ruta: "/cuadro/presupuestos" },
      { texto: "Coste teórico por plato", ruta: "/caja/platos" },
    ],
    comoSeUsa: [
      "Mira primero el resultado de gestión y las filas en naranja.",
      "Pulsa en la cifra de un centro para ver de qué jornadas, compras o gastos sale.",
    ],
  },

  "/cuadro/detalle": {
    titulo: "Detalle de un indicador",
    area: AREA,
    paraQue: "Enseña de dónde sale una cifra del Cuadro de mando para un centro y un mes: cada jornada, compra o gasto que la forma.",
    quien: "Permiso «Ver el cuadro de mando». Solo se pueden ver tus centros; si no, sale «No puedes ver ese centro».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Título", queEs: "Indicador y centro; debajo, el mes, la marca, la sociedad y la fuente de los datos." },
          {
            nombre: "Abrir en su módulo",
            queEs: "En Ventas abre Caja y ventas; en Gastos, los gastos de ese mes en Contabilidad. Solo si el área está contratada.",
          },
          { nombre: "Volver al cuadro", queEs: "Vuelve a los indicadores de ese mes." },
        ],
      },
      {
        titulo: "Pestañas",
        campos: [
          { nombre: "Ventas", queEs: "Una fila por jornada: «Jornada», comensales y tickets, y la venta sin IVA." },
          {
            nombre: "Mercancía",
            queEs:
              "Filas «Tickets» con el coste teórico de lo vendido de cada día (y su % sobre la venta), y, antes del primer día con tickets del mes o si el local no tiene tickets, las compras agrupadas por documento: «Compra recibida», «Recibido de otro centro» o «Servido a otro centro», con el proveedor y el número de líneas.",
            logica: "Importe de cada compra = suma de cantidad × coste de cada producto. Lo servido a otro centro resta.",
          },
          {
            nombre: "Gastos",
            queEs: "Cada gasto (documento «Gasto») y cada factura recibida (su número interno) de categoría Gasto fijo o Gasto variable, con el concepto y la categoría.",
          },
          {
            nombre: "Personal",
            queEs: "Esta pestaña todavía no enseña el detalle: sale «Sin datos» con el texto de la fuente. El coste de personal se consulta en el área Personal.",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Apuntes y total", queEs: "Número de filas y suma de importes." },
          { nombre: "Fecha", queEs: "Día del apunte." },
          { nombre: "Documento", queEs: "Jornada, número del albarán o pedido, Tickets, Gasto o número de factura." },
          { nombre: "Concepto", queEs: "Explicación del apunte." },
          { nombre: "Importe sin IVA", queEs: "Importe que suma en la cifra." },
        ],
      },
    ],
    logica: [
      "El detalle cubre el mes entero; en el mes en curso, el cuadro corta las cifras en hoy.",
      ...FUENTES.slice(0, 3),
    ],
    influye: [
      { texto: "Indicadores del mes", ruta: "/cuadro" },
      { texto: "Venta por plato (detalle del coste teórico)", ruta: "/caja/platos" },
    ],
  },

  "/cuadro/diario": {
    titulo: "Día a día",
    area: AREA,
    paraQue:
      "Guarda una foto de los indicadores de cada centro y día del mes (ventas, comensales, mercancía, gastos, personal). Es una foto: si después se meten o corrigen datos, hay que recalcular.",
    quien: "Permiso «Ver el cuadro de mando» (también para recalcular). " + CENTROS,
    secciones: [
      {
        titulo: "Botón y filtro",
        campos: [
          {
            nombre: "Recalcular el mes",
            queEs: "Vuelve a calcular y guarda los indicadores de cada centro y día del mes con los datos de ahora.",
            logica:
              "Solo de los centros de tu selección y hasta hoy. Se guardan los días que tienen algún dato; un día guardado antes que ya no tenga datos se queda como estaba. El cálculo es el mismo que el de Indicadores.",
          },
          { nombre: "Mes", queEs: "Mes que se enseña. Por defecto, el actual." },
          {
            nombre: "Aviso «Último cálculo»",
            queEs: "Fecha y hora del último recálculo de ese mes, o que aún no se ha calculado.",
            logica: "El cálculo automático cada noche todavía no existe: hay que pulsar «Recalcular el mes».",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Día", queEs: "Día del indicador." },
          { nombre: "Centro", queEs: "Centro." },
          { nombre: "Ventas", queEs: "Venta sin IVA del día, o «sin datos»." },
          { nombre: "Comensales", queEs: "Comensales del día." },
          { nombre: "Mercancía", queEs: "Mercancía del día (coste teórico o compras)." },
          { nombre: "Gastos", queEs: "Gastos sin IVA del día." },
          {
            nombre: "Detalle de la fila",
            queEs: "Tickets, Ticket medio (ventas ÷ tickets), Personal y Calculado (cuándo se hizo la foto).",
          },
        ],
      },
    ],
    logica: FUENTES,
    influye: [{ texto: "Indicadores del mes (calculados al momento)", ruta: "/cuadro" }],
  },

  "/cuadro/presupuestos": {
    titulo: "Presupuestos",
    area: AREA,
    paraQue: "Lo que se espera vender y gastar cada mes en cada centro, sin IVA. El Cuadro de mando compara las cifras reales con estos presupuestos.",
    quien: "Ver: permiso «Ver el cuadro de mando». Guardar y copiar: «Editar presupuestos». " + CENTROS,
    secciones: [
      {
        titulo: "Botones de arriba",
        campos: [
          { nombre: "Mes anterior / Mes siguiente", queEs: "Cambian el mes que se ve." },
          {
            nombre: "Copiar del mes anterior",
            queEs: "Copia a este mes el presupuesto del mes anterior de cada centro que aún no tenga el de este mes.",
            logica: "Los centros que ya tienen presupuesto no se tocan. Las copias llevan la nota «Copiado del mes anterior».",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Línea de totales", queEs: "Cuántos centros tienen presupuesto de cuántos hay, y la suma de ventas previstas." },
          { nombre: "Centro", queEs: "Centro." },
          { nombre: "Ventas", queEs: "Venta prevista del mes." },
          { nombre: "Mercancía", queEs: "Coste de mercancía previsto." },
          { nombre: "Personal", queEs: "Coste de personal previsto." },
          { nombre: "Gastos", queEs: "Gastos previstos." },
          { nombre: "Estado", queEs: "«Hecho» o «Sin presupuesto» (la fila sale en naranja)." },
        ],
      },
      {
        titulo: "Detalle y formulario",
        campos: [
          { nombre: "Marca, Sociedad y Notas", queEs: "Datos del centro y nota del presupuesto." },
          { nombre: "Ventas", queEs: "Venta prevista sin IVA. Obligatoria, cero o más." },
          { nombre: "Mercancía", queEs: "Opcional, cero o más." },
          { nombre: "Personal", queEs: "Opcional, cero o más." },
          { nombre: "Gastos", queEs: "Opcional, cero o más." },
          { nombre: "Notas", queEs: "Comentario libre." },
          {
            nombre: "Guardar",
            queEs: "Guarda o cambia el presupuesto de ese centro y mes.",
            logica: "El cambio queda en el registro de cambios con las cifras de antes y de después.",
          },
        ],
      },
    ],
    logica: ["En el Cuadro de mando, en el mes en curso, el presupuesto se compara «a fecha»: repartido por los días transcurridos del mes."],
    influye: [{ texto: "Columna «Vs. presupuesto» y desviaciones del cuadro", ruta: "/cuadro" }],
    comoSeUsa: ["Antes de empezar el mes, pulsa «Copiar del mes anterior» y ajusta los centros que cambien."],
  },
};
