/**
 * Semilla de ejemplo del módulo Comidas (SOLO DESARROLLO).
 * Productos de alimentación típicos de una parrilla (Grupo Raza), proveedores de comida con teléfono +34
 * y stock inicial en el obrador. Precios y cantidades inventados pero realistas (noviembre de 2026).
 * Se puede ejecutar varias veces: no duplica nada.
 */
import { Prisma } from "../../src/generated/prisma-node/client";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";

// [nombre, contacto, teléfono, días de reparto, pedido mínimo €]
const PROVEEDORES: [string, string, string, string, number][] = [
  ["CÁRNICAS DEL GUADARRAMA S.L.", "Luis", "+34619204871", "Lunes, miércoles y viernes", 150],
  ["IMPORTADORA PAMPA BEEF S.A.", "Martina", "+34655390127", "Martes", 600],
  ["PESCADOS MERCAMADRID NORTE", "Rocío", "+34674118953", "De lunes a sábado", 100],
  ["FRUTAS Y VERDURAS HERMANOS GIL", "Toño", "+34622871045", "Diario", 60],
  ["DISTRIBUCIONES LÁCTEAS SIERRA", "Pilar", "+34691345208", "Lunes y jueves", 80],
  ["ULTRAMARINOS GARCÍA E HIJOS", "Andrés", "+34917634512", "Miércoles", 120],
];

// [referencia, nombre, familia, proveedor, unidad, coste €/ud, mínimo, stock inicial en el obrador, IVA]
const PRODUCTOS: [string, string, string, string, string, number, number, number, number][] = [
  ["CA-001", "Lomo bajo de vaca argentina (bife de chorizo)", "Carnes", "IMPORTADORA PAMPA BEEF S.A.", "KG", 28.5, 40, 62.4, 10],
  ["CA-002", "Entraña fina argentina", "Carnes", "IMPORTADORA PAMPA BEEF S.A.", "KG", 24.9, 25, 31.2, 10],
  ["CA-003", "Solomillo de vaca", "Carnes", "CÁRNICAS DEL GUADARRAMA S.L.", "KG", 34.8, 15, 18.6, 10],
  ["CA-004", "Chuletón de vaca madurada 45 días", "Carnes", "CÁRNICAS DEL GUADARRAMA S.L.", "KG", 31.2, 30, 22.8, 10],
  ["CA-005", "Chorizo criollo", "Carnes", "CÁRNICAS DEL GUADARRAMA S.L.", "KG", 9.4, 10, 14, 10],
  ["CA-006", "Morcilla de Burgos", "Carnes", "CÁRNICAS DEL GUADARRAMA S.L.", "KG", 7.2, 8, 9.5, 10],
  ["CA-007", "Molleja de ternera", "Carnes", "CÁRNICAS DEL GUADARRAMA S.L.", "KG", 18.6, 6, 4.2, 10],
  ["PE-001", "Lubina de estero (pieza 600-800 g)", "Pescados y mariscos", "PESCADOS MERCAMADRID NORTE", "KG", 13.9, 8, 10.5, 10],
  ["PE-002", "Pulpo cocido (pata)", "Pescados y mariscos", "PESCADOS MERCAMADRID NORTE", "KG", 26.4, 5, 6, 10],
  ["PE-003", "Gamba roja de Huelva", "Pescados y mariscos", "PESCADOS MERCAMADRID NORTE", "KG", 42, 3, 2.5, 10],
  ["VE-001", "Patata agria para freír", "Verduras y frutas", "FRUTAS Y VERDURAS HERMANOS GIL", "KG", 0.95, 100, 180, 4],
  ["VE-002", "Pimiento de piquillo asado (lata 1 kg)", "Verduras y frutas", "FRUTAS Y VERDURAS HERMANOS GIL", "LATA", 6.8, 12, 30, 10],
  ["VE-003", "Lechuga romana", "Verduras y frutas", "FRUTAS Y VERDURAS HERMANOS GIL", "UD", 0.85, 40, 36, 4],
  ["VE-004", "Tomate rosa", "Verduras y frutas", "FRUTAS Y VERDURAS HERMANOS GIL", "KG", 2.9, 20, 24, 4],
  ["VE-005", "Limón", "Verduras y frutas", "FRUTAS Y VERDURAS HERMANOS GIL", "KG", 1.6, 10, 15, 4],
  ["LA-001", "Huevo campero (caja 180 ud)", "Lácteos y huevos", "DISTRIBUCIONES LÁCTEAS SIERRA", "CAJA", 39.6, 2, 3, 4],
  ["LA-002", "Nata para cocinar 35 % (brik 1 l)", "Lácteos y huevos", "DISTRIBUCIONES LÁCTEAS SIERRA", "L", 3.4, 24, 30, 10],
  ["LA-003", "Queso provolone en lonchas", "Lácteos y huevos", "DISTRIBUCIONES LÁCTEAS SIERRA", "KG", 11.8, 6, 7.5, 10],
  ["SE-001", "Aceite de oliva virgen extra (garrafa 5 l)", "Seco y despensa", "ULTRAMARINOS GARCÍA E HIJOS", "UD", 39.5, 8, 14, 4],
  ["SE-002", "Aceite de girasol alto oleico (bidón 25 l)", "Seco y despensa", "ULTRAMARINOS GARCÍA E HIJOS", "UD", 52, 4, 6, 10],
  ["SE-003", "Sal en escamas (1 kg)", "Seco y despensa", "ULTRAMARINOS GARCÍA E HIJOS", "UD", 6.9, 4, 5, 10],
  ["SE-004", "Arroz bomba (5 kg)", "Seco y despensa", "ULTRAMARINOS GARCÍA E HIJOS", "PAQUETE", 21.5, 6, 10, 4],
  ["EL-001", "Chimichurri de la casa", "Elaborados del obrador", "", "KG", 8.2, 10, 12, 10],
  ["EL-002", "Empanada criolla de carne (ud)", "Elaborados del obrador", "", "UD", 1.35, 200, 320, 10],
  ["EL-003", "Salsa provenzal", "Elaborados del obrador", "", "KG", 6.4, 5, 6, 10],
];

export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla): Promise<void> {
  const t = ctx.tenantId;
  const obrador = ctx.centros.OB;

  const prov: Record<string, string> = {};
  for (const [nombre, contacto, telefono, diasReparto, minimo] of PROVEEDORES) {
    const p = await prisma.proveedor.upsert({
      where: { tenantId_nombre: { tenantId: t, nombre } },
      create: { tenantId: t, nombre, contacto, telefono, diasReparto, pedidoMinimo: new Prisma.Decimal(minimo), areas: ["COMIDAS"] },
      update: {},
    });
    prov[nombre] = p.id;
  }

  for (const [referencia, nombre, familia, proveedor, unidad, coste, minimo, stock, iva] of PRODUCTOS) {
    let familiaId = ctx.familias[`C|${familia}`];
    if (!familiaId) {
      const f = await prisma.familiaProducto.upsert({
        where: { tenantId_area_nombre: { tenantId: t, area: "COMIDAS", nombre: familia } },
        create: { tenantId: t, area: "COMIDAS", nombre: familia },
        update: {},
      });
      familiaId = f.id;
    }
    const p = await prisma.producto.upsert({
      where: { tenantId_referencia: { tenantId: t, referencia } },
      create: {
        tenantId: t,
        area: "COMIDAS",
        referencia,
        nombre,
        familiaId,
        proveedorId: proveedor ? prov[proveedor] : null,
        unidad,
        costeUnitario: new Prisma.Decimal(coste),
        iva: new Prisma.Decimal(iva),
        stockMinimo: new Prisma.Decimal(minimo),
      },
      update: {},
    });
    if (!obrador || stock <= 0) continue;
    const yaHay = await prisma.movimientoStock.count({ where: { tenantId: t, productoId: p.id, centroId: obrador } });
    if (yaHay === 0)
      await prisma.movimientoStock.create({
        data: {
          tenantId: t,
          centroId: obrador,
          productoId: p.id,
          tipo: "CARGA_INICIAL",
          cantidad: new Prisma.Decimal(stock),
          costeUnitario: new Prisma.Decimal(coste),
          documento: "SEMILLA",
          motivo: "Carga inicial de ejemplo (08/11/2026)",
        },
      });
  }
}
