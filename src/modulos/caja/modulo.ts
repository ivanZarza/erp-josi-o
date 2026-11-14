import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "caja",
  nombre: "Caja y ventas",
  descripcion: "Tickets y ventas del TPV, venta por plato, apertura y cierres de caja",
  icono: "caja",
  tiposCentro: ["LOCAL"],
  orden: 13,
  menu: [
    { ruta: "/caja", titulo: "Ventas", permiso: "caja:ver" },
    { ruta: "/caja/tickets", titulo: "Tickets", permiso: "caja:ver" },
    { ruta: "/caja/platos", titulo: "Venta por plato", permiso: "caja:ver" },
    { ruta: "/caja/cierres", titulo: "Apertura y cierres", permiso: "caja:cierres:ver" },
  ],
  permisos: [
    { clave: "caja:ver", descripcion: "Ver ventas" },
    { clave: "caja:ventas:editar", descripcion: "Meter a mano las ventas del día (locales sin tickets)" },
    { clave: "caja:tickets:crear", descripcion: "Apuntar tickets, añadir líneas y cobrarlos (bajan el stock)" },
    { clave: "caja:tickets:anular", descripcion: "Anular líneas o tickets enteros (devuelven el stock)" },
    { clave: "caja:tpv:importar", descripcion: "Importar ventas del TPV (CSV o formato propio)" },
    { clave: "caja:cierres:ver", descripcion: "Ver cierres" },
    { clave: "caja:cierres:crear", descripcion: "Abrir la caja, apuntar retiradas y pagos, y hacer cierres" },
    { clave: "caja:cierres:validar", descripcion: "Validar cierres" },
  ],
  integraciones: [
    { id: "tpv", nombre: "Programa de caja (TPV)", descripcion: "Leer tickets, cobros y cierres (Revo, Ágora, Last.app… o Chift)", estado: "pendiente" },
  ],
};
