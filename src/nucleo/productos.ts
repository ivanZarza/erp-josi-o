import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar, emitir } from "@/kernel/eventos";
import { ErrorNegocio, num, r4, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Catálogo de productos de un área (Bebidas o Comidas). Motor común del núcleo.
 * Reglas: coste obligatorio salvo «sin coste» con motivo (se guarda en Producto.motivoSinCoste; si se quita
 * «sin coste», el motivo se borra); un producto nunca se borra, se desactiva.
 * «Unidades por formato de compra» (cajas de 6…): la propuesta de compra redondea a formatos completos y el
 * texto del pedido al proveedor dice cuántos formatos son (compras.ts).
 */

export interface DatosProducto {
  referencia: string;
  nombre: string;
  familiaId: string | null;
  nuevaFamilia?: string | null;
  proveedorId: string | null;
  unidad: string;
  unidadesCompra: number;
  costeUnitario: number;
  sinCoste: boolean;
  motivoSinCoste?: string | null;
  iva: number;
  stockMinimo: number;
  codigoBarras: string | null;
}

export async function listarFamilias(tx: Tx, tenantId: string, area: AreaAlmacen) {
  return tx.familiaProducto.findMany({ where: { tenantId, area, activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
}

export async function listarProductos(
  tx: Tx,
  tenantId: string,
  area: AreaAlmacen,
  filtros: { texto?: string; familiaId?: string; proveedorId?: string; incluirInactivos?: boolean } = {},
) {
  const texto = filtros.texto?.trim();
  return tx.producto.findMany({
    where: {
      tenantId,
      area,
      ...(filtros.incluirInactivos ? {} : { activo: true }),
      ...(filtros.familiaId ? { familiaId: filtros.familiaId } : {}),
      ...(filtros.proveedorId ? { proveedorId: filtros.proveedorId } : {}),
      ...(texto
        ? { OR: [{ nombre: { contains: texto, mode: "insensitive" } }, { referencia: { contains: texto, mode: "insensitive" } }, { codigoBarras: { contains: texto } }] }
        : {}),
    },
    include: { familia: true, proveedor: { select: { id: true, nombre: true } } },
    orderBy: [{ familia: { orden: "asc" } }, { nombre: "asc" }],
  });
}

async function resolverFamilia(tx: Tx, tenantId: string, area: AreaAlmacen, d: DatosProducto): Promise<string | null> {
  const nueva = d.nuevaFamilia?.trim();
  if (nueva) {
    const existente = await tx.familiaProducto.findFirst({ where: { tenantId, area, nombre: { equals: nueva, mode: "insensitive" } } });
    if (existente) return existente.id;
    const max = await tx.familiaProducto.aggregate({ where: { tenantId, area }, _max: { orden: true } });
    const f = await tx.familiaProducto.create({ data: { tenantId, area, nombre: nueva, orden: (max._max.orden ?? 0) + 1 } });
    return f.id;
  }
  if (!d.familiaId) return null;
  const f = await tx.familiaProducto.findFirst({ where: { id: d.familiaId, tenantId, area } });
  if (!f) throw new ErrorNegocio("La familia elegida no es de esta área.");
  return f.id;
}

async function comprobarProveedor(tx: Tx, tenantId: string, proveedorId: string | null) {
  if (!proveedorId) return null;
  const p = await tx.proveedor.findFirst({ where: { id: proveedorId, tenantId } });
  if (!p) throw new ErrorNegocio("El proveedor elegido no existe.");
  return p.id;
}

function comprobarCoste(d: DatosProducto) {
  if (d.costeUnitario < 0) throw new ErrorNegocio("El coste no puede ser negativo.");
  if (d.costeUnitario === 0 && !d.sinCoste) throw new ErrorNegocio("El coste es obligatorio. Si de verdad no tiene coste, marca «Sin coste» y escribe el motivo.");
  if (d.sinCoste && !d.motivoSinCoste?.trim()) throw new ErrorNegocio("Escribe el motivo por el que el producto no tiene coste.");
}

export async function crearProducto(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, d: DatosProducto) {
  comprobarCoste(d);
  const repetida = await tx.producto.findFirst({ where: { tenantId, referencia: d.referencia } });
  if (repetida) throw new ErrorNegocio(`Ya existe un producto con la referencia ${d.referencia} (${repetida.nombre}).`);
  const familiaId = await resolverFamilia(tx, tenantId, area, d);
  const proveedorId = await comprobarProveedor(tx, tenantId, d.proveedorId);
  const p = await tx.producto.create({
    data: {
      tenantId,
      area,
      referencia: d.referencia,
      nombre: d.nombre,
      familiaId,
      proveedorId,
      unidad: d.unidad,
      unidadesCompra: new Prisma.Decimal(d.unidadesCompra),
      costeUnitario: new Prisma.Decimal(r4(d.costeUnitario)),
      sinCoste: d.sinCoste,
      motivoSinCoste: d.sinCoste ? d.motivoSinCoste?.trim() || null : null,
      iva: new Prisma.Decimal(d.iva),
      stockMinimo: new Prisma.Decimal(d.stockMinimo),
      codigoBarras: d.codigoBarras,
    },
  });
  await auditar(tx, { tenantId, usuarioId, entidad: "Producto", entidadId: p.id, accion: "crear", despues: { ...d } });
  await emitir(tx, tenantId, "almacen.producto.creado", { productoId: p.id, area });
  return p;
}

export async function editarProducto(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, d: DatosProducto) {
  comprobarCoste(d);
  const antes = await tx.producto.findFirst({ where: { id, tenantId, area } });
  if (!antes) throw new ErrorNegocio("El producto no existe en esta área.");
  if (d.referencia !== antes.referencia) {
    const repetida = await tx.producto.findFirst({ where: { tenantId, referencia: d.referencia, id: { not: id } } });
    if (repetida) throw new ErrorNegocio(`Ya existe un producto con la referencia ${d.referencia} (${repetida.nombre}).`);
  }
  const familiaId = await resolverFamilia(tx, tenantId, area, d);
  const proveedorId = await comprobarProveedor(tx, tenantId, d.proveedorId);
  const p = await tx.producto.update({
    where: { id },
    data: {
      referencia: d.referencia,
      nombre: d.nombre,
      familiaId,
      proveedorId,
      unidad: d.unidad,
      unidadesCompra: new Prisma.Decimal(d.unidadesCompra),
      costeUnitario: new Prisma.Decimal(r4(d.costeUnitario)),
      sinCoste: d.sinCoste,
      motivoSinCoste: d.sinCoste ? d.motivoSinCoste?.trim() || null : null,
      iva: new Prisma.Decimal(d.iva),
      stockMinimo: new Prisma.Decimal(d.stockMinimo),
      codigoBarras: d.codigoBarras,
    },
  });
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "Producto",
    entidadId: id,
    accion: num(antes.costeUnitario) !== r4(d.costeUnitario) ? "editar-con-cambio-de-coste" : "editar",
    antes: { referencia: antes.referencia, nombre: antes.nombre, coste: num(antes.costeUnitario), sinCoste: antes.sinCoste, motivoSinCoste: antes.motivoSinCoste, stockMinimo: num(antes.stockMinimo) },
    despues: { ...d },
  });
  return p;
}

/** Activar o desactivar. Nunca se borra (regla 7 de CONVENCIONES). */
export async function cambiarActivoProducto(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, activo: boolean) {
  const p = await tx.producto.findFirst({ where: { id, tenantId, area } });
  if (!p) throw new ErrorNegocio("El producto no existe en esta área.");
  await tx.producto.update({ where: { id }, data: { activo } });
  await auditar(tx, { tenantId, usuarioId, entidad: "Producto", entidadId: id, accion: activo ? "activar" : "desactivar", antes: { activo: p.activo }, despues: { activo } });
}

/** Ajustes del producto en un centro: si se puede pedir, mínimo, máximo, tarifa del obrador para ese centro y almacén por defecto. */
export async function ajustarProductoCentro(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  d: { productoId: string; centroId: string; activo: boolean; minimo: number | null; maximo: number | null; precioVenta: number | null; almacenId?: string | null },
) {
  const p = await tx.producto.findFirst({ where: { id: d.productoId, tenantId, area } });
  if (!p) throw new ErrorNegocio("El producto no existe en esta área.");
  const c = await tx.centro.findFirst({ where: { id: d.centroId, tenantId } });
  if (!c) throw new ErrorNegocio("El centro no existe.");
  if (d.minimo !== null && d.maximo !== null && d.maximo < d.minimo) throw new ErrorNegocio("El máximo no puede ser menor que el mínimo.");
  if (d.almacenId && !(await tx.almacen.findFirst({ where: { id: d.almacenId, centroId: d.centroId } }))) throw new ErrorNegocio("El almacén elegido no es de ese centro.");
  // undefined = no se toca; null = vuelve a la regla por familia
  const almacen = d.almacenId === undefined ? {} : { almacenId: d.almacenId };
  const dec = (v: number | null) => (v === null ? null : new Prisma.Decimal(v));
  const antes = await tx.productoCentro.findUnique({ where: { productoId_centroId: { productoId: d.productoId, centroId: d.centroId } } });
  await tx.productoCentro.upsert({
    where: { productoId_centroId: { productoId: d.productoId, centroId: d.centroId } },
    create: { productoId: d.productoId, centroId: d.centroId, activo: d.activo, minimo: dec(d.minimo), maximo: dec(d.maximo), precioVenta: dec(d.precioVenta), ...almacen },
    update: { activo: d.activo, minimo: dec(d.minimo), maximo: dec(d.maximo), precioVenta: dec(d.precioVenta), ...almacen },
  });
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "ProductoCentro",
    entidadId: `${d.productoId}|${d.centroId}`,
    accion: "ajustar",
    antes: antes ? { activo: antes.activo, minimo: num(antes.minimo), maximo: num(antes.maximo), precioVenta: antes.precioVenta ? num(antes.precioVenta) : null, almacenId: antes.almacenId } : null,
    despues: d,
  });
}
