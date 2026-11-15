/**
 * Pasos del asistente de apertura de un local (docs/specs/nucleo/organizacion.md §Asistente).
 * Los pasos de módulos no contratados no aparecen. «hecho» = ya funciona en el asistente;
 * los demás muestran qué aportarán cuando su módulo lo tenga construido.
 * El número de cada paso es su posición en la lista (pasosVisibles), no un dato fijo: así no se repite.
 */
export interface PasoAsistente {
  id: string;
  titulo: string;
  descripcion: string;
  modulos?: string[]; // aparece si está contratado alguno (vacío = siempre)
  hecho: boolean;
}

export const PASOS: PasoAsistente[] = [
  { id: "datos", titulo: "Marca, sociedad y datos", descripcion: "Marca, sociedad, origen (plantilla o copia), nombre, dirección, teléfono, correo y fecha prevista", hecho: true },
  { id: "horario", titulo: "Horario y espacios", descripcion: "Horario por día, hora de corte, festivos, salas y servicios", hecho: true },
  { id: "areas", titulo: "Áreas del local", descripcion: "Qué áreas contratadas se usan en este local", hecho: true },
  { id: "carta", titulo: "Carta", descripcion: "Hereda la carta de la marca; ajustar precios del local, quitar o añadir platos", modulos: ["comidas"], hecho: false },
  { id: "productos", titulo: "Bebidas y productos", descripcion: "Productos que puede pedir, con mínimos (copiados de otro local o del local modelo de la marca)", modulos: ["bebidas", "comidas"], hecho: true },
  { id: "equipo", titulo: "Equipo", descripcion: "Organigrama tipo; traslados de personas del grupo o vacantes", modulos: ["personal"], hecho: false },
  { id: "cuadrante", titulo: "Cuadrante", descripcion: "Cuadrante tipo listo para rellenar con el equipo", modulos: ["personal"], hecho: false },
  { id: "usuarios", titulo: "Usuarios", descripcion: "Gerente y encargados con acceso a este local", hecho: true },
  { id: "calidad", titulo: "Calidad", descripcion: "Listas de APPCC, cámaras y neveras a vigilar", modulos: ["calidad"], hecho: false },
  { id: "reservas", titulo: "Reservas", descripcion: "Plano de mesas tipo, reglas de reserva, ficha de CoverManager", modulos: ["reservas"], hecho: false },
  { id: "conexiones", titulo: "Conexiones", descripcion: "TPV del local, CoverManager, WhatsApp", hecho: true },
  { id: "web", titulo: "Web", descripcion: "Página del local en borrador con los datos ya puestos", modulos: ["webs"], hecho: false },
  { id: "presupuesto", titulo: "Presupuesto", descripcion: "Ventas y costes previstos por mes del primer año", modulos: ["cuadro", "contabilidad"], hecho: false },
  { id: "revision", titulo: "Revisión y apertura", descripcion: "Lo que falta y botón «Abrir local»", hecho: true },
];

/** Pasos visibles para una cadena (según módulos contratados), numerados de nuevo en orden. */
export function pasosVisibles(contratados: string[]): (PasoAsistente & { orden: number })[] {
  return PASOS.filter((p) => !p.modulos || p.modulos.some((m) => contratados.includes(m))).map((p, i) => ({ ...p, orden: i + 1 }));
}
