import type { AyudaArea } from "../tipos";

const AREA = "Proveedores";

const CAMPOS_FORMULARIO = [
  {
    nombre: "Nombre",
    queEs: "Nombre del proveedor. Obligatorio (al menos 2 letras).",
    logica: "No puede haber dos proveedores con el mismo nombre (sin contar mayúsculas), aunque uno esté desactivado: en ese caso hay que volver a activarlo.",
  },
  { nombre: "CIF", queEs: "CIF del proveedor.", influye: "Se copia a las facturas recibidas de este proveedor." },
  { nombre: "Persona de contacto", queEs: "Con quién se habla para los pedidos." },
  {
    nombre: "Teléfono (WhatsApp)",
    queEs: "Teléfono para mandar los pedidos por WhatsApp, siempre con el prefijo del país (+34 en España).",
    logica:
      "Se quitan espacios, guiones, puntos y paréntesis; «0034…» pasa a «+34…»; un número español de 9 cifras sin prefijo se completa con +34. No se admite un + sin el 34 delante de un número español (por ejemplo +638…), ni un número español que no tenga 9 cifras. Si está mal, no se guarda y sale el motivo.",
    influye: "Con él se abre WhatsApp con el pedido ya escrito desde las compras de Bebidas y Comidas.",
  },
  { nombre: "Correo de pedidos", queEs: "Correo donde se mandan los pedidos.", logica: "Tiene que ser un correo válido; se guarda en minúsculas." },
  { nombre: "Días de reparto", queEs: "Cuándo reparte (por ejemplo, «lunes y jueves»). Texto libre.", influye: "Se ve en las compras al hacer el pedido." },
  {
    nombre: "Pedido mínimo (€)",
    queEs: "Importe mínimo que exige el proveedor para servir.",
    logica: "Cero o más; con coma o punto: 150, 150,50 o 1.500 (mil quinientos). Vacío = sin pedido mínimo.",
    influye: "Si una compra no llega a este importe, la compra avisa.",
  },
  {
    nombre: "Qué nos sirve",
    queEs: "Áreas que sirve: Bebidas, Comidas y/o Consumibles.",
    logica: "Consumibles (menaje, limpieza…) todavía no tiene compras propias: se puede marcar, pero hoy solo es informativo y sirve para filtrar esta lista.",
    influye: "En las compras y productos de Bebidas o Comidas salen los proveedores activos de esa área y los que no tienen ninguna área marcada.",
  },
  { nombre: "Notas", queEs: "Comentario libre." },
];

export const AYUDA_PROVEEDORES: AyudaArea = {
  "/proveedores": {
    titulo: "Proveedores",
    area: AREA,
    paraQue:
      "Lista de proveedores, común a todas las áreas (Bebidas, Comidas, Obrador, Contabilidad). Aquí se dan de alta, se corrigen sus datos y se desactivan. Lo importante es el teléfono con +34, para que el pedido por WhatsApp llegue a quien debe.",
    quien:
      "Ver: permiso «Ver proveedores». Crear, editar, desactivar y activar: «Crear y editar proveedores». El área sale si la cadena tiene Bebidas, Comidas, Obrador o Contabilidad.",
    secciones: [
      {
        titulo: "Cifras de arriba",
        campos: [
          { nombre: "Proveedores activos", queEs: "Todos los proveedores activos, sin contar el filtro de abajo. Si hay filtro, debajo dice cuántos de ellos salen con él." },
          { nombre: "Sin teléfono", queEs: "Activos (todos, sin filtro) sin teléfono: no se les puede pedir por WhatsApp." },
          {
            nombre: "Teléfono mal escrito",
            queEs: "Activos (todos, sin filtro) cuyo teléfono no pasa la comprobación del formato (casi siempre, porque falta el prefijo del país).",
          },
        ],
      },
      {
        titulo: "Filtros",
        campos: [
          { nombre: "Buscar", queEs: "Busca por parte del nombre, de la persona de contacto o del CIF." },
          { nombre: "Área", queEs: "Todas las áreas, Bebidas, Comidas o Consumibles (los que tienen marcada esa área). Consumibles sale como «aún sin compras»." },
          { nombre: "Ver desactivados", queEs: "Enseña también los proveedores desactivados (tachados)." },
          { nombre: "Filtrar", queEs: "Aplica los filtros." },
        ],
      },
      {
        titulo: "Tabla",
        campos: [
          { nombre: "Proveedor", queEs: "Nombre. Tachado si está desactivado." },
          { nombre: "Contacto", queEs: "Persona de contacto." },
          { nombre: "Teléfono", queEs: "Teléfono. Si está mal escrito sale en rojo con «revisar» y la fila en rojo." },
          { nombre: "Áreas", queEs: "Áreas que sirve." },
          { nombre: "Productos", queEs: "Número de productos que tienen este proveedor." },
          { nombre: "Estado", queEs: "Activo o Desactivado." },
        ],
      },
      {
        titulo: "Detalle del proveedor",
        campos: [
          { nombre: "CIF", queEs: "CIF del proveedor." },
          { nombre: "Correo", queEs: "Correo de pedidos." },
          { nombre: "Días de reparto", queEs: "Cuándo reparte." },
          { nombre: "Pedido mínimo", queEs: "Importe mínimo por pedido." },
          { nombre: "Compras hechas", queEs: "Número de compras (pedidos a proveedor) hechas a este proveedor." },
          { nombre: "Alta", queEs: "Fecha en que se dio de alta." },
          { nombre: "Notas", queEs: "Comentario." },
          { nombre: "Aviso en rojo", queEs: "Si el teléfono está mal, explica qué le pasa." },
          ...CAMPOS_FORMULARIO.map((c) => ({ ...c, nombre: `${c.nombre} (editar)` })),
          {
            nombre: "Guardar cambios",
            queEs: "Guarda los datos corregidos.",
            logica: "Aplica las mismas comprobaciones que el alta. El cambio queda en el registro de cambios (antes y después).",
          },
          {
            nombre: "Desactivar / Volver a activar",
            queEs: "Un proveedor no se borra: se desactiva.",
            logica: "Desactivado, deja de salir en los selectores de compras, productos y facturas, pero sigue en el historial de compras.",
          },
        ],
      },
    ],
    influye: [
      { texto: "Compras de bebidas (proveedor, WhatsApp, pedido mínimo)", ruta: "/bebidas/compras" },
      { texto: "Compras de comidas", ruta: "/comidas/compras" },
      { texto: "Productos de bebidas (proveedor de cada producto)", ruta: "/bebidas/productos" },
      { texto: "Productos de comidas", ruta: "/comidas/productos" },
      { texto: "Selector «Proveedor dado de alta» de las facturas recibidas", ruta: "/contabilidad/recibidas/nueva" },
    ],
    comoSeUsa: ["Revisa las cifras «Sin teléfono» y «Teléfono mal escrito» y corrige esos proveedores desde su detalle."],
  },

  "/proveedores/nuevo": {
    titulo: "Nuevo proveedor",
    area: AREA,
    paraQue: "Alta de un proveedor nuevo, común a todas las áreas.",
    quien: "Permiso «Crear y editar proveedores».",
    secciones: [
      {
        titulo: "Formulario",
        campos: [
          ...CAMPOS_FORMULARIO,
          {
            nombre: "Dar de alta",
            queEs: "Crea el proveedor (activo) y vuelve a la lista.",
            logica: "Queda en el registro de cambios.",
          },
          { nombre: "Volver", queEs: "Vuelve a la lista sin guardar." },
        ],
      },
    ],
    influye: [
      { texto: "Lista de proveedores", ruta: "/proveedores" },
      { texto: "Compras de bebidas", ruta: "/bebidas/compras" },
      { texto: "Compras de comidas", ruta: "/comidas/compras" },
    ],
  },
};
