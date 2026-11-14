/**
 * Semilla del módulo Obrador (SOLO DESARROLLO).
 * - Ingredientes de alimentación con sus alérgenos (referencias OB-; las CA-, PE-, VE-, LA- y EL-
 *   son las de la semilla de Comidas: se crean aquí solo si aún no existen, con los mismos datos).
 * - 8 recetas de producción (empanadas, chimichurri, provenzal, tarta de queso, dulce de leche,
 *   fumet y sofrito para L'Albufera), producción cerrada de los dos últimos días con lotes,
 *   órdenes planificadas para hoy y mañana, y tarifas a locales a coste + 15 %.
 * Se puede ejecutar varias veces: no duplica nada.
 * Exporta `asegurarProductosAlimentacion`, que usa también la semilla de Carta.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";
import { cantidadBruta, redondear, unirAlergenos } from "../../src/modulos/comidas/carta-alergenos";

type Fila = [referencia: string, nombre: string, familia: string, unidad: string, coste: number, iva: number, alergenos: string[], trazas?: string[]];

/** Catálogo de alimentación que usan las recetas del obrador y los escandallos de la carta. */
export const PRODUCTOS_ALIMENTACION: Fila[] = [
  // De la semilla de Comidas (mismos datos)
  ["CA-001", "Lomo bajo de vaca argentina (bife de chorizo)", "Carnes", "KG", 28.5, 10, []],
  ["CA-002", "Entraña fina argentina", "Carnes", "KG", 24.9, 10, []],
  ["CA-003", "Solomillo de vaca", "Carnes", "KG", 34.8, 10, []],
  ["CA-004", "Chuletón de vaca madurada 45 días", "Carnes", "KG", 31.2, 10, []],
  ["CA-005", "Chorizo criollo", "Carnes", "KG", 9.4, 10, ["SULFITOS"]],
  ["CA-006", "Morcilla de Burgos", "Carnes", "KG", 7.2, 10, [], ["GLUTEN"]],
  ["CA-007", "Molleja de ternera", "Carnes", "KG", 18.6, 10, []],
  ["PE-002", "Pulpo cocido (pata)", "Pescados y mariscos", "KG", 26.4, 10, ["MOLUSCOS"]],
  ["PE-003", "Gamba roja de Huelva", "Pescados y mariscos", "KG", 42, 10, ["CRUSTACEOS"]],
  ["VE-001", "Patata agria para freír", "Verduras y frutas", "KG", 0.95, 4, []],
  ["VE-004", "Tomate rosa", "Verduras y frutas", "KG", 2.9, 4, []],
  ["VE-005", "Limón", "Verduras y frutas", "KG", 1.6, 4, []],
  ["LA-002", "Nata para cocinar 35 % (brik 1 l)", "Lácteos y huevos", "L", 3.4, 10, ["LECHE"]],
  ["LA-003", "Queso provolone en lonchas", "Lácteos y huevos", "KG", 11.8, 10, ["LECHE"]],
  // Propios del obrador
  ["OB-HARINA", "Harina de trigo 000 (saco 25 kg)", "Seco y despensa", "KG", 0.85, 4, ["GLUTEN"]],
  ["OB-MANTECA", "Manteca de cerdo", "Seco y despensa", "KG", 3.2, 10, []],
  ["OB-CARNEPIC", "Carne de vaca para picar a cuchillo (aguja)", "Carnes", "KG", 11.5, 10, []],
  ["OB-CEBOLLA", "Cebolla blanca", "Verduras y frutas", "KG", 1.1, 4, []],
  ["OB-CEBOLLETA", "Cebolleta", "Verduras y frutas", "KG", 2.4, 4, []],
  ["OB-PIMROJO", "Pimiento rojo", "Verduras y frutas", "KG", 2.6, 4, []],
  ["OB-HUEVO", "Huevo campero (ud)", "Lácteos y huevos", "UD", 0.24, 4, ["HUEVOS"]],
  ["OB-ACEITUNA", "Aceituna verde deshuesada", "Seco y despensa", "KG", 5.8, 10, []],
  ["OB-COMINO", "Comino molido", "Seco y despensa", "KG", 18, 10, []],
  ["OB-PIMENTON", "Pimentón de la Vera dulce", "Seco y despensa", "KG", 14, 10, []],
  ["OB-PEREJIL", "Perejil fresco", "Verduras y frutas", "KG", 6.5, 4, []],
  ["OB-AJO", "Ajo morado", "Verduras y frutas", "KG", 4.8, 4, []],
  ["OB-OREGANO", "Orégano seco", "Seco y despensa", "KG", 22, 10, []],
  ["OB-AOVE", "Aceite de oliva virgen extra", "Seco y despensa", "L", 8.2, 4, []],
  ["OB-GIRASOL", "Aceite de girasol alto oleico", "Seco y despensa", "L", 2.1, 10, []],
  ["OB-VINAGRE", "Vinagre de vino tinto", "Seco y despensa", "L", 2.4, 10, ["SULFITOS"]],
  ["OB-GUINDILLA", "Guindilla en copos (ají molido)", "Seco y despensa", "KG", 16, 10, []],
  ["OB-SAL", "Sal marina", "Seco y despensa", "KG", 0.6, 10, []],
  ["OB-QCREMA", "Queso crema para tarta", "Lácteos y huevos", "KG", 7.9, 10, ["LECHE"]],
  ["OB-AZUCAR", "Azúcar blanco", "Seco y despensa", "KG", 1.1, 10, []],
  ["OB-GALLETA", "Galleta tipo digestive", "Seco y despensa", "KG", 3.9, 10, ["GLUTEN", "LECHE"], ["SOJA"]],
  ["OB-MANTEQUILLA", "Mantequilla", "Lácteos y huevos", "KG", 8.5, 10, ["LECHE"]],
  ["OB-LECHE", "Leche entera", "Lácteos y huevos", "L", 0.95, 4, ["LECHE"]],
  ["OB-BICARB", "Bicarbonato sódico", "Seco y despensa", "KG", 4, 10, []],
  ["OB-MAIZ", "Maíz dulce en grano", "Verduras y frutas", "KG", 3.2, 10, []],
  ["OB-QFRESCO", "Queso fresco", "Lácteos y huevos", "KG", 6.4, 10, ["LECHE"]],
  ["OB-ESPINAS", "Espinas y cabezas de pescado de roca", "Pescados y mariscos", "KG", 1.8, 10, ["PESCADO"]],
  ["OB-PUERRO", "Puerro", "Verduras y frutas", "KG", 1.9, 4, []],
  ["OB-APIO", "Apio en rama", "Verduras y frutas", "KG", 2.2, 4, ["APIO"]],
  ["OB-NORA", "Ñora seca", "Seco y despensa", "KG", 24, 10, []],
  ["OB-AZAFRAN", "Azafrán en hebra", "Seco y despensa", "KG", 3500, 10, []],
  ["OB-ARROZ", "Arroz bomba (a granel)", "Seco y despensa", "KG", 4.3, 4, []],
  ["OB-FIDEO", "Fideo fino de fideuà", "Seco y despensa", "KG", 2.1, 4, ["GLUTEN"], ["HUEVOS"]],
  ["OB-CALAMAR", "Calamar limpio", "Pescados y mariscos", "KG", 9.5, 10, ["MOLUSCOS"]],
  ["OB-CIGALA", "Cigala mediana", "Pescados y mariscos", "KG", 32, 10, ["CRUSTACEOS"]],
  ["OB-POLLO", "Contramuslo de pollo de corral", "Carnes", "KG", 5.9, 10, []],
  ["OB-CONEJO", "Conejo troceado", "Carnes", "KG", 7.4, 10, []],
  ["OB-JUDIA", "Judía ferraura", "Verduras y frutas", "KG", 6, 4, []],
  ["OB-GARROFON", "Garrofón", "Verduras y frutas", "KG", 7.5, 4, []],
  ["OB-PAN", "Pan de masa madre (pieza)", "Seco y despensa", "UD", 1.1, 4, ["GLUTEN"], ["SESAMO"]],
  ["OB-MAYONESA", "Mayonesa para alioli", "Seco y despensa", "KG", 4, 10, ["HUEVOS", "MOSTAZA"]],
  ["OB-FRAMBUESA", "Frambuesa", "Verduras y frutas", "KG", 12, 4, []],
  ["OB-RUCULA", "Rúcula", "Verduras y frutas", "KG", 9, 4, []],
  ["OB-PARMESANO", "Parmesano en lascas", "Lácteos y huevos", "KG", 18, 10, ["LECHE"]],
  // Elaborados (EL- de la semilla de Comidas y OB-EL- propios): sus alérgenos salen de la receta
  ["EL-001", "Chimichurri de la casa", "Elaborados del obrador", "KG", 8.2, 10, []],
  ["EL-002", "Empanada criolla de carne (ud)", "Elaborados del obrador", "UD", 1.35, 10, []],
  ["EL-003", "Salsa provenzal", "Elaborados del obrador", "KG", 6.4, 10, []],
  ["OB-EL-HUMITA", "Empanada de humita (ud)", "Elaborados del obrador", "UD", 0, 10, []],
  ["OB-EL-TARTAQ", "Tarta de queso cremosa (ración)", "Elaborados del obrador", "RACION", 0, 10, []],
  ["OB-EL-DULCE", "Dulce de leche casero", "Elaborados del obrador", "KG", 0, 10, []],
  ["OB-EL-FUMET", "Fumet de pescado de roca", "Elaborados del obrador", "L", 0, 10, []],
  ["OB-EL-SOFRITO", "Sofrito de tomate y ñora para arroces", "Elaborados del obrador", "KG", 0, 10, []],
];

const ELABORADOS = new Set(PRODUCTOS_ALIMENTACION.filter((p) => p[2] === "Elaborados del obrador").map((p) => p[0]));

/** Crea (si no existen) los productos de alimentación y sus alérgenos. Devuelve referencia → id. */
export async function asegurarProductosAlimentacion(prisma: PrismaClient, ctx: ContextoSemilla): Promise<Record<string, string>> {
  const t = ctx.tenantId;
  const ids: Record<string, string> = {};
  const familias: Record<string, string> = {};
  for (const [referencia, nombre, familia, unidad, coste, iva, alergenos, trazas] of PRODUCTOS_ALIMENTACION) {
    if (!familias[familia]) {
      familias[familia] =
        ctx.familias[`C|${familia}`] ??
        (
          await prisma.familiaProducto.upsert({
            where: { tenantId_area_nombre: { tenantId: t, area: "COMIDAS", nombre: familia } },
            create: { tenantId: t, area: "COMIDAS", nombre: familia },
            update: {},
          })
        ).id;
    }
    const p = await prisma.producto.upsert({
      where: { tenantId_referencia: { tenantId: t, referencia } },
      create: { tenantId: t, area: "COMIDAS", referencia, nombre, familiaId: familias[familia], unidad, costeUnitario: coste, iva },
      update: {},
    });
    ids[referencia] = p.id;
    if (!ELABORADOS.has(referencia)) {
      const ya = await prisma.cartaAlergenoProducto.findUnique({ where: { tenantId_productoId: { tenantId: t, productoId: p.id } } });
      if (!ya) await prisma.cartaAlergenoProducto.create({ data: { tenantId: t, productoId: p.id, alergenos, trazas: trazas ?? [] } });
    }
  }
  return ids;
}

// [referencia del elaborado, nombre de la receta, rendimiento, vida útil (días), conservación, minutos, alérgenos propios, pasos, ingredientes [ref, neta, merma %]]
type Receta = [string, string, number, number, string, number, string[], string, [string, number, number][]];

const RECETAS: Receta[] = [
  [
    "EL-002",
    "Empanada criolla de carne cortada a cuchillo",
    60,
    4,
    "Refrigerado de 0 a 4 °C",
    180,
    [],
    "1. Picar la carne a cuchillo.\n2. Rehogar cebolla, cebolleta y pimiento en manteca; añadir la carne, comino, pimentón y ají.\n3. Enfriar el relleno y añadir huevo duro y aceituna.\n4. Masa: harina, manteca, agua y sal. Estirar, cortar discos de 14 cm.\n5. Rellenar, hacer el repulgue y hornear 18 min a 220 °C.",
    [
      ["OB-CARNEPIC", 2.4, 8],
      ["OB-CEBOLLA", 1.2, 10],
      ["OB-CEBOLLETA", 0.6, 15],
      ["OB-PIMROJO", 0.4, 15],
      ["OB-MANTECA", 1.2, 0],
      ["OB-HARINA", 3.6, 0],
      ["OB-HUEVO", 10, 0],
      ["OB-ACEITUNA", 0.25, 0],
      ["OB-COMINO", 0.02, 0],
      ["OB-PIMENTON", 0.04, 0],
      ["OB-GUINDILLA", 0.01, 0],
      ["OB-SAL", 0.08, 0],
    ],
  ],
  [
    "OB-EL-HUMITA",
    "Empanada de humita",
    40,
    4,
    "Refrigerado de 0 a 4 °C",
    150,
    [],
    "1. Rehogar cebolla y pimiento.\n2. Añadir maíz triturado, leche y queso fresco; espesar.\n3. Masa como la criolla. Rellenar y hornear 18 min a 220 °C.",
    [
      ["OB-MAIZ", 1.6, 0],
      ["OB-CEBOLLA", 0.6, 10],
      ["OB-PIMROJO", 0.3, 15],
      ["OB-LECHE", 0.5, 0],
      ["OB-QFRESCO", 0.6, 0],
      ["OB-MANTECA", 0.8, 0],
      ["OB-HARINA", 2.4, 0],
      ["OB-SAL", 0.05, 0],
    ],
  ],
  [
    "EL-001",
    "Chimichurri de la casa",
    5,
    10,
    "Refrigerado de 0 a 4 °C, en bote cerrado",
    40,
    [],
    "1. Picar perejil y ajo muy finos.\n2. Mezclar con orégano, ají, pimentón y sal.\n3. Añadir vinagre, agua y aceite. Reposar 24 h antes de servir.",
    [
      ["OB-PEREJIL", 0.6, 25],
      ["OB-AJO", 0.25, 12],
      ["OB-OREGANO", 0.08, 0],
      ["OB-GUINDILLA", 0.03, 0],
      ["OB-PIMENTON", 0.03, 0],
      ["OB-SAL", 0.06, 0],
      ["OB-VINAGRE", 0.9, 0],
      ["OB-GIRASOL", 2.2, 0],
      ["OB-AOVE", 0.8, 0],
    ],
  ],
  [
    "EL-003",
    "Salsa provenzal",
    3,
    5,
    "Refrigerado de 0 a 4 °C",
    25,
    [],
    "Picar ajo y perejil, emulsionar con aceite de oliva y sal.",
    [
      ["OB-AJO", 0.5, 12],
      ["OB-PEREJIL", 0.5, 25],
      ["OB-AOVE", 2.1, 0],
      ["OB-SAL", 0.04, 0],
    ],
  ],
  [
    "OB-EL-TARTAQ",
    "Tarta de queso cremosa (2 tartas de 12 raciones)",
    24,
    5,
    "Refrigerado de 0 a 4 °C",
    90,
    [],
    "1. Base de galleta triturada con mantequilla.\n2. Batir queso crema, azúcar, huevos y nata.\n3. Hornear 45 min a 200 °C. Abatir y porcionar en 12.",
    [
      ["OB-QCREMA", 2, 0],
      ["OB-AZUCAR", 0.6, 0],
      ["OB-HUEVO", 12, 0],
      ["LA-002", 1, 0],
      ["OB-GALLETA", 0.4, 0],
      ["OB-MANTEQUILLA", 0.15, 0],
    ],
  ],
  [
    "OB-EL-DULCE",
    "Dulce de leche casero",
    4,
    20,
    "Refrigerado, en bote cerrado",
    240,
    [],
    "Reducir leche y azúcar con una pizca de bicarbonato a fuego lento 4 h, removiendo, hasta punto de napa.",
    [
      ["OB-LECHE", 10, 0],
      ["OB-AZUCAR", 2, 0],
      ["OB-BICARB", 0.01, 0],
    ],
  ],
  [
    "OB-EL-FUMET",
    "Fumet de pescado de roca para arroces",
    20,
    3,
    "Refrigerado de 0 a 4 °C (o congelado 3 meses)",
    120,
    [],
    "1. Tostar espinas y cabezas con aceite.\n2. Añadir puerro, apio, cebolla y tomate.\n3. Mojar con agua fría, cocer 40 min y colar.",
    [
      ["OB-ESPINAS", 6, 0],
      ["OB-PUERRO", 0.8, 20],
      ["OB-APIO", 0.4, 15],
      ["OB-CEBOLLA", 0.6, 10],
      ["VE-004", 0.8, 8],
      ["OB-AOVE", 0.2, 0],
      ["OB-SAL", 0.08, 0],
    ],
  ],
  [
    "OB-EL-SOFRITO",
    "Sofrito de tomate y ñora para arroces",
    5,
    7,
    "Refrigerado de 0 a 4 °C",
    150,
    [],
    "Sofreír ajo y ñora hidratada en aceite, añadir tomate rallado y pimentón, y confitar 2 h a fuego suave.",
    [
      ["VE-004", 8, 25],
      ["OB-AJO", 0.3, 12],
      ["OB-NORA", 0.15, 0],
      ["OB-PIMENTON", 0.06, 0],
      ["OB-AOVE", 1.2, 0],
      ["OB-SAL", 0.06, 0],
    ],
  ],
];

const DIA_MS = 24 * 60 * 60 * 1000;

async function siguiente(prisma: PrismaClient, tenantId: string, serie: string, digitos = 6) {
  const anio = new Date().getFullYear();
  const c = await prisma.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return `${serie}-${String(c.valor).padStart(digitos, "0")}`;
}

function hoyMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla): Promise<void> {
  const t = ctx.tenantId;
  const ob = ctx.centros.OB;
  if (!ob) return;
  const ids = await asegurarProductosAlimentacion(prisma, ctx);
  const productos = await prisma.producto.findMany({ where: { tenantId: t, id: { in: Object.values(ids) } } });
  const coste = new Map(productos.map((p) => [p.id, Number(p.costeUnitario)]));
  const alerg = new Map((await prisma.cartaAlergenoProducto.findMany({ where: { tenantId: t } })).map((a) => [a.productoId, a]));

  // Stock inicial de las materias primas en el obrador (solo si no tienen movimientos)
  for (const [referencia, , , unidad] of PRODUCTOS_ALIMENTACION) {
    if (ELABORADOS.has(referencia)) continue;
    const productoId = ids[referencia];
    const ya = await prisma.movimientoStock.count({ where: { tenantId: t, centroId: ob, productoId } });
    if (ya > 0) continue;
    const cantidad = referencia === "OB-AZAFRAN" ? 0.2 : unidad === "UD" ? 240 : 40;
    await prisma.movimientoStock.create({
      data: { tenantId: t, centroId: ob, productoId, tipo: "CARGA_INICIAL", cantidad, costeUnitario: coste.get(productoId) ?? 0, documento: "SEMILLA", motivo: "Carga inicial de ejemplo del obrador (08/11/2026)", createdAt: new Date(Date.now() - 5 * DIA_MS) },
    });
  }

  // Recetas
  const recetas: Record<string, { id: string; productoId: string; rendimiento: number; vida: number; conservacion: string; lineas: [string, number, number][] }> = {};
  for (const [ref, nombre, rendimiento, vida, conservacion, minutos, propios, pasos, lineas] of RECETAS) {
    const productoId = ids[ref];
    let r = await prisma.obradorReceta.findFirst({ where: { tenantId: t, productoId } });
    if (!r)
      r = await prisma.obradorReceta.create({
        data: {
          tenantId: t,
          centroId: ob,
          productoId,
          nombre,
          rendimiento,
          vidaUtilDias: vida,
          conservacion,
          tiempoMinutos: minutos,
          pasos,
          alergenosPropios: propios,
          lineas: { create: lineas.map(([ing, cantidad, merma], i) => ({ productoId: ids[ing], cantidad, mermaPct: merma, orden: i + 1 })) },
        },
      });
    recetas[ref] = { id: r.id, productoId, rendimiento, vida, conservacion, lineas };
    // Alérgenos del elaborado = suma de los de sus ingredientes
    const a = unirAlergenos(propios, ...lineas.map(([ing]) => alerg.get(ids[ing])?.alergenos ?? []));
    const tr = unirAlergenos(...lineas.map(([ing]) => alerg.get(ids[ing])?.trazas ?? [])).filter((x) => !a.includes(x));
    await prisma.cartaAlergenoProducto.upsert({
      where: { tenantId_productoId: { tenantId: t, productoId } },
      create: { tenantId: t, productoId, alergenos: a, trazas: tr },
      update: { alergenos: a, trazas: tr },
    });
  }

  // Producción de ejemplo (solo la primera vez)
  const hayOrdenes = await prisma.obradorOrden.count({ where: { tenantId: t } });
  if (hayOrdenes === 0) {
    const hoy = hoyMadrid();
    const dia = (n: number) => new Date(new Date(`${hoy}T00:00:00Z`).getTime() + n * DIA_MS);
    // [receta, días desde hoy, tandas, rendimiento real (factor)]
    const cerradas: [string, number, number, number][] = [
      ["EL-002", -2, 2, 0.98],
      ["EL-001", -2, 1, 1],
      ["OB-EL-TARTAQ", -1, 1, 1],
      ["OB-EL-FUMET", -1, 1, 0.95],
      ["OB-EL-SOFRITO", -1, 1, 1],
      ["OB-EL-DULCE", -3, 1, 1],
      ["EL-003", -6, 1, 1],
    ];
    for (const [ref, dias, tandas, factor] of cerradas) {
      const r = recetas[ref];
      const numero = await siguiente(prisma, t, "OP");
      const codigo = await siguiente(prisma, t, "LOTE");
      const elaboradoEn = new Date(dia(dias).getTime() + 9 * 60 * 60 * 1000); // 10:00 en Madrid aprox.
      const consumo = r.lineas.map(([ing, neta, merma]) => ({ productoId: ids[ing], cantidad: redondear(cantidadBruta(neta, merma) * tandas, 3), cu: coste.get(ids[ing]) ?? 0 }));
      const costeTotal = consumo.reduce((s, c) => s + c.cantidad * c.cu, 0);
      const cantidadReal = redondear(r.rendimiento * tandas * factor, 3);
      const cu = redondear(costeTotal / cantidadReal);
      const orden = await prisma.obradorOrden.create({
        data: {
          tenantId: t,
          centroId: ob,
          numero,
          recetaId: r.id,
          fecha: dia(dias),
          tandas,
          cantidadPrevista: r.rendimiento * tandas,
          cantidadReal,
          costeTotal: redondear(costeTotal),
          costeUnitario: cu,
          estado: "CERRADA",
          cerradoEn: elaboradoEn,
          notas: "Producción de ejemplo (semilla)",
        },
      });
      await prisma.movimientoStock.createMany({
        data: [
          ...consumo.map((c) => ({ tenantId: t, centroId: ob, productoId: c.productoId, tipo: "PRODUCCION_CONSUMO" as const, cantidad: -c.cantidad, costeUnitario: c.cu, documento: numero, documentoId: orden.id, motivo: `Producción ${codigo}`, createdAt: elaboradoEn })),
          { tenantId: t, centroId: ob, productoId: r.productoId, tipo: "PRODUCCION_ENTRADA" as const, cantidad: cantidadReal, costeUnitario: cu, documento: numero, documentoId: orden.id, motivo: `Lote ${codigo}`, createdAt: elaboradoEn },
        ],
      });
      const a = await prisma.cartaAlergenoProducto.findUnique({ where: { tenantId_productoId: { tenantId: t, productoId: r.productoId } } });
      await prisma.obradorLote.create({
        data: {
          tenantId: t,
          centroId: ob,
          codigo,
          ordenId: orden.id,
          productoId: r.productoId,
          cantidad: cantidadReal,
          costeUnitario: cu,
          elaboradoEn,
          caducaEn: new Date(elaboradoEn.getTime() + r.vida * DIA_MS),
          alergenos: a?.alergenos ?? [],
          conservacion: r.conservacion,
          ingredientes: { create: consumo.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad, costeUnitario: c.cu })) },
        },
      });
      await prisma.producto.update({ where: { id: r.productoId }, data: { costeUnitario: cu } });
      coste.set(r.productoId, cu);
    }
    // Planificadas para hoy y mañana
    for (const [ref, dias, tandas] of [["EL-002", 0, 2], ["OB-EL-HUMITA", 0, 1], ["OB-EL-TARTAQ", 1, 1], ["OB-EL-FUMET", 1, 2]] as [string, number, number][]) {
      const r = recetas[ref];
      await prisma.obradorOrden.create({
        data: { tenantId: t, centroId: ob, numero: await siguiente(prisma, t, "OP"), recetaId: r.id, fecha: dia(dias), tandas, cantidadPrevista: r.rendimiento * tandas, notas: "Planificada (semilla)" },
      });
    }
  }

  // Elaborados sin producción: coste = coste de la receta por unidad
  for (const r of Object.values(recetas)) {
    if ((coste.get(r.productoId) ?? 0) > 0) continue;
    const total = r.lineas.reduce((s, [ing, neta, merma]) => s + cantidadBruta(neta, merma) * (coste.get(ids[ing]) ?? 0), 0);
    const cu = redondear(total / r.rendimiento);
    await prisma.producto.update({ where: { id: r.productoId }, data: { costeUnitario: cu } });
    coste.set(r.productoId, cu);
  }

  // Tarifas a locales: coste + 15 % en todos; la empanada a precio fijo en Ibiza (transporte)
  const hayTarifas = await prisma.obradorTarifa.count({ where: { tenantId: t } });
  if (hayTarifas === 0) {
    const locales = await prisma.centro.findMany({ where: { tenantId: t, tipo: "LOCAL" }, select: { id: true, codigo: true } });
    for (const r of Object.values(recetas)) {
      for (const l of locales) {
        const fijo = r.productoId === ids["EL-002"] && l.codigo === "VA-IBI";
        const precio = fijo ? 2.1 : redondear((coste.get(r.productoId) ?? 0) * 1.15);
        await prisma.obradorTarifa.create({
          data: { tenantId: t, obradorId: ob, productoId: r.productoId, centroId: l.id, modo: fijo ? "PRECIO_FIJO" : "COSTE_MAS_PORCENTAJE", porcentaje: fijo ? null : 15, precioFijo: fijo ? 2.1 : null },
        });
        await prisma.productoCentro.upsert({
          where: { productoId_centroId: { productoId: r.productoId, centroId: l.id } },
          create: { productoId: r.productoId, centroId: l.id, precioVenta: precio },
          update: { precioVenta: precio },
        });
      }
    }
  }
}
