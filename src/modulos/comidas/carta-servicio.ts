import "server-only";
import { hoyMadrid } from "@/kernel/fechas";
/**
 * Carta y escandallos (sección del módulo Comidas). Lógica de negocio.
 * Ver docs/specs/modulos/comidas/carta-escandallos.md
 *
 * La carta la comparten Comidas (platos) y Bebidas (vinos, copas, cafés…): cada plato y cada sección
 * tiene su área. Una carta es de la marca (la ven todos sus locales) o de un local concreto.
 *
 * Exporta para otros módulos:
 *  - alergenosDeProductos / fijarAlergenosProducto (Obrador hereda y publica alérgenos de sus elaborados)
 *  - costeYAlergenosEscandallo (cálculo común de coste por ingredientes)
 *  - ventaDeProductos (Bebidas: en qué platos y formatos se vende cada vino, para la vista Bodega)
 *  - objetivoCosteBotella (Bebidas: objetivo de coste de la marca con el que se colorea la Bodega)
 */
import { db } from "@/kernel/db";
import type { Contexto } from "@/kernel/contexto";
import { auditar } from "@/kernel/eventos";
import type { Tx } from "@/nucleo/movimientos";
import { productosElaboradosIds } from "@/modulos/obrador/servicio";
import { fichasDeProductos } from "@/modulos/bebidas/fichas";
import { cantidadBruta, normalizarAlergenos, porcentajeCoste, unirAlergenos } from "./carta-alergenos";
import {
  esquemaCarta,
  esquemaFormato,
  esquemaFormatoCambio,
  esquemaIngrediente,
  esquemaLineaIngrediente,
  esquemaObjetivo,
  esquemaPlato,
  esquemaPrecioCentro,
  esquemaRecargo,
  esquemaSeccion,
} from "./carta-esquemas";

export class ErrorCarta extends Error {}

export type AreaCarta = "COMIDAS" | "BEBIDAS";

const OBJETIVO_POR_DEFECTO = 30;

function fechaDeTexto(s?: string): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}


// ---------------------------------------------------------------------------
// Alérgenos por producto (los usa también Obrador)
// ---------------------------------------------------------------------------

export async function alergenosDeProductos(tx: Tx, tenantId: string, productoIds: string[]) {
  const mapa = new Map<string, { alergenos: string[]; trazas: string[] }>();
  if (productoIds.length === 0) return mapa;
  const filas = await tx.cartaAlergenoProducto.findMany({ where: { tenantId, productoId: { in: productoIds } } });
  for (const f of filas) mapa.set(f.productoId, { alergenos: f.alergenos, trazas: f.trazas });
  return mapa;
}

export async function fijarAlergenosProducto(tx: Tx, tenantId: string, productoId: string, alergenos: string[], trazas: string[] = []) {
  const a = normalizarAlergenos(alergenos);
  const t = normalizarAlergenos(trazas).filter((x) => !a.includes(x));
  await tx.cartaAlergenoProducto.upsert({
    where: { tenantId_productoId: { tenantId, productoId } },
    create: { tenantId, productoId, alergenos: a, trazas: t },
    update: { alergenos: a, trazas: t },
  });
}

// ---------------------------------------------------------------------------
// Cálculo de escandallo
// ---------------------------------------------------------------------------

export interface LineaEscandallo {
  id: string;
  productoId: string;
  producto: string;
  referencia: string;
  unidad: string;
  elaborado: boolean;
  cantidad: number; // neta
  mermaPct: number;
  bruta: number;
  costeMedio: number; // €/unidad
  costeUltimo: number; // €/unidad
  importeMedio: number;
  importeUltimo: number;
  alergenos: string[];
  trazas: string[];
}

/** Último coste de entrada (compra o producción) de cada producto; si no hay, el medio. */
async function ultimosCostes(tx: Tx, tenantId: string, productoIds: string[]) {
  const mapa = new Map<string, number>();
  if (productoIds.length === 0) return mapa;
  // DISTINCT ON en la base: con `distinct` de Prisma se traían todas las entradas y se filtraban en memoria
  const movs = await tx.$queryRaw<{ productoId: string; costeUnitario: unknown }[]>`
    SELECT DISTINCT ON ("productoId") "productoId", "costeUnitario"
    FROM "MovimientoStock"
    WHERE "tenantId" = ${tenantId} AND "productoId" = ANY(${productoIds}) AND tipo::text IN ('ENTRADA_COMPRA', 'PRODUCCION_ENTRADA', 'CARGA_INICIAL')
    ORDER BY "productoId", "createdAt" DESC`;
  for (const m of movs) mapa.set(m.productoId, Number(m.costeUnitario));
  return mapa;
}

/** Coste y alérgenos de una lista de ingredientes (neta + merma). */
export async function costeYAlergenosEscandallo(
  tx: Tx,
  tenantId: string,
  lineas: { id: string; productoId: string; cantidad: unknown; mermaPct: unknown }[],
) {
  const ids = Array.from(new Set(lineas.map((l) => l.productoId)));
  const [productos, ultimos, alerg, elaborados] = await Promise.all([
    tx.producto.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, nombre: true, referencia: true, unidad: true, costeUnitario: true } }),
    ultimosCostes(tx, tenantId, ids),
    alergenosDeProductos(tx, tenantId, ids),
    productosElaboradosIds(tx, tenantId),
  ]);
  const prod = new Map(productos.map((p) => [p.id, p]));
  const filas: LineaEscandallo[] = lineas.map((l) => {
    const p = prod.get(l.productoId);
    const cantidad = Number(l.cantidad);
    const mermaPct = Number(l.mermaPct ?? 0);
    const bruta = cantidadBruta(cantidad, mermaPct);
    const costeMedio = Number(p?.costeUnitario ?? 0);
    const costeUltimo = ultimos.get(l.productoId) ?? costeMedio;
    const a = alerg.get(l.productoId);
    return {
      id: l.id,
      productoId: l.productoId,
      producto: p?.nombre ?? "(producto borrado)",
      referencia: p?.referencia ?? "",
      unidad: p?.unidad ?? "UD",
      elaborado: elaborados.has(l.productoId),
      cantidad,
      mermaPct,
      bruta,
      costeMedio,
      costeUltimo,
      importeMedio: bruta * costeMedio,
      importeUltimo: bruta * costeUltimo,
      alergenos: a?.alergenos ?? [],
      trazas: a?.trazas ?? [],
    };
  });
  return {
    lineas: filas,
    costeMedio: filas.reduce((s, f) => s + f.importeMedio, 0),
    costeUltimo: filas.reduce((s, f) => s + f.importeUltimo, 0),
    alergenos: unirAlergenos(...filas.map((f) => f.alergenos)),
    trazas: unirAlergenos(...filas.map((f) => f.trazas)),
    sinCoste: filas.filter((f) => f.costeMedio <= 0).map((f) => f.producto),
  };
}

// ---------------------------------------------------------------------------
// Alcance: qué cartas y platos ve la pantalla según el local elegido arriba
// ---------------------------------------------------------------------------

export interface AlcanceCarta {
  /** Local elegido arriba (null = todos mis centros) */
  centroId: string | null;
  centroNombre: string | null;
  /** Marca del local elegido (null si no hay local o no tiene marca) */
  marcaId: string | null;
  /** Centros que ve el usuario (para la vista «todos mis centros») */
  centros: string[];
}

export async function alcanceCarta(ctx: Contexto): Promise<AlcanceCarta> {
  const centros = ctx.centros.map((c) => c.id);
  if (!ctx.centroActivo) return { centroId: null, centroNombre: null, marcaId: null, centros };
  const prisma = await db();
  const c = await prisma.centro.findFirst({ where: { id: ctx.centroActivo.id, tenantId: ctx.tenant.id }, select: { marcaId: true } });
  return { centroId: ctx.centroActivo.id, centroNombre: ctx.centroActivo.nombre, marcaId: c?.marcaId ?? null, centros };
}

/**
 * Filtro común de cartas y platos: con un local elegido, lo de ese local y lo de su marca;
 * sin local, lo de las marcas y lo de los locales que ve el usuario.
 */
function filtroAlcance(al: AlcanceCarta) {
  if (al.centroId) return { OR: [{ centroId: al.centroId }, { centroId: null, marcaId: al.marcaId ?? "-" }] };
  return { OR: [{ centroId: null }, { centroId: { in: al.centros } }] };
}

/** Nombres de los locales (para «Solo en Raza Pruebas»). */
async function nombresCentros(tx: Tx, tenantId: string, ids: (string | null)[]) {
  const unicos = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unicos.length === 0) return new Map<string, string>();
  const filas = await tx.centro.findMany({ where: { tenantId, id: { in: unicos } }, select: { id: true, nombre: true } });
  return new Map(filas.map((c) => [c.id, c.nombre]));
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function marcasDeLaCadena(ctx: Contexto) {
  const prisma = await db();
  const [marcas, objetivos] = await Promise.all([
    prisma.marca.findMany({ where: { tenantId: ctx.tenant.id, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.cartaObjetivoMarca.findMany({ where: { tenantId: ctx.tenant.id } }),
  ]);
  const obj = new Map(objetivos.map((o) => [o.marcaId, o]));
  return marcas.map((m) => {
    const o = obj.get(m.id);
    const objetivo = o ? Number(o.objetivoCostePct) : OBJETIVO_POR_DEFECTO;
    const objetivoBebidasPropio = o?.objetivoBebidasPct != null ? Number(o.objetivoBebidasPct) : null;
    // objetivo = el de Comidas; las bebidas usan el suyo y, si la marca no lo tiene, el de Comidas
    return { ...m, objetivo, objetivoBebidasPropio, objetivoBebidas: objetivoBebidasPropio ?? objetivo };
  });
}

/** Objetivo de coste (%) de una marca para un área (Comidas o Bebidas). */
export function objetivoDeMarca(m: { objetivo: number; objetivoBebidas: number } | undefined, area: AreaCarta): number {
  if (!m) return OBJETIVO_POR_DEFECTO;
  return area === "BEBIDAS" ? m.objetivoBebidas : m.objetivo;
}

/** Marca del centro elegido arriba (para filtrar la carta), o null. */
export async function marcaDelCentroActivo(ctx: Contexto): Promise<string | null> {
  return (await alcanceCarta(ctx)).marcaId;
}

export async function localesDeMarca(ctx: Contexto, marcaId: string) {
  const prisma = await db();
  return prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, marcaId, tipo: "LOCAL", estado: { not: "CERRADO" } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, codigo: true },
  });
}

/** Locales que ve el usuario, con su marca (para «solo este local» en platos y cartas). */
export async function localesVisibles(ctx: Contexto) {
  const prisma = await db();
  return prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, tipo: "LOCAL", id: { in: ctx.centros.map((c) => c.id) } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, marcaId: true },
  });
}

/** Catálogo de ingredientes para el escandallo: Comidas y Bebidas (primero los del área de la carta). */
export async function catalogoIngredientes(ctx: Contexto, area: AreaCarta = "COMIDAS") {
  const prisma = await db();
  const [productos, elaborados] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId: ctx.tenant.id, activo: true, area: { in: ["COMIDAS", "BEBIDAS"] } },
      orderBy: [{ area: area === "BEBIDAS" ? "asc" : "desc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, referencia: true, unidad: true, area: true, costeUnitario: true },
    }),
    productosElaboradosIds(prisma, ctx.tenant.id),
  ]);
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    referencia: p.referencia,
    unidad: p.unidad,
    coste: Number(p.costeUnitario),
    grupo: elaborados.has(p.id) ? "Elaborados del obrador" : p.area === "COMIDAS" ? "Comidas" : "Bebidas",
  }));
}

export interface FormatoPlato {
  id: string;
  nombre: string;
  precio: number; // con IVA
  cantidad: number; // parte del escandallo, o unidades de productoId
  productoId: string | null;
  producto: string | null;
  centilitros: number | null; // si se conoce la capacidad del vino
  coste: number;
  costeUltimo: number; // al último precio de entrada (del producto del formato si lo tiene)
  pctCoste: number;
  sobreObjetivo: boolean;
}

export interface SeccionDelPlato {
  id: string;
  nombre: string;
  cartaId: string;
  carta: string;
  orden: number; // orden del plato dentro de la sección
}

export interface ResumenPlato {
  id: string;
  marcaId: string;
  marca: string;
  area: AreaCarta;
  centroId: string | null; // plato propio de un local
  local: string | null;
  nombre: string;
  nombreEn: string | null;
  descripcion: string | null;
  descripcionEn: string | null;
  precio: number; // de la marca (si hay formatos, el del primero)
  precioLocal: number | null; // del centro activo, si lo cambia
  disponibleLocal: boolean;
  iva: number;
  coste: number;
  costeUltimo: number;
  pctCoste: number;
  objetivo: number;
  sobreObjetivo: boolean;
  alergenos: string[];
  trazas: string[];
  alergenosHeredados: string[];
  faltanAlergenos: string[]; // heredados del escandallo que no están declarados
  alergenosRevisados: boolean;
  etiquetas: string[];
  ingredientes: LineaEscandallo[];
  sinCoste: string[];
  activo: boolean;
  formatos: FormatoPlato[];
  secciones: SeccionDelPlato[]; // secciones de las cartas que se ven en esta pantalla
  enCartas: string[];
}

export interface FiltroPlatos {
  area?: AreaCarta;
  marcaId?: string | null; // solo cuenta si no hay local elegido
  q?: string;
  incluirInactivos?: boolean;
  soloIds?: string[];
  /** true: sin filtrar por el local elegido (ficha del plato abierta por enlace) */
  sinAlcance?: boolean;
}

export async function listarPlatos(ctx: Contexto, filtro: FiltroPlatos) {
  const prisma = await db();
  const t = ctx.tenant.id;
  const al = await alcanceCarta(ctx);
  const marcaId = al.centroId ? al.marcaId : (filtro.marcaId ?? null);
  const [platos, marcas] = await Promise.all([
    prisma.cartaPlato.findMany({
      where: {
        tenantId: t,
        AND: [
          filtro.sinAlcance ? {} : filtroAlcance(al),
          filtro.q ? { OR: [{ nombre: { contains: filtro.q, mode: "insensitive" as const } }, { nombreEn: { contains: filtro.q, mode: "insensitive" as const } }] } : {},
        ],
        ...(filtro.area ? { area: filtro.area } : {}),
        ...(marcaId && !filtro.sinAlcance ? { marcaId } : {}),
        ...(filtro.incluirInactivos ? {} : { activo: true }),
        ...(filtro.soloIds ? { id: { in: filtro.soloIds } } : {}),
      },
      include: {
        ingredientes: { orderBy: { orden: "asc" } },
        precios: true,
        formatos: { where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] },
        // solo las secciones activas («Quitar sección» las desactiva)
        lineas: { where: { seccion: { activo: true } }, include: { seccion: { include: { carta: { select: { id: true, nombre: true, centroId: true, marcaId: true, activo: true } } } } } },
      },
      orderBy: [{ marcaId: "asc" }, { nombre: "asc" }],
    }),
    marcasDeLaCadena(ctx),
  ]);
  const marcaMapa = new Map(marcas.map((m) => [m.id, m]));
  const centroId = al.centroId;

  // Un solo cálculo con todas las líneas de todos los platos
  const todas = platos.flatMap((p) => p.ingredientes.map((i) => ({ id: i.id, productoId: i.productoId, cantidad: i.cantidad, mermaPct: i.mermaPct })));
  const calc = await costeYAlergenosEscandallo(prisma, t, todas);
  const porLinea = new Map(calc.lineas.map((l) => [l.id, l]));
  // Productos de los formatos con producto propio (mágnum…) y capacidad de los vinos (para los centilitros)
  const idsFormato = Array.from(new Set(platos.flatMap((p) => p.formatos.map((f) => f.productoId).filter((x): x is string => !!x))));
  const idsBase = Array.from(new Set(platos.map((p) => p.ingredientes[0]?.productoId).filter((x): x is string => !!x)));
  const [prodFormato, ultimosFormato, fichas, locales] = await Promise.all([
    idsFormato.length ? prisma.producto.findMany({ where: { tenantId: t, id: { in: idsFormato } }, select: { id: true, nombre: true, costeUnitario: true } }) : Promise.resolve([]),
    ultimosCostes(prisma, t, idsFormato),
    fichasDeProductos(prisma, t, Array.from(new Set([...idsBase, ...idsFormato]))),
    nombresCentros(prisma, t, platos.map((p) => p.centroId)),
  ]);
  const pf = new Map(prodFormato.map((p) => [p.id, p]));

  // ¿se ve la carta en esta pantalla? (misma regla que listarCartas)
  const cartaVisible = (c: { centroId: string | null; marcaId: string; activo: boolean }) =>
    al.centroId ? c.centroId === al.centroId || (c.centroId === null && c.marcaId === al.marcaId && c.activo) : c.centroId === null || al.centros.includes(c.centroId);

  return platos.map<ResumenPlato>((p) => {
    const lineas = p.ingredientes.map((i) => porLinea.get(i.id)!).filter(Boolean);
    const coste = lineas.reduce((s, l) => s + l.importeMedio, 0);
    const costeUltimo = lineas.reduce((s, l) => s + l.importeUltimo, 0);
    const m = marcaMapa.get(p.marcaId);
    const ajuste = centroId ? p.precios.find((x) => x.centroId === centroId) : undefined;
    const precioLocal = ajuste?.precio != null ? Number(ajuste.precio) : null;
    const precio = Number(p.precio);
    const iva = Number(p.iva);
    const objetivo = objetivoDeMarca(m, p.area);
    const heredados = unirAlergenos(...lineas.map((l) => l.alergenos));
    const capacidadBase = p.ingredientes.length === 1 ? fichas.get(p.ingredientes[0].productoId)?.capacidadCl ?? null : null;
    const cantidadBase = p.ingredientes.length === 1 ? Number(p.ingredientes[0].cantidad) : null;
    const formatos = p.formatos.map<FormatoPlato>((f, i) => {
      const cantidad = Number(f.cantidad);
      const prod = f.productoId ? pf.get(f.productoId) : undefined;
      const costeF = f.productoId ? cantidad * Number(prod?.costeUnitario ?? 0) : cantidad * coste;
      // al último precio: el del producto propio del formato (mágnum…) o la parte del escandallo
      const ultimoProducto = f.productoId ? (ultimosFormato.get(f.productoId) ?? Number(prod?.costeUnitario ?? 0)) : 0;
      const costeUltimoF = f.productoId ? cantidad * ultimoProducto : cantidad * costeUltimo;
      const precioF = i === 0 && precioLocal != null ? precioLocal : Number(f.precio);
      const pctF = porcentajeCoste(costeF, precioF, iva);
      const cap = f.productoId ? fichas.get(f.productoId)?.capacidadCl ?? null : capacidadBase != null && cantidadBase != null ? capacidadBase * cantidadBase : null;
      return {
        id: f.id,
        nombre: f.nombre,
        precio: precioF,
        cantidad,
        productoId: f.productoId,
        producto: prod?.nombre ?? null,
        centilitros: cap != null ? cap * cantidad : null,
        coste: costeF,
        costeUltimo: costeUltimoF,
        pctCoste: pctF,
        sobreObjetivo: costeF > 0 && pctF > objetivo,
      };
    });
    // con formatos, el coste y el % que se enseñan son los del primero (el del precio del plato)
    const costeMostrado = formatos.length ? formatos[0].coste : coste;
    const pct = porcentajeCoste(costeMostrado, precioLocal ?? precio, iva);
    const visibles = p.lineas.filter((l) => cartaVisible(l.seccion.carta));
    return {
      id: p.id,
      marcaId: p.marcaId,
      marca: m?.nombre ?? "—",
      area: p.area,
      centroId: p.centroId,
      local: p.centroId ? locales.get(p.centroId) ?? "—" : null,
      nombre: p.nombre,
      nombreEn: p.nombreEn,
      descripcion: p.descripcion,
      descripcionEn: p.descripcionEn,
      precio,
      precioLocal,
      disponibleLocal: ajuste ? ajuste.disponible : true,
      iva,
      coste: costeMostrado,
      costeUltimo: formatos.length ? formatos[0].costeUltimo : costeUltimo,
      pctCoste: pct,
      objetivo,
      sobreObjetivo: (costeMostrado > 0 && pct > objetivo) || formatos.some((f) => f.sobreObjetivo),
      alergenos: p.alergenos,
      trazas: p.trazas,
      alergenosHeredados: heredados,
      faltanAlergenos: heredados.filter((a) => !p.alergenos.includes(a)),
      alergenosRevisados: p.alergenosRevisados,
      etiquetas: p.etiquetas,
      ingredientes: lineas,
      sinCoste: lineas.filter((l) => l.costeMedio <= 0).map((l) => l.producto),
      activo: p.activo,
      formatos,
      secciones: visibles.map((l) => ({ id: l.seccion.id, nombre: l.seccion.nombre, cartaId: l.seccion.carta.id, carta: l.seccion.carta.nombre, orden: l.orden })),
      enCartas: Array.from(new Set(p.lineas.map((l) => l.seccion.carta.nombre))), // solo secciones activas
    };
  });
}

/** Coste del escandallo completo del plato (base de los formatos sin producto propio). */
export function costeEscandallo(p: ResumenPlato): number {
  return p.ingredientes.reduce((s, l) => s + l.importeMedio, 0);
}

export async function fichaPlato(ctx: Contexto, id: string) {
  const [plato] = await listarPlatos(ctx, { soloIds: [id], incluirInactivos: true, sinAlcance: true });
  if (!plato) return null;
  const prisma = await db();
  const [precios, locales, fichas] = await Promise.all([
    prisma.cartaPlatoPrecio.findMany({ where: { platoId: id } }),
    localesDeMarca(ctx, plato.marcaId),
    fichasDeProductos(prisma, ctx.tenant.id, plato.ingredientes.length === 1 ? [plato.ingredientes[0].productoId] : []),
  ]);
  const ajustes = new Map(precios.map((p) => [p.centroId, p]));
  const costeBase = plato.formatos.length ? plato.formatos[0].coste : plato.coste;
  const porLocal = locales
    .filter((l) => !plato.centroId || l.id === plato.centroId)
    .map((l) => {
      const a = ajustes.get(l.id);
      const precio = a?.precio != null ? Number(a.precio) : plato.precio;
      return {
        ...l,
        precioPropio: a?.precio != null ? Number(a.precio) : null,
        precio,
        disponible: a ? a.disponible : true,
        pctCoste: porcentajeCoste(costeBase, precio, plato.iva),
      };
    });
  // Capacidad de la botella del escandallo (si es un vino con ficha): permite dar los formatos en centilitros
  const capacidadCl = plato.ingredientes.length === 1 ? (fichas.get(plato.ingredientes[0].productoId)?.capacidadCl ?? null) : null;
  return { plato, porLocal, capacidadCl, costeEscandallo: costeEscandallo(plato) };
}

export async function listarCartas(ctx: Contexto, filtro: { marcaId?: string | null; area?: AreaCarta } = {}) {
  const prisma = await db();
  const al = await alcanceCarta(ctx);
  const marcaId = al.centroId ? null : (filtro.marcaId ?? null);
  const [cartas, marcas] = await Promise.all([
    prisma.carta.findMany({
      where: {
        tenantId: ctx.tenant.id,
        ...(al.centroId ? { OR: [{ centroId: al.centroId }, { centroId: null, marcaId: al.marcaId ?? "-", activo: true }] } : filtroAlcance(al)),
        ...(marcaId ? { marcaId } : {}),
      },
      include: {
        // las de esta área, activas y quitadas (las quitadas se pueden recuperar)
        secciones: {
          where: filtro.area ? { area: filtro.area } : {},
          orderBy: { orden: "asc" },
          include: { lineas: { orderBy: { orden: "asc" }, include: { plato: { select: { id: true, nombre: true, precio: true, activo: true, alergenos: true, centroId: true } } } } },
        },
        // secciones activas de la OTRA área (la carta es compartida entre Comidas y Bebidas)
        ...(filtro.area ? { _count: { select: { secciones: { where: { activo: true, area: { not: filtro.area } } } } } } : {}),
      },
      orderBy: [{ activo: "desc" }, { tipo: "asc" }, { nombre: "asc" }],
    }),
    marcasDeLaCadena(ctx),
  ]);
  const nombres = new Map(marcas.map((m) => [m.id, m.nombre]));
  const locales = await nombresCentros(prisma, ctx.tenant.id, cartas.map((c) => c.centroId));
  const hoy = hoyMadrid();
  return cartas.map((c) => {
    const desde = c.desde ? c.desde.toISOString().slice(0, 10) : null;
    const hasta = c.hasta ? c.hasta.toISOString().slice(0, 10) : null;
    const vigente = c.activo && (c.tipo === "PERMANENTE" || ((!desde || desde <= hoy) && (!hasta || hasta >= hoy)));
    const proxima = c.activo && c.tipo === "TEMPORAL" && !!desde && desde > hoy;
    const activas = c.secciones.filter((x) => x.activo);
    const conteo = (c as { _count?: { secciones: number } })._count;
    return {
      ...c,
      secciones: activas,
      seccionesQuitadas: c.secciones.filter((x) => !x.activo),
      /** Secciones activas de la otra área (Comidas si se mira desde Bebidas y al revés) */
      seccionesOtraArea: conteo?.secciones ?? 0,
      marca: nombres.get(c.marcaId) ?? "—",
      local: c.centroId ? locales.get(c.centroId) ?? "—" : null,
      vigente,
      proxima,
      totalPlatos: activas.reduce((s, x) => s + x.lineas.length, 0),
    };
  });
}

export interface GrupoSeccion {
  clave: string; // id de la sección o «sin-seccion»
  nombre: string;
  carta: string | null;
  platos: ResumenPlato[];
}

/**
 * La carta de un área agrupada por secciones, en el orden de las cartas que ve la pantalla
 * (primero las del local, luego las de la marca). Los platos que no están en ninguna sección
 * visible van al final, en «Sin sección».
 */
export async function cartaPorSecciones(ctx: Contexto, area: AreaCarta, filtro: Omit<FiltroPlatos, "area" | "soloIds"> = {}) {
  const [platos, cartas] = await Promise.all([listarPlatos(ctx, { ...filtro, area }), listarCartas(ctx, { marcaId: filtro.marcaId, area })]);
  const porId = new Map(platos.map((p) => [p.id, p]));
  const ordenadas = [...cartas].sort((a, b) => Number(!!b.centroId) - Number(!!a.centroId) || Number(b.activo) - Number(a.activo));
  const grupos: GrupoSeccion[] = [];
  const colocados = new Set<string>();
  for (const c of ordenadas)
    for (const s of c.secciones) {
      const lista = s.lineas.map((l) => porId.get(l.plato.id)).filter((p): p is ResumenPlato => !!p);
      lista.forEach((p) => colocados.add(p.id));
      if (lista.length || !filtro.q) grupos.push({ clave: s.id, nombre: s.nombre, carta: c.nombre, platos: lista });
    }
  const sueltos = platos.filter((p) => !colocados.has(p.id));
  if (sueltos.length) grupos.push({ clave: "sin-seccion", nombre: "Sin sección", carta: null, platos: sueltos });
  return { grupos, platos, cartas: ordenadas };
}

export async function listarRecargos(ctx: Contexto) {
  const prisma = await db();
  const locales = await prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, tipo: "LOCAL", estado: { not: "CERRADO" }, id: { in: ctx.centroActivo ? [ctx.centroActivo.id] : ctx.centros.map((c) => c.id) } },
    include: { marca: { select: { nombre: true } } },
    orderBy: [{ marcaId: "asc" }, { nombre: "asc" }],
  });
  const [recargos, platos] = await Promise.all([
    prisma.cartaRecargo.findMany({ where: { tenantId: ctx.tenant.id, centroId: { in: locales.map((l) => l.id) }, concepto: "Pan y aperitivo" } }),
    // platos que pueden dar el escandallo del recargo: los de comidas de la marca del local o del propio local
    prisma.cartaPlato.findMany({
      where: { tenantId: ctx.tenant.id, area: "COMIDAS", activo: true, OR: [{ centroId: { in: locales.map((l) => l.id) } }, { centroId: null, marcaId: { in: locales.map((l) => l.marcaId).filter((x): x is string => !!x) } }] },
      select: { id: true, nombre: true, marcaId: true, centroId: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const mapa = new Map(recargos.map((r) => [r.centroId, r]));
  const nombrePlato = new Map(platos.map((p) => [p.id, p.nombre]));
  return locales.map((l) => {
    const r = mapa.get(l.id);
    return {
      centroId: l.id,
      local: l.nombre,
      codigo: l.codigo,
      marca: l.marca?.nombre ?? "—",
      importe: r ? Number(r.importe) : null,
      iva: r ? Number(r.iva) : 10,
      activo: r?.activo ?? false,
      actualizado: r?.updatedAt ?? null,
      platoId: r?.platoId ?? null,
      plato: r?.platoId ? (nombrePlato.get(r.platoId) ?? "—") : null,
      platos: platos.filter((p) => p.centroId === l.id || (p.centroId === null && p.marcaId === l.marcaId)).map((p) => ({ id: p.id, nombre: p.nombre })),
    };
  });
}

/** Productos de Comidas con sus alérgenos declarados (para revisar los de los ingredientes). */
export async function productosConAlergenos(ctx: Contexto, q?: string) {
  const prisma = await db();
  const [productos, elaborados] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId: ctx.tenant.id, area: "COMIDAS", activo: true, ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {}) },
      include: { familia: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    productosElaboradosIds(prisma, ctx.tenant.id),
  ]);
  const alerg = await alergenosDeProductos(prisma, ctx.tenant.id, productos.map((p) => p.id));
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    referencia: p.referencia,
    familia: p.familia?.nombre ?? "—",
    elaborado: elaborados.has(p.id),
    declarado: alerg.has(p.id),
    alergenos: alerg.get(p.id)?.alergenos ?? [],
    trazas: alerg.get(p.id)?.trazas ?? [],
  }));
}

export interface VentaProducto {
  platoId: string;
  plato: string;
  formato: string; // «Botella», «Copa», o el nombre del plato si no tiene formatos
  precio: number; // con IVA (el del local elegido si lo cambia)
  iva: number;
  cantidad: number; // unidades del producto que se venden en este formato (0,2 = copa de 15 cl)
  marcaId: string;
  objetivo: number; // objetivo de coste de Bebidas de la marca del plato (el mismo que usa la Carta)
}

/**
 * Objetivo de coste con el que se juzga un vino en la Bodega: el de la marca de la carta donde se
 * vende la botella entera (si no, el del primer formato; sin ventas, el objetivo por defecto).
 * Es el mismo que usa la Carta de bebidas para poner en rojo el % de coste.
 */
export function objetivoCosteBotella(ventas: VentaProducto[]): number {
  const botella = ventas.find((v) => Math.abs(v.cantidad - 1) < 0.01) ?? ventas[0];
  return botella?.objetivo ?? OBJETIVO_POR_DEFECTO;
}

/**
 * En qué bebidas de la carta (las que ve la pantalla) se vende cada producto y en qué formatos.
 * Solo cuenta platos de Bebidas cuyo escandallo es ese único producto, o formatos con producto propio.
 */
export async function ventaDeProductos(ctx: Contexto, productoIds: string[]): Promise<Map<string, VentaProducto[]>> {
  const mapa = new Map<string, VentaProducto[]>();
  if (productoIds.length === 0) return mapa;
  const prisma = await db();
  const [al, marcas] = await Promise.all([alcanceCarta(ctx), marcasDeLaCadena(ctx)]);
  const objetivos = new Map(marcas.map((m) => [m.id, objetivoDeMarca(m, "BEBIDAS")]));
  const platos = await prisma.cartaPlato.findMany({
    where: {
      tenantId: ctx.tenant.id,
      area: "BEBIDAS",
      activo: true,
      AND: [filtroAlcance(al), { OR: [{ ingredientes: { some: { productoId: { in: productoIds } } } }, { formatos: { some: { productoId: { in: productoIds } } } }] }],
    },
    include: { ingredientes: true, formatos: { where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }, precios: al.centroId ? { where: { centroId: al.centroId } } : false },
  });
  const anadir = (productoId: string, v: VentaProducto) => mapa.set(productoId, [...(mapa.get(productoId) ?? []), v]);
  for (const p of platos) {
    const ajuste = p.precios?.[0];
    if (ajuste && !ajuste.disponible) continue;
    const iva = Number(p.iva);
    const base = p.ingredientes.length === 1 ? p.ingredientes[0] : null;
    const marca = { marcaId: p.marcaId, objetivo: objetivos.get(p.marcaId) ?? OBJETIVO_POR_DEFECTO };
    if (p.formatos.length === 0) {
      if (base) anadir(base.productoId, { platoId: p.id, plato: p.nombre, formato: p.nombre, precio: Number(ajuste?.precio ?? p.precio), iva, cantidad: Number(base.cantidad), ...marca });
      continue;
    }
    p.formatos.forEach((f, i) => {
      const precio = i === 0 && ajuste?.precio != null ? Number(ajuste.precio) : Number(f.precio);
      if (f.productoId) anadir(f.productoId, { platoId: p.id, plato: p.nombre, formato: f.nombre, precio, iva, cantidad: Number(f.cantidad), ...marca });
      else if (base) anadir(base.productoId, { platoId: p.id, plato: p.nombre, formato: f.nombre, precio, iva, cantidad: Number(base.cantidad) * Number(f.cantidad), ...marca });
    });
  }
  return mapa;
}

/** Área de un plato, sección, línea de carta, ingrediente o formato (para pedir el permiso de su módulo). */
export async function areaDe(ctx: Contexto, tipo: "plato" | "seccion" | "linea" | "ingrediente" | "formato", id: string): Promise<AreaCarta | null> {
  const prisma = await db();
  const t = ctx.tenant.id;
  if (tipo === "plato") return (await prisma.cartaPlato.findFirst({ where: { id, tenantId: t }, select: { area: true } }))?.area ?? null;
  if (tipo === "seccion") return (await prisma.cartaSeccion.findFirst({ where: { id, carta: { tenantId: t } }, select: { area: true } }))?.area ?? null;
  if (tipo === "linea") return (await prisma.cartaLinea.findFirst({ where: { id, seccion: { carta: { tenantId: t } } }, select: { seccion: { select: { area: true } } } }))?.seccion.area ?? null;
  if (tipo === "ingrediente") return (await prisma.cartaPlatoIngrediente.findFirst({ where: { id, plato: { tenantId: t } }, select: { plato: { select: { area: true } } } }))?.plato.area ?? null;
  return (await prisma.cartaPlatoFormato.findFirst({ where: { id, plato: { tenantId: t } }, select: { plato: { select: { area: true } } } }))?.plato.area ?? null;
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

async function platoDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const p = await tx.cartaPlato.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!p) throw new ErrorCarta("El plato no existe");
  return p;
}

async function comprobarMarca(tx: Tx, ctx: Contexto, marcaId: string) {
  const m = await tx.marca.findFirst({ where: { id: marcaId, tenantId: ctx.tenant.id } });
  if (!m) throw new ErrorCarta("La marca no existe");
}

/** Un plato o una carta «solo de un local»: el local tiene que ser de la marca y verlo el usuario. */
async function comprobarLocal(tx: Tx, ctx: Contexto, centroId: string | undefined | null, marcaId: string) {
  if (!centroId) return null;
  if (!ctx.centros.some((c) => c.id === centroId)) throw new ErrorCarta("No tienes acceso a ese local");
  const c = await tx.centro.findFirst({ where: { id: centroId, tenantId: ctx.tenant.id } });
  if (!c || c.marcaId !== marcaId) throw new ErrorCarta("El local no es de esa marca");
  return centroId;
}

function etiquetasDeTexto(s?: string): string[] {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Si el plato tiene formatos, su precio es el del primero (lo que ven el TPV y las listas). */
async function sincronizarPrecio(tx: Tx, platoId: string) {
  const primero = await tx.cartaPlatoFormato.findFirst({ where: { platoId, activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  if (primero) await tx.cartaPlato.update({ where: { id: platoId }, data: { precio: primero.precio } });
}

export async function crearPlato(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaPlato.parse(datos);
  const prisma = await db();
  await comprobarMarca(prisma, ctx, d.marcaId);
  const centroId = await comprobarLocal(prisma, ctx, d.centroId, d.marcaId);
  const p = await prisma.cartaPlato.create({
    data: {
      tenantId: ctx.tenant.id,
      marcaId: d.marcaId,
      centroId,
      area: d.area ?? "COMIDAS",
      nombre: d.nombre,
      nombreEn: d.nombreEn,
      descripcion: d.descripcion,
      descripcionEn: d.descripcionEn,
      precio: d.precio,
      iva: d.iva,
      etiquetas: etiquetasDeTexto(d.etiquetas),
      alergenos: [],
      trazas: [],
    },
  });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaPlato", entidadId: p.id, accion: "crear", despues: { nombre: p.nombre, precio: d.precio, area: p.area, centroId } });
  return p.id;
}

export async function actualizarPlato(ctx: Contexto, id: string, datos: Record<string, unknown>) {
  const d = esquemaPlato.parse(datos);
  const prisma = await db();
  const antes = await platoDeLaCadena(prisma, ctx, id);
  await comprobarMarca(prisma, ctx, d.marcaId);
  if (antes.centroId && d.marcaId !== antes.marcaId) await comprobarLocal(prisma, ctx, antes.centroId, d.marcaId);
  const conFormatos = (await prisma.cartaPlatoFormato.count({ where: { platoId: id, activo: true } })) > 0;
  const cambiaMarca = d.marcaId !== antes.marcaId;
  await prisma.$transaction(async (tx) => {
    await tx.cartaPlato.update({
      where: { id },
      data: {
        marcaId: d.marcaId,
        nombre: d.nombre,
        nombreEn: d.nombreEn ?? null,
        descripcion: d.descripcion ?? null,
        descripcionEn: d.descripcionEn ?? null,
        ...(conFormatos ? {} : { precio: d.precio }),
        iva: d.iva,
        etiquetas: etiquetasDeTexto(d.etiquetas),
      },
    });
    if (cambiaMarca) {
      // Un plato solo puede estar en cartas de su marca: sale de las de la marca anterior,
      // y los precios y «no se sirve» de los locales de la marca anterior dejan de tener sentido.
      const lineas = await tx.cartaLinea.findMany({
        where: { platoId: id, seccion: { carta: { tenantId: ctx.tenant.id, marcaId: { not: d.marcaId } } } },
        include: { seccion: { select: { nombre: true, carta: { select: { nombre: true } } } } },
      });
      const localesNuevaMarca = await tx.centro.findMany({ where: { tenantId: ctx.tenant.id, marcaId: d.marcaId }, select: { id: true } });
      const precios = await tx.cartaPlatoPrecio.findMany({ where: { platoId: id, centroId: { notIn: localesNuevaMarca.map((c) => c.id) } } });
      if (lineas.length) await tx.cartaLinea.deleteMany({ where: { id: { in: lineas.map((l) => l.id) } } });
      if (precios.length) await tx.cartaPlatoPrecio.deleteMany({ where: { id: { in: precios.map((x) => x.id) } } });
      await auditar(tx, {
        tenantId: ctx.tenant.id,
        usuarioId: ctx.usuario.id,
        entidad: "CartaPlato",
        entidadId: id,
        accion: "cambiar marca",
        antes: {
          marcaId: antes.marcaId,
          cartas: lineas.map((l) => `${l.seccion.carta.nombre} · ${l.seccion.nombre}`),
          preciosPorLocal: precios.map((x) => ({ centroId: x.centroId, precio: x.precio != null ? Number(x.precio) : null, disponible: x.disponible })),
        },
        despues: { marcaId: d.marcaId },
      });
    }
  });
  if ((!conFormatos && Number(antes.precio) !== d.precio) || Number(antes.iva) !== d.iva)
    await auditar(prisma, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "CartaPlato",
      entidadId: id,
      accion: "cambiar precio",
      antes: { precio: Number(antes.precio), iva: Number(antes.iva) },
      despues: { precio: conFormatos ? Number(antes.precio) : d.precio, iva: d.iva },
    });
}

export async function cambiarActivoPlato(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await platoDeLaCadena(prisma, ctx, id);
  await prisma.cartaPlato.update({ where: { id }, data: { activo } });
}

export async function fijarAlergenosPlato(ctx: Contexto, id: string, alergenos: string[], trazas: string[], revisados: boolean) {
  const prisma = await db();
  const antes = await platoDeLaCadena(prisma, ctx, id);
  const a = normalizarAlergenos(alergenos);
  const t = normalizarAlergenos(trazas).filter((x) => !a.includes(x));
  await prisma.cartaPlato.update({ where: { id }, data: { alergenos: a, trazas: t, alergenosRevisados: revisados } });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaPlato",
    entidadId: id,
    accion: "alérgenos",
    antes: { alergenos: antes.alergenos, trazas: antes.trazas, revisados: antes.alergenosRevisados },
    despues: { alergenos: a, trazas: t, revisados },
  });
}

/** Copia al plato los alérgenos y trazas que vienen de sus ingredientes (queda pendiente de revisar). */
export async function heredarAlergenosPlato(ctx: Contexto, id: string) {
  const prisma = await db();
  const plato = await platoDeLaCadena(prisma, ctx, id);
  const lineas = await prisma.cartaPlatoIngrediente.findMany({ where: { platoId: id } });
  const calc = await costeYAlergenosEscandallo(prisma, ctx.tenant.id, lineas);
  const alergenos = unirAlergenos(plato.alergenos, calc.alergenos);
  const trazas = unirAlergenos(plato.trazas, calc.trazas).filter((x) => !alergenos.includes(x));
  await prisma.cartaPlato.update({ where: { id }, data: { alergenos, trazas, alergenosRevisados: false } });
}

export async function anadirIngrediente(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaIngrediente.parse(datos);
  const prisma = await db();
  await platoDeLaCadena(prisma, ctx, d.platoId);
  const prod = await prisma.producto.findFirst({ where: { id: d.productoId, tenantId: ctx.tenant.id } });
  if (!prod) throw new ErrorCarta("El ingrediente no existe en el catálogo");
  const ultimo = await prisma.cartaPlatoIngrediente.aggregate({ where: { platoId: d.platoId }, _max: { orden: true } });
  await prisma.cartaPlatoIngrediente.create({
    data: { platoId: d.platoId, productoId: d.productoId, cantidad: d.cantidad, mermaPct: d.mermaPct ?? 0, orden: (ultimo._max.orden ?? 0) + 1 },
  });
  // un ingrediente nuevo puede traer alérgenos: el plato vuelve a estar pendiente de revisar
  await prisma.cartaPlato.update({ where: { id: d.platoId }, data: { alergenosRevisados: false } });
}

async function lineaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const l = await tx.cartaPlatoIngrediente.findFirst({ where: { id, plato: { tenantId: ctx.tenant.id } } });
  if (!l) throw new ErrorCarta("La línea del escandallo no existe");
  return l;
}

export async function actualizarIngrediente(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaLineaIngrediente.parse(datos);
  const prisma = await db();
  await lineaDeLaCadena(prisma, ctx, d.id);
  await prisma.cartaPlatoIngrediente.update({ where: { id: d.id }, data: { cantidad: d.cantidad, mermaPct: d.mermaPct ?? 0 } });
}

export async function quitarIngrediente(ctx: Contexto, id: string) {
  const prisma = await db();
  const l = await lineaDeLaCadena(prisma, ctx, id);
  await prisma.cartaPlatoIngrediente.delete({ where: { id: l.id } });
  return l.platoId;
}

// --- Formatos de venta (botella, copa, mágnum…) ---

export async function anadirFormato(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaFormato.parse(datos);
  const prisma = await db();
  const plato = await platoDeLaCadena(prisma, ctx, d.platoId);
  if (d.productoId) {
    const prod = await prisma.producto.findFirst({ where: { id: d.productoId, tenantId: ctx.tenant.id } });
    if (!prod) throw new ErrorCarta("El producto del formato no existe");
  }
  let cantidad = d.cantidad;
  if (d.centilitros !== undefined) {
    // centilitros → parte de la botella (o del producto del formato), con la capacidad de su ficha de vino
    const lineas = d.productoId ? [] : await prisma.cartaPlatoIngrediente.findMany({ where: { platoId: plato.id } });
    if (!d.productoId && lineas.length !== 1) throw new ErrorCarta("Para dar el formato en centilitros, el escandallo tiene que ser una sola botella");
    const productoId = d.productoId ?? lineas[0].productoId;
    const ficha = (await fichasDeProductos(prisma, ctx.tenant.id, [productoId])).get(productoId);
    if (!ficha) throw new ErrorCarta("Ese vino no tiene ficha con su capacidad: pon la cantidad del escandallo o rellena la ficha en Bebidas → Bodega");
    const porBotella = d.centilitros / ficha.capacidadCl; // botellas por formato
    cantidad = d.productoId ? porBotella : porBotella / Number(lineas[0].cantidad);
  }
  const existe = await prisma.cartaPlatoFormato.findUnique({ where: { platoId_nombre: { platoId: plato.id, nombre: d.nombre } } });
  if (existe?.activo) throw new ErrorCarta(`El plato ya tiene el formato «${d.nombre}»`);
  const ultimo = await prisma.cartaPlatoFormato.aggregate({ where: { platoId: plato.id }, _max: { orden: true } });
  const datosFormato = { precio: d.precio, cantidad: Math.round(cantidad! * 10000) / 10000, productoId: d.productoId ?? null, activo: true };
  if (existe) await prisma.cartaPlatoFormato.update({ where: { id: existe.id }, data: datosFormato });
  else await prisma.cartaPlatoFormato.create({ data: { platoId: plato.id, nombre: d.nombre, orden: (ultimo._max.orden ?? 0) + 1, ...datosFormato } });
  await sincronizarPrecio(prisma, plato.id);
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaPlatoFormato", entidadId: plato.id, accion: "añadir formato", despues: { nombre: d.nombre, ...datosFormato } });
}

async function formatoDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const f = await tx.cartaPlatoFormato.findFirst({ where: { id, plato: { tenantId: ctx.tenant.id } } });
  if (!f) throw new ErrorCarta("El formato no existe");
  return f;
}

export async function actualizarFormato(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaFormatoCambio.parse(datos);
  const prisma = await db();
  const f = await formatoDeLaCadena(prisma, ctx, d.id);
  await prisma.cartaPlatoFormato.update({ where: { id: f.id }, data: { precio: d.precio, cantidad: d.cantidad } });
  await sincronizarPrecio(prisma, f.platoId);
  if (Number(f.precio) !== d.precio)
    await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaPlatoFormato", entidadId: f.id, accion: "cambiar precio", antes: { precio: Number(f.precio) }, despues: { precio: d.precio } });
}

/** Quita un formato (se desactiva: más adelante las ventas del TPV lo referenciarán). */
export async function quitarFormato(ctx: Contexto, id: string) {
  const prisma = await db();
  const f = await formatoDeLaCadena(prisma, ctx, id);
  await prisma.cartaPlatoFormato.update({ where: { id: f.id }, data: { activo: false } });
  await sincronizarPrecio(prisma, f.platoId);
}

/** Sube un formato al primer puesto (su precio pasa a ser el del plato). */
export async function formatoPrincipal(ctx: Contexto, id: string) {
  const prisma = await db();
  const f = await formatoDeLaCadena(prisma, ctx, id);
  const min = await prisma.cartaPlatoFormato.aggregate({ where: { platoId: f.platoId }, _min: { orden: true } });
  await prisma.cartaPlatoFormato.update({ where: { id: f.id }, data: { orden: (min._min.orden ?? 0) - 1 } });
  await sincronizarPrecio(prisma, f.platoId);
}

export async function fijarPrecioCentro(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaPrecioCentro.parse(datos);
  if (!ctx.centros.some((c) => c.id === d.centroId)) throw new ErrorCarta("No tienes acceso a ese local");
  const prisma = await db();
  const plato = await platoDeLaCadena(prisma, ctx, d.platoId);
  const centro = await prisma.centro.findFirst({ where: { id: d.centroId, tenantId: ctx.tenant.id, marcaId: plato.marcaId } });
  if (!centro) throw new ErrorCarta("El local no es de la marca del plato");
  if (plato.centroId && plato.centroId !== d.centroId) throw new ErrorCarta("El plato es solo de otro local");
  const antes = await prisma.cartaPlatoPrecio.findUnique({ where: { platoId_centroId: { platoId: d.platoId, centroId: d.centroId } } });
  await prisma.cartaPlatoPrecio.upsert({
    where: { platoId_centroId: { platoId: d.platoId, centroId: d.centroId } },
    create: { platoId: d.platoId, centroId: d.centroId, precio: d.precio ?? null, disponible: d.disponible },
    update: { precio: d.precio ?? null, disponible: d.disponible },
  });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaPlatoPrecio",
    entidadId: `${d.platoId}:${d.centroId}`,
    accion: "precio por local",
    antes: antes ? { precio: antes.precio ? Number(antes.precio) : null, disponible: antes.disponible } : null,
    despues: { precio: d.precio ?? null, disponible: d.disponible },
  });
}

export async function fijarObjetivoMarca(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaObjetivo.parse(datos);
  const prisma = await db();
  await comprobarMarca(prisma, ctx, d.marcaId);
  const clave = { tenantId_marcaId: { tenantId: ctx.tenant.id, marcaId: d.marcaId } };
  const antes = await prisma.cartaObjetivoMarca.findUnique({ where: clave });
  // Comidas: objetivoCostePct (obligatorio). Bebidas: objetivoBebidasPct (vacío = usar el de Comidas).
  const cambio = d.area === "BEBIDAS" ? { objetivoBebidasPct: d.objetivoCostePct ?? null } : { objetivoCostePct: d.objetivoCostePct! };
  await prisma.cartaObjetivoMarca.upsert({ where: clave, create: { tenantId: ctx.tenant.id, marcaId: d.marcaId, ...cambio }, update: cambio });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaObjetivoMarca",
    entidadId: d.marcaId,
    accion: d.area === "BEBIDAS" ? "objetivo de coste de bebidas" : "objetivo de coste",
    antes: antes ? { comidas: Number(antes.objetivoCostePct), bebidas: antes.objetivoBebidasPct != null ? Number(antes.objetivoBebidasPct) : null } : null,
    despues: { area: d.area, pct: d.objetivoCostePct ?? null },
  });
}

export async function crearCarta(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaCarta.parse(datos);
  const prisma = await db();
  await comprobarMarca(prisma, ctx, d.marcaId);
  const centroId = await comprobarLocal(prisma, ctx, d.centroId, d.marcaId);
  const c = await prisma.carta.create({
    data: { tenantId: ctx.tenant.id, marcaId: d.marcaId, centroId, nombre: d.nombre, tipo: d.tipo, desde: fechaDeTexto(d.desde), hasta: fechaDeTexto(d.hasta) },
  });
  return c.id;
}

async function cartaDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const c = await tx.carta.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!c) throw new ErrorCarta("La carta no existe");
  return c;
}

export async function actualizarCarta(ctx: Contexto, id: string, datos: Record<string, unknown>) {
  const d = esquemaCarta.parse(datos);
  const prisma = await db();
  await cartaDeLaCadena(prisma, ctx, id);
  await prisma.carta.update({ where: { id }, data: { nombre: d.nombre, tipo: d.tipo, desde: fechaDeTexto(d.desde), hasta: fechaDeTexto(d.hasta) } });
}

const NOMBRE_AREA: Record<AreaCarta, { de: string; modulo: string; Modulo: string }> = {
  COMIDAS: { de: "comidas", modulo: "comidas", Modulo: "Comidas" },
  BEBIDAS: { de: "bebidas", modulo: "bebidas", Modulo: "Bebidas" },
};

/**
 * Activa o desactiva una carta entera. La carta es compartida: si se desactiva desde un área (p. ej.
 * Bebidas) y tiene secciones activas de la otra, solo puede hacerlo quien edita también la carta de la
 * otra área, y tiene que confirmarlo (se dejan de ver también esas secciones).
 */
export async function cambiarActivoCarta(ctx: Contexto, id: string, activo: boolean, desde: AreaCarta = "COMIDAS", confirmado = false) {
  const prisma = await db();
  const c = await cartaDeLaCadena(prisma, ctx, id);
  if (!activo) {
    const otra: AreaCarta = desde === "BEBIDAS" ? "COMIDAS" : "BEBIDAS";
    const n = await prisma.cartaSeccion.count({ where: { cartaId: id, activo: true, area: otra } });
    if (n > 0) {
      const A = NOMBRE_AREA[otra];
      if (!(ctx.tieneModulo(A.modulo) && ctx.puede(`${A.modulo}:carta:editar`)))
        throw new ErrorCarta(`La carta «${c.nombre}» también tiene ${n} sección(es) de ${A.de}: solo puede desactivarla quien pueda editar la carta de ${A.Modulo}. Si solo quieres quitar las de ${NOMBRE_AREA[desde].de}, usa «Quitar sección».`);
      if (!confirmado)
        throw new ErrorCarta(`La carta «${c.nombre}» también tiene ${n} sección(es) de ${A.de}: al desactivarla dejan de verse también. Marca la casilla para confirmarlo.`);
    }
  }
  await prisma.carta.update({ where: { id }, data: { activo } });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Carta", entidadId: id, accion: activo ? "activar carta" : "desactivar carta", despues: { nombre: c.nombre, desde } });
}

export async function crearSeccion(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaSeccion.parse(datos);
  const prisma = await db();
  await cartaDeLaCadena(prisma, ctx, d.cartaId);
  const ultimo = await prisma.cartaSeccion.aggregate({ where: { cartaId: d.cartaId }, _max: { orden: true } });
  await prisma.cartaSeccion.create({ data: { cartaId: d.cartaId, area: d.area, nombre: d.nombre, nombreEn: d.nombreEn, orden: (ultimo._max.orden ?? 0) + 1 } });
}

async function seccionDeLaCadena(tx: Tx, ctx: Contexto, id: string) {
  const s = await tx.cartaSeccion.findFirst({ where: { id, carta: { tenantId: ctx.tenant.id } }, include: { carta: true } });
  if (!s) throw new ErrorCarta("La sección no existe");
  return s;
}

/**
 * Quita una sección de la carta: se desactiva (no se borra), con sus platos dentro, para poder
 * recuperarla. Hay que confirmarlo.
 */
export async function quitarSeccion(ctx: Contexto, id: string, confirmado: boolean) {
  const prisma = await db();
  const s = await seccionDeLaCadena(prisma, ctx, id);
  if (!s.activo) throw new ErrorCarta("La sección ya está quitada");
  if (!confirmado) throw new ErrorCarta(`Marca la casilla para confirmar que quitas la sección «${s.nombre}» de la carta «${s.carta.nombre}».`);
  const platos = await prisma.cartaLinea.count({ where: { seccionId: s.id } });
  await prisma.cartaSeccion.update({ where: { id: s.id }, data: { activo: false } });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaSeccion", entidadId: s.id, accion: "quitar sección", despues: { carta: s.carta.nombre, seccion: s.nombre, platos } });
}

/** Vuelve a poner en la carta una sección quitada, con los platos que tenía. */
export async function recuperarSeccion(ctx: Contexto, id: string) {
  const prisma = await db();
  const s = await seccionDeLaCadena(prisma, ctx, id);
  if (s.activo) return;
  await prisma.cartaSeccion.update({ where: { id: s.id }, data: { activo: true } });
  await auditar(prisma, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CartaSeccion", entidadId: s.id, accion: "recuperar sección", despues: { carta: s.carta.nombre, seccion: s.nombre } });
}

export async function anadirPlatoSeccion(ctx: Contexto, seccionId: string, platoId: string) {
  const prisma = await db();
  const s = await seccionDeLaCadena(prisma, ctx, seccionId);
  if (!s.activo) throw new ErrorCarta("La sección está quitada: recupérala antes de añadirle platos");
  const plato = await platoDeLaCadena(prisma, ctx, platoId);
  if (plato.marcaId !== s.carta.marcaId) throw new ErrorCarta("El plato es de otra marca");
  if (plato.area !== s.area) throw new ErrorCarta(s.area === "BEBIDAS" ? "En una sección de bebidas solo van bebidas" : "En una sección de comidas solo van platos de comida");
  if (plato.centroId && plato.centroId !== s.carta.centroId) throw new ErrorCarta("El plato es solo de un local: solo puede ir en una carta de ese local");
  const existe = await prisma.cartaLinea.findUnique({ where: { seccionId_platoId: { seccionId, platoId } } });
  if (existe) throw new ErrorCarta("El plato ya está en esa sección");
  const ultimo = await prisma.cartaLinea.aggregate({ where: { seccionId }, _max: { orden: true } });
  await prisma.cartaLinea.create({ data: { seccionId, platoId, orden: (ultimo._max.orden ?? 0) + 1 } });
}

export async function quitarPlatoSeccion(ctx: Contexto, lineaId: string) {
  const prisma = await db();
  const l = await prisma.cartaLinea.findFirst({ where: { id: lineaId, seccion: { carta: { tenantId: ctx.tenant.id } } } });
  if (!l) throw new ErrorCarta("La línea no existe");
  await prisma.cartaLinea.delete({ where: { id: l.id } });
}

export async function fijarRecargo(ctx: Contexto, datos: Record<string, unknown>) {
  const d = esquemaRecargo.parse(datos);
  const prisma = await db();
  if (!ctx.centros.some((c) => c.id === d.centroId)) throw new ErrorCarta("No tienes acceso a ese local");
  const antes = await prisma.cartaRecargo.findUnique({ where: { tenantId_centroId_concepto: { tenantId: ctx.tenant.id, centroId: d.centroId, concepto: "Pan y aperitivo" } } });
  const platoId = d.platoId ?? null;
  if (platoId) {
    // el plato del escandallo tiene que ser de comidas, de la marca del local o del propio local
    const centro = await prisma.centro.findFirst({ where: { id: d.centroId, tenantId: ctx.tenant.id }, select: { marcaId: true } });
    const plato = await prisma.cartaPlato.findFirst({ where: { id: platoId, tenantId: ctx.tenant.id, area: "COMIDAS", OR: [{ centroId: d.centroId }, { centroId: null, marcaId: centro?.marcaId ?? "-" }] }, select: { id: true } });
    if (!plato) throw new ErrorCarta("Ese plato no es de la carta de este local");
  }
  await prisma.cartaRecargo.upsert({
    where: { tenantId_centroId_concepto: { tenantId: ctx.tenant.id, centroId: d.centroId, concepto: "Pan y aperitivo" } },
    create: { tenantId: ctx.tenant.id, centroId: d.centroId, concepto: "Pan y aperitivo", importe: d.importe, iva: d.iva, activo: d.activo, platoId },
    update: { importe: d.importe, iva: d.iva, activo: d.activo, platoId },
  });
  await auditar(prisma, {
    tenantId: ctx.tenant.id,
    usuarioId: ctx.usuario.id,
    entidad: "CartaRecargo",
    entidadId: d.centroId,
    accion: "recargo pan y aperitivo",
    antes: antes ? { importe: Number(antes.importe), iva: Number(antes.iva), activo: antes.activo, platoId: antes.platoId } : null,
    despues: { importe: d.importe, iva: d.iva, activo: d.activo, platoId },
  });
}

export async function guardarAlergenosProducto(ctx: Contexto, productoId: string, alergenos: string[], trazas: string[]) {
  const prisma = await db();
  const p = await prisma.producto.findFirst({ where: { id: productoId, tenantId: ctx.tenant.id } });
  if (!p) throw new ErrorCarta("El producto no existe");
  await fijarAlergenosProducto(prisma, ctx.tenant.id, productoId, alergenos, trazas);
  // los platos que lo llevan quedan pendientes de revisar
  await prisma.cartaPlato.updateMany({ where: { tenantId: ctx.tenant.id, ingredientes: { some: { productoId } } }, data: { alergenosRevisados: false } });
}
