/**
 * Parte «bebidas» del local Raza Pruebas (RZ-PRU).
 *
 * 1. Los 138 vinos de la carta real de Raza Madrid como productos de Bebidas (RZB-V…). Si el vino ya
 *    estaba entre las 103 bebidas de BODEGA 360 (semilla general) se reutiliza ese producto.
 * 2. 46 bebidas inventadas que la carta no trae (aguas, refrescos, zumos, cervezas de botella y
 *    barril, vermut, destilados para copas, café, infusiones y leche), RZB-B…, con sus proveedores.
 * 3. Ficha de vino de cada vino de la carta (bodega, D.O., uva, añada, capacidad, tipo, crianza y
 *    maridaje; tabla FichaVino del módulo Bebidas).
 * 4. Secciones de bebidas (área Bebidas) en la «Carta Raza Pruebas», que es del local RZ-PRU (no de toda
 *    la marca), con escandallo (botella = 1; caña = litros del barril; café = kilos) y formatos de venta:
 *    cada vino es UNA bebida con sus formatos (botella, copa de 15 cl = 0,2 botella, mágnum con su
 *    propio producto). Los generosos y dulces se venden solo por copa; diez vinos baratos también por copa
 *    (inventado); Malleolus y Mauro, en botella y en mágnum.
 * 5. Ocho semanas de movimiento hacia atrás desde ctx.hoy, simuladas día a día y en orden:
 *    - el obrador (OB, almacén central de vino y destilados) compra a los distribuidores los martes y
 *      recibe los jueves;
 *    - RZ-PRU pide al OB los lunes y jueves (pedido interno → servido con albarán ALB-S → recibido);
 *    - RZ-PRU compra directo cerveza, refrescos, aguas, zumos, café y leche según los días de reparto;
 *    - consumo diario del local (movimiento CONSUMO) = ventas estimadas de cada formato × escandallo
 *      (no hay TPV conectado: es la única forma de que el stock baje de forma creíble);
 *    - roturas y mermas con motivo (MER), inventario semanal del local los lunes y dos del obrador.
 *    La simulación se ejecuta dos veces con la misma semilla aleatoria: la primera solo cuenta los
 *    documentos para reservar los números (PL, ALB-S, PC, ALB-E, INV, MER) sin dejar huecos.
 *
 * Todo se escribe con createMany por lotes (la carga final va a una base en la nube). Si los vinos ya están
 * cargados no se repite nada; solo se completa lo que falte de una carga anterior (carta del local, área de
 * las secciones y fichas de vino), sin duplicar.
 * Datos inventados salvo los vinos y precios de la carta. Huecos detectados: docs/pruebas/huecos-bebidas.md
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../src/generated/prisma/client";
import { CODIGO_PRUEBAS, PREFIJO, type ContextoPruebas, type VinoCarta } from "./contexto";

// ---------------------------------------------------------------------------------------------
// Datos fijos
// ---------------------------------------------------------------------------------------------

/** Vinos de la carta que ya existen en BODEGA 360 (semilla general): nombre en la carta → referencia. */
const REUTILIZAR: Record<string, string> = {
  "Manzanilla La Pepa": "MAN-1547",
  "Fino Marismeño": "FIN-1604",
  "Amontillado N.P.U.": "AMO-1600",
  "Palo Cortado Regente": "PAL-1601",
  "Javier Sanz Verdejo": "RV-0005",
  "Isabel Arranz": "RV-0108",
  "La Val": "RV-0051",
  "Pazo San Mauro": "RV-0100",
  "Val Do Galir": "GAL-554",
  "Contino Blanco": "RV-0158",
  "Manuel Manzaneque Chardonnay": "RV-0057",
  "Chivite Colección 125 Chardonnay": "CHI-4443",
  Taittinger: "REF-1008",
  "Taittinger Prestige Rosé": "REF-1007",
  Bollinger: "BOL-909",
  "Paloma Mínguez": "REF-1013",
  "Chivite Las Fincas": "RV-0155",
  Bela: "RV-0039",
  Pruno: "CC-175",
  "Valquemao 13 meses": "RV-0028",
  "Emilio Moro": "RV-0163",
  "Pesquera Crianza": "RV-0069",
  Matarromera: "RV-0061",
  "Dominio de Elbio": "DOM-009",
  "Avelino Vegas 100 Aniversario": "RV-0038",
  "Vega Sicilia Único": "RV-0142",
  "Viña Salceda Crianza": "RV-0092",
  "La Montesa": "RV-0050",
  "Marqués de Murrieta Reserva": "RV-0090",
  "Marqués de Vargas Reserva": "RV-0007",
  "Contino Reserva": "RV-0159",
  "Viña Ardanza": "RV-0076",
  "Cuentaviñas Alomado": "fue-001",
  "Pacto Valdechuecas": "RV-0074",
  "Rioja Alta 904": "RV-0026",
  Macán: "RV-0006",
  "Contino Viña del Olivo": "RV-0044",
  "Rioja Alta 890": "RV-0025",
  Pintia: "RV-0139",
  "Juan Gil Etiqueta Plata": "RV-0134",
  "Pétalos del Bierzo": "RV-0070",
  "Pago el Espino": "RV-0124",
  Lalama: "LALA-234",
  Licinia: "RV-0182",
  "Alaya Tierra": "RV-0133",
  Supersónico: "RV-0115",
  Lakar: "RV-0132",
  "La Cerqueta": "RV-0116",
  "Jean León viña La Scala Gran Reserva": "RV-0032",
  "El Enemigo Cabernet Franc": "RV-0156",
  "Acero Chardonnay": "RV-0059",
  "Mas Cavalls Pinot Noir": "RV-0060",
  "Gran Enemigo Blend": "CC-171",
  "Pedro Ximénez Duquesa": "MAN-1552",
  "Graham’s 10 years old Tawny Port": "RV-0188",
};
/** Mágnum de la carta que ya existen en BODEGA 360. */
const REUTILIZAR_MAGNUM: Record<string, string> = { "Marqués de Murrieta": "RV-0178", Contino: "RV-0161" };

/** Distribuidores inventados (además de los de BODEGA 360). */
const PROVEEDORES_NUEVOS = [
  { nombre: "Distribuciones Hosteleras Arganzuela S.L.", cif: "B87654321", contacto: "Rocío", telefono: "+34910203040", email: "pedidos@dharganzuela.es", areas: ["BEBIDAS"], diasReparto: "Lunes y jueves", pedidoMinimo: 150, notas: "Aguas, refrescos y zumos. Pedido por WhatsApp antes de las 21:00 del día anterior." },
  { nombre: "Cervezas y Barriles Madrid Norte S.L.", cif: "B86543210", contacto: "Sergio", telefono: "+34911223344", email: "reparto@cbmadridnorte.es", areas: ["BEBIDAS"], diasReparto: "Martes y viernes", pedidoMinimo: 200, notas: "Cerveza de barril y botella. Recogen los barriles vacíos en cada reparto." },
  { nombre: "Cafés Tostadero Castellano S.L.", cif: "B85432109", contacto: "Marisa", telefono: "+34912334455", email: "hosteleria@tostaderocastellano.es", areas: ["BEBIDAS"], diasReparto: "Miércoles", pedidoMinimo: 100, notas: "Café en grano, infusiones y leche. Incluye mantenimiento de la cafetera." },
  { nombre: "Licores Selectos del Centro S.L.", cif: "B84321098", contacto: "Andrés", telefono: "+34913445566", email: "pedidos@licoresselectos.es", areas: ["BEBIDAS"], diasReparto: "Martes", pedidoMinimo: 250, notas: "Destilados y vermut para el almacén central." },
  { nombre: "Importaciones Grandes Pagos S.L.", cif: "B83210987", contacto: "Beatriz", telefono: "+34914556677", email: "beatriz@grandespagos.es", areas: ["BEBIDAS"], diasReparto: "Bajo pedido (48 h)", pedidoMinimo: null, notas: "Vinos del «Proyecto 100 puntos Parker»: solo bajo demanda, sin stock en el local." },
  { nombre: "Distribuidora de Vinos La Castellana S.L.", cif: "B82109876", contacto: "Óscar", telefono: "+34915667788", email: "oscar@vinoslacastellana.es", areas: ["BEBIDAS"], diasReparto: "Martes y jueves", pedidoMinimo: 180, notas: "Vinos de la tierra, Toro, Priorat y mágnum." },
] as const;
const P_REFRESCOS = PROVEEDORES_NUEVOS[0].nombre;
const P_CERVEZAS = PROVEEDORES_NUEVOS[1].nombre;
const P_CAFE = PROVEEDORES_NUEVOS[2].nombre;
const P_LICORES = PROVEEDORES_NUEVOS[3].nombre;
const P_GRANDES = PROVEEDORES_NUEVOS[4].nombre;
const P_CASTELLANA = PROVEEDORES_NUEVOS[5].nombre;

/** Familias de bebida que faltan en la semilla general (se crean si no están). */
const FAMILIAS_NUEVAS = ["Vinos rosados", "Vermut y aperitivos", "Cervezas", "Aguas, refrescos y zumos", "Cafetería"];

/** Días de reparto de los proveedores de compra directa del local (0 = domingo … 6 = sábado). */
const REPARTO_LOCAL: Record<string, number[]> = { [P_REFRESCOS]: [1, 4], [P_CERVEZAS]: [2, 5], [P_CAFE]: [3] };

type Origen = "OB" | "LOCAL";
interface DefProducto {
  clave: string;
  referencia: string;
  nombre: string;
  familia: string; // nombre de familia de BEBIDAS
  unidad: string;
  caja: number; // unidades por formato de compra
  coste: number;
  iva: number;
  proveedor: string;
  origen: Origen; // OB = el local lo pide al obrador; LOCAL = compra directa del local
  alergenos: string[];
  reutiliza?: string; // referencia de BODEGA 360
  precioCarta?: number; // para tramos de demanda
  bajoDemanda?: boolean;
}
/** Formato de venta de una bebida: parte del escandallo (o unidades de otro producto, el mágnum). */
interface DefFormato {
  nombre: string;
  precio: number;
  cantidad: number;
  clave?: string; // producto propio del formato (mágnum); vacío = el escandallo
  servPorSemana: number;
}
interface DefItem {
  seccion: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  ingredientes: [string, number][]; // clave de producto, cantidad por servicio
  alergenos: string[];
  etiquetas: string[];
  servPorSemana: number; // ventas estimadas por semana en RZ-PRU (sin formatos)
  formatos?: DefFormato[];
  magnumDe?: string; // mágnum que puede pasar a ser formato del vino en botella del mismo nombre
}

// [clave, nombre, familia, unidad, caja, coste, iva, proveedor, alérgenos]
type FilaOtra = [string, string, string, string, number, number, number, string, string[]];
const OTRAS: FilaOtra[] = [
  ["AG1", "Agua mineral Solán de Cabras 1 l vidrio", "Aguas, refrescos y zumos", "UD", 12, 0.62, 10, P_REFRESCOS, []],
  ["AG2", "Agua mineral Solán de Cabras 33 cl vidrio", "Aguas, refrescos y zumos", "UD", 24, 0.38, 10, P_REFRESCOS, []],
  ["AG3", "Agua con gas Vichy Catalán 30 cl", "Aguas, refrescos y zumos", "UD", 24, 0.72, 10, P_REFRESCOS, []],
  ["AG4", "Agua con gas San Pellegrino 75 cl", "Aguas, refrescos y zumos", "UD", 15, 1.15, 10, P_REFRESCOS, []],
  ["AG5", "Agua Acqua Panna 75 cl", "Aguas, refrescos y zumos", "UD", 15, 1.1, 10, P_REFRESCOS, []],
  ["RF1", "Coca-Cola 20 cl vidrio", "Aguas, refrescos y zumos", "UD", 24, 0.55, 10, P_REFRESCOS, []],
  ["RF2", "Coca-Cola Zero 20 cl vidrio", "Aguas, refrescos y zumos", "UD", 24, 0.55, 10, P_REFRESCOS, []],
  ["RF3", "Fanta Naranja 20 cl vidrio", "Aguas, refrescos y zumos", "UD", 24, 0.5, 10, P_REFRESCOS, []],
  ["RF4", "Fanta Limón 20 cl vidrio", "Aguas, refrescos y zumos", "UD", 24, 0.5, 10, P_REFRESCOS, []],
  ["RF5", "Sprite 20 cl vidrio", "Aguas, refrescos y zumos", "UD", 24, 0.5, 10, P_REFRESCOS, []],
  ["RF6", "Aquarius limón 25 cl", "Aguas, refrescos y zumos", "UD", 24, 0.62, 10, P_REFRESCOS, []],
  ["RF7", "Nestea 25 cl", "Aguas, refrescos y zumos", "UD", 24, 0.6, 10, P_REFRESCOS, []],
  ["RF8", "Tónica Fever-Tree 20 cl", "Aguas, refrescos y zumos", "UD", 24, 0.85, 10, P_REFRESCOS, []],
  ["RF9", "Tónica Schweppes 25 cl", "Aguas, refrescos y zumos", "UD", 24, 0.55, 10, P_REFRESCOS, []],
  ["RF10", "Ginger ale Fever-Tree 20 cl", "Aguas, refrescos y zumos", "UD", 24, 0.85, 10, P_REFRESCOS, []],
  ["RF11", "Bitter Kas 20 cl", "Aguas, refrescos y zumos", "UD", 24, 0.58, 10, P_REFRESCOS, []],
  ["ZU1", "Zumo de naranja Granini 20 cl", "Aguas, refrescos y zumos", "UD", 24, 0.7, 10, P_REFRESCOS, []],
  ["ZU2", "Zumo de tomate Granini 20 cl", "Aguas, refrescos y zumos", "UD", 24, 0.7, 10, P_REFRESCOS, ["APIO"]],
  ["ZU3", "Zumo de piña Granini 20 cl", "Aguas, refrescos y zumos", "UD", 24, 0.7, 10, P_REFRESCOS, []],
  ["CE1", "Mahou Cinco Estrellas barril 30 l", "Cervezas", "BARRIL", 1, 95, 21, P_CERVEZAS, ["GLUTEN"]],
  ["CE2", "Mahou Maestra Dobla Malta barril 20 l", "Cervezas", "BARRIL", 1, 78, 21, P_CERVEZAS, ["GLUTEN"]],
  ["CE3", "Alhambra Reserva 1925 33 cl", "Cervezas", "UD", 24, 0.85, 21, P_CERVEZAS, ["GLUTEN"]],
  ["CE4", "Mahou 0,0 Tostada 25 cl", "Cervezas", "UD", 24, 0.55, 21, P_CERVEZAS, ["GLUTEN"]],
  ["CE5", "Estrella Galicia 0,0 25 cl", "Cervezas", "UD", 24, 0.6, 21, P_CERVEZAS, ["GLUTEN"]],
  ["CE6", "Daura Damm sin gluten 33 cl", "Cervezas", "UD", 24, 0.95, 21, P_CERVEZAS, []],
  ["VE1", "Vermut Lustau rojo 75 cl", "Vermut y aperitivos", "BOTELLA", 1, 11.5, 21, P_LICORES, ["SULFITOS"]],
  ["VE2", "Vermut Martini Bianco 1 l", "Vermut y aperitivos", "BOTELLA", 1, 9.8, 21, P_LICORES, ["SULFITOS"]],
  ["DE1", "Ginebra Tanqueray London Dry 70 cl", "Destilados y licores", "BOTELLA", 1, 14.5, 21, P_LICORES, []],
  ["DE2", "Ginebra Hendrick's 70 cl", "Destilados y licores", "BOTELLA", 1, 24, 21, P_LICORES, []],
  ["DE3", "Ginebra Bombay Sapphire 70 cl", "Destilados y licores", "BOTELLA", 1, 15.5, 21, P_LICORES, []],
  ["DE4", "Ron Brugal Añejo 70 cl", "Destilados y licores", "BOTELLA", 1, 11, 21, P_LICORES, []],
  ["DE5", "Ron Zacapa 23 70 cl", "Destilados y licores", "BOTELLA", 1, 38, 21, P_LICORES, []],
  ["DE6", "Whisky Johnnie Walker Black Label 70 cl", "Destilados y licores", "BOTELLA", 1, 22, 21, P_LICORES, []],
  ["DE7", "Whisky The Macallan 12 Double Cask 70 cl", "Destilados y licores", "BOTELLA", 1, 48, 21, P_LICORES, []],
  ["DE8", "Whiskey Jameson 70 cl", "Destilados y licores", "BOTELLA", 1, 14, 21, P_LICORES, []],
  ["DE9", "Vodka Absolut 70 cl", "Destilados y licores", "BOTELLA", 1, 11.5, 21, P_LICORES, []],
  ["DE10", "Crema de whisky Baileys 70 cl", "Destilados y licores", "BOTELLA", 1, 12, 21, P_LICORES, ["LECHE"]],
  ["DE11", "Pacharán Zoco 70 cl", "Destilados y licores", "BOTELLA", 1, 9.5, 21, P_LICORES, []],
  ["DE12", "Licor de hierbas Ruavieja 70 cl", "Destilados y licores", "BOTELLA", 1, 9, 21, P_LICORES, []],
  ["CF1", "Café en grano mezcla hostelería 1 kg", "Cafetería", "KG", 1, 16.5, 10, P_CAFE, []],
  ["CF2", "Café descafeinado en grano 1 kg", "Cafetería", "KG", 1, 19, 10, P_CAFE, []],
  ["CF3", "Leche entera 1 l", "Cafetería", "L", 6, 0.85, 4, P_CAFE, ["LECHE"]],
  ["CF4", "Leche sin lactosa 1 l", "Cafetería", "L", 6, 1.05, 4, P_CAFE, ["LECHE"]],
  ["CF5", "Bebida de avena barista 1 l", "Cafetería", "L", 6, 1.6, 10, P_CAFE, ["GLUTEN"]],
  ["IN1", "Infusión manzanilla (caja 25 sobres)", "Cafetería", "CAJA", 1, 3.2, 10, P_CAFE, []],
  ["IN2", "Infusión poleo menta (caja 25 sobres)", "Cafetería", "CAJA", 1, 3.2, 10, P_CAFE, []],
  ["IN3", "Té negro English Breakfast (caja 25 sobres)", "Cafetería", "CAJA", 1, 4.5, 10, P_CAFE, []],
  ["IN4", "Té verde (caja 25 sobres)", "Cafetería", "CAJA", 1, 4.5, 10, P_CAFE, []],
];
/** Destilados de BODEGA 360 que se usan también para copas en RZ-PRU (clave → referencia). */
const DESTILADOS_REUTILIZADOS: Record<string, string> = { YZA: "REF-1023", BEL: "REF-1017", ROO: "REF-1018", BAR: "REF-1019", ORU: "FUE-10", CRO: "REF-1021" };

const GIN = 0.0714; // 5 cl de una botella de 70 cl
// [sección, nombre, descripción, precio, ingredientes, alérgenos, etiquetas, ventas por semana]
type FilaItem = [string, string, string | null, number, [string, number][], string[], string[], number];
const ITEMS_OTROS: FilaItem[] = [
  ["Aguas y refrescos", "Agua Solán de Cabras 1 l", null, 4.5, [["AG1", 1]], [], [], 110],
  ["Aguas y refrescos", "Agua Solán de Cabras 33 cl", null, 2.8, [["AG2", 1]], [], [], 55],
  ["Aguas y refrescos", "Vichy Catalán", null, 3.2, [["AG3", 1]], [], [], 28],
  ["Aguas y refrescos", "San Pellegrino 75 cl", null, 5.5, [["AG4", 1]], [], [], 22],
  ["Aguas y refrescos", "Acqua Panna 75 cl", null, 5.5, [["AG5", 1]], [], [], 18],
  ["Aguas y refrescos", "Coca-Cola", null, 3.6, [["RF1", 1]], [], [], 50],
  ["Aguas y refrescos", "Coca-Cola Zero", null, 3.6, [["RF2", 1]], [], [], 42],
  ["Aguas y refrescos", "Fanta Naranja", null, 3.6, [["RF3", 1]], [], [], 12],
  ["Aguas y refrescos", "Fanta Limón", null, 3.6, [["RF4", 1]], [], [], 8],
  ["Aguas y refrescos", "Sprite", null, 3.6, [["RF5", 1]], [], [], 6],
  ["Aguas y refrescos", "Aquarius", null, 3.8, [["RF6", 1]], [], [], 8],
  ["Aguas y refrescos", "Nestea", null, 3.8, [["RF7", 1]], [], [], 7],
  ["Aguas y refrescos", "Tónica Fever-Tree", null, 4.2, [["RF8", 1]], [], [], 8],
  ["Aguas y refrescos", "Tónica Schweppes", null, 3.6, [["RF9", 1]], [], [], 6],
  ["Aguas y refrescos", "Ginger ale Fever-Tree", null, 4.2, [["RF10", 1]], [], [], 4],
  ["Aguas y refrescos", "Bitter Kas", null, 3.6, [["RF11", 1]], [], [], 4],
  ["Aguas y refrescos", "Zumo de naranja", null, 3.8, [["ZU1", 1]], [], [], 10],
  ["Aguas y refrescos", "Zumo de tomate", null, 3.8, [["ZU2", 1]], ["APIO"], [], 7],
  ["Aguas y refrescos", "Zumo de piña", null, 3.8, [["ZU3", 1]], [], [], 5],
  ["Cervezas", "Caña Mahou Cinco Estrellas", "20 cl de barril", 3.5, [["CE1", 0.0067]], ["GLUTEN"], [], 230],
  ["Cervezas", "Doble Mahou Cinco Estrellas", "33 cl de barril", 4.8, [["CE1", 0.011]], ["GLUTEN"], [], 70],
  ["Cervezas", "Caña Mahou Maestra", "20 cl de barril", 4, [["CE2", 0.01]], ["GLUTEN"], [], 75],
  ["Cervezas", "Alhambra Reserva 1925", null, 4.8, [["CE3", 1]], ["GLUTEN"], [], 45],
  ["Cervezas", "Mahou 0,0 Tostada", null, 3.8, [["CE4", 1]], ["GLUTEN"], [], 14],
  ["Cervezas", "Estrella Galicia 0,0", null, 3.8, [["CE5", 1]], ["GLUTEN"], [], 10],
  ["Cervezas", "Daura Damm", "Sin gluten", 4.5, [["CE6", 1]], [], ["sin gluten"], 6],
  ["Vermut", "Vermut Yzaguirre rojo", "Con hielo, naranja y aceituna", 5, [["YZA", 0.08]], ["SULFITOS"], [], 30],
  ["Vermut", "Vermut Lustau rojo", "Con hielo y piel de naranja", 5.5, [["VE1", 0.107]], ["SULFITOS"], [], 14],
  ["Vermut", "Martini Bianco", null, 5, [["VE2", 0.08]], ["SULFITOS"], [], 8],
  ["Copas y destilados", "Gin tonic Tanqueray", "Con tónica Fever-Tree", 12, [["DE1", GIN], ["RF8", 1]], [], [], 38],
  ["Copas y destilados", "Gin tonic Hendrick's", "Con tónica Fever-Tree y pepino", 14, [["DE2", GIN], ["RF8", 1]], [], [], 26],
  ["Copas y destilados", "Gin tonic Bombay Sapphire", "Con tónica Schweppes", 12, [["DE3", GIN], ["RF9", 1]], [], [], 18],
  ["Copas y destilados", "Ron Brugal Añejo con refresco", null, 11, [["DE4", GIN], ["RF1", 1]], [], [], 12],
  ["Copas y destilados", "Ron Zacapa 23", "Solo o con hielo", 16, [["DE5", GIN]], [], [], 8],
  ["Copas y destilados", "Ron Barceló Blanco con refresco", null, 10, [["BAR", GIN], ["RF1", 1]], [], [], 6],
  ["Copas y destilados", "Whisky Johnnie Walker Black Label", null, 12, [["DE6", GIN]], [], [], 12],
  ["Copas y destilados", "Whisky The Macallan 12", null, 18, [["DE7", GIN]], [], [], 5],
  ["Copas y destilados", "Whiskey Jameson", null, 11, [["DE8", GIN]], [], [], 8],
  ["Copas y destilados", "Vodka Absolut con refresco", null, 11, [["DE9", GIN], ["RF5", 1]], [], [], 9],
  ["Copas y destilados", "Vodka Beluga", "Solo o con hielo", 14, [["BEL", GIN]], [], [], 3],
  ["Copas y destilados", "Tequila Rooster", null, 8, [["ROO", 0.0571]], [], [], 4],
  ["Copas y destilados", "Baileys", null, 7, [["DE10", GIN]], ["LECHE"], [], 6],
  ["Copas y destilados", "Pacharán Zoco", null, 6, [["DE11", GIN]], [], [], 10],
  ["Copas y destilados", "Licor de hierbas", null, 6, [["DE12", GIN]], [], [], 10],
  ["Copas y destilados", "Orujo blanco Pazo de Valdomiño", null, 6, [["ORU", GIN]], [], [], 5],
  ["Copas y destilados", "Crema de orujo Pazo de Valdomiño", null, 6, [["CRO", GIN]], ["LECHE"], [], 6],
  ["Cafés e infusiones", "Café solo", null, 2.2, [["CF1", 0.007]], [], [], 260],
  ["Cafés e infusiones", "Cortado", null, 2.3, [["CF1", 0.007], ["CF3", 0.03]], ["LECHE"], [], 160],
  ["Cafés e infusiones", "Café con leche", null, 2.6, [["CF1", 0.007], ["CF3", 0.12]], ["LECHE"], [], 120],
  ["Cafés e infusiones", "Café con leche sin lactosa", null, 2.6, [["CF1", 0.007], ["CF4", 0.12]], ["LECHE"], [], 25],
  ["Cafés e infusiones", "Café con bebida de avena", null, 2.9, [["CF1", 0.007], ["CF5", 0.12]], ["GLUTEN"], ["vegano"], 18],
  ["Cafés e infusiones", "Descafeinado de máquina", null, 2.4, [["CF2", 0.007]], [], [], 70],
  ["Cafés e infusiones", "Manzanilla", null, 2.5, [["IN1", 0.04]], [], [], 25],
  ["Cafés e infusiones", "Poleo menta", null, 2.5, [["IN2", 0.04]], [], [], 18],
  ["Cafés e infusiones", "Té negro", null, 2.8, [["IN3", 0.04]], [], [], 10],
  ["Cafés e infusiones", "Té verde", null, 2.8, [["IN4", 0.04]], [], [], 8],
];

/** Mermas del local y del obrador: [días atrás, centro, clave, cantidad, motivo, nota]. */
const MERMAS: [number, Origen, string, number, string, string][] = [
  [52, "LOCAL", "RF1", 2, "Rotura", "Caja golpeada en la descarga del proveedor"],
  [47, "LOCAL", "CE1", 0.08, "Desperdicio", "Purga y espuma al pinchar barril nuevo"],
  [44, "LOCAL", "V:Emilio Moro", 1, "Rotura", "Se cae una botella en la barra durante el servicio"],
  [40, "LOCAL", "ZU2", 3, "Caducidad", "Lote caducado al revisar la cámara de barra"],
  [37, "OB", "V:Taittinger", 1, "Rotura", "Rotura al colocar en el botellero del almacén"],
  [33, "LOCAL", "V:Paloma Mínguez", 1, "Invitación", "Botella de cava a la mesa 7 (cliente habitual, cumpleaños)"],
  [31, "LOCAL", "DE2", 0.07, "Error de cocina o barra", "Gin tonic devuelto: se sirvió con tónica equivocada"],
  [29, "LOCAL", "CF3", 2, "Caducidad", "Leche abierta sin rotular desde el día anterior"],
  [26, "LOCAL", "CE1", 0.1, "Desperdicio", "Final de barril con espuma"],
  [24, "LOCAL", "V:Bela", 1, "Otro", "Vino acorchado devuelto por el cliente: pedir abono al distribuidor"],
  [22, "LOCAL", "AG2", 6, "Consumo de personal", "Agua del personal en la jornada de inventario"],
  [19, "LOCAL", "DE11", 0.14, "Invitación", "Dos chupitos de pacharán a la mesa 15"],
  [17, "LOCAL", "DE1", 1, "Rotura", "Botella de Tanqueray rota al reponer la estantería de copas"],
  [15, "OB", "DE6", 1, "Rotura", "Caja mal apilada en el almacén central"],
  [12, "LOCAL", "CF5", 1, "Caducidad", "Brik abierto más de 5 días"],
  [10, "LOCAL", "CE1", 0.08, "Desperdicio", "Purga y espuma al pinchar barril nuevo"],
  [8, "LOCAL", "V:Viña Salceda Crianza", 1, "Rotura", "Rotura al abrir (botella con el cuello dañado)"],
  [6, "LOCAL", "CF1", 0.25, "Consumo de personal", "Cafés del personal de la semana"],
  [4, "LOCAL", "RF8", 3, "Rotura", "Tres botellines rotos en la cámara de barra"],
  [2, "LOCAL", "CE2", 0.06, "Error de cocina o barra", "Cañas tiradas mal al cambiar el grifo"],
];

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

const DIA = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Generador aleatorio con semilla (los datos salen iguales en cada carga). */
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
/** Número pseudoaleatorio fijo a partir de un texto (para costes y demanda de cada vino). */
function hash01(texto: string): number {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
function poisson(rnd: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rnd)));
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > l);
  return k - 1;
}
function normal(rnd: () => number): number {
  return Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
}
/** Suma días de calendario (respeta el cambio de hora de octubre y marzo). */
function masDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}
function a(fecha: Date, horas: number, minutos = 0): Date {
  const d = new Date(fecha);
  d.setHours(horas, minutos, 0, 0);
  return d;
}
/** «Semana 45 · 2026» (semana ISO), como el motor de inventarios. */
function nombreSemana(f: Date): string {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `Semana ${Math.ceil(((d.getTime() - inicio.getTime()) / DIA + 1) / 7)} · ${d.getUTCFullYear()}`;
}
const redondearA = (n: number, multiplo: number) => Math.ceil(n / multiplo - 1e-9) * multiplo;
function lotes<T>(lista: T[], tam = 1000): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < lista.length; i += tam) r.push(lista.slice(i, i + tam));
  return r;
}

// ---------------------------------------------------------------------------------------------
// Catálogo: vinos de la carta + resto de bebidas
// ---------------------------------------------------------------------------------------------

function familiaDeVino(v: VinoCarta): string {
  if (v.seccion === "Blancos" || /chardonnay/i.test(v.nombre)) return "Vinos blancos";
  if (v.seccion === "Espumosos") return "Espumosos y champán";
  if (v.seccion === "Rosados") return "Vinos rosados";
  if (/por copa/i.test(v.seccion)) return "Generosos y dulces";
  return "Vinos tintos";
}
function proveedorDeVino(v: VinoCarta, i: number): string {
  if (v.seccion.startsWith("Proyecto 100")) return P_GRANDES;
  if (v.seccion === "Espumosos") return "MIBIL GESTION S.L";
  if (v.seccion === "Tintos internacionales") return "VILA VINITECA";
  if (v.seccion === "Formato magnum") return P_CASTELLANA;
  if (/por copa/i.test(v.seccion)) return /oremo/i.test(v.nombre) ? "CALIDOSCOPI VINOS FINOS SLU" : "CAVINSA";
  if (v.do === "Rioja") return i % 2 ? "COMPAÑIA VINICOLA DEL NORTE S.A." : "LA RIOJA ALTA SA";
  if (v.do === "Ribera del Duero") return ["ASEUNIV SL", "DISTRIBUCIONES NAVARRO, S.A.", "VOLDISTRIBUTION MADRID SA"][i % 3];
  if (v.seccion === "Blancos") return "CAVINSA";
  return i % 2 ? P_CASTELLANA : "OROWINES SPAIN SL";
}
/** Ventas por semana estimadas de un vino según su precio (botellas; en las copas, copas). */
function ventasVino(v: VinoCarta, precio: number): number {
  if (v.anada && /Proyecto 100/.test(v.seccion)) return 0;
  if (v.formato === "copa") return /oremo/i.test(v.nombre) ? 3 : /graham/i.test(v.nombre) ? 6 : /ximénez/i.test(v.nombre) ? 8 : 12;
  const f = 0.5 + hash01(`demanda|${v.nombre}`);
  const base = v.formato === "magnum" ? 0.4 : precio <= 30 ? 6 : precio <= 40 ? 3.5 : precio <= 60 ? 1.6 : precio <= 100 ? 0.7 : precio <= 200 ? 0.25 : 0.08;
  return r2(base * f);
}
/** Parte de botella que lleva una copa de la carta de copas (generosos 7,5 cl de 75; Oremus 6 cl de 50). */
const copaDe = (v: VinoCarta) => (/oremo/i.test(v.nombre) ? 0.12 : 0.1);
/** Copa de 15 cl de una botella de 75 cl. */
const COPA_15 = 0.2;
/** Vinos en botella que además se venden por copa (inventado: los blancos, rosados y tintos de 30 € o menos). */
const porCopaTambien = (v: VinoCarta) => v.formato === "botella" && (v.precio ?? 99) <= 30 && !/Espumosos|Proyecto/.test(v.seccion);
const precioCopa = (botella: number) => Math.ceil(botella / 4.5 / 0.5) * 0.5;

/** Lo que va en la descripción del plato: solo notas de la carta (lo demás está en la ficha de vino). */
function descripcionVino(v: VinoCarta): string | null {
  const notas = (v as VinoCarta & { notas?: string | null }).notas;
  return notas && !/paréntesis|bajo demanda/i.test(notas) ? notas : null;
}

const MARIDAJE: Record<string, string> = {
  TINTO: "Carnes rojas a la parrilla y maduradas",
  BLANCO: "Entrantes, verduras, pescados y mariscos",
  ROSADO: "Aperitivo, ensaladas y arroces",
  ESPUMOSO: "Aperitivo, ibéricos, mariscos y celebraciones",
  GENEROSO: "Jamón, gildas, almendras y aperitivo",
  DULCE: "Postres de chocolate y quesos azules",
};

/** Ficha de vino a partir de la carta: tipo por sección, D.O. de la carta o de la sección, crianza por el nombre. */
function fichaDe(v: VinoCarta) {
  const tipo =
    v.seccion === "Blancos" || /chardonnay/i.test(v.nombre)
      ? "BLANCO"
      : v.seccion === "Espumosos"
        ? "ESPUMOSO"
        : v.seccion === "Rosados"
          ? "ROSADO"
          : v.seccion.startsWith("Generosos")
            ? "GENEROSO"
            : v.seccion.startsWith("Vinos dulces")
              ? "DULCE"
              : "TINTO";
  const porSeccion: Record<string, string> = { "Tintos Ribera del Duero": "Ribera del Duero", "Tintos Rioja": "Rioja", "Tintos Toro": "Toro" };
  const porSubseccion: Record<string, string> = { "A.O.C. Champagne": "Champagne", "Corpinnat y cava": "Corpinnat y cava", Rueda: "Rueda", "Rías Baixas": "Rías Baixas" };
  const crianza = /gran reserva/i.test(v.nombre) ? "Gran reserva" : /reserva/i.test(v.nombre) ? "Reserva" : /crianza/i.test(v.nombre) ? "Crianza" : /^(Manzanilla|Fino)/.test(v.nombre) ? "Biológica" : null;
  const anada = v.anada ? Number(v.anada) : null;
  return {
    bodega: v.bodega,
    denominacion: v.do ?? porSeccion[v.seccion] ?? (v.subseccion ? porSubseccion[v.subseccion] : undefined) ?? null,
    uva: v.uva ?? (/chardonnay/i.test(v.nombre) ? "Chardonnay" : /verdejo/i.test(v.nombre) ? "Verdejo" : /cabernet franc/i.test(v.nombre) ? "Cabernet franc" : /pinot noir/i.test(v.nombre) ? "Pinot noir" : null),
    anada: anada && Number.isInteger(anada) ? anada : null,
    capacidadCl: v.formato === "magnum" ? 150 : /oremo/i.test(v.nombre) ? 50 : 75,
    tipo: tipo as "TINTO" | "BLANCO" | "ROSADO" | "ESPUMOSO" | "GENEROSO" | "DULCE",
    crianza,
    notasCata: null,
    maridaje: MARIDAJE[tipo],
    argumentoVenta: /Proyecto 100/.test(v.seccion) ? "Vino de 100 puntos Parker: se pide al distribuidor con 48 h" : null,
  };
}

/** Clave y referencia de cada vino de la carta (la misma regla en la carga y al completar una carga anterior). */
function claveVino(v: VinoCarta) {
  return `V:${v.nombre}${v.formato === "magnum" ? " (mágnum)" : ""}`;
}
function referenciaVino(v: VinoCarta, i: number, existentes: Map<string, unknown>) {
  const ref = v.formato === "magnum" ? REUTILIZAR_MAGNUM[v.nombre] : REUTILIZAR[v.nombre];
  return ref && existentes.has(ref) ? ref : `${PREFIJO.bebida}V${String(i + 1).padStart(3, "0")}`;
}

/** Nombres de las secciones de bebidas de la carta (para marcarlas como del área Bebidas). */
function seccionesDeBebidas(ctx: ContextoPruebas): string[] {
  return Array.from(new Set([...ctx.carta.bebidas.map((v) => (v.subseccion ? `${v.seccion} · ${v.subseccion}` : v.seccion)), ...ITEMS_OTROS.map((i) => i[0])]));
}

/**
 * Completa, sin duplicar, lo que una carga anterior no tenía: la «Carta Raza Pruebas» pasa a ser del local
 * RZ-PRU (y sus platos también), sus secciones de bebidas son del área Bebidas y cada vino tiene su ficha.
 */
async function completarCargaAnterior(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const local = ctx.centroPruebas;
  const carta = await prisma.carta.findFirst({ where: { tenantId: t, marcaId: ctx.marcas.RAZA, nombre: "Carta Raza Pruebas" } });
  if (carta) {
    if (carta.centroId !== local) await prisma.carta.update({ where: { id: carta.id }, data: { centroId: local } });
    const nombres = seccionesDeBebidas(ctx);
    await prisma.cartaSeccion.updateMany({ where: { cartaId: carta.id, nombre: { in: nombres } }, data: { area: "BEBIDAS" } });
    await prisma.cartaPlato.updateMany({ where: { tenantId: t, centroId: null, lineas: { some: { seccion: { cartaId: carta.id } } } }, data: { centroId: local } });
    await prisma.cartaPlato.updateMany({ where: { tenantId: t, area: "COMIDAS", lineas: { some: { seccion: { cartaId: carta.id, nombre: { in: nombres } } } } }, data: { area: "BEBIDAS" } });
  }
  await sembrarFichasVino(prisma, ctx);
}

/** Ficha de vino de cada vino de la carta (si el producto ya la tiene, no se toca). */
async function sembrarFichasVino(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const refsReusadas = [...Object.values(REUTILIZAR), ...Object.values(REUTILIZAR_MAGNUM)];
  const existentes = new Map((await prisma.producto.findMany({ where: { tenantId: t, referencia: { in: refsReusadas } }, select: { referencia: true } })).map((p) => [p.referencia, p]));
  const refs = ctx.carta.bebidas.map((v, i) => referenciaVino(v, i, existentes));
  const ids = new Map((await prisma.producto.findMany({ where: { tenantId: t, referencia: { in: refs } }, select: { id: true, referencia: true } })).map((p) => [p.referencia, p.id]));
  const vistos = new Set<string>();
  const data = ctx.carta.bebidas.flatMap((v, i) => {
    const productoId = ids.get(refs[i]);
    if (!productoId || vistos.has(productoId)) return [];
    vistos.add(productoId);
    return [{ tenantId: t, productoId, ...fichaDe(v) }];
  });
  await prisma.fichaVino.createMany({ data, skipDuplicates: true });
}

// ---------------------------------------------------------------------------------------------
// Simulación de 8 semanas
// ---------------------------------------------------------------------------------------------

interface ProdSim {
  id: string;
  clave: string;
  nombre: string;
  familia: string;
  unidad: string;
  caja: number;
  coste: number;
  proveedorId: string | null;
  origen: Origen;
  entero: boolean; // se cuenta en unidades enteras (botellas cerradas)
  demandaSemana: number; // unidades de stock por semana en RZ-PRU
  minLocal: number;
  maxLocal: number;
  minOB: number;
  objetivoOB: number;
  precioCarta: number;
  bajoDemanda: boolean;
}
interface Mov {
  tenantId: string;
  centroId: string;
  productoId: string;
  tipo: "ENTRADA_COMPRA" | "SALIDA_PEDIDO" | "ENTRADA_PEDIDO" | "MERMA" | "AJUSTE_INVENTARIO" | "CONSUMO" | "CARGA_INICIAL";
  cantidad: number;
  costeUnitario: number;
  documento: string | null;
  documentoId: string | null;
  motivo: string | null;
  usuarioId: string | null;
  createdAt: Date;
}

/** Numerador de documentos: en la primera pasada cuenta; en la segunda da el número real. */
class Numerador {
  cuenta = new Map<string, number>(); // `${serie}|${anio}` → cuántos
  base = new Map<string, number>(); // `${serie}|${anio}` → último valor antes de esta parte
  siguiente(serie: string, fecha: Date): string {
    const anio = fecha.getFullYear();
    const k = `${serie}|${anio}`;
    const n = (this.cuenta.get(k) ?? 0) + 1;
    this.cuenta.set(k, n);
    return `${serie}-${anio}-${String((this.base.get(k) ?? 0) + n).padStart(6, "0")}`;
  }
}

interface Usuarios {
  economato: string | null;
  local: string | null;
  direccion: string | null;
}

function simular(
  t: string,
  ob: string,
  local: string,
  prods: ProdSim[],
  items: { ingredientes: [string, number][]; servPorSemana: number }[],
  stockInicial: Map<string, number>, // `${centroId}|${productoId}` → stock antes de la parte
  todosOB: { id: string; coste: number }[], // productos de bebida que cuenta el inventario del obrador
  proveedores: Record<string, string>,
  usuarios: Usuarios,
  hoy: Date,
  num: Numerador,
) {
  const rnd = aleatorio(20261114);
  const porClave = new Map(prods.map((p) => [p.clave, p]));
  const porId = new Map(prods.map((p) => [p.id, p]));
  const costeDe = new Map<string, number>(todosOB.map((p) => [p.id, p.coste]));
  for (const p of prods) costeDe.set(p.id, p.coste);
  const stock = new Map(stockInicial);
  const sk = (c: string, p: string) => `${c}|${p}`;
  const hay = (c: string, p: string) => stock.get(sk(c, p)) ?? 0;
  const movs: Mov[] = [];
  const mover = (m: Omit<Mov, "tenantId" | "costeUnitario"> & { costeUnitario?: number }) => {
    const cantidad = r3(m.cantidad);
    if (cantidad === 0) return;
    stock.set(sk(m.centroId, m.productoId), r3(hay(m.centroId, m.productoId) + cantidad));
    movs.push({ tenantId: t, ...m, cantidad, costeUnitario: r4(m.costeUnitario ?? costeDe.get(m.productoId) ?? 0) });
  };
  const stockCadena = (productoId: string) => hay(ob, productoId) + hay(local, productoId);

  const pedidos: Record<string, unknown>[] = [];
  const lineasPedido: Record<string, unknown>[] = [];
  const compras: Record<string, unknown>[] = [];
  const lineasCompra: Record<string, unknown>[] = [];
  const inventarios: Record<string, unknown>[] = [];
  const lineasInv: Record<string, unknown>[] = [];

  const inicio = a(masDias(hoy, -56), 0);
  const antes = (f: Date) => f.getTime() <= hoy.getTime();

  // --- Stock de partida (08:00 del primer día): RZ-PRU con su máximo y OB con lo de la carta nueva ---
  const fPartida = a(inicio, 8);
  for (const p of prods) {
    if (p.bajoDemanda) continue;
    const enLocal = r3(p.maxLocal - hay(local, p.id));
    if (enLocal > 0) mover({ centroId: local, productoId: p.id, tipo: "CARGA_INICIAL", cantidad: enLocal, documento: "Stock de partida", documentoId: null, motivo: "Recuento de partida al empezar con el ERP (Raza Pruebas)", usuarioId: usuarios.local, createdAt: fPartida });
    if (p.origen === "OB") {
      const enOB = r3(p.objetivoOB - hay(ob, p.id));
      if (enOB > 0) mover({ centroId: ob, productoId: p.id, tipo: "CARGA_INICIAL", cantidad: enOB, documento: "Stock de partida", documentoId: null, motivo: "Stock de partida de los vinos y destilados de la carta de Raza Pruebas", usuarioId: usuarios.economato, createdAt: fPartida });
    }
  }

  // Subida de tarifa de un distribuidor a mitad del periodo (para ver el coste medio moverse)
  const subida = new Set(prods.filter((p) => p.origen === "OB" && hash01(`subida|${p.clave}`) < 0.12).map((p) => p.id));

  // --- Compras pendientes de recibir: [fecha de llegada, compra, líneas] ---
  type CompraAbierta = { llega: Date; id: string; numero: string; centroId: string; parcial: boolean; lineas: { id: string; productoId: string; cantidad: number; precio: number }[]; albProv: string };
  const abiertas: CompraAbierta[] = [];
  let parcialHecha = false;

  const crearCompra = (centroId: string, proveedor: string, lineas: { productoId: string; cantidad: number; precio: number }[], creada: Date, enviada: Date, llega: Date, via: string, notas: string | null) => {
    const id = randomUUID();
    const numero = num.siguiente("PC", creada);
    const enviado = antes(enviada);
    compras.push({ id, tenantId: t, numero, area: "BEBIDAS", proveedorId: proveedores[proveedor], centroId, estado: enviado ? "ENVIADO" : "BORRADOR", enviadoPor: enviado ? via : null, enviadoEn: enviado ? enviada : null, recibidoEn: null, albaran: null, notas, createdAt: creada, updatedAt: enviado ? enviada : creada });
    const ls = lineas.map((l) => ({ id: randomUUID(), ...l }));
    for (const l of ls) lineasCompra.push({ id: l.id, pedidoId: id, productoId: l.productoId, cantidad: l.cantidad, recibida: null, precio: l.precio });
    if (enviado) abiertas.push({ llega, id, numero, centroId, parcial: false, lineas: ls, albProv: `${proveedor.slice(0, 3).toUpperCase()}-${String(Math.floor(rnd() * 90000) + 10000)}` });
  };
  const recibirCompra = (c: CompraAbierta) => {
    const compra = compras.find((x) => x.id === c.id)!;
    const albaran = num.siguiente("ALB-E", c.llega);
    // la compra más reciente del obrador llega incompleta (el distribuidor no tenía una referencia)
    const parcial = !parcialHecha && c.centroId === ob && c.lineas.length > 1 && c.llega.getTime() > hoy.getTime() - 7 * DIA;
    if (parcial) parcialHecha = true;
    c.lineas.forEach((l, i) => {
      const recibida = parcial && i === 0 ? Math.max(0, l.cantidad - Math.max(1, Math.round(l.cantidad / 2))) : l.cantidad;
      const linea = lineasCompra.find((x) => x.id === l.id)!;
      linea.recibida = recibida;
      if (recibida <= 0) return;
      // coste medio ponderado con el stock de toda la cadena (como recibirCompra del núcleo)
      const stockAntes = stockCadena(l.productoId);
      const costeAntes = costeDe.get(l.productoId) ?? 0;
      const costeNuevo = stockAntes <= 0 ? l.precio : r4((stockAntes * costeAntes + recibida * l.precio) / (stockAntes + recibida));
      mover({ centroId: c.centroId, productoId: l.productoId, tipo: "ENTRADA_COMPRA", cantidad: recibida, costeUnitario: l.precio, documento: albaran, documentoId: c.id, motivo: `Compra ${c.numero} · albarán del proveedor ${c.albProv}`, usuarioId: c.centroId === ob ? usuarios.economato : usuarios.local, createdAt: c.llega });
      costeDe.set(l.productoId, costeNuevo);
    });
    compra.estado = parcial ? "RECIBIDO_PARCIAL" : "RECIBIDO";
    compra.recibidoEn = c.llega;
    compra.updatedAt = c.llega;
    compra.albaran = albaran;
    compra.notas = [compra.notas, `Albarán del proveedor: ${c.albProv}`, parcial ? "Falta parte de la primera línea: el distribuidor no tenía existencias, la trae en el próximo reparto." : null].filter(Boolean).join("\n");
  };

  // --- Pedidos internos servidos y aún sin confirmar ---
  type PedidoAbierto = { id: string; numero: string; albaran: string; recibe: Date; lineas: { id: string; productoId: string; servida: number }[] };
  const porRecibir: PedidoAbierto[] = [];
  let roturaTransporte = false;

  const crearPedido = (creado: Date, sirve: Date | null, recibe: Date | null, lineas: { productoId: string; cantidad: number }[], notas: string | null, estadoForzado?: "PENDIENTE" | "CANCELADO") => {
    const id = randomUUID();
    const numero = num.siguiente("PL", creado);
    const p: Record<string, unknown> = { id, tenantId: t, numero, area: "BEBIDAS", origenId: ob, destinoId: local, estado: "PENDIENTE", notas, creadoPor: usuarios.local, servidoPor: null, servidoEn: null, albaran: null, createdAt: creado, updatedAt: creado };
    pedidos.push(p);
    const ls = lineas.map((l) => ({ id: randomUUID(), productoId: l.productoId, pedida: l.cantidad }));
    const filas = ls.map((l) => ({ id: l.id, pedidoId: id, productoId: l.productoId, pedida: l.pedida, servida: null as number | null, recibida: null as number | null, precio: r4(costeDe.get(l.productoId) ?? 0) }));
    lineasPedido.push(...filas);
    if (estadoForzado) {
      p.estado = estadoForzado;
      return;
    }
    if (!sirve || !antes(sirve)) return; // sigue PENDIENTE
    // servir: cada línea se limita al stock del obrador (como servirPedidoInterno)
    const albaran = num.siguiente("ALB-S", sirve);
    const servidas: { id: string; productoId: string; servida: number }[] = [];
    for (const f of filas) {
      const servida = r3(Math.min(f.pedida, Math.max(0, hay(ob, f.productoId))));
      f.servida = servida;
      f.precio = r4(costeDe.get(f.productoId) ?? 0);
      if (servida > 0) {
        const comun = { productoId: f.productoId, documento: albaran, documentoId: id, motivo: `Pedido ${numero}`, usuarioId: usuarios.economato, createdAt: sirve };
        mover({ ...comun, centroId: ob, tipo: "SALIDA_PEDIDO", cantidad: -servida });
        mover({ ...comun, centroId: local, tipo: "ENTRADA_PEDIDO", cantidad: servida });
      }
      servidas.push({ id: f.id, productoId: f.productoId, servida });
    }
    Object.assign(p, { estado: "SERVIDO", servidoPor: usuarios.economato, servidoEn: sirve, albaran, updatedAt: sirve });
    if (recibe) porRecibir.push({ id, numero, albaran, recibe, lineas: servidas });
  };
  const recibirPedido = (pa: PedidoAbierto) => {
    const p = pedidos.find((x) => x.id === pa.id)!;
    let nota: string | null = null;
    for (const l of pa.lineas) {
      const fila = lineasPedido.find((x) => x.id === l.id)!;
      let recibida = l.servida;
      const prod = porId.get(l.productoId);
      // una vez llega una botella rota en el transporte
      if (!roturaTransporte && prod?.entero && l.servida >= 2 && pa.recibe.getTime() > hoy.getTime() - 30 * DIA) {
        roturaTransporte = true;
        recibida = l.servida - 1;
        nota = `1 botella de ${prod.nombre} llega rota en el transporte`;
        mover({ centroId: local, productoId: l.productoId, tipo: "ENTRADA_PEDIDO", cantidad: -1, documento: pa.albaran, documentoId: pa.id, motivo: `Diferencia al recibir ${pa.numero}: ${nota}`, usuarioId: usuarios.local, createdAt: pa.recibe });
      }
      fila.recibida = recibida;
    }
    p.estado = "RECIBIDO";
    p.updatedAt = pa.recibe;
    if (nota) p.notas = [p.notas, `Recepción: ${nota}`].filter(Boolean).join("\n");
  };

  // --- Inventarios ---
  let inventarioGrande = false;
  const hacerInventario = (centroId: string, fecha: Date, nombre: string, abierto: boolean) => {
    const id = randomUUID();
    const numero = num.siguiente("INV", fecha);
    const lista =
      centroId === local
        ? prods.filter((p) => hay(local, p.id) !== 0 || p.minLocal > 0).map((p) => p.id)
        : todosOB.map((p) => p.id).filter((pid) => hay(ob, pid) !== 0 || (porId.get(pid)?.origen ?? "OB") === "OB");
    const filas = lista.map((pid) => {
      const teorico = r3(hay(centroId, pid));
      const p = porId.get(pid);
      let contado: number | null = teorico;
      if (p && !p.entero) {
        // botellas abiertas, barriles y café: se cuentan a ojo (décimas, cuartos de barril, medio kilo)
        const paso = p.unidad === "BARRIL" ? 0.25 : p.unidad === "KG" ? 0.5 : p.unidad === "L" || p.unidad === "UD" ? 1 : 0.1;
        contado = Math.max(0, r3(Math.round(teorico / paso) * paso));
      } else if (teorico > 0) {
        const x = rnd();
        if (x < 0.04) contado = teorico - 1; // falta una botella
        else if (x < 0.055) contado = teorico + 1; // aparece una que no estaba apuntada
      }
      if (abierto && rnd() < 0.45) contado = null; // recuento a medias
      return { pid, teorico, contado, coste: r4(costeDe.get(pid) ?? 0) };
    });
    // una semana falta vino caro: descuadre de más de 500 € que tiene que aprobar dirección
    if (!abierto && !inventarioGrande && centroId === local && fecha.getTime() < hoy.getTime() - 20 * DIA) {
      const caros = filas.filter((f) => f.teorico >= 1 && f.coste >= 40).sort((x, y) => y.coste - x.coste).slice(0, 4);
      const suma = caros.reduce((s, f) => s + f.coste, 0);
      if (suma > 500) {
        for (const f of caros) f.contado = f.teorico - 1;
        inventarioGrande = true;
      }
    }
    let descuadre = 0;
    for (const f of filas) if (f.contado !== null) descuadre += Math.abs(f.contado - f.teorico) * f.coste;
    const pendiente = !abierto && descuadre > 500;
    const cierre = new Date(fecha.getTime() + (pendiente ? 26 : 2) * 3600_000);
    inventarios.push({ id, tenantId: t, numero, area: "BEBIDAS", centroId, nombre, estado: abierto ? "ABIERTO" : "CERRADO", creadoPor: centroId === ob ? usuarios.economato : usuarios.local, cerradoPor: abierto ? null : pendiente ? usuarios.direccion : centroId === ob ? usuarios.economato : usuarios.local, cerradoEn: abierto ? null : cierre, createdAt: fecha });
    for (const f of filas) lineasInv.push({ id: randomUUID(), inventarioId: id, productoId: f.pid, teorico: f.teorico, contado: f.contado, coste: f.coste });
    if (abierto) return;
    // al cerrar: un ajuste por línea contada con diferencia (fecha del cierre)
    for (const f of filas) {
      if (f.contado === null) continue;
      const dif = r3(f.contado - f.teorico);
      if (dif !== 0) mover({ centroId, productoId: f.pid, tipo: "AJUSTE_INVENTARIO", cantidad: dif, costeUnitario: f.coste, documento: numero, documentoId: id, motivo: `Inventario ${nombre}`, usuarioId: pendiente ? usuarios.direccion : centroId === ob ? usuarios.economato : usuarios.local, createdAt: cierre });
    }
  };

  const mermasPorDia = new Map<number, (typeof MERMAS)[number][]>();
  for (const m of MERMAS) mermasPorDia.set(m[0], [...(mermasPorDia.get(m[0]) ?? []), m]);

  const productosDeProveedor = (nombre: string) => prods.filter((p) => p.origen === "LOCAL" && p.proveedorId === proveedores[nombre]);
  const lineasReparto = (prov: string) => {
    const lineas: { productoId: string; cantidad: number; precio: number }[] = [];
    for (const p of productosDeProveedor(prov)) {
      const deficit = p.maxLocal - hay(local, p.id);
      if (deficit < p.caja * 0.5 && !(p.caja === 1 && deficit >= 1)) continue;
      const cantidad = redondearA(deficit, p.caja);
      if (cantidad > 0) lineas.push({ productoId: p.id, cantidad, precio: p.coste });
    }
    return lineas;
  };

  // --- Bucle de días ---
  for (let d = 0; d <= 56; d++) {
    const dia = masDias(inicio, d);
    const diasAtras = 56 - d;
    const ds = dia.getDay(); // 0 domingo … 6 sábado

    // 09:30 y 10:00 llegadas de compras (local y obrador)
    for (const c of abiertas.filter((x) => x.llega.getTime() < masDias(dia, 1).getTime() && x.llega.getTime() >= dia.getTime()).sort((x, y) => x.llega.getTime() - y.llega.getTime())) {
      if (!antes(c.llega)) continue;
      recibirCompra(c);
      abiertas.splice(abiertas.indexOf(c), 1);
    }

    // 10:00 lunes: inventario semanal del local (el último, a medias y abierto)
    if (ds === 1 && d > 0 && antes(a(dia, 10))) {
      const esUltimo = hoy.getTime() - dia.getTime() < 7 * DIA;
      hacerInventario(local, a(dia, 10), nombreSemana(dia), esUltimo);
    }
    // inventario del almacén central (obrador) a las 4 y a las 2 semanas
    if ((diasAtras === 30 || diasAtras === 13) && antes(a(dia, 8))) hacerInventario(ob, a(dia, 8), `Bodega OB · ${dia.toLocaleDateString("es-ES", { month: "long" })} ${dia.getFullYear()}`, false);

    // martes 09:00: el obrador pide a los distribuidores lo que baja del mínimo (preparado el lunes a las 18:00)
    if (ds === 2 && antes(a(dia, 9))) {
      const porProveedor = new Map<string, { productoId: string; cantidad: number; precio: number }[]>();
      for (const p of prods) {
        if (p.origen !== "OB" || p.bajoDemanda || !p.proveedorId) continue;
        const s = hay(ob, p.id) + abiertas.filter((c) => c.centroId === ob).reduce((acc, c) => acc + c.lineas.filter((l) => l.productoId === p.id).reduce((x, l) => x + l.cantidad, 0), 0);
        if (s >= p.minOB) continue;
        const caja = p.precioCarta && p.precioCarta <= 60 ? 6 : 1;
        const cantidad = redondearA(Math.max(1, p.objetivoOB - s), caja);
        const base = p.coste;
        const precio = r4(subida.has(p.id) && diasAtras < 28 ? base * 1.06 : base);
        const nombreProv = Object.keys(proveedores).find((n) => proveedores[n] === p.proveedorId)!;
        porProveedor.set(nombreProv, [...(porProveedor.get(nombreProv) ?? []), { productoId: p.id, cantidad, precio }]);
      }
      for (const [prov, lineas] of porProveedor) crearCompra(ob, prov, lineas, a(masDias(dia, -1), 18), a(dia, 9), a(masDias(dia, 2), 10), "whatsapp", null);
    }

    // pedido bajo demanda: una reserva pide Opus One (el obrador lo compra, lo sirve y se vende)
    if (diasAtras === 23) {
      const opus = prods.find((p) => p.bajoDemanda && /opus one/i.test(p.nombre));
      if (opus) {
        crearCompra(ob, P_GRANDES, [{ productoId: opus.id, cantidad: 1, precio: opus.coste }], a(dia, 9, 30), a(dia, 9, 45), a(masDias(dia, 2), 10), "email", "Bajo demanda: reserva de la mesa 12 para el sábado (Raza Pruebas)");
      }
    }
    if (diasAtras === 21) {
      const opus = prods.find((p) => p.bajoDemanda && /opus one/i.test(p.nombre));
      if (opus) crearPedido(a(dia, 11), a(dia, 16), a(masDias(dia, 1), 11), [{ productoId: opus.id, cantidad: 1 }], "Bajo demanda: Opus One para la reserva de la mesa 12");
    }

    // lunes y jueves 12:00: RZ-PRU pide al obrador hasta su máximo; se sirve a las 17:00 y se confirma al día siguiente
    if ((ds === 1 || ds === 4) && antes(a(dia, 12))) {
      const lineas: { productoId: string; cantidad: number }[] = [];
      for (const p of prods) {
        if (p.origen !== "OB" || p.bajoDemanda) continue;
        const cantidad = Math.floor(p.maxLocal - hay(local, p.id) + 1e-9);
        if (cantidad >= 1) lineas.push({ productoId: p.id, cantidad });
      }
      if (lineas.length) crearPedido(a(dia, 12), a(dia, 17), a(masDias(dia, 1), 11), lineas, ds === 4 ? "Reposición para el fin de semana" : null);
      if (diasAtras === 35) crearPedido(a(dia, 12, 5), null, null, lineas.slice(0, 3), "Duplicado por error: se anula", "CANCELADO");
    }

    // mermas del día (16:00)
    for (const [, centro, clave, cantidad, motivo, nota] of mermasPorDia.get(diasAtras) ?? []) {
      const p = clave.startsWith("V:") ? prods.find((x) => x.clave === clave) : porClave.get(clave);
      const fecha = a(dia, 16);
      if (!p || !antes(fecha)) continue;
      const centroId = centro === "OB" ? ob : local;
      const q = Math.min(cantidad, hay(centroId, p.id));
      if (q <= 0) continue;
      mover({ centroId, productoId: p.id, tipo: "MERMA", cantidad: -q, documento: num.siguiente("MER", fecha), documentoId: null, motivo: `${motivo}: ${nota}`, usuarioId: centro === "OB" ? usuarios.economato : usuarios.local, createdAt: fecha });
    }

    // 17:00 servir pedidos ya hechos se hace dentro de crearPedido; 11:00 del día siguiente se confirman
    for (const pa of porRecibir.filter((x) => x.recibe.getTime() >= dia.getTime() && x.recibe.getTime() < masDias(dia, 1).getTime())) {
      if (!antes(pa.recibe)) continue;
      recibirPedido(pa);
      porRecibir.splice(porRecibir.indexOf(pa), 1);
    }

    // 20:00 compras directas del local para el reparto del día siguiente
    const manana = masDias(dia, 1);
    for (const prov of Object.keys(REPARTO_LOCAL)) {
      if (!REPARTO_LOCAL[prov].includes(manana.getDay())) continue;
      const lineas = lineasReparto(prov);
      const creada = a(dia, 20);
      if (!lineas.length || !antes(creada)) continue;
      crearCompra(local, prov, lineas, creada, creada, a(manana, 9, 30), prov === P_CAFE ? "telefono" : "whatsapp", null);
    }

    // venta bajo demanda del Opus One (sábado de la reserva)
    if (diasAtras === 19 && antes(a(dia, 23, 30))) {
      const opus = prods.find((p) => p.bajoDemanda && /opus one/i.test(p.nombre));
      if (opus && hay(local, opus.id) >= 1) mover({ centroId: local, productoId: opus.id, tipo: "CONSUMO", cantidad: -1, documento: null, documentoId: null, motivo: "Venta bajo demanda: mesa 12", usuarioId: null, createdAt: a(dia, 23, 30) });
    }

    // 23:30 consumo del día en el local: ventas estimadas × escandallo
    const fConsumo = a(dia, 23, 30);
    if (antes(fConsumo)) {
      const factor = ds === 5 || ds === 6 ? 1.45 : ds === 0 ? 1.1 : ds === 1 ? 0.6 : 0.85;
      const consumo = new Map<string, number>();
      for (const it of items) {
        const n = poisson(rnd, (it.servPorSemana / 7) * factor);
        if (n === 0) continue;
        for (const [clave, cant] of it.ingredientes) {
          const p = porClave.get(clave);
          if (p) consumo.set(p.id, (consumo.get(p.id) ?? 0) + n * cant);
        }
      }
      for (const [pid, q] of consumo) {
        const p = porId.get(pid)!;
        const disponible = Math.max(0, hay(local, pid));
        const sale = r3(Math.min(p.entero ? Math.round(q) : q, p.entero ? Math.floor(disponible) : disponible));
        if (sale > 0) mover({ centroId: local, productoId: pid, tipo: "CONSUMO", cantidad: -sale, documento: null, documentoId: null, motivo: "Ventas del día según escandallo (estimado: sin TPV conectado)", usuarioId: null, createdAt: fConsumo });
      }
    }
  }

  // Pedido a cada proveedor del local para su próximo reparto, ya enviado y sin recibir
  for (const prov of Object.keys(REPARTO_LOCAL)) {
    if (abiertas.some((c) => c.centroId === local && compras.find((x) => x.id === c.id)?.proveedorId === proveedores[prov])) continue;
    let llega = masDias(hoy, 1);
    while (!REPARTO_LOCAL[prov].includes(llega.getDay())) llega = masDias(llega, 1);
    const lineas = lineasReparto(prov);
    const enviada = new Date(hoy.getTime() - 3600_000);
    if (lineas.length) crearCompra(local, prov, lineas, enviada, enviada, a(llega, 9, 30), prov === P_CAFE ? "telefono" : "whatsapp", null);
  }

  // Estado de hoy: el último pedido servido queda sin confirmar y hay uno nuevo pendiente; un borrador de compra
  const ultimoServido = [...pedidos].reverse().find((p) => p.estado === "RECIBIDO" && lineasPedido.every((l) => l.pedidoId !== p.id || l.recibida === l.servida));
  if (ultimoServido) {
    Object.assign(ultimoServido, { estado: "SERVIDO", updatedAt: ultimoServido.servidoEn });
    for (const l of lineasPedido) if (l.pedidoId === ultimoServido.id) l.recibida = null;
  }
  const espumosos = prods.filter((p) => p.origen === "OB" && !p.bajoDemanda && p.familia.startsWith("Espumosos")).slice(0, 4);
  const paraPendiente = (espumosos.length ? espumosos : prods.filter((p) => p.origen === "OB" && !p.bajoDemanda).slice(0, 4)).map((p) => ({ productoId: p.id, cantidad: 2 }));
  crearPedido(new Date(hoy.getTime() - 2 * 3600_000), null, null, paraPendiente, "Refuerzo de espumosos: grupo de 20 personas mañana", "PENDIENTE");
  const borrador = prods.filter((p) => p.origen === "OB" && p.proveedorId === proveedores[P_LICORES]).slice(0, 5);
  if (borrador.length) crearCompra(ob, P_LICORES, borrador.map((p) => ({ productoId: p.id, cantidad: 6, precio: p.coste })), new Date(hoy.getTime() - 3600_000), new Date(hoy.getTime() + DIA), new Date(hoy.getTime() + 3 * DIA), "whatsapp", "Propuesta de compra de destilados: revisar antes de enviar");

  return { movs, pedidos, lineasPedido, compras, lineasCompra, inventarios, lineasInv, costeDe };
}

// ---------------------------------------------------------------------------------------------
// Parte «bebidas»
// ---------------------------------------------------------------------------------------------

export async function sembrar(prisma: PrismaClient, ctx: ContextoPruebas) {
  const t = ctx.tenantId;
  const local = ctx.centroPruebas;
  const ob = ctx.centros.OB;
  if (!ob) throw new Error("No existe el obrador (OB): carga antes la semilla general");
  if (await prisma.producto.findFirst({ where: { tenantId: t, referencia: { startsWith: `${PREFIJO.bebida}V` } }, select: { id: true } })) {
    await completarCargaAnterior(prisma, ctx);
    console.log("Bebidas de Raza Pruebas ya cargadas: no se repiten (solo se completan carta del local, áreas y fichas de vino)");
    return;
  }

  // --- Usuarios que firman los documentos ---
  const [economato, direccion, admin] = await Promise.all(
    ["economato@erp.local", "direccion@erp.local", "admin@erp.local"].map((email) => prisma.usuario.findFirst({ where: { tenantId: t, email }, select: { id: true } })),
  );
  const usuarioLocal = await prisma.usuarioCentro.findFirst({ where: { centroId: local, usuario: { activo: true } }, select: { usuarioId: true } });
  const usuarios: Usuarios = { economato: economato?.id ?? admin?.id ?? null, direccion: direccion?.id ?? admin?.id ?? null, local: usuarioLocal?.usuarioId ?? admin?.id ?? null };

  // --- Proveedores y familias que faltan ---
  await prisma.proveedor.createMany({
    data: PROVEEDORES_NUEVOS.map((p) => ({ tenantId: t, ...p, areas: [...p.areas] as ("BEBIDAS")[] })),
    skipDuplicates: true,
  });
  const proveedores: Record<string, string> = Object.fromEntries((await prisma.proveedor.findMany({ where: { tenantId: t }, select: { id: true, nombre: true } })).map((p) => [p.nombre, p.id]));
  const ordenMax = (await prisma.familiaProducto.aggregate({ where: { tenantId: t, area: "BEBIDAS" }, _max: { orden: true } }))._max.orden ?? 0;
  await prisma.familiaProducto.createMany({ data: FAMILIAS_NUEVAS.map((nombre, i) => ({ tenantId: t, area: "BEBIDAS" as const, nombre, orden: ordenMax + 1 + i })), skipDuplicates: true });
  const familias: Record<string, string> = Object.fromEntries((await prisma.familiaProducto.findMany({ where: { tenantId: t, area: "BEBIDAS" } })).map((f) => [f.nombre, f.id]));

  // --- Productos de BODEGA 360 que se reutilizan ---
  const refsReusadas = [...Object.values(REUTILIZAR), ...Object.values(REUTILIZAR_MAGNUM), ...Object.values(DESTILADOS_REUTILIZADOS)];
  const existentes = new Map((await prisma.producto.findMany({ where: { tenantId: t, referencia: { in: refsReusadas } } })).map((p) => [p.referencia, p]));

  // --- Definición del catálogo ---
  const defs: DefProducto[] = [];
  const items: DefItem[] = [];
  ctx.carta.bebidas.forEach((v, i) => {
    const clave = claveVino(v);
    const precioBotella = v.precio ?? (v.precio_copa ? r2(v.precio_copa / copaDe(v)) : 30);
    const reusado = existentes.get(referenciaVino(v, i, existentes));
    const coste = reusado ? Number(reusado.costeUnitario) : r2(precioBotella * (0.3 + 0.1 * hash01(`coste|${v.nombre}`)));
    const bajoDemanda = /Proyecto 100/.test(v.seccion);
    const nombre = v.formato === "magnum" ? `${v.nombre} mágnum 1,5 l` : /oremo/i.test(v.nombre) ? `${v.nombre} 50 cl` : v.nombre;
    defs.push({
      clave,
      referencia: reusado?.referencia ?? `${PREFIJO.bebida}V${String(i + 1).padStart(3, "0")}`,
      nombre: reusado?.nombre ?? nombre,
      familia: familiaDeVino(v),
      unidad: "BOTELLA",
      caja: 6,
      coste,
      iva: 21,
      proveedor: proveedorDeVino(v, i),
      origen: "OB",
      alergenos: ["SULFITOS"],
      reutiliza: reusado?.referencia,
      precioCarta: precioBotella,
      bajoDemanda,
    });
    const claveProducto = defs[defs.length - 1].clave;
    const seccion = v.subseccion ? `${v.seccion} · ${v.subseccion}` : v.seccion;
    const ventas = ventasVino(v, precioBotella);
    // Una bebida por vino; el escandallo es la botella entera y cada formato dice qué parte se vende
    const formatos: DefFormato[] =
      v.formato === "copa"
        ? [{ nombre: "Copa", precio: v.precio_copa ?? 0, cantidad: copaDe(v), servPorSemana: ventas }]
        : v.formato === "magnum"
          ? [{ nombre: "Mágnum", precio: v.precio ?? 0, cantidad: 1, servPorSemana: ventas }]
          : [
              { nombre: "Botella", precio: v.precio ?? 0, cantidad: 1, servPorSemana: ventas },
              ...(porCopaTambien(v) ? [{ nombre: "Copa", precio: precioCopa(v.precio ?? 0), cantidad: COPA_15, servPorSemana: 10 }] : []),
            ];
    items.push({
      seccion,
      nombre: v.nombre,
      descripcion: descripcionVino(v),
      precio: formatos[0].precio,
      ingredientes: [[claveProducto, 1]],
      alergenos: ["SULFITOS"],
      etiquetas: bajoDemanda ? ["bajo demanda"] : [],
      servPorSemana: 0,
      formatos,
      magnumDe: v.formato === "magnum" ? v.nombre : undefined,
    });
  });
  // El mágnum de un vino que también está en botella (Malleolus, Mauro) es un formato de esa bebida, no otra
  for (const m of items.filter((x) => x.magnumDe)) {
    const botella = items.find((x) => !x.magnumDe && x.nombre === m.magnumDe && x.formatos?.some((f) => f.nombre === "Botella"));
    if (!botella) continue;
    botella.formatos!.push({ nombre: "Mágnum", precio: m.precio, cantidad: 1, clave: m.ingredientes[0][0], servPorSemana: m.formatos![0].servPorSemana });
    items.splice(items.indexOf(m), 1);
  }
  for (const [clave, nombre, familia, unidad, caja, coste, iva, proveedor, alergenos] of OTRAS) {
    const origen: Origen = proveedor === P_LICORES ? "OB" : "LOCAL";
    defs.push({ clave, referencia: `${PREFIJO.bebida}B${clave}`, nombre, familia, unidad, caja, coste, iva, proveedor, origen, alergenos });
  }
  for (const [clave, ref] of Object.entries(DESTILADOS_REUTILIZADOS)) {
    const p = existentes.get(ref);
    if (!p) continue;
    defs.push({ clave, referencia: ref, nombre: p.nombre, familia: clave === "YZA" ? "Vermut y aperitivos" : "Destilados y licores", unidad: "BOTELLA", caja: 1, coste: Number(p.costeUnitario), iva: 21, proveedor: P_LICORES, origen: "OB", alergenos: clave === "YZA" ? ["SULFITOS"] : clave === "CRO" ? ["LECHE"] : [], reutiliza: ref });
  }
  for (const [seccion, nombre, descripcion, precio, ingredientes, alergenos, etiquetas, serv] of ITEMS_OTROS) items.push({ seccion, nombre, descripcion, precio, ingredientes, alergenos, etiquetas, servPorSemana: serv });

  // lo que se vende de verdad: cada formato con su parte del escandallo (o su producto propio)
  const itemsSim = items.flatMap((it) =>
    it.formatos
      ? it.formatos.map((f) => ({ ingredientes: (f.clave ? [[f.clave, f.cantidad]] : it.ingredientes.map(([c, q]) => [c, r4(q * f.cantidad)])) as [string, number][], servPorSemana: f.servPorSemana }))
      : [{ ingredientes: it.ingredientes, servPorSemana: it.servPorSemana }],
  );
  // demanda semanal de cada producto en RZ-PRU (ventas × escandallo)
  const demanda = new Map<string, number>();
  for (const it of itemsSim) for (const [clave, q] of it.ingredientes) demanda.set(clave, (demanda.get(clave) ?? 0) + it.servPorSemana * q);

  // --- Alta de productos nuevos y ajustes de los reutilizados ---
  const nuevos = defs.filter((d) => !d.reutiliza);
  const minimoGeneral = (d: DefProducto) => {
    const dem = demanda.get(d.clave) ?? 0;
    if (d.bajoDemanda || d.origen === "LOCAL") return 0;
    if ((d.precioCarta ?? 0) > 150) return 1;
    return Math.max(2, Math.ceil(dem * 1.5));
  };
  await prisma.producto.createMany({
    data: nuevos.map((d) => ({
      tenantId: t,
      area: "BEBIDAS" as const,
      familiaId: familias[d.familia] ?? familias.Otros ?? null,
      referencia: d.referencia,
      nombre: d.nombre,
      unidad: d.unidad,
      unidadesCompra: d.caja,
      costeUnitario: d.coste,
      iva: d.iva,
      stockMinimo: minimoGeneral(d),
      proveedorId: proveedores[d.proveedor] ?? null,
    })),
    skipDuplicates: true,
  });
  // Macán es un tinto de Rioja y Yzaguirre un vermut: la semilla general los dejó en «Destilados y licores»
  await prisma.producto.updateMany({ where: { tenantId: t, referencia: "RV-0006" }, data: { familiaId: familias["Vinos tintos"] } });
  await prisma.producto.updateMany({ where: { tenantId: t, referencia: "REF-1023" }, data: { familiaId: familias["Vermut y aperitivos"] } });
  // los reutilizados sin proveedor (en BODEGA 360 estaba vacío) toman el que les toca por la carta
  for (const d of defs.filter((x) => x.reutiliza && !existentes.get(x.reutiliza)?.proveedorId))
    await prisma.producto.updateMany({ where: { tenantId: t, referencia: d.reutiliza }, data: { proveedorId: proveedores[d.proveedor] } });

  const productos = await prisma.producto.findMany({ where: { tenantId: t, area: "BEBIDAS" }, select: { id: true, referencia: true, costeUnitario: true, proveedorId: true, activo: true } });
  const idPorRef = new Map(productos.map((p) => [p.referencia, p]));

  // --- Parámetros de simulación por producto ---
  const sims: ProdSim[] = defs.map((d) => {
    const p = idPorRef.get(d.referencia)!;
    const dem = demanda.get(d.clave) ?? 0;
    const entero = d.unidad === "BOTELLA" ? d.familia.startsWith("Vinos") || d.familia.startsWith("Espumosos") : d.unidad === "UD";
    let minLocal = 0;
    let maxLocal = 0;
    if (!d.bajoDemanda) {
      if (d.origen === "OB") {
        // dos pedidos por semana al obrador
        minLocal = d.precioCarta && d.precioCarta > 300 ? 1 : Math.max(1, Math.ceil(dem * 0.6));
        maxLocal = d.precioCarta && d.precioCarta > 300 ? 1 : Math.max(2, Math.ceil(dem * 1.2) + 1);
        if (/por copa/.test(d.familia) || d.familia === "Generosos y dulces" || d.familia.startsWith("Destilados") || d.familia.startsWith("Vermut")) {
          minLocal = 1;
          maxLocal = Math.max(2, Math.ceil(dem * 0.8) + 1);
        }
      } else {
        const repartos = REPARTO_LOCAL[d.proveedor]?.length ?? 1;
        const porReparto = dem / repartos;
        minLocal = d.caja > 1 ? Math.ceil(porReparto * 0.5) : Math.max(1, Math.ceil(porReparto * 0.5));
        maxLocal = redondearA(porReparto * 1.3 + minLocal, d.caja);
      }
    }
    const minOB = minimoGeneral(d);
    const caro = (d.precioCarta ?? 0) > 150;
    const objetivoOB = d.origen !== "OB" || d.bajoDemanda ? 0 : caro ? 2 : redondearA(Math.max(minOB + 2, dem * 3), (d.precioCarta ?? 0) <= 60 && d.familia.startsWith("Vin") ? 6 : 1);
    return {
      id: p.id,
      clave: d.clave,
      nombre: d.nombre,
      familia: d.familia,
      unidad: d.unidad,
      caja: d.caja,
      coste: Number(p.costeUnitario),
      proveedorId: p.proveedorId,
      origen: d.origen,
      entero,
      demandaSemana: dem,
      minLocal,
      maxLocal,
      minOB,
      objetivoOB,
      precioCarta: d.precioCarta ?? 0,
      bajoDemanda: !!d.bajoDemanda,
    };
  });

  // --- Ajustes por centro: mínimo y máximo en RZ-PRU; lo que no está en la carta, desactivado para el local ---
  const enCarta = new Set(sims.map((s) => s.id));
  await prisma.productoCentro.createMany({
    data: [
      ...sims.map((s) => ({ productoId: s.id, centroId: local, activo: true, minimo: s.minLocal > 0 ? s.minLocal : null, maximo: s.maxLocal > 0 ? s.maxLocal : null })),
      ...productos.filter((p) => !enCarta.has(p.id)).map((p) => ({ productoId: p.id, centroId: local, activo: false })),
      // lo que el local compra directo no lo maneja el almacén central
      ...sims.filter((s) => s.origen === "LOCAL").map((s) => ({ productoId: s.id, centroId: ob, activo: false })),
    ],
    skipDuplicates: true,
  });

  // --- Alérgenos de cada bebida (los usan los escandallos de la carta) ---
  await prisma.cartaAlergenoProducto.createMany({
    data: defs.filter((d) => d.alergenos.length).map((d) => ({ tenantId: t, productoId: idPorRef.get(d.referencia)!.id, alergenos: d.alergenos, trazas: [] })),
    skipDuplicates: true,
  });

  // --- Stock de partida (lo que ya hay en OB y RZ-PRU) ---
  const filasStock = await prisma.movimientoStock.groupBy({ by: ["centroId", "productoId"], where: { tenantId: t, centroId: { in: [ob, local] }, producto: { area: "BEBIDAS" } }, _sum: { cantidad: true } });
  const stockInicial = new Map(filasStock.map((f) => [`${f.centroId}|${f.productoId}`, Number(f._sum.cantidad ?? 0)]));
  const todosOB = productos.filter((p) => p.activo).map((p) => ({ id: p.id, coste: Number(p.costeUnitario) }));
  const sinOB = new Set(sims.filter((s) => s.origen === "LOCAL").map((s) => s.id));
  const todosOBContables = todosOB.filter((p) => !sinOB.has(p.id));

  // --- Simulación en dos pasadas: contar documentos, reservar números, generar ---
  const conteo = new Numerador();
  simular(t, ob, local, sims, itemsSim, stockInicial, todosOBContables, proveedores, usuarios, ctx.hoy, conteo);
  const numerador = new Numerador();
  for (const [k, n] of conteo.cuenta) {
    const [serie, anio] = k.split("|");
    const c = await prisma.contador.upsert({
      where: { tenantId_serie_anio: { tenantId: t, serie, anio: Number(anio) } },
      create: { tenantId: t, serie, anio: Number(anio), valor: n },
      update: { valor: { increment: n } },
    });
    numerador.base.set(k, c.valor - n);
  }
  const r = simular(t, ob, local, sims, itemsSim, stockInicial, todosOBContables, proveedores, usuarios, ctx.hoy, numerador);

  // --- Escritura por lotes ---
  for (const l of lotes(r.pedidos)) await prisma.pedidoInterno.createMany({ data: l as never });
  for (const l of lotes(r.lineasPedido)) await prisma.pedidoInternoLinea.createMany({ data: l as never });
  for (const l of lotes(r.compras)) await prisma.pedidoCompra.createMany({ data: l as never });
  for (const l of lotes(r.lineasCompra)) await prisma.pedidoCompraLinea.createMany({ data: l as never });
  for (const l of lotes(r.inventarios)) await prisma.inventario.createMany({ data: l as never });
  for (const l of lotes(r.lineasInv)) await prisma.inventarioLinea.createMany({ data: l as never });
  for (const l of lotes(r.movs, 2000)) await prisma.movimientoStock.createMany({ data: l });
  // coste medio que ha cambiado con las compras
  for (const s of sims) {
    const nuevo = r.costeDe.get(s.id);
    if (nuevo !== undefined && Math.abs(nuevo - s.coste) > 0.00005) await prisma.producto.update({ where: { id: s.id }, data: { costeUnitario: nuevo } });
  }

  // --- Fichas de vino ---
  await sembrarFichasVino(prisma, ctx);

  // --- Carta de bebidas («Carta Raza Pruebas», marca Raza, solo del local RZ-PRU) ---
  const marcaId = ctx.marcas.RAZA;
  let carta = await prisma.carta.findFirst({ where: { tenantId: t, marcaId, nombre: "Carta Raza Pruebas" } });
  if (!carta) carta = await prisma.carta.create({ data: { tenantId: t, marcaId, centroId: local, nombre: "Carta Raza Pruebas", tipo: "PERMANENTE" } });
  else if (carta.centroId !== local) carta = await prisma.carta.update({ where: { id: carta.id }, data: { centroId: local } });
  const ordenSeccion = (await prisma.cartaSeccion.aggregate({ where: { cartaId: carta.id }, _max: { orden: true } }))._max.orden ?? 0;
  const nombresSeccion = Array.from(new Set(items.map((i) => i.seccion)));
  const secciones = nombresSeccion.map((nombre, i) => ({ id: randomUUID(), cartaId: carta!.id, area: "BEBIDAS" as const, nombre, orden: ordenSeccion + 1 + i }));
  const idSeccion = new Map(secciones.map((s) => [s.nombre, s.id]));
  const idProducto = new Map(defs.map((d) => [d.clave, idPorRef.get(d.referencia)!.id]));
  const platos = items.map((it) => ({ id: randomUUID(), it }));
  await prisma.cartaSeccion.createMany({ data: secciones });
  await prisma.cartaPlato.createMany({
    data: platos.map(({ id, it }) => ({
      id,
      tenantId: t,
      marcaId,
      centroId: local,
      area: "BEBIDAS" as const,
      nombre: it.nombre,
      descripcion: it.descripcion,
      precio: it.precio,
      iva: 10,
      alergenos: it.alergenos,
      trazas: [],
      alergenosRevisados: true,
      etiquetas: it.etiquetas,
    })),
  });
  await prisma.cartaPlatoIngrediente.createMany({
    data: platos.flatMap(({ id, it }) => it.ingredientes.map(([clave, cantidad], i) => ({ platoId: id, productoId: idProducto.get(clave)!, cantidad, mermaPct: 0, orden: i + 1 }))),
  });
  await prisma.cartaPlatoFormato.createMany({
    data: platos.flatMap(({ id, it }) =>
      (it.formatos ?? []).map((f, i) => ({ platoId: id, nombre: f.nombre, precio: f.precio, cantidad: f.cantidad, productoId: f.clave ? idProducto.get(f.clave)! : null, orden: i + 1 })),
    ),
  });
  const ordenEn = new Map<string, number>();
  await prisma.cartaLinea.createMany({
    data: platos.map(({ id, it }) => {
      const o = (ordenEn.get(it.seccion) ?? 0) + 1;
      ordenEn.set(it.seccion, o);
      return { seccionId: idSeccion.get(it.seccion)!, platoId: id, orden: o };
    }),
  });

  const resumen = {
    vinos: ctx.carta.bebidas.length,
    reutilizados: defs.filter((d) => d.reutiliza).length,
    productosNuevos: nuevos.length,
    platosCarta: platos.length,
    formatos: platos.reduce((s, p) => s + (p.it.formatos?.length ?? 0), 0),
    pedidosInternos: r.pedidos.length,
    compras: r.compras.length,
    inventarios: r.inventarios.length,
    movimientos: r.movs.length,
  };
  console.log(`Bebidas ${CODIGO_PRUEBAS}: ${JSON.stringify(resumen)}`);
}
