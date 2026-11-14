/**
 * Datos iniciales SOLO PARA DESARROLLO (base local erp_dev).
 * Organización de Grupo Raza tomada de specs/01_negocio_grupo.md y 103 productos de bebida
 * vistos en BODEGA 360 el 08/11/2026 (stock y coste redondeados del panel: son de ejemplo).
 * Cada módulo añade sus datos en prisma/semillas/<modulo>.ts (función sembrar).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PrismaNode, Prisma } from "../src/generated/prisma-node/client";
import type { PrismaClient } from "../src/generated/prisma/client";
import { SEMILLAS_MODULOS } from "./semillas";

// Los scripts usan el cliente en modo Node; se presenta con el tipo del cliente de la app
const prisma = new PrismaNode({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) }) as unknown as PrismaClient;

const MODULOS_CONTRATADOS = ["bebidas", "comidas", "obrador", "caja", "personal", "contabilidad", "cuadro", "calidad", "reservas", "eventos", "clientes", "webs"];

const SOCIEDADES = [
  { clave: "GUELU", razonSocial: "El Güelu Madrid S.L.", cif: "B88600374" },
  { clave: "INNOGAMA", razonSocial: "Inversiones Innogama S.L.", cif: "B83351007" },
  { clave: "KIEV", razonSocial: "Kiev Empresarial S.L.", cif: "B72775299" },
  { clave: "IHA", razonSocial: "Inversiones Hispano Argentinas 2021 S.L.", cif: "B06884837" },
  { clave: "PUCHERO", razonSocial: "El Puchero de Chamartín S.L.", cif: "B85411007" },
  { clave: "PENDIENTE", razonSocial: "Sociedad por confirmar", cif: "PENDIENTE" },
];

const MARCAS = [
  { clave: "VACA", nombre: "La Vaca Argentina", concepto: "Parrilla argentina desde 1994", web: "lavacaargentina.com", instagram: "@parrillavacaargentina", colorPrincipal: "#111111", colorFondo: "#F2EDE7" },
  { clave: "RAZA", nombre: "Raza", concepto: "Parrilla urbana y cosmopolita", web: "razamadrid.com", instagram: "@razamadrid", colorPrincipal: "#1c1917", colorFondo: "#f5f5f4" },
  { clave: "ROXA", nombre: "La Vaca Roxa", concepto: "Cocina asturiana y parrilla de carbón", web: "lavacaroxa.com", instagram: "@lavacaroxa", colorPrincipal: "#958A68", colorFondo: "#F1EDE1" },
  { clave: "ALBUFERA", nombre: "L'Albufera", concepto: "Arroces y paellas mediterráneos", web: "restaurantelaalbufera.com", instagram: "@albufera_madrid", colorPrincipal: "#1f4d3a", colorFondo: "#f3efe4" },
  { clave: "PUCHERO", nombre: "El Puchero", concepto: "Casa de comidas madrileña desde 1940", web: "elpuchero.com", instagram: "@restauranteelpuchero", colorPrincipal: "#880c33", colorFondo: "#faf5ef" },
  { clave: "PALOMA", nombre: "La Paloma", concepto: "Clásico de autor", web: "lapalomarestaurante.es", instagram: "@restaurantelapaloma", colorPrincipal: "#111111", colorFondo: "#ffffff" },
  { clave: "GUAPO", nombre: "Taberna El Guapo", concepto: "Taberna urbana con cócteles", web: "tabernaelguapo.es", instagram: "@tabernaelguapo", colorPrincipal: "#111111", colorFondo: "#ffffff" },
];

// [codigo, nombre, marca, sociedad, dirección, cp, ciudad, comunidad, teléfono]
const LOCALES: [string, string, string, string, string, string, string, string, string][] = [
  ["VA-AYA", "Vaca Ayala", "VACA", "PENDIENTE", "C/ Ayala 64", "28001", "Madrid", "Madrid", "+34911341160"],
  ["VA-MOR", "Vaca Moraleja", "VACA", "PENDIENTE", "Av. de Europa 17", "28108", "Alcobendas", "Madrid", "+34918563248"],
  ["VA-PCA", "Vaca Plaza Castilla", "VACA", "PENDIENTE", "C/ Mateo Inurria 19", "28036", "Madrid", "Madrid", "+34918056122"],
  ["VA-VEN", "Vaca Ventura", "VACA", "PENDIENTE", "C/ Ventura de la Vega 3", "28014", "Madrid", "Madrid", "+34911288160"],
  ["VA-IBI", "Vaca Ibiza", "VACA", "PENDIENTE", "C/ Miquel Caietà Soler 7", "07800", "Eivissa", "Illes Balears", "+34871183159"],
  ["VA-MUR", "Vaca Murcia", "VACA", "PENDIENTE", "Pl. de Santa Isabel 6", "30004", "Murcia", "Región de Murcia", "+34868455457"],
  ["RZ-BAR", "Raza Barquillo", "RAZA", "IHA", "C/ Barquillo 8", "28004", "Madrid", "Madrid", "+34917012366"],
  ["RZ-BER", "Raza Bernabéu", "RAZA", "KIEV", "C/ Juan Ramón Jiménez 11", "28036", "Madrid", "Madrid", "+34913141054"],
  ["RZ-CHA", "Raza Chamberí", "RAZA", "INNOGAMA", "P.º de Eduardo Dato 8", "28010", "Madrid", "Madrid", "+34911730197"],
  ["VR-BER", "Vaca Roxa Chamartín", "ROXA", "GUELU", "Av. de Brasil 11", "28020", "Madrid", "Madrid", "+34910163906"],
  ["VR-CHA", "Vaca Roxa Chamberí", "ROXA", "INNOGAMA", "C/ Rafael Calvo 40", "28010", "Madrid", "Madrid", "+34913100074"],
  ["AL-MOR", "Albufera Moraleja", "ALBUFERA", "GUELU", "Av. de Europa 17 bis", "28108", "Alcobendas", "Madrid", "+34916625175"],
  ["AL-PCA", "Albufera Plaza Castilla", "ALBUFERA", "GUELU", "C/ Mateo Inurria 19", "28036", "Madrid", "Madrid", "+34644729409"],
  ["PU-CHA", "El Puchero", "PUCHERO", "PUCHERO", "C/ Padre Damián 37", "28036", "Madrid", "Madrid", "+34913456298"],
  ["PA-SAL", "La Paloma", "PALOMA", "PENDIENTE", "C/ Jorge Juan 39", "28001", "Madrid", "Madrid", "+34915758692"],
  ["TG-CHA", "Taberna El Guapo", "GUAPO", "PENDIENTE", "C/ Rafael Calvo 40", "28010", "Madrid", "Madrid", ""],
];

// Familias de bebida
const FAMILIAS_BEBIDA = ["Vinos tintos", "Vinos blancos", "Espumosos y champán", "Generosos y dulces", "Destilados y licores", "Otros"];
// Familias de comida (ejemplo para el módulo Comidas)
const FAMILIAS_COMIDA = ["Carnes", "Pescados y mariscos", "Verduras y frutas", "Lácteos y huevos", "Seco y despensa", "Elaborados del obrador"];

// [referencia, nombre, proveedor, stock, coste €/ud]  (BODEGA 360, 08/11/2026)
const BEBIDAS: [string, string, string, number, number][] = [
  ["RV-0163", "EMILIO MORO CRIANZA", "DISTRIBUCIONES NAVARRO, S.A.", 130, 12.63], ["RV-0025", "RIOJA ALTA 890", "LA RIOJA ALTA SA", 12, 128.1],
  ["RV-0069", "PESQUERA CRIANZA", "ASEUNIV SL", 96, 11.38], ["RV-0090", "MARQUES DE MURRIETA RESERVA", "ASEUNIV SL", 70, 13.94],
  ["RV-0028", "VALQUEMAO 13 MESES BARRICA", "PROVEEDOR VALQUEMAO", 47, 19.55], ["RV-0061", "MATARROMERA", "VOLDISTRIBUTION MADRID SA", 61, 14.77],
  ["RV-0159", "CONTINO RSVA", "COMPAÑIA VINICOLA DEL NORTE S.A.", 46, 18.46], ["RV-0007", "MARQUES DE VARGAS RESERVA", "CAVINSA", 57, 14.72],
  ["CC-171", "EL GRAN ENEMIGO BLEND", "MIBIL GESTION S.L", 12, 66.5], ["RV-0076", "VIÑA ARDANZA", "LA RIOJA ALTA SA", 39, 19.01],
  ["RV-0092", "VIÑA SALCEDA", "MIBIL GESTION S.L", 133, 5.1], ["RV-0070", "PETALOS DEL BIERZO", "ASEUNIV SL", 63, 10.4],
  ["CHI-4443", "CHIVITE COLECCION 125", "MIBIL GESTION S.L", 17, 38.03], ["RV-0039", "BELA", "COMPAÑIA VINICOLA DEL NORTE S.A.", 126, 4.95],
  ["RV-0155", "CHIVITE LAS FINCAS", "MIBIL GESTION S.L", 78, 6.85], ["RV-0050", "LA MONTESA", "VILA VINITECA", 51, 10.46],
  ["RV-0005", "JAVIER SANZ", "ASEUNIV SL", 69, 7.64], ["DOM-009", "DOMINIO DE ELBIO", "MIBIL GESTION S.L", 13, 35.8],
  ["REF-1017", "BELUGA VODKA", "VARMA DISTRIBUCION", 13, 34.63], ["RV-0048", "JAVIER SANZ SEMIDULCE", "ASEUNIV SL", 82, 5.4],
  ["RV-0189", "OREMUS MANDOLAS 2020", "CALIDOSCOPI VINOS FINOS SLU", 24, 17.5], ["RV-0114", "COPAINS D'ABORD CHATEAUNEUF PAPE TINTO", "ASEUNIV SL", 7, 59],
  ["REF-1007", "TAITTINGER ROSE", "MIBIL GESTION S.L", 8, 48.4], ["RV-0116", "FRONTONIO LA CERQUETA TINTO", "ASEUNIV SL", 9, 36],
  ["GAL-554", "GALIR GODELLO", "COMPAÑIA VINICOLA DEL NORTE S.A.", 42, 7.29], ["RV-0044", "CONTINO VIÑA OLIVO", "COMPAÑIA VINICOLA DEL NORTE S.A.", 5, 58.52],
  ["RV-0192", "SALENTEIN PRIMUS MALBEC 75CL", "FUERA DE CARTA", 12, 24], ["RV-0026", "904 GRAN RESERVA", "LA RIOJA ALTA SA", 6, 47.94],
  ["RV-0178", "MARQUES DE MURRIETA MAGNUM", "ASEUNIV SL", 10, 28.5], ["fue-001", "CUENTAVIÑAS ALOMADO", "FUERA DE CARTA", 6, 46.95],
  ["RV-0062", "MATARROMERA PRESTIGIO", "VOLDISTRIBUTION MADRID SA", 7, 38.6], ["RV-0132", "LAKAR", "OROWINES SPAIN SL", 7, 38],
  ["LALA-234", "LA LAMA", "MIBIL GESTION S.L", 19, 13.95], ["RV-0052", "LIVIUS", "", 10, 26],
  ["FUE-45", "BAYNOS", "FUERA DE CARTA", 4, 64.95], ["AMO-1600", "AMONTILLADO NPU", "CAVINSA", 13, 19.1],
  ["REF-1013", "PALOMA MINGUEZ", "CAVINSA", 19, 12], ["RV-0108", "ISABEL ARRANZ", "PROVEEDOR AVELINO / ISABEL ARRANZ", 30, 7.45],
  ["RV-0115", "FRONTINIO SUPERSONICO TINTO", "ASEUNIV SL", 11, 20], ["RV-0172", "ZUCCARDI Q MALBEC", "VILA VINITECA", 26, 8.4],
  ["FUE-11", "BALVENIE 12 AÑOS WISKEY", "FUERA DE CARTA", 4, 54.04], ["RV-0182", "LICINIA", "CAVINSA", 13, 15.68],
  ["VPE114", "VIÑA SALCEDA CRIANZA MAGNUM", "MIBIL GESTION S.L", 20, 10], ["RV-0051", "LA VAL ALBARIÑO", "COMPAÑIA VINICOLA DEL NORTE S.A.", 32, 6.23],
  ["RV-0074", "VALDECHUECAS", "", 5, 38], ["RV-0032", "JEAN LEON", "PROVEEDOR moni tovar", 6, 31.21],
  ["RV-0158", "CONTINO BLANCO", "COMPAÑIA VINICOLA DEL NORTE S.A.", 10, 18.38], ["RV-0003", "LAMBUENA VIÑAS VIEJAS", "FUERA DE CARTA", 6, 29.46],
  ["RV-0156", "EL ENEMIGO CABERNET FRANC", "MIBIL GESTION S.L", 10, 16.64], ["CC-170", "HOYA DE LOBOS BLANCO MAGNUM", "MIBIL GESTION S.L", 20, 7.7],
  ["REF-1023", "YZAGUIRRE ROJO", "VARMA DISTRIBUCION", 24, 6.25], ["REF-1008", "TAITTINGER BRUT NATURE", "MIBIL GESTION S.L", 4, 37.5],
  ["RV-0119", "LE NATUREL ZERO ZERO BLANCO", "ASEUNIV SL", 24, 6.08], ["RV-0006", "MACAN CLASICO", "BACO DISTRIBUIDORA DE BEBIDAS, S.A.", 4, 29.95],
  ["RV-0060", "MARIMAR PINOT NOIR", "PROVEEDOR moni tovar", 3, 39.83], ["RV-0066", "O CHAN GODELLO", "FUERA DE CARTA", 13, 8.7],
  ["FUE-10", "PAZO DE VALDOMINIO ORUJO", "FUERA DE CARTA", 5, 21.05], ["RV-0139", "PINTIA", "BODEGAS BORDINO", 2, 52],
  ["FIN-1604", "FINO MARISMERO", "CAVINSA", 8, 12.9], ["MAN-1552", "PEDRO XIMENEZ DUQUESA", "CAVINSA", 5, 20.4],
  ["REF-1018", "TEQUILA ROOSTER", "VARMA DISTRIBUCION", 5, 19.8], ["CC-175", "PRUNO VILLACRECES", "DISTRIBUCIONES NAVARRO, S.A.", 12, 8.22],
  ["RV-0037", "A VILERMA", "FUERA DE CARTA", 11, 8.68], ["FUE-002", "BOBOS", "FUERA DE CARTA", 4, 23.78],
  ["RV-0188", "OPORTO GRAHAMS TAWNY 0.75", "VARMA DISTRIBUCION", 12, 7.8], ["RV-0100", "PAZO SAN MAURO", "CAVINSA", 8, 11.4],
  ["REF-1019", "BARCELO BLANCO", "VARMA DISTRIBUCION", 6, 13.45], ["PAL-1601", "PALO CORTADO REGENTE", "CAVINSA", 4, 19.55],
  ["BOL-909", "BOLLINGER SPECIAL CUVEE BRUT", "CAVINSA", 6, 12], ["RV-0059", "MARIMAR ACERO", "PROVEEDOR moni tovar", 3, 23.3],
  ["MAN-1547", "MANZANILLA PEPA", "CAVINSA", 7, 9.15], ["FUE-12", "GLENFIDDICH 12 AÑOS WHISKEY", "FUERA DE CARTA", 2, 30.86],
  ["FUE-13", "FINCA TERRENAL", "FUERA DE CARTA", 1, 48.85], ["RV-0135", "LAYA", "OROWINES SPAIN SL", 12, 3.95],
  ["FUE-90", "AN2", "FUERA DE CARTA", 2, 21.56], ["FUE-005", "MARBORE", "FUERA DE CARTA", 2, 21.5],
  ["REF-1009", "BRUNELLO DI MONTALCINO", "FUERA DE CARTA", 1, 40], ["FUE-003", "PREDICADOR", "FUERA DE CARTA", 1, 29],
  ["RV-0138", "PAGO DE CARRAOVEJAS", "BODEGAS BORDINO", 1, 28], ["RV-0057", "MANUEL MANZANEQUE CHARDONAY", "ASEUNIV SL", 2, 12.1],
  ["FUE-006", "UNANIME", "FUERA DE CARTA", 1, 23], ["FUE-14", "MALCORTA", "FUERA DE CARTA", 1, 20.65],
  ["REF-1028", "TRUS CRIANZA", "FUERA DE CARTA", 1, 17], ["FUE-15", "PEGASO", "FUERA DE CARTA", 1, 16],
  ["RV-0063", "MILETO", "", 2, 7.8], ["RV-0020", "A COROA GODELLO", "PIFEMA SL", 2, 7.52],
  ["FUE-16", "BARBA AZUL", "FUERA DE CARTA", 1, 13.05], ["REF-1025", "ENRIQUE MENDOZA", "", 1, 12],
  ["RV-0124", "PAGO DEL ESPINO", "ASEUNIV SL", 1, 12], ["FUE-50", "TRUS", "FUERA DE CARTA", 1, 10],
  ["RV-0079", "PAGO SENDA MISA", "", 1, 9], ["RV-0065", "NEXUS ONE", "", 1, 6.7],
  ["REF-1021", "CREMA DE ORUJO PAZO DE VALDOMIÑO", "VARMA DISTRIBUCION", 0, 12.5], ["RV-0134", "JUAN GIL ETIQUETA PLATA", "OROWINES SPAIN SL", 0, 8.29],
  ["RV-0161", "MAGNUM CONTINO RSVA", "COMPAÑIA VINICOLA DEL NORTE S.A.", 0, 45.85], ["RV-0142", "VEGA SICILIA UNICO", "BODEGAS BORDINO", 0, 338],
  ["RV-0038", "AVELINO VEGAS 100 ANIV", "PROVEEDOR AVELINO / ISABEL ARRANZ", 0, 24], ["RV-0133", "ALAYA TIERRA", "BACO DISTRIBUIDORA DE BEBIDAS, S.A.", 0, 16.66],
];

// Teléfonos de proveedores corregidos al formato internacional (+34): en BODEGA 360 faltaba el 34
const TELEFONOS: Record<string, [string, string]> = {
  "ASEUNIV SL": ["Jordi", "+34638202002"], "CAVINSA": ["Gema", "+34683511685"], "COMPAÑIA VINICOLA DEL NORTE S.A.": ["Claudia", "+34676690357"],
  "DISTRIBUCIONES NAVARRO, S.A.": ["David", "+34606614989"], "LA RIOJA ALTA SA": ["Mary", "+34638602380"], "MIBIL GESTION S.L": ["Cesar Esteves", "+34676215502"],
  "PIFEMA SL": ["Mariela", "+34657917085"], "PROVEEDOR AVELINO / ISABEL ARRANZ": ["Iván", "+34647437170"], "PROVEEDOR VALQUEMAO": ["Pablo", "+34646696546"],
  "PROVEEDOR moni tovar": ["Moni Tovar", "+34671306965"], "VILA VINITECA": ["Pablo", "+34672648254"], "VOLDISTRIBUTION MADRID SA": ["Aitor", "+34609344818"],
};

function familiaDe(nombre: string): string {
  const n = nombre.toUpperCase();
  if (/(VODKA|WHISK|WISKEY|TEQUILA|ORUJO|BARCELO|MACAN|YZAGUIRRE)/.test(n)) return "Destilados y licores";
  if (/(TAITTINGER|BOLLINGER|CAVA|CHAMP)/.test(n)) return "Espumosos y champán";
  if (/(FINO|MANZANILLA|AMONTILLADO|PALO CORTADO|PEDRO XIMENEZ|OPORTO|OREMUS|SEMIDULCE)/.test(n)) return "Generosos y dulces";
  if (/(BLANCO|GODELLO|ALBARIÑO|CHARDONAY|CHARDONNAY|PAZO|VILERMA|O CHAN|NATUREL)/.test(n)) return "Vinos blancos";
  return "Vinos tintos";
}

async function main() {
  const existe = await prisma.tenant.findFirst({ where: { nombre: "Grupo Raza" } });
  if (existe) {
    console.log("La semilla ya está cargada (Grupo Raza existe). Para recargar: vaciar la base erp_dev.");
    return;
  }
  const tenant = await prisma.tenant.create({ data: { nombre: "Grupo Raza", perfil: "RESTAURANTE" } });
  const t = tenant.id;

  await prisma.tenantModulo.createMany({ data: MODULOS_CONTRATADOS.map((modulo) => ({ tenantId: t, modulo })) });

  const soc: Record<string, string> = {};
  for (const s of SOCIEDADES) soc[s.clave] = (await prisma.sociedad.create({ data: { tenantId: t, razonSocial: s.razonSocial, cif: s.cif } })).id;
  const mar: Record<string, string> = {};
  for (const m of MARCAS) {
    const { clave, ...datos } = m;
    mar[clave] = (await prisma.marca.create({ data: { tenantId: t, ...datos } })).id;
  }

  const edificios: Record<string, string> = {};
  const centros: Record<string, string> = {};
  for (const [codigo, nombre, marca, sociedad, direccion, cp, ciudad, comunidad, telefono] of LOCALES) {
    const claveEd = `${direccion.replace(/ bis$/, "")}|${cp}`;
    if (!edificios[claveEd]) edificios[claveEd] = (await prisma.edificio.create({ data: { tenantId: t, direccion: direccion.replace(/ bis$/, ""), cp, ciudad, comunidad } })).id;
    const c = await prisma.centro.create({
      data: {
        tenantId: t, codigo, nombre, tipo: "LOCAL", estado: codigo === "VA-IBI" ? "TEMPORADA" : "ABIERTO",
        marcaId: mar[marca], sociedadId: soc[sociedad], edificioId: edificios[claveEd], telefono: telefono || null,
        horaCorte: codigo === "VA-IBI" ? "03:00" : "05:00",
      },
    });
    centros[codigo] = c.id;
    // Los locales no tienen Obrador
    await prisma.centroModulo.createMany({
      data: MODULOS_CONTRATADOS.filter((m) => m !== "obrador").map((modulo) => ({ centroId: c.id, modulo })),
    });
  }
  const obrador = await prisma.centro.create({
    data: { tenantId: t, codigo: "OB", nombre: "Obrador (Cocina Central)", tipo: "OBRADOR", estado: "ABIERTO", sociedadId: soc.PENDIENTE },
  });
  centros.OB = obrador.id;
  await prisma.centroModulo.createMany({
    data: ["bebidas", "comidas", "obrador", "personal", "contabilidad", "cuadro", "calidad"].map((modulo) => ({ centroId: obrador.id, modulo })),
  });
  await prisma.almacen.createMany({ data: [{ centroId: obrador.id, nombre: "Bodega" }, { centroId: obrador.id, nombre: "Cámara" }, { centroId: obrador.id, nombre: "Seco" }] });

  // Familias
  const fam: Record<string, string> = {};
  for (const [i, nombre] of FAMILIAS_BEBIDA.entries()) fam[`B|${nombre}`] = (await prisma.familiaProducto.create({ data: { tenantId: t, area: "BEBIDAS", nombre, orden: i } })).id;
  for (const [i, nombre] of FAMILIAS_COMIDA.entries()) fam[`C|${nombre}`] = (await prisma.familiaProducto.create({ data: { tenantId: t, area: "COMIDAS", nombre, orden: i } })).id;

  // Proveedores de bebida
  const prov: Record<string, string> = {};
  for (const nombre of Array.from(new Set(BEBIDAS.map((b) => b[2]).filter(Boolean)))) {
    const tel = TELEFONOS[nombre];
    prov[nombre] = (await prisma.proveedor.create({ data: { tenantId: t, nombre, contacto: tel?.[0], telefono: tel?.[1], areas: ["BEBIDAS"] } })).id;
  }

  // Productos de bebida + carga inicial en el obrador
  for (const [referencia, nombre, proveedor, stock, coste] of BEBIDAS) {
    const p = await prisma.producto.create({
      data: {
        tenantId: t, area: "BEBIDAS", referencia, nombre, unidad: "BOTELLA",
        familiaId: fam[`B|${familiaDe(nombre)}`], proveedorId: proveedor ? prov[proveedor] : null,
        costeUnitario: new Prisma.Decimal(coste), stockMinimo: new Prisma.Decimal(6),
      },
    });
    if (stock > 0)
      await prisma.movimientoStock.create({
        data: { tenantId: t, centroId: obrador.id, productoId: p.id, tipo: "CARGA_INICIAL", cantidad: new Prisma.Decimal(stock), costeUnitario: new Prisma.Decimal(coste), documento: "BODEGA 360", motivo: "Carga inicial de ejemplo (08/11/2026)" },
      });
  }

  // Usuarios de prueba (contraseña común de desarrollo: ver README)
  const hash = await bcrypt.hash("Prueba2026!", 10);
  const usuarios = [
    { email: "admin@erp.local", nombre: "Administración", rol: "admin", todosCentros: true },
    { email: "direccion@erp.local", nombre: "Dirección", rol: "direccion", todosCentros: true },
    { email: "economato@erp.local", nombre: "Economato", rol: "economato", todosCentros: false, centros: ["OB"] },
    { email: "gerente.ayala@erp.local", nombre: "Gerente Vaca Ayala", rol: "gerente", todosCentros: false, centros: ["VA-AYA"] },
    { email: "rrhh@erp.local", nombre: "Recursos Humanos", rol: "rrhh", todosCentros: true },
  ];
  for (const u of usuarios) {
    const creado = await prisma.usuario.create({ data: { tenantId: t, email: u.email, nombre: u.nombre, rol: u.rol, passwordHash: hash, todosCentros: u.todosCentros } });
    for (const c of u.centros ?? []) await prisma.usuarioCentro.create({ data: { usuarioId: creado.id, centroId: centros[c] } });
  }

  // Cadena de ejemplo «cafetería» para comprobar que los módulos se contratan por separado
  const cafe = await prisma.tenant.create({ data: { nombre: "Cafeterías Ejemplo", perfil: "CAFETERIA" } });
  await prisma.tenantModulo.createMany({ data: ["bebidas", "caja", "personal"].map((modulo) => ({ tenantId: cafe.id, modulo })) });
  await prisma.centro.create({ data: { tenantId: cafe.id, codigo: "CF-01", nombre: "Cafetería Centro", tipo: "LOCAL" } });
  await prisma.usuario.create({ data: { tenantId: cafe.id, email: "cafeteria@erp.local", nombre: "Dueña cafetería", rol: "admin", passwordHash: hash, todosCentros: true } });

  // Semillas de cada módulo
  const contexto = { tenantId: t, centros, sociedades: soc, marcas: mar, familias: fam, proveedores: prov };
  for (const [nombre, sembrar] of Object.entries(SEMILLAS_MODULOS)) {
    await sembrar(prisma, contexto);
    console.log(`Semilla del módulo ${nombre}: hecha`);
  }
  console.log("Semilla cargada: Grupo Raza (16 locales + obrador, 103 bebidas) y Cafeterías Ejemplo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
