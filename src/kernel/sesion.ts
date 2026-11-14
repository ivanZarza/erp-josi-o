import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Sesión en cookie httpOnly firmada. Sin secreto por defecto: si falta AUTH_SECRET, falla.
 * Ver specs/05_seguridad_permisos_api.md §1.
 */
const COOKIE = "erp_sesion";
const DURACION_S = 60 * 60 * 12; // 12 horas

export interface DatosSesion {
  usuarioId: string;
  tenantId: string;
  centroId?: string | null; // centro elegido en el selector
}

function secreto(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("Falta AUTH_SECRET (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function crearSesion(datos: DatosSesion): Promise<void> {
  const token = await new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_S}s`)
    .sign(secreto());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_S,
  });
}

export async function leerSesion(): Promise<DatosSesion | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    return {
      usuarioId: String(payload.usuarioId),
      tenantId: String(payload.tenantId),
      centroId: (payload.centroId as string | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
