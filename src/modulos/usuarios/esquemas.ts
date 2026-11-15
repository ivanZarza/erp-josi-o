/** Validación de los formularios de Usuarios y Ajustes (zod). */
import { z } from "zod";
import { ROLES } from "@/kernel/permisos";

const roles = Object.keys(ROLES) as [keyof typeof ROLES, ...(keyof typeof ROLES)[]];

/** Contraseña temporal: mínimo 10 caracteres (specs/general/05 §1). */
export const contrasena = z
  .string()
  .min(10, "La contraseña temporal debe tener al menos 10 caracteres")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "La contraseña temporal debe tener letras y números");

/**
 * Datos de la ficha del usuario. «Al menos un centro» se comprueba en el servicio, con los centros
 * que ya tenía fuera del alcance de quien edita (esos no salen en el formulario y se conservan).
 */
export const DatosUsuario = z.object({
  nombre: z.string().trim().min(2, "Falta el nombre"),
  email: z.string().trim().toLowerCase().pipe(z.email("Correo no válido")),
  rol: z.enum(roles, { message: "Rol no válido" }),
  todosCentros: z.boolean(),
  centros: z.array(z.string()),
});
export type DatosUsuario = z.infer<typeof DatosUsuario>;

export const AltaUsuario = z.object({ datos: DatosUsuario, contrasena });

/** Notas de una integración: sin secretos (las claves van en variables de entorno o cifradas aparte). */
const pareceSecreto = (v: string) =>
  /(contrase(ñ|n)a|password|passwd|token|secret|api[_ -]?key|clave\s*[:=])/i.test(v) || /[A-Za-z0-9_\-]{32,}/.test(v);

export const DatosIntegracion = z.object({
  tipo: z.string().trim().min(1),
  proveedor: z
    .string()
    .trim()
    .max(80)
    .optional()
    .refine((v) => !v || !pareceSecreto(v), "No escribas claves ni contraseñas aquí"),
  notas: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .refine((v) => !v || !pareceSecreto(v), "Las notas parecen llevar una clave o contraseña: quítala. Los secretos no se guardan aquí."),
});
export type DatosIntegracion = z.infer<typeof DatosIntegracion>;
