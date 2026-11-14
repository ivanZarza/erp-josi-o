import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/**
 * Eventos internos entre módulos (specs/03 §5.2 regla 3). Un módulo emite; si el módulo
 * que escucharía no está contratado, no pasa nada. Se guardan para procesarlos y repetirlos.
 * Tipos usados: "almacen.pedido.servido", "almacen.compra.recibida", "almacen.inventario.cerrado"…
 */
export async function emitir(tx: Tx, tenantId: string, tipo: string, datos: Record<string, unknown>) {
  await tx.eventoInterno.create({ data: { tenantId, tipo, datos: datos as object } });
}

/** Registro de auditoría para dinero, stock, precios, permisos y personal. */
export async function auditar(
  tx: Tx,
  a: { tenantId: string; usuarioId?: string; entidad: string; entidadId: string; accion: string; antes?: unknown; despues?: unknown },
) {
  await tx.auditoria.create({
    data: {
      tenantId: a.tenantId,
      usuarioId: a.usuarioId,
      entidad: a.entidad,
      entidadId: a.entidadId,
      accion: a.accion,
      antes: (a.antes ?? undefined) as object | undefined,
      despues: (a.despues ?? undefined) as object | undefined,
    },
  });
}
