import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "caja",
  nombre: "Caja y ventas",
  descripcion: "Ventas del TPV, cierres de caja y descuadres",
  icono: "caja",
  tiposCentro: ["LOCAL"],
  orden: 13,
  menu: [
    { ruta: "/caja", titulo: "Ventas", permiso: "caja:ver" },
    { ruta: "/caja/cierres", titulo: "Cierres de caja", permiso: "caja:cierres:ver" },
  ],
  permisos: [
    { clave: "caja:ver", descripcion: "Ver ventas" },
    { clave: "caja:ventas:editar", descripcion: "Meter a mano las ventas del día (mientras no haya TPV conectado)" },
    { clave: "caja:cierres:ver", descripcion: "Ver cierres" },
    { clave: "caja:cierres:crear", descripcion: "Hacer cierres de caja" },
    { clave: "caja:cierres:validar", descripcion: "Validar cierres" },
  ],
  integraciones: [
    { id: "tpv", nombre: "Programa de caja (TPV)", descripcion: "Leer tickets, cobros y cierres (Revo, Ágora, Last.app… o Chift)", estado: "pendiente" },
  ],
};
