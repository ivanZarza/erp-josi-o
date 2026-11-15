import "server-only";
/**
 * Lógica de Contabilidad. Todo va por sociedad (lo fiscal) y, si se sabe, por centro (lo de gestión).
 * El ERP NO lleva la contabilidad oficial ni emite facturas certificadas (Verifactu, P-23):
 * registra, prepara y exporta para la gestoría.
 */
import { db } from "@/kernel/db";
import { centrosFiltro, type Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { fecha as fechaEs, euros, numero as numeroEs } from "@/kernel/formato";
import type { Prisma, GrupoCategoriaContable } from "@/generated/prisma/client";
import { costeNominasPorCentroYMes } from "@/modulos/personal/servicio";
import {
  FacturaRecibidaEsquema,
  FacturaEmitidaEsquema,
  GastoEsquema,
  PagoEsquema,
  CategoriaEsquema,
  EmitidaFueraEsquema,
  TIPOS_IVA,
  type LineaFactura,
} from "./esquemas";
import { prepararFacturacionObrador, generarFacturasObrador, type Dependencias, type VistaFacturacion } from "./facturacion-obrador";

/** Error que se enseña tal cual al usuario. */
export class ErrorContable extends Error {}

// ---------- utilidades ----------

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** «2026-11-08» → fecha a medianoche UTC (columnas @db.Date). */
export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Hoy en Madrid como «AAAA-MM-DD». */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** «2026-11» → primer día del mes y primer día del mes siguiente (UTC). */
export function rangoMes(mes: string): { desde: Date; hasta: Date } {
  const [a, m] = mes.split("-").map(Number);
  return { desde: new Date(Date.UTC(a, m - 1, 1)), hasta: new Date(Date.UTC(a, m, 1)) };
}

export function mesActual(): string {
  return hoyISO().slice(0, 7);
}

function calcularLineas<T extends LineaFactura>(lineas: T[]) {
  const calculadas = lineas.map((l, i) => {
    const base = redondear(l.cantidad * l.precio);
    const cuotaIva = redondear((base * l.tipoIva) / 100);
    return { ...l, base, cuotaIva, orden: i };
  });
  const base = redondear(calculadas.reduce((s, l) => s + l.base, 0));
  const cuotaIva = redondear(calculadas.reduce((s, l) => s + l.cuotaIva, 0));
  return { lineas: calculadas, base, cuotaIva, total: redondear(base + cuotaIva) };
}

// ---------- ámbito: qué sociedades y centros ve el usuario ----------

export interface Ambito {
  centroIds: string[];
  sociedadIds: string[];
  /** filtro Prisma para tablas con sociedadId y centroId opcional */
  donde: (sociedadId?: string) => { tenantId: string; sociedadId: string | { in: string[] }; OR: ({ centroId: { in: string[] } } | { centroId: null })[] };
}

export async function ambito(ctx: Contexto): Promise<Ambito> {
  const prisma = await db();
  const centroIds = centrosFiltro(ctx);
  const centros = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: centroIds } }, select: { sociedadId: true } });
  const sociedadIds = Array.from(new Set(centros.map((c) => c.sociedadId).filter((s): s is string => !!s)));
  return {
    centroIds,
    sociedadIds,
    donde: (sociedadId) => ({
      tenantId: ctx.tenant.id,
      sociedadId: sociedadId && sociedadIds.includes(sociedadId) ? sociedadId : { in: sociedadIds },
      // con un centro elegido, solo lo de ese centro; con «todos», también lo de la sociedad sin centro
      OR: [{ centroId: { in: centroIds } }, ...(ctx.centroActivo ? [] : [{ centroId: null }])],
    }),
  };
}

export async function sociedadesVisibles(ctx: Contexto) {
  const prisma = await db();
  const { sociedadIds } = await ambito(ctx);
  return prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id, id: { in: sociedadIds } }, orderBy: { razonSocial: "asc" } });
}

/** Nombres de sociedades, centros y categorías para pintar listados. */
export async function diccionarios(ctx: Contexto) {
  const prisma = await db();
  const [sociedades, centros, categorias, proveedores] = await Promise.all([
    prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, razonSocial: true, cif: true } }),
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, nombre: true, codigo: true, sociedadId: true } }),
    prisma.categoriaContable.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    prisma.proveedor.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, select: { id: true, nombre: true, cif: true }, orderBy: { nombre: "asc" } }),
  ]);
  return {
    sociedades: new Map(sociedades.map((s) => [s.id, s])),
    centros: new Map(centros.map((c) => [c.id, c])),
    categorias: new Map(categorias.map((c) => [c.id, c])),
    listaCategorias: categorias.filter((c) => c.activo),
    proveedores,
  };
}

async function comprobarSociedadCentro(ctx: Contexto, sociedadId: string, centroId?: string) {
  const a = await ambito(ctx);
  if (!a.sociedadIds.includes(sociedadId)) throw new ErrorContable("No puedes registrar en esa sociedad.");
  if (centroId) {
    if (!ctx.centros.some((c) => c.id === centroId)) throw new ErrorContable("No puedes registrar en ese centro.");
    const prisma = await db();
    const c = await prisma.centro.findFirst({ where: { id: centroId, tenantId: ctx.tenant.id }, select: { sociedadId: true } });
    if (c?.sociedadId !== sociedadId) throw new ErrorContable("Ese centro no pertenece a la sociedad elegida.");
  }
}

// ---------- categorías ----------

export const CATEGORIAS_BASICAS: { codigo: string; nombre: string; grupo: GrupoCategoriaContable }[] = [
  { codigo: "MERC-BEB", nombre: "Mercancía de bebidas", grupo: "MERCANCIA" },
  { codigo: "MERC-COM", nombre: "Mercancía de comida", grupo: "MERCANCIA" },
  { codigo: "MERC-CONS", nombre: "Consumibles y menaje", grupo: "MERCANCIA" },
  { codigo: "PERS", nombre: "Personal", grupo: "PERSONAL" },
  { codigo: "ALQ", nombre: "Alquiler", grupo: "GASTO_FIJO" },
  { codigo: "SUM", nombre: "Suministros (luz, agua, gas)", grupo: "GASTO_FIJO" },
  { codigo: "SEG", nombre: "Seguros", grupo: "GASTO_FIJO" },
  { codigo: "TEL", nombre: "Teléfono e internet", grupo: "GASTO_FIJO" },
  { codigo: "ASES", nombre: "Gestoría y asesoría", grupo: "GASTO_FIJO" },
  { codigo: "MANT", nombre: "Mantenimiento y reparaciones", grupo: "GASTO_VARIABLE" },
  { codigo: "LIMP", nombre: "Limpieza", grupo: "GASTO_VARIABLE" },
  { codigo: "PUBL", nombre: "Publicidad y marketing", grupo: "GASTO_VARIABLE" },
  { codigo: "COMI", nombre: "Comisiones bancarias y de tarjeta", grupo: "GASTO_VARIABLE" },
  { codigo: "OTROS", nombre: "Otros gastos", grupo: "GASTO_VARIABLE" },
];

export const NOMBRE_GRUPO: Record<GrupoCategoriaContable, string> = {
  MERCANCIA: "Mercancía",
  PERSONAL: "Personal",
  GASTO_FIJO: "Gasto fijo",
  GASTO_VARIABLE: "Gasto variable",
  INGRESO: "Ingreso",
};

export async function crearCategoriasBasicas(ctx: Contexto) {
  const prisma = await db();
  await prisma.categoriaContable.createMany({
    data: CATEGORIAS_BASICAS.map((c, i) => ({ ...c, tenantId: ctx.tenant.id, orden: i })),
    skipDuplicates: true,
  });
}

export async function crearCategoria(ctx: Contexto, entrada: unknown) {
  const d = CategoriaEsquema.parse(entrada);
  const prisma = await db();
  const existe = await prisma.categoriaContable.findFirst({ where: { tenantId: ctx.tenant.id, codigo: d.codigo } });
  if (existe) throw new ErrorContable(`Ya hay una categoría con el código ${d.codigo}.`);
  const max = await prisma.categoriaContable.aggregate({ where: { tenantId: ctx.tenant.id }, _max: { orden: true } });
  await prisma.categoriaContable.create({ data: { ...d, tenantId: ctx.tenant.id, orden: (max._max.orden ?? 0) + 1 } });
}

export async function alternarCategoria(ctx: Contexto, id: string) {
  const prisma = await db();
  const c = await prisma.categoriaContable.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!c) throw new ErrorContable("Categoría no encontrada.");
  await prisma.categoriaContable.update({ where: { id }, data: { activo: !c.activo } });
}

// ---------- facturas recibidas ----------

export interface FiltroFacturas {
  sociedadId?: string;
  estado?: string;
  mes?: string;
}

export async function listarFacturasRecibidas(ctx: Contexto, f: FiltroFacturas = {}) {
  const prisma = await db();
  const a = await ambito(ctx);
  const where: Prisma.FacturaRecibidaWhereInput = { ...a.donde(f.sociedadId) };
  if (f.estado) where.estado = f.estado as Prisma.FacturaRecibidaWhereInput["estado"];
  if (f.mes) {
    const r = rangoMes(f.mes);
    where.fecha = { gte: r.desde, lt: r.hasta };
  }
  return prisma.facturaRecibida.findMany({ where, include: { lineas: { orderBy: { orden: "asc" } }, albaranes: { select: { pedidoCompraId: true } } }, orderBy: [{ fecha: "desc" }, { numero: "desc" }], take: 500 });
}

const ESTADOS_RECIBIDO = ["RECIBIDO", "RECIBIDO_PARCIAL"] as const;

/**
 * Albaranes (compras recibidas) de cada factura: los de FacturaRecibidaAlbaran y, en las facturas antiguas, el único
 * de `pedidoCompraId` (así no se pierden los enlaces de antes del 15/11).
 */
function albaranesDe(f: { pedidoCompraId: string | null; albaranes?: { pedidoCompraId: string }[] }): string[] {
  const ids = (f.albaranes ?? []).map((x) => x.pedidoCompraId);
  if (f.pedidoCompraId && !ids.includes(f.pedidoCompraId)) ids.push(f.pedidoCompraId);
  return ids;
}

/** Facturas no anuladas en las que ya está cada albarán (enlaces nuevos y antiguos). */
async function facturasDeAlbaranes(tenantId: string, compraIds: string[], excepto?: string): Promise<Map<string, { id: string; numero: string }[]>> {
  const res = new Map<string, { id: string; numero: string }[]>();
  if (compraIds.length === 0) return res;
  const prisma = await db();
  const [enlaces, antiguas] = await Promise.all([
    prisma.facturaRecibidaAlbaran.findMany({ where: { tenantId, pedidoCompraId: { in: compraIds }, factura: { estado: { not: "ANULADA" } } }, select: { pedidoCompraId: true, factura: { select: { id: true, numero: true } } } }),
    prisma.facturaRecibida.findMany({ where: { tenantId, estado: { not: "ANULADA" }, pedidoCompraId: { in: compraIds } }, select: { id: true, numero: true, pedidoCompraId: true } }),
  ]);
  const poner = (compra: string, f: { id: string; numero: string }) => {
    if (f.id === excepto) return;
    const l = res.get(compra) ?? [];
    if (!l.some((x) => x.id === f.id)) l.push(f);
    res.set(compra, l);
  };
  for (const e of enlaces) poner(e.pedidoCompraId, e.factura);
  for (const f of antiguas) poner(f.pedidoCompraId!, f);
  return res;
}

/** Base sin IVA de un albarán: lo recibido × €/ud de cada línea. */
const baseAlbaran = (lineas: { cantidad: unknown; recibida: unknown; precio: unknown }[]) => redondear(lineas.reduce((s, l) => s + Number(l.recibida ?? l.cantidad) * Number(l.precio), 0));

export async function crearFacturaRecibida(ctx: Contexto, entrada: unknown) {
  const d = FacturaRecibidaEsquema.parse(entrada);
  await comprobarSociedadCentro(ctx, d.sociedadId, d.centroId);
  const prisma = await db();
  let proveedorNombre = d.proveedorNombre;
  let proveedorCif = d.proveedorCif;
  if (d.proveedorId) {
    const p = await prisma.proveedor.findFirst({ where: { id: d.proveedorId, tenantId: ctx.tenant.id } });
    if (!p) throw new ErrorContable("Proveedor no encontrado.");
    proveedorNombre = p.nombre;
    proveedorCif = proveedorCif ?? p.cif ?? undefined;
  }
  // categoría de la factura: tiene que existir y estar activa
  const categoria = await prisma.categoriaContable.findFirst({ where: { id: d.categoriaId, tenantId: ctx.tenant.id, activo: true } });
  if (!categoria) throw new ErrorContable("Categoría no encontrada.");
  // Albaranes (compras recibidas) que factura: del mismo proveedor; del centro de la factura o, si la factura es de
  // la sociedad (sin centro), de cualquier centro de esa sociedad. Cada albarán en una sola factura.
  // Si no hay líneas, se copian las de los albaranes (cantidad recibida, precio e IVA del producto).
  let centroId = d.centroId;
  let proveedorId = d.proveedorId;
  let lineasFactura: (LineaFactura & { productoId?: string })[] = d.lineas;
  const albaranIds = Array.from(new Set([...d.albaranIds, ...(d.pedidoCompraId ? [d.pedidoCompraId] : [])]));
  if (albaranIds.length) {
    const compras = await prisma.pedidoCompra.findMany({
      where: { id: { in: albaranIds }, tenantId: ctx.tenant.id, estado: { in: [...ESTADOS_RECIBIDO] } },
      include: { proveedor: { select: { nombre: true, cif: true } }, centro: { select: { nombre: true, sociedadId: true } }, lineas: { include: { producto: { select: { nombre: true, iva: true } } } } },
      orderBy: { recibidoEn: "asc" },
    });
    if (compras.length !== albaranIds.length) throw new ErrorContable("Algún albarán no existe o no está recibido (tiene que ser una compra ya recibida).");
    const nombre = (c: (typeof compras)[number]) => c.albaran ?? c.numero;
    const proveedores = new Set(compras.map((c) => c.proveedorId));
    if (proveedores.size > 1) throw new ErrorContable("Los albaranes elegidos son de proveedores distintos: una factura es de un solo proveedor.");
    const c0 = compras[0];
    if (d.proveedorId && d.proveedorId !== c0.proveedorId) throw new ErrorContable(`Los albaranes son de ${c0.proveedor.nombre}, no del proveedor elegido.`);
    for (const c of compras) {
      if (c.centro.sociedadId !== d.sociedadId) throw new ErrorContable(`El albarán ${nombre(c)} se recibió en ${c.centro.nombre}, que es de otra sociedad.`);
      if (centroId && c.centroId !== centroId) throw new ErrorContable(`El albarán ${nombre(c)} se recibió en ${c.centro.nombre}: elige ese centro o deja el centro vacío (factura de la sociedad).`);
      await comprobarSociedadCentro(ctx, d.sociedadId, c.centroId);
    }
    const centros = new Set(compras.map((c) => c.centroId));
    if (!centroId && centros.size === 1) centroId = c0.centroId;
    proveedorId = c0.proveedorId;
    if (!d.proveedorId) {
      proveedorNombre = c0.proveedor.nombre;
      proveedorCif = proveedorCif ?? c0.proveedor.cif ?? undefined;
    }
    const ya = await facturasDeAlbaranes(ctx.tenant.id, albaranIds);
    for (const c of compras) {
      const otras = ya.get(c.id);
      if (otras?.length) throw new ErrorContable(`El albarán ${nombre(c)} ya está en la factura ${otras[0].numero}.`);
    }
    if (lineasFactura.length === 0) {
      const juntas = new Map<string, LineaFactura & { productoId: string }>();
      for (const c of compras)
        for (const l of c.lineas) {
          const cantidad = Number(l.recibida ?? l.cantidad);
          if (cantidad <= 0) continue;
          const iva = Number(l.producto.iva);
          if (!(TIPOS_IVA as readonly number[]).includes(iva)) throw new ErrorContable(`«${l.producto.nombre}» tiene un IVA del ${iva} %, que no es un tipo válido: escribe las líneas a mano.`);
          const precio = Number(l.precio);
          const k = `${l.productoId}|${precio}`;
          const x = juntas.get(k) ?? { concepto: l.producto.nombre, cantidad: 0, precio, tipoIva: iva, productoId: l.productoId };
          x.cantidad = Math.round((x.cantidad + cantidad) * 1000) / 1000;
          juntas.set(k, x);
        }
      lineasFactura = Array.from(juntas.values()).sort((a, b) => a.concepto.localeCompare(b.concepto, "es"));
    }
  }
  if (lineasFactura.length === 0) throw new ErrorContable("La factura necesita al menos una línea (o elige los albaranes para copiar las suyas).");
  if (!proveedorNombre) throw new ErrorContable("Elige un proveedor o escribe su nombre.");
  const duplicada = await prisma.facturaRecibida.findFirst({
    where: { tenantId: ctx.tenant.id, sociedadId: d.sociedadId, numeroProveedor: d.numeroProveedor, proveedorNombre, estado: { not: "ANULADA" } },
  });
  if (duplicada) throw new ErrorContable(`Esa factura ya está registrada (${duplicada.numero}).`);
  const c = calcularLineas(lineasFactura);
  return prisma.$transaction(async (tx) => {
    const numero = await siguienteNumero(tx, ctx.tenant.id, "FR");
    const f = await tx.facturaRecibida.create({
      data: {
        tenantId: ctx.tenant.id,
        numero,
        numeroProveedor: d.numeroProveedor,
        proveedorId,
        proveedorNombre,
        proveedorCif,
        sociedadId: d.sociedadId,
        centroId,
        categoriaId: d.categoriaId,
        fecha: aFecha(d.fecha),
        vencimiento: d.vencimiento ? aFecha(d.vencimiento) : null,
        base: c.base,
        cuotaIva: c.cuotaIva,
        total: c.total,
        notas: d.notas,
        creadoPor: ctx.usuario.id,
        lineas: {
          create: c.lineas.map((l) => ({
            concepto: l.concepto,
            cantidad: l.cantidad,
            precio: l.precio,
            tipoIva: l.tipoIva,
            base: l.base,
            cuotaIva: l.cuotaIva,
            categoriaId: l.categoriaId ?? d.categoriaId,
            productoId: l.productoId ?? null,
            orden: l.orden,
          })),
        },
        // enlace único por albarán: si otro lo acaba de facturar, la restricción única lo impide
        albaranes: { create: albaranIds.map((pedidoCompraId) => ({ tenantId: ctx.tenant.id, pedidoCompraId })) },
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: f.id, accion: "crear", despues: { numero, total: c.total, albaranes: albaranIds } });
    return f;
  });
}

async function facturaRecibidaDelAmbito(ctx: Contexto, id: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const f = await prisma.facturaRecibida.findFirst({ where: { id, ...a.donde() }, include: { albaranes: { select: { pedidoCompraId: true } } } });
  if (!f) throw new ErrorContable("Factura no encontrada.");
  return f;
}

export async function validarFacturaRecibida(ctx: Contexto, id: string) {
  const f = await facturaRecibidaDelAmbito(ctx, id);
  if (f.estado !== "PENDIENTE") throw new ErrorContable("Solo se validan facturas pendientes de revisar.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaRecibida.update({ where: { id }, data: { estado: "VALIDADA", validadaPor: ctx.usuario.id, validadaEn: new Date() } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: id, accion: "validar", antes: { estado: f.estado }, despues: { estado: "VALIDADA" } });
  });
}

export async function pagarFacturaRecibida(ctx: Contexto, entrada: unknown) {
  const d = PagoEsquema.parse(entrada);
  const f = await facturaRecibidaDelAmbito(ctx, d.id);
  if (f.estado !== "VALIDADA") throw new ErrorContable("Primero hay que validar la factura; después se marca como pagada.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaRecibida.update({ where: { id: f.id }, data: { estado: "PAGADA", pagadaEn: aFecha(d.fecha) } });
    await tx.pagoCobro.create({
      data: { tenantId: ctx.tenant.id, sociedadId: f.sociedadId, tipo: "PAGO", fecha: aFecha(d.fecha), importe: f.total, forma: d.forma, facturaRecibidaId: f.id, referencia: d.referencia, usuarioId: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: f.id, accion: "pagar", antes: { estado: f.estado }, despues: { estado: "PAGADA", fecha: d.fecha, forma: d.forma } });
  });
}

/** Anula una factura recibida: sus albaranes quedan libres para otra factura. El espejo de una factura del obrador se anula desde la emitida. */
export async function anularFacturaRecibida(ctx: Contexto, id: string) {
  const f = await facturaRecibidaDelAmbito(ctx, id);
  if (f.estado === "PAGADA") throw new ErrorContable("Una factura pagada no se anula: habría que registrar un abono.");
  if (f.estado === "ANULADA") return;
  const prisma = await db();
  if (f.facturaEmitidaId) {
    const e = await prisma.facturaEmitida.findFirst({ where: { id: f.facturaEmitidaId, tenantId: ctx.tenant.id }, select: { referencia: true, estado: true } });
    if (e && e.estado !== "ANULADA") throw new ErrorContable(`Es el espejo de la factura del obrador ${e.referencia}: se anula desde Facturas emitidas (se anulan las dos y sus pedidos vuelven a estar por facturar).`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.facturaRecibida.update({ where: { id }, data: { estado: "ANULADA" } });
    await tx.facturaRecibidaAlbaran.deleteMany({ where: { facturaId: id } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: id, accion: "anular", antes: { estado: f.estado, albaranes: albaranesDe(f) }, despues: { estado: "ANULADA" } });
  });
}

// ---------- albaranes pendientes de facturar (para el alta) ----------

export interface AlbaranPendiente {
  id: string;
  numero: string;
  albaran: string | null;
  albaranProveedor: string | null;
  recibidoEn: Date;
  centroId: string;
  centro: string;
  proveedorId: string;
  proveedor: string;
  estado: string;
  base: number;
  /** Del periodo de la factura: recibido después de la última factura del proveedor en ese centro y hasta la fecha. */
  propuesto: boolean;
}

/**
 * Albaranes (compras recibidas) aún sin factura de los centros del usuario, de los últimos `dias` días.
 * Con `proveedorId` solo los de ese proveedor; con `sociedadId` solo los de centros de esa sociedad; con `centroId`, de ese centro.
 * `propuesto` = del periodo que suele cubrir la factura: recibidos después de la última factura (sin abonos) del
 * proveedor en ese centro y hasta `hasta` (fecha de la factura).
 */
export async function albaranesPendientes(ctx: Contexto, f: { proveedorId?: string; sociedadId?: string; centroId?: string; hasta?: string; dias?: number } = {}): Promise<AlbaranPendiente[]> {
  const prisma = await db();
  const a = await ambito(ctx);
  let centroIds = a.centroIds;
  if (f.centroId) centroIds = centroIds.filter((c) => c === f.centroId);
  if (f.sociedadId) {
    const deSociedad = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, sociedadId: f.sociedadId, id: { in: centroIds } }, select: { id: true } });
    centroIds = deSociedad.map((c) => c.id);
  }
  if (centroIds.length === 0) return [];
  const hasta = f.hasta ? aFecha(f.hasta).getTime() + DIA_MS : Date.now() + DIA_MS;
  const compras = await prisma.pedidoCompra.findMany({
    where: { tenantId: ctx.tenant.id, centroId: { in: centroIds }, estado: { in: [...ESTADOS_RECIBIDO] }, recibidoEn: { gte: new Date(Date.now() - (f.dias ?? 120) * DIA_MS) }, ...(f.proveedorId ? { proveedorId: f.proveedorId } : {}) },
    select: { id: true, numero: true, albaran: true, notas: true, recibidoEn: true, centroId: true, estado: true, proveedorId: true, proveedor: { select: { nombre: true } }, centro: { select: { nombre: true } }, lineas: { select: { cantidad: true, recibida: true, precio: true } } },
    orderBy: { recibidoEn: "asc" },
  });
  const ya = await facturasDeAlbaranes(ctx.tenant.id, compras.map((c) => c.id));
  const libres = compras.filter((c) => !ya.has(c.id));
  // última factura (sin abonos) de cada proveedor y centro antes de la fecha
  const ultimas = libres.length
    ? await prisma.facturaRecibida.groupBy({
        by: ["proveedorId", "centroId"],
        where: { tenantId: ctx.tenant.id, estado: { not: "ANULADA" }, total: { gt: 0 }, proveedorId: { in: Array.from(new Set(libres.map((c) => c.proveedorId))) }, centroId: { in: centroIds }, fecha: { lt: new Date(hasta) } },
        _max: { fecha: true },
      })
    : [];
  return libres.map((c) => {
    const ultima = ultimas.find((u) => u.proveedorId === c.proveedorId && u.centroId === c.centroId)?._max.fecha;
    const t = c.recibidoEn!.getTime();
    return {
      id: c.id,
      numero: c.numero,
      albaran: c.albaran,
      albaranProveedor: /Albarán del proveedor: (\S+)/.exec(c.notas ?? "")?.[1] ?? null,
      recibidoEn: c.recibidoEn!,
      centroId: c.centroId,
      centro: c.centro.nombre,
      proveedorId: c.proveedorId,
      proveedor: c.proveedor.nombre,
      estado: c.estado,
      base: baseAlbaran(c.lineas),
      propuesto: t < hasta && (!ultima || t >= ultima.getTime() + DIA_MS),
    };
  });
}

// ---------- revisión de facturas recibidas: cuadre con los albaranes y duplicadas ----------

export interface AvisoFactura {
  tono: "aviso" | "error";
  texto: string;
}

/** Cuadre de una factura con sus albaranes (lo que enseña la pantalla). */
export interface CuadreFactura {
  /** «enlazada»: con los albaranes elegidos; «por fechas»: con los del proveedor y centro desde su factura anterior. */
  modo: "enlazada" | "por fechas";
  albaranes: { id: string; numero: string; albaran: string | null; recibidoEn: Date; centroId: string; base: number; otraFactura: string | null }[];
  /** Totales sin IVA (solo con albaranes enlazados). */
  totales: { facturado: number; albaranes: number; diferencia: number } | null;
  /** Base por tipo de IVA (solo con albaranes enlazados). */
  porIva: { tipo: number; facturado: number; albaranes: number; diferencia: number }[];
  /** Línea a línea por producto. */
  lineas: { concepto: string; cantidadFacturada: number; cantidadRecibida: number; precioFacturado: number | null; precioAlbaran: number | null; diferencia: number }[];
  /** Albaranes del periodo del mismo proveedor y centro sin factura (¿faltan en esta?). */
  faltan: { id: string; numero: string; albaran: string | null; recibidoEn: Date; base: number }[];
}

export interface RevisionFactura {
  avisos: AvisoFactura[];
  cuadre: CuadreFactura | null;
}

type FacturaParaRevisar = {
  id: string;
  numero: string;
  numeroProveedor: string;
  proveedorId: string | null;
  proveedorNombre: string;
  sociedadId: string;
  centroId: string | null;
  fecha: Date;
  base?: Prisma.Decimal | number;
  total: Prisma.Decimal | number;
  estado: string;
  pedidoCompraId: string | null;
  albaranes?: { pedidoCompraId: string }[];
  lineas: { concepto: string; cantidad: Prisma.Decimal | number; precio: Prisma.Decimal | number; tipoIva?: Prisma.Decimal | number; productoId: string | null }[];
};

/** Número de factura sin guiones, barras ni espacios, para comparar «FHL-26/00395» con «FHL2600395». */
const numeroLimpio = (n: string) => n.toUpperCase().replace(/[^A-Z0-9]/g, "");
const DIA_MS = 86_400_000;
/** Tolerancia para dar por buena una diferencia de importe: 5 céntimos o el 0,5 %. */
const tolerancia = (importe: number) => Math.max(0.05, Math.abs(importe) * 0.005);
const conSigno = (d: number) => `${d > 0 ? "+" : ""}${euros(d)}`;

/**
 * Revisión de las facturas recibidas (idea aceptada «La factura no cuadra», catalogo.md §11). Para cada factura:
 * 1. Posible duplicada: otra no anulada del mismo proveedor y sociedad con el mismo número (sin signos) o con el
 *    mismo total y fecha a menos de 3 días.
 * 2. Con albaranes enlazados (uno o varios: semanales, quincenales o mensuales): cuadre completo con ESOS albaranes:
 *    total sin IVA, base por tipo de IVA, línea a línea por producto (cantidad y precio), productos recibidos que no
 *    están facturados, albaranes del periodo del mismo proveedor y centro que siguen sin factura (¿faltan?) y
 *    albaranes que están también en otra factura (enlaces antiguos).
 * 3. Sin albaranes enlazados: se cruza por fechas con las compras recibidas del mismo proveedor y centro desde su
 *    factura anterior (sin abonos) hasta su fecha (si no hay anterior, 40 días): solo los productos facturados
 *    (precio y cantidad), y se avisa si esos albaranes ya están en otra factura.
 * Las diferencias de importe por debajo de 5 céntimos o del 0,5 % se dan por buenas. Los abonos (cantidad negativa) no se cruzan.
 * No hay tarifa pactada con los proveedores en el ERP: el precio se compara con el del albarán.
 */
export async function revisarFacturasRecibidas(tenantId: string, facturas: FacturaParaRevisar[]): Promise<Map<string, RevisionFactura>> {
  const res = new Map<string, RevisionFactura>();
  const activas = facturas.filter((f) => f.estado !== "ANULADA");
  if (activas.length === 0) return res;
  const prisma = await db();
  const tiempos = activas.map((f) => f.fecha.getTime());
  const minF = Math.min(...tiempos);
  const maxF = Math.max(...tiempos);
  const de = (id: string) => {
    const r = res.get(id) ?? { avisos: [], cuadre: null };
    res.set(id, r);
    return r;
  };
  const anadir = (id: string, a: AvisoFactura) => de(id).avisos.push(a);

  // 1) Posibles duplicadas
  const otras = await prisma.facturaRecibida.findMany({
    where: { tenantId, estado: { not: "ANULADA" }, proveedorNombre: { in: Array.from(new Set(activas.map((f) => f.proveedorNombre))) }, fecha: { gte: new Date(minF - 5 * DIA_MS), lte: new Date(maxF + 5 * DIA_MS) } },
    select: { id: true, numero: true, numeroProveedor: true, proveedorNombre: true, sociedadId: true, fecha: true, total: true },
  });
  for (const f of activas) {
    const igual = otras.find(
      (o) =>
        o.id !== f.id &&
        o.sociedadId === f.sociedadId &&
        o.proveedorNombre === f.proveedorNombre &&
        (numeroLimpio(o.numeroProveedor) === numeroLimpio(f.numeroProveedor) || (Number(o.total) === Number(f.total) && Math.abs(o.fecha.getTime() - f.fecha.getTime()) <= 3 * DIA_MS)),
    );
    if (igual) anadir(f.id, { tono: "error", texto: `Posible duplicada de ${igual.numero} (nº del proveedor ${igual.numeroProveedor}, ${fechaEs(igual.fecha)}, ${euros(igual.total)}). Si es la misma, anula una de las dos.` });
  }

  // Albaranes de cada factura: enlazados o, si no tiene, los del proveedor y centro por fechas
  const enlazadas = activas.filter((f) => albaranesDe(f).length > 0);
  // (los abonos, sin líneas en positivo, no se cruzan)
  const porFechas = activas.filter((f) => albaranesDe(f).length === 0 && f.proveedorId && f.centroId && f.lineas.some((l) => l.productoId && Number(l.cantidad) > 0));
  const idsEnlazados = Array.from(new Set(enlazadas.flatMap(albaranesDe)));
  const proveedorIds = Array.from(new Set([...enlazadas, ...porFechas].map((f) => f.proveedorId).filter((x): x is string => !!x)));
  const seleccion = { id: true, numero: true, albaran: true, recibidoEn: true, centroId: true, proveedorId: true, lineas: { select: { productoId: true, cantidad: true, recibida: true, precio: true, producto: { select: { nombre: true, iva: true } } } } } as const;
  const [compras, anteriores] = await Promise.all([
    prisma.pedidoCompra.findMany({
      where: {
        tenantId,
        estado: { in: [...ESTADOS_RECIBIDO] },
        OR: [{ id: { in: idsEnlazados } }, ...(proveedorIds.length ? [{ proveedorId: { in: proveedorIds }, recibidoEn: { gte: new Date(minF - 120 * DIA_MS), lte: new Date(maxF + DIA_MS) } }] : [])],
      },
      select: seleccion,
    }),
    // facturas anteriores (sin abonos) para saber desde cuándo cuenta cada factura que se cruza por fechas
    proveedorIds.length
      ? prisma.facturaRecibida.findMany({
          where: { tenantId, proveedorId: { in: proveedorIds }, estado: { not: "ANULADA" }, total: { gt: 0 }, fecha: { gte: new Date(minF - 120 * DIA_MS), lt: new Date(maxF) } },
          select: { id: true, proveedorId: true, centroId: true, fecha: true },
        })
      : Promise.resolve([]),
  ]);
  const compraPorId = new Map(compras.map((c) => [c.id, c]));
  const facturadas = await facturasDeAlbaranes(tenantId, compras.map((c) => c.id));
  type Compra = (typeof compras)[number];
  const fichaAlbaran = (c: Compra, f: FacturaParaRevisar) => ({
    id: c.id,
    numero: c.numero,
    albaran: c.albaran,
    recibidoEn: c.recibidoEn!,
    centroId: c.centroId,
    base: baseAlbaran(c.lineas),
    otraFactura: (facturadas.get(c.id) ?? []).filter((x) => x.id !== f.id).map((x) => x.numero).join(", ") || null,
  });

  /** Línea a línea por producto. `completo`: también lo recibido que no está facturado. */
  const cruzarLineas = (f: FacturaParaRevisar, suyas: Compra[], completo: boolean) => {
    const lineas: CuadreFactura["lineas"] = [];
    const avisos: AvisoFactura[] = [];
    let diferencia = 0;
    const facturado = new Map<string, { concepto: string; cantidad: number; importe: number; lineas: { cantidad: number; precio: number }[] }>();
    for (const l of f.lineas) {
      const cantidad = Number(l.cantidad);
      if (!l.productoId || cantidad <= 0) continue; // los abonos no se cruzan
      const x = facturado.get(l.productoId) ?? { concepto: l.concepto, cantidad: 0, importe: 0, lineas: [] };
      x.cantidad += cantidad;
      x.importe += cantidad * Number(l.precio);
      x.lineas.push({ cantidad, precio: Number(l.precio) });
      facturado.set(l.productoId, x);
    }
    const recibido = new Map<string, { concepto: string; cantidad: number; importe: number; precios: number[] }>();
    for (const c of suyas)
      for (const l of c.lineas) {
        const cantidad = Number(l.recibida ?? l.cantidad);
        if (cantidad <= 0 || (!completo && !facturado.has(l.productoId))) continue;
        const x = recibido.get(l.productoId) ?? { concepto: l.producto.nombre, cantidad: 0, importe: 0, precios: [] };
        x.cantidad += cantidad;
        x.importe += cantidad * Number(l.precio);
        x.precios.push(Number(l.precio));
        recibido.set(l.productoId, x);
      }
    for (const productoId of new Set([...facturado.keys(), ...recibido.keys()])) {
      const fa = facturado.get(productoId);
      const re = recibido.get(productoId);
      const concepto = fa?.concepto ?? re!.concepto;
      const pF = fa && fa.cantidad > 0 ? fa.importe / fa.cantidad : null;
      const pA = re && re.cantidad > 0 ? re.importe / re.cantidad : null;
      const cantF = fa?.cantidad ?? 0;
      const cantR = re?.cantidad ?? 0;
      const d = redondear((fa?.importe ?? 0) - (re?.importe ?? 0));
      lineas.push({ concepto, cantidadFacturada: cantF, cantidadRecibida: cantR, precioFacturado: pF, precioAlbaran: pA, diferencia: d });
      if (!re) {
        avisos.push({ tono: "aviso", texto: `${concepto}: no está en ${completo ? "sus albaranes" : "los albaranes de compra de este proveedor desde su factura anterior"}.` });
        diferencia += d;
        continue;
      }
      if (!fa) {
        avisos.push({ tono: "aviso", texto: `${concepto}: recibido ${numeroEs(cantR, 3)} en los albaranes y no está en la factura (${euros(-d)}).` });
        diferencia += d;
        continue;
      }
      // precio: cada línea de la factura se compara con los precios de los albaranes (avisa si no coincide con
      // ninguno por más del 0,5 %; la diferencia se calcula con el precio de albarán más cercano)
      let dPrecio = 0;
      for (const lf of fa.lineas) {
        if (re.precios.some((p) => Math.abs(p - lf.precio) <= Math.max(0.01, p * 0.005))) continue;
        const cercano = re.precios.reduce((m, p) => (Math.abs(p - lf.precio) < Math.abs(m - lf.precio) ? p : m));
        const dp = redondear((lf.precio - cercano) * lf.cantidad);
        dPrecio += dp;
        avisos.push({ tono: "aviso", texto: `${concepto}: facturado a ${euros(lf.precio, 4)} y en ${re.precios.length > 1 ? "los albaranes" : "el albarán"} a ${euros(cercano, 4)} (${conSigno(dp)}).` });
      }
      diferencia += dPrecio;
      if (Math.abs(cantF - cantR) > 0.0005) {
        const dc = redondear(d - dPrecio);
        diferencia += dc;
        avisos.push({ tono: "aviso", texto: `${concepto}: facturado ${numeroEs(cantF, 3)} y recibido ${numeroEs(cantR, 3)} (${conSigno(dc)}).` });
      }
    }
    lineas.sort((a, b) => a.concepto.localeCompare(b.concepto, "es"));
    return { lineas, avisos, diferencia: redondear(diferencia) };
  };

  // 2) Facturas con albaranes enlazados: cuadre completo
  for (const f of enlazadas) {
    const suyas = albaranesDe(f)
      .map((id) => compraPorId.get(id))
      .filter((c): c is Compra => !!c);
    const albaranes = suyas.map((c) => fichaAlbaran(c, f)).sort((a, b) => a.recibidoEn.getTime() - b.recibidoEn.getTime());
    const avisos: AvisoFactura[] = [];
    if (suyas.length < albaranesDe(f).length) avisos.push({ tono: "aviso", texto: "Algún albarán enlazado ya no está recibido (¿se anuló la compra?)." });
    // totales y base por tipo de IVA
    const porIva = new Map<number, { tipo: number; facturado: number; albaranes: number; diferencia: number }>();
    const iva = (t: number) => porIva.get(t) ?? porIva.set(t, { tipo: t, facturado: 0, albaranes: 0, diferencia: 0 }).get(t)!;
    for (const l of f.lineas) iva(Number(l.tipoIva ?? 0)).facturado += Number(l.cantidad) * Number(l.precio);
    for (const c of suyas) for (const l of c.lineas) iva(Number(l.producto.iva)).albaranes += Number(l.recibida ?? l.cantidad) * Number(l.precio);
    const ivas = Array.from(porIva.values())
      .map((x) => ({ tipo: x.tipo, facturado: redondear(x.facturado), albaranes: redondear(x.albaranes), diferencia: redondear(x.facturado - x.albaranes) }))
      .sort((a, b) => b.tipo - a.tipo);
    const facturado = redondear(ivas.reduce((s, x) => s + x.facturado, 0));
    const recibido = redondear(albaranes.reduce((s, a) => s + a.base, 0));
    const dTotal = redondear(facturado - recibido);
    const conProducto = f.lineas.some((l) => l.productoId);
    const cruce = conProducto ? cruzarLineas(f, suyas, true) : { lineas: [], avisos: [], diferencia: 0 };
    if (conProducto && f.lineas.some((l) => !l.productoId && Number(l.cantidad) > 0)) avisos.push({ tono: "aviso", texto: "Hay líneas sin producto: solo cuentan en el total, no en el cruce por producto." });
    avisos.push(...cruce.avisos);
    if (Math.abs(dTotal) <= tolerancia(recibido))
      for (const x of ivas)
        if (Math.abs(x.diferencia) > tolerancia(x.albaranes)) avisos.push({ tono: "aviso", texto: `IVA del ${numeroEs(x.tipo)} %: base facturada ${euros(x.facturado)} y en los albaranes ${euros(x.albaranes)} (${conSigno(x.diferencia)}): ¿tipo de IVA distinto?` });
    for (const a of albaranes) if (a.otraFactura) avisos.push({ tono: "error", texto: `El albarán ${a.albaran ?? a.numero} está también en la factura ${a.otraFactura}: un albarán solo se factura una vez.` });
    // albaranes del periodo del mismo proveedor y centros que siguen sin factura: desde el día siguiente a la factura
    // anterior del proveedor en esos centros (o el primer albarán enlazado, si es anterior) hasta la fecha de la factura
    const centros = new Set(albaranes.map((a) => a.centroId));
    const primero = Math.min(...albaranes.map((a) => aFecha(a.recibidoEn.toISOString().slice(0, 10)).getTime()));
    const previa = anteriores.filter((a) => a.id !== f.id && a.proveedorId === f.proveedorId && a.centroId && centros.has(a.centroId) && a.fecha < f.fecha).reduce<number | null>((m, a) => Math.max(m ?? 0, a.fecha.getTime()), null);
    const desde = Math.min(primero, previa !== null ? previa + DIA_MS : primero);
    const hasta = f.fecha.getTime() + DIA_MS;
    const faltan = compras
      .filter((c) => c.proveedorId === f.proveedorId && centros.has(c.centroId) && !albaranesDe(f).includes(c.id) && !facturadas.has(c.id) && c.recibidoEn!.getTime() >= desde && c.recibidoEn!.getTime() < hasta)
      .map((c) => ({ id: c.id, numero: c.numero, albaran: c.albaran, recibidoEn: c.recibidoEn!, base: baseAlbaran(c.lineas) }));
    for (const x of faltan) avisos.push({ tono: "aviso", texto: `El albarán ${x.albaran ?? x.numero} del ${fechaEs(x.recibidoEn)} (${euros(x.base)} sin IVA) es del mismo periodo y no está en ninguna factura: ¿falta en esta?` });
    const noCuadra = Math.abs(dTotal) > tolerancia(recibido) || cruce.avisos.length > 0;
    if (noCuadra)
      avisos.unshift({
        tono: "error",
        texto: `La factura no cuadra con ${albaranes.length === 1 ? `su albarán ${albaranes[0]?.albaran ?? albaranes[0]?.numero}` : `sus ${albaranes.length} albaranes`}: facturado ${euros(facturado)} y recibido ${euros(recibido)} sin IVA (${conSigno(dTotal)}${dTotal > 0 ? ", para reclamar un abono" : ""}).`,
      });
    const r = de(f.id);
    r.avisos.push(...avisos);
    r.cuadre = { modo: "enlazada", albaranes, totales: { facturado, albaranes: recibido, diferencia: dTotal }, porIva: ivas, lineas: cruce.lineas, faltan };
  }

  // 3) Sin albaranes enlazados: por fechas desde la factura anterior del proveedor en ese centro
  for (const f of porFechas) {
    const previa = anteriores.filter((a) => a.proveedorId === f.proveedorId && a.centroId === f.centroId && a.fecha < f.fecha).reduce<number | null>((m, a) => Math.max(m ?? 0, a.fecha.getTime()), null);
    const desde = previa !== null ? previa + DIA_MS : f.fecha.getTime() - 40 * DIA_MS;
    const hasta = f.fecha.getTime() + DIA_MS;
    const productos = new Set(f.lineas.map((l) => l.productoId).filter(Boolean));
    const suyas = compras.filter(
      (c) => c.proveedorId === f.proveedorId && c.centroId === f.centroId && c.recibidoEn!.getTime() >= desde && c.recibidoEn!.getTime() < hasta && c.lineas.some((l) => productos.has(l.productoId)),
    );
    const cruce = cruzarLineas(f, suyas, false);
    const albaranes = suyas.map((c) => fichaAlbaran(c, f)).sort((a, b) => a.recibidoEn.getTime() - b.recibidoEn.getTime());
    const avisos: AvisoFactura[] = [];
    if (cruce.avisos.length) {
      avisos.push({ tono: "error", texto: `La factura no cuadra con los albaranes${cruce.diferencia ? `: ${euros(Math.abs(cruce.diferencia))} sin IVA ${cruce.diferencia > 0 ? "de más (para reclamar un abono)" : "de menos"}` : ""}.` });
      avisos.push(...cruce.avisos);
    }
    const yaFacturados = albaranes.filter((a) => a.otraFactura);
    if (yaFacturados.length)
      avisos.push({ tono: "aviso", texto: `${yaFacturados.length === 1 ? "El albarán" : "Los albaranes"} ${yaFacturados.map((a) => `${a.albaran ?? a.numero} (en ${a.otraFactura})`).join(", ")} ya ${yaFacturados.length === 1 ? "está" : "están"} en otra factura: ¿es la misma factura?` });
    const r = de(f.id);
    r.avisos.push(...avisos);
    r.cuadre = { modo: "por fechas", albaranes, totales: null, porIva: [], lineas: cruce.lineas, faltan: [] };
  }
  // solo las que tienen algo que decir o cuadre que enseñar
  for (const [id, r] of res) if (r.avisos.length === 0 && !r.cuadre) res.delete(id);
  return res;
}

/** Qué etiqueta lleva una factura revisada: «¿Duplicada?», «No cuadra», «Revisar» (solo avisos) o nada. */
export function etiquetaRevision(r: RevisionFactura | undefined): "¿Duplicada?" | "No cuadra" | "Revisar" | null {
  if (!r || r.avisos.length === 0) return null;
  if (r.avisos.some((a) => a.texto.startsWith("Posible duplicada"))) return "¿Duplicada?";
  if (r.avisos.some((a) => a.tono === "error")) return "No cuadra";
  return "Revisar";
}

/** Factura recibida en la que está un albarán (compra), para la ficha de la compra. */
export async function facturaDeCompra(tenantId: string, compraId: string) {
  const ya = await facturasDeAlbaranes(tenantId, [compraId]);
  return ya.get(compraId)?.[0] ?? null;
}

// ---------- facturas emitidas (solo preparadas: NO certificadas) ----------

export async function listarFacturasEmitidas(ctx: Contexto, f: FiltroFacturas = {}) {
  const prisma = await db();
  const a = await ambito(ctx);
  const where: Prisma.FacturaEmitidaWhereInput = { ...a.donde(f.sociedadId) };
  if (f.estado) where.estado = f.estado as Prisma.FacturaEmitidaWhereInput["estado"];
  if (f.mes) {
    const r = rangoMes(f.mes);
    where.fecha = { gte: r.desde, lt: r.hasta };
  }
  return prisma.facturaEmitida.findMany({ where, include: { lineas: { orderBy: { orden: "asc" } }, pedidos: { select: { pedidoInternoId: true, base: true } } }, orderBy: [{ fecha: "desc" }, { referencia: "desc" }], take: 500 });
}

/** Pedidos internos (número, albarán, área) y espejo recibido de unas facturas emitidas entre sociedades, para enseñarlos. */
export async function detalleEntreSociedades(tenantId: string, facturaIds: string[]) {
  const prisma = await db();
  if (facturaIds.length === 0) return { pedidos: new Map<string, { id: string; numero: string; albaran: string | null; area: string }>(), espejos: new Map<string, { numero: string; estado: string }>() };
  const [enlaces, espejos] = await Promise.all([
    prisma.facturaEmitidaPedido.findMany({ where: { tenantId, facturaId: { in: facturaIds } }, select: { pedidoInternoId: true } }),
    prisma.facturaRecibida.findMany({ where: { tenantId, facturaEmitidaId: { in: facturaIds } }, select: { numero: true, estado: true, facturaEmitidaId: true } }),
  ]);
  const pedidos = await prisma.pedidoInterno.findMany({ where: { tenantId, id: { in: enlaces.map((e) => e.pedidoInternoId) } }, select: { id: true, numero: true, albaran: true, area: true } });
  return { pedidos: new Map(pedidos.map((p) => [p.id, p])), espejos: new Map(espejos.map((e) => [e.facturaEmitidaId!, { numero: e.numero, estado: e.estado }])) };
}

export async function crearFacturaEmitida(ctx: Contexto, entrada: unknown) {
  const d = FacturaEmitidaEsquema.parse(entrada);
  await comprobarSociedadCentro(ctx, d.sociedadId, d.centroId);
  if (d.origen === "ENTRE_SOCIEDADES" && !d.sociedadDestinoId) throw new ErrorContable("Indica la sociedad del grupo que recibe la factura.");
  if (d.sociedadDestinoId === d.sociedadId) throw new ErrorContable("La sociedad que factura y la que recibe no pueden ser la misma (eso es un traspaso interno, sin factura).");
  const c = calcularLineas(d.lineas);
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    // Referencia interna de borrador: NO es un número de factura (la serie oficial la da el programa certificado)
    const referencia = await siguienteNumero(tx, ctx.tenant.id, "PRE");
    const f = await tx.facturaEmitida.create({
      data: {
        tenantId: ctx.tenant.id,
        referencia,
        sociedadId: d.sociedadId,
        centroId: d.centroId,
        origen: d.origen,
        clienteNombre: d.clienteNombre,
        clienteCif: d.clienteCif,
        sociedadDestinoId: d.sociedadDestinoId,
        fecha: aFecha(d.fecha),
        vencimiento: d.vencimiento ? aFecha(d.vencimiento) : null,
        base: c.base,
        cuotaIva: c.cuotaIva,
        total: c.total,
        estado: "PREPARADA",
        notas: d.notas,
        creadoPor: ctx.usuario.id,
        lineas: { create: c.lineas.map((l) => ({ concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, tipoIva: l.tipoIva, base: l.base, cuotaIva: l.cuotaIva, orden: l.orden })) },
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: f.id, accion: "preparar", despues: { referencia, total: c.total } });
    return f;
  });
}

// ---------- facturas del obrador a los locales (entre sociedades) ----------

const DEPENDENCIAS_FACTURACION: Dependencias = { numerar: (tx, tenantId, serie) => siguienteNumero(tx, tenantId, serie), auditar };

/** Obradores y almacenes centrales del ámbito del usuario (los que pueden facturar a los locales). */
async function origenesFacturables(ctx: Contexto) {
  const prisma = await db();
  const a = await ambito(ctx);
  const centros = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: a.centroIds }, tipo: { in: ["OBRADOR", "ALMACEN"] } }, select: { id: true } });
  return centros.map((c) => c.id);
}

/** Vista previa de lo que se facturaría de un mes (pedidos internos recibidos y aún sin factura). */
export async function vistaFacturacionObrador(ctx: Contexto, mes: string): Promise<VistaFacturacion> {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErrorContable("Mes no válido.");
  const prisma = await db();
  return prepararFacturacionObrador(prisma, ctx.tenant.id, mes, await origenesFacturables(ctx));
}

/** Genera las facturas del obrador a los locales de un mes (todas o las de unos locales). */
export async function facturarPedidosObrador(ctx: Contexto, mes: string, destinoIds?: string[]) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErrorContable("Mes no válido.");
  const origenes = await origenesFacturables(ctx);
  if (origenes.length === 0) throw new ErrorContable("No ves ningún obrador ni almacén central: elige arriba «Todos mis centros» o el obrador.");
  const prisma = await db();
  try {
    return await prisma.$transaction((tx) => generarFacturasObrador(tx, ctx.tenant.id, ctx.usuario.id, mes, origenes, DEPENDENCIAS_FACTURACION, { destinoIds }), { timeout: 60_000 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ErrorContable("Alguno de esos pedidos se acaba de facturar desde otra pantalla: vuelve a cargar la vista previa.");
    if (e instanceof Error && e.message.startsWith("No hay ninguna categoría")) throw new ErrorContable(e.message);
    throw e;
  }
}

/** Situación de facturación de un pedido interno (para su ficha en Bebidas o Comidas). */
export type FacturacionPedido =
  | { tipo: "misma-sociedad" }
  | { tipo: "sin-sociedad" }
  | { tipo: "facturado"; referencia: string; numeroOficial: string | null; estado: string; espejo: string | null }
  | { tipo: "por-facturar" }
  | { tipo: "al-recibir" }
  | { tipo: "no-aplica" };

export async function facturacionDePedidoInterno(tenantId: string, pedidoId: string): Promise<FacturacionPedido> {
  const prisma = await db();
  const p = await prisma.pedidoInterno.findFirst({ where: { id: pedidoId, tenantId }, select: { estado: true, origen: { select: { sociedadId: true } }, destino: { select: { sociedadId: true } } } });
  if (!p) return { tipo: "no-aplica" };
  const enlace = await prisma.facturaEmitidaPedido.findFirst({ where: { tenantId, pedidoInternoId: pedidoId }, select: { factura: { select: { id: true, referencia: true, numeroOficial: true, estado: true } } } });
  if (enlace) {
    const espejo = await prisma.facturaRecibida.findFirst({ where: { tenantId, facturaEmitidaId: enlace.factura.id }, select: { numero: true } });
    return { tipo: "facturado", referencia: enlace.factura.referencia, numeroOficial: enlace.factura.numeroOficial, estado: enlace.factura.estado, espejo: espejo?.numero ?? null };
  }
  if (!p.origen.sociedadId || !p.destino.sociedadId) return { tipo: "sin-sociedad" };
  if (p.origen.sociedadId === p.destino.sociedadId) return { tipo: "misma-sociedad" };
  if (p.estado === "RECIBIDO") return { tipo: "por-facturar" };
  if (p.estado === "SERVIDO" || p.estado === "PENDIENTE") return { tipo: "al-recibir" };
  return { tipo: "no-aplica" };
}

async function facturaEmitidaDelAmbito(ctx: Contexto, id: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const f = await prisma.facturaEmitida.findFirst({ where: { id, ...a.donde() } });
  if (!f) throw new ErrorContable("Factura no encontrada.");
  return f;
}

/** Apunta el número oficial que dio el programa certificado (y lo copia al espejo recibido, si lo hay). */
export async function marcarEmitidaFuera(ctx: Contexto, entrada: unknown) {
  const d = EmitidaFueraEsquema.parse(entrada);
  const f = await facturaEmitidaDelAmbito(ctx, d.id);
  if (f.estado !== "PREPARADA" && f.estado !== "BORRADOR") throw new ErrorContable("Esta factura ya no está preparada.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaEmitida.update({ where: { id: f.id }, data: { estado: "EMITIDA_FUERA", numeroOficial: d.numeroOficial, programaEmisor: d.programaEmisor } });
    // el espejo (factura recibida en la sociedad del local) pasa a llevar el número oficial como número del proveedor
    await tx.facturaRecibida.updateMany({ where: { tenantId: ctx.tenant.id, facturaEmitidaId: f.id, estado: { not: "ANULADA" } }, data: { numeroProveedor: d.numeroOficial } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: f.id, accion: "emitida-fuera", despues: d });
  });
}

export async function cobrarFacturaEmitida(ctx: Contexto, entrada: unknown) {
  const d = PagoEsquema.parse(entrada);
  const f = await facturaEmitidaDelAmbito(ctx, d.id);
  if (f.estado !== "EMITIDA_FUERA") throw new ErrorContable("Solo se cobra una factura ya emitida en el programa certificado.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.facturaEmitida.update({ where: { id: f.id }, data: { estado: "COBRADA", cobradaEn: aFecha(d.fecha) } });
    await tx.pagoCobro.create({
      data: { tenantId: ctx.tenant.id, sociedadId: f.sociedadId, tipo: "COBRO", fecha: aFecha(d.fecha), importe: f.total, forma: d.forma, facturaEmitidaId: f.id, referencia: d.referencia, usuarioId: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: f.id, accion: "cobrar", despues: { fecha: d.fecha, forma: d.forma } });
  });
}

/**
 * Anula una factura preparada. Si es una factura del obrador a un local, se anula también su espejo recibido y sus
 * pedidos vuelven a estar por facturar (si el espejo ya está pagado, no se puede).
 */
export async function anularFacturaEmitida(ctx: Contexto, id: string) {
  const f = await facturaEmitidaDelAmbito(ctx, id);
  if (f.estado !== "PREPARADA" && f.estado !== "BORRADOR") throw new ErrorContable("Una factura emitida en el programa certificado se rectifica allí, no aquí.");
  const prisma = await db();
  const [espejos, pedidos] = await Promise.all([
    prisma.facturaRecibida.findMany({ where: { tenantId: ctx.tenant.id, facturaEmitidaId: f.id, estado: { not: "ANULADA" } }, select: { id: true, numero: true, estado: true } }),
    prisma.facturaEmitidaPedido.findMany({ where: { tenantId: ctx.tenant.id, facturaId: f.id }, select: { pedidoInternoId: true } }),
  ]);
  const pagado = espejos.find((e) => e.estado === "PAGADA");
  if (pagado) throw new ErrorContable(`Su espejo ${pagado.numero} ya está pagado por el local: no se anula (habría que hacer un abono).`);
  await prisma.$transaction(async (tx) => {
    await tx.facturaEmitida.update({ where: { id }, data: { estado: "ANULADA" } });
    await tx.facturaEmitidaPedido.deleteMany({ where: { facturaId: id } });
    for (const e of espejos) {
      await tx.facturaRecibida.update({ where: { id: e.id }, data: { estado: "ANULADA" } });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaRecibida", entidadId: e.id, accion: "anular", antes: { estado: e.estado }, despues: { estado: "ANULADA", motivo: `Espejo de ${f.referencia}, anulada` } });
    }
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "FacturaEmitida", entidadId: id, accion: "anular", antes: { estado: f.estado, pedidos: pedidos.map((p) => p.pedidoInternoId) } });
  });
}

// ---------- gastos ----------

export async function listarGastos(ctx: Contexto, f: FiltroFacturas = {}) {
  const prisma = await db();
  const a = await ambito(ctx);
  const where: Prisma.GastoContableWhereInput = { ...a.donde(f.sociedadId) };
  if (f.estado) where.estado = f.estado as Prisma.GastoContableWhereInput["estado"];
  if (f.mes) {
    const r = rangoMes(f.mes);
    where.fecha = { gte: r.desde, lt: r.hasta };
  }
  return prisma.gastoContable.findMany({ where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 500 });
}

export async function crearGasto(ctx: Contexto, entrada: unknown) {
  const d = GastoEsquema.parse(entrada);
  await comprobarSociedadCentro(ctx, d.sociedadId, d.centroId);
  const prisma = await db();
  const cat = await prisma.categoriaContable.findFirst({ where: { id: d.categoriaId, tenantId: ctx.tenant.id } });
  if (!cat) throw new ErrorContable("Categoría no encontrada.");
  const base = redondear(d.base);
  const cuotaIva = redondear((base * d.tipoIva) / 100);
  return prisma.$transaction(async (tx) => {
    const g = await tx.gastoContable.create({
      data: {
        tenantId: ctx.tenant.id,
        sociedadId: d.sociedadId,
        centroId: d.centroId,
        categoriaId: d.categoriaId,
        fecha: aFecha(d.fecha),
        vencimiento: d.vencimiento ? aFecha(d.vencimiento) : null,
        concepto: d.concepto,
        proveedorNombre: d.proveedorNombre,
        base,
        cuotaIva,
        total: redondear(base + cuotaIva),
        recurrente: d.recurrente,
        notas: d.notas,
        creadoPor: ctx.usuario.id,
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: g.id, accion: "crear", despues: { concepto: d.concepto, base } });
    return g;
  });
}

async function gastoDelAmbito(ctx: Contexto, id: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const g = await prisma.gastoContable.findFirst({ where: { id, ...a.donde() } });
  if (!g) throw new ErrorContable("Gasto no encontrado.");
  return g;
}

export async function pagarGasto(ctx: Contexto, entrada: unknown) {
  const d = PagoEsquema.parse(entrada);
  const g = await gastoDelAmbito(ctx, d.id);
  if (g.estado !== "PENDIENTE") throw new ErrorContable("Este gasto no está pendiente.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.gastoContable.update({ where: { id: g.id }, data: { estado: "PAGADO", pagadoEn: aFecha(d.fecha) } });
    await tx.pagoCobro.create({
      data: { tenantId: ctx.tenant.id, sociedadId: g.sociedadId, tipo: "PAGO", fecha: aFecha(d.fecha), importe: g.total, forma: d.forma, gastoId: g.id, referencia: d.referencia, usuarioId: ctx.usuario.id },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: g.id, accion: "pagar", despues: { fecha: d.fecha, forma: d.forma } });
  });
}

export async function anularGasto(ctx: Contexto, id: string) {
  const g = await gastoDelAmbito(ctx, id);
  if (g.estado === "PAGADO") throw new ErrorContable("Un gasto pagado no se anula.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.gastoContable.update({ where: { id }, data: { estado: "ANULADO" } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: id, accion: "anular", antes: { estado: g.estado } });
  });
}

/** Copia al mes indicado los gastos marcados como fijos del mes anterior (si no se copiaron ya). */
export async function copiarGastosFijos(ctx: Contexto, mes: string): Promise<number> {
  const prisma = await db();
  const a = await ambito(ctx);
  const destino = rangoMes(mes);
  const origen = { desde: new Date(Date.UTC(destino.desde.getUTCFullYear(), destino.desde.getUTCMonth() - 1, 1)), hasta: destino.desde };
  const fijos = await prisma.gastoContable.findMany({ where: { ...a.donde(), recurrente: true, estado: { not: "ANULADO" }, fecha: { gte: origen.desde, lt: origen.hasta } } });
  const yaHay = await prisma.gastoContable.findMany({ where: { ...a.donde(), recurrente: true, fecha: { gte: destino.desde, lt: destino.hasta } }, select: { concepto: true, centroId: true, sociedadId: true } });
  const clave = (g: { concepto: string; centroId: string | null; sociedadId: string }) => `${g.sociedadId}|${g.centroId}|${g.concepto}`;
  const existentes = new Set(yaHay.map(clave));
  const nuevos = fijos.filter((g) => !existentes.has(clave(g)));
  if (nuevos.length === 0) return 0;
  const desplazar = (d: Date | null) => (d ? new Date(Date.UTC(destino.desde.getUTCFullYear(), destino.desde.getUTCMonth(), Math.min(d.getUTCDate(), 28))) : null);
  await prisma.$transaction(async (tx) => {
    for (const g of nuevos) {
      const n = await tx.gastoContable.create({
        data: {
          tenantId: g.tenantId,
          sociedadId: g.sociedadId,
          centroId: g.centroId,
          categoriaId: g.categoriaId,
          fecha: desplazar(g.fecha)!,
          vencimiento: desplazar(g.vencimiento),
          concepto: g.concepto,
          proveedorNombre: g.proveedorNombre,
          base: g.base,
          cuotaIva: g.cuotaIva,
          total: g.total,
          recurrente: true,
          creadoPor: ctx.usuario.id,
          notas: `Copiado del mes anterior`,
        },
      });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "GastoContable", entidadId: n.id, accion: "copiar-fijo", despues: { desde: g.id } });
    }
  });
  return nuevos.length;
}

// ---------- vencimientos ----------

export interface Vencimiento {
  tipo: "PAGO" | "COBRO";
  origen: "factura-recibida" | "gasto" | "factura-emitida";
  id: string;
  documento: string;
  tercero: string;
  sociedadId: string;
  centroId: string | null;
  vencimiento: Date | null;
  total: number;
  estado: string;
  vencido: boolean;
}

/** Lo pendiente de pagar o cobrar que vence hasta la fecha indicada (incluye lo ya vencido y lo que no tiene fecha). */
export async function vencimientos(ctx: Contexto, hastaISO: string, sociedadId?: string): Promise<Vencimiento[]> {
  const prisma = await db();
  const a = await ambito(ctx);
  const hasta = aFecha(hastaISO);
  const hoy = aFecha(hoyISO());
  const fechaVence = { OR: [{ vencimiento: { lte: hasta } }, { vencimiento: null }] };
  const [recibidas, gastos, emitidas] = await Promise.all([
    prisma.facturaRecibida.findMany({ where: { ...a.donde(sociedadId), estado: { in: ["PENDIENTE", "VALIDADA"] }, AND: [fechaVence] } }),
    prisma.gastoContable.findMany({ where: { ...a.donde(sociedadId), estado: "PENDIENTE", AND: [fechaVence] } }),
    prisma.facturaEmitida.findMany({ where: { ...a.donde(sociedadId), estado: "EMITIDA_FUERA", AND: [fechaVence] } }),
  ]);
  const lista: Vencimiento[] = [
    ...recibidas.map((f) => ({ tipo: "PAGO" as const, origen: "factura-recibida" as const, id: f.id, documento: `${f.numero} · ${f.numeroProveedor}`, tercero: f.proveedorNombre, sociedadId: f.sociedadId, centroId: f.centroId, vencimiento: f.vencimiento, total: Number(f.total), estado: f.estado, vencido: !!f.vencimiento && f.vencimiento < hoy })),
    ...gastos.map((g) => ({ tipo: "PAGO" as const, origen: "gasto" as const, id: g.id, documento: g.concepto, tercero: g.proveedorNombre ?? "—", sociedadId: g.sociedadId, centroId: g.centroId, vencimiento: g.vencimiento, total: Number(g.total), estado: g.estado, vencido: !!g.vencimiento && g.vencimiento < hoy })),
    ...emitidas.map((f) => ({ tipo: "COBRO" as const, origen: "factura-emitida" as const, id: f.id, documento: f.numeroOficial ?? f.referencia, tercero: f.clienteNombre, sociedadId: f.sociedadId, centroId: f.centroId, vencimiento: f.vencimiento, total: Number(f.total), estado: f.estado, vencido: !!f.vencimiento && f.vencimiento < hoy })),
  ];
  return lista.sort((x, y) => (x.vencimiento?.getTime() ?? 0) - (y.vencimiento?.getTime() ?? 0));
}

/** Fecha ISO del domingo de esta semana (fin de la semana en curso). */
export function finDeSemanaISO(): string {
  const hoy = aFecha(hoyISO());
  const dia = hoy.getUTCDay(); // 0 domingo
  const sumar = dia === 0 ? 0 : 7 - dia;
  return new Date(hoy.getTime() + sumar * 86400000).toISOString().slice(0, 10);
}

// ---------- resumen por sociedad ----------

export async function resumenPorSociedad(ctx: Contexto, mes: string) {
  const prisma = await db();
  const a = await ambito(ctx);
  const r = rangoMes(mes);
  const [porPagarFR, porPagarG, porCobrar, gastosMes, recibidasMes, pendientesRevisar] = await Promise.all([
    prisma.facturaRecibida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: { in: ["PENDIENTE", "VALIDADA"] } }, _sum: { total: true } }),
    prisma.gastoContable.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: "PENDIENTE" }, _sum: { total: true } }),
    prisma.facturaEmitida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: "EMITIDA_FUERA" }, _sum: { total: true } }),
    prisma.gastoContable.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: { not: "ANULADO" }, fecha: { gte: r.desde, lt: r.hasta } }, _sum: { base: true } }),
    prisma.facturaRecibida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: { not: "ANULADA" }, fecha: { gte: r.desde, lt: r.hasta } }, _sum: { base: true } }),
    prisma.facturaRecibida.groupBy({ by: ["sociedadId"], where: { ...a.donde(), estado: "PENDIENTE" }, _count: { _all: true } }),
  ]);
  const sociedades = await prisma.sociedad.findMany({ where: { tenantId: ctx.tenant.id, id: { in: a.sociedadIds } }, orderBy: { razonSocial: "asc" } });
  const v = (lista: { sociedadId: string; _sum: Record<string, unknown> }[], id: string, campo: string) => Number((lista.find((x) => x.sociedadId === id)?._sum[campo] as number | null) ?? 0);
  const nominas = await nominasPorSociedad(ctx, a, mes);
  return sociedades.map((s) => ({
    sociedad: s,
    porPagar: redondear(v(porPagarFR, s.id, "total") + v(porPagarG, s.id, "total")),
    porCobrar: v(porCobrar, s.id, "total"),
    gastosMes: v(gastosMes, s.id, "base"),
    comprasMes: v(recibidasMes, s.id, "base"),
    pendientesRevisar: pendientesRevisar.find((x) => x.sociedadId === s.id)?._count._all ?? 0,
    /** null = Personal no contratado o sin permiso para ver nóminas. */
    nominas: nominas ? { ...(nominas.nominas.get(s.id) ?? { costeEmpresa: 0, empleados: 0, borradores: 0 }), apuntado: nominas.apuntado.get(s.id) ?? 0 } : null,
  }));
}

/**
 * Nóminas del mes que llegan desde Personal (coste empresa por sociedad, sumando sus centros) y lo apuntado
 * en Contabilidad como personal, para compararlos. Solo se informa: no se suma a «gastos» ni al Cuadro desde
 * aquí (el Cuadro lee las nóminas de Personal directamente), para no contar dos veces.
 */
async function nominasPorSociedad(ctx: Contexto, a: Ambito, mes: string) {
  if (!ctx.tieneModulo("personal") || !(ctx.puede("personal:nominas:ver") || ctx.puede("personal:costes:ver"))) return null;
  const prisma = await db();
  const r = rangoMes(mes);
  const [filas, centros, apuntado] = await Promise.all([
    costeNominasPorCentroYMes(ctx.tenant.id, a.centroIds, mes, mes),
    prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, id: { in: a.centroIds } }, select: { id: true, sociedadId: true } }),
    // con un centro elegido, solo lo de ese centro (igual que el resto del resumen)
    personalApuntadoPorSociedad(ctx.tenant.id, { ...a, sociedadIds: ctx.centroActivo ? [] : a.sociedadIds }, r.desde, r.hasta),
  ]);
  const sociedadDe = new Map(centros.map((c) => [c.id, c.sociedadId]));
  const nominas = new Map<string, { costeEmpresa: number; empleados: number; borradores: number }>();
  for (const f of filas) {
    const sociedadId = sociedadDe.get(f.centroId);
    if (!sociedadId) continue;
    const x = nominas.get(sociedadId) ?? { costeEmpresa: 0, empleados: 0, borradores: 0 };
    x.costeEmpresa = redondear(x.costeEmpresa + f.costeEmpresa);
    x.empleados += f.empleados;
    x.borradores += f.borradores;
    nominas.set(sociedadId, x);
  }
  return { nominas, apuntado };
}

// ---------- para el Cuadro de mando (exportado) ----------

/** Qué suma cada cifra del Cuadro desde Contabilidad: grupos de categoría. */
export type GrupoCuadro = "gastos" | "personal";
const GRUPOS_CUADRO: Record<GrupoCuadro, GrupoCategoriaContable[]> = { gastos: ["GASTO_FIJO", "GASTO_VARIABLE"], personal: ["PERSONAL"] };

/** Un apunte de Contabilidad que suma en el Cuadro (base sin IVA). `centroId` null = de la sociedad, sin centro. */
export interface ApunteCuadro {
  id: string;
  centroId: string | null;
  sociedadId: string;
  fecha: Date;
  documento: string;
  concepto: string;
  categoria: string;
  importe: number;
}

/**
 * Apuntes de Contabilidad que suman en el Cuadro de mando, sin IVA:
 * - «gastos»: categorías de gasto fijo o variable; «personal»: categorías de Personal (el Cuadro solo las usa
 *   si Personal no está contratado: con Personal, el coste sale de las nóminas o de las horas y sumarlas
 *   aquí lo contaría dos veces).
 * - Gastos registrados (sin los enlazados a una factura, que ya suma la factura) y facturas recibidas
 *   **línea a línea**: cada línea con su categoría o, si no tiene, la de la factura. Una factura que mezcla
 *   mercancía y gastos suma solo la parte de gasto.
 * - `centroIds`: lo imputado a esos centros; `sociedadesSinCentro`: lo de esas sociedades sin centro.
 * Sin sesión: quien llama ya ha comprobado permisos y centros.
 */
export async function apuntesContablesCuadro(
  tenantId: string,
  donde: { centroIds?: string[]; sociedadesSinCentro?: string[] },
  desde: Date,
  hasta: Date,
  grupo: GrupoCuadro,
): Promise<ApunteCuadro[]> {
  const centroIds = donde.centroIds ?? [];
  const sociedades = donde.sociedadesSinCentro ?? [];
  if (centroIds.length === 0 && sociedades.length === 0) return [];
  const prisma = await db();
  const categorias = await prisma.categoriaContable.findMany({ where: { tenantId, grupo: { in: GRUPOS_CUADRO[grupo] } }, select: { id: true, nombre: true } });
  if (categorias.length === 0) return [];
  const nombres = new Map(categorias.map((c) => [c.id, c.nombre]));
  const ids = Array.from(nombres.keys());
  const ambitoCentro = { OR: [{ centroId: { in: centroIds } }, { centroId: null, sociedadId: { in: sociedades } }] };
  const [gastos, lineas] = await Promise.all([
    prisma.gastoContable.findMany({ where: { tenantId, estado: { not: "ANULADO" }, categoriaId: { in: ids }, facturaRecibidaId: null, fecha: { gte: desde, lt: hasta }, ...ambitoCentro }, orderBy: { fecha: "asc" } }),
    prisma.facturaRecibidaLinea.findMany({
      where: {
        factura: { tenantId, estado: { not: "ANULADA" }, fecha: { gte: desde, lt: hasta }, ...ambitoCentro },
        OR: [{ categoriaId: { in: ids } }, { categoriaId: null, factura: { categoriaId: { in: ids } } }],
      },
      select: { base: true, categoriaId: true, factura: { select: { id: true, numero: true, proveedorNombre: true, centroId: true, sociedadId: true, fecha: true, categoriaId: true, base: true } } },
    }),
  ]);
  const porFactura = new Map<string, ApunteCuadro & { categorias: Set<string>; baseFactura: number }>();
  for (const l of lineas) {
    const f = l.factura;
    const cat = nombres.get((l.categoriaId ?? f.categoriaId)!) ?? "—";
    const x = porFactura.get(f.id) ?? { id: f.id, centroId: f.centroId, sociedadId: f.sociedadId, fecha: f.fecha, documento: f.numero, concepto: f.proveedorNombre, categoria: "", importe: 0, categorias: new Set<string>(), baseFactura: Number(f.base) };
    x.importe += Number(l.base);
    x.categorias.add(cat);
    porFactura.set(f.id, x);
  }
  const facturas: ApunteCuadro[] = Array.from(porFactura.values()).map(({ categorias, baseFactura, ...x }) => ({
    ...x,
    importe: redondear(x.importe),
    categoria: Array.from(categorias).join(", "),
    concepto: Math.abs(redondear(x.importe) - baseFactura) > 0.005 ? `${x.concepto} (solo la parte de ${grupo === "gastos" ? "gasto" : "personal"}: ${euros(redondear(x.importe))} de ${euros(baseFactura)})` : x.concepto,
  }));
  return [
    ...gastos.map((g) => ({ id: g.id, centroId: g.centroId, sociedadId: g.sociedadId, fecha: g.fecha, documento: "Gasto", concepto: g.concepto, categoria: nombres.get(g.categoriaId) ?? "—", importe: Number(g.base) })),
    ...facturas,
  ].sort((x, y) => x.fecha.getTime() - y.fecha.getTime());
}

/**
 * Gastos (base sin IVA) por centro y día para el Cuadro de mando: solo categorías de gasto fijo o variable
 * (ver apuntesContablesCuadro). La mercancía no entra (el Cuadro la lee del stock o de los tickets) ni el
 * personal (lo lee de Personal): si entraran, se contarían dos veces.
 */
export async function gastosPorCentroYDia(tenantId: string, centroIds: string[], desde: Date, hasta: Date) {
  const apuntes = await apuntesContablesCuadro(tenantId, { centroIds }, desde, hasta, "gastos");
  return apuntes.map((g) => ({ centroId: g.centroId as string, fecha: g.fecha, importe: g.importe }));
}

/** Detalle de los gastos de un centro en un rango (para enlazar desde el Cuadro). */
export async function detalleGastosCentro(tenantId: string, centroId: string, desde: Date, hasta: Date) {
  return apuntesContablesCuadro(tenantId, { centroIds: [centroId] }, desde, hasta, "gastos");
}

/**
 * Facturas recibidas de unos centros con líneas sin categoría (ni la suya ni la de la factura): no suman en
 * ninguna cifra del Cuadro. Para avisar en el detalle.
 */
export async function facturasSinCategoria(tenantId: string, centroIds: string[], desde: Date, hasta: Date) {
  const prisma = await db();
  return prisma.facturaRecibida.findMany({
    where: { tenantId, centroId: { in: centroIds }, estado: { not: "ANULADA" }, fecha: { gte: desde, lt: hasta }, categoriaId: null, lineas: { some: { categoriaId: null } } },
    select: { id: true, numero: true, proveedorNombre: true, base: true },
  });
}

/**
 * Coste de personal apuntado en Contabilidad (categorías de Personal, sin IVA) por sociedad en un rango.
 * Para comparar con el coste empresa de las nóminas de Personal en el resumen (nunca se suman las dos).
 */
async function personalApuntadoPorSociedad(tenantId: string, ambitoSociedad: Ambito, desde: Date, hasta: Date) {
  const apuntes = await apuntesContablesCuadro(tenantId, { centroIds: ambitoSociedad.centroIds, sociedadesSinCentro: ambitoSociedad.sociedadIds }, desde, hasta, "personal");
  const porSociedad = new Map<string, number>();
  for (const a of apuntes) porSociedad.set(a.sociedadId, redondear((porSociedad.get(a.sociedadId) ?? 0) + a.importe));
  return porSociedad;
}

// ---------- exportación para la gestoría ----------

/** Importe para CSV: coma decimal y sin separador de miles (lo que leen A3, Sage y Excel en español). */
const formatoCsv = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const celda = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV de un mes y una sociedad para la gestoría: facturas recibidas (una fila por tipo de IVA),
 * gastos sin factura, facturas emitidas en programa certificado y, si se pasan, ventas diarias por centro.
 */
export async function exportarMesCsv(
  ctx: Contexto,
  sociedadId: string,
  mes: string,
  ventasDiarias?: { centroId: string; fecha: Date; ventaNeta: number; cuotaIva: number }[],
): Promise<{ nombre: string; contenido: string }> {
  const prisma = await db();
  const a = await ambito(ctx);
  if (!a.sociedadIds.includes(sociedadId)) throw new ErrorContable("No puedes exportar esa sociedad.");
  const r = rangoMes(mes);
  const d = await diccionarios(ctx);
  const soc = d.sociedades.get(sociedadId)!;
  // solo lo que el usuario ve: centros de su selección y, con «todos mis centros», lo de la sociedad sin centro
  const donde = { ...a.donde(sociedadId), fecha: { gte: r.desde, lt: r.hasta } };
  const [recibidas, gastos, emitidas] = await Promise.all([
    prisma.facturaRecibida.findMany({ where: { ...donde, estado: { not: "ANULADA" } }, include: { lineas: true }, orderBy: { fecha: "asc" } }),
    prisma.gastoContable.findMany({ where: { ...donde, estado: { not: "ANULADO" }, facturaRecibidaId: null }, orderBy: { fecha: "asc" } }),
    prisma.facturaEmitida.findMany({ where: { ...donde, estado: { in: ["EMITIDA_FUERA", "COBRADA"] } }, include: { lineas: true }, orderBy: { fecha: "asc" } }),
  ]);
  const cab = ["Tipo", "Sociedad", "CIF sociedad", "Fecha", "Documento", "Número del tercero", "Tercero", "CIF tercero", "Centro", "Categoría", "Cuenta gestoría", "Base", "Tipo IVA", "Cuota IVA", "Total", "Estado", "Vencimiento"];
  const filas: unknown[][] = [];
  const nombreCentro = (id: string | null) => (id ? (d.centros.get(id)?.nombre ?? "") : "");
  const categoria = (id: string | null | undefined) => (id ? d.categorias.get(id) : undefined);

  for (const f of recibidas) {
    const porIva = new Map<number, { base: number; cuota: number; categoriaId: string | null }>();
    for (const l of f.lineas) {
      const k = Number(l.tipoIva);
      const x = porIva.get(k) ?? { base: 0, cuota: 0, categoriaId: l.categoriaId ?? f.categoriaId };
      x.base += Number(l.base);
      x.cuota += Number(l.cuotaIva);
      porIva.set(k, x);
    }
    for (const [tipo, x] of porIva) {
      const cat = categoria(x.categoriaId);
      filas.push(["Factura recibida", soc.razonSocial, soc.cif, fechaEs(f.fecha), f.numero, f.numeroProveedor, f.proveedorNombre, f.proveedorCif, nombreCentro(f.centroId), cat?.nombre, cat?.cuentaGestoria, formatoCsv.format(redondear(x.base)), tipo, formatoCsv.format(redondear(x.cuota)), formatoCsv.format(redondear(x.base + x.cuota)), f.estado, fechaEs(f.vencimiento)]);
    }
  }
  for (const g of gastos) {
    const cat = categoria(g.categoriaId);
    const tipo = Number(g.base) ? Math.round((Number(g.cuotaIva) / Number(g.base)) * 100) : 0;
    filas.push(["Gasto", soc.razonSocial, soc.cif, fechaEs(g.fecha), g.concepto, "", g.proveedorNombre, "", nombreCentro(g.centroId), cat?.nombre, cat?.cuentaGestoria, formatoCsv.format(Number(g.base)), tipo, formatoCsv.format(Number(g.cuotaIva)), formatoCsv.format(Number(g.total)), g.estado, fechaEs(g.vencimiento)]);
  }
  for (const f of emitidas) {
    const porIva = new Map<number, { base: number; cuota: number }>();
    for (const l of f.lineas) {
      const k = Number(l.tipoIva);
      const x = porIva.get(k) ?? { base: 0, cuota: 0 };
      x.base += Number(l.base);
      x.cuota += Number(l.cuotaIva);
      porIva.set(k, x);
    }
    for (const [tipo, x] of porIva)
      filas.push(["Factura emitida (programa certificado)", soc.razonSocial, soc.cif, fechaEs(f.fecha), f.numeroOficial, f.referencia, f.clienteNombre, f.clienteCif, nombreCentro(f.centroId), "", "", formatoCsv.format(redondear(x.base)), tipo, formatoCsv.format(redondear(x.cuota)), formatoCsv.format(redondear(x.base + x.cuota)), f.estado, fechaEs(f.vencimiento)]);
  }
  for (const v of ventasDiarias ?? []) {
    filas.push(["Venta diaria (TPV)", soc.razonSocial, soc.cif, fechaEs(v.fecha), "", "", "Ventas de caja", "", nombreCentro(v.centroId), "Ventas", "", formatoCsv.format(v.ventaNeta), "", formatoCsv.format(v.cuotaIva), formatoCsv.format(redondear(v.ventaNeta + v.cuotaIva)), "", ""]);
  }
  const contenido = "﻿" + [cab, ...filas].map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
  return { nombre: `contabilidad_${soc.cif}_${mes}.csv`, contenido };
}

/** Ids de los centros de una sociedad que ve el usuario en su selección (para sumar sus ventas en la exportación). */
export async function centrosDeSociedad(ctx: Contexto, sociedadId: string): Promise<string[]> {
  const prisma = await db();
  const centros = await prisma.centro.findMany({ where: { tenantId: ctx.tenant.id, sociedadId, id: { in: centrosFiltro(ctx) } }, select: { id: true } });
  return centros.map((c) => c.id);
}
