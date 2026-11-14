import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { numero as fmtNumero } from "@/kernel/formato";
import { registrarMovimientos } from "./movimientos";
import { stockEnCentro } from "./stock";
import { ErrorNegocio, num, r2, r3, r4, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Compras a proveedor (motor común de Bebidas y Comidas).
 * BORRADOR → ENVIADO (por WhatsApp con el texto escrito, correo o teléfono) → RECIBIDO_PARCIAL / RECIBIDO.
 * Solo la recepción suma stock (ENTRADA_COMPRA) y actualiza el coste medio ponderado del producto.
 */

export interface LineaCompra {
  productoId: string;
  cantidad: number;
  precio: number; // € por unidad de stock
}

function juntar(lineas: LineaCompra[]): LineaCompra[] {
  const m = new Map<string, LineaCompra>();
  for (const l of lineas) {
    if (l.cantidad <= 0) continue;
    const a = m.get(l.productoId);
    if (a) a.cantidad = r3(a.cantidad + l.cantidad);
    else m.set(l.productoId, { ...l });
  }
  return Array.from(m.values());
}

async function comprobar(tx: Tx, tenantId: string, area: AreaAlmacen, d: { proveedorId: string; centroId: string; lineas: LineaCompra[] }) {
  const [prov, centro] = await Promise.all([
    tx.proveedor.findFirst({ where: { id: d.proveedorId, tenantId } }),
    tx.centro.findFirst({ where: { id: d.centroId, tenantId } }),
  ]);
  if (!prov) throw new ErrorNegocio("El proveedor no existe.");
  if (!prov.activo) throw new ErrorNegocio("El proveedor está desactivado.");
  if (!centro) throw new ErrorNegocio("El centro que recibe no existe.");
  if (d.lineas.length === 0) throw new ErrorNegocio("La compra no tiene ninguna línea con cantidad.");
  const ids = d.lineas.map((l) => l.productoId);
  const validos = await tx.producto.count({ where: { id: { in: ids }, tenantId, area } });
  if (validos !== ids.length) throw new ErrorNegocio("Hay productos que no son de esta área.");
  if (d.lineas.some((l) => l.precio < 0)) throw new ErrorNegocio("Un precio no puede ser negativo.");
}

export async function crearCompra(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  d: { proveedorId: string; centroId: string; notas?: string | null; lineas: LineaCompra[] },
) {
  const lineas = juntar(d.lineas);
  await comprobar(tx, tenantId, area, { ...d, lineas });
  const numero = await siguienteNumero(tx, tenantId, "PC");
  const c = await tx.pedidoCompra.create({
    data: {
      tenantId,
      numero,
      area,
      proveedorId: d.proveedorId,
      centroId: d.centroId,
      estado: "BORRADOR",
      notas: d.notas || null,
      lineas: { create: lineas.map((l) => ({ productoId: l.productoId, cantidad: new Prisma.Decimal(l.cantidad), precio: new Prisma.Decimal(r4(l.precio)) })) },
    },
  });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: c.id, accion: "crear", despues: { numero, lineas } });
  return c;
}

export async function editarCompra(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, d: { notas?: string | null; lineas: LineaCompra[] }) {
  const c = await tx.pedidoCompra.findFirst({ where: { id, tenantId, area }, include: { lineas: true } });
  if (!c) throw new ErrorNegocio("La compra no existe.");
  if (c.estado !== "BORRADOR" && c.estado !== "ENVIADO") throw new ErrorNegocio("Una compra ya recibida no se puede cambiar.");
  const lineas = juntar(d.lineas);
  await comprobar(tx, tenantId, area, { proveedorId: c.proveedorId, centroId: c.centroId, lineas });
  await tx.pedidoCompraLinea.deleteMany({ where: { pedidoId: id } });
  await tx.pedidoCompraLinea.createMany({
    data: lineas.map((l) => ({ pedidoId: id, productoId: l.productoId, cantidad: new Prisma.Decimal(l.cantidad), precio: new Prisma.Decimal(r4(l.precio)) })),
  });
  await tx.pedidoCompra.update({ where: { id }, data: { notas: d.notas ?? c.notas } });
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "PedidoCompra",
    entidadId: id,
    accion: "editar",
    antes: c.lineas.map((l) => ({ productoId: l.productoId, cantidad: num(l.cantidad), precio: num(l.precio) })),
    despues: lineas,
  });
}

export async function marcarCompraEnviada(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, via: "whatsapp" | "email" | "telefono") {
  const c = await tx.pedidoCompra.findFirst({ where: { id, tenantId, area } });
  if (!c) throw new ErrorNegocio("La compra no existe.");
  if (c.estado !== "BORRADOR" && c.estado !== "ENVIADO") throw new ErrorNegocio("Esta compra ya está recibida o cancelada.");
  await tx.pedidoCompra.update({ where: { id }, data: { estado: "ENVIADO", enviadoPor: via, enviadoEn: new Date() } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: id, accion: "enviar", despues: { via } });
  await emitir(tx, tenantId, "almacen.compra.enviada", { compraId: id, numero: c.numero, area, via });
}

export async function cancelarCompra(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string) {
  const c = await tx.pedidoCompra.findFirst({ where: { id, tenantId, area } });
  if (!c) throw new ErrorNegocio("La compra no existe.");
  if (c.estado !== "BORRADOR" && c.estado !== "ENVIADO") throw new ErrorNegocio("Solo se cancela una compra sin recibir.");
  await tx.pedidoCompra.update({ where: { id }, data: { estado: "CANCELADO" } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: id, accion: "cancelar" });
}

/**
 * Recepción: se apunta lo que llega de verdad. Suma stock (ENTRADA_COMPRA) al precio real y
 * recalcula el coste medio ponderado del producto con el stock de toda la cadena:
 *   coste nuevo = (stock × coste actual + recibido × precio) / (stock + recibido)
 * (si el stock era 0 o negativo, el coste nuevo es el precio de esta compra).
 * Cada recepción tiene su albarán de entrada ALB-E. Si falta algo y no se cierra, queda RECIBIDO_PARCIAL.
 * Almacén: el elegido al recibir (todo entra ahí) o, si no se elige, el de por defecto de cada producto.
 */
export async function recibirCompra(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  id: string,
  d: { lineas: Map<string, { recibida: number | null; precio: number | null }>; albaranProveedor?: string | null; cerrar: boolean; almacenId?: string | null },
) {
  const c = await tx.pedidoCompra.findFirst({ where: { id, tenantId, area }, include: { lineas: true } });
  if (!c) throw new ErrorNegocio("La compra no existe.");
  if (c.estado === "RECIBIDO" || c.estado === "CANCELADO") throw new ErrorNegocio("Esta compra ya está cerrada.");
  const albaran = await siguienteNumero(tx, tenantId, "ALB-E");
  let algo = false;
  let falta = false;
  let importe = 0;
  for (const l of c.lineas) {
    const pedida = num(l.cantidad);
    const yaRecibida = num(l.recibida);
    const pendiente = Math.max(0, r3(pedida - yaRecibida));
    const dato = d.lineas.get(l.id);
    const recibida = r3(Math.max(0, dato?.recibida ?? pendiente));
    const precio = r4(dato?.precio ?? num(l.precio));
    if (precio < 0) throw new ErrorNegocio("Un precio no puede ser negativo.");
    const total = r3(yaRecibida + recibida);
    if (total < pedida) falta = true;
    await tx.pedidoCompraLinea.update({ where: { id: l.id }, data: { recibida: new Prisma.Decimal(total), precio: new Prisma.Decimal(precio) } });
    if (recibida <= 0) continue;
    algo = true;
    importe += recibida * precio;
    // coste medio ponderado con el stock de toda la cadena (antes de esta entrada)
    const prod = await tx.producto.findUniqueOrThrow({ where: { id: l.productoId } });
    const ag = await tx.movimientoStock.aggregate({ where: { tenantId, productoId: l.productoId }, _sum: { cantidad: true } });
    const stockAntes = num(ag._sum.cantidad);
    const costeAntes = num(prod.costeUnitario);
    const costeNuevo = stockAntes <= 0 ? precio : r4((stockAntes * costeAntes + recibida * precio) / (stockAntes + recibida));
    await registrarMovimientos(tx, [
      {
        tenantId,
        centroId: c.centroId,
        // almacén elegido al recibir; si no, el de por defecto de cada producto
        ...(d.almacenId ? { almacenId: d.almacenId } : {}),
        productoId: l.productoId,
        tipo: "ENTRADA_COMPRA",
        cantidad: recibida,
        costeUnitario: precio,
        documento: albaran,
        documentoId: c.id,
        motivo: `Compra ${c.numero}${d.albaranProveedor ? ` · albarán del proveedor ${d.albaranProveedor}` : ""}`,
        usuarioId,
      },
    ]);
    if (costeNuevo !== costeAntes) {
      await tx.producto.update({ where: { id: l.productoId }, data: { costeUnitario: new Prisma.Decimal(costeNuevo), ...(costeNuevo > 0 ? { sinCoste: false } : {}) } });
      await auditar(tx, {
        tenantId,
        usuarioId,
        entidad: "Producto",
        entidadId: l.productoId,
        accion: "coste-medio",
        antes: { coste: costeAntes, stock: stockAntes },
        despues: { coste: costeNuevo, recibida, precio, documento: albaran },
      });
    }
  }
  if (!algo) throw new ErrorNegocio("No se ha recibido nada. Escribe las cantidades que han llegado.");
  const estado = falta && !d.cerrar ? "RECIBIDO_PARCIAL" : "RECIBIDO";
  const albaranes = c.albaran ? `${c.albaran}, ${albaran}` : albaran;
  const notas = d.albaranProveedor ? [c.notas, `Albarán del proveedor: ${d.albaranProveedor}`].filter(Boolean).join("\n") : c.notas;
  await tx.pedidoCompra.update({ where: { id }, data: { estado, recibidoEn: new Date(), albaran: albaranes, notas } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: id, accion: "recibir", despues: { albaran, estado, importe: r2(importe) } });
  await emitir(tx, tenantId, "almacen.compra.recibida", { compraId: id, numero: c.numero, albaran, area, proveedorId: c.proveedorId, centroId: c.centroId, importe: r2(importe), estado });
  return { albaran, estado };
}

const UNIDAD_TEXTO: Record<string, string> = { UD: "ud", BOTELLA: "bot.", KG: "kg", L: "l", CAJA: "cajas", LATA: "latas", BARRIL: "barriles", PAQUETE: "paquetes", BANDEJA: "bandejas" };

/** Texto del pedido para WhatsApp (como hace hoy BODEGA 360), con formato español. */
export function textoWhatsApp(c: {
  numero: string;
  cadena: string;
  centro: string;
  contacto?: string | null;
  notas?: string | null;
  lineas: { nombre: string; referencia: string; unidad: string; cantidad: number }[];
}): string {
  const saludo = c.contacto ? `Hola ${c.contacto}, ` : "Hola, ";
  const lineas = c.lineas.map((l) => `- ${fmtNumero(l.cantidad, 3)} ${UNIDAD_TEXTO[l.unidad] ?? l.unidad.toLowerCase()} · ${l.nombre} (${l.referencia})`);
  return [
    `${saludo}os paso el pedido ${c.numero} de ${c.cadena} para ${c.centro}:`,
    "",
    ...lineas,
    ...(c.notas ? ["", `Notas: ${c.notas}`] : []),
    "",
    "Gracias.",
  ].join("\n");
}

/** Enlace de WhatsApp: https://wa.me/<teléfono sin +>?text=… (null si el proveedor no tiene teléfono válido). */
export function enlaceWhatsApp(telefono: string | null | undefined, texto: string): string | null {
  if (!telefono || !/^\+[1-9]\d{7,14}$/.test(telefono)) return null;
  return `https://wa.me/${telefono.slice(1)}?text=${encodeURIComponent(texto)}`;
}

/**
 * Propuesta de compra para un centro: lo que está bajo mínimo, hasta el máximo (o el mínimo si no hay máximo).
 * Devuelve productoId → cantidad sugerida.
 */
export async function propuestaCompra(tx: Tx, tenantId: string, area: AreaAlmacen, centroId: string, proveedorId?: string) {
  const centro = await tx.centro.findFirst({ where: { id: centroId, tenantId } });
  if (!centro) return new Map<string, number>();
  const [productos, ajustes, stock] = await Promise.all([
    tx.producto.findMany({ where: { tenantId, area, activo: true, ...(proveedorId ? { proveedorId } : {}) }, select: { id: true, stockMinimo: true } }),
    tx.productoCentro.findMany({ where: { centroId } }),
    stockEnCentro(tx, tenantId, area, centroId),
  ]);
  const aj = new Map(ajustes.map((a) => [a.productoId, a]));
  const res = new Map<string, number>();
  for (const p of productos) {
    const a = aj.get(p.id);
    const minimo = a?.minimo != null ? num(a.minimo) : centro.tipo !== "LOCAL" ? num(p.stockMinimo) : 0;
    const s = stock.get(p.id) ?? 0;
    if (minimo > 0 && s < minimo) {
      const objetivo = a?.maximo != null ? num(a.maximo) : minimo;
      const cantidad = Math.ceil(Math.max(0, objetivo - s));
      if (cantidad > 0) res.set(p.id, cantidad);
    }
  }
  return res;
}

export async function listarCompras(tx: Tx, tenantId: string, area: AreaAlmacen, centroIds: string[], filtros: { estado?: string; limite?: number } = {}) {
  return tx.pedidoCompra.findMany({
    where: { tenantId, area, centroId: { in: centroIds }, ...(filtros.estado ? { estado: filtros.estado as never } : {}) },
    include: {
      proveedor: { select: { id: true, nombre: true, telefono: true, contacto: true } },
      centro: { select: { id: true, nombre: true, codigo: true } },
      lineas: { include: { producto: { select: { nombre: true, referencia: true, unidad: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: filtros.limite ?? 200,
  });
}

export async function leerCompra(tx: Tx, tenantId: string, area: AreaAlmacen, id: string) {
  return tx.pedidoCompra.findFirst({
    where: { id, tenantId, area },
    include: {
      proveedor: true,
      centro: { select: { id: true, nombre: true, codigo: true } },
      lineas: { include: { producto: { include: { familia: true } } }, orderBy: { producto: { nombre: "asc" } } },
    },
  });
}

export function importeCompra(c: { lineas: { cantidad: unknown; precio: unknown }[] }): number {
  return r2(c.lineas.reduce((a, l) => a + num(l.cantidad as never) * num(l.precio as never), 0));
}

