import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/**
 * Siguiente número de documento sin huecos, por cadena, serie y año: PL-2026-000047, ALB-S-2026-000046…
 * El año va en el número porque el contador vuelve a 1 cada año (si no, chocaría con el del año anterior).
 */
export async function siguienteNumero(tx: Tx, tenantId: string, serie: string, digitos = 6): Promise<string> {
  const anio = new Date().getFullYear();
  const c = await tx.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return `${serie}-${anio}-${String(c.valor).padStart(digitos, "0")}`;
}
