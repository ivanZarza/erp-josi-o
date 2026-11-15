import type { ManifiestoModulo } from "@/kernel/tipos-modulo";

export const modulo: ManifiestoModulo = {
  id: "cuadro",
  nombre: "Cuadro de mando",
  descripcion: "Indicadores por centro, marca y sociedad; presupuesto",
  icono: "grafica",
  orden: 2,
  menu: [
    { ruta: "/cuadro", titulo: "Indicadores", permiso: "cuadro:ver" },
    { ruta: "/cuadro/diario", titulo: "Día a día", permiso: "cuadro:ver" },
    { ruta: "/cuadro/presupuestos", titulo: "Presupuestos", permiso: "cuadro:ver" },
  ],
  permisos: [
    { clave: "cuadro:ver", descripcion: "Ver el cuadro de mando" },
    { clave: "cuadro:presupuestos:editar", descripcion: "Editar presupuestos" },
    { clave: "cuadro:recalcular", descripcion: "Recalcular y guardar los indicadores del día a día" },
  ],
  mejoraCon: ["caja", "contabilidad", "bebidas", "comidas", "obrador", "personal"],
  integraciones: [],
};
