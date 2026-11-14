/**
 * Semilla de Caja y ventas (SOLO DESARROLLO).
 * ⚠ CIFRAS DE EJEMPLO: las ventas, comensales, cobros y cierres son INVENTADOS para probar las pantallas.
 * No son datos reales de Grupo Raza (el TPV aún no está conectado, P-03).
 * Crea los últimos 30 días de ventas de cada local abierto y los cierres de caja de la última semana.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";

/** Generador pseudoaleatorio con semilla fija: mismos datos de ejemplo en cada carga. */
function aleatorio(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const r2 = (n: number) => Math.round(n * 100) / 100;

function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// EJEMPLO: venta neta media diaria (sin IVA) y gasto medio por comensal de cada local. Inventado.
const LOCALES_EJEMPLO: Record<string, [number, number]> = {
  "VA-AYA": [7200, 52], "VA-MOR": [6100, 48], "VA-PCA": [5600, 46], "VA-VEN": [4900, 44], "VA-MUR": [3900, 40],
  "RZ-BAR": [6800, 58], "RZ-BER": [6300, 55], "RZ-CHA": [5200, 54], "VR-BER": [4600, 47], "VR-CHA": [4200, 45],
  "AL-MOR": [3800, 42], "AL-PCA": [3500, 41], "PU-CHA": [4100, 38], "PA-SAL": [5900, 72], "TG-CHA": [2600, 32],
  // VA-IBI (Ibiza) está en temporada: cerrado en otoño, sin ventas de ejemplo
};
// Peso de cada día de la semana (domingo = 0)
const PESO_DIA = [1.05, 0.72, 0.8, 0.88, 1.0, 1.32, 1.4];

export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla) {
  const ya = await prisma.jornadaVenta.count({ where: { tenantId: ctx.tenantId } });
  if (ya > 0) return; // ya sembrado
  const azar = aleatorio(20261108);
  const hoy = new Date(`${hoyISO()}T00:00:00.000Z`);
  const admin = await prisma.usuario.findFirst({ where: { tenantId: ctx.tenantId, rol: "admin" }, select: { id: true } });
  const gerente = await prisma.usuario.findFirst({ where: { tenantId: ctx.tenantId, rol: "gerente" }, select: { id: true } });

  for (const [codigo, [media, porComensal]] of Object.entries(LOCALES_EJEMPLO)) {
    const centroId = ctx.centros[codigo];
    if (!centroId) continue;
    for (let d = 30; d >= 1; d--) {
      const fecha = new Date(hoy.getTime() - d * 86400000);
      const ventaNeta = r2(media * PESO_DIA[fecha.getUTCDay()] * (0.85 + azar() * 0.3));
      const cuotaIva = r2(ventaNeta * 0.1); // hostelería: 10 %
      const conIva = r2(ventaNeta + cuotaIva);
      const comensales = Math.max(1, Math.round(ventaNeta / (porComensal * (0.92 + azar() * 0.16))));
      const tickets = Math.max(1, Math.round(comensales / (2.4 + azar() * 0.8)));
      const ventaComida = r2(ventaNeta * (0.42 + azar() * 0.12));
      // cobros de ejemplo: tarjeta ~82 %, efectivo ~12 %, bizum ~3 %, resto vales/otros
      const efectivo = r2(conIva * (0.09 + azar() * 0.06));
      const bizum = r2(conIva * (0.02 + azar() * 0.02));
      const vale = azar() < 0.2 ? r2(conIva * 0.02) : 0;
      const tarjeta = r2(conIva - efectivo - bizum - vale);
      const j = await prisma.jornadaVenta.create({
        data: {
          tenantId: ctx.tenantId,
          centroId,
          fecha,
          ventaNeta,
          cuotaIva,
          ventaComida,
          ventaCena: r2(ventaNeta - ventaComida),
          comensales,
          tickets,
          descuentos: r2(ventaNeta * 0.015 * azar()),
          invitaciones: r2(ventaNeta * 0.01 * azar()),
          anulaciones: azar() < 0.3 ? r2(20 + azar() * 60) : 0,
          origen: "MANUAL",
          notas: "Datos de ejemplo (semilla)",
          creadoPor: admin?.id,
          pagos: {
            create: [
              { forma: "TARJETA" as const, importe: tarjeta },
              { forma: "EFECTIVO" as const, importe: efectivo },
              { forma: "BIZUM" as const, importe: bizum },
              ...(vale ? [{ forma: "VALE" as const, importe: vale }] : []),
            ],
          },
        },
      });
      // cierres de caja de ejemplo en la última semana (salvo ayer, que queda por hacer)
      if (d >= 2 && d <= 7) {
        const descuadre = azar() < 0.25 ? r2((azar() - 0.6) * 40) : 0;
        await prisma.cierreCaja.create({
          data: {
            tenantId: ctx.tenantId,
            centroId,
            fecha: j.fecha,
            efectivoTeorico: efectivo,
            efectivoContado: r2(efectivo + descuadre),
            descuadre,
            tarjetaTeorico: tarjeta,
            tarjetaBanco: d >= 4 ? r2(tarjeta - (azar() < 0.15 ? 12.5 : 0)) : null,
            fondoCaja: 300,
            motivo: descuadre !== 0 ? (descuadre < 0 ? "Ejemplo: cambio mal dado en una mesa" : "Ejemplo: propina dejada en caja") : null,
            estado: d >= 4 ? "VALIDADO" : "PENDIENTE",
            cerradoPor: gerente?.id ?? admin?.id,
            validadoPor: d >= 4 ? admin?.id : null,
            validadoEn: d >= 4 ? new Date(j.fecha.getTime() + 2 * 86400000) : null,
          },
        });
      }
    }
  }
}
