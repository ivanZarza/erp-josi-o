import "server-only";
import { cache } from "react";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Conexión a PostgreSQL.
 * - En Cloudflare: la cadena de conexión llega por Hyperdrive (binding HYPERDRIVE). OpenNext deja
 *   el contexto de Cloudflare en globalThis; se lee directamente para NO importar
 *   @opennextjs/cloudflare (arrastraría Wrangler y miniflare al paquete y lo haría enorme).
 * - En local (next dev): DATABASE_URL del archivo .env.
 * En Workers no se reutiliza una conexión entre peticiones: un cliente por petición
 * (cache() de React lo comparte dentro de la misma petición).
 */
function cadenaConexion(): string {
  const cf = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: { HYPERDRIVE?: { connectionString: string } } }
    | undefined;
  const hd = cf?.env?.HYPERDRIVE?.connectionString;
  if (hd) return hd;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (o el binding HYPERDRIVE en Cloudflare)");
  return url;
}

export const db = cache(async (): Promise<PrismaClient> => {
  const adapter = new PrismaPg({ connectionString: cadenaConexion(), max: 1 });
  return new PrismaClient({ adapter });
});
