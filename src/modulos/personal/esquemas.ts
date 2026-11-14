/**
 * Validación (zod) de los formularios del módulo Personal.
 * Los formularios llegan como FormData: los campos vacíos se convierten en undefined.
 */
import { z } from "zod";

const texto = z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string());
const textoOpc = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().optional());
const obligatorio = (nombre: string) => texto.pipe(z.string().min(1, `Falta ${nombre}`));
const dia = (nombre: string) => texto.pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${nombre}: fecha no válida`));
const diaOpc = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").optional());
const hora = (nombre: string) => texto.pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${nombre}: hora no válida (HH:MM)`));
const horaOpc = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (HH:MM)").optional());
/** Número escrito en español («1.234,5» o «1234.5»). */
const numeroOpc = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  let s = v.trim().replace(/\s|€/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}, z.number({ error: "Número no válido" }).finite().nonnegative("No puede ser negativo").optional());
const numero = (nombre: string) => numeroOpc.refine((v) => v !== undefined, `Falta ${nombre}`).transform((v) => v as number);
const lista = z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string()));

export const DEPARTAMENTOS = ["COCINA", "SALA", "BARRA", "OFFICE", "ALMACEN", "OBRADOR", "REPARTO", "DIRECCION", "ADMINISTRACION"] as const;
export const TIPOS_CONTRATO = ["INDEFINIDO", "TEMPORAL", "FIJO_DISCONTINUO", "PRACTICAS", "PARCIAL"] as const;
export const TIPOS_FICHAJE = ["ENTRADA", "INICIO_PAUSA", "FIN_PAUSA", "SALIDA"] as const;
export const TIPOS_AUSENCIA = ["VACACIONES", "ASUNTOS_PROPIOS", "PERMISO_RETRIBUIDO", "BAJA_ENFERMEDAD", "BAJA_ACCIDENTE", "NACIMIENTO", "EXCEDENCIA", "SIN_JUSTIFICAR"] as const;
export const TIPOS_CERTIFICADO = ["MANIPULADOR", "ALERGENOS", "PRL", "CARRETILLERO", "PERMISO_TRABAJO", "FORMACION_INTERNA", "OTRO"] as const;
export const TIPOS_DOCUMENTO = ["DNI", "PERMISO_TRABAJO", "CONTRATO", "NOMINA", "CERTIFICADO", "OTRO"] as const;
export const ESTADOS_CANDIDATO = ["RECIBIDO", "ENTREVISTA", "PRUEBA", "OFERTA", "CONTRATADO", "DESCARTADO"] as const;
export const ESTADOS_OFERTA = ["ABIERTA", "CUBIERTA", "CERRADA"] as const;

export const NOMBRE_DEPARTAMENTO: Record<(typeof DEPARTAMENTOS)[number], string> = {
  COCINA: "Cocina",
  SALA: "Sala",
  BARRA: "Barra",
  OFFICE: "Office",
  ALMACEN: "Almacén",
  OBRADOR: "Obrador",
  REPARTO: "Reparto",
  DIRECCION: "Dirección",
  ADMINISTRACION: "Administración",
};
export const NOMBRE_CONTRATO: Record<(typeof TIPOS_CONTRATO)[number], string> = {
  INDEFINIDO: "Indefinido",
  TEMPORAL: "Temporal",
  FIJO_DISCONTINUO: "Fijo discontinuo",
  PRACTICAS: "Prácticas",
  PARCIAL: "Tiempo parcial",
};
export const NOMBRE_FICHAJE: Record<(typeof TIPOS_FICHAJE)[number], string> = {
  ENTRADA: "Entrada",
  INICIO_PAUSA: "Inicio de pausa",
  FIN_PAUSA: "Fin de pausa",
  SALIDA: "Salida",
};
export const NOMBRE_AUSENCIA: Record<(typeof TIPOS_AUSENCIA)[number], string> = {
  VACACIONES: "Vacaciones",
  ASUNTOS_PROPIOS: "Asuntos propios",
  PERMISO_RETRIBUIDO: "Permiso retribuido",
  BAJA_ENFERMEDAD: "Baja por enfermedad",
  BAJA_ACCIDENTE: "Baja por accidente",
  NACIMIENTO: "Nacimiento",
  EXCEDENCIA: "Excedencia",
  SIN_JUSTIFICAR: "Sin justificar",
};
export const NOMBRE_CERTIFICADO: Record<(typeof TIPOS_CERTIFICADO)[number], string> = {
  MANIPULADOR: "Manipulador de alimentos",
  ALERGENOS: "Alérgenos",
  PRL: "Prevención de riesgos laborales",
  CARRETILLERO: "Carretillero",
  PERMISO_TRABAJO: "Permiso de trabajo",
  FORMACION_INTERNA: "Formación interna",
  OTRO: "Otro",
};
export const NOMBRE_DOCUMENTO: Record<(typeof TIPOS_DOCUMENTO)[number], string> = {
  DNI: "DNI / NIE",
  PERMISO_TRABAJO: "Permiso de trabajo",
  CONTRATO: "Contrato firmado",
  NOMINA: "Nómina",
  CERTIFICADO: "Certificado",
  OTRO: "Otro",
};
export const NOMBRE_ESTADO_CANDIDATO: Record<(typeof ESTADOS_CANDIDATO)[number], string> = {
  RECIBIDO: "Recibido",
  ENTREVISTA: "Entrevista",
  PRUEBA: "Prueba",
  OFERTA: "Oferta",
  CONTRATADO: "Contratado",
  DESCARTADO: "Descartado",
};

// ---------- Contratos ----------

export const esquemaContrato = z
  .object({
    tipo: z.enum(TIPOS_CONTRATO, { error: "Tipo de contrato no válido" }),
    jornadaSemanal: numero("la jornada semanal").refine((v) => v > 0 && v <= 60, "La jornada semanal debe estar entre 1 y 60 horas"),
    convenioId: textoOpc,
    categoriaId: textoOpc,
    sociedadId: textoOpc,
    salarioBrutoAnual: numeroOpc,
    porcentajeCotizacion: numeroOpc,
    costeHora: numeroOpc,
    pagasAnuales: numeroOpc.refine((v) => v === undefined || (Number.isInteger(v) && v >= 12 && v <= 16), "Las pagas al año van de 12 a 16"),
    pagasProrrateadas: z.preprocess((v) => (v === undefined || v === "" ? undefined : v === "si" || v === "on" || v === true), z.boolean().optional()),
    irpfPorcentaje: numeroOpc.refine((v) => v === undefined || v <= 50, "El IRPF no puede pasar del 50 %"),
    fechaInicio: dia("Inicio del contrato"),
    fechaFin: diaOpc,
    finPeriodoPrueba: diaOpc,
    notas: textoOpc,
  })
  .refine((c) => !c.fechaFin || c.fechaFin >= c.fechaInicio, { message: "El fin del contrato es anterior al inicio", path: ["fechaFin"] })
  .refine((c) => c.tipo !== "TEMPORAL" || !!c.fechaFin, { message: "Un contrato temporal necesita fecha de fin", path: ["fechaFin"] });
export type DatosContrato = z.infer<typeof esquemaContrato>;

export const esquemaFinContrato = z.object({
  fecha: dia("Fecha de fin"),
  motivo: obligatorio("el motivo"),
});

// ---------- Empleados ----------

const camposEmpleado = {
  nombre: obligatorio("el nombre"),
  apellidos: obligatorio("los apellidos"),
  dni: textoOpc,
  nss: textoOpc,
  fechaNacimiento: diaOpc,
  email: textoOpc.pipe(z.string().email("Correo no válido").optional()),
  telefono: textoOpc,
  direccion: textoOpc,
  contactoEmergencia: textoOpc,
  iban: textoOpc,
  centroPrincipalId: obligatorio("el centro principal"),
  centrosExtra: lista,
  sociedadId: textoOpc,
  puestoId: textoOpc,
  categoriaId: textoOpc,
  pin: textoOpc.pipe(z.string().regex(/^\d{4}$/, "El PIN son 4 cifras").optional()),
  notas: textoOpc,
};

export const esquemaEditarEmpleado = z.object(camposEmpleado);
export type DatosEmpleado = z.infer<typeof esquemaEditarEmpleado>;

/** Alta: datos de la ficha + (opcional) primer contrato. */
export const esquemaAltaEmpleado = z.object({
  ...camposEmpleado,
  fechaAlta: dia("Fecha de alta"),
  conContrato: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type DatosAlta = z.infer<typeof esquemaAltaEmpleado>;

export const esquemaBaja = z.object({
  fecha: dia("Fecha de baja"),
  motivo: obligatorio("el motivo de la baja"),
});

// ---------- Cuadrante ----------

export const esquemaAsignacion = z
  .object({
    centroId: obligatorio("el centro"),
    empleadoId: obligatorio("el empleado"),
    fecha: dia("Día"),
    inicio: hora("Inicio"),
    fin: hora("Fin"),
    inicio2: horaOpc,
    fin2: horaOpc,
    pausaMinutos: numeroOpc.transform((v) => Math.round(v ?? 0)),
    notas: textoOpc,
  })
  .refine((a) => (!a.inicio2 && !a.fin2) || (!!a.inicio2 && !!a.fin2), { message: "El turno partido necesita inicio y fin del segundo tramo", path: ["fin2"] });
export type DatosAsignacion = z.infer<typeof esquemaAsignacion>;

export const esquemaSemana = z.object({
  centroId: obligatorio("el centro"),
  lunes: dia("Semana"),
});

export const esquemaTurnoTipo = z.object({
  centroId: textoOpc,
  nombre: obligatorio("el nombre del turno"),
  inicio: hora("Inicio"),
  fin: hora("Fin"),
  inicio2: horaOpc,
  fin2: horaOpc,
});

// ---------- Fichajes ----------

export const esquemaFichar = z.object({
  empleadoId: obligatorio("el empleado"),
  centroId: obligatorio("el centro"),
  tipo: z.enum(TIPOS_FICHAJE, { error: "Tipo de fichaje no válido" }),
  pin: textoOpc,
});

export const esquemaFichajeManual = z.object({
  empleadoId: obligatorio("el empleado"),
  centroId: obligatorio("el centro"),
  tipo: z.enum(TIPOS_FICHAJE, { error: "Tipo de fichaje no válido" }),
  dia: dia("Día"),
  hora: hora("Hora"),
  motivo: obligatorio("el motivo"),
});

export const esquemaCorreccion = z.object({
  fichajeId: obligatorio("el fichaje"),
  tipo: z.enum(TIPOS_FICHAJE, { error: "Tipo de fichaje no válido" }),
  dia: dia("Día"),
  hora: hora("Hora"),
  motivo: obligatorio("el motivo de la corrección"),
});

export const esquemaAnularFichaje = z.object({
  fichajeId: obligatorio("el fichaje"),
  motivo: obligatorio("el motivo"),
});

// ---------- Ausencias ----------

export const esquemaAusencia = z
  .object({
    empleadoId: obligatorio("el empleado"),
    tipo: z.enum(TIPOS_AUSENCIA, { error: "Tipo de ausencia no válido" }),
    desde: dia("Desde"),
    hasta: dia("Hasta"),
    comentario: textoOpc,
    aprobarYa: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .refine((a) => a.hasta >= a.desde, { message: "La fecha final es anterior a la inicial", path: ["hasta"] });

export const esquemaResolverAusencia = z.object({
  ausenciaId: obligatorio("la ausencia"),
  decision: z.enum(["APROBAR", "RECHAZAR", "ANULAR"]),
  motivo: textoOpc,
});

// ---------- Formación y documentos ----------

export const esquemaCertificado = z.object({
  empleadoId: obligatorio("el empleado"),
  tipo: z.enum(TIPOS_CERTIFICADO, { error: "Tipo no válido" }),
  nombre: textoOpc,
  entidad: textoOpc,
  obtenidoEn: diaOpc,
  caducaEn: diaOpc,
});

export const esquemaDocumento = z.object({
  empleadoId: obligatorio("el empleado"),
  tipo: z.enum(TIPOS_DOCUMENTO, { error: "Tipo no válido" }),
  nombre: obligatorio("el nombre del documento"),
  caducaEn: diaOpc,
});

// ---------- Catálogos ----------

export const esquemaPuesto = z.object({
  nombre: obligatorio("el nombre del puesto"),
  departamento: z.enum(DEPARTAMENTOS, { error: "Departamento no válido" }),
});

export const esquemaConvenio = z.object({
  nombre: obligatorio("el nombre del convenio"),
  comunidad: textoOpc,
  horasAnuales: numeroOpc,
  diasVacaciones: numeroOpc,
  descansoMinimoHoras: numeroOpc,
});

export const esquemaCategoria = z.object({
  convenioId: obligatorio("el convenio"),
  nombre: obligatorio("el nombre de la categoría"),
  nivel: textoOpc,
  salarioBaseAnual: numeroOpc,
});

// ---------- Selección ----------

export const esquemaOferta = z.object({
  centroId: obligatorio("el centro"),
  puestoId: textoOpc,
  titulo: obligatorio("el título"),
  descripcion: textoOpc,
  tipoContrato: z.preprocess((v) => (v === "" ? undefined : v), z.enum(TIPOS_CONTRATO).optional()),
  jornada: numeroOpc,
  plazas: numeroOpc.transform((v) => Math.max(1, Math.round(v ?? 1))),
});

export const esquemaEstadoOferta = z.object({
  ofertaId: obligatorio("la oferta"),
  estado: z.enum(ESTADOS_OFERTA),
});

export const esquemaCandidato = z.object({
  ofertaId: textoOpc,
  nombre: obligatorio("el nombre"),
  apellidos: textoOpc,
  email: textoOpc.pipe(z.string().email("Correo no válido").optional()),
  telefono: textoOpc,
  origen: textoOpc,
  notas: textoOpc,
  consentimiento: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const esquemaEstadoCandidato = z.object({
  candidatoId: obligatorio("el candidato"),
  estado: z.enum(ESTADOS_CANDIDATO),
  notas: textoOpc,
});

export const esquemaContratarCandidato = z.object({
  candidatoId: obligatorio("el candidato"),
  centroPrincipalId: obligatorio("el centro"),
  puestoId: textoOpc,
  fechaAlta: dia("Fecha de alta"),
});

// ---------- Costes y nómina ----------

export const esquemaMes = z.object({
  mes: texto.pipe(z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido")),
  sociedadId: textoOpc,
});

// ---------- Nóminas ----------

export const ESTADOS_NOMINA = ["BORRADOR", "CERRADA", "PAGADA"] as const;
export const NOMBRE_ESTADO_NOMINA: Record<(typeof ESTADOS_NOMINA)[number], string> = { BORRADOR: "Borrador", CERRADA: "Cerrada", PAGADA: "Pagada" };

export const esquemaNominasMes = z.object({
  mes: texto.pipe(z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido")),
  centroId: textoOpc,
});

export const esquemaEstadoNominas = esquemaNominasMes.extend({
  a: z.enum(["CERRADA", "PAGADA"], { error: "Estado no válido" }),
  fechaPago: diaOpc,
  ids: lista,
});

/** Convierte un FormData en objeto (los campos repetidos, en lista). */
export function formularioAObjeto(form: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string") continue;
    if (k in o) o[k] = Array.isArray(o[k]) ? [...(o[k] as string[]), v] : [o[k] as string, v];
    else o[k] = v;
  }
  return o;
}

/** Primer mensaje de error de zod, para enseñarlo en pantalla. */
export function mensajeError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Datos no válidos";
}
