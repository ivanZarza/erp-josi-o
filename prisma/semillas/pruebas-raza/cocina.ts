/**
 * Parte «cocina» del local Raza Pruebas (RZ-PRU), con la carta real de Raza Madrid (10/2026).
 *
 * Crea (todo inventado salvo platos y precios de la carta):
 *  1. 10 proveedores de comida (carne madurada, importación, carnicería, pescadería, fruta y verdura,
 *     lácteos, panadería, despensa, congelados y aceites).
 *  2. Catálogo de ingredientes RZC-… con familia, unidad, coste 2026, IVA de compra y alérgenos.
 *  3. Carta «Carta Raza Pruebas» (marca Raza) con los 62 platos de comida, escandallo por ración,
 *     merma, alérgenos deducidos de los ingredientes y recargo de pan y aperitivo en RZ-PRU.
 *  4. Obrador (OB): 31 elaborados RZO-… con receta, tarifa a RZ-PRU (coste + 12 %), órdenes y lotes.
 *  5. Ocho semanas de historia hacia atrás desde ctx.hoy, simuladas día a día:
 *     compras recibidas en RZ-PRU y en el obrador, pedidos internos RZ-PRU → OB (lunes, miércoles y
 *     viernes) con su producción previa, consumo diario del local según las ventas estimadas y los
 *     escandallos, mermas con motivo, caducidades de lotes en el obrador y un inventario semanal.
 *
 * El stock se escribe solo con movimientos (como hace el motor del núcleo), pero en lotes con
 * createMany para que la carga en la nube sea rápida. Los números de documento se reservan en el
 * contador de cada serie y se reparten por orden de fecha. Nada usa ids fijos.
 * Si el catálogo RZC- ya existe, la parte no hace nada (no duplica).
 */
import type { Prisma, PrismaClient, TipoMovimiento } from "../../../src/generated/prisma/client";
import { cantidadBruta, unirAlergenos } from "../../../src/modulos/comidas/carta-alergenos";
import { PREFIJO, type ContextoPruebas, type PlatoCarta } from "./contexto";

// ===========================================================================
// 1. Proveedores de comida (inventados)
// ===========================================================================

type ClaveProv = "MAD" | "IMP" | "CAR" | "PES" | "FYV" | "LAC" | "PAN" | "DES" | "CON" | "ACE";
type Via = "whatsapp" | "email" | "telefono";

interface DatosProveedor {
  nombre: string;
  cif: string;
  contacto: string;
  telefono: string;
  email: string;
  diasReparto: string;
  dias: number[]; // 0 domingo … 6 sábado
  minimo: number;
  via: Via;
  prefijoAlbaran: string;
  notas: string;
}

const PROVEEDORES: Record<ClaveProv, DatosProveedor> = {
  MAD: {
    nombre: "MADURADOS DEL NORTE CARNES SELECTAS S.L.", cif: "B39471825", contacto: "Íñigo Basterra", telefono: "+34644218937",
    email: "pedidos@maduradosdelnorte.es", diasReparto: "Martes y viernes", dias: [2, 5], minimo: 400, via: "whatsapp", prefijoAlbaran: "MN",
    notas: "Carne madurada nacional y europea (Retinta, Rubia Gallega, Simmental, Ayrshire). Corte a medida; pedido antes de las 13:00 del día anterior.",
  },
  IMP: {
    nombre: "PAMPA & PRAIRIE IMPORT S.L.", cif: "B87265431", contacto: "Valeria Ruiz", telefono: "+34659304712",
    email: "comercial@pampaprairie.es", diasReparto: "Miércoles", dias: [3], minimo: 600, via: "email", prefijoAlbaran: "PPI",
    notas: "Angus argentino, Black Angus USDA de Nebraska y wagyu. Pedido cerrado el lunes a las 14:00.",
  },
  CAR: {
    nombre: "CARNICERÍA Y CHARCUTERÍA HERMANOS LOZANO S.L.", cif: "B28957316", contacto: "Raúl Lozano", telefono: "+34626481053",
    email: "pedidos@carniceriaslozano.es", diasReparto: "Lunes, miércoles y viernes", dias: [1, 3, 5], minimo: 120, via: "whatsapp", prefijoAlbaran: "HL",
    notas: "Casquería, embutido criollo, aves, ibéricos y huesos para fondos.",
  },
  PES: {
    nombre: "PESCADOS Y MARISCOS LONJA CENTRO S.L.", cif: "B84719265", contacto: "Marisa Pardo", telefono: "+34677390214",
    email: "lonja@pescadoslonjacentro.es", diasReparto: "De martes a sábado", dias: [2, 3, 4, 5, 6], minimo: 100, via: "whatsapp", prefijoAlbaran: "LC",
    notas: "Mercamadrid. Pedido antes de las 20:00 del día anterior.",
  },
  FYV: {
    nombre: "FRUTAS Y VERDURAS LA HUERTA DE ARANJUEZ S.L.", cif: "B45831907", contacto: "Toni Muñoz", telefono: "+34615872340",
    email: "pedidos@huertadearanjuez.es", diasReparto: "De lunes a sábado", dias: [1, 2, 3, 4, 5, 6], minimo: 60, via: "whatsapp", prefijoAlbaran: "HA",
    notas: "Fruta, verdura, hierbas frescas y trufa de temporada.",
  },
  LAC: {
    nombre: "LÁCTEOS Y HUEVOS SIERRA NORTE S.L.", cif: "B86140592", contacto: "Carmen Albarrán", telefono: "+34690125874",
    email: "pedidos@lacteossierranorte.es", diasReparto: "Lunes, miércoles y viernes", dias: [1, 3, 5], minimo: 80, via: "whatsapp", prefijoAlbaran: "SN",
    notas: "Quesos nacionales e italianos, nata, mantequilla y huevo campero.",
  },
  PAN: {
    nombre: "PANADERÍA OBRADOR SAN LORENZO S.L.", cif: "B82614379", contacto: "Julián Arribas", telefono: "+34636902514",
    email: "pedidos@panaderiasanlorenzo.es", diasReparto: "Todos los días, antes de las 10:00", dias: [0, 1, 2, 3, 4, 5, 6], minimo: 30, via: "telefono", prefijoAlbaran: "SL",
    notas: "Hogaza de masa madre, pan brioche, picos y panko.",
  },
  DES: {
    nombre: "DESPENSA GOURMET IBERIA DISTRIBUCIÓN S.A.", cif: "A78526140", contacto: "Sergio Navas", telefono: "+34618034975",
    email: "pedidos@despensaiberia.es", diasReparto: "Martes", dias: [2], minimo: 150, via: "email", prefijoAlbaran: "DGI",
    notas: "Seco, especias, conservas, chocolate, pasta y vinos de cocina.",
  },
  CON: {
    nombre: "CONGELADOS FRÍO MADRID S.L.", cif: "B85390127", contacto: "Lorena Gil", telefono: "+34651740293",
    email: "pedidos@congeladosfriomadrid.es", diasReparto: "Jueves", dias: [4], minimo: 200, via: "whatsapp", prefijoAlbaran: "FM",
    notas: "Helado artesano en cubeta de 5 l, patata prefrita, boletus y hojaldre.",
  },
  ACE: {
    nombre: "ACEITES ALMAZARA SIERRA MÁGINA S.C.A.", cif: "F23461785", contacto: "Antonio Expósito", telefono: "+34687215460",
    email: "ventas@almazarasierramagina.es", diasReparto: "Lunes", dias: [1], minimo: 250, via: "telefono", prefijoAlbaran: "ASM",
    notas: "Reparto semanal en Madrid; portes pagados a partir de 250 €.",
  },
};

// ===========================================================================
// 2. Ingredientes (RZC-…)
// ===========================================================================

type Familia = "Carnes" | "Pescados y mariscos" | "Verduras y frutas" | "Lácteos y huevos" | "Seco y despensa";
type Unidad = "KG" | "L" | "UD";
// [código, nombre, familia, unidad, coste €/ud 2026, IVA compra, proveedor, alérgenos, trazas, paso de compra]
type FilaIng = [string, string, Familia, Unidad, number, number, ClaveProv, string[], string[], number];

const C = "Carnes" as const;
const P = "Pescados y mariscos" as const;
const V = "Verduras y frutas" as const;
const L = "Lácteos y huevos" as const;
const S = "Seco y despensa" as const;

const INGREDIENTES: FilaIng[] = [
  // Carnes
  ["CA01", "Lomo alto de vaca Retinta madurado 30 días (Cádiz)", C, "KG", 30, 10, "MAD", [], [], 0.5],
  ["CA02", "Lomo bajo de vaca Rubia Gallega madurado 45 días", C, "KG", 34, 10, "MAD", [], [], 0.5],
  ["CA03", "Cube roll (lomo alto) de Simmental madurado", C, "KG", 36, 10, "MAD", [], [], 0.5],
  ["CA04", "Lomo alto de vaca Ayrshire de Finlandia madurado", C, "KG", 34, 10, "MAD", [], [], 0.5],
  ["CA05", "Solomillo de vaca Simmental", C, "KG", 42, 10, "MAD", [], [], 0.5],
  ["CA06", "Chuletón de vaca Simmental madurado (con hueso)", C, "KG", 26, 10, "MAD", [], [], 1],
  ["CA07", "T-bone de Simmental (lomo bajo y solomillo)", C, "KG", 28, 10, "MAD", [], [], 1],
  ["CA08", "Entraña de vaca Frisona", C, "KG", 19, 10, "CAR", [], [], 0.5],
  ["CA09", "Solomillo de Simmental con su costilla", C, "KG", 30, 10, "MAD", [], [], 0.5],
  ["CA10", "Ojo de bife de Angus argentino (lomo alto)", C, "KG", 30, 10, "IMP", [], [], 1],
  ["CA11", "Bife de chorizo de Angus argentino (lomo bajo)", C, "KG", 27, 10, "IMP", [], [], 1],
  ["CA12", "Lomo alto de Black Angus de Nebraska (USDA Prime)", C, "KG", 62, 10, "IMP", [], [], 0.5],
  ["CA13", "Wagyu para tataki y tartar (babilla)", C, "KG", 58, 10, "IMP", [], [], 0.5],
  ["CA14", "Carne picada de Angus 80/20 para hamburguesa", C, "KG", 13.5, 10, "CAR", [], [], 1],
  ["CA15", "Costilla de vaca Simmental (asado de tira)", C, "KG", 13, 10, "MAD", [], [], 1],
  ["CA16", "Hueso de caña con tuétano, cortado a lo largo", C, "KG", 6.5, 10, "CAR", [], [], 1],
  ["CA17", "Mollejas de corazón de ternera", C, "KG", 26, 10, "CAR", [], [], 0.5],
  ["CA18", "Chorizo criollo argentino", C, "KG", 10.5, 10, "CAR", ["SULFITOS"], [], 1],
  ["CA19", "Morcilla criolla", C, "KG", 9, 10, "CAR", [], ["GLUTEN"], 1],
  ["CA20", "Contramuslo de pollo de corral deshuesado", C, "KG", 7.8, 10, "CAR", [], [], 1],
  ["CA21", "Muslo de pato para confit", C, "KG", 9.5, 10, "CAR", [], [], 1],
  ["CA22", "Lomo de ternera para milanesa", C, "KG", 18, 10, "CAR", [], [], 1],
  ["CA23", "Foie gras de pato micuit", C, "KG", 62, 10, "CAR", ["SULFITOS"], [], 0.5],
  ["CA24", "Jamón ibérico de bellota deshuesado", C, "KG", 95, 10, "CAR", [], [], 0.5],
  ["CA25", "Papada ibérica curada", C, "KG", 22, 10, "CAR", [], [], 0.5],
  ["CA26", "Taco de jamón ibérico para croquetas", C, "KG", 26, 10, "CAR", [], [], 0.5],
  ["CA27", "Huesos de ternera para caldo", C, "KG", 2.2, 10, "CAR", [], [], 5],
  ["CA28", "Aguja de vaca para picar a cuchillo", C, "KG", 12, 10, "CAR", [], [], 1],
  // Pescados y mariscos
  ["PE01", "Rodaballo (pieza de 2 a 3 kg)", P, "KG", 17, 10, "PES", ["PESCADO"], [], 1],
  ["PE02", "Cola de rape", P, "KG", 24, 10, "PES", ["PESCADO"], [], 0.5],
  ["PE03", "Langostino crudo 20/30", P, "KG", 22, 10, "PES", ["CRUSTACEOS"], [], 0.5],
  ["PE04", "Zamburiña en media concha", P, "UD", 0.85, 10, "PES", ["MOLUSCOS"], [], 12],
  ["PE05", "Pata de pulpo cocido", P, "KG", 32, 10, "PES", ["MOLUSCOS"], [], 0.5],
  ["PE06", "Lomo de atún rojo de almadraba", P, "KG", 48, 10, "PES", ["PESCADO"], [], 0.5],
  ["PE07", "Anchoa del Cantábrico 00 en aceite (filete)", P, "UD", 0.9, 10, "DES", ["PESCADO"], [], 20],
  ["PE08", "Espinas y cabezas de pescado blanco", P, "KG", 1.8, 10, "PES", ["PESCADO"], [], 2],
  // Verduras y frutas (4 %; lo congelado o prefrito, 10 %)
  ["VF01", "Berenjena japonesa", V, "KG", 4.2, 4, "FYV", [], [], 1],
  ["VF02", "Seta de cardo (seta rey)", V, "KG", 9.5, 4, "FYV", [], [], 0.5],
  ["VF03", "Lechuga viva con raíz", V, "UD", 1.2, 4, "FYV", [], [], 6],
  ["VF04", "Tomate rosa", V, "KG", 3.4, 4, "FYV", [], [], 1],
  ["VF05", "Aguacate Hass", V, "KG", 5.2, 4, "FYV", [], [], 1],
  ["VF06", "Tomate cherry en rama", V, "KG", 4.5, 4, "FYV", [], [], 0.5],
  ["VF07", "Albahaca fresca", V, "KG", 18, 4, "FYV", [], [], 0.1],
  ["VF08", "Puerro", V, "KG", 2.1, 4, "FYV", [], [], 1],
  ["VF09", "Alcachofa", V, "KG", 4.8, 4, "FYV", [], [], 1],
  ["VF10", "Pimiento rojo", V, "KG", 2.8, 4, "FYV", [], [], 1],
  ["VF11", "Pimiento de Padrón", V, "KG", 6.5, 4, "FYV", [], [], 0.5],
  ["VF12", "Tomate azul", V, "KG", 6.8, 4, "FYV", [], [], 0.5],
  ["VF13", "Patata agria para freír", V, "KG", 0.95, 4, "FYV", [], [], 25],
  ["VF14", "Patata monalisa para asar", V, "KG", 1.1, 4, "FYV", [], [], 10],
  ["VF15", "Boniato", V, "KG", 1.9, 4, "FYV", [], [], 5],
  ["VF16", "Champiñón Paris", V, "KG", 3.4, 4, "FYV", [], [], 1],
  ["VF17", "Cebolla blanca", V, "KG", 1.1, 4, "FYV", [], [], 5],
  ["VF18", "Cebolla morada", V, "KG", 1.6, 4, "FYV", [], [], 1],
  ["VF19", "Ajo morado", V, "KG", 5.2, 4, "FYV", [], [], 0.5],
  ["VF20", "Perejil fresco", V, "KG", 6.5, 4, "FYV", [], [], 0.25],
  ["VF21", "Limón", V, "KG", 1.8, 4, "FYV", [], [], 1],
  ["VF22", "Piña natural", V, "KG", 1.9, 4, "FYV", [], [], 2],
  ["VF23", "Manzana golden", V, "KG", 1.7, 4, "FYV", [], [], 1],
  ["VF24", "Verduras baby variadas (zanahoria, calabacín, espárrago)", V, "KG", 9, 4, "FYV", [], [], 0.5],
  ["VF25", "Trufa negra fresca (Tuber uncinatum)", V, "KG", 380, 4, "FYV", [], [], 0.05],
  ["VF26", "Cebollino", V, "KG", 20, 4, "FYV", [], [], 0.1],
  ["VF27", "Tomillo fresco", V, "KG", 14, 4, "FYV", [], [], 0.1],
  ["VF28", "Zanahoria", V, "KG", 0.9, 4, "FYV", [], [], 5],
  ["VF29", "Apio en rama", V, "KG", 2.2, 4, "FYV", ["APIO"], [], 1],
  ["VF30", "Jengibre fresco", V, "KG", 6, 4, "FYV", [], [], 0.25],
  ["VF31", "Brotes tiernos (micromezclum)", V, "KG", 22, 4, "FYV", [], [], 0.25],
  ["VF32", "Patata corte francés prefrita congelada", V, "KG", 2.4, 10, "CON", [], [], 10],
  ["VF33", "Boletus edulis troceado congelado", V, "KG", 18, 10, "CON", [], [], 1],
  // Lácteos y huevos (leche, quesos y huevos al 4 %; nata, mantequilla y helados al 10 %)
  ["LH01", "Burrata de Puglia (250 g)", L, "UD", 3.9, 4, "LAC", ["LECHE"], [], 6],
  ["LH02", "Mozzarella fior di latte", L, "KG", 9.5, 4, "LAC", ["LECHE"], [], 1],
  ["LH03", "Queso manchego curado", L, "KG", 18, 4, "LAC", ["LECHE"], [], 1],
  ["LH04", "Queso de Valdeón", L, "KG", 21, 4, "LAC", ["LECHE"], [], 0.5],
  ["LH05", "Queso payoyo de cabra", L, "KG", 22, 4, "LAC", ["LECHE"], [], 0.5],
  ["LH06", "Torta del Casar", L, "KG", 26, 4, "LAC", ["LECHE"], [], 0.5],
  ["LH07", "Queso Idiazábal", L, "KG", 20, 4, "LAC", ["LECHE"], [], 0.5],
  ["LH08", "Parmigiano Reggiano", L, "KG", 19, 4, "LAC", ["LECHE"], [], 1],
  ["LH09", "Queso cheddar en lonchas", L, "KG", 9, 4, "LAC", ["LECHE"], [], 1],
  ["LH10", "Mantequilla sin sal", L, "KG", 9.2, 10, "LAC", ["LECHE"], [], 1],
  ["LH11", "Nata 35 % (brik 1 l)", L, "L", 3.6, 10, "LAC", ["LECHE"], [], 6],
  ["LH12", "Leche entera", L, "L", 0.98, 4, "LAC", ["LECHE"], [], 6],
  ["LH13", "Huevo campero L", L, "UD", 0.26, 4, "LAC", ["HUEVOS"], [], 30],
  ["LH14", "Huevo de codorniz", L, "UD", 0.12, 4, "LAC", ["HUEVOS"], [], 24],
  ["LH15", "Queso crema", L, "KG", 7.5, 4, "LAC", ["LECHE"], [], 2],
  ["LH16", "Mascarpone", L, "KG", 8.9, 4, "LAC", ["LECHE"], [], 2],
  ["CO01", "Helado de vainilla artesano (cubeta 5 l)", L, "L", 9.5, 10, "CON", ["LECHE", "HUEVOS"], ["FRUTOS_CASCARA", "SOJA"], 5],
  ["CO02", "Helado de leche merengada (cubeta 5 l)", L, "L", 10, 10, "CON", ["LECHE", "HUEVOS"], ["FRUTOS_CASCARA"], 5],
  ["CO03", "Helado de chocolate (cubeta 5 l)", L, "L", 10, 10, "CON", ["LECHE", "SOJA"], ["FRUTOS_CASCARA"], 5],
  ["CO04", "Sorbete de limón (cubeta 5 l)", L, "L", 8, 10, "CON", [], ["LECHE"], 5],
  // Panadería (el pan común al 4 %; brioche, picos y panko al 10 %)
  ["PA01", "Hogaza de pan de masa madre (1 kg)", S, "UD", 3.6, 4, "PAN", ["GLUTEN"], ["SESAMO"], 1],
  ["PA02", "Pan brioche mini para hamburguesa (40 g)", S, "UD", 0.32, 10, "PAN", ["GLUTEN", "HUEVOS", "LECHE"], ["SESAMO", "SOJA"], 12],
  ["PA03", "Pan rallado panko", S, "KG", 3.2, 10, "PAN", ["GLUTEN"], ["SOJA", "SESAMO"], 1],
  ["PA04", "Picos de pan artesanos", S, "KG", 6.5, 10, "PAN", ["GLUTEN"], ["SESAMO"], 1],
  ["PA05", "Bizcochos de soletilla", S, "KG", 7.5, 10, "DES", ["GLUTEN", "HUEVOS"], ["LECHE"], 1],
  // Despensa
  ["DE01", "Harina de trigo (saco 25 kg)", S, "KG", 0.8, 4, "DES", ["GLUTEN"], [], 25],
  ["DE02", "Azúcar blanco", S, "KG", 1.15, 10, "DES", [], [], 10],
  ["DE03", "Azúcar moreno", S, "KG", 2, 10, "DES", [], [], 1],
  ["DE04", "Sal en escamas", S, "KG", 9, 10, "DES", [], [], 1],
  ["DE05", "Sal gorda", S, "KG", 0.5, 10, "DES", [], [], 5],
  ["DE06", "Pimienta negra en grano", S, "KG", 16, 10, "DES", [], [], 0.5],
  ["DE07", "Pimienta verde en grano", S, "KG", 30, 10, "DES", [], [], 0.25],
  ["DE08", "Orégano seco", S, "KG", 18, 10, "DES", [], [], 0.5],
  ["DE09", "Pimentón de la Vera dulce", S, "KG", 14, 10, "DES", [], [], 0.5],
  ["DE10", "Guindilla en copos (ají molido)", S, "KG", 15, 10, "DES", [], [], 0.5],
  ["DE11", "Comino molido", S, "KG", 15, 10, "DES", [], [], 0.5],
  ["DE12", "Vinagre de vino tinto", S, "L", 2.2, 10, "DES", ["SULFITOS"], [], 5],
  ["DE13", "Vinagre de Jerez", S, "L", 4.5, 10, "DES", ["SULFITOS"], [], 1],
  ["DE14", "Salsa de soja", S, "L", 4.2, 10, "DES", ["GLUTEN", "SOJA"], [], 1],
  ["DE15", "Mirin", S, "L", 7.5, 10, "DES", [], [], 1],
  ["DE16", "Sésamo tostado", S, "KG", 7, 10, "DES", ["SESAMO"], [], 1],
  ["DE17", "Tahini (pasta de sésamo)", S, "KG", 9, 10, "DES", ["SESAMO"], [], 1],
  ["DE18", "Pistacho pelado", S, "KG", 32, 10, "DES", ["FRUTOS_CASCARA"], [], 1],
  ["DE19", "Almendra marcona tostada", S, "KG", 15, 10, "DES", ["FRUTOS_CASCARA"], [], 1],
  ["DE20", "Avellana tostada", S, "KG", 14, 10, "DES", ["FRUTOS_CASCARA"], [], 1],
  ["DE21", "Nuez pelada", S, "KG", 13, 10, "DES", ["FRUTOS_CASCARA"], [], 1],
  ["DE22", "Ñora seca", S, "KG", 24, 10, "DES", [], [], 0.25],
  ["DE23", "Aceituna manzanilla sin hueso", S, "KG", 6, 10, "DES", [], [], 2],
  ["DE24", "Piparras (guindilla vasca) en vinagre", S, "KG", 9, 10, "DES", ["SULFITOS"], [], 1],
  ["DE25", "Pasta trofie seca", S, "KG", 4.8, 10, "DES", ["GLUTEN"], ["HUEVOS"], 3],
  ["DE26", "Pappardelle al huevo", S, "KG", 6.5, 10, "DES", ["GLUTEN", "HUEVOS"], [], 3],
  ["DE27", "Chocolate negro 70 % (cobertura)", S, "KG", 14, 10, "DES", ["SOJA"], ["LECHE", "FRUTOS_CASCARA"], 1],
  ["DE28", "Chocolate 90 % cacao", S, "KG", 19, 10, "DES", [], ["LECHE", "FRUTOS_CASCARA", "SOJA"], 1],
  ["DE29", "Cacao puro en polvo", S, "KG", 9, 10, "DES", [], ["LECHE"], 1],
  ["DE30", "Café espresso molido", S, "KG", 18, 10, "DES", [], [], 1],
  ["DE31", "Tomate triturado (lata 3 kg)", S, "KG", 1.4, 10, "DES", [], [], 3],
  ["DE32", "Vino tinto para cocinar", S, "L", 3, 10, "DES", ["SULFITOS"], [], 5],
  ["DE33", "Vino blanco para cocinar", S, "L", 2.6, 10, "DES", ["SULFITOS"], [], 5],
  ["DE34", "Cava brut para cocina (botella 0,75 l)", S, "L", 4.5, 10, "DES", ["SULFITOS"], [], 0.75],
  ["DE35", "Brandy de Jerez", S, "L", 12, 10, "DES", [], [], 1],
  ["DE36", "Mostaza de Dijon", S, "KG", 6.5, 10, "DES", ["MOSTAZA"], [], 1],
  ["DE37", "Salsa Worcestershire", S, "L", 9, 10, "DES", ["PESCADO", "GLUTEN"], [], 0.5],
  ["DE38", "Alcaparras en vinagre", S, "KG", 9, 10, "DES", ["SULFITOS"], [], 1],
  ["DE39", "Salsa picante de guindilla (tipo Tabasco)", S, "L", 25, 10, "DES", [], [], 0.25],
  ["DE40", "Miel de flores", S, "KG", 9, 10, "DES", [], [], 1],
  ["DE41", "Maicena", S, "KG", 3.5, 10, "DES", [], [], 1],
  ["DE42", "Levadura química", S, "KG", 6, 10, "DES", [], [], 0.5],
  ["DE43", "Bicarbonato sódico", S, "KG", 4, 10, "DES", [], [], 0.5],
  ["DE44", "Grasa de pato", S, "KG", 8, 10, "DES", [], [], 1],
  ["DE45", "Mermelada de albaricoque", S, "KG", 4.5, 10, "DES", [], [], 1],
  ["DE46", "Manteca de cerdo", S, "KG", 3.4, 10, "CAR", [], [], 1],
  ["CO05", "Hojaldre de mantequilla en plancha (congelado)", S, "KG", 6.5, 10, "CON", ["GLUTEN", "LECHE"], [], 2],
  // Aceites (el de oliva al 4 %)
  ["AC01", "Aceite de oliva virgen extra arbequina (garrafa 5 l)", S, "L", 8.6, 4, "ACE", [], [], 5],
  ["AC02", "Aceite de oliva suave 0,4º (garrafa 5 l)", S, "L", 6.8, 4, "ACE", [], [], 5],
  ["AC03", "Aceite de girasol alto oleico (bidón 25 l)", S, "L", 2.2, 10, "ACE", [], [], 25],
];

/** Ingredientes de origen animal que no son carne ni pescado por familia (para las etiquetas). */
const CARNE_OCULTA = new Set(["DE44", "DE46"]);

// ===========================================================================
// 3. Elaborados del obrador (RZO-…) con su receta
// ===========================================================================

type UnidadElab = "KG" | "L" | "UD" | "RACION";
type Linea = [string, number, number]; // [código (los elaborados con «@»), neta, merma %]
// [código, producto, unidad, receta, rendimiento por tanda, vida útil (días), conservación, minutos, pasos, ingredientes]
type FilaReceta = [string, string, UnidadElab, string, number, number, string, number, string, Linea[]];

const FRIO = "Refrigerado de 0 a 4 °C";
const CONGELADO = "Congelado a −18 °C";

const RECETAS: FilaReceta[] = [
  ["CALDO", "Caldo oscuro de ternera", "L", "Caldo oscuro de ternera (fondo para demi-glace y ragú)", 20, 4, `${FRIO} (o congelado hasta 3 meses)`, 360,
    "1. Tostar los huesos al horno 45 min a 220 °C.\n2. Rehogar zanahoria, cebolla, puerro y apio.\n3. Mojar con vino tinto y agua fría; añadir tomate y pimienta.\n4. Cocer 5 h a fuego suave, desespumar y colar.",
    [["CA27", 12, 0], ["VF28", 1, 10], ["VF17", 1, 10], ["VF29", 0.5, 15], ["VF08", 0.5, 20], ["DE31", 0.5, 0], ["DE32", 1, 0], ["DE06", 0.01, 0], ["DE05", 0.05, 0]]],
  ["DEMI", "Demi-glace de ternera", "L", "Demi-glace de ternera", 4, 10, FRIO, 240,
    "Reducir el caldo oscuro con vino tinto a una cuarta parte; ligar con maicena y colar fino.",
    [["@CALDO", 16, 0], ["DE32", 1, 0], ["DE41", 0.02, 0], ["DE05", 0.02, 0]]],
  ["PIMIENTA", "Salsa de pimienta verde", "L", "Salsa de pimienta verde", 4, 4, FRIO, 40,
    "Flambear la pimienta con brandy, añadir demi-glace y nata, reducir y montar con mantequilla.",
    [["@DEMI", 1.5, 0], ["LH11", 2, 0], ["DE07", 0.08, 0], ["DE35", 0.2, 0], ["LH10", 0.1, 0], ["DE05", 0.02, 0]]],
  ["CHIMI", "Chimichurri Raza", "KG", "Chimichurri Raza", 5, 10, `${FRIO}, en bote cerrado`, 40,
    "1. Picar perejil y ajo muy finos.\n2. Mezclar con orégano, ají, pimentón y sal.\n3. Añadir vinagre, agua y aceites. Reposar 24 h antes de servir.",
    [["VF20", 0.6, 25], ["VF19", 0.25, 12], ["DE08", 0.08, 0], ["DE10", 0.03, 0], ["DE09", 0.03, 0], ["DE05", 0.06, 0], ["DE12", 0.9, 0], ["AC03", 2.2, 0], ["AC01", 0.8, 0]]],
  ["CRIOLLA", "Salsa criolla", "KG", "Salsa criolla", 4, 4, FRIO, 30,
    "Picar en brunoise pimiento, cebolla y tomate; aliñar con vinagre, aceite, sal y orégano.",
    [["VF10", 1.2, 15], ["VF17", 1.2, 10], ["VF04", 1, 8], ["DE12", 0.3, 0], ["AC03", 0.4, 0], ["DE05", 0.04, 0], ["DE08", 0.01, 0]]],
  ["ROMESCO", "Salsa romesco", "KG", "Salsa romesco", 3, 7, FRIO, 60,
    "Asar tomate y ajo; hidratar la ñora; triturar con almendra, avellana, pan frito, vinagre de Jerez y aceite.",
    [["DE22", 0.06, 0], ["VF04", 1.2, 8], ["VF19", 0.15, 12], ["DE19", 0.3, 0], ["DE20", 0.15, 0], ["PA01", 0.5, 0], ["DE13", 0.1, 0], ["AC01", 0.6, 0], ["DE05", 0.02, 0], ["DE09", 0.01, 0]]],
  ["TERIYAKI", "Glaseado teriyaki", "L", "Glaseado teriyaki", 3, 21, `${FRIO}, en bote cerrado`, 30,
    "Reducir soja, mirin, azúcar moreno, jengibre y ajo; ligar con maicena.",
    [["DE14", 1.2, 0], ["DE15", 0.8, 0], ["DE03", 0.4, 0], ["VF30", 0.08, 15], ["VF19", 0.05, 12], ["DE41", 0.03, 0]]],
  ["MAYOTAHINI", "Mayonesa de tahini", "KG", "Mayonesa de tahini", 2, 3, FRIO, 20,
    "Emulsionar huevo con aceite de girasol; añadir tahini, zumo de limón y sal.",
    [["LH13", 6, 0], ["AC03", 1.5, 0], ["DE17", 0.3, 0], ["VF21", 0.2, 30], ["DE05", 0.015, 0]]],
  ["ALINO", "Aliño Raza (vinagreta de Jerez y mostaza)", "L", "Aliño Raza", 3, 14, FRIO, 15,
    "Emulsionar AOVE con vinagre de Jerez, mostaza de Dijon, miel, sal y pimienta.",
    [["AC01", 2, 0], ["DE13", 0.6, 0], ["DE36", 0.08, 0], ["DE40", 0.06, 0], ["DE05", 0.03, 0], ["DE06", 0.005, 0]]],
  ["AJADA", "Ajada gallega", "L", "Ajada gallega", 2, 7, FRIO, 20,
    "Dorar el ajo laminado en AOVE, retirar del fuego, añadir pimentón y unas gotas de vinagre.",
    [["AC01", 1.8, 0], ["VF19", 0.25, 12], ["DE09", 0.04, 0], ["DE13", 0.05, 0]]],
  ["ALTARTAR", "Aliño de steak tartar", "KG", "Aliño de steak tartar", 1.5, 4, FRIO, 25,
    "Mezclar yemas, mostaza, Worcestershire, picante, alcaparra y cebolla morada picadas; emulsionar con aceite.",
    [["DE36", 0.3, 0], ["DE37", 0.08, 0], ["DE39", 0.01, 0], ["DE38", 0.15, 0], ["VF18", 0.3, 10], ["LH13", 6, 0], ["AC02", 0.5, 0], ["DE05", 0.01, 0]]],
  ["FUMET", "Fumet de pescado blanco", "L", "Fumet de pescado blanco", 15, 3, `${FRIO} (o congelado hasta 3 meses)`, 90,
    "Rehogar espinas y verduras, mojar con vino blanco y agua fría, cocer 30 min y colar.",
    [["PE08", 6, 0], ["VF08", 0.6, 20], ["VF29", 0.3, 15], ["VF17", 0.6, 10], ["DE33", 0.5, 0], ["AC02", 0.15, 0], ["DE05", 0.05, 0]]],
  ["MANTAHUM", "Mantequilla ahumada", "KG", "Mantequilla ahumada en frío", 2, 15, "Refrigerado, en rulo envasado al vacío", 45,
    "Ahumar la mantequilla en frío con virutas de haya 30 min; mezclar con sal en escamas y formar rulos.",
    [["LH10", 2, 0], ["DE04", 0.03, 0]]],
  ["CROQJB", "Croqueta de jamón ibérico y boletus (ud, 30 g)", "UD", "Croquetas de jamón ibérico y boletus", 120, 60, CONGELADO, 180,
    "1. Sofreír cebolla, jamón y boletus en mantequilla.\n2. Añadir harina, mojar con leche y cocer la bechamel 20 min.\n3. Enfriar, bolear a 30 g, pasar por huevo y panko.\n4. Congelar en bandeja y embolsar.",
    [["LH12", 2.4, 0], ["LH10", 0.3, 0], ["DE01", 0.3, 0], ["CA26", 0.3, 0], ["VF33", 0.45, 0], ["VF17", 0.3, 10], ["LH13", 8, 0], ["PA03", 0.7, 0], ["DE06", 0.003, 0], ["DE05", 0.02, 0]]],
  ["CROQJAM", "Croqueta de jamón (ud, 30 g)", "UD", "Croquetas de jamón ibérico", 120, 60, CONGELADO, 180,
    "Como las de boletus, con más jamón. Se sirven con un velo de papada ibérica por encima.",
    [["LH12", 2.6, 0], ["LH10", 0.3, 0], ["DE01", 0.32, 0], ["CA26", 0.45, 0], ["VF17", 0.3, 10], ["LH13", 8, 0], ["PA03", 0.7, 0], ["DE05", 0.02, 0]]],
  ["EMPANADA", "Empanada argentina de carne a cuchillo (ud)", "UD", "Empanada argentina de carne cortada a cuchillo", 60, 30, `${CONGELADO}; hornear sin descongelar`, 180,
    "1. Picar la carne a cuchillo.\n2. Rehogar cebolla y pimiento en manteca; añadir la carne, comino, pimentón y ají.\n3. Enfriar y añadir huevo duro y aceituna.\n4. Masa: harina, manteca, agua y sal. Discos de 14 cm, repulgue y congelar.",
    [["CA28", 2.4, 8], ["VF17", 1.2, 10], ["VF10", 0.4, 15], ["DE46", 1.2, 0], ["DE01", 3.6, 0], ["LH13", 10, 0], ["DE23", 0.25, 0], ["DE11", 0.02, 0], ["DE09", 0.04, 0], ["DE10", 0.01, 0], ["DE05", 0.08, 0]]],
  ["RAGU", "Ragú de costilla de Simmental", "KG", "Ragú de costilla de Simmental a baja temperatura", 6, 5, `${FRIO}, envasado al vacío`, 720,
    "1. Marcar la costilla y cocinarla 12 h a 80 °C con caldo, vino y verduras.\n2. Deshuesar y desmigar.\n3. Reducir el jugo con tomate y juntar.",
    [["CA15", 8, 45], ["VF17", 1, 10], ["VF28", 0.6, 10], ["VF29", 0.3, 15], ["DE31", 1.5, 0], ["DE32", 0.75, 0], ["@CALDO", 2, 0], ["AC01", 0.2, 0], ["DE05", 0.04, 0], ["DE06", 0.005, 0]]],
  ["PURE", "Puré de patata", "KG", "Puré de patata (base para el trufado y el pulpo)", 8, 3, FRIO, 60,
    "Cocer la patata con piel, pelar, pasar por el pasapurés y montar con mantequilla y leche caliente.",
    [["VF14", 6, 15], ["LH10", 0.8, 0], ["LH12", 1.2, 0], ["DE05", 0.05, 0]]],
  ["PIMASADOS", "Pimientos rojos asados", "KG", "Pimientos rojos asados", 4, 5, FRIO, 120,
    "Asar los pimientos al horno 50 min, sudar, pelar y aliñar con ajo, AOVE, sal y vinagre de Jerez.",
    [["VF10", 8, 45], ["VF19", 0.1, 12], ["AC01", 0.3, 0], ["DE05", 0.03, 0], ["DE13", 0.05, 0]]],
  ["PATO", "Confit de pato desmigado", "KG", "Confit de pato desmigado", 3, 10, "Refrigerado, cubierto de su grasa", 300,
    "Salar los muslos 12 h, confitar en grasa de pato 4 h a 90 °C con tomillo y ajo, desmigar y cubrir de grasa.",
    [["CA21", 6, 45], ["DE44", 1, 0], ["DE05", 0.08, 0], ["VF27", 0.02, 0], ["VF19", 0.1, 12]]],
  ["ALCACH", "Alcachofa confitada (ud)", "UD", "Alcachofas confitadas", 40, 4, `${FRIO}, en su aceite`, 90,
    "Limpiar hasta el corazón, frotar con limón y confitar en aceite de oliva a 85 °C 40 min.",
    [["VF09", 2.8, 55], ["AC02", 1, 0], ["VF21", 0.2, 30], ["DE05", 0.04, 0]]],
  ["TARTAQ", "Tarta de queso cremosa (ración)", "RACION", "Tarta de queso cremosa (2 tartas de 12 raciones)", 24, 5, FRIO, 90,
    "Batir queso crema, azúcar, huevos, nata y una pizca de harina. Hornear 45 min a 200 °C. Abatir y porcionar.",
    [["LH15", 2.2, 0], ["DE02", 0.6, 0], ["LH13", 12, 0], ["LH11", 1, 0], ["DE01", 0.04, 0]]],
  ["TARTAPIS", "Tarta de queso y pistacho (ración)", "RACION", "Tarta de queso y pistacho (1 tarta de 12 raciones)", 12, 5, FRIO, 90,
    "Como la tarta de queso, con crema de pistacho tostado triturado.",
    [["LH15", 1.1, 0], ["DE02", 0.3, 0], ["LH13", 6, 0], ["LH11", 0.5, 0], ["DE18", 0.25, 0]]],
  ["TARTACHOC", "Tarta de chocolate 90 % (ración)", "RACION", "Tarta de chocolate 90 % cacao (1 tarta de 12 raciones)", 12, 6, FRIO, 75,
    "Fundir chocolate y mantequilla, montar huevos con azúcar, juntar con la nata y hornear al baño maría.",
    [["DE28", 0.6, 0], ["LH10", 0.3, 0], ["LH13", 8, 0], ["DE02", 0.2, 0], ["LH11", 0.3, 0], ["DE29", 0.03, 0]]],
  ["TIRAMISU", "Crema de tiramisú", "KG", "Crema de tiramisú (se monta en mesa)", 3, 3, FRIO, 30,
    "Montar yemas con azúcar, añadir mascarpone y la nata semimontada; claras a punto de nieve con cuidado.",
    [["LH16", 1.5, 0], ["LH13", 10, 0], ["DE02", 0.35, 0], ["LH11", 0.5, 0]]],
  ["DULCE", "Dulce de leche casero", "KG", "Dulce de leche casero", 4, 20, `${FRIO}, en bote cerrado`, 240,
    "Reducir leche y azúcar con una pizca de bicarbonato a fuego lento 4 h, removiendo, hasta punto de napa.",
    [["LH12", 10, 0], ["DE02", 2, 0], ["DE43", 0.01, 0]]],
  ["BROWNIE", "Brownie cremoso (ración)", "RACION", "Brownie cremoso (bandeja de 20 raciones)", 20, 5, FRIO, 60,
    "Fundir chocolate con mantequilla, añadir azúcar, huevos, harina y nuez. Hornear 22 min a 170 °C.",
    [["DE27", 0.6, 0], ["LH10", 0.45, 0], ["DE02", 0.5, 0], ["LH13", 8, 0], ["DE01", 0.2, 0], ["DE21", 0.2, 0]]],
  ["VOLCAN", "Volcán de chocolate (ud)", "UD", "Volcán de chocolate fundente", 20, 30, CONGELADO, 45,
    "Masa de chocolate y mantequilla con huevo, azúcar y harina en moldes encamisados; congelar. Hornear 9 min a 200 °C.",
    [["DE27", 0.5, 0], ["LH10", 0.4, 0], ["LH13", 10, 0], ["DE02", 0.3, 0], ["DE01", 0.12, 0]]],
  ["COOKIE", "Bola de masa de cookie (ud, 90 g)", "UD", "Masa de cookie con pepitas de chocolate", 25, 30, CONGELADO, 40,
    "Cremar mantequilla con azúcares, añadir huevo, harina, levadura, sal y chocolate troceado. Bolear a 90 g y congelar.",
    [["LH10", 0.5, 0], ["DE03", 0.4, 0], ["DE02", 0.2, 0], ["LH13", 2, 0], ["DE01", 0.9, 0], ["DE42", 0.01, 0], ["DE27", 0.5, 0], ["DE05", 0.008, 0]]],
  ["BURGER", "Mini hamburguesa de Angus (ud, 60 g)", "UD", "Mini hamburguesas de Angus 100 %", 50, 3, FRIO, 40,
    "Picar la carne fría, salpimentar y formar piezas de 60 g con aro. Separar con papel.",
    [["CA14", 3, 0], ["DE05", 0.03, 0], ["DE06", 0.005, 0]]],
  ["MILANESA", "Milanesa de lomo empanada (ud, 200 g)", "UD", "Milanesa de lomo", 20, 3, `${FRIO}, envasada al vacío`, 60,
    "Filetear y espalmar el lomo; pasar por harina, huevo batido con ajo y perejil, y panko.",
    [["CA22", 4.4, 10], ["LH13", 8, 0], ["PA03", 0.8, 0], ["DE01", 0.3, 0], ["VF20", 0.05, 25], ["VF19", 0.05, 12], ["DE05", 0.03, 0]]],
];

// ===========================================================================
// 4. Platos de la carta: descripción propia, ventas por cada 100 cubiertos y escandallo por ración
// ===========================================================================

// clave = nombre de la carta (los dos «Lomo alto» se distinguen por sección)
const PLATOS: Record<string, [string | null, number, Linea[]]> = {
  // De la huerta
  "Berenjena japonesa a la brasa": ["Abierta a la brasa, glaseada con teriyaki, sésamo y cebollino.", 4, [["VF01", 0.35, 10], ["@TERIYAKI", 0.04, 0], ["DE16", 0.005, 0], ["VF26", 0.003, 0], ["AC01", 0.02, 0], ["DE04", 0.002, 0]]],
  "Setas Rey a la parrilla glaseadas con teriyaki y sésamo": ["Seta de cardo a la parrilla.", 4, [["VF02", 0.3, 8], ["@TERIYAKI", 0.05, 0], ["DE16", 0.006, 0], ["AC01", 0.02, 0], ["VF26", 0.003, 0]]],
  "Lechuga viva con tomate rosado y nuestro aliño": ["Lechuga entera con raíz, tomate rosa, cebolla morada y aliño de Jerez.", 6, [["VF03", 1, 0], ["VF04", 0.25, 8], ["VF18", 0.04, 10], ["@ALINO", 0.04, 0], ["DE04", 0.002, 0]]],
  "Aguacate a la parrilla con ensalada caprese templada": ["Con mozzarella fior di latte, cherry y albahaca.", 5, [["VF05", 0.25, 30], ["VF06", 0.12, 5], ["LH02", 0.1, 0], ["VF07", 0.005, 20], ["AC01", 0.02, 0], ["DE04", 0.002, 0], ["DE13", 0.01, 0]]],
  "Puerro asado sobre cama de salsa romesco": ["Puerro asado entero al carbón.", 3, [["VF08", 0.45, 35], ["@ROMESCO", 0.08, 0], ["AC01", 0.015, 0], ["DE04", 0.002, 0]]],
  "Alcachofas confitadas con lascas de foie y mayonesa de tahini": ["Tres corazones de alcachofa confitados y marcados a la brasa.", 4, [["@ALCACH", 3, 0], ["CA23", 0.04, 0], ["@MAYOTAHINI", 0.04, 0], ["DE04", 0.002, 0]]],
  "Ensalada templada de pimientos asados con confit de pato desmigado": ["Pimientos asados al horno, pato confitado y brotes tiernos.", 3, [["@PIMASADOS", 0.2, 0], ["@PATO", 0.12, 0], ["VF18", 0.03, 10], ["@ALINO", 0.03, 0], ["VF31", 0.01, 0]]],
  // Entrantes
  "Jamón Ibérico de bellota cortado a cuchillo": ["Ración de 80 g con picos artesanos.", 6, [["CA24", 0.08, 15], ["PA04", 0.03, 0]]],
  "Croquetas de jamón Ibérico y boletus": ["Seis croquetas cremosas hechas en nuestro obrador.", 8, [["@CROQJB", 6, 0], ["AC03", 0.05, 0]]],
  "Croquetas de jamón y velo de papada Ibérica": ["Seis croquetas con una lámina de papada ibérica por encima.", 8, [["@CROQJAM", 6, 0], ["CA25", 0.03, 0], ["AC03", 0.05, 0]]],
  "Tataki de Wagyu con pimientos de padrón": ["Wagyu sellado a la brasa con glaseado teriyaki y sésamo.", 4, [["CA13", 0.12, 10], ["VF11", 0.1, 5], ["@TERIYAKI", 0.03, 0], ["DE16", 0.003, 0], ["DE04", 0.002, 0], ["AC01", 0.015, 0]]],
  "Mini steak tartar con huevo de codorniz": ["Sobre tosta de masa madre.", 10, [["CA05", 0.05, 15], ["LH14", 1, 0], ["@ALTARTAR", 0.012, 0], ["PA01", 0.05, 0], ["VF26", 0.001, 0]]],
  "Burrata de Puglia con tomate azul y aliño de aguacate y pistachos": ["Burrata de 250 g.", 7, [["LH01", 1, 0], ["VF12", 0.15, 8], ["VF05", 0.06, 30], ["DE18", 0.012, 0], ["AC01", 0.015, 0], ["DE04", 0.002, 0], ["VF07", 0.002, 20]]],
  "Empanada argentina": ["De carne cortada a cuchillo, horneada al momento.", 14, [["@EMPANADA", 1, 0]]],
  "Steak tartar de Wagyu": ["Aliñado en mesa, con yema, tostas y patatas fritas.", 5, [["CA13", 0.14, 12], ["@ALTARTAR", 0.03, 0], ["LH13", 1, 0], ["PA01", 0.1, 0], ["VF26", 0.002, 0], ["VF32", 0.12, 0], ["AC03", 0.02, 0]]],
  "Nuestra gilda con anchoa del Cantábrico y AOVE": ["Anchoa 00, aceituna manzanilla y piparra.", 6, [["PE07", 2, 0], ["DE23", 0.02, 0], ["DE24", 0.012, 0], ["AC01", 0.005, 0]]],
  "Tabla de quesos selección Raza (quesos nacionales)": ["Manchego, Valdeón, payoyo, Torta del Casar e Idiazábal, con miel y frutos secos.", 3, [["LH03", 0.06, 0], ["LH04", 0.04, 0], ["LH05", 0.05, 0], ["LH06", 0.05, 0], ["LH07", 0.05, 0], ["PA04", 0.04, 0], ["DE40", 0.01, 0], ["DE21", 0.015, 0]]],
  "Tartar de atún rojo de Almadraba con su huevo frito": ["Atún rojo aliñado con soja y sésamo, aguacate y huevo frito.", 4, [["PE06", 0.15, 12], ["LH13", 1, 0], ["DE14", 0.01, 0], ["DE16", 0.003, 0], ["VF05", 0.05, 30], ["VF26", 0.002, 0], ["AC03", 0.03, 0], ["AC01", 0.01, 0]]],
  // Entrantes a la brasa
  "Mini hamburguesas de Angus 100%": ["Pan brioche, cheddar y tomate.", 10, [["@BURGER", 1, 0], ["PA02", 1, 0], ["LH09", 0.015, 0], ["VF04", 0.015, 8], ["VF18", 0.01, 10]]],
  "Mollejas de corazón de ternera al estilo Raza": ["Crujientes a la brasa, con limón y chimichurri.", 4, [["CA17", 0.25, 25], ["VF21", 0.03, 30], ["DE05", 0.004, 0], ["@CHIMI", 0.02, 0]]],
  "Matrimonio de chorizo criollo y morcilla": ["Con pan de masa madre y salsa criolla.", 5, [["CA18", 0.15, 0], ["CA19", 0.15, 5], ["PA01", 0.1, 0], ["@CRIOLLA", 0.04, 0]]],
  "Chorizo criollo": ["A la brasa, con pan de masa madre y chimichurri.", 4, [["CA18", 0.15, 0], ["PA01", 0.08, 0], ["@CHIMI", 0.02, 0]]],
  "Zamburiñas a la brasa": ["Con ajada gallega.", 3, [["PE04", 5, 0], ["@AJADA", 0.02, 0], ["DE04", 0.001, 0], ["VF21", 0.02, 30]]],
  "Pulpo a las brasas con puré de patatas y ajada": ["Pata de pulpo a la brasa.", 5, [["PE05", 0.2, 5], ["@PURE", 0.15, 0], ["@AJADA", 0.03, 0], ["DE09", 0.002, 0], ["DE04", 0.002, 0]]],
  // Pastas
  "Trofie con ragú de costillas de Simmental a baja temperatura": ["Con parmesano.", 3, [["DE25", 0.11, 0], ["@RAGU", 0.18, 0], ["LH08", 0.015, 0], ["AC01", 0.01, 0]]],
  "Pappardelle con boletus y trufa": ["Salteados con nata y parmesano; trufa rallada en mesa.", 3, [["DE26", 0.11, 0], ["VF33", 0.08, 0], ["LH11", 0.08, 0], ["LH08", 0.015, 0], ["VF25", 0.003, 0], ["LH10", 0.01, 0], ["VF19", 0.003, 12]]],
  // Pescados
  "Rodaballo con mantequilla ahumada y verduras baby salteadas": ["Lomo de rodaballo a la brasa.", 3, [["PE01", 0.3, 45], ["@MANTAHUM", 0.03, 0], ["VF24", 0.12, 10], ["AC01", 0.01, 0], ["DE04", 0.003, 0]]],
  "Rape al horno con langostinos": ["Con patata panadera y fumet de la casa.", 3, [["PE02", 0.25, 30], ["PE03", 0.08, 35], ["@FUMET", 0.1, 0], ["VF19", 0.005, 12], ["VF20", 0.003, 25], ["DE33", 0.03, 0], ["AC01", 0.02, 0], ["VF14", 0.15, 15]]],
  // Otras especialidades
  "Milanesa de lomo con huevo a baja temperatura y trufa rayada": ["Milanesa de lomo de ternera de 200 g.", 4, [["@MILANESA", 1, 0], ["LH13", 1, 0], ["VF25", 0.003, 0], ["AC03", 0.08, 0]]],
  "Contramuslo de pollo de corral marinado en chimichurri": ["A la brasa, con limón.", 4, [["CA20", 0.3, 5], ["@CHIMI", 0.04, 0], ["VF21", 0.02, 30], ["DE04", 0.003, 0]]],
  // Raza selección
  "Lomo alto|nacionales": ["Madurado 30 días, a la parrilla de carbón.", 6, [["CA01", 0.35, 10], ["DE05", 0.003, 0], ["DE04", 0.003, 0]]],
  "Lomo bajo": ["Madurado 45 días, a la parrilla de carbón.", 7, [["CA02", 0.3, 10], ["DE05", 0.003, 0], ["DE04", 0.003, 0]]],
  "Cube roll, lomo alto": ["Madurado, a la parrilla de carbón.", 4, [["CA03", 0.5, 10], ["DE05", 0.004, 0], ["DE04", 0.003, 0]]],
  "Lomo alto|europeos": ["Madurado, a la parrilla de carbón.", 2, [["CA04", 0.7, 8], ["DE05", 0.005, 0], ["DE04", 0.004, 0]]],
  "Solomillo de vaca": ["Con salsa de pimienta verde.", 7, [["CA05", 0.2, 12], ["@PIMIENTA", 0.05, 0], ["DE05", 0.002, 0], ["DE04", 0.002, 0]]],
  "Chuletón premium selección Raza": ["Para compartir, a la parrilla de carbón.", 5, [["CA06", 1, 8], ["DE05", 0.008, 0], ["DE04", 0.004, 0]]],
  "T-bone, lomo bajo & solomillo": ["Para compartir, a la parrilla de carbón.", 3, [["CA07", 1, 8], ["DE05", 0.008, 0], ["DE04", 0.004, 0]]],
  "Entraña de vaca": ["El corte más jugoso de la parrilla.", 8, [["CA08", 0.3, 15], ["DE05", 0.003, 0], ["DE04", 0.002, 0]]],
  "Solomillo con su costilla y tuétano asado": ["Con demi-glace.", 3, [["CA09", 0.35, 10], ["CA16", 0.15, 0], ["@DEMI", 0.04, 0], ["DE04", 0.003, 0]]],
  "Ojo de bife Angus": ["Angus argentino a la parrilla de carbón.", 6, [["CA10", 0.3, 8], ["DE05", 0.003, 0], ["DE04", 0.002, 0]]],
  "Bife de chorizo Angus": ["Angus argentino a la parrilla de carbón.", 7, [["CA11", 0.3, 8], ["DE05", 0.003, 0], ["DE04", 0.002, 0]]],
  "Lomo alto de Nebraska": ["USDA Prime, a la parrilla de carbón.", 2, [["CA12", 0.5, 8], ["DE05", 0.004, 0], ["DE04", 0.003, 0]]],
  // Guarniciones
  "Patata asada al rescoldo": ["Con mantequilla y cebollino.", 6, [["VF14", 0.35, 5], ["LH10", 0.015, 0], ["VF26", 0.002, 0], ["DE04", 0.002, 0]]],
  "Patatas fritas corte francés": [null, 14, [["VF32", 0.25, 0], ["AC03", 0.04, 0], ["DE04", 0.002, 0]]],
  "Patatas fritas aliñadas estilo Raza": ["Patata agria frita en casa con chimichurri y pimentón.", 10, [["VF13", 0.3, 18], ["AC03", 0.05, 0], ["@CHIMI", 0.015, 0], ["DE09", 0.001, 0], ["DE04", 0.002, 0]]],
  "Puré de patata trufado": ["Con trufa negra fresca.", 6, [["@PURE", 0.2, 0], ["VF25", 0.002, 0]]],
  "Tuétano asado": ["Dos canoas de tuétano con pan tostado.", 3, [["CA16", 0.35, 0], ["DE04", 0.003, 0], ["PA01", 0.1, 0], ["VF20", 0.002, 25]]],
  "Champiñones a la crema": [null, 4, [["VF16", 0.2, 8], ["LH11", 0.08, 0], ["VF17", 0.03, 10], ["VF19", 0.003, 12], ["LH10", 0.01, 0], ["DE33", 0.02, 0]]],
  "Ensalada templada de pimientos asados": [null, 4, [["@PIMASADOS", 0.2, 0], ["@ALINO", 0.02, 0]]],
  "Boniato asado con un toque de teriyaki": [null, 4, [["VF15", 0.35, 10], ["@TERIYAKI", 0.03, 0], ["DE16", 0.002, 0]]],
  // Postres
  "Piña asada": ["A la brasa con azúcar moreno.", 3, [["VF22", 0.25, 45], ["CO01", 0.07, 0], ["DE03", 0.015, 0]]],
  "Tiramisú casero": [null, 6, [["@TIRAMISU", 0.12, 0], ["PA05", 0.03, 0], ["DE30", 0.008, 0], ["DE29", 0.003, 0]]],
  "Tarta de queso y dulce de leche": ["Tarta de queso cremosa del obrador con dulce de leche casero.", 8, [["@TARTAQ", 1, 0], ["@DULCE", 0.03, 0]]],
  "Tarta de chocolate 90% cacao": ["Con un toque de AOVE y sal en escamas.", 5, [["@TARTACHOC", 1, 0], ["DE04", 0.0005, 0], ["AC01", 0.003, 0]]],
  "Tarta de queso y pistacho": [null, 5, [["@TARTAPIS", 1, 0]]],
  "Tarta fina de manzana casera": ["Hojaldre y manzana golden horneados al momento.", 3, [["CO05", 0.08, 0], ["VF23", 0.15, 25], ["LH10", 0.01, 0], ["DE02", 0.015, 0], ["DE45", 0.01, 0]]],
  "Cookie casera": ["Horneada al momento.", 4, [["@COOKIE", 1, 0], ["CO02", 0.07, 0]]],
  "Brownie cremoso": [null, 4, [["@BROWNIE", 1, 0], ["CO01", 0.07, 0]]],
  "Volcán de chocolate fundente, crema de café y helado": [null, 4, [["@VOLCAN", 1, 0], ["CO01", 0.06, 0], ["LH11", 0.03, 0], ["DE30", 0.003, 0], ["DE02", 0.005, 0]]],
  "Helados artesanos": ["Vainilla y chocolate.", 3, [["CO01", 0.06, 0], ["CO03", 0.06, 0]]],
  "Sorbete de limón al cava": [null, 3, [["CO04", 0.12, 0], ["DE34", 0.05, 0]]],
  // Servicio
  "Pan y aperitivo": ["Pan de masa madre, aceitunas y AOVE. Por persona.", 100, [["PA01", 0.12, 0], ["DE23", 0.03, 0], ["AC01", 0.01, 0]]],
};

function clavePlato(p: PlatoCarta): string {
  if (p.nombre !== "Lomo alto") return p.nombre;
  return p.seccion.includes("nacionales") ? "Lomo alto|nacionales" : "Lomo alto|europeos";
}

/** Nombre en la carta: con la unidad de venta si la carta la da (la tabla de platos no tiene campo de unidad). */
function nombrePlato(p: PlatoCarta): string {
  const u = p.unidad?.trim();
  if (!u) return p.nombre;
  const texto = u === "unidad" ? "ud." : u === "persona" ? "por persona" : u.replace(/^(\d+) unidades$/, "$1 uds.");
  return `${p.nombre} (${texto})`;
}

// ===========================================================================
// Utilidades
// ===========================================================================

const DIA_MS = 86_400_000;
const SEMANAS = 8;
const DIAS_PEDIDO_OBRADOR = [1, 3, 5]; // el local pide al obrador lunes, miércoles y viernes
const MARGEN_OBRADOR = 12; // tarifa a RZ-PRU: coste + 12 %
const CUBIERTOS: Record<number, number> = { 0: 150, 1: 95, 2: 105, 3: 115, 4: 135, 5: 175, 6: 195 };

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const arriba = (q: number, paso: number) => r3(Math.ceil(q / paso - 1e-9) * paso);

/** Generador pseudoaleatorio con semilla (mismos datos en cada carga). */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tandas en cuartos (o en décimas si es menos de un cuarto de receta). */
function tandasPara(x: number): number {
  return x >= 0.25 ? Math.ceil(x * 4 - 1e-9) / 4 : Math.max(0.1, Math.ceil(x * 10 - 1e-9) / 10);
}

let contadorId = 0;
const sello = Date.now().toString(36);
/** Id con forma de cuid generado aquí, para poder enlazar filas creadas con createMany. */
function nuevoId(): string {
  contadorId++;
  return `c${sello}${contadorId.toString(36).padStart(5, "0")}${Math.random().toString(36).slice(2, 8)}`.slice(0, 25);
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function fechaMadrid(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
}

/** «Semana 45 · 2026» (semana ISO), como nombrePorDefecto del motor de inventarios. */
function nombreSemana(d0: Date): string {
  const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `Semana ${Math.ceil(((d.getTime() - inicio.getTime()) / DIA_MS + 1) / 7)} · ${d.getUTCFullYear()}`;
}

async function enLotes<T>(filas: T[], tam: number, fn: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += tam) await fn(filas.slice(i, i + tam));
}

/** Reserva n números seguidos de una serie (formato del kernel: SERIE-AAAA-000001). */
async function reservarNumeros(prisma: PrismaClient, tenantId: string, serie: string, n: number): Promise<string[]> {
  if (n === 0) return [];
  const anio = new Date().getFullYear();
  const c = await prisma.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: n },
    update: { valor: { increment: n } },
  });
  const inicio = c.valor - n + 1;
  return Array.from({ length: n }, (_, i) => `${serie}-${anio}-${String(inicio + i).padStart(6, "0")}`);
}

// ===========================================================================
// Tipos de la simulación
// ===========================================================================

type Centro = "L" | "O"; // local RZ-PRU u obrador OB

interface Mov {
  centro: Centro;
  ref: string;
  tipo: TipoMovimiento;
  cantidad: number;
  coste: number;
  fecha: Date;
  motivo: string;
  doc?: { numero?: string; albaran?: string; id: string };
  campo?: "numero" | "albaran";
  documentoFijo?: string;
  usuario?: string | null;
}
interface LineaCompraSim { ref: string; cantidad: number; recibida: number | null; precio: number }
interface CompraSim {
  id: string; centro: Centro; prov: ClaveProv; dia: number; creada: Date; enviada: Date | null; recibida: Date | null;
  estado: "BORRADOR" | "ENVIADO" | "RECIBIDO_PARCIAL" | "RECIBIDO" | "CANCELADO";
  lineas: LineaCompraSim[]; notas: string[]; albaranProv: string | null; numero?: string; albaran?: string;
}
interface LineaPedidoSim { ref: string; pedida: number; servida: number | null; recibida: number | null; precio: number }
interface PedidoSim {
  id: string; creado: Date; servido: Date | null; estado: "PENDIENTE" | "RECIBIDO"; lineas: LineaPedidoSim[]; notas: string[]; numero?: string; albaran?: string;
}
interface LoteSim {
  id: string; ref: string; cantidad: number; restante: number; cu: number; elaborado: Date; caduca: Date;
  ingredientes: { ref: string; cantidad: number; cu: number }[]; estado: "ACTIVO" | "RETIRADO"; retiradoMotivo?: string; retiradoEn?: Date; codigo?: string;
}
interface OrdenSim {
  id: string; ref: string; dia: number; tandas: number; prevista: number; real: number | null; costeTotal: number | null; cu: number | null;
  estado: "PLANIFICADA" | "CERRADA"; cerrado: Date | null; creada: Date; lote: LoteSim | null; numero?: string;
}
interface MermaSim { id: string; centro: Centro; ref: string; cantidad: number; coste: number; fecha: Date; motivo: string; numero?: string }

// ===========================================================================
// Siembra
// ===========================================================================

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const ya = await prisma.producto.count({ where: { tenantId: t, referencia: { startsWith: PREFIJO.comida } } });
  if (ya > 0) {
    console.log("  cocina: el catálogo RZC- ya existe; no se repite");
    return;
  }
  const obradorId = ctx.centros.OB;
  const localId = ctx.centroPruebas;
  const marcaRaza = ctx.marcas.RAZA;
  if (!obradorId || !marcaRaza) throw new Error("Falta el obrador OB o la marca Raza en la semilla general");
  const centroId = (c: Centro) => (c === "L" ? localId : obradorId);

  // --- Catálogo en memoria ---
  const ref = (codigo: string) => (codigo.startsWith("@") ? PREFIJO.obrador + codigo.slice(1) : PREFIJO.comida + codigo);
  const ING = new Map(INGREDIENTES.map((f) => [ref(f[0]), f]));
  const REC = new Map(RECETAS.map((f) => [ref("@" + f[0]), f]));
  const existe = (r: string) => ING.has(r) || REC.has(r);
  const unidadDe = (r: string) => (ING.get(r)?.[3] ?? REC.get(r)![2]) as string;
  const paso = (r: string) => {
    const i = ING.get(r);
    if (i) return i[9];
    const u = REC.get(r)![2];
    return u === "UD" || u === "RACION" ? 1 : 0.5;
  };
  for (const [, , , , , , , , , lineas] of RECETAS)
    for (const [c] of lineas) if (!existe(ref(c))) throw new Error(`cocina: ingrediente de receta desconocido ${c}`);
  for (const [clave, [, , lineas]] of Object.entries(PLATOS))
    for (const [c] of lineas) if (!existe(ref(c))) throw new Error(`cocina: ingrediente desconocido ${c} en «${clave}»`);
  const platosCarta = ctx.carta.comida;
  for (const p of platosCarta) if (!PLATOS[clavePlato(p)]) throw new Error(`cocina: falta el escandallo de «${p.nombre}»`);

  // --- Alérgenos y origen animal (los elaborados heredan de su receta; orden por dependencias) ---
  const alerg = new Map<string, { a: string[]; t: string[]; carne: boolean; animal: boolean }>();
  for (const [codigo, , familia, , , , , a, tr] of INGREDIENTES) {
    const carne = familia === "Carnes" || familia === "Pescados y mariscos" || CARNE_OCULTA.has(codigo);
    const animal = carne || familia === "Lácteos y huevos" || a.includes("LECHE") || a.includes("HUEVOS") || codigo === "DE40";
    alerg.set(ref(codigo), { a: unirAlergenos(a), t: unirAlergenos(tr).filter((x) => !a.includes(x)), carne, animal });
  }
  const calcularElaborado = (r: string): void => {
    if (alerg.has(r)) return;
    const lineas = REC.get(r)![9];
    for (const [c] of lineas) if (REC.has(ref(c))) calcularElaborado(ref(c));
    const hijos = lineas.map(([c]) => alerg.get(ref(c))!);
    const a = unirAlergenos(...hijos.map((h) => h.a));
    alerg.set(r, { a, t: unirAlergenos(...hijos.map((h) => h.t)).filter((x) => !a.includes(x)), carne: hijos.some((h) => h.carne), animal: hijos.some((h) => h.animal) });
  };
  for (const r of REC.keys()) calcularElaborado(r);

  // --- Fechas: día 0 = hoy (Madrid); horas de Madrid aproximadas a UTC+1 ---
  const ahora = ctx.hoy;
  const [ay, am, ad] = fechaMadrid(ahora).split("-").map(Number);
  const base = Date.UTC(ay, am - 1, ad);
  const diaSemana = (d: number) => new Date(base + d * DIA_MS).getUTCDay();
  const fecha = (d: number, h: number, m = 0) => {
    const f = new Date(base + d * DIA_MS + (h - 1) * 3_600_000 + m * 60_000);
    return f.getTime() > ahora.getTime() - 60_000 ? new Date(ahora.getTime() - 60_000 - Math.abs(hash(`${d}${h}${m}`) % 3_000_000)) : f;
  };
  const diaFecha = (d: number) => new Date(base + d * DIA_MS);
  const INICIO = -SEMANAS * 7 - 1; // día de apertura del local de pruebas (carga inicial)
  const azar = aleatorio(20261114);

  // --- Ventas estimadas por día y consumo teórico del local (escandallo bruto) ---
  const FIN_PREVISION = 12;
  const consumoL = new Map<number, Map<string, number>>(); // día → ref → cantidad bruta
  const ventas = new Map<number, number>(); // cubiertos por día
  for (let d = INICIO + 1; d <= FIN_PREVISION; d++) {
    const cub = Math.round(CUBIERTOS[diaSemana(d)] * (0.88 + azar() * 0.24));
    ventas.set(d, cub);
    const dia = new Map<string, number>();
    for (const [, [, porCien, lineas]] of Object.entries(PLATOS)) {
      const raciones = Math.round((cub * porCien * (0.75 + azar() * 0.5)) / 100);
      if (raciones <= 0) continue;
      for (const [c, neta, merma] of lineas) {
        const r = ref(c);
        dia.set(r, (dia.get(r) ?? 0) + cantidadBruta(neta, merma) * raciones);
      }
    }
    consumoL.set(d, dia);
  }
  const consumoEntre = (r: string, desde: number, hasta: number) => {
    let s = 0;
    for (let d = desde; d <= hasta; d++) s += consumoL.get(d)?.get(r) ?? 0;
    return s;
  };
  const refsLocal = new Set<string>();
  for (const m of consumoL.values()) for (const r of m.keys()) refsLocal.add(r);
  const mediaL = new Map<string, number>();
  for (const r of refsLocal) mediaL.set(r, consumoEntre(r, INICIO + 1, -1) / (-1 - INICIO));

  // --- Estado ---
  const stock: Record<Centro, Map<string, number>> = { L: new Map(), O: new Map() };
  const st = (c: Centro, r: string) => stock[c].get(r) ?? 0;
  const mover = (c: Centro, r: string, q: number) => stock[c].set(r, r3(st(c, r) + q));
  const coste = new Map<string, number>();
  for (const [r, f] of ING) coste.set(r, f[4]);
  const costeDe = (r: string) => coste.get(r) ?? 0;
  const entradaConMedio = (r: string, q: number, precio: number) => {
    const antes = st("L", r) + st("O", r);
    const c0 = costeDe(r);
    coste.set(r, antes <= 0 || c0 <= 0 ? precio : r4((antes * c0 + q * precio) / (antes + q)));
  };

  const movs: Mov[] = [];
  const compras: CompraSim[] = [];
  const comprasPorClave = new Map<string, CompraSim>();
  const pedidos: PedidoSim[] = [];
  const ordenes: OrdenSim[] = [];
  const lotesOB = new Map<string, LoteSim[]>();
  const mermas: MermaSim[] = [];

  const usuarios = await prisma.usuario.findMany({ where: { tenantId: t, email: { in: ["economato@erp.local", "direccion@erp.local"] } }, select: { id: true, email: true } });
  const uEconomato = usuarios.find((u) => u.email === "economato@erp.local")?.id ?? null;
  const uLocal = usuarios.find((u) => u.email === "direccion@erp.local")?.id ?? null;

  const precioCompra = (r: string, d: number) => {
    const f = ING.get(r)!;
    const vol = f[2] === "Verduras y frutas" ? 0.06 : f[2] === "Pescados y mariscos" ? 0.05 : 0.02;
    return r4(f[4] * (1 + vol * Math.sin((d + (hash(r) % 50)) / 6) + 0.01 * (azar() - 0.5)));
  };
  const proximoReparto = (prov: ClaveProv, d: number) => {
    for (let x = d + 1; x < d + 15; x++) if (PROVEEDORES[prov].dias.includes(diaSemana(x))) return x;
    return d + 7;
  };
  const albaranProv = (prov: ClaveProv) => `${PROVEEDORES[prov].prefijoAlbaran}-${String(10000 + Math.floor(azar() * 89999))}`;

  /** Añade una línea a la compra de ese proveedor, centro y día (la crea si no existe) y da entrada al stock. */
  const comprar = (c: Centro, prov: ClaveProv, d: number, r: string, q: number, recibir = true) => {
    const clave = `${c}|${prov}|${d}`;
    let compra = comprasPorClave.get(clave);
    if (!compra) {
      const reparto = c === "O" ? fecha(d, 7, 15) : fecha(d, 9, 30 + Math.floor(azar() * 40));
      compra = {
        id: nuevoId(), centro: c, prov, dia: d, creada: fecha(d - 1, 17, Math.floor(azar() * 50)), enviada: fecha(d - 1, 17, 55),
        recibida: recibir ? reparto : null, estado: recibir ? "RECIBIDO" : "ENVIADO", lineas: [], notas: [], albaranProv: recibir ? albaranProv(prov) : null,
      };
      compra.notas.push(c === "L" ? "Descargar en Cámara, Congelador y Seco del local" : "Entrega en el muelle del obrador");
      comprasPorClave.set(clave, compra);
      compras.push(compra);
    }
    const precio = precioCompra(r, d);
    const falta = recibir && c === "L" && azar() < 0.012;
    const recibida = recibir ? (falta ? 0 : q) : null;
    const linea = compra.lineas.find((l) => l.ref === r);
    if (linea) {
      linea.cantidad = r3(linea.cantidad + q);
      if (linea.recibida !== null && recibida !== null) linea.recibida = r3(linea.recibida + recibida);
    } else compra.lineas.push({ ref: r, cantidad: q, recibida, precio });
    if (falta) compra.notas.push(`Faltó ${ING.get(r)![1]}: el proveedor no tenía género. Se cierra sin esperar.`);
    if (recibida) {
      entradaConMedio(r, recibida, precio);
      mover(c, r, recibida);
    }
  };

  // --- Producción en el obrador (con sub-recetas y compras al momento si falta materia prima) ---
  const sacarLotes = (r: string, q: number) => {
    let resto = q;
    for (const l of lotesOB.get(r) ?? []) {
      if (resto <= 0) break;
      const usa = Math.min(l.restante, resto);
      l.restante = r3(l.restante - usa);
      resto = r3(resto - usa);
    }
  };
  const producir = (r: string, necesaria: number, d: number, hora: number) => {
    const [, , unidad, , rend, vida] = REC.get(r)!;
    const hay = st("O", r);
    if (hay + 1e-9 >= necesaria) return;
    // Lo que dura mucho se hace para varios días; lo fresco, para el pedido del día
    const diasCubre = vida >= 10 ? Math.min(7, vida / 2) : vida >= 6 ? 1.5 : vida >= 4 ? 0.75 : 0;
    const cobertura = (mediaL.get(r) ?? 0) * diasCubre;
    const tandas = tandasPara((necesaria - hay + cobertura) / rend);
    const lineas = REC.get(r)![9];
    const consumo: { ref: string; cantidad: number; cu: number }[] = [];
    for (const [c, neta, merma] of lineas) {
      const ri = ref(c);
      const q = r3(cantidadBruta(neta, merma) * tandas);
      if (REC.has(ri)) producir(ri, q, d, hora - 1);
      else if (st("O", ri) < q) {
        const prov = ING.get(ri)![6];
        let dc = d;
        while (!PROVEEDORES[prov].dias.includes(diaSemana(dc)) && dc > INICIO) dc--;
        comprar("O", prov, dc, ri, arriba(q - st("O", ri) + q * 0.8, paso(ri)));
      }
      consumo.push({ ref: ri, cantidad: q, cu: costeDe(ri) });
    }
    const orden: OrdenSim = {
      id: nuevoId(), ref: r, dia: d, tandas, prevista: r3(rend * tandas), real: null, costeTotal: null, cu: null,
      estado: "CERRADA", cerrado: fecha(d, Math.max(hora, 6), 30), creada: fecha(d - 2, 12, 0), lote: null,
    };
    const factor = 0.96 + azar() * 0.05;
    const real = unidad === "UD" || unidad === "RACION" ? Math.max(1, Math.floor(rend * tandas * factor)) : r3(rend * tandas * factor);
    let costeTotal = 0;
    for (const c of consumo) {
      costeTotal += c.cantidad * c.cu;
      movs.push({ centro: "O", ref: c.ref, tipo: "PRODUCCION_CONSUMO", cantidad: -c.cantidad, coste: c.cu, fecha: orden.cerrado!, motivo: "", doc: orden, campo: "numero", usuario: uEconomato });
      mover("O", c.ref, -c.cantidad);
      if (REC.has(c.ref)) sacarLotes(c.ref, c.cantidad);
    }
    const cu = r4(costeTotal / real);
    const antes = Math.max(st("O", r), 0);
    const c0 = costeDe(r);
    coste.set(r, antes > 0 && c0 > 0 ? r4((antes * c0 + real * cu) / (antes + real)) : cu);
    mover("O", r, real);
    const lote: LoteSim = {
      id: nuevoId(), ref: r, cantidad: real, restante: real, cu, elaborado: orden.cerrado!, caduca: new Date(orden.cerrado!.getTime() + vida * DIA_MS),
      ingredientes: consumo.map((c) => ({ ref: c.ref, cantidad: r4(c.cantidad), cu: c.cu })), estado: "ACTIVO",
    };
    movs.push({ centro: "O", ref: r, tipo: "PRODUCCION_ENTRADA", cantidad: real, coste: cu, fecha: orden.cerrado!, motivo: "", doc: orden, campo: "numero", usuario: uEconomato });
    Object.assign(orden, { real, costeTotal: r4(costeTotal), cu, lote });
    ordenes.push(orden);
    if (!lotesOB.has(r)) lotesOB.set(r, []);
    lotesOB.get(r)!.push(lote);
  };

  const mermar = (c: Centro, r: string, q: number, d: number, h: number, motivo: string) => {
    const cantidad = r3(Math.min(q, st(c, r)));
    if (cantidad <= 0) return;
    const m: MermaSim = { id: nuevoId(), centro: c, ref: r, cantidad, coste: costeDe(r), fecha: fecha(d, h, Math.floor(azar() * 50)), motivo };
    mermas.push(m);
    mover(c, r, -cantidad);
    if (c === "O" && REC.has(r)) sacarLotes(r, cantidad);
  };

  // Mermas del local: [día, ref, cantidad, motivo]
  const MERMAS_LOCAL: [number, string, number, string][] = [
    [-50, "LH13", 6, "Rotura: bandeja de huevos caída al descargar"],
    [-46, "VF05", 1.2, "Caducidad: aguacates pasados de maduración"],
    [-41, "CA06", 1.1, "Error de cocina o barra: chuletón quemado en la parrilla, devuelto por el cliente"],
    [-37, "LH01", 2, "Caducidad: burratas con la fecha de consumo superada"],
    [-33, "PA01", 3, "Desperdicio: pan sobrante del servicio del sábado"],
    [-29, "VF20", 0.2, "Caducidad: perejil marchito"],
    [-26, "PE06", 0.4, "Caducidad: atún con el color oscurecido, no apto para tartar"],
    [-22, "LH11", 2, "Caducidad: briks de nata abiertos más de 3 días"],
    [-19, "CA10", 0.35, "Error de cocina o barra: punto equivocado (pedido poco hecho, salió hecho)"],
    [-15, "@CROQJB", 12, "Error de cocina o barra: croquetas reventadas en la freidora"],
    [-12, "VF02", 0.6, "Caducidad: setas con moho"],
    [-9, "CO01", 1.5, "Desperdicio: cubeta de helado descongelada (puerta del arcón abierta toda la noche)"],
    [-5, "@TARTAQ", 3, "Caducidad: raciones de tarta con más de 5 días"],
    [-3, "CA13", 0.15, "Desperdicio: recortes de limpieza del wagyu no aprovechables"],
    [-2, "PE04", 10, "Caducidad: zamburiñas abiertas, descartadas"],
    [-1, "DE13", 1, "Rotura: botella de vinagre de Jerez rota en el almacén Seco"],
  ];

  // Día del inventario semanal: el último lunes con al menos 2 días de margen
  let diaInventario = -2;
  while (diaSemana(diaInventario) !== 1) diaInventario--;
  let inventario: { id: string; dia: number; lineas: { ref: string; teorico: number; contado: number; coste: number }[]; numero?: string } | null = null;

  const diasPedido = (d: number) => DIAS_PEDIDO_OBRADOR.includes(diaSemana(d));
  const proximoPedido = (d: number) => {
    let x = d + 1;
    while (!diasPedido(x)) x++;
    return x;
  };
  const elaboradosLocal = Array.from(refsLocal).filter((r) => REC.has(r));
  const crudosLocal = Array.from(refsLocal).filter((r) => ING.has(r));

  /** Pide al obrador lo necesario hasta el próximo pedido (+15 % y un colchón). */
  const lineasPedido = (d: number, desde = d) => {
    const sig = proximoPedido(d);
    const lineas: LineaPedidoSim[] = [];
    for (const r of elaboradosLocal) {
      // desde < d: pedido hecho antes (hoy), hay que contar lo que se gastará hasta que llegue
      const objetivo = consumoEntre(r, desde, d - 1) + consumoEntre(r, d, sig - 1) * 1.15 + (mediaL.get(r) ?? 0) * 0.8;
      const falta = objetivo - st("L", r);
      if (falta <= 0.05) continue;
      lineas.push({ ref: r, pedida: arriba(falta, paso(r)), servida: null, recibida: null, precio: 0 });
    }
    return lineas;
  };

  // ---------------- Simulación día a día ----------------
  for (let d = INICIO; d <= 0; d++) {
    // 0) Caducidad de lotes del obrador (lo que quede de un lote caducado se tira)
    for (const [r, lotes] of lotesOB)
      for (const l of lotes)
        if (l.estado === "ACTIVO" && l.restante > 0 && l.caduca.getTime() < diaFecha(d).getTime()) {
          const q = Math.min(l.restante, st("O", r));
          if (q > 0) {
            mermas.push({ id: nuevoId(), centro: "O", ref: r, cantidad: r3(q), coste: costeDe(r), fecha: fecha(d, 6, 10), motivo: `Caducidad: sobrante del lote caducado (${REC.get(r)![1]})` });
            mover("O", r, -q);
          }
          l.restante = 0;
        }

    // 1) Apertura: recuento inicial del local (2,5 días de consumo)
    if (d === INICIO) {
      for (const r of crudosLocal) {
        const q = arriba((mediaL.get(r) ?? 0) * 2.5, paso(r));
        if (q <= 0) continue;
        movs.push({ centro: "L", ref: r, tipo: "CARGA_INICIAL", cantidad: q, coste: costeDe(r), fecha: fecha(d, 8, 0), motivo: "Recuento de apertura del local de pruebas", documentoFijo: "APERTURA RZ-PRU", usuario: uLocal });
        mover("L", r, q);
      }
    }

    // 2) Inventario semanal (lunes a primera hora, antes de los repartos)
    if (d === diaInventario) {
      const lineas: { ref: string; teorico: number; contado: number; coste: number }[] = [];
      for (const r of refsLocal) {
        const teorico = r3(st("L", r));
        let contado = teorico;
        if (azar() < 0.35 && teorico > 0) {
          const fam = ING.get(r)?.[2];
          // carne y verdura pierden peso (oreo, limpieza); el resto, errores de recuento a los dos lados
          const desv = fam === "Carnes" ? -(0.01 + azar() * 0.03) : fam === "Verduras y frutas" ? -(0.02 + azar() * 0.06) : (azar() - 0.6) * 0.08;
          contado = unidadDe(r) === "UD" || unidadDe(r) === "RACION" ? Math.max(0, Math.round(teorico * (1 + desv))) : r3(Math.max(0, teorico * (1 + desv)));
        }
        lineas.push({ ref: r, teorico, contado, coste: costeDe(r) });
      }
      // que el descuadre no pase de 500 € (si no, quedaría pendiente de aprobación)
      const descuadre = lineas.reduce((s, l) => s + Math.abs(l.contado - l.teorico) * l.coste, 0);
      if (descuadre > 450)
        for (const l of lineas) {
          const c = l.teorico + ((l.contado - l.teorico) * 450) / descuadre;
          l.contado = unidadDe(l.ref) === "UD" || unidadDe(l.ref) === "RACION" ? Math.round(c) : r3(c);
        }
      inventario = { id: nuevoId(), dia: d, lineas };
      for (const l of lineas) {
        const dif = r3(l.contado - l.teorico);
        if (dif === 0) continue;
        movs.push({ centro: "L", ref: l.ref, tipo: "AJUSTE_INVENTARIO", cantidad: dif, coste: l.coste, fecha: fecha(d, 8, 40), motivo: `Inventario ${nombreSemana(diaFecha(d))}`, doc: inventario, campo: "numero", usuario: uLocal });
        mover("L", l.ref, dif);
      }
    }

    // 3) Compras del local: cada proveedor en su día de reparto, hasta el siguiente reparto (+15 % y colchón)
    if (d > INICIO) {
      for (const prov of Object.keys(PROVEEDORES) as ClaveProv[]) {
        if (!PROVEEDORES[prov].dias.includes(diaSemana(d))) continue;
        const sig = proximoReparto(prov, d);
        for (const r of crudosLocal) {
          if (ING.get(r)![6] !== prov) continue;
          const objetivo = consumoEntre(r, d, sig - 1) * 1.15 + (mediaL.get(r) ?? 0) * 0.6;
          const falta = objetivo - st("L", r);
          if (falta > 0.001) comprar("L", prov, d, r, arriba(falta, paso(r)));
        }
      }
    }

    // 4) Pedido al obrador (lunes, miércoles y viernes; también el día de apertura)
    if (d < 0 && (diasPedido(d) || d === INICIO)) {
      const lineas = lineasPedido(d);
      if (lineas.length > 0) {
        const p: PedidoSim = { id: nuevoId(), creado: d === INICIO ? fecha(d, 8, 30) : fecha(d - 1, 22, 30), servido: fecha(d, 10, 30), estado: "RECIBIDO", lineas, notas: [] };
        for (const l of lineas) {
          producir(l.ref, l.pedida, d, 8);
          const servida = r3(Math.min(l.pedida, Math.max(0, st("O", l.ref))));
          l.servida = servida;
          l.recibida = servida;
          l.precio = r4(costeDe(l.ref) * (1 + MARGEN_OBRADOR / 100));
          if (servida <= 0) continue;
          const cu = costeDe(l.ref);
          mover("O", l.ref, -servida);
          sacarLotes(l.ref, servida);
          mover("L", l.ref, servida);
          movs.push({ centro: "O", ref: l.ref, tipo: "SALIDA_PEDIDO", cantidad: -servida, coste: cu, fecha: p.servido!, motivo: "", doc: p, campo: "albaran", usuario: uEconomato });
          movs.push({ centro: "L", ref: l.ref, tipo: "ENTRADA_PEDIDO", cantidad: servida, coste: cu, fecha: p.servido!, motivo: "", doc: p, campo: "albaran", usuario: uEconomato });
        }
        // una recepción con diferencias (bandeja de croquetas aplastada)
        if (d === -24) {
          const l = p.lineas.find((x) => x.ref === ref("@CROQJAM") && (x.servida ?? 0) > 12);
          if (l) {
            l.recibida = r3(l.servida! - 12);
            p.notas.push("Recepción: una bandeja de croquetas llegó aplastada (12 uds.)");
            mover("L", l.ref, -12);
            movs.push({ centro: "L", ref: l.ref, tipo: "ENTRADA_PEDIDO", cantidad: -12, coste: costeDe(l.ref), fecha: fecha(d, 12, 20), motivo: "Diferencia al recibir: una bandeja de croquetas llegó aplastada", doc: p, campo: "albaran", usuario: uLocal });
          }
        }
        pedidos.push(p);
      }
    }

    // 5) Mermas del día
    for (const [dm, c, q, motivo] of MERMAS_LOCAL) if (dm === d) mermar("L", ref(c), q, d, 16, motivo);
    if (d === -20) {
      // lote de tiramisú retirado por una avería de la cámara del obrador
      const lote = [...(lotesOB.get(ref("@TIRAMISU")) ?? [])].reverse().find((l) => l.restante > 0);
      if (lote) {
        lote.estado = "RETIRADO";
        lote.retiradoMotivo = "Avería de la cámara 2 del obrador: 9 °C durante la noche. Se tira lo que quedaba del lote.";
        lote.retiradoEn = fecha(d, 7, 10);
        mermar("O", lote.ref, lote.restante, d, 7, "Otro: lote retirado por fallo de temperatura en la cámara del obrador");
        lote.restante = 0;
      }
    }

    // 6) Consumo del día en el local (ventas × escandallo), al cierre
    if (d > INICIO && d < 0) {
      for (const [r, q] of consumoL.get(d) ?? []) {
        const cantidad = r3(q);
        if (cantidad <= 0) continue;
        movs.push({
          centro: "L", ref: r, tipo: "CONSUMO", cantidad: -cantidad, coste: costeDe(r), fecha: fecha(d, 23, 45),
          motivo: `Consumo teórico de las ventas del día (${ventas.get(d)} cubiertos × escandallos de la carta)`, documentoFijo: `CONSUMO ${fechaMadrid(diaFecha(d))}`, usuario: null,
        });
        mover("L", r, -cantidad);
      }
    }
  }

  // ---------------- Hoy: documentos a medias ----------------
  // Compras enviadas para mañana (no recibidas) y un borrador para el próximo reparto de despensa
  {
    // a los proveedores que reparten en los dos próximos días ya se les ha mandado el pedido
    for (const prov of Object.keys(PROVEEDORES) as ClaveProv[]) {
      const prox = proximoReparto(prov, 0);
      if (prox > 2) continue;
      const sig = proximoReparto(prov, prox);
      for (const r of crudosLocal) {
        if (ING.get(r)![6] !== prov) continue;
        const objetivo = consumoEntre(r, 0, prox - 1) + consumoEntre(r, prox, sig - 1) * 1.15 + (mediaL.get(r) ?? 0) * 0.6;
        const falta = objetivo - st("L", r);
        if (falta > 0.001) comprar("L", prov, prox, r, arriba(falta, paso(r)), false);
      }
    }
    for (const c of compras) if (c.dia > 0) { c.creada = fecha(0, 12, 5); c.enviada = fecha(0, 12, 20); }
    const des = proximoReparto("DES", 0);
    const borrador: CompraSim = {
      id: nuevoId(), centro: "L", prov: "DES", dia: des, creada: fecha(0, 12, 40), enviada: null, recibida: null, estado: "BORRADOR",
      lineas: [], notas: ["Borrador: revisar con el jefe de cocina antes de enviarlo"], albaranProv: null,
    };
    for (const r of crudosLocal)
      if (ING.get(r)![6] === "DES") {
        const falta = consumoEntre(r, 0, des + 6) * 1.1 - st("L", r);
        if (falta > 0.001) borrador.lineas.push({ ref: r, cantidad: arriba(falta, paso(r)), recibida: null, precio: precioCompra(r, 0) });
      }
    if (borrador.lineas.length) compras.push(borrador);
    // Una compra cancelada (duplicada por error) y una recibida a medias pendiente del resto
    const pes = compras.find((c) => c.centro === "L" && c.prov === "PES" && c.dia === -30 && c.estado === "RECIBIDO");
    if (pes)
      compras.push({
        id: nuevoId(), centro: "L", prov: "PES", dia: -30, creada: new Date(pes.creada.getTime() + 180_000), enviada: null, recibida: null, estado: "CANCELADO",
        lineas: pes.lineas.map((l) => ({ ref: l.ref, cantidad: l.cantidad, recibida: null, precio: l.precio })), notas: ["Pedido duplicado por error; anulado antes de enviarlo"], albaranProv: null,
      });
    const parcial = [...compras].reverse().find((c) => c.centro === "L" && c.prov === "FYV" && c.estado === "RECIBIDO" && c.dia >= -3 && c.lineas.length > 3);
    if (parcial) {
      const l = parcial.lineas.find((x) => (x.recibida ?? 0) > 1 && ING.get(x.ref)![2] === "Verduras y frutas")!;
      if (l) {
        const quita = r3(Math.floor(l.recibida! / 2 / paso(l.ref)) * paso(l.ref));
        if (quita > 0 && st("L", l.ref) >= quita) {
          l.recibida = r3(l.recibida! - quita);
          mover("L", l.ref, -quita);
          parcial.estado = "RECIBIDO_PARCIAL";
          parcial.notas.push(`Llegó la mitad de ${ING.get(l.ref)![1]}; el resto lo traen en el próximo reparto`);
        }
      }
    }
  }
  // Pedido al obrador pendiente de servir (para el próximo día de pedido) y producción planificada
  const pedidoPendiente: PedidoSim = { id: nuevoId(), creado: fecha(0, 21, 30), servido: null, estado: "PENDIENTE", lineas: lineasPedido(proximoPedido(0), 0), notas: ["Pedido para el próximo reparto del obrador"] };
  for (const l of pedidoPendiente.lineas) l.precio = r4(costeDe(l.ref) * (1 + MARGEN_OBRADOR / 100));
  if (pedidoPendiente.lineas.length) pedidos.push(pedidoPendiente);
  const diaPlan = proximoPedido(0);
  for (const l of pedidoPendiente.lineas) {
    if (st("O", l.ref) >= l.pedida) continue;
    const rend = REC.get(l.ref)![4];
    const tandas = tandasPara((l.pedida - st("O", l.ref)) / rend);
    ordenes.push({ id: nuevoId(), ref: l.ref, dia: diaPlan, tandas, prevista: r3(rend * tandas), real: null, costeTotal: null, cu: null, estado: "PLANIFICADA", cerrado: null, creada: fecha(0, 13, 0), lote: null });
  }

  // ---------------- Mínimos y precios finales ----------------
  const consumoOB = new Map<string, number>();
  for (const m of movs) if (m.centro === "O" && m.tipo === "PRODUCCION_CONSUMO") consumoOB.set(m.ref, (consumoOB.get(m.ref) ?? 0) - m.cantidad);
  const diasSim = -INICIO;
  const minimoGeneral = (r: string) => {
    const diario = (consumoOB.get(r) ?? 0) / diasSim;
    return diario > 0 ? arriba(diario * 3, paso(r)) : 0;
  };

  // ===================================================================
  // Escritura en la base
  // ===================================================================

  // Proveedores
  await prisma.proveedor.createMany({
    data: Object.values(PROVEEDORES).map((p) => ({
      tenantId: t, nombre: p.nombre, cif: p.cif, contacto: p.contacto, telefono: p.telefono, email: p.email, areas: ["COMIDAS" as const],
      diasReparto: p.diasReparto, pedidoMinimo: p.minimo, notas: p.notas,
    })),
    skipDuplicates: true,
  });
  const provIds = new Map(
    (await prisma.proveedor.findMany({ where: { tenantId: t, nombre: { in: Object.values(PROVEEDORES).map((p) => p.nombre) } }, select: { id: true, nombre: true } })).map((p) => [p.nombre, p.id]),
  );
  const provId = (k: ClaveProv) => provIds.get(PROVEEDORES[k].nombre)!;

  // Familias (las de la semilla general; se crean si faltasen)
  const familias = new Map<string, string>();
  for (const nombre of ["Carnes", "Pescados y mariscos", "Verduras y frutas", "Lácteos y huevos", "Seco y despensa", "Elaborados del obrador"]) {
    familias.set(
      nombre,
      ctx.familias[`C|${nombre}`] ??
        (await prisma.familiaProducto.upsert({ where: { tenantId_area_nombre: { tenantId: t, area: "COMIDAS", nombre } }, create: { tenantId: t, area: "COMIDAS", nombre }, update: {} })).id,
    );
  }

  // Productos (ingredientes y elaborados)
  const pid = new Map<string, string>();
  const productos: Prisma.ProductoCreateManyInput[] = [];
  for (const [r, [, nombre, familia, unidad, , iva, prov, , , pasoCompra]] of ING) {
    const id = nuevoId();
    pid.set(r, id);
    productos.push({
      id, tenantId: t, area: "COMIDAS", referencia: r, nombre, familiaId: familias.get(familia), unidad, unidadesCompra: pasoCompra >= 1 ? pasoCompra : 1,
      costeUnitario: r4(costeDe(r)), iva, stockMinimo: minimoGeneral(r), proveedorId: provId(prov),
    });
  }
  for (const [r, [, nombre, unidad]] of REC) {
    const id = nuevoId();
    pid.set(r, id);
    productos.push({ id, tenantId: t, area: "COMIDAS", referencia: r, nombre, familiaId: familias.get("Elaborados del obrador"), unidad, costeUnitario: r4(costeDe(r)), iva: 10, stockMinimo: arriba((mediaL.get(r) ?? 0) * 2, paso(r)) });
  }
  await prisma.producto.createMany({ data: productos });
  const P_ = (r: string) => pid.get(r)!;

  // Alérgenos de cada producto (los elaborados, heredados de su receta)
  await prisma.cartaAlergenoProducto.createMany({ data: Array.from(alerg, ([r, x]) => ({ tenantId: t, productoId: P_(r), alergenos: x.a, trazas: x.t })) });

  // Recetas del obrador
  const recetaId = new Map<string, string>();
  await prisma.obradorReceta.createMany({
    data: Array.from(REC, ([r, [, , , nombre, rend, vida, conservacion, minutos, pasos]]) => {
      const id = nuevoId();
      recetaId.set(r, id);
      return { id, tenantId: t, centroId: obradorId, productoId: P_(r), nombre, rendimiento: rend, vidaUtilDias: vida, conservacion, tiempoMinutos: minutos, pasos, alergenosPropios: [] };
    }),
  });
  await prisma.obradorRecetaLinea.createMany({
    data: Array.from(REC, ([r, f]) => f[9].map(([c, neta, merma], i) => ({ recetaId: recetaId.get(r)!, productoId: P_(ref(c)), cantidad: neta, mermaPct: merma, orden: i + 1 }))).flat(),
  });

  // Ajustes del local (mínimo, máximo y tarifa del obrador) y tarifas del obrador a RZ-PRU
  await prisma.productoCentro.createMany({
    data: Array.from(refsLocal).map((r) => {
      const diario = mediaL.get(r) ?? 0;
      return {
        productoId: P_(r), centroId: localId, minimo: arriba(diario * 2, paso(r)), maximo: arriba(diario * 6, paso(r)),
        precioVenta: REC.has(r) ? r4(costeDe(r) * (1 + MARGEN_OBRADOR / 100)) : null,
      };
    }),
  });
  await prisma.obradorTarifa.createMany({
    data: Array.from(REC.keys()).filter((r) => refsLocal.has(r)).map((r) => ({ tenantId: t, obradorId, productoId: P_(r), centroId: localId, modo: "COSTE_MAS_PORCENTAJE" as const, porcentaje: MARGEN_OBRADOR, actualizadoPor: uEconomato })),
  });

  // Carta «Carta Raza Pruebas» (marca Raza): se busca por marca y nombre (Bebidas añade sus secciones a la misma)
  let carta = await prisma.carta.findFirst({ where: { tenantId: t, marcaId: marcaRaza, nombre: "Carta Raza Pruebas" } });
  if (!carta) carta = await prisma.carta.create({ data: { tenantId: t, marcaId: marcaRaza, nombre: "Carta Raza Pruebas", tipo: "PERMANENTE" } });
  const yaSecciones = await prisma.cartaSeccion.count({ where: { cartaId: carta.id } });
  const secciones = Array.from(new Set(platosCarta.map((p) => p.seccion)));
  const seccionId = new Map(secciones.map((s) => [s, nuevoId()]));
  await prisma.cartaSeccion.createMany({ data: secciones.map((s, i) => ({ id: seccionId.get(s)!, cartaId: carta!.id, nombre: s, orden: yaSecciones + i + 1 })) });
  const platosData: Prisma.CartaPlatoCreateManyInput[] = [];
  const ingredientesData: Prisma.CartaPlatoIngredienteCreateManyInput[] = [];
  const lineasData: Prisma.CartaLineaCreateManyInput[] = [];
  const ordenEnSeccion = new Map<string, number>();
  for (const p of platosCarta) {
    const [desc, , escandallo] = PLATOS[clavePlato(p)];
    const refs = escandallo.map(([c]) => ref(c));
    const a = unirAlergenos(...refs.map((r) => alerg.get(r)!.a));
    const tr = unirAlergenos(...refs.map((r) => alerg.get(r)!.t)).filter((x) => !a.includes(x));
    const etiquetas: string[] = [];
    if (!refs.some((r) => alerg.get(r)!.carne)) etiquetas.push(refs.some((r) => alerg.get(r)!.animal) ? "vegetariano" : "vegano");
    if (!a.includes("GLUTEN") && !tr.includes("GLUTEN")) etiquetas.push("sin gluten");
    const descripcion = [p.descripcion, desc].filter(Boolean).map((x) => x!.replace(/\.$/, "")).join(". ") + (p.descripcion || desc ? "." : "");
    const id = nuevoId();
    platosData.push({
      id, tenantId: t, marcaId: marcaRaza, nombre: nombrePlato(p), descripcion: descripcion || null, precio: p.precio ?? 0, iva: 10,
      alergenos: a, trazas: tr, alergenosRevisados: false, etiquetas,
    });
    escandallo.forEach(([c, neta, merma], i) => ingredientesData.push({ platoId: id, productoId: P_(ref(c)), cantidad: neta, mermaPct: merma, orden: i + 1 }));
    const o = (ordenEnSeccion.get(p.seccion) ?? 0) + 1;
    ordenEnSeccion.set(p.seccion, o);
    lineasData.push({ seccionId: seccionId.get(p.seccion)!, platoId: id, orden: o });
  }
  await prisma.cartaPlato.createMany({ data: platosData });
  await prisma.cartaPlatoIngrediente.createMany({ data: ingredientesData });
  await prisma.cartaLinea.createMany({ data: lineasData });
  const pan = platosCarta.find((p) => p.nombre === "Pan y aperitivo");
  if (pan?.precio)
    await prisma.cartaRecargo.upsert({
      where: { tenantId_centroId_concepto: { tenantId: t, centroId: localId, concepto: "Pan y aperitivo" } },
      create: { tenantId: t, centroId: localId, concepto: "Pan y aperitivo", importe: pan.precio, iva: 10 },
      update: { importe: pan.precio },
    });

  // ---------------- Números de documento (por orden de fecha) ----------------
  const porFecha = <T>(xs: T[], f: (x: T) => Date) => [...xs].sort((a, b) => f(a).getTime() - f(b).getTime());
  const comprasOrd = porFecha(compras, (c) => c.creada);
  const numPC = await reservarNumeros(prisma, t, "PC", comprasOrd.length);
  comprasOrd.forEach((c, i) => (c.numero = numPC[i]));
  const recibidas = porFecha(compras.filter((c) => c.recibida), (c) => c.recibida!);
  const numAlbE = await reservarNumeros(prisma, t, "ALB-E", recibidas.length);
  recibidas.forEach((c, i) => (c.albaran = numAlbE[i]));
  const pedidosOrd = porFecha(pedidos, (p) => p.creado);
  const numPL = await reservarNumeros(prisma, t, "PL", pedidosOrd.length);
  pedidosOrd.forEach((p, i) => (p.numero = numPL[i]));
  const servidos = pedidosOrd.filter((p) => p.servido);
  const numAlbS = await reservarNumeros(prisma, t, "ALB-S", servidos.length);
  servidos.forEach((p, i) => (p.albaran = numAlbS[i]));
  const ordenesOrd = porFecha(ordenes, (o) => o.cerrado ?? diaFecha(o.dia));
  const numOP = await reservarNumeros(prisma, t, "OP", ordenesOrd.length);
  ordenesOrd.forEach((o, i) => (o.numero = numOP[i]));
  const lotes = ordenesOrd.filter((o) => o.lote).map((o) => o.lote!);
  const numLote = await reservarNumeros(prisma, t, "LOTE", lotes.length);
  lotes.forEach((l, i) => (l.codigo = numLote[i]));
  const mermasOrd = porFecha(mermas, (m) => m.fecha);
  const numMer = await reservarNumeros(prisma, t, "MER", mermasOrd.length);
  mermasOrd.forEach((m, i) => (m.numero = numMer[i]));
  const inv = inventario as { id: string; dia: number; lineas: { ref: string; teorico: number; contado: number; coste: number }[]; numero?: string } | null;
  if (inv) inv.numero = (await reservarNumeros(prisma, t, "INV", 1))[0];

  // ---------------- Compras ----------------
  await enLotes(comprasOrd, 500, (lote) =>
    prisma.pedidoCompra.createMany({
      data: lote.map((c) => ({
        id: c.id, tenantId: t, numero: c.numero!, area: "COMIDAS" as const, proveedorId: provId(c.prov), centroId: centroId(c.centro), estado: c.estado,
        enviadoPor: c.enviada ? PROVEEDORES[c.prov].via : null, enviadoEn: c.enviada, recibidoEn: c.recibida, albaran: c.albaran ?? null,
        notas: [...c.notas, c.albaranProv ? `Albarán del proveedor: ${c.albaranProv}` : ""].filter(Boolean).join("\n") || null,
        createdAt: c.creada, updatedAt: c.recibida ?? c.creada,
      })),
    }),
  );
  await enLotes(comprasOrd.flatMap((c) => c.lineas.map((l) => ({ pedidoId: c.id, productoId: P_(l.ref), cantidad: l.cantidad, recibida: l.recibida, precio: l.precio }))), 2000, (lote) =>
    prisma.pedidoCompraLinea.createMany({ data: lote }),
  );
  for (const c of compras) {
    if (!c.recibida) continue;
    for (const l of c.lineas)
      if ((l.recibida ?? 0) > 0)
        movs.push({
          centro: c.centro, ref: l.ref, tipo: "ENTRADA_COMPRA", cantidad: l.recibida!, coste: l.precio, fecha: c.recibida,
          motivo: `Compra ${c.numero} · albarán del proveedor ${c.albaranProv}`, doc: c, campo: "albaran", usuario: c.centro === "O" ? uEconomato : uLocal,
        });
  }

  // ---------------- Pedidos internos ----------------
  await prisma.pedidoInterno.createMany({
    data: pedidosOrd.map((p) => ({
      id: p.id, tenantId: t, numero: p.numero!, area: "COMIDAS" as const, origenId: obradorId, destinoId: localId, estado: p.estado,
      notas: p.notas.join("\n") || null, creadoPor: uLocal, servidoPor: p.servido ? uEconomato : null, servidoEn: p.servido, albaran: p.albaran ?? null,
      createdAt: p.creado, updatedAt: p.servido ?? p.creado,
    })),
  });
  await enLotes(pedidosOrd.flatMap((p) => p.lineas.map((l) => ({ pedidoId: p.id, productoId: P_(l.ref), pedida: l.pedida, servida: l.servida, recibida: l.recibida, precio: l.precio }))), 2000, (lote) =>
    prisma.pedidoInternoLinea.createMany({ data: lote }),
  );

  // ---------------- Producción: órdenes y lotes ----------------
  await prisma.obradorOrden.createMany({
    data: ordenesOrd.map((o) => ({
      id: o.id, tenantId: t, centroId: obradorId, numero: o.numero!, recetaId: recetaId.get(o.ref)!, fecha: diaFecha(o.dia), tandas: o.tandas, cantidadPrevista: o.prevista,
      cantidadReal: o.real, costeTotal: o.costeTotal, costeUnitario: o.cu, estado: o.estado, notas: o.estado === "PLANIFICADA" ? "Para el pedido del local del lunes" : null,
      creadoPor: uEconomato, cerradoPor: o.cerrado ? uEconomato : null, cerradoEn: o.cerrado, createdAt: o.creada, updatedAt: o.cerrado ?? o.creada,
    })),
  });
  const ordenDeLote = new Map(ordenesOrd.filter((o) => o.lote).map((o) => [o.lote!.id, o.id]));
  await prisma.obradorLote.createMany({
    data: lotes.map((l) => ({
      id: l.id, tenantId: t, centroId: obradorId, codigo: l.codigo!, ordenId: ordenDeLote.get(l.id)!, productoId: P_(l.ref), cantidad: l.cantidad, costeUnitario: l.cu,
      elaboradoEn: l.elaborado, caducaEn: l.caduca, alergenos: alerg.get(l.ref)!.a, conservacion: REC.get(l.ref)![6], estado: l.estado,
      retiradoMotivo: l.retiradoMotivo ?? null, retiradoEn: l.retiradoEn ?? null, createdAt: l.elaborado,
    })),
  });
  await enLotes(lotes.flatMap((l) => l.ingredientes.map((i) => ({ loteId: l.id, productoId: P_(i.ref), cantidad: i.cantidad, costeUnitario: i.cu }))), 2000, (lote) =>
    prisma.obradorLoteIngrediente.createMany({ data: lote }),
  );

  // ---------------- Inventario semanal ----------------
  if (inv) {
    const cerrado = fecha(inv.dia, 8, 40);
    await prisma.inventario.create({
      data: { id: inv.id, tenantId: t, numero: inv.numero!, area: "COMIDAS", centroId: localId, nombre: nombreSemana(diaFecha(inv.dia)), estado: "CERRADO", creadoPor: uLocal, cerradoPor: uLocal, cerradoEn: cerrado, createdAt: fecha(inv.dia, 7, 30) },
    });
    await prisma.inventarioLinea.createMany({ data: inv.lineas.map((l) => ({ inventarioId: inv.id, productoId: P_(l.ref), teorico: l.teorico, contado: l.contado, coste: r4(l.coste) })) });
  }

  // ---------------- Movimientos de stock ----------------
  for (const m of mermas)
    movs.push({ centro: m.centro, ref: m.ref, tipo: "MERMA", cantidad: -m.cantidad, coste: m.coste, fecha: m.fecha, motivo: m.motivo, documentoFijo: m.numero, usuario: m.centro === "O" ? uEconomato : uLocal });
  const motivoDe = (m: Mov) => {
    if (m.motivo) return m.motivo;
    if (m.tipo === "PRODUCCION_CONSUMO") return `Producción ${(m.doc as OrdenSim).lote?.codigo ?? ""}`.trim();
    if (m.tipo === "PRODUCCION_ENTRADA") return `Lote ${(m.doc as OrdenSim).lote?.codigo ?? ""}`.trim();
    if (m.tipo === "SALIDA_PEDIDO" || m.tipo === "ENTRADA_PEDIDO") return `Pedido ${(m.doc as PedidoSim).numero}`;
    return null;
  };
  const filasMov: Prisma.MovimientoStockCreateManyInput[] = porFecha(movs, (m) => m.fecha).map((m) => ({
    tenantId: t, centroId: centroId(m.centro), productoId: P_(m.ref), tipo: m.tipo, cantidad: r3(m.cantidad), costeUnitario: r4(m.coste),
    documento: m.documentoFijo ?? (m.doc && m.campo ? (m.doc[m.campo] ?? null) : null), documentoId: m.doc?.id ?? null, motivo: motivoDe(m), usuarioId: m.usuario ?? null, createdAt: m.fecha,
  }));
  await enLotes(filasMov, 3000, (lote) => prisma.movimientoStock.createMany({ data: lote }));

  const negativos = [...stock.L, ...stock.O].filter(([, q]) => q < -0.001).length;
  console.log(
    `  cocina: ${Object.keys(PROVEEDORES).length} proveedores, ${ING.size} ingredientes, ${REC.size} elaborados, ${platosData.length} platos, ` +
      `${compras.length} compras, ${pedidos.length} pedidos al obrador, ${ordenes.length} órdenes (${lotes.length} lotes), ${mermas.length} mermas, ` +
      `${filasMov.length} movimientos${negativos ? `, ${negativos} productos con stock negativo` : ""}`,
  );
}
