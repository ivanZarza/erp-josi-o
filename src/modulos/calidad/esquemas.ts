/** Validación (zod) de Calidad. Los números admiten coma decimal española (numeroEs del kernel). */
import { z } from "zod";
import { numeroEs, numeroEsOpcional } from "@/kernel/esquemas";

/** Quita «°C» o «º» que alguien escriba detrás de la temperatura; vacío = sin dato (no cero). */
const sinGrados = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.replace(/\s*(°C|ºC|°|º)\s*$/i, "").trim();
  return t === "" ? undefined : t;
};
const numero = (msg: string) => z.preprocess(sinGrados, numeroEs(msg));
const numeroOpcional = (msg: string) => z.preprocess(sinGrados, numeroEsOpcional(msg));
const texto = (msg: string) => z.string({ error: msg }).trim().min(1, { error: msg });
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const fecha = (msg: string) => z.string({ error: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: msg });
const fechaOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), fecha("Fecha no válida").optional());

export const esquemaPlantilla = z.object({
  nombre: texto("Escribe el nombre de la lista"),
  tipo: z.enum(["APERTURA", "CIERRE", "LIMPIEZA", "RECEPCION", "OTRA"], { error: "Tipo no válido" }),
  centroId: textoOpcional, // vacío = todos los centros
});

export const esquemaPunto = z.object({
  plantillaId: texto("Falta la lista"),
  texto: texto("Escribe el punto a comprobar"),
  pideValor: z.preprocess((v) => v === "on", z.boolean()),
});

export const esquemaEquipo = z
  .object({
    centroId: texto("Elige el centro"),
    nombre: texto("Escribe el nombre del equipo"),
    tipo: z.enum(["CAMARA_REFRIGERACION", "CAMARA_CONGELACION", "NEVERA", "ARCON_CONGELADOR", "MESA_FRIA", "OTRO"], { error: "Tipo no válido" }),
    minimo: numero("Temperatura mínima no válida"),
    maximo: numero("Temperatura máxima no válida"),
  })
  .refine((e) => e.minimo < e.maximo, { error: "La mínima tiene que ser menor que la máxima" });

export const esquemaTemperatura = z.object({
  equipoId: texto("Falta el equipo"),
  temperatura: numero("Temperatura no válida").pipe(z.number().min(-60).max(80, { error: "Temperatura fuera de lo posible" })),
  accionCorrectora: textoOpcional,
});

export const esquemaIncidencia = z.object({
  centroId: texto("Elige el centro"),
  tipo: z.enum(["AVERIA", "QUEJA", "ACCIDENTE", "SEGURIDAD_ALIMENTARIA", "TEMPERATURA", "OTRA"], { error: "Tipo no válido" }),
  titulo: texto("Escribe qué ha pasado"),
  descripcion: textoOpcional,
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]).default("MEDIA"),
  responsableId: textoOpcional,
  plazo: fechaOpcional,
});

export const esquemaGestionIncidencia = z.object({
  id: texto("Falta la incidencia"),
  estado: z.enum(["ABIERTA", "EN_CURSO", "RESUELTA", "ANULADA"], { error: "Estado no válido" }),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]),
  responsableId: textoOpcional,
  plazo: fechaOpcional,
  solucion: textoOpcional,
});

export const esquemaMantenimiento = z.object({
  centroId: texto("Elige el centro"),
  nombre: texto("Escribe la tarea"),
  equipo: textoOpcional,
  empresa: textoOpcional,
  cadaDias: numero("Periodicidad no válida").pipe(z.number().int().min(1, { error: "Cada cuántos días: mínimo 1" }).max(1825)),
  proximaVez: fecha("Elige la fecha de la próxima vez"),
  notas: textoOpcional,
});

export const esquemaHecho = z.object({
  tareaId: texto("Falta la tarea"),
  fecha: fecha("Elige la fecha"),
  coste: numeroOpcional("Coste no válido").pipe(z.number().min(0).optional()),
  nota: textoOpcional,
});
