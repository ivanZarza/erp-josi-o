/**
 * Semilla del Cuadro de mando (SOLO DESARROLLO).
 * ⚠ CIFRAS DE EJEMPLO: el presupuesto es INVENTADO (media de ventas de ejemplo × días del mes × 1,05).
 * Crea el presupuesto del mes actual para cada local con ventas de ejemplo. Debe ir DESPUÉS de la de Caja.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla) {
  const t = ctx.tenantId;
  const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [anio, mes] = hoyISO.split("-").map(Number);
  if ((await prisma.presupuestoCentro.count({ where: { tenantId: t, anio, mes } })) > 0) return;
  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const medias = await prisma.jornadaVenta.groupBy({ by: ["centroId"], where: { tenantId: t }, _avg: { ventaNeta: true } });
  for (const m of medias) {
    const ventas = r2(Number(m._avg.ventaNeta ?? 0) * diasMes * 1.05);
    await prisma.presupuestoCentro.create({
      data: {
        tenantId: t,
        centroId: m.centroId,
        anio,
        mes,
        ventas,
        mercancia: r2(ventas * 0.3), // ejemplo: 30 % de coste de mercancía
        personal: r2(ventas * 0.32), // ejemplo: 32 % de personal
        gastos: r2(ventas * 0.18),
        notas: "Presupuesto de ejemplo (semilla)",
      },
    });
  }
}
