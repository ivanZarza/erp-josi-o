import type { AyudaArea } from "../tipos";

/**
 * Ayuda de las pantallas de Personal. Escrita a partir de lo que hace el código
 * (src/modulos/personal/servicio.ts, nominas.ts, jornadas.ts, fechas.ts, acciones.ts, esquemas.ts).
 */

const FILTRO_CENTRO =
  "Se filtra por el centro elegido arriba, en el selector de centro. Con «Todos mis centros» se juntan todos los centros que tienes asignados.";

const COSTE_HORA =
  "Coste empresa por hora del contrato: si en el contrato está escrito «Coste empresa por hora», se usa ese. Si está vacío, se calcula: salario bruto anual × (1 + % de cotización de empresa ÷ 100) ÷ (jornada semanal × 47,7 semanas). Las 47,7 semanas son 52 semanas menos 30 días de vacaciones. Ejemplo: 20.000 € al año, 32 % y 40 h/semana → 20.000 × 1,32 ÷ (40 × 47,7) ≈ 13,83 € la hora.";

export const AYUDA_PERSONAL: AyudaArea = {
  // =====================================================================
  "/personal": {
    titulo: "Resumen de Personal",
    area: "Personal",
    paraQue:
      "Es la portada del área de Personal. De un vistazo ves cuánta gente tienes en plantilla, quién falta hoy, las altas y bajas del mes y los avisos importantes: contratos que vencen, periodos de prueba que terminan y certificados o documentos caducados.",
    quien:
      "Quien tenga el permiso «Ver plantilla». Los botones «Alta de empleado» y «Cuadrante» solo salen con el permiso «Altas, bajas y contratos».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Subtítulo (centro · mes)",
            queEs: "El centro que estás viendo (o «Todos tus centros») y el mes en curso.",
            logica: FILTRO_CENTRO,
          },
          { nombre: "Alta de empleado", queEs: "Abre el formulario para dar de alta a una persona nueva." },
          { nombre: "Cuadrante", queEs: "Abre el cuadrante de turnos de la semana." },
        ],
      },
      {
        titulo: "Cifras de arriba",
        campos: [
          {
            nombre: "Plantilla activa",
            queEs: "Número de personas en activo (no dadas de baja).",
            logica:
              "Cuenta solo a quien tiene como centro principal el centro elegido. Las personas prestadas de otro centro no suman aquí (en «Empleados» sí salen). Debajo, «turnos hoy» es el número de turnos puestos hoy en el cuadrante de esos centros. Al pulsar la cifra se abre la lista de empleados.",
          },
          {
            nombre: "Altas y bajas del mes",
            queEs: "Cuántas personas han entrado y cuántas han salido este mes (altas / bajas).",
            logica: "Se mira la fecha de alta y la fecha de baja de la ficha, dentro del mes natural en curso.",
          },
          {
            nombre: "Ausentes hoy",
            queEs: "Personas con una ausencia aprobada que cubre el día de hoy (vacaciones, baja, permiso…).",
            logica:
              "Debajo, «peticiones por aprobar» son las ausencias pedidas que nadie ha aprobado ni rechazado todavía, de cualquier fecha. Si hay alguna, la cifra sale en ámbar. Al pulsarla se abre «Ausencias».",
          },
          {
            nombre: "Avisos",
            queEs: "Total de avisos de personal; debajo, cuántos son urgentes (en rojo).",
            logica:
              "Son urgentes: contrato vencido sin renovar ni finalizar, certificado o documento ya caducado y persona activa sin ningún contrato en vigor hoy (y sin otro firmado que empiece después). Son avisos normales: persona sin contrato hoy pero con uno firmado que empieza más adelante, contrato que vence en 30 días (si no hay ya otro que empiece al día siguiente), periodo de prueba que termina en 30 días, certificado o documento que caduca en 30 días. Solo se miran personas activas con centro principal en los centros elegidos.",
          },
        ],
      },
      {
        titulo: "Contratos: sin contrato, vencidos, que vencen (30 días) y periodos de prueba",
        campos: [
          { nombre: "Empleado", queEs: "Nombre de la persona. Al pulsarlo se abre su ficha en la pestaña «Contratos»." },
          { nombre: "Centro", queEs: "Su centro principal." },
          {
            nombre: "Aviso",
            queEs: "«Sin contrato en vigor» (rojo), «Sin contrato en vigor hasta que empiece el nuevo» (ámbar), «Contrato vencido sin renovar ni finalizar» (rojo), «El contrato vence» (ámbar) o «Termina el periodo de prueba» (ámbar).",
            logica: "Contrato en vigor = el que cubre hoy por fechas (la misma regla que la lista de empleados y la ficha). Vencido: el último contrato sin cerrar acabó antes de hoy. Vence: el contrato en vigor acaba en los próximos 30 días y no hay otro que empiece al día siguiente. Periodo de prueba: el del contrato en vigor o el del próximo, si acaba entre hoy y dentro de 30 días.",
          },
          { nombre: "Fecha", queEs: "Día en que vence el contrato, termina el periodo de prueba o empieza el contrato nuevo (vacío si no tiene ninguno)." },
        ],
      },
      {
        titulo: "Certificados y documentos caducados o por caducar",
        campos: [
          { nombre: "Empleado", queEs: "Nombre de la persona. Al pulsarlo se abre su ficha en la pestaña «Formación»." },
          { nombre: "Centro", queEs: "Su centro principal." },
          {
            nombre: "Aviso",
            queEs: "«Caducado: …» o «Caduca: …» con el nombre del certificado, o «Documento caducado / caduca: …».",
            logica: "Rojo si ya ha caducado; ámbar si caduca en los próximos 30 días. Solo cuentan los certificados y documentos que no se han retirado.",
          },
          { nombre: "Fecha", queEs: "Fecha de caducidad." },
        ],
      },
      {
        titulo: "Ausencias de hoy",
        campos: [
          { nombre: "Empleado", queEs: "Persona que falta hoy." },
          { nombre: "Puesto", queEs: "Su puesto de trabajo." },
          { nombre: "Motivo", queEs: "Tipo de ausencia: vacaciones, baja por enfermedad, permiso…" },
          { nombre: "Vuelve", queEs: "Primer día después del último día de la ausencia." },
        ],
      },
      {
        titulo: "Altas y bajas del mes",
        campos: [
          { nombre: "Empleado", queEs: "Nombre. Al pulsarlo se abre su ficha." },
          { nombre: "Puesto", queEs: "Su puesto." },
          { nombre: "Centro", queEs: "Su centro principal." },
          { nombre: "Movimiento", queEs: "«Alta» (verde) o «Baja»." },
          { nombre: "Fecha", queEs: "Fecha de alta o de baja." },
        ],
      },
    ],
    logica: [
      "Todo se refiere al día de hoy en hora de Madrid.",
      "Cada aviso de la cifra «Avisos» sale en una de las dos tablas: los de contratos (incluido «Sin contrato en vigor») en la primera; los de certificados y documentos en la segunda.",
    ],
    influye: [
      { texto: "Lista completa de la plantilla", ruta: "/personal/empleados" },
      { texto: "Peticiones de ausencia por aprobar", ruta: "/personal/ausencias" },
      { texto: "Certificados caducados", ruta: "/personal/formacion" },
    ],
    comoSeUsa: [
      "Mírala cada mañana: si «Avisos» está en rojo, entra en la persona y renueva o finaliza el contrato, o registra el certificado nuevo.",
      "Si hay peticiones por aprobar, pulsa «Ausentes hoy» para ir a «Ausencias».",
    ],
  },

  // =====================================================================
  "/personal/empleados": {
    titulo: "Empleados",
    area: "Personal",
    paraQue:
      "Lista de la plantilla con su puesto, centro, contrato y estado. Desde aquí buscas a una persona, ves sus datos principales al desplegar la fila, entras en su ficha o la das de baja.",
    quien:
      "Quien tenga el permiso «Ver plantilla». Para dar de alta o de baja hace falta «Altas, bajas y contratos». El salario y el coste por hora solo los ve quien tiene «Ver salarios».",
    secciones: [
      {
        titulo: "Filtros",
        campos: [
          {
            nombre: "Buscar",
            queEs: "Escribe parte del nombre, de los apellidos, del DNI o del código (EMP-0001…).",
            logica: "No distingue mayúsculas de minúsculas.",
          },
          { nombre: "Estado", queEs: "«Activos» (por defecto), «De baja» o «Todos»." },
          { nombre: "Departamento", queEs: "Cocina, Sala, Barra, Office, Almacén, Obrador, Reparto, Dirección o Administración. Se toma del puesto de cada persona." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
          {
            nombre: "Centro (selector de arriba)",
            queEs: "Con un centro elegido salen las personas cuyo centro principal es ese y también las que pueden trabajar allí prestadas desde otro centro.",
          },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Nombre", queEs: "Nombre y apellidos, con su código de empleado al lado." },
          { nombre: "Puesto", queEs: "Puesto de trabajo de la ficha." },
          { nombre: "Centro", queEs: "Centro principal. «+2» significa que puede trabajar en otros 2 centros (préstamos)." },
          {
            nombre: "Contrato",
            queEs: "Tipo del contrato en vigor hoy: Indefinido (verde), Fijo discontinuo (azul), Temporal, Prácticas o Tiempo parcial. «Sin contrato» en rojo si no tiene ninguno que cubra hoy.",
            logica: "Contrato en vigor = el más reciente cuya fecha de inicio es hoy o antes y cuya fecha de fin es hoy o después (o no tiene fin).",
          },
          { nombre: "Jornada", queEs: "Horas semanales del contrato en vigor." },
          {
            nombre: "Estado",
            queEs: "«Activo» (verde), «Vence …» (ámbar: el contrato acaba en 30 días o menos), «Certificado caducado» (rojo) o «Baja …» con la fecha de baja.",
          },
          {
            nombre: "Color de la fila",
            queEs: "Rojo si no tiene contrato en vigor o tiene un certificado caducado; ámbar si el contrato vence en 30 días.",
          },
          { nombre: "Total (personas)", queEs: "Número de personas que salen con el filtro." },
        ],
      },
      {
        titulo: "Detalle al desplegar la fila",
        campos: [
          { nombre: "DNI / NIE, Teléfono, Correo", queEs: "Datos de contacto e identificación de la ficha." },
          { nombre: "Alta", queEs: "Fecha de alta en la empresa." },
          { nombre: "Departamento", queEs: "Departamento de su puesto." },
          { nombre: "Categoría", queEs: "Categoría profesional y convenio." },
          { nombre: "Otros centros", queEs: "Centros donde puede trabajar prestado." },
          { nombre: "Contrato", queEs: "Tipo, desde qué fecha y, si tiene, hasta qué fecha." },
          { nombre: "Periodo de prueba", queEs: "Hasta cuándo dura el periodo de prueba." },
          { nombre: "Certificados", queEs: "Certificados en vigor registrados (manipulador, alérgenos…)." },
          {
            nombre: "Salario bruto anual",
            queEs: "Salario bruto al año del contrato en vigor. Solo con «Ver salarios».",
          },
          {
            nombre: "Coste empresa / hora",
            queEs: "Lo que cuesta a la empresa cada hora de trabajo de esta persona. Solo con «Ver salarios».",
            logica: COSTE_HORA,
            influye: "Es el precio con el que se valoran sus horas en el cuadrante, en «Costes y nómina» y en el Cuadro de mando.",
          },
          { nombre: "Motivo de baja", queEs: "Solo si está de baja: el motivo escrito al darla de baja." },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          { nombre: "Alta de empleado", queEs: "Abre el formulario de alta." },
          { nombre: "Abrir ficha", queEs: "Abre la ficha completa de la persona." },
          { nombre: "Contratos", queEs: "Abre la ficha en la pestaña de contratos." },
          {
            nombre: "Fecha de baja, Motivo y Dar de baja",
            queEs: "Da de baja a la persona en la fecha indicada. El motivo es obligatorio (fin de contrato, voluntaria…).",
            logica:
              "No se borra nada: la ficha queda «de baja» con su historial. Además: se cierran sus contratos en esa fecha (los que aún no habían empezado quedan anulados), se quitan del cuadrante todos sus turnos posteriores a la baja, se anulan sus peticiones de ausencia pendientes y, si tiene usuario de acceso enlazado, se desactiva al momento (queda registrado). La fecha de baja no puede ser anterior a la de alta.",
            influye: "Deja de salir en el cuadrante, en la tableta de fichar y en los avisos. Su nómina del mes se calcula solo hasta el día de la baja.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Ficha completa de cada persona", ruta: "/personal/empleados/[id]" },
      { texto: "Turnos por centro", ruta: "/personal/cuadrantes" },
      { texto: "Puestos y convenios (para el filtro de departamento)", ruta: "/personal/ajustes" },
    ],
    comoSeUsa: [
      "Si aún no hay puestos, créalos primero en «Puestos y convenios».",
      "Despliega una fila para ver lo esencial sin salir de la lista.",
    ],
  },

  // =====================================================================
  "/personal/empleados/nuevo": {
    titulo: "Alta de empleado",
    area: "Personal",
    paraQue:
      "Formulario para dar de alta a una persona nueva: sus datos personales, dónde trabaja y, si ya lo tienes, su primer contrato.",
    quien: "Quien tenga el permiso «Altas, bajas y contratos». Los campos de salario solo salen con «Ver salarios».",
    secciones: [
      {
        titulo: "Ficha",
        campos: [
          { nombre: "Fecha de alta", queEs: "Día en que empieza a trabajar. Obligatoria. Por defecto, hoy." },
          { nombre: "Nombre y Apellidos", queEs: "Obligatorios." },
          {
            nombre: "DNI / NIE",
            queEs: "Documento de identidad.",
            logica: "No se puede dar de alta si ya hay otra persona activa con el mismo DNI: sale un error con su código.",
          },
          { nombre: "N.º Seguridad Social", queEs: "Número de afiliación. Sale en la nómina y en el fichero para la gestoría." },
          { nombre: "Fecha de nacimiento", queEs: "Opcional." },
          { nombre: "Teléfono", queEs: "Con prefijo: +34…" },
          { nombre: "Correo", queEs: "Si lo escribes, tiene que ser un correo válido." },
          { nombre: "Contacto de emergencia", queEs: "A quién llamar si pasa algo." },
          { nombre: "Dirección", queEs: "Domicilio." },
          { nombre: "Cuenta bancaria (IBAN)", queEs: "Cuenta donde cobra. En las nóminas solo se ven los 4 primeros y los 4 últimos caracteres." },
          {
            nombre: "PIN para fichar",
            queEs: "4 cifras que la persona teclea al fichar en la tableta del local.",
            logica: "Tienen que ser exactamente 4 cifras. Sin PIN, en la tableta solo le puede fichar quien tenga «Corregir fichajes» (su encargado).",
          },
          {
            nombre: "Usuario de acceso",
            queEs: "El usuario con el que la persona entra en el programa (se crea en Ajustes → Usuarios). Enlazarlo es lo que le deja usar «Fichar (mi portal)»: fichar desde el móvil, ver sus turnos y pedir vacaciones.",
            logica: "Salen los usuarios activos que no están enlazados a otro empleado activo. Un usuario solo puede ser de una ficha. El permiso «Usar el portal del empleado» lo da su rol en Ajustes → Usuarios. Al dar de baja a la persona, su usuario se desactiva solo.",
          },
          {
            nombre: "Centro principal",
            queEs: "El local u obrador donde trabaja normalmente. Obligatorio. Solo salen los centros a los que tienes acceso.",
            influye: "Decide en qué centro cuenta para la plantilla, las ausencias y las nóminas.",
          },
          { nombre: "Puesto", queEs: "Puesto de trabajo (camarero, cocinero…). Los puestos se crean en «Puestos y convenios»." },
          { nombre: "Categoría del convenio", queEs: "Categoría profesional según el convenio." },
          { nombre: "Sociedad que contrata", queEs: "Empresa que le contrata. «La del centro» si es la sociedad del centro principal." },
          {
            nombre: "Otros centros donde puede trabajar (préstamos)",
            queEs: "Marca los centros donde también puede hacer turnos.",
            logica: "El centro principal no hace falta marcarlo.",
            influye: "Saldrá en el cuadrante y en la tableta de fichar de esos centros.",
          },
          { nombre: "Notas", queEs: "Cualquier comentario interno." },
        ],
      },
      {
        titulo: "Contrato",
        campos: [
          {
            nombre: "Registrar el contrato ahora",
            queEs: "Marcado (por defecto) se guarda también el primer contrato. Si lo quitas, la persona queda sin contrato y saldrá en los avisos en rojo.",
          },
          { nombre: "Tipo de contrato", queEs: "Indefinido, Temporal, Fijo discontinuo, Prácticas o Tiempo parcial." },
          {
            nombre: "Jornada semanal (horas)",
            queEs: "Horas a la semana. Por defecto 40.",
            logica: "Tiene que estar entre 1 y 60 horas.",
            influye: "Sirve para el aviso de horas de más en el cuadrante, el coste por hora y la nómina.",
          },
          { nombre: "Inicio", queEs: "Primer día del contrato. Si se deja vacío, se usa la fecha de alta." },
          {
            nombre: "Fin",
            queEs: "Último día del contrato. Vacío si es indefinido.",
            logica: "Un contrato temporal necesita fecha de fin. No puede ser anterior al inicio.",
          },
          { nombre: "Fin del periodo de prueba", queEs: "Opcional. No puede ser anterior al inicio. Avisa 30 días antes." },
          {
            nombre: "Convenio",
            queEs: "Convenio colectivo que se aplica.",
            influye: "Del convenio salen los días de vacaciones, el descanso mínimo entre jornadas y las horas anuales.",
          },
          {
            nombre: "Categoría",
            queEs: "Categoría profesional del contrato.",
            influye: "Su salario base de convenio se usa en la nómina para separar «Salario base» y «Mejora voluntaria». También se copia a la ficha.",
          },
          { nombre: "Sociedad", queEs: "Sociedad del contrato. «La del empleado» toma la de la ficha." },
          {
            nombre: "Salario bruto anual (€)",
            queEs: "Lo que cobra al año en bruto, con todas las pagas. Solo con «Ver salarios».",
            influye: "Sin salario no se le calcula nómina ni coste por hora (sus horas cuentan a 0 €).",
          },
          {
            nombre: "Cotización de empresa (%)",
            queEs: "Porcentaje que paga la empresa a la Seguridad Social sobre el salario. Por defecto 32 %.",
            logica: "Solo se usa para calcular el coste por hora cuando no se escribe a mano. Es un valor orientativo.",
          },
          {
            nombre: "Coste empresa por hora (€)",
            queEs: "Si lo sabes, escribe lo que cuesta cada hora. Vacío: se calcula del salario.",
            logica: COSTE_HORA,
          },
          {
            nombre: "Pagas al año",
            queEs: "Número de pagas: 12 mensualidades más las extra. Por defecto 14.",
            logica: "Entre 12 y 16.",
          },
          {
            nombre: "Pagas extra",
            queEs: "«Prorrateadas cada mes» (por defecto) o «En junio y diciembre».",
            influye: "Cambia el bruto de cada mes en la nómina, no el coste del año.",
          },
          {
            nombre: "Retención IRPF (%)",
            queEs: "La que diga la gestoría. Vacío: se usa una orientativa según el salario.",
            logica:
              "Orientativa (de ejemplo, no es la real): hasta 16.000 € 2 %; hasta 20.000 € 7 %; hasta 24.000 € 11 %; hasta 30.000 € 14 %; hasta 40.000 € 17 %; más, 21 %. No puede pasar del 50 %.",
          },
          { nombre: "Notas del contrato", queEs: "Comentarios del contrato." },
        ],
      },
      {
        titulo: "Botones",
        campos: [
          {
            nombre: "Dar de alta",
            queEs: "Guarda la ficha (y el contrato si está marcado) y abre la ficha de la nueva persona.",
            logica: "Se le asigna el siguiente código libre (EMP-0001, EMP-0002…). Queda anotado quién hizo el alta.",
          },
          { nombre: "Volver", queEs: "Vuelve a la lista sin guardar." },
        ],
      },
    ],
    influye: [
      { texto: "Aparece en la lista de empleados", ruta: "/personal/empleados" },
      { texto: "Se le pueden poner turnos", ruta: "/personal/cuadrantes" },
      { texto: "Puede fichar en la tableta del local", ruta: "/personal/fichajes" },
      { texto: "Entra en las nóminas del mes", ruta: "/personal/nominas" },
    ],
  },

  // =====================================================================
  "/personal/empleados/[id]": {
    titulo: "Ficha del empleado",
    area: "Personal",
    paraQue:
      "Todo lo de una persona en un sitio: sus datos, contratos, turnos, fichajes, ausencias, certificados, documentos y nóminas, cada cosa en una pestaña.",
    quien:
      "Para abrirla: «Ver plantilla». Para editar datos, dar de baja, reactivar y hacer contratos: «Altas, bajas y contratos». Cada pestaña sale solo con su permiso: Turnos («Ver cuadrantes»), Fichajes («Ver fichajes»), Ausencias («Ver ausencias»), Formación («Ver formación y certificados»), Documentos («Ver y registrar documentos del empleado», solo RRHH) y Nóminas («Ver las nóminas»). Salario y coste por hora: «Ver salarios».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Nombre y subtítulo", queEs: "Código, puesto y centro principal." },
          { nombre: "Activo / Baja el …", queEs: "Si está en activo o la fecha en que se dio de baja." },
          { nombre: "Etiqueta de contrato", queEs: "Tipo del contrato en vigor hoy, o «Sin contrato» en rojo." },
          { nombre: "Volver", queEs: "Vuelve a la lista de empleados." },
        ],
      },
      {
        titulo: "Pestaña Datos",
        campos: [
          {
            nombre: "Ficha",
            queEs: "Los mismos campos que en el alta: nombre, DNI, Seguridad Social, contacto, IBAN, PIN, usuario de acceso, centro principal, puesto, categoría, sociedad, otros centros y notas. Encima, la fecha de alta y, si ha tenido un reingreso, la antigüedad. Sin permiso de edición se ve solo un resumen (con alta, antigüedad y si tiene usuario).",
            logica: "Cada cambio queda registrado (quién, cuándo, antes y después). El IBAN y el PIN se registran tapados.",
          },
          { nombre: "Guardar", queEs: "Guarda los cambios de la ficha." },
          {
            nombre: "Usuario de acceso",
            queEs: "Enlaza la ficha con su usuario de Ajustes → Usuarios para que pueda entrar en «Fichar (mi portal)».",
            logica: "Solo salen usuarios activos sin otra ficha activa. Si el usuario está desactivado, actívalo antes en Ajustes → Usuarios. «Sin usuario» quita el enlace.",
          },
          {
            nombre: "Otros centros (préstamos)",
            queEs: "Si desmarcas un centro, deja de salir en el cuadrante y la tableta de ese centro.",
          },
          {
            nombre: "Baja: Fecha de baja, Motivo y Dar de baja",
            queEs: "Da de baja a la persona. El motivo es obligatorio.",
            logica:
              "No se borra nada. Se cierran sus contratos en esa fecha (los que aún no habían empezado quedan anulados, «Anulado antes de empezar»), se quitan sus turnos posteriores del cuadrante, se anulan sus peticiones de ausencia pendientes y su usuario de acceso se desactiva al momento (queda en el historial de cambios). La fecha no puede ser anterior al alta.",
          },
          {
            nombre: "Empleado de baja: Fecha de reingreso y Reactivar",
            queEs: "Vuelve a poner en activo a una persona dada de baja (por ejemplo, un fijo discontinuo al empezar la temporada).",
            logica: "La fecha de alta pasa a ser la del reingreso (manda en la nómina, las vacaciones y las altas del mes), pero la primera alta se guarda como antigüedad y no se pierde. La fecha tiene que ser posterior a la baja. No se crea contrato: hay que hacerle uno nuevo en «Contratos». Su usuario de acceso no se reactiva solo: hazlo en Ajustes → Usuarios.",
          },
        ],
      },
      {
        titulo: "Pestaña Contratos",
        campos: [
          { nombre: "Tipo", queEs: "Tipo de contrato." },
          { nombre: "Jornada", queEs: "Horas a la semana." },
          { nombre: "Desde / Hasta", queEs: "Inicio y fin. «Indefinido» si no tiene fin." },
          { nombre: "Prueba hasta", queEs: "Fin del periodo de prueba." },
          { nombre: "Convenio", queEs: "Convenio y categoría." },
          { nombre: "Salario anual", queEs: "Bruto anual. Solo con «Ver salarios»." },
          { nombre: "Coste/hora", queEs: "Coste empresa por hora. Solo con «Ver salarios».", logica: COSTE_HORA },
          {
            nombre: "Estado",
            queEs: "«En vigor» (verde) o el motivo por el que terminó («Sustituido por un contrato nuevo», «Baja: …», el motivo escrito al finalizarlo…).",
          },
          {
            nombre: "Fecha, Motivo y Finalizar",
            queEs: "Termina el contrato en la fecha indicada con un motivo obligatorio.",
            logica: "La fecha no puede ser anterior al inicio del contrato. El contrato pasa a «finalizado» en el momento, aunque la fecha sea futura.",
          },
          {
            nombre: "Nuevo contrato (renovación, cambio de jornada o de tipo)",
            queEs: "Los mismos campos que en el alta. Solo si la persona está activa.",
            logica:
              "El contrato que estaba en vigor se cierra solo el día antes del inicio del nuevo. Los complementos fijos (pluses) del contrato anterior pasan al nuevo. Si pones categoría o sociedad, se copian también a la ficha.",
          },
          { nombre: "Guardar contrato", queEs: "Guarda el contrato nuevo." },
        ],
      },
      {
        titulo: "Pestaña Turnos",
        campos: [
          { nombre: "Tabla de turnos", queEs: "Turnos del cuadrante desde hace 7 días hasta 4 semanas en total, en cualquier centro." },
          { nombre: "Día", queEs: "Día de la semana y fecha." },
          { nombre: "Centro", queEs: "Centro donde tiene el turno." },
          { nombre: "Horario", queEs: "Entrada y salida; si es partido, los dos tramos." },
          { nombre: "Horas", queEs: "Horas de trabajo del turno: tramos menos la pausa." },
          { nombre: "Cuadrante", queEs: "«Publicado» (verde) si la semana de ese centro está publicada; «Borrador» (ámbar) si no: esos turnos aún no los ve la persona en su portal." },
          { nombre: "Notas", queEs: "Notas del turno." },
        ],
      },
      {
        titulo: "Pestaña Fichajes",
        campos: [
          {
            nombre: "Fichar ahora (por esta persona): Centro y botones",
            queEs: "Ficha en nombre de esta persona en este momento (por ejemplo, si no tiene móvil). Solo salen los botones que tocan ahora. Solo lo ve quien tiene «Corregir fichajes».",
            logica:
              "Orden obligatorio: Entrada → (Inicio de pausa → Fin de pausa) → Salida. Si pasan más de 16 horas desde el último fichaje sin salida, se da por olvidada y se permite volver a entrar. Aquí no se pide PIN porque lo hace el encargado: queda registrado quién fichó por quién. El centro tiene que ser uno de los suyos.",
          },
          { nombre: "Último: …", queEs: "Último fichaje válido y su hora. Avisa si parece que olvidó fichar la salida." },
          { nombre: "Jornadas (30 días)", queEs: "Días con fichajes en los últimos 30 días." },
          {
            nombre: "Horas fichadas",
            queEs: "Suma de horas trabajadas en esos 30 días.",
            logica: "Horas de una jornada = tiempo entre entrada y salida menos las pausas fichadas. Los fichajes anulados no cuentan.",
          },
          {
            nombre: "Jornadas incompletas",
            queEs: "Jornadas a las que les falta la entrada o la salida, o con una pausa sin cerrar.",
          },
          {
            nombre: "Tabla: Jornada, Tipo, Hora, Centro, Origen, Corrección",
            queEs: "Cada fichaje. «Jornada» es el día al que cuenta: un fichaje antes de las 5:00 cuenta para el día anterior (cierres de madrugada). Las horas tachadas son fichajes anulados. Origen: pantalla, tableta, móvil o manual.",
          },
          {
            nombre: "Hora, Motivo y Corregir",
            queEs: "Cambia la hora de un fichaje. Necesita el permiso «Corregir fichajes».",
            logica: "No se borra: el original queda anulado y se crea uno nuevo «manual» con el motivo, quién y cuándo. No se puede poner una hora futura.",
          },
          {
            nombre: "Añadir fichaje olvidado: Tipo, Día, Hora, Motivo y Añadir",
            queEs: "Añade un fichaje que la persona no hizo. Motivo obligatorio. Necesita «Corregir fichajes».",
            logica: "Se guarda en el centro elegido arriba o, si no hay, en su centro principal. No se puede poner en el futuro.",
          },
        ],
      },
      {
        titulo: "Pestaña Ausencias",
        campos: [
          {
            nombre: "Vacaciones del año",
            queEs: "Días de vacaciones a los que tiene derecho este año.",
            logica:
              "Días del convenio del contrato en vigor (30 si no hay convenio). Si entró este año, se reparten en proporción a los días que quedan desde su alta hasta el 31 de diciembre, redondeado.",
          },
          { nombre: "Aprobadas", queEs: "Días de vacaciones aprobados este año (días naturales)." },
          { nombre: "Pedidas", queEs: "Días de vacaciones pedidos aún sin aprobar." },
          { nombre: "Quedan", queEs: "Derecho − aprobadas − pedidas. En rojo si es negativo." },
          {
            nombre: "Tabla: Tipo, Desde, Hasta, Días, Estado, Comentario",
            queEs: "Sus últimas 50 ausencias. «Días» son días naturales, contando sábados y domingos. En «Comentario» sale el motivo del rechazo si lo hubo.",
          },
          {
            nombre: "Aprobar / Anular",
            queEs: "«Aprobar» una pedida; «Anular» una pedida o aprobada. Necesita «Aprobar ausencias».",
            logica: "Al aprobar, si tiene turnos en esas fechas, sale un aviso para quitarlos del cuadrante (no se quitan solos).",
          },
          {
            nombre: "Nueva ausencia: Tipo, Desde, Hasta, Comentario, Aprobar ya, Guardar",
            queEs: "Registra una ausencia. Solo si la persona está activa.",
            logica:
              "No puede solaparse con otra ausencia pedida o aprobada. «Hasta» no puede ser antes que «Desde». «Aprobar ya» solo sale con permiso de aprobar; si no se marca, queda pedida.",
          },
        ],
      },
      {
        titulo: "Pestaña Formación",
        campos: [
          { nombre: "Tipo, Nombre, Entidad, Obtenido", queEs: "Datos del certificado o formación." },
          {
            nombre: "Caducidad",
            queEs: "«Hasta el …» (verde), «Caduca el …» (ámbar, en 30 días o menos), «Caducado el …» (rojo), «Sin caducidad» o «Sustituido» si hay uno más nuevo del mismo tipo.",
          },
          { nombre: "Retirar", queEs: "Quita el certificado de los vigentes (no se borra). Necesita «Registrar certificados y formaciones»." },
          {
            nombre: "Añadir certificado o formación",
            queEs: "Tipo, Nombre (opcional), Entidad, Obtenido y Caduca.",
            logica:
              "La caducidad no puede ser anterior a la obtención. Un certificado nuevo sustituye al anterior del mismo tipo, salvo «Formación interna» y «Otro», que se acumulan.",
          },
        ],
      },
      {
        titulo: "Pestaña Documentos",
        campos: [
          { nombre: "Aviso", queEs: "Por ahora solo se guardan los datos del documento, no el archivo." },
          { nombre: "Tipo, Documento, Registrado, Caducidad", queEs: "Tipo (DNI / NIE, permiso de trabajo, contrato firmado, nómina, certificado, otro), nombre, fecha de registro y caducidad." },
          { nombre: "Retirar", queEs: "Lo marca como retirado (no se borra). Queda registrado." },
          {
            nombre: "Registrar documento: Tipo, Nombre, Caduca, Registrar",
            queEs: "Anota un documento nuevo. El nombre es obligatorio.",
            influye: "Si tiene caducidad, avisa en el Resumen 30 días antes y cuando caduca.",
          },
        ],
      },
      {
        titulo: "Pestaña Nóminas",
        campos: [
          { nombre: "Mes", queEs: "Mes de la nómina. Al pulsarlo se abre ese mes en «Nóminas»." },
          { nombre: "Días", queEs: "Días cotizados (mes de 30) y, entre paréntesis, días de baja médica (IT)." },
          { nombre: "Horas extra", queEs: "Horas extra (o complementarias) pagadas ese mes." },
          { nombre: "Bruto, Neto, Coste empresa", queEs: "Total devengado, líquido a cobrar y coste total para la empresa." },
          { nombre: "Estado", queEs: "Borrador, Cerrada o Pagada." },
          { nombre: "Pagada", queEs: "Fecha de pago." },
        ],
      },
    ],
    logica: [
      "Solo puedes abrir fichas de personas de tus centros (principal o préstamo).",
      "Nada se borra: bajas, contratos, fichajes, certificados y documentos quedan en el historial.",
    ],
    influye: [
      { texto: "Turnos y avisos del cuadrante", ruta: "/personal/cuadrantes" },
      { texto: "Horas y diferencias con el cuadrante", ruta: "/personal/fichajes" },
      { texto: "Coste de personal por centro", ruta: "/personal/nomina" },
      { texto: "Nóminas del mes", ruta: "/personal/nominas" },
      { texto: "Coste de personal en el Cuadro de mando", ruta: "/cuadro" },
    ],
  },

  // =====================================================================
  "/personal/cuadrantes": {
    titulo: "Cuadrantes",
    area: "Personal",
    paraQue:
      "Aquí se montan los turnos de la semana de un centro: quién trabaja cada día y en qué horario. Avisa de los fallos legales (poco descanso, horas de más, sin día libre) y calcula las horas y el coste previsto.",
    quien:
      "Para verlo: «Ver cuadrantes». Para poner y quitar turnos, copiar, publicar y crear turnos tipo: «Montar cuadrantes». El coste solo lo ve quien tiene «Ver coste de personal».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Elige un centro",
            queEs: "El cuadrante se monta centro a centro. Si arriba tienes «Todos mis centros», elige uno en el selector de centro.",
          },
          { nombre: "Semana del … al …", queEs: "Semana que estás viendo, de lunes a domingo." },
          { nombre: "Semana anterior / Esta semana / Semana siguiente", queEs: "Cambian de semana." },
          {
            nombre: "Borrador / Publicado",
            queEs: "Estado de la semana. «Publicado» con la fecha y hora en que se publicó.",
          },
          {
            nombre: "Copiar la semana anterior",
            queEs: "Copia los turnos de la semana anterior de este centro a esta semana.",
            logica:
              "No pisa los turnos que ya haya. No copia a quien esté de baja ni a quien tenga una ausencia aprobada ese día. Al final dice cuántos se copiaron y cuántos se saltaron.",
          },
          {
            nombre: "Publicar / Volver a publicar",
            queEs: "Marca la semana como publicada.",
            logica:
              "Queda apuntado quién y cuándo. Desde ese momento la semana sale en «Fichar (mi portal)» de cada persona (los borradores no salen). Cada cambio posterior queda anotado, pero el aviso a la plantilla (portal, WhatsApp) aún no se envía: si cambias turnos ya publicados, díselo a la persona. Se pueden seguir cambiando turnos después de publicar.",
          },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Personas", queEs: "Personas en la rejilla: activas de este centro, prestadas a él y quien ya tenga turno aquí esa semana." },
          { nombre: "Horas previstas", queEs: "Suma de horas de todos los turnos de este centro en la semana." },
          { nombre: "Avisos", queEs: "Número de avisos legales. Rojo si alguno es grave." },
          {
            nombre: "Coste previsto",
            queEs: "Horas × coste por hora del contrato de cada persona. Solo con «Ver coste de personal».",
            logica: COSTE_HORA + " Cada día con el contrato en vigor ese día (si cambia de contrato a mitad de semana, cada día con el suyo). Si no tiene salario ni coste por hora, sus horas cuentan a 0 €.",
          },
        ],
      },
      {
        titulo: "Rejilla (personas × 7 días)",
        campos: [
          { nombre: "Persona", queEs: "Nombre y puesto. «de …» indica que viene prestada de otro centro. Ordenadas por departamento y apellidos." },
          {
            nombre: "Celda con horario",
            queEs: "Turno de ese día en este centro. Si es partido salen los dos tramos.",
            logica: "En rojo si ese día tiene un aviso (pasa el ratón para leerlo). Si además tiene una ausencia, sale el tipo debajo.",
          },
          { nombre: "Celda gris con otro centro", queEs: "Ese día trabaja en otro centro. No se puede tocar desde aquí." },
          { nombre: "Celda ámbar", queEs: "Ausencia ese día (vacaciones, baja…). «(pedida)» si aún no está aprobada." },
          { nombre: "Libre", queEs: "Sin turno. Pulsa para ponerle uno." },
          {
            nombre: "Semana",
            queEs: "Horas de la semana (en todos los centros) y, debajo, «de X h» con su jornada de contrato.",
            logica: "En rojo si pasa de su jornada. «sin contrato» si no tiene contrato en vigor.",
          },
        ],
      },
      {
        titulo: "Editor del turno (al pulsar una celda)",
        campos: [
          { nombre: "Botones de turnos tipo", queEs: "Rellenan el horario con un turno tipo del centro (mañana, tarde, partido…)." },
          { nombre: "Entrada / Salida", queEs: "Horario del turno. Obligatorios. Si la salida es menor que la entrada, acaba al día siguiente (cierre de madrugada)." },
          { nombre: "Vuelve (partido) / Sale (partido)", queEs: "Segundo tramo si es turno partido. Hay que rellenar los dos o ninguno." },
          { nombre: "Pausa (min)", queEs: "Minutos de descanso que no cuentan como trabajo." },
          { nombre: "Notas", queEs: "Comentario del turno." },
          {
            nombre: "Guardar turno",
            queEs: "Guarda el turno (uno por persona y día; el partido va en el mismo).",
            logica:
              "La persona tiene que estar activa y tener este centro como principal o como préstamo. El turno tiene que tener más de 0 horas y como mucho 14. Si ese día ya tiene turno en otro centro, hay que quitarlo allí antes.",
          },
          { nombre: "Quitar turno (día libre)", queEs: "Borra el turno de ese día. Los fichajes reales no se tocan." },
          { nombre: "X", queEs: "Cierra el editor sin guardar." },
        ],
      },
      {
        titulo: "Avisos legales del cuadrante",
        campos: [
          { nombre: "Persona / Día", queEs: "A quién y qué día afecta. «Semana» si es de toda la semana." },
          {
            nombre: "Aviso",
            queEs: "Qué falla.",
            logica:
              "Rojo: descansa menos horas entre jornadas que el mínimo del convenio (12 h si no hay convenio); trabaja los siete días; tiene turnos pero no tiene contrato; tiene turno un día con ausencia aprobada. Ámbar: las horas de la semana pasan de su jornada de contrato. Se tienen en cuenta los turnos en todos sus centros y el domingo anterior para el descanso.",
          },
        ],
      },
      {
        titulo: "Totales por día",
        campos: [
          { nombre: "Día", queEs: "Día de la semana." },
          { nombre: "Personas", queEs: "Personas con turno ese día en este centro." },
          { nombre: "Horas", queEs: "Horas de trabajo previstas." },
          { nombre: "Coste previsto", queEs: "Horas × coste por hora. Solo con «Ver coste de personal»." },
        ],
      },
      {
        titulo: "Turnos tipo del centro",
        campos: [
          { nombre: "Nombre / Horario", queEs: "Turnos habituales para rellenar el cuadrante con un clic." },
          { nombre: "Ámbito", queEs: "«Este centro» o «Todos los centros»." },
          { nombre: "Retirar / Retirar en toda la cadena", queEs: "Deja de ofrecer ese turno tipo. Los turnos ya puestos no cambian.", logica: "Los de «Todos los centros» son comunes a la cadena: solo los retira quien ve todos los centros (sale «Retirar en toda la cadena»); a los demás les sale «Común a la cadena» sin botón." },
          {
            nombre: "Nombre, Entrada, Salida, Vuelve (partido), Sale (partido) y Crear turno tipo",
            queEs: "Crea un turno tipo para este centro.",
            logica: "El partido necesita inicio y fin del segundo tramo.",
          },
        ],
      },
    ],
    logica: [
      "Horas de un turno = duración de los tramos menos la pausa.",
      "El cuadrante es una previsión: lo que se paga y lo que cuenta como real son los fichajes.",
    ],
    influye: [
      { texto: "Se compara con los fichajes (retrasos, horas de más, sin fichar)", ruta: "/personal/fichajes" },
      { texto: "Horas y coste previstos del mes", ruta: "/personal/nomina" },
      { texto: "Las horas extra de la nómina son lo fichado por encima del turno", ruta: "/personal/nominas" },
      { texto: "El empleado ve sus turnos en su portal", ruta: "/personal/fichar" },
      { texto: "Cuadro de mando: los días sin fichaje se valoran con las horas del cuadrante", ruta: "/cuadro" },
    ],
    comoSeUsa: [
      "Elige el centro arriba y ve a la semana que quieras montar.",
      "Pulsa «Copiar la semana anterior» y ajusta los cambios celda a celda.",
      "Revisa «Avisos legales» hasta que no quede ninguno en rojo y pulsa «Publicar».",
    ],
  },

  // =====================================================================
  "/personal/fichajes": {
    titulo: "Fichajes",
    area: "Personal",
    paraQue:
      "Registro de horas de un día: quién ha fichado, a qué hora entró y salió y cuántas horas lleva. Sirve también de tableta para fichar en el local, para corregir fichajes olvidados y para ver las diferencias con el cuadrante de la última semana.",
    quien:
      "Para verla y fichar desde la tableta: «Ver fichajes». Para corregir, anular y añadir fichajes: «Corregir fichajes».",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          { nombre: "Subtítulo", queEs: "Centro elegido y día que estás viendo." },
          { nombre: "Día anterior / Hoy / Día siguiente", queEs: "Cambian de día. «Día siguiente» no sale si ya estás en hoy." },
        ],
      },
      {
        titulo: "Fichar en el centro (tableta del local)",
        campos: [
          {
            nombre: "Aviso «Elige un centro»",
            queEs: "Para fichar desde la tableta hay que elegir un centro en el selector de arriba.",
          },
          { nombre: "Persona", queEs: "Personas activas de este centro o prestadas a él." },
          {
            nombre: "PIN",
            queEs: "Las 4 cifras de su ficha.",
            logica: "Cada persona escribe el PIN de su ficha; si no coincide, sale «PIN incorrecto». A quien no tiene PIN solo le puede fichar quien tenga «Corregir fichajes», y queda registrado quién fichó por quién.",
          },
          {
            nombre: "Entrada / Inicio de pausa / Fin de pausa / Salida",
            queEs: "Registran el fichaje con la hora de este momento.",
            logica:
              "Se comprueba el orden: tras la entrada, pausa o salida; tras el inicio de pausa, solo fin de pausa; tras la salida, entrada. Si pasan más de 16 horas sin salida, se da por olvidada y se deja volver a entrar. Si el orden no cuadra, sale un mensaje con lo que toca.",
          },
        ],
      },
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Jornadas del día", queEs: "Personas que han fichado ese día." },
          {
            nombre: "Horas fichadas",
            queEs: "Suma de horas trabajadas.",
            logica: "Horas = de la entrada a la salida, menos las pausas. Un fichaje antes de las 5:00 cuenta para el día anterior (cierres de madrugada). Los anulados no cuentan.",
          },
          { nombre: "Incompletas", queEs: "Jornadas sin entrada, sin salida o con una pausa sin cerrar." },
          {
            nombre: "Diferencias (7 días)",
            queEs: "Número de incidencias entre cuadrante y fichajes de los 7 días que acaban en el día elegido. Rojo si alguna es «Sin fichar» o «Jornada incompleta».",
          },
        ],
      },
      {
        titulo: "Tabla de jornadas",
        campos: [
          { nombre: "Persona", queEs: "Al pulsarla se abre su ficha en la pestaña de fichajes." },
          { nombre: "Centro", queEs: "Centro de la última entrada." },
          { nombre: "Entrada / Salida", queEs: "Primera entrada y última salida del día." },
          { nombre: "Pausas", queEs: "Minutos de pausa fichados." },
          { nombre: "Horas", queEs: "Horas trabajadas." },
          { nombre: "Estado", queEs: "«Cerrada» o «Incompleta» (fila en ámbar)." },
        ],
      },
      {
        titulo: "Detalle al desplegar la jornada",
        campos: [
          { nombre: "Tipo / Hora / Origen", queEs: "Cada fichaje. Hora tachada = anulado. Origen: pantalla, tableta, móvil o manual." },
          { nombre: "Corrección", queEs: "Si fue anulado, corrige otro o se añadió a mano: quién, cuándo y el motivo." },
          {
            nombre: "Tipo, Hora, Motivo y Corregir",
            queEs: "Cambia el tipo o la hora de un fichaje. Motivo obligatorio.",
            logica: "El original queda anulado y se crea uno nuevo «manual» con el motivo. No se admiten horas futuras.",
          },
          { nombre: "Motivo y Anular", queEs: "Anula un fichaje erróneo. Deja de contar pero sigue visible, tachado, con el motivo." },
          {
            nombre: "Añadir fichaje olvidado, Hora, Motivo y Añadir",
            queEs: "Añade un fichaje a esa jornada (por defecto una salida). Motivo obligatorio.",
          },
        ],
      },
      {
        titulo: "Diferencias entre cuadrante y fichajes (últimos 7 días)",
        campos: [
          { nombre: "Día / Persona / Centro", queEs: "Dónde y cuándo." },
          { nombre: "Previsto", queEs: "Horario del cuadrante y sus horas." },
          { nombre: "Real", queEs: "Entrada y salida fichadas y horas trabajadas. «?» si falta." },
          { nombre: "Diferencia", queEs: "Horas reales − horas previstas (negativo = trabajó menos)." },
          {
            nombre: "Estado",
            queEs: "Qué pasa.",
            logica:
              "«Sin fichar» (rojo): tenía turno, ya ha empezado y no hay ningún fichaje. «Jornada incompleta» (rojo): el turno ya acabó y falta la salida o algo. «Retraso X min»: entró más de 5 minutos tarde. «Salió antes X min»: salió más de 5 minutos antes. «Horas de más»: trabajó más de 15 minutos por encima de lo previsto. «Fichó sin turno»: fichó un día sin turno en el cuadrante. Solo se listan las que no están correctas.",
          },
        ],
      },
      {
        titulo: "Integración",
        campos: [
          { nombre: "Sesame / Factorial", queEs: "Pendiente: para las cadenas que ya fichan con esos programas, se leerán de allí los fichajes y ausencias." },
        ],
      },
    ],
    logica: [FILTRO_CENTRO, "Ningún fichaje se borra: corregir y anular dejan rastro con motivo, autor y fecha."],
    influye: [
      { texto: "Horas y coste real del mes", ruta: "/personal/nomina" },
      { texto: "Horas extra de las nóminas (lo fichado por encima del turno)", ruta: "/personal/nominas" },
      { texto: "Coste de personal del Cuadro de mando (horas fichadas × coste/hora)", ruta: "/cuadro" },
      { texto: "Turnos previstos con los que se compara", ruta: "/personal/cuadrantes" },
    ],
  },

  // =====================================================================
  "/personal/ausencias": {
    titulo: "Ausencias",
    area: "Personal",
    paraQue:
      "Vacaciones, bajas médicas, permisos y demás ausencias del mes, en calendario y en lista. Aquí se registran y se aprueban, rechazan o anulan.",
    quien:
      "Para verla y registrar ausencias (quedan pedidas): «Ver ausencias». Para aprobar, rechazar, anular y para «Aprobar ya»: «Aprobar ausencias».",
    secciones: [
      {
        titulo: "Cabecera y cifras",
        campos: [
          { nombre: "Mes anterior / Este mes / Mes siguiente", queEs: "Cambian de mes." },
          { nombre: "Por aprobar", queEs: "Ausencias pedidas sin resolver, de cualquier fecha. Ámbar si hay alguna." },
          { nombre: "Aprobadas este mes", queEs: "Ausencias aprobadas que tocan algún día del mes." },
          {
            nombre: "Días de vacaciones",
            queEs: "Suma de días de las vacaciones aprobadas que tocan el mes.",
            logica: "Se suman los días completos de cada ausencia, aunque una parte caiga en otro mes.",
          },
          { nombre: "Bajas médicas", queEs: "Número de bajas por enfermedad o accidente aprobadas que tocan el mes." },
        ],
      },
      {
        titulo: "Calendario del mes",
        campos: [
          {
            nombre: "Cada día",
            queEs: "Personas ausentes ese día (nombre e inicial del apellido). Como mucho 4; si hay más, sale «+N más». Pasa el ratón para ver el nombre y el tipo.",
          },
          { nombre: "Colores", queEs: "Burdeos: aprobada · ámbar: pedida · rojo: baja médica. El día de hoy va recuadrado." },
        ],
      },
      {
        titulo: "Filtro y lista",
        campos: [
          { nombre: "Estado y Filtrar", queEs: "Todos, Pedidas, Aprobadas, Rechazadas o Anuladas." },
          { nombre: "Persona", queEs: "Al pulsarla se abre su ficha en la pestaña de ausencias." },
          { nombre: "Tipo", queEs: "Vacaciones, Asuntos propios, Permiso retribuido, Baja por enfermedad o accidente no laboral, Baja por accidente de trabajo, Nacimiento, Excedencia o Sin justificar." },
          { nombre: "Desde / Hasta", queEs: "Primer y último día." },
          { nombre: "Días", queEs: "Días naturales, contando fines de semana." },
          { nombre: "Centro", queEs: "Centro principal de la persona cuando se registró." },
          { nombre: "Estado", queEs: "Pedida (ámbar, fila en ámbar), Aprobada (verde), Rechazada (rojo) o Anulada." },
        ],
      },
      {
        titulo: "Detalle al desplegar la fila",
        campos: [
          { nombre: "Puesto, Comentario, Pedida por", queEs: "Datos de la petición." },
          { nombre: "Resuelta", queEs: "Quién y cuándo la resolvió, o «Pendiente»." },
          { nombre: "Motivo", queEs: "Motivo del rechazo o de la anulación, si se escribió." },
          { nombre: "Motivo (obligatorio para rechazar)", queEs: "Texto que se guarda con la decisión." },
          {
            nombre: "Aprobar / Rechazar / Anular",
            queEs: "Aprobar y Rechazar solo para las pedidas. Anular sirve para pedidas y aprobadas.",
            logica: "Al aprobar, si la persona tiene turnos esos días, sale un aviso para cambiarlos en el cuadrante (no se quitan solos).",
          },
        ],
      },
      {
        titulo: "Registrar ausencia",
        campos: [
          { nombre: "Persona", queEs: "Personas activas de tus centros." },
          { nombre: "Tipo, Desde, Hasta, Comentario", queEs: "Datos de la ausencia. «Hasta» no puede ser anterior a «Desde»." },
          { nombre: "Aprobar ya", queEs: "Solo con permiso de aprobar: se guarda ya aprobada. Si no, queda pedida." },
          {
            nombre: "Guardar",
            queEs: "Registra la ausencia.",
            logica: "No puede solaparse con otra ausencia pedida o aprobada de la misma persona. Los datos de salud de las bajas no se escriben en el comentario.",
          },
        ],
      },
    ],
    logica: [FILTRO_CENTRO, "Se listan las ausencias que tocan algún día del mes elegido."],
    influye: [
      { texto: "Las aprobadas salen en el cuadrante y avisan si hay turno ese día", ruta: "/personal/cuadrantes" },
      { texto: "Saldo de vacaciones de la persona", ruta: "/personal/empleados/[id]" },
      {
        texto: "En la nómina: las bajas aprobadas pagan incapacidad temporal (enfermedad o accidente no laboral desde el 4.º día; accidente de trabajo desde el día siguiente); «Sin justificar» y «Excedencia» descuentan días sin sueldo",
        ruta: "/personal/nominas",
      },
      { texto: "Días de ausencia por tipo en el fichero para la gestoría", ruta: "/personal/nomina" },
    ],
  },

  // =====================================================================
  "/personal/formacion": {
    titulo: "Formación y certificados",
    area: "Personal",
    paraQue:
      "Control de los carnés obligatorios con caducidad (manipulador de alimentos, alérgenos, prevención de riesgos, carretillero…) y de las formaciones internas. Te dice quién los tiene caducados o a punto de caducar y a quién le falta alguno obligatorio.",
    quien: "Para verla: «Ver formación y certificados». Para registrar y retirar: «Registrar certificados y formaciones».",
    secciones: [
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Caducados", queEs: "Certificados en vigor cuya fecha de caducidad ya pasó. Al pulsar, filtra la lista." },
          { nombre: "Caducan en 30 días", queEs: "Caducan entre hoy y dentro de 30 días. Al pulsar, filtra la lista." },
          {
            nombre: "Personas sin manipulador o alérgenos",
            queEs: "Personas activas de cocina, sala, barra, office u obrador sin el carné de manipulador o el de alérgenos en vigor.",
            logica: "Se mira el departamento del puesto. Si no tiene puesto, no se comprueba.",
          },
        ],
      },
      {
        titulo: "Les falta un certificado obligatorio en vigor",
        campos: [
          { nombre: "Persona", queEs: "Al pulsarla se abre su ficha en la pestaña de formación." },
          { nombre: "Puesto / Centro", queEs: "Su puesto y su centro principal." },
          { nombre: "Falta", queEs: "Qué certificado le falta: Manipulador de alimentos y/o Alérgenos." },
        ],
      },
      {
        titulo: "Filtros y lista",
        campos: [
          { nombre: "Estado", queEs: "Todos, Caducados, Caducan en 30 días o En vigor (sin caducidad o aún no caducados)." },
          { nombre: "Tipo y Filtrar", queEs: "Tipo de certificado." },
          { nombre: "Persona / Certificado / Centro / Obtenido", queEs: "De quién es, nombre, centro principal y fecha de obtención." },
          { nombre: "Caducidad", queEs: "Verde «Hasta el …», ámbar «Caduca el …» (30 días o menos), rojo «Caducado el …», o «Sin caducidad»." },
          { nombre: "Detalle: Tipo, Entidad, Puesto, Registrado", queEs: "Datos del certificado al desplegar la fila." },
          { nombre: "Retirar", queEs: "Quita el certificado de los vigentes. No se borra." },
        ],
      },
      {
        titulo: "Registrar certificado o formación",
        campos: [
          { nombre: "Persona", queEs: "Personas activas." },
          { nombre: "Tipo", queEs: "Manipulador de alimentos, Alérgenos, Prevención de riesgos laborales, Carretillero, Permiso de trabajo, Formación interna u Otro." },
          { nombre: "Nombre (opcional)", queEs: "Si se deja vacío, se usa el nombre del tipo." },
          { nombre: "Entidad", queEs: "Quién lo expide." },
          { nombre: "Obtenido / Caduca", queEs: "Fechas. La caducidad no puede ser anterior a la obtención." },
          {
            nombre: "Guardar",
            queEs: "Registra el certificado.",
            logica: "Sustituye al anterior del mismo tipo (que queda en el historial como «Sustituido»), salvo «Formación interna» y «Otro», que se acumulan.",
          },
        ],
      },
    ],
    logica: [
      "Solo cuentan personas activas con centro principal en los centros elegidos arriba.",
      "Un certificado sin fecha de caducidad se considera siempre en vigor.",
    ],
    influye: [
      { texto: "Avisos de caducidad en el resumen de Personal", ruta: "/personal" },
      { texto: "«Certificado caducado» en la lista de empleados", ruta: "/personal/empleados" },
    ],
  },

  // =====================================================================
  "/personal/seleccion": {
    titulo: "Selección",
    area: "Personal",
    paraQue:
      "Ofertas de empleo, candidatos de cada oferta y bolsa de candidatos para cubrir bajas y temporada. Al contratar a un candidato se crea su ficha de empleado con sus datos.",
    quien:
      "Para verla: «Ver selección». Para publicar ofertas, añadir candidatos y cambiar estados: «Publicar ofertas, gestionar y contratar candidatos». Para «Contratar» hace falta además «Altas, bajas y contratos».",
    secciones: [
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Ofertas abiertas", queEs: "Ofertas en estado «Abierta» y, debajo, la suma de sus plazas." },
          { nombre: "Candidatos en proceso", queEs: "Candidatos de ofertas en estado Entrevista, Prueba u Oferta." },
          { nombre: "Bolsa de candidatos", queEs: "Candidatos sin oferta concreta que no están contratados." },
        ],
      },
      {
        titulo: "Tabla de ofertas",
        campos: [
          { nombre: "Oferta / Centro / Puesto / Plazas", queEs: "Título, centro, puesto y plazas a cubrir." },
          { nombre: "Candidatos", queEs: "Número de candidatos apuntados." },
          { nombre: "Estado", queEs: "Abierta (azul), Cubierta (verde) o Cerrada." },
          { nombre: "Detalle: Publicada, Contrato, Jornada, Descripción", queEs: "Datos de la oferta al desplegarla." },
          {
            nombre: "Añadir candidato (Nombre, Apellidos, Teléfono, Correo, Origen, Acepta guardar sus datos un año)",
            queEs: "Apunta un candidato a la oferta. Solo en ofertas abiertas.",
            logica:
              "El nombre es obligatorio y hace falta al menos teléfono o correo. Con la casilla de consentimiento marcada sus datos se guardan un año; sin ella, 90 días.",
          },
          {
            nombre: "Marcar cubierta / Cerrar / Reabrir",
            queEs: "Cambian el estado de la oferta.",
            logica: "La oferta se marca «Cubierta» sola cuando el número de contratados llega a las plazas.",
          },
        ],
      },
      {
        titulo: "Tabla de candidatos (en cada oferta y en la bolsa)",
        campos: [
          { nombre: "Candidato / Contacto / Origen", queEs: "Nombre, teléfono y correo, y de dónde vino (web, InfoJobs…)." },
          { nombre: "Estado", queEs: "Recibido, Entrevista, Prueba, Oferta, Contratado o Descartado." },
          {
            nombre: "Datos hasta",
            queEs: "Fecha hasta la que se pueden guardar sus datos (protección de datos).",
            logica: "Un año desde el alta con consentimiento; 90 días sin él. Pasada la fecha el candidato deja de salir y sus datos se borran: solos, la próxima vez que se apunte un candidato, o con el botón «Borrar sus datos ahora» del aviso de arriba. Los contratados no se borran (ya tienen su ficha).",
          },
          {
            nombre: "Estado, Nota y Cambiar",
            queEs: "Cambia el estado del candidato y añade una nota (se suma a las anteriores).",
            logica: "No se puede pasar a «Contratado» desde aquí: se usa «Contratar».",
          },
          {
            nombre: "Centro, Puesto, Fecha y Contratar",
            queEs: "Crea la ficha de empleado con el nombre, teléfono y correo del candidato, sin contrato.",
            logica:
              "Por defecto, centro y puesto de la oferta. Te lleva a la ficha nueva, pestaña Contratos, para completarla. No sale para candidatos descartados.",
          },
          { nombre: "Ver ficha", queEs: "En candidatos ya contratados, abre su ficha de empleado." },
        ],
      },
      {
        titulo: "Bolsa de candidatos (sin oferta concreta)",
        campos: [
          {
            nombre: "Centro, Nombre, Apellidos, Teléfono, Correo, Notas, consentimiento y Añadir a la bolsa",
            queEs: "Guarda a alguien para llamarle cuando haga falta, en la bolsa del centro elegido (por defecto, el de arriba). Mismas reglas que en las ofertas.",
          },
        ],
      },
      {
        titulo: "Publicar oferta de empleo",
        campos: [
          { nombre: "Título", queEs: "Obligatorio. Por ejemplo, «Camarero/a de sala»." },
          { nombre: "Centro", queEs: "Obligatorio." },
          { nombre: "Puesto, Tipo de contrato, Jornada (h/sem)", queEs: "Opcionales." },
          { nombre: "Plazas", queEs: "Mínimo 1." },
          { nombre: "Descripción", queEs: "Texto de la oferta." },
          {
            nombre: "Publicar oferta",
            queEs: "Crea la oferta abierta.",
            logica: "Por ahora solo queda en el ERP; saldrá en «Trabaja con nosotros» de la web cuando esté el módulo Webs.",
          },
        ],
      },
    ],
    logica: [
      "Las ofertas y la bolsa se filtran por el centro elegido arriba (o todos tus centros). Solo se apuntan candidatos a ofertas abiertas de tus centros; para una oferta cubierta o cerrada, reábrela o usa la bolsa.",
      "Aviso «N candidatos han pasado su fecha de borrado»: cuántos de tus centros ya no se pueden guardar. «Borrar sus datos ahora» los borra (necesita «Publicar ofertas, gestionar y contratar candidatos»); queda registrado cuántos, sin sus datos.",
    ],
    influye: [
      { texto: "Al contratar se crea la ficha de empleado", ruta: "/personal/empleados" },
    ],
  },

  // =====================================================================
  "/personal/nominas": {
    titulo: "Nóminas",
    area: "Personal",
    paraQue:
      "Cálculo de las nóminas de cada mes por persona y centro: bruto, deducciones, neto y coste para la empresa. Sirve para conocer y revisar el coste de personal; la nómina oficial la hace la gestoría.",
    quien:
      "Para verla: «Ver las nóminas». Para calcular, cerrar y marcar como pagadas: «Calcular, cerrar y marcar pagadas las nóminas».",
    secciones: [
      {
        titulo: "Cabecera, cifras y filtros",
        campos: [
          { nombre: "Mes anterior / Mes siguiente", queEs: "Cambian de mes manteniendo el centro." },
          {
            nombre: "Mes que se abre",
            queEs: "Si no eliges, se abre el último mes que tiene nóminas; si no hay ninguna, el mes pasado.",
          },
          {
            nombre: "Nóminas",
            queEs: "Número de nóminas del mes. Debajo: cuántas están en borrador, cuántas cerradas pendientes de pago, «todas pagadas» o «sin calcular».",
          },
          { nombre: "Bruto (devengado)", queEs: "Suma de los brutos. Debajo, las horas extra que incluye." },
          { nombre: "Neto a pagar", queEs: "Suma de lo que cobran las personas." },
          { nombre: "Coste empresa", queEs: "Suma del coste total; debajo, cuánto es Seguridad Social a cargo de la empresa." },
          { nombre: "Mes, Centro, Estado y Ver", queEs: "Filtros. Las cifras de arriba y los totales por centro no se ven afectados por el filtro de estado." },
          { nombre: "Meses con nóminas", queEs: "Atajos a los últimos 6 meses que tienen nóminas." },
        ],
      },
      {
        titulo: "Totales por centro",
        campos: [
          { nombre: "Centro / Personas", queEs: "Centro y número de nóminas." },
          { nombre: "Bruto", queEs: "Total devengado." },
          { nombre: "SS trabajador", queEs: "Seguridad Social que se descuenta a las personas." },
          { nombre: "IRPF", queEs: "Retenciones de IRPF." },
          { nombre: "Neto", queEs: "Líquido a cobrar." },
          { nombre: "SS empresa", queEs: "Seguridad Social que paga la empresa." },
          { nombre: "Coste empresa", queEs: "Bruto + SS empresa − pago delegado de incapacidad temporal." },
          { nombre: "Estado", queEs: "Estados de las nóminas de ese centro." },
        ],
      },
      {
        titulo: "Calcular y cerrar",
        campos: [
          {
            nombre: "Calcular borradores de …",
            queEs: "Calcula (o recalcula) las nóminas del mes en borrador, del centro elegido o de todos tus centros.",
            logica:
              "Solo rehace los borradores: las cerradas y pagadas no se tocan. Entra quien tiene ese centro como principal y estuvo en alta algún día del mes. Quien no tiene contrato con salario no tiene nómina (el mensaje dice cuántos).",
          },
          {
            nombre: "Cerrar N borradores",
            queEs: "Pasa todos los borradores del mes (y del centro, si hay) a «Cerrada».",
            logica: "Una nómina cerrada ya no se recalcula. Queda anotado quién y cuándo.",
          },
          {
            nombre: "Fecha de pago y Marcar N como pagadas",
            queEs: "Pasa las cerradas a «Pagada» con esa fecha.",
          },
        ],
      },
      {
        titulo: "Tabla de nóminas",
        campos: [
          { nombre: "Empleado", queEs: "Al pulsarlo se abre su ficha." },
          { nombre: "Puesto / Centro", queEs: "Puesto y centro principal de ese mes." },
          { nombre: "Días", queEs: "Días cotizados (mes de 30 días) y, en rojo, días de baja médica (IT)." },
          { nombre: "Bruto / Neto / Coste empresa", queEs: "Importes de la nómina." },
          { nombre: "Estado", queEs: "Borrador (ámbar, fila en ámbar), Cerrada (azul) o Pagada (verde)." },
        ],
      },
      {
        titulo: "Detalle de la nómina (al desplegar)",
        campos: [
          { nombre: "Código / DNI, N.º Seguridad Social", queEs: "Identificación." },
          { nombre: "Contrato / Categoría", queEs: "Tipo de contrato, jornada semanal y categoría." },
          { nombre: "Periodo", queEs: "Primer y último día pagado: entre el 1 y el fin de mes, recortado por el alta, la baja y el fin del contrato." },
          { nombre: "Días", queEs: "Cotizados, de baja (IT) y sin sueldo." },
          { nombre: "Horas fichadas", queEs: "Horas trabajadas según los fichajes del periodo." },
          {
            nombre: "Horas extra / Horas complementarias",
            queEs: "Horas pagadas por encima del turno. Se llaman «complementarias» si el contrato es a tiempo parcial o de menos de 40 h/semana (la misma regla que el cálculo).",
            logica:
              "Por cada día fichado: horas fichadas − horas del turno del cuadrante. Solo cuenta si pasa de 15 minutos; un día fichado sin turno cuenta entero. El total se redondea hacia abajo a cuartos de hora. A tiempo completo se pagan a la hora ordinaria × 1,25; a tiempo parcial (o jornada de menos de 40 h) son «complementarias», sin recargo.",
          },
          {
            nombre: "Base contingencias comunes",
            queEs: "Base sobre la que se calcula la Seguridad Social.",
            logica: "Paga mensual + complementos que cotizan + parte proporcional de las pagas extra (aunque no se prorrateen), por los días en alta menos los días sin sueldo. Tope de ejemplo: 5.101,20 € al mes.",
          },
          { nombre: "Base profesionales", queEs: "La anterior más las horas extra (no las complementarias)." },
          { nombre: "Retención IRPF", queEs: "Porcentaje e importe. El del contrato o, si está vacío, uno orientativo según el salario." },
          {
            nombre: "Pago delegado IT",
            queEs: "Prestación de baja médica que adelanta la empresa y luego se descuenta de los seguros sociales.",
          },
          { nombre: "Cuenta de cobro", queEs: "IBAN tapado (4 primeros y 4 últimos caracteres)." },
          { nombre: "Pago / Calculada / Cerrada", queEs: "Fechas de pago, cálculo y cierre." },
          {
            nombre: "Devengos",
            queEs: "Lo que cobra: Salario base, Mejora voluntaria, complementos, prorrata o paga extra, horas extra e incapacidad temporal.",
            logica:
              "Paga = salario bruto anual ÷ pagas. «Salario base» es la parte de la tabla del convenio (salario base de la categoría × jornada ÷ 40); «Mejora voluntaria» es lo que se paga por encima. Se pagan por días: paga ÷ 30 × días pagados. Prorrata de pagas extra = paga × (pagas − 12) ÷ 12 al mes. Si no se prorratean (norma general, a comprobar con la gestoría y el convenio): la de verano se gana de enero a junio y se cobra en junio; la de Navidad, de julio a diciembre y se cobra en diciembre; cada una = paga × (pagas − 12) ÷ 2 × días del semestre con contrato y sin baja ni ausencia sin sueldo ÷ días del semestre. En el mes de la baja se cobra la parte ganada del semestre.",
          },
          {
            nombre: "Deducciones",
            queEs: "Seguridad Social del trabajador e IRPF.",
            logica:
              "Porcentajes de ejemplo: contingencias comunes 4,7 %, equidad intergeneracional 0,15 %, desempleo 1,55 % (1,6 % si es temporal o prácticas), formación 0,1 %, horas extra 4,7 %. IRPF sobre el bruto menos los complementos que no tributan.",
          },
          {
            nombre: "Aportación de la empresa",
            queEs: "Seguridad Social que paga la empresa.",
            logica:
              "Porcentajes de ejemplo: contingencias comunes 23,6 %, equidad intergeneracional 0,75 %, accidentes de trabajo 1,5 %, desempleo 5,5 % (6,7 % temporal), garantía salarial 0,2 %, formación 0,6 %, horas extra 23,6 %.",
          },
          {
            nombre: "Líquido a percibir / Coste total empresa",
            queEs: "Neto = bruto − SS trabajador − IRPF − otras deducciones. Coste = bruto + SS empresa − pago delegado de IT.",
          },
          { nombre: "Cerrar esta nómina / Fecha de pago y Marcar como pagada", queEs: "Cambian el estado solo de esa nómina." },
        ],
      },
      {
        titulo: "Avisos de abajo",
        campos: [
          {
            nombre: "Cálculo de ejemplo",
            queEs:
              "Los porcentajes de Seguridad Social, el IRPF orientativo, el recargo de las horas extra (1,25) y la incapacidad temporal son DE EJEMPLO, no son los legales del año: hay que comprobarlos con la gestoría. Debajo, las reglas generales que se aplican a las pagas extra y a las bajas (muchos convenios las cambian).",
          },
          { nombre: "Gestoría (nóminas)", queEs: "Pendiente: importar los recibos oficiales de la gestoría, compararlos con este cálculo y publicarlos en el portal del empleado." },
        ],
      },
    ],
    logica: [
      "Mes comercial de 30 días: quien está todo el mes en alta cobra 30 días, también en febrero o en meses de 31.",
      "Si en el mes hay varios contratos, se usa el último (el que manda a fin de mes).",
      "Baja por enfermedad o accidente no laboral (aprobada), según el día de la baja: días 1 a 3 sin prestación; 4 a 15 al 60 % a cargo de la empresa; 16 a 20 al 60 % y desde el 21 al 75 % en pago delegado. Base diaria = base de cotización normal ÷ 30.",
      "Baja por accidente de trabajo (aprobada): el día del accidente se paga como trabajado; desde el día siguiente, 75 % de la base diaria en pago delegado (lo paga la mutua; la empresa lo adelanta y lo descuenta). La base real del accidente suma la media de horas extra del año anterior: lo ajusta la gestoría.",
      "Son reglas generales de ejemplo: compruébalas siempre con la gestoría (el convenio puede mejorar la prestación o cambiar las pagas).",
      "Ausencias «Sin justificar» y «Excedencia» aprobadas: días sin sueldo y sin cotizar.",
      "Ejemplo (porcentajes de ejemplo): 21.000 € al año, 14 pagas prorrateadas, indefinido, todo el mes → paga 1.500 €, prorrata 250 €, bruto 1.750 €; SS trabajador ≈ 113,75 €; IRPF orientativo 11 % = 192,50 €; neto ≈ 1.443,75 €; SS empresa ≈ 562,63 €; coste empresa ≈ 2.312,63 €.",
    ],
    influye: [
      { texto: "Las nóminas de la persona salen en su ficha", ruta: "/personal/empleados/[id]" },
      { texto: "Las horas extra salen de los fichajes y del cuadrante", ruta: "/personal/fichajes" },
      {
        texto: "El coste empresa de estas nóminas (también en borrador) manda en el Cuadro de mando: el personal de ese centro y mes es su coste empresa repartido por días, y solo los meses sin nóminas usan las horas × coste/hora. En Contabilidad (resumen) sale por sociedad junto a lo apuntado como personal, para comprobar que cuadra; no se suma a los gastos, para no contarlo dos veces",
        ruta: "/cuadro",
      },
    ],
    comoSeUsa: [
      "A primeros de mes: elige el mes pasado y pulsa «Calcular borradores».",
      "Revisa cada nómina desplegándola y compárala con lo que mande la gestoría. Si cambias fichajes, ausencias o contratos, vuelve a calcular.",
      "Cuando esté bien, «Cerrar»; cuando se pague, «Marcar como pagadas».",
    ],
  },

  // =====================================================================
  "/personal/nomina": {
    titulo: "Costes de personal y nómina",
    area: "Personal",
    paraQue:
      "Horas y coste de personal del mes, previsto (cuadrante) y real (fichajes), por centro y por día. Además, la exportación de horas y ausencias para mandar a la gestoría.",
    quien:
      "Para verla: «Ver coste de personal». La exportación a la gestoría necesita «Exportar las variables de nómina a la gestoría».",
    secciones: [
      {
        titulo: "Cifras",
        campos: [
          { nombre: "Mes anterior / Este mes / Mes siguiente", queEs: "Cambian de mes." },
          { nombre: "Horas previstas", queEs: "Horas de los turnos del cuadrante del mes (publicados o no)." },
          { nombre: "Coste previsto", queEs: "Horas del cuadrante × coste por hora del contrato en vigor cada día." },
          { nombre: "Horas fichadas", queEs: "Horas reales de los fichajes." },
          {
            nombre: "Coste real",
            queEs: "Horas fichadas × coste por hora.",
            logica: "Si alguien no tiene coste por hora (contrato sin salario ni coste), sus horas cuentan a 0 € y la cifra sale en ámbar diciendo cuántas horas son.",
          },
          { nombre: "Nota de abajo", queEs: COSTE_HORA + " Los préstamos cuentan en el centro donde se trabaja." },
        ],
      },
      {
        titulo: "Por centro",
        campos: [
          { nombre: "Centro", queEs: "Ordenados de más a menos coste real." },
          { nombre: "Horas previstas / Coste previsto", queEs: "Del cuadrante." },
          { nombre: "Horas reales / Coste real", queEs: "De los fichajes." },
        ],
      },
      {
        titulo: "Por día",
        campos: [
          { nombre: "Día", queEs: "Solo los días con turnos o fichajes." },
          { nombre: "Horas previstas, Coste previsto, Horas reales, Coste real", queEs: "Los mismos datos, día a día, sumando todos los centros." },
        ],
      },
      {
        titulo: "Exportación mensual para la gestoría",
        campos: [
          { nombre: "Mes / Sociedad / Ver", queEs: "Elige mes y sociedad (o todas) y pulsa «Ver» para cargar la tabla." },
          {
            nombre: "Descargar CSV de horas",
            queEs: "Descarga un fichero para Excel (separado por punto y coma, con coma decimal) con una fila por persona.",
            logica:
              "Descarga el mes y la sociedad escritos en el formulario (no hace falta pulsar antes «Ver»). Columnas: sociedad, CIF, código, nombre, DNI, NSS, centro, contrato, jornada, horas de contrato del mes, horas de cuadrante, horas fichadas, horas extra, días de cada tipo de ausencia, alta y baja en el mes.",
          },
          { nombre: "Sociedad", queEs: "La del contrato, si no la de la ficha, si no la del centro principal." },
          { nombre: "Empleado / Centro", queEs: "Nombre con código y centro principal." },
          {
            nombre: "Contrato mes",
            queEs: "Horas que le tocan por contrato en el mes.",
            logica: "Jornada semanal × días en alta del mes ÷ 7.",
          },
          { nombre: "Fichadas", queEs: "Horas reales fichadas en el mes." },
          {
            nombre: "Extra o complementarias",
            queEs: "Horas fichadas por encima del turno del cuadrante en el mes (complementarias si el contrato es a tiempo parcial).",
            logica: "La misma regla que la pantalla «Nóminas»: por cada día fichado, horas fichadas − horas del turno; solo cuenta si pasa de 15 minutos; un día fichado sin turno cuenta entero; el total se redondea hacia abajo a cuartos de hora.",
          },
          { nombre: "Ausencias", queEs: "Días de ausencias aprobadas en el mes (todas juntas; en el fichero van por tipo)." },
          { nombre: "Alta / baja", queEs: "Fecha de alta o de baja si caen en el mes." },
          { nombre: "Gestoría (nóminas)", queEs: "Pendiente el envío automático. Por ahora, descarga el CSV y mándaselo." },
        ],
      },
    ],
    logica: [
      FILTRO_CENTRO,
      "Las horas de un día cuentan en el centro donde se fichó o donde estaba el turno, aunque la persona sea de otro centro.",
    ],
    influye: [
      { texto: "El Cuadro de mando usa este mismo coste: horas fichadas y, si un turno no tiene fichaje, las del cuadrante", ruta: "/cuadro" },
      { texto: "Las horas previstas salen del cuadrante", ruta: "/personal/cuadrantes" },
      { texto: "Las horas reales salen de los fichajes", ruta: "/personal/fichajes" },
      { texto: "El coste por hora sale del contrato de cada persona", ruta: "/personal/empleados" },
    ],
  },

  // =====================================================================
  "/personal/ajustes": {
    titulo: "Puestos y convenios",
    area: "Personal",
    paraQue:
      "Catálogos comunes de la cadena para las fichas y los contratos: los puestos de trabajo (con su departamento) y los convenios con sus categorías.",
    quien: "Quien tenga «Altas, bajas y contratos». El salario base de las categorías solo lo ve quien tiene «Ver salarios».",
    secciones: [
      {
        titulo: "Puestos",
        campos: [
          { nombre: "Puesto / Departamento", queEs: "Nombre del puesto y su departamento." },
          { nombre: "Personas", queEs: "Personas activas con ese puesto." },
          { nombre: "Estado", queEs: "Activo o Retirado." },
          {
            nombre: "Retirar / Reactivar",
            queEs: "Un puesto retirado deja de ofrecerse en las fichas y ofertas; quien ya lo tiene lo conserva.",
          },
          {
            nombre: "Nuevo puesto, Departamento y Crear",
            queEs: "Crea un puesto. No puede repetirse el nombre.",
            influye: "El departamento decide si se exigen los carnés de manipulador y alérgenos (cocina, sala, barra, office y obrador) y el filtro de la lista de empleados.",
          },
        ],
      },
      {
        titulo: "Convenios y categorías",
        campos: [
          { nombre: "Convenio", queEs: "Nombre y comunidad." },
          {
            nombre: "Vacaciones",
            queEs: "Días de vacaciones al año.",
            influye: "Es el derecho de vacaciones de quien tiene un contrato con este convenio.",
          },
          {
            nombre: "Descanso mín.",
            queEs: "Horas mínimas de descanso entre dos jornadas.",
            influye: "El cuadrante avisa en rojo si se descansa menos.",
          },
          { nombre: "Categoría", queEs: "Categoría profesional y nivel." },
          {
            nombre: "Salario base",
            queEs: "Salario base anual de la categoría a jornada completa (40 h). Solo con «Ver salarios».",
            influye: "En la nómina separa «Salario base» de «Mejora voluntaria».",
          },
          {
            nombre: "Nuevo convenio: Nombre, Comunidad, Días de vacaciones, Descanso mínimo (h), Horas al año, Crear",
            queEs: "Crea un convenio. No puede repetirse el nombre.",
            logica: "Si dejas vacíos los días de vacaciones o el descanso, se usan los valores por defecto (30 días y 12 h).",
            influye: "«Horas al año» sirve para el precio de la hora extra en la nómina (si está vacío, 1.776 h).",
          },
          {
            nombre: "Convenio, Nueva categoría, Nivel, Salario base anual (€), Añadir",
            queEs: "Añade una categoría a un convenio.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Puestos y categorías en la ficha del empleado", ruta: "/personal/empleados/nuevo" },
      { texto: "Descanso mínimo en los avisos del cuadrante", ruta: "/personal/cuadrantes" },
      { texto: "Faltan carnés obligatorios según el departamento", ruta: "/personal/formacion" },
      { texto: "Salario base y horas al año en el cálculo de la nómina", ruta: "/personal/nominas" },
    ],
  },

  // =====================================================================
  "/personal/fichar": {
    titulo: "Fichar (mi portal)",
    area: "Personal",
    paraQue:
      "Portal del propio empleado, pensado para el móvil: fichar la entrada, las pausas y la salida, ver sus próximos turnos y su saldo de vacaciones, y pedir vacaciones o permisos.",
    quien:
      "Quien tenga el permiso «Usar el portal del empleado» y cuyo usuario esté enlazado a su ficha de empleado (en la ficha, campo «Usuario de acceso»). Si no está enlazado, sale un aviso para pedírselo a Recursos Humanos.",
    secciones: [
      {
        titulo: "Cabecera",
        campos: [
          {
            nombre: "Hola, … / Hoy trabajas en …",
            queEs: "Saludo y, si hoy tiene turno, el centro y el horario (de la entrada a la última salida). Si no, «Hoy no tienes turno».",
          },
        ],
      },
      {
        titulo: "Fichar",
        campos: [
          {
            nombre: "Centro",
            queEs: "Solo sale si puede trabajar en varios centros. Por defecto, el del turno de hoy (aunque su semana esté aún en borrador) o su centro principal.",
          },
          {
            nombre: "Botones Entrada / Inicio de pausa / Fin de pausa / Salida",
            queEs: "Registran el fichaje con la hora de este momento. Solo salen los que tocan.",
            logica:
              "Orden: entrada → (inicio de pausa → fin de pausa) → salida. Si pasan más de 16 horas sin salida, se da por olvidada y se puede volver a entrar. Se guarda con origen «móvil».",
            influye: "Cuenta como horas trabajadas en «Fichajes», en el coste de personal y en las horas extra de la nómina.",
          },
          { nombre: "Último fichaje", queEs: "Tipo y hora del último. Si parece que olvidó la salida, pide que avise a su encargado." },
        ],
      },
      {
        titulo: "Mis próximos turnos",
        campos: [
          { nombre: "Día, Centro, Horario, Horas", queEs: "Turnos de hoy y los 13 días siguientes, con las horas de trabajo.", logica: "Solo salen las semanas cuyo cuadrante está publicado en ese centro; los borradores aún pueden cambiar y no se enseñan." },
        ],
      },
      {
        titulo: "Vacaciones",
        campos: [
          { nombre: "Vacaciones (año)", queEs: "Días de derecho este año según el convenio (proporcionales si entró este año)." },
          { nombre: "Aprobadas y pedidas", queEs: "Días de vacaciones ya aprobados más los pedidos pendientes." },
          { nombre: "Te quedan", queEs: "Derecho menos aprobadas y pedidas. En rojo si es negativo." },
        ],
      },
      {
        titulo: "Pedir vacaciones o permiso",
        campos: [
          { nombre: "Tipo", queEs: "Vacaciones, Asuntos propios o Permiso retribuido." },
          { nombre: "Comentario, Desde, Hasta", queEs: "Fechas y un comentario. «Hasta» no puede ser antes que «Desde»." },
          {
            nombre: "Enviar petición",
            queEs: "Envía la petición: queda «Pedida» hasta que la apruebe el encargado.",
            logica: "No puede solaparse con otra ausencia pedida o aprobada.",
            influye: "Sale en «Ausencias» para aprobar y en el cuadrante como «(pedida)».",
          },
          { nombre: "Tabla Tipo, Fechas, Estado", queEs: "Sus ausencias de hoy en adelante y cómo están." },
        ],
      },
    ],
    influye: [
      { texto: "Fichajes del día", ruta: "/personal/fichajes" },
      { texto: "Peticiones por aprobar", ruta: "/personal/ausencias" },
      { texto: "Turnos del cuadrante", ruta: "/personal/cuadrantes" },
    ],
  },
};
