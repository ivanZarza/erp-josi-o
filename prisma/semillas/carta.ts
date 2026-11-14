/**
 * Semilla de Carta y escandallos (sección del módulo Comidas, SOLO DESARROLLO).
 * Carta de La Vaca Argentina (13 platos) y de L'Albufera (11 platos) con escandallo y alérgenos,
 * un menú de Navidad temporal, objetivos de coste por marca, precios propios en Vaca Ibiza
 * y recargo de pan y aperitivo en todos los locales.
 * Usa los productos y recetas de la semilla del Obrador (la ejecuta antes: no duplica nada).
 * Solo se carga si la cadena no tiene ninguna carta.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";
import { unirAlergenos } from "../../src/modulos/comidas/carta-alergenos";
import { asegurarProductosAlimentacion, sembrar as sembrarObrador } from "./obrador";

// [nombre, nombre en inglés, descripción, descripción en inglés, precio, alérgenos revisados, etiquetas, escandallo [ref, neta, merma %]]
type Plato = [string, string, string, string, number, boolean, string[], [string, number, number][]];

const VACA: Record<string, [string, Plato[]]> = {
  Entrantes: [
    "Starters",
    [
      ["Empanada criolla de carne", "Beef empanada", "Carne cortada a cuchillo, horneada en el obrador.", "Hand-cut beef, baked in our kitchen.", 3.9, true, [], [["EL-002", 1, 0]]],
      ["Empanada de humita", "Sweetcorn empanada", "Maíz dulce, cebolla y queso fresco.", "Sweetcorn, onion and fresh cheese.", 3.9, true, ["vegetariano"], [["OB-EL-HUMITA", 1, 0]]],
      ["Provoleta a la parrilla", "Grilled provolone", "Con orégano y chimichurri.", "With oregano and chimichurri.", 12.5, true, ["vegetariano", "sin gluten"], [["LA-003", 0.16, 0], ["OB-OREGANO", 0.002, 0], ["EL-001", 0.02, 0]]],
      ["Chorizo criollo", "Argentine chorizo", "A la brasa, con pan de masa madre.", "Charcoal grilled, with sourdough bread.", 7.9, true, [], [["CA-005", 0.15, 0], ["OB-PAN", 0.25, 0], ["EL-001", 0.02, 0]]],
      ["Mollejas a la parrilla", "Grilled sweetbreads", "Crujientes, con limón.", "Crispy, with lemon.", 16.9, false, ["sin gluten"], [["CA-007", 0.25, 20], ["VE-005", 0.05, 30], ["OB-SAL", 0.003, 0]]],
    ],
  ],
  "De la parrilla": [
    "From the grill",
    [
      ["Bife de chorizo (400 g)", "Sirloin steak (400 g)", "Lomo bajo de vaca argentina.", "Argentine striploin.", 34.5, true, ["sin gluten"], [["CA-001", 0.4, 8], ["EL-001", 0.03, 0], ["OB-SAL", 0.004, 0]]],
      ["Entraña (350 g)", "Skirt steak (350 g)", "El corte más jugoso de la parrilla.", "The juiciest cut on the grill.", 26.5, true, ["sin gluten"], [["CA-002", 0.35, 10], ["EL-001", 0.03, 0], ["OB-SAL", 0.004, 0]]],
      ["Solomillo (300 g)", "Tenderloin (300 g)", "Con salsa provenzal.", "With provenzal sauce.", 31.5, true, ["sin gluten"], [["CA-003", 0.3, 12], ["EL-003", 0.03, 0], ["OB-SAL", 0.004, 0]]],
      ["Chuletón madurado 45 días (1 kg, 2 pers.)", "45-day aged rib steak (1 kg, for 2)", "Para compartir.", "To share.", 72, true, ["sin gluten"], [["CA-004", 1, 10], ["OB-SAL", 0.008, 0]]],
    ],
  ],
  Guarniciones: [
    "Sides",
    [
      ["Patatas fritas caseras", "Homemade chips", "", "", 4.9, true, ["vegano"], [["VE-001", 0.3, 15], ["OB-GIRASOL", 0.05, 0], ["OB-SAL", 0.003, 0]]],
      ["Ensalada de tomate y cebolla", "Tomato and onion salad", "", "", 7.5, true, ["vegano", "sin gluten"], [["VE-004", 0.25, 8], ["OB-CEBOLLA", 0.05, 10], ["OB-AOVE", 0.02, 0], ["OB-SAL", 0.002, 0]]],
    ],
  ],
  Postres: [
    "Desserts",
    [
      ["Tarta de queso", "Cheesecake", "Cremosa, con frambuesas.", "Creamy, with raspberries.", 7.5, true, ["vegetariano"], [["OB-EL-TARTAQ", 1, 0], ["OB-FRAMBUESA", 0.02, 0]]],
      ["Panqueque con dulce de leche", "Crêpe with dulce de leche", "", "", 7.5, false, ["vegetariano"], [["OB-EL-DULCE", 0.06, 0], ["OB-HARINA", 0.03, 0], ["OB-HUEVO", 1, 0], ["OB-LECHE", 0.08, 0], ["OB-MANTEQUILLA", 0.005, 0]]],
    ],
  ],
};

const ALBUFERA: Record<string, [string, Plato[]]> = {
  Entrantes: [
    "Starters",
    [
      ["Pulpo a la brasa", "Chargrilled octopus", "Con patata y pimentón de la Vera.", "With potato and smoked paprika.", 21.5, true, ["sin gluten"], [["PE-002", 0.2, 0], ["VE-001", 0.15, 15], ["OB-PIMENTON", 0.002, 0], ["OB-AOVE", 0.02, 0]]],
      ["Calamares a la andaluza", "Fried squid", "Con alioli.", "With alioli.", 14.5, true, [], [["OB-CALAMAR", 0.2, 25], ["OB-HARINA", 0.05, 0], ["OB-GIRASOL", 0.05, 0], ["VE-005", 0.03, 30], ["OB-MAYONESA", 0.03, 0]]],
      ["Ensalada de tomate rosa", "Pink tomato salad", "Con aceite de oliva virgen extra.", "With extra virgin olive oil.", 11, true, ["vegano", "sin gluten"], [["VE-004", 0.3, 8], ["OB-AOVE", 0.02, 0], ["OB-SAL", 0.002, 0]]],
      ["Gamba roja a la plancha", "Grilled red prawns", "De Huelva, a la sal.", "From Huelva, salt-grilled.", 26, true, ["sin gluten"], [["PE-003", 0.15, 0], ["OB-SAL", 0.004, 0]]],
    ],
  ],
  "Arroces (precio por persona, mínimo 2)": [
    "Rice dishes (per person, minimum 2)",
    [
      ["Paella valenciana", "Valencian paella", "Pollo, conejo, ferraura y garrofón.", "Chicken, rabbit and Valencian beans.", 19.5, true, ["sin gluten"], [["OB-ARROZ", 0.1, 0], ["OB-POLLO", 0.15, 5], ["OB-CONEJO", 0.1, 5], ["OB-JUDIA", 0.05, 8], ["OB-GARROFON", 0.03, 0], ["OB-EL-SOFRITO", 0.04, 0], ["OB-AZAFRAN", 0.0002, 0], ["OB-AOVE", 0.02, 0]]],
      ["Arroz a banda", "Arroz a banda (seafood rice)", "Con fumet de roca y alioli.", "With rock-fish stock and alioli.", 19, true, [], [["OB-ARROZ", 0.1, 0], ["OB-EL-FUMET", 0.35, 0], ["OB-CALAMAR", 0.06, 25], ["OB-EL-SOFRITO", 0.04, 0], ["OB-MAYONESA", 0.03, 0], ["OB-AOVE", 0.02, 0]]],
      ["Arroz del senyoret", "Senyoret rice", "Todo pelado: gamba roja, cigala y calamar.", "All peeled: red prawn, langoustine and squid.", 24, true, ["sin gluten"], [["OB-ARROZ", 0.1, 0], ["OB-EL-FUMET", 0.35, 0], ["PE-003", 0.06, 35], ["OB-CIGALA", 0.06, 55], ["OB-CALAMAR", 0.05, 25], ["OB-EL-SOFRITO", 0.04, 0], ["OB-AOVE", 0.02, 0]]],
      ["Fideuà", "Fideuà (noodle paella)", "Con calamar y gamba.", "With squid and prawns.", 18.5, false, [], [["OB-FIDEO", 0.1, 0], ["OB-EL-FUMET", 0.3, 0], ["OB-CALAMAR", 0.06, 25], ["PE-003", 0.04, 35], ["OB-EL-SOFRITO", 0.04, 0], ["OB-MAYONESA", 0.03, 0]]],
    ],
  ],
  Postres: [
    "Desserts",
    [
      ["Tarta de queso", "Cheesecake", "Cremosa, del obrador.", "Creamy, from our kitchen.", 7, true, ["vegetariano"], [["OB-EL-TARTAQ", 1, 0]]],
      ["Crema catalana", "Crema catalana", "Quemada al momento.", "Caramelised to order.", 6.5, true, ["vegetariano", "sin gluten"], [["OB-LECHE", 0.15, 0], ["OB-HUEVO", 2, 0], ["OB-AZUCAR", 0.04, 0], ["VE-005", 0.01, 30]]],
      ["Sorbete de limón al cava", "Lemon sorbet with cava", "", "", 6, false, ["vegano"], [["VE-005", 0.08, 30], ["OB-AZUCAR", 0.04, 0]]],
    ],
  ],
};

const RECARGO_POR_MARCA: Record<string, number> = { VACA: 3.5, RAZA: 4.5, ROXA: 3.8, ALBUFERA: 3.2, PUCHERO: 3.2, PALOMA: 5.5, GUAPO: 3.2 };

export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla): Promise<void> {
  const t = ctx.tenantId;
  if ((await prisma.carta.count({ where: { tenantId: t } })) > 0) return;
  // Las recetas del obrador dan los alérgenos de los elaborados: se asegura que estén (no duplica nada)
  await sembrarObrador(prisma, ctx);
  const ids = await asegurarProductosAlimentacion(prisma, ctx);
  const alerg = new Map((await prisma.cartaAlergenoProducto.findMany({ where: { tenantId: t } })).map((a) => [a.productoId, a]));

  // Objetivo de coste por marca
  const objetivos: Record<string, number> = { VACA: 40, RAZA: 38, ROXA: 33, ALBUFERA: 30, PUCHERO: 30, PALOMA: 32, GUAPO: 30 };
  for (const [clave, pct] of Object.entries(objetivos))
    if (ctx.marcas[clave]) await prisma.cartaObjetivoMarca.create({ data: { tenantId: t, marcaId: ctx.marcas[clave], objetivoCostePct: pct } });

  const crearCarta = async (marca: string, nombre: string, secciones: Record<string, [string, Plato[]]>) => {
    const marcaId = ctx.marcas[marca];
    if (!marcaId) return {} as Record<string, string>;
    const platosCreados: Record<string, string> = {};
    const carta = await prisma.carta.create({ data: { tenantId: t, marcaId, nombre, tipo: "PERMANENTE" } });
    let ordenSeccion = 0;
    for (const [seccion, [seccionEn, platos]] of Object.entries(secciones)) {
      const s = await prisma.cartaSeccion.create({ data: { cartaId: carta.id, nombre: seccion, nombreEn: seccionEn, orden: ++ordenSeccion } });
      let orden = 0;
      for (const [nombrePlato, nombreEn, desc, descEn, precio, revisado, etiquetas, escandallo] of platos) {
        const alergenos = unirAlergenos(...escandallo.map(([ref]) => alerg.get(ids[ref])?.alergenos ?? []));
        const trazas = unirAlergenos(...escandallo.map(([ref]) => alerg.get(ids[ref])?.trazas ?? [])).filter((x) => !alergenos.includes(x));
        const p = await prisma.cartaPlato.create({
          data: {
            tenantId: t,
            marcaId,
            nombre: nombrePlato,
            nombreEn,
            descripcion: desc || null,
            descripcionEn: descEn || null,
            precio,
            iva: 10,
            alergenos,
            trazas,
            alergenosRevisados: revisado,
            etiquetas,
            ingredientes: { create: escandallo.map(([ref, cantidad, merma], i) => ({ productoId: ids[ref], cantidad, mermaPct: merma, orden: i + 1 })) },
          },
        });
        platosCreados[nombrePlato] = p.id;
        await prisma.cartaLinea.create({ data: { seccionId: s.id, platoId: p.id, orden: ++orden } });
      }
    }
    return platosCreados;
  };

  const vaca = await crearCarta("VACA", "Carta La Vaca Argentina", VACA);
  await crearCarta("ALBUFERA", "Carta L'Albufera", ALBUFERA);

  // Menú de Navidad (temporal) de La Vaca Argentina con platos de la carta
  if (ctx.marcas.VACA && Object.keys(vaca).length > 0) {
    const anio = new Date().getFullYear();
    const navidad = await prisma.carta.create({
      data: { tenantId: t, marcaId: ctx.marcas.VACA, nombre: `Menú de Navidad ${anio}`, tipo: "TEMPORAL", desde: new Date(`${anio}-12-01T00:00:00Z`), hasta: new Date(`${anio + 1}-01-06T00:00:00Z`) },
    });
    const secciones: [string, string, string[]][] = [
      ["Para compartir", "To share", ["Empanada criolla de carne", "Provoleta a la parrilla", "Chorizo criollo"]],
      ["Principal a elegir", "Main course", ["Entraña (350 g)", "Bife de chorizo (400 g)"]],
      ["Postre", "Dessert", ["Tarta de queso"]],
    ];
    for (const [i, [nombre, nombreEn, platos]] of secciones.entries()) {
      const s = await prisma.cartaSeccion.create({ data: { cartaId: navidad.id, nombre, nombreEn, orden: i + 1 } });
      for (const [j, plato] of platos.entries()) if (vaca[plato]) await prisma.cartaLinea.create({ data: { seccionId: s.id, platoId: vaca[plato], orden: j + 1 } });
    }
  }

  // Variaciones por local: Ibiza +10 % en la parrilla; en Murcia no se sirve el chuletón
  const ibiza = ctx.centros["VA-IBI"];
  if (ibiza)
    for (const [nombre, precio] of [["Bife de chorizo (400 g)", 37.9], ["Entraña (350 g)", 29.5], ["Solomillo (300 g)", 34.5], ["Chuletón madurado 45 días (1 kg, 2 pers.)", 79]] as [string, number][])
      if (vaca[nombre]) await prisma.cartaPlatoPrecio.create({ data: { platoId: vaca[nombre], centroId: ibiza, precio } });
  const murcia = ctx.centros["VA-MUR"];
  const chuleton = vaca["Chuletón madurado 45 días (1 kg, 2 pers.)"];
  if (murcia && chuleton) await prisma.cartaPlatoPrecio.create({ data: { platoId: chuleton, centroId: murcia, disponible: false } });

  // Pan y aperitivo por persona en cada local
  const locales = await prisma.centro.findMany({ where: { tenantId: t, tipo: "LOCAL" }, select: { id: true, marcaId: true } });
  const claveMarca = new Map(Object.entries(ctx.marcas).map(([clave, id]) => [id, clave]));
  for (const l of locales) {
    const importe = RECARGO_POR_MARCA[claveMarca.get(l.marcaId ?? "") ?? ""];
    if (importe) await prisma.cartaRecargo.create({ data: { tenantId: t, centroId: l.id, importe, iva: 10 } });
  }
}
