/**
 * Pasos del asistente de apertura de un local (docs/specs/nucleo/organizacion.md §Asistente).
 * Los pasos de módulos no contratados no aparecen. «hecho» = ya funciona en el asistente;
 * los demás muestran qué aportarán cuando su módulo lo tenga construido.
 */
export interface PasoAsistente {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string;
  modulos?: string[]; // aparece si está contratado alguno (vacío = siempre)
  hecho: boolean;
}

export const PASOS: PasoAsistente[] = [
  { id: "datos", numero: 1, titulo: "Marca, sociedad y datos", descripcion: "Marca, sociedad, origen (plantilla o copia), nombre, dirección, teléfono, correo y fecha prevista", hecho: true },
  { id: "horario", numero: 3, titulo: "Horario y espacios", descripcion: "Horario por día, hora de corte, festivos, salas y servicios", hecho: true },
  { id: "areas", numero: 3, titulo: "Áreas del local", descripcion: "Qué áreas contratadas se usan en este local", hecho: true },
  { id: "carta", numero: 4, titulo: "Carta", descripcion: "Hereda la carta de la marca; ajustar precios del local, quitar o añadir platos", modulos: ["comidas"], hecho: false },
  { id: "productos", numero: 5, titulo: "Bebidas y productos", descripcion: "Productos que puede pedir, con mínimos (copiados de otro local o del local modelo de la marca)", modulos: ["bebidas", "comidas"], hecho: true },
  { id: "equipo", numero: 6, titulo: "Equipo", descripcion: "Organigrama tipo; traslados de personas del grupo o vacantes", modulos: ["personal"], hecho: false },
  { id: "cuadrante", numero: 7, titulo: "Cuadrante", descripcion: "Cuadrante tipo listo para rellenar con el equipo", modulos: ["personal"], hecho: false },
  { id: "usuarios", numero: 8, titulo: "Usuarios", descripcion: "Gerente y encargados con acceso a este local", hecho: true },
  { id: "calidad", numero: 9, titulo: "Calidad", descripcion: "Listas de APPCC, cámaras y neveras a vigilar", modulos: ["calidad"], hecho: false },
  { id: "reservas", numero: 10, titulo: "Reservas", descripcion: "Plano de mesas tipo, reglas de reserva, ficha de CoverManager", modulos: ["reservas"], hecho: false },
  { id: "conexiones", numero: 11, titulo: "Conexiones", descripcion: "TPV del local, CoverManager, WhatsApp", hecho: true },
  { id: "web", numero: 12, titulo: "Web", descripcion: "Página del local en borrador con los datos ya puestos", modulos: ["webs"], hecho: false },
  { id: "presupuesto", numero: 13, titulo: "Presupuesto", descripcion: "Ventas y costes previstos por mes del primer año", modulos: ["cuadro", "contabilidad"], hecho: false },
  { id: "revision", numero: 14, titulo: "Revisión y apertura", descripcion: "Lo que falta y botón «Abrir local»", hecho: true },
];

/** Pasos visibles para una cadena (según módulos contratados), numerados de nuevo en orden. */
export function pasosVisibles(contratados: string[]): (PasoAsistente & { orden: number })[] {
  return PASOS.filter((p) => !p.modulos || p.modulos.some((m) => contratados.includes(m))).map((p, i) => ({ ...p, orden: i + 1 }));
}
