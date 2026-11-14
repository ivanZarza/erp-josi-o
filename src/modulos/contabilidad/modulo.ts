import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "contabilidad",
  nombre: "Contabilidad",
  descripcion: "Facturas recibidas y emitidas, gastos y vencimientos por sociedad",
  icono: "libro",
  orden: 15,
  menu: [
    { ruta: "/contabilidad", titulo: "Resumen", permiso: "contabilidad:ver" },
    { ruta: "/contabilidad/recibidas", titulo: "Facturas recibidas", permiso: "contabilidad:ver" },
    { ruta: "/contabilidad/emitidas", titulo: "Facturas emitidas", permiso: "contabilidad:ver" },
    { ruta: "/contabilidad/gastos", titulo: "Gastos", permiso: "contabilidad:ver" },
    { ruta: "/contabilidad/vencimientos", titulo: "Vencimientos", permiso: "contabilidad:ver" },
    { ruta: "/contabilidad/categorias", titulo: "Categorías", permiso: "contabilidad:ver" },
    { ruta: "/contabilidad/exportar", titulo: "Exportar a la gestoría", permiso: "contabilidad:exportar" },
  ],
  permisos: [
    { clave: "contabilidad:ver", descripcion: "Ver contabilidad" },
    { clave: "contabilidad:facturas:editar", descripcion: "Registrar y validar facturas" },
    { clave: "contabilidad:gastos:editar", descripcion: "Registrar gastos" },
    { clave: "contabilidad:exportar", descripcion: "Exportar a la gestoría" },
  ],
  integraciones: [
    { id: "gestoria", nombre: "Programa de la gestoría", descripcion: "A3, Sage, Holded u Odoo", estado: "pendiente" },
    { id: "verifactu", nombre: "Verifactu", descripcion: "Emisión certificada de facturas", estado: "pendiente" },
    { id: "lector-facturas", nombre: "Lectura de facturas con IA", descripcion: "Leer PDF y fotos de facturas de proveedor", estado: "pendiente" },
    { id: "bancos", nombre: "Bancos", descripcion: "Movimientos bancarios", estado: "pendiente" },
  ],
};
