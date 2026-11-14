import "server-only";
/**
 * Organización (núcleo): centros, marcas, sociedades, edificios, áreas por centro y apertura de locales.
 * Ver docs/specs/nucleo/organizacion.md. Toda consulta filtra por la cadena (ctx.tenant.id) y por el
 * ámbito de centros del usuario. Lo que cambia centros, áreas o estados queda en Auditoria.
 */
import { db } from "@/kernel/db";
import { auditar } from "@/kernel/eventos";
import { MODULOS, moduloPorId } from "@/kernel/registro";
import type { Contexto } from "@/kernel/contexto";
import { Prisma } from "@/generated/prisma/client";
import type { EstadoCentro, TipoCentro } from "@/generated/prisma/enums";
import { ErrorNegocio } from "./errores";
import {
  DIAS,
  type DatosCentro,
  type DatosMarca,
  type DatosSociedad,
  type HorarioCentro,
  type NuevoLocal,
  type PlantillaMarca,
} from "./esquemas";

type Tx = Prisma.TransactionClient;

export const NOMBRE_ESTADO: Record<EstadoCentro, string> = {
  PREPARACION: "En preparación",
  ABIERTO: "Abierto",
  TEMPORADA: "Temporada",
  CERRADO_TEMPORAL: "Cerrado temporalmente",
  CERRADO: "Cerrado",
};

export const NOMBRE_TIPO: Record<TipoCentro, string> = { LOCAL: "Local", OBRADOR: "Obrador", ALMACEN: "Almacén" };

/** Datos libres del centro guardados en Centro.datos (se irán sacando a tablas propias). */
export interface DatosExtraCentro {
  horario?: Partial<Record<(typeof DIAS)[number], string>>;
  festivos?: string;
  espacios?: { nombre: string; sentados: number; dePie: number }[];
  servicios?: string[];
  origen?: { tipo: "plantilla" | "copiar" | "vacio"; centroId?: string; marcaId?: string };
}

export function datosExtra(v: unknown): DatosExtraCentro {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as DatosExtraCentro) : {};
}

export function leerPlantilla(v: unknown): PlantillaMarca {
  const p = v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<PlantillaMarca>) : {};
  return { areas: Array.isArray(p.areas) ? p.areas : [], centroModeloId: p.centroModeloId, horario: p.horario, horaCorte: p.horaCorte, notas: p.notas };
}

// ---------------------------------------------------------------------------------------------
// Ámbito y áreas
// ---------------------------------------------------------------------------------------------

/** Ids de centros que el usuario puede ver aquí (null = todos los de la cadena, cerrados incluidos). */
export async function ambitoCentros(ctx: Contexto): Promise<string[] | null> {
  if (ctx.usuario.rol === "admin") return null;
  const prisma = await db();
  const u = await prisma.usuario.findFirst({ where: { id: ctx.usuario.id, tenantId: ctx.tenant.id }, include: { centros: true } });
  if (!u || u.todosCentros) return null;
  return u.centros.map((c) => c.centroId);
}

async function exigirCentroVisible(ctx: Contexto, centroId: string) {
  const ambito = await ambitoCentros(ctx);
  if (ambito && !ambito.includes(centroId)) throw new ErrorNegocio("No tienes acceso a ese centro");
}

/** Áreas contratables (no núcleo) que tienen sentido en un tipo de centro. */
export function areasPosibles(contratados: string[], tipo: TipoCentro): string[] {
  return MODULOS.filter((m) => !m.nucleo && contratados.includes(m.id) && (!m.tiposCentro || m.tiposCentro.length === 0 || m.tiposCentro.includes(tipo))).map((m) => m.id);
}

/**
 * Áreas activas de un centro, con la misma regla que kernel/contexto.ts:
 * si el centro no tiene filas en CentroModulo, hereda todas las contratadas que encajan con su tipo.
 */
export function areasActivas(centro: { tipo: TipoCentro; modulos: { modulo: string; activo: boolean }[] }, contratados: string[]): string[] {
  const posibles = areasPosibles(contratados, centro.tipo);
  if (centro.modulos.length === 0) return posibles;
  return posibles.filter((id) => centro.modulos.some((m) => m.modulo === id && m.activo));
}

/**
 * Antes de escribir la primera fila de CentroModulo de un centro, se «fija» lo que heredaba
 * (si no, al activar un área el centro perdería todas las demás).
 */
async function fijarAreasHeredadas(tx: Tx, centroId: string, tipo: TipoCentro, contratados: string[]) {
  const n = await tx.centroModulo.count({ where: { centroId } });
  if (n > 0) return;
  const ids = areasPosibles(contratados, tipo);
  if (ids.length) await tx.centroModulo.createMany({ data: ids.map((modulo) => ({ centroId, modulo, activo: true })), skipDuplicates: true });
}

/** Guarda las áreas activas de un centro (solo contratadas y que encajen con su tipo). Nunca borra filas. */
export async function guardarAreasCentro(ctx: Contexto, centroId: string, activas: string[]) {
  await exigirCentroVisible(ctx, centroId);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const centro = await tx.centro.findFirst({ where: { id: centroId, tenantId: ctx.tenant.id }, include: { modulos: true } });
    if (!centro) throw new ErrorNegocio("Centro no encontrado");
    const posibles = areasPosibles(ctx.contratados, centro.tipo);
    const antes = areasActivas(centro, ctx.contratados);
    const pedidas = activas.filter((a) => posibles.includes(a));
    // respetar «requiere»: no se activa un área si la que necesita no queda activa en el centro
    for (const a of pedidas) {
      const req = (moduloPorId(a)?.requiere ?? []).filter((r) => posibles.includes(r));
      const falta = req.find((r) => !pedidas.includes(r));
      if (falta) throw new ErrorNegocio(`${moduloPorId(a)?.nombre} necesita ${moduloPorId(falta)?.nombre ?? falta} activo en el centro`);
    }
    for (const modulo of posibles) {
      await tx.centroModulo.upsert({
        where: { centroId_modulo: { centroId, modulo } },
        create: { centroId, modulo, activo: pedidas.includes(modulo) },
        update: { activo: pedidas.includes(modulo) },
      });
    }
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Centro", entidadId: centroId, accion: "areas", antes, despues: pedidas });
  });
}

/** Desde «Módulos contratados»: en qué centros está activa un área. */
export async function guardarCentrosDeModulo(ctx: Contexto, moduloId: string, centroIds: string[]) {
  const man = moduloPorId(moduloId);
  if (!man || man.nucleo) throw new ErrorNegocio("Módulo no válido");
  if (!ctx.tieneModulo(moduloId)) throw new ErrorNegocio("El módulo no está contratado por la cadena");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const centros = await tx.centro.findMany({ where: { tenantId: ctx.tenant.id, estado: { not: "CERRADO" } }, include: { modulos: true } });
    const cambios: { centro: string; activo: boolean }[] = [];
    for (const c of centros) {
      if (man.tiposCentro && man.tiposCentro.length && !man.tiposCentro.includes(c.tipo)) continue;
      const antes = areasActivas(c, ctx.contratados).includes(moduloId);
      const despues = centroIds.includes(c.id);
      if (antes === despues) continue;
      if (despues) {
        const falta = (man.requiere ?? []).find((r) => areasPosibles(ctx.contratados, c.tipo).includes(r) && !areasActivas(c, ctx.contratados).includes(r));
        if (falta) throw new ErrorNegocio(`En ${c.nombre}, ${man.nombre} necesita ${moduloPorId(falta)?.nombre ?? falta} activo`);
      } else {
        const dependiente = MODULOS.find((m) => m.requiere?.includes(moduloId) && areasActivas(c, ctx.contratados).includes(m.id));
        if (dependiente) throw new ErrorNegocio(`En ${c.nombre}, ${dependiente.nombre} usa ${man.nombre}: desactívalo antes`);
      }
      await fijarAreasHeredadas(tx, c.id, c.tipo, ctx.contratados);
      await tx.centroModulo.upsert({
        where: { centroId_modulo: { centroId: c.id, modulo: moduloId } },
        create: { centroId: c.id, modulo: moduloId, activo: despues },
        update: { activo: despues },
      });
      cambios.push({ centro: c.codigo, activo: despues });
    }
    if (cambios.length)
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "CentroModulo", entidadId: moduloId, accion: "centros", despues: cambios });
  });
}

/**
 * Cuando la cadena contrata un área nueva: los centros que ya tienen sus áreas fijadas
 * (filas en CentroModulo) la reciben activa si encaja con su tipo. Lo llama Usuarios › Módulos.
 */
export async function extenderAreaNueva(tx: Tx, tenantId: string, moduloId: string) {
  const man = moduloPorId(moduloId);
  if (!man) return;
  const centros = await tx.centro.findMany({ where: { tenantId, modulos: { some: {} } }, select: { id: true, tipo: true } });
  for (const c of centros) {
    if (man.tiposCentro && man.tiposCentro.length && !man.tiposCentro.includes(c.tipo)) continue;
    await tx.centroModulo.upsert({
      where: { centroId_modulo: { centroId: c.id, modulo: moduloId } },
      create: { centroId: c.id, modulo: moduloId, activo: true },
      update: {},
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Centros
// ---------------------------------------------------------------------------------------------

const incluirCentro = {
  marca: true,
  sociedad: true,
  edificio: true,
  modulos: true,
  _count: { select: { ajustesProducto: true, ambitos: true } },
} satisfies Prisma.CentroInclude;

export async function listarCentros(ctx: Contexto, filtro?: { estado?: string; marcaId?: string; sociedadId?: string }) {
  const prisma = await db();
  const ambito = await ambitoCentros(ctx);
  return prisma.centro.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(ambito ? { id: { in: ambito } } : {}),
      ...(filtro?.estado ? { estado: filtro.estado as EstadoCentro } : {}),
      ...(filtro?.marcaId ? { marcaId: filtro.marcaId } : {}),
      ...(filtro?.sociedadId ? { sociedadId: filtro.sociedadId } : {}),
    },
    include: incluirCentro,
    orderBy: [{ tipo: "desc" }, { codigo: "asc" }],
  });
}

export async function obtenerCentro(ctx: Contexto, id: string) {
  await exigirCentroVisible(ctx, id);
  const prisma = await db();
  const c = await prisma.centro.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: incluirCentro });
  if (!c) throw new ErrorNegocio("Centro no encontrado");
  return c;
}

export async function listarEdificios(ctx: Contexto) {
  const prisma = await db();
  return prisma.edificio.findMany({ where: { tenantId: ctx.tenant.id }, include: { centros: { select: { codigo: true } } }, orderBy: [{ ciudad: "asc" }, { direccion: "asc" }] });
}

/** Teléfono y correo únicos entre los centros de la cadena. */
async function comprobarContactoUnico(tx: Tx, tenantId: string, datos: { telefono?: string; email?: string }, excluirId?: string) {
  if (datos.telefono) {
    const otro = await tx.centro.findFirst({ where: { tenantId, telefono: datos.telefono, ...(excluirId ? { id: { not: excluirId } } : {}) } });
    if (otro) throw new ErrorNegocio(`El teléfono ya lo usa ${otro.nombre}`);
  }
  if (datos.email) {
    const otro = await tx.centro.findFirst({ where: { tenantId, email: datos.email, ...(excluirId ? { id: { not: excluirId } } : {}) } });
    if (otro) throw new ErrorNegocio(`El correo ya lo usa ${otro.nombre}`);
  }
}

async function resolverEdificio(tx: Tx, tenantId: string, d: DatosCentro["direccion"], edificioActualId?: string | null): Promise<string> {
  if (d.edificioId) {
    const e = await tx.edificio.findFirst({ where: { id: d.edificioId, tenantId } });
    if (!e) throw new ErrorNegocio("Edificio no encontrado");
    return e.id;
  }
  const datos = { direccion: d.direccion!, cp: d.cp ?? null, ciudad: d.ciudad!, provincia: d.provincia ?? null, comunidad: d.comunidad ?? null };
  if (edificioActualId) {
    // si el edificio actual solo lo usa este centro, se corrige; si lo comparte, se crea otro
    const usos = await tx.centro.count({ where: { edificioId: edificioActualId } });
    if (usos <= 1) {
      await tx.edificio.update({ where: { id: edificioActualId }, data: datos });
      return edificioActualId;
    }
  }
  const nuevo = await tx.edificio.create({ data: { tenantId, ...datos } });
  return nuevo.id;
}

async function comprobarMarcaSociedad(tx: Tx, tenantId: string, marcaId?: string, sociedadId?: string) {
  if (marcaId && !(await tx.marca.findFirst({ where: { id: marcaId, tenantId } }))) throw new ErrorNegocio("Marca no encontrada");
  if (sociedadId && !(await tx.sociedad.findFirst({ where: { id: sociedadId, tenantId } }))) throw new ErrorNegocio("Sociedad no encontrada");
}

function fotoCentro(c: { codigo: string; nombre: string; tipo: string; estado: string; marcaId: string | null; sociedadId: string | null; edificioId: string | null; telefono: string | null; email: string | null; horaCorte: string; aperturaEn: Date | null }) {
  return { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, estado: c.estado, marcaId: c.marcaId, sociedadId: c.sociedadId, edificioId: c.edificioId, telefono: c.telefono, email: c.email, horaCorte: c.horaCorte, aperturaEn: c.aperturaEn };
}

export async function actualizarCentro(ctx: Contexto, id: string, d: DatosCentro) {
  await exigirCentroVisible(ctx, id);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const c = await tx.centro.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!c) throw new ErrorNegocio("Centro no encontrado");
    if (d.tipo !== c.tipo && (await tx.centroModulo.count({ where: { centroId: id } })) > 0)
      throw new ErrorNegocio("Para cambiar el tipo de centro, revisa antes sus áreas activas");
    await comprobarContactoUnico(tx, ctx.tenant.id, d, id);
    await comprobarMarcaSociedad(tx, ctx.tenant.id, d.marcaId, d.sociedadId);
    const edificioId = await resolverEdificio(tx, ctx.tenant.id, d.direccion, c.edificioId);
    const nuevo = await tx.centro.update({
      where: { id },
      data: {
        codigo: d.codigo,
        nombre: d.nombre,
        tipo: d.tipo,
        marcaId: d.marcaId ?? null,
        sociedadId: d.sociedadId ?? null,
        telefono: d.telefono ?? null,
        email: d.email ?? null,
        horaCorte: d.horaCorte,
        aperturaEn: d.aperturaEn ?? null,
        edificioId,
      },
    });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Centro", entidadId: id, accion: "editar", antes: fotoCentro(c), despues: fotoCentro(nuevo) });
  });
}

export async function guardarHorario(ctx: Contexto, id: string, h: HorarioCentro) {
  await exigirCentroVisible(ctx, id);
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const c = await tx.centro.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!c) throw new ErrorNegocio("Centro no encontrado");
    const antes = datosExtra(c.datos);
    const despues: DatosExtraCentro = { ...antes, horario: h.horario, festivos: h.festivos, espacios: h.espacios, servicios: h.servicios };
    await tx.centro.update({ where: { id }, data: { horaCorte: h.horaCorte, datos: despues as Prisma.InputJsonValue } });
    await auditar(tx, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "Centro",
      entidadId: id,
      accion: "horario",
      antes: { horaCorte: c.horaCorte, horario: antes.horario ?? null, espacios: antes.espacios ?? null },
      despues: { horaCorte: h.horaCorte, horario: h.horario, espacios: h.espacios },
    });
  });
}

/** Transiciones de estado permitidas. Cerrar nunca borra nada: solo cambia el estado. */
const TRANSICIONES: Record<EstadoCentro, EstadoCentro[]> = {
  PREPARACION: ["ABIERTO", "CERRADO"],
  ABIERTO: ["TEMPORADA", "CERRADO_TEMPORAL", "CERRADO"],
  TEMPORADA: ["ABIERTO", "CERRADO_TEMPORAL", "CERRADO"],
  CERRADO_TEMPORAL: ["ABIERTO", "TEMPORADA", "CERRADO"],
  CERRADO: ["ABIERTO", "CERRADO_TEMPORAL"],
};

export function estadosSiguientes(e: EstadoCentro): EstadoCentro[] {
  return TRANSICIONES[e];
}

export async function cambiarEstadoCentro(ctx: Contexto, id: string, estado: EstadoCentro, motivo?: string) {
  await exigirCentroVisible(ctx, id);
  const prisma = await db();
  // fuera de la transacción: la conexión es única (max: 1) y una consulta suelta dentro la bloquearía
  const previo = await prisma.centro.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!previo) throw new ErrorNegocio("Centro no encontrado");
  if (previo.estado === "PREPARACION" && estado === "ABIERTO") {
    const pendientes = (await revisionApertura(ctx, id)).filter((r) => r.grave && !r.ok);
    if (pendientes.length) throw new ErrorNegocio(`Antes de abrir falta: ${pendientes.map((p) => p.texto.toLowerCase()).join(", ")}`);
  }
  await prisma.$transaction(async (tx) => {
    const c = await tx.centro.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!c) throw new ErrorNegocio("Centro no encontrado");
    if (!TRANSICIONES[c.estado].includes(estado)) throw new ErrorNegocio(`No se puede pasar de «${NOMBRE_ESTADO[c.estado]}» a «${NOMBRE_ESTADO[estado]}»`);
    await tx.centro.update({
      where: { id },
      data: { estado, ...(estado === "ABIERTO" && c.estado === "PREPARACION" && !c.aperturaEn ? { aperturaEn: new Date() } : {}) },
    });
    const accion = estado === "ABIERTO" && c.estado === "PREPARACION" ? "abrir" : estado.startsWith("CERRADO") ? "cerrar" : "estado";
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Centro", entidadId: id, accion, antes: { estado: c.estado }, despues: { estado, motivo: motivo ?? null } });
  });
}

// ---------------------------------------------------------------------------------------------
// Asistente de apertura de local
// ---------------------------------------------------------------------------------------------

/** Copia los ajustes de productos (activo, mínimo y máximo) de un centro a otro. No toca el stock. */
async function copiarAjustesProductos(tx: Tx, tenantId: string, origenId: string, destinoId: string): Promise<number> {
  const origen = await tx.productoCentro.findMany({ where: { centroId: origenId, producto: { tenantId } } });
  for (const pc of origen) {
    await tx.productoCentro.upsert({
      where: { productoId_centroId: { productoId: pc.productoId, centroId: destinoId } },
      create: { productoId: pc.productoId, centroId: destinoId, activo: pc.activo, minimo: pc.minimo, maximo: pc.maximo },
      update: { activo: pc.activo, minimo: pc.minimo, maximo: pc.maximo },
    });
  }
  return origen.length;
}

/** Áreas de partida de un local nuevo según su origen (copiar de otro, plantilla de marca o vacío = todas). */
async function areasDeOrigen(tx: Tx, ctx: Contexto, tipo: TipoCentro, origen: NuevoLocal["origen"], centroOrigenId?: string, plantilla?: PlantillaMarca): Promise<string[]> {
  const posibles = areasPosibles(ctx.contratados, tipo);
  if (origen === "copiar" && centroOrigenId) {
    const o = await tx.centro.findFirst({ where: { id: centroOrigenId, tenantId: ctx.tenant.id }, include: { modulos: true } });
    if (!o) throw new ErrorNegocio("Local de origen no encontrado");
    return areasActivas(o, ctx.contratados).filter((a) => posibles.includes(a));
  }
  if (origen === "plantilla" && plantilla && plantilla.areas.length) return plantilla.areas.filter((a) => posibles.includes(a));
  return posibles;
}

/** Pasos 1 y 2: crea el local «en preparación» con lo heredado. Devuelve su id. */
export async function crearLocal(ctx: Contexto, d: NuevoLocal): Promise<string> {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const tenantId = ctx.tenant.id;
    if (await tx.centro.findFirst({ where: { tenantId, codigo: d.codigo } })) throw new ErrorNegocio(`Ya hay un centro con el código ${d.codigo}`);
    await comprobarContactoUnico(tx, tenantId, d);

    // Marca: existente o nueva
    let marcaId = d.marcaId;
    if (!marcaId && d.marcaNueva) {
      if (await tx.marca.findFirst({ where: { tenantId, nombre: d.marcaNueva } })) throw new ErrorNegocio(`Ya existe la marca ${d.marcaNueva}: elígela de la lista`);
      const m = await tx.marca.create({ data: { tenantId, nombre: d.marcaNueva } });
      marcaId = m.id;
      await auditar(tx, { tenantId, usuarioId: ctx.usuario.id, entidad: "Marca", entidadId: m.id, accion: "crear", despues: { nombre: m.nombre } });
    }
    // Sociedad: existente o nueva
    let sociedadId = d.sociedadId;
    if (!sociedadId && d.sociedadNueva) {
      if (await tx.sociedad.findFirst({ where: { tenantId, cif: d.sociedadNueva.cif } })) throw new ErrorNegocio(`Ya existe una sociedad con el CIF ${d.sociedadNueva.cif}: elígela de la lista`);
      const s = await tx.sociedad.create({ data: { tenantId, razonSocial: d.sociedadNueva.razonSocial, cif: d.sociedadNueva.cif } });
      sociedadId = s.id;
      await auditar(tx, { tenantId, usuarioId: ctx.usuario.id, entidad: "Sociedad", entidadId: s.id, accion: "crear", despues: { razonSocial: s.razonSocial, cif: s.cif } });
    }
    await comprobarMarcaSociedad(tx, tenantId, marcaId, sociedadId);

    const marca = marcaId ? await tx.marca.findFirst({ where: { id: marcaId, tenantId } }) : null;
    const plantilla = marca ? leerPlantilla(marca.plantilla) : undefined;
    const centroOrigenId = d.origen === "copiar" ? d.centroOrigenId : d.origen === "plantilla" ? plantilla?.centroModeloId : undefined;
    const origen = centroOrigenId ? await tx.centro.findFirst({ where: { id: centroOrigenId, tenantId } }) : null;
    if (d.origen === "copiar" && !origen) throw new ErrorNegocio("Local de origen no encontrado");

    // Horario y espacios de partida: del local copiado o de la plantilla de marca
    const extraOrigen = origen ? datosExtra(origen.datos) : {};
    const datos: DatosExtraCentro = {
      horario: d.origen === "copiar" ? extraOrigen.horario : (plantilla?.horario ?? extraOrigen.horario),
      espacios: d.origen === "copiar" ? extraOrigen.espacios : undefined,
      servicios: d.origen === "copiar" ? extraOrigen.servicios : undefined,
      origen: { tipo: d.origen, centroId: centroOrigenId, marcaId },
    };

    const edificioId = await resolverEdificio(tx, tenantId, d.direccion);
    const centro = await tx.centro.create({
      data: {
        tenantId,
        codigo: d.codigo,
        nombre: d.nombre,
        tipo: d.tipo,
        estado: "PREPARACION",
        marcaId: marcaId ?? null,
        sociedadId: sociedadId ?? null,
        edificioId,
        telefono: d.telefono ?? null,
        email: d.email ?? null,
        aperturaEn: d.aperturaEn ?? null,
        horaCorte: (d.origen === "copiar" ? origen?.horaCorte : plantilla?.horaCorte) ?? origen?.horaCorte ?? "05:00",
        datos: datos as Prisma.InputJsonValue,
      },
    });

    // Áreas activas del local (filas fijas desde el principio)
    const areas = await areasDeOrigen(tx, ctx, d.tipo, d.origen, d.origen === "copiar" ? d.centroOrigenId : undefined, plantilla);
    const posibles = areasPosibles(ctx.contratados, d.tipo);
    if (posibles.length)
      await tx.centroModulo.createMany({ data: posibles.map((modulo) => ({ centroId: centro.id, modulo, activo: areas.includes(modulo) })) });

    // Ajustes de productos (mínimos y activos) del local de origen o del local modelo de la marca
    const copiados = origen ? await copiarAjustesProductos(tx, tenantId, origen.id, centro.id) : 0;

    await auditar(tx, {
      tenantId,
      usuarioId: ctx.usuario.id,
      entidad: "Centro",
      entidadId: centro.id,
      accion: "crear",
      despues: { ...fotoCentro(centro), origen: datos.origen, areas, productosCopiados: copiados },
    });
    return centro.id;
  });
}

/** Paso «Bebidas y productos»: copiar los ajustes de productos de otro centro a este. */
export async function copiarProductosDe(ctx: Contexto, destinoId: string, origenId: string): Promise<number> {
  await exigirCentroVisible(ctx, destinoId);
  if (destinoId === origenId) throw new ErrorNegocio("Elige otro centro");
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const [o, dst] = await Promise.all([
      tx.centro.findFirst({ where: { id: origenId, tenantId: ctx.tenant.id } }),
      tx.centro.findFirst({ where: { id: destinoId, tenantId: ctx.tenant.id } }),
    ]);
    if (!o || !dst) throw new ErrorNegocio("Centro no encontrado");
    const n = await copiarAjustesProductos(tx, ctx.tenant.id, origenId, destinoId);
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Centro", entidadId: destinoId, accion: "copiar-productos", despues: { desde: o.codigo, productos: n } });
    return n;
  });
}

/** Locales a medio preparar (para retomar el asistente). */
export async function localesEnPreparacion(ctx: Contexto) {
  const prisma = await db();
  const ambito = await ambitoCentros(ctx);
  return prisma.centro.findMany({
    where: { tenantId: ctx.tenant.id, estado: "PREPARACION", ...(ambito ? { id: { in: ambito } } : {}) },
    include: { marca: true },
    orderBy: { createdAt: "desc" },
  });
}

export interface PuntoRevision {
  texto: string;
  ok: boolean;
  grave: boolean; // si es grave, no se puede abrir
  paso: string; // id del paso del asistente donde se arregla
}

/** Paso 14: lo que falta antes de abrir (los graves impiden abrir). */
export async function revisionApertura(ctx: Contexto, centroId: string): Promise<PuntoRevision[]> {
  const prisma = await db();
  const c = await prisma.centro.findFirst({ where: { id: centroId, tenantId: ctx.tenant.id }, include: { modulos: true, edificio: true, _count: { select: { ajustesProducto: true, ambitos: true } } } });
  if (!c) throw new ErrorNegocio("Centro no encontrado");
  const extra = datosExtra(c.datos);
  const areas = areasActivas(c, ctx.contratados);
  const tieneHorario = !!extra.horario && Object.values(extra.horario).some((v) => v && !/^cerrado$/i.test(v));
  const puntos: PuntoRevision[] = [
    { texto: "Marca", ok: c.tipo !== "LOCAL" || !!c.marcaId, grave: true, paso: "datos" },
    { texto: "Sociedad", ok: !!c.sociedadId, grave: true, paso: "datos" },
    { texto: "Dirección", ok: !!c.edificio, grave: true, paso: "datos" },
    { texto: "Teléfono del local", ok: !!c.telefono, grave: false, paso: "datos" },
    { texto: "Correo del local", ok: !!c.email, grave: false, paso: "datos" },
    { texto: "Fecha de apertura prevista", ok: !!c.aperturaEn, grave: false, paso: "datos" },
    { texto: "Horario", ok: tieneHorario, grave: false, paso: "horario" },
    { texto: "Áreas activas", ok: areas.length > 0 || areasPosibles(ctx.contratados, c.tipo).length === 0, grave: false, paso: "areas" },
  ];
  if (ctx.tieneModulo("bebidas") || ctx.tieneModulo("comidas"))
    puntos.push({ texto: "Productos que puede pedir", ok: c._count.ajustesProducto > 0, grave: false, paso: "productos" });
  puntos.push({ texto: "Usuarios con acceso al local", ok: c._count.ambitos > 0, grave: false, paso: "usuarios" });
  return puntos;
}

// ---------------------------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------------------------

export async function listarMarcas(ctx: Contexto) {
  const prisma = await db();
  return prisma.marca.findMany({
    where: { tenantId: ctx.tenant.id },
    include: { centros: { select: { id: true, codigo: true, nombre: true, estado: true } } },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });
}

export async function obtenerMarca(ctx: Contexto, id: string) {
  const prisma = await db();
  const m = await prisma.marca.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { centros: { select: { id: true, codigo: true, nombre: true, estado: true } } } });
  if (!m) throw new ErrorNegocio("Marca no encontrada");
  return m;
}

function fotoMarca(m: { nombre: string; concepto: string | null; lema: string | null; web: string | null; instagram: string | null; colorPrincipal: string | null; colorFondo: string | null; activo: boolean }) {
  return { nombre: m.nombre, concepto: m.concepto, lema: m.lema, web: m.web, instagram: m.instagram, colorPrincipal: m.colorPrincipal, colorFondo: m.colorFondo, activo: m.activo };
}

export async function guardarMarca(ctx: Contexto, id: string | null, d: DatosMarca): Promise<string> {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const datos = { nombre: d.nombre, concepto: d.concepto ?? null, lema: d.lema ?? null, web: d.web ?? null, instagram: d.instagram ?? null, colorPrincipal: d.colorPrincipal ?? null, colorFondo: d.colorFondo ?? null };
    const repetida = await tx.marca.findFirst({ where: { tenantId: ctx.tenant.id, nombre: d.nombre, ...(id ? { id: { not: id } } : {}) } });
    if (repetida) throw new ErrorNegocio(`Ya existe la marca ${d.nombre}`);
    if (!id) {
      const m = await tx.marca.create({ data: { tenantId: ctx.tenant.id, ...datos } });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Marca", entidadId: m.id, accion: "crear", despues: fotoMarca(m) });
      return m.id;
    }
    const antes = await tx.marca.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!antes) throw new ErrorNegocio("Marca no encontrada");
    const m = await tx.marca.update({ where: { id }, data: datos });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Marca", entidadId: id, accion: "editar", antes: fotoMarca(antes), despues: fotoMarca(m) });
    return id;
  });
}

export async function guardarPlantillaMarca(ctx: Contexto, id: string, p: PlantillaMarca) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const m = await tx.marca.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!m) throw new ErrorNegocio("Marca no encontrada");
    if (p.centroModeloId && !(await tx.centro.findFirst({ where: { id: p.centroModeloId, tenantId: ctx.tenant.id } }))) throw new ErrorNegocio("Local modelo no encontrado");
    const limpia: PlantillaMarca = { ...p, areas: p.areas.filter((a) => ctx.contratados.includes(a) && !moduloPorId(a)?.nucleo) };
    await tx.marca.update({ where: { id }, data: { plantilla: limpia as Prisma.InputJsonValue } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Marca", entidadId: id, accion: "plantilla", antes: m.plantilla, despues: limpia });
  });
}

export async function activarMarca(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const m = await tx.marca.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!m) throw new ErrorNegocio("Marca no encontrada");
    await tx.marca.update({ where: { id }, data: { activo } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Marca", entidadId: id, accion: activo ? "activar" : "desactivar", antes: { activo: m.activo }, despues: { activo } });
  });
}

// ---------------------------------------------------------------------------------------------
// Sociedades
// ---------------------------------------------------------------------------------------------

export async function listarSociedades(ctx: Contexto) {
  const prisma = await db();
  return prisma.sociedad.findMany({
    where: { tenantId: ctx.tenant.id },
    include: { centros: { select: { id: true, codigo: true, nombre: true, estado: true } } },
    orderBy: [{ activo: "desc" }, { razonSocial: "asc" }],
  });
}

export async function obtenerSociedad(ctx: Contexto, id: string) {
  const prisma = await db();
  const s = await prisma.sociedad.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { centros: { select: { id: true, codigo: true, nombre: true, estado: true } } } });
  if (!s) throw new ErrorNegocio("Sociedad no encontrada");
  return s;
}

export async function guardarSociedad(ctx: Contexto, id: string | null, d: DatosSociedad): Promise<string> {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const repetida = await tx.sociedad.findFirst({ where: { tenantId: ctx.tenant.id, cif: d.cif, ...(id ? { id: { not: id } } : {}) } });
    if (repetida) throw new ErrorNegocio(`El CIF ${d.cif} ya es de ${repetida.razonSocial}`);
    const datos = { razonSocial: d.razonSocial, cif: d.cif, domicilio: d.domicilio ?? null, email: d.email ?? null, iban: d.iban ?? null };
    // el IBAN no se guarda entero en el historial
    const foto = (s: typeof datos) => ({ ...s, iban: s.iban ? `…${s.iban.slice(-4)}` : null });
    if (!id) {
      const s = await tx.sociedad.create({ data: { tenantId: ctx.tenant.id, ...datos } });
      await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Sociedad", entidadId: s.id, accion: "crear", despues: foto(datos) });
      return s.id;
    }
    const antes = await tx.sociedad.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!antes) throw new ErrorNegocio("Sociedad no encontrada");
    await tx.sociedad.update({ where: { id }, data: datos });
    await auditar(tx, {
      tenantId: ctx.tenant.id,
      usuarioId: ctx.usuario.id,
      entidad: "Sociedad",
      entidadId: id,
      accion: "editar",
      antes: foto({ razonSocial: antes.razonSocial, cif: antes.cif, domicilio: antes.domicilio, email: antes.email, iban: antes.iban }),
      despues: foto(datos),
    });
    return id;
  });
}

export async function activarSociedad(ctx: Contexto, id: string, activo: boolean) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const s = await tx.sociedad.findFirst({ where: { id, tenantId: ctx.tenant.id } });
    if (!s) throw new ErrorNegocio("Sociedad no encontrada");
    await tx.sociedad.update({ where: { id }, data: { activo } });
    await auditar(tx, { tenantId: ctx.tenant.id, usuarioId: ctx.usuario.id, entidad: "Sociedad", entidadId: id, accion: activo ? "activar" : "desactivar", antes: { activo: s.activo }, despues: { activo } });
  });
}
