/**
 * Semilla de Contabilidad (SOLO DESARROLLO).
 * ⚠ CIFRAS DE EJEMPLO: facturas, importes, alquileres y suministros son INVENTADOS para probar las pantallas.
 * Los proveedores de bebida sí existen en la semilla del núcleo (BODEGA 360); los números de sus facturas no.
 * Crea: categorías básicas, una docena de facturas recibidas, gastos fijos de este mes y del anterior
 * por local, y una factura emitida preparada (sin emitir: el ERP no está certificado para Verifactu).
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";

const r2 = (n: number) => Math.round(n * 100) / 100;
function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const dia = (base: Date, dias: number) => new Date(base.getTime() + dias * 86400000);

// Mismo listado que CATEGORIAS_BASICAS de src/modulos/contabilidad/servicio.ts (allí no se puede importar: es server-only)
const CATEGORIAS = [
  ["MERC-BEB", "Mercancía de bebidas", "MERCANCIA"], ["MERC-COM", "Mercancía de comida", "MERCANCIA"], ["MERC-CONS", "Consumibles y menaje", "MERCANCIA"],
  ["PERS", "Personal", "PERSONAL"], ["ALQ", "Alquiler", "GASTO_FIJO"], ["SUM", "Suministros (luz, agua, gas)", "GASTO_FIJO"], ["SEG", "Seguros", "GASTO_FIJO"],
  ["TEL", "Teléfono e internet", "GASTO_FIJO"], ["ASES", "Gestoría y asesoría", "GASTO_FIJO"], ["MANT", "Mantenimiento y reparaciones", "GASTO_VARIABLE"],
  ["LIMP", "Limpieza", "GASTO_VARIABLE"], ["PUBL", "Publicidad y marketing", "GASTO_VARIABLE"], ["COMI", "Comisiones bancarias y de tarjeta", "GASTO_VARIABLE"], ["OTROS", "Otros gastos", "GASTO_VARIABLE"],
] as const;

// EJEMPLO: alquiler mensual (sin IVA) por local. Inventado.
const ALQUILER: Record<string, number> = {
  "VA-AYA": 14500, "VA-MOR": 11000, "VA-PCA": 9800, "VA-VEN": 8200, "VA-MUR": 5200, "RZ-BAR": 12500, "RZ-BER": 11800, "RZ-CHA": 9500,
  "VR-BER": 8800, "VR-CHA": 7600, "AL-MOR": 6500, "AL-PCA": 6200, "PU-CHA": 7000, "PA-SAL": 10500, "TG-CHA": 4800,
};

export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla) {
  const t = ctx.tenantId;
  if ((await prisma.facturaRecibida.count({ where: { tenantId: t } })) > 0) return; // ya sembrado
  const admin = await prisma.usuario.findFirst({ where: { tenantId: t, rol: "admin" }, select: { id: true } });

  await prisma.categoriaContable.createMany({ data: CATEGORIAS.map(([codigo, nombre, grupo], orden) => ({ tenantId: t, codigo, nombre, grupo, orden })), skipDuplicates: true });
  const cat = Object.fromEntries((await prisma.categoriaContable.findMany({ where: { tenantId: t } })).map((c) => [c.codigo, c.id]));

  const centros = await prisma.centro.findMany({ where: { tenantId: t }, select: { id: true, codigo: true, sociedadId: true } });
  const sociedadDe = Object.fromEntries(centros.map((c) => [c.codigo, c.sociedadId]));
  const hoy = new Date(`${hoyISO()}T00:00:00.000Z`);
  const anio = hoy.getUTCFullYear();
  const inicioMes = new Date(Date.UTC(anio, hoy.getUTCMonth(), 1));
  const inicioMesAnterior = new Date(Date.UTC(anio, hoy.getUTCMonth() - 1, 1));

  // ---------- facturas recibidas (12, EJEMPLO) ----------
  // [local, proveedor (núcleo o texto), nº proveedor, días atrás, vence a (días), categoría, estado, líneas [concepto, cantidad, precio, iva]]
  type L = [string, number, number, number];
  const FACTURAS: [string, string, string, number, number, string, "PENDIENTE" | "VALIDADA" | "PAGADA", L[]][] = [
    ["RZ-BAR", "DISTRIBUCIONES NAVARRO, S.A.", "DN-26/4471", 26, 30, "MERC-BEB", "PAGADA", [["EMILIO MORO CRIANZA", 24, 12.63, 21], ["PRUNO VILLACRECES", 12, 8.22, 21]]],
    ["RZ-BER", "LA RIOJA ALTA SA", "LRA-0091822", 22, 30, "MERC-BEB", "PAGADA", [["VIÑA ARDANZA", 18, 19.01, 21], ["904 GRAN RESERVA", 6, 47.94, 21]]],
    ["VR-BER", "ASEUNIV SL", "A-2026-11873", 18, 30, "MERC-BEB", "VALIDADA", [["PESQUERA CRIANZA", 24, 11.38, 21], ["MARQUES DE MURRIETA RESERVA", 12, 13.94, 21]]],
    ["AL-MOR", "CAVINSA", "CV/26/5521", 15, 30, "MERC-BEB", "VALIDADA", [["MARQUES DE VARGAS RESERVA", 12, 14.72, 21], ["MANZANILLA PEPA", 6, 9.15, 21]]],
    ["RZ-CHA", "MIBIL GESTION S.L", "MB-77310", 12, 15, "MERC-BEB", "VALIDADA", [["VIÑA SALCEDA", 36, 5.1, 21], ["CHIVITE LAS FINCAS", 24, 6.85, 21]]],
    ["PU-CHA", "Carnes Selectas del Norte (ejemplo)", "CSN-3390", 9, 7, "MERC-COM", "VALIDADA", [["Lomo alto de vacuno", 42.5, 24.8, 10], ["Morcilla y chorizo", 12, 6.4, 10]]],
    ["VR-CHA", "Pescados Mercamadrid (ejemplo)", "PM-118204", 6, 7, "MERC-COM", "PENDIENTE", [["Merluza de pincho", 18, 16.5, 10], ["Gamba roja", 4, 58, 10]]],
    ["AL-PCA", "Frutas y Verduras Ruiz (ejemplo)", "FV-2026-889", 4, 15, "MERC-COM", "PENDIENTE", [["Verdura variada", 1, 312.4, 4], ["Limones y naranjas", 1, 64.2, 4]]],
    ["RZ-BAR", "Iberdrola Clientes (ejemplo)", "21260011873452", 8, 5, "SUM", "VALIDADA", [["Electricidad octubre", 1, 2140.32, 21]]],
    ["RZ-BER", "Reparaciones Hostelería Madrid (ejemplo)", "RHM-552", 5, 20, "MANT", "PENDIENTE", [["Reparación cámara frigorífica", 1, 485, 21], ["Desplazamiento", 1, 45, 21]]],
    ["VR-BER", "Limpiezas Castellana (ejemplo)", "LC-10/2026", 7, 0, "LIMP", "PAGADA", [["Limpieza de campanas", 1, 620, 21]]],
    ["RZ-CHA", "Menaje Profesional (ejemplo)", "MP-44102", 3, 30, "MERC-CONS", "PENDIENTE", [["Copas de vino", 48, 3.9, 21], ["Servilletas de tela", 200, 0.85, 21]]],
  ];
  let n = 0;
  for (const [codigo, proveedor, numeroProveedor, atras, vence, categoria, estado, lineas] of FACTURAS) {
    const sociedadId = sociedadDe[codigo];
    if (!sociedadId) continue;
    n++;
    const calc = lineas.map(([concepto, cantidad, precio, iva], orden) => {
      const base = r2(cantidad * precio);
      return { concepto, cantidad, precio, tipoIva: iva, base, cuotaIva: r2((base * iva) / 100), categoriaId: cat[categoria], orden };
    });
    const base = r2(calc.reduce((s, l) => s + l.base, 0));
    const cuotaIva = r2(calc.reduce((s, l) => s + l.cuotaIva, 0));
    const fecha = dia(hoy, -atras);
    await prisma.facturaRecibida.create({
      data: {
        tenantId: t,
        numero: `FR-${String(n).padStart(6, "0")}`,
        numeroProveedor,
        proveedorId: ctx.proveedores[proveedor] ?? null,
        proveedorNombre: proveedor,
        sociedadId,
        centroId: ctx.centros[codigo],
        categoriaId: cat[categoria],
        fecha,
        vencimiento: dia(fecha, vence),
        base,
        cuotaIva,
        total: r2(base + cuotaIva),
        estado,
        notas: "Factura de ejemplo (semilla)",
        creadoPor: admin?.id,
        validadaPor: estado !== "PENDIENTE" ? admin?.id : null,
        validadaEn: estado !== "PENDIENTE" ? dia(fecha, 1) : null,
        pagadaEn: estado === "PAGADA" ? dia(fecha, vence) : null,
        lineas: { create: calc },
      },
    });
  }
  // la numeración sigue donde acaba la semilla
  await prisma.contador.upsert({ where: { tenantId_serie_anio: { tenantId: t, serie: "FR", anio } }, create: { tenantId: t, serie: "FR", anio, valor: n }, update: { valor: n } });

  // ---------- gastos fijos de este mes y del anterior (EJEMPLO) ----------
  const gastos = [];
  for (const [codigo, alquiler] of Object.entries(ALQUILER)) {
    const sociedadId = sociedadDe[codigo];
    const centroId = ctx.centros[codigo];
    if (!sociedadId || !centroId) continue;
    for (const inicio of [inicioMesAnterior, inicioMes]) {
      const actual = inicio === inicioMes;
      const fijos: [string, string, number, number, string, number][] = [
        // [categoría, concepto, base, IVA, proveedor, día del mes]
        ["ALQ", "Alquiler del local", alquiler, 21, "Propiedad del local (ejemplo)", 1],
        ["SEG", "Seguro multirriesgo", r2(alquiler * 0.035), 0, "Mapfre (ejemplo)", 5],
        ["TEL", "Teléfono e internet", 89.9, 21, "Movistar (ejemplo)", 10],
        ["COMI", "Comisiones del datáfono", r2(alquiler * 0.12), 0, "Banco (ejemplo)", 28],
      ];
      for (const [categoria, concepto, base, iva, proveedorNombre, diaMes] of fijos) {
        const fecha = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), diaMes));
        if (fecha > hoy) continue; // lo que aún no ha llegado este mes no se apunta
        const cuotaIva = r2((base * iva) / 100);
        gastos.push({
          tenantId: t,
          sociedadId,
          centroId,
          categoriaId: cat[categoria],
          fecha,
          vencimiento: dia(fecha, 5),
          concepto,
          proveedorNombre,
          base,
          cuotaIva,
          total: r2(base + cuotaIva),
          recurrente: true,
          estado: actual && diaMes > 3 ? ("PENDIENTE" as const) : ("PAGADO" as const),
          pagadoEn: actual && diaMes > 3 ? null : dia(fecha, 2),
          notas: "Gasto de ejemplo (semilla)",
          creadoPor: admin?.id,
        });
      }
    }
  }
  await prisma.gastoContable.createMany({ data: gastos });

  // ---------- una factura emitida PREPARADA (EJEMPLO, sin emitir) ----------
  const sociedadEvento = sociedadDe["RZ-BAR"];
  if (sociedadEvento) {
    const base = 3200;
    await prisma.facturaEmitida.create({
      data: {
        tenantId: t,
        referencia: "PRE-000001",
        sociedadId: sociedadEvento,
        centroId: ctx.centros["RZ-BAR"],
        origen: "EVENTO",
        clienteNombre: "Empresa Ejemplo S.A. (cena de empresa)",
        clienteCif: "A00000000",
        fecha: dia(hoy, -2),
        vencimiento: dia(hoy, 28),
        base,
        cuotaIva: r2(base * 0.1),
        total: r2(base * 1.1),
        estado: "PREPARADA",
        notas: "Factura de ejemplo (semilla). Pendiente de emitir en el programa certificado.",
        creadoPor: admin?.id,
        lineas: { create: [{ concepto: "Menú de empresa (40 personas)", cantidad: 40, precio: 80, tipoIva: 10, base, cuotaIva: r2(base * 0.1), orden: 0 }] },
      },
    });
    await prisma.contador.upsert({ where: { tenantId_serie_anio: { tenantId: t, serie: "PRE", anio } }, create: { tenantId: t, serie: "PRE", anio, valor: 1 }, update: { valor: 1 } });
  }
}
