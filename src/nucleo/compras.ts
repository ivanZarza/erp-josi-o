import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { numero as fmtNumero } from "@/kernel/formato";
import { registrarMovimientos } from "./movimientos";
import { stockEnCentro } from "./stock";
import { ErrorNegocio, num, r2, r3, r4, type AreaAlmacen, type Tx } from "./comun-almacen";
import { costeMedioTrasEntrada } from "./coste-medio";
import { recalcularTarifasProducto } from "@/modulos/obrador/tarifas";

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
  if (c.estado === "RECIBIDO_PARCIAL") throw new ErrorNegocio("Ya se ha recibido una parte: no se cancela, se cierra sin lo que falta («Cerrar la compra»).");
  if (c.estado !== "BORRADOR" && c.estado !== "ENVIADO") throw new ErrorNegocio("Solo se cancela una compra sin recibir.");
  await tx.pedidoCompra.update({ where: { id }, data: { estado: "CANCELADO" } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: id, accion: "cancelar" });
}

/**
 * Recepción: se apunta lo que llega de verdad. Suma stock (ENTRADA_COMPRA) al precio real y
 * recalcula el coste medio ponderado del producto con el stock de toda la cadena (costeMedioTrasEntrada,
 * src/nucleo/coste-medio.ts). Si el coste cambia, se recalculan las tarifas del obrador «A coste» y
 * «Coste + %» de ese producto (recalcularTarifasProducto del módulo Obrador).
 * Solo cambia el precio de las líneas que reciben algo: el «€/ud» de la línea pasa a ser el precio medio
 * de todo lo recibido de esa línea (así recibido × €/ud = lo que se ha pagado de verdad).
 * Cada recepción tiene su albarán de entrada ALB-E. Si falta algo y no se cierra, queda RECIBIDO_PARCIAL.
 * Una compra RECIBIDO_PARCIAL se puede cerrar sin recibir nada más (cerrarCompra): lo que falta ya no llegará.
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
  // qué llega de cada línea (antes de numerar nada)
  const llegadas = c.lineas.map((l) => {
    const pedida = num(l.cantidad);
    const yaRecibida = num(l.recibida);
    const pendiente = Math.max(0, r3(pedida - yaRecibida));
    const dato = d.lineas.get(l.id);
    const recibida = r3(Math.max(0, dato?.recibida ?? pendiente));
    const precio = r4(dato?.precio ?? num(l.precio));
    return { l, pedida, yaRecibida, recibida, precio };
  });
  if (llegadas.some((x) => x.precio < 0)) throw new ErrorNegocio("Un precio no puede ser negativo.");
  if (!llegadas.some((x) => x.recibida > 0)) {
    // «Cerrar aunque falte algo» sin que llegue nada en esta entrega: se cierra lo que ya se recibió
    if (d.cerrar && c.estado === "RECIBIDO_PARCIAL") {
      await cerrarCompra(tx, tenantId, usuarioId, area, id);
      return { albaran: null, estado: "RECIBIDO" as const };
    }
    throw new ErrorNegocio("No se ha recibido nada. Escribe las cantidades que han llegado.");
  }
  const albaran = await siguienteNumero(tx, tenantId, "ALB-E");
  let falta = false;
  let importe = 0;
  for (const { l, pedida, yaRecibida, recibida, precio } of llegadas) {
    const total = r3(yaRecibida + recibida);
    if (total < pedida) falta = true;
    if (recibida <= 0) continue;
    // €/ud de la línea = precio medio de todo lo recibido de ella
    const precioLinea = yaRecibida > 0 ? r4((yaRecibida * num(l.precio) + recibida * precio) / total) : precio;
    await tx.pedidoCompraLinea.update({ where: { id: l.id }, data: { recibida: new Prisma.Decimal(total), precio: new Prisma.Decimal(precioLinea) } });
    importe += recibida * precio;
    // coste medio ponderado con el stock de toda la cadena (antes de esta entrada)
    const { stockAntes, costeAntes, costeNuevo } = await costeMedioTrasEntrada(tx, tenantId, l.productoId, recibida, precio);
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
      await tx.producto.update({ where: { id: l.productoId }, data: { costeUnitario: new Prisma.Decimal(costeNuevo), ...(costeNuevo > 0 ? { sinCoste: false, motivoSinCoste: null } : {}) } });
      await auditar(tx, {
        tenantId,
        usuarioId,
        entidad: "Producto",
        entidadId: l.productoId,
        accion: "coste-medio",
        antes: { coste: costeAntes, stock: stockAntes },
        despues: { coste: costeNuevo, recibida, precio, documento: albaran },
      });
      // tarifas del obrador a los locales que dependen del coste («A coste» y «Coste + %»)
      await recalcularTarifasProducto(tx, tenantId, l.productoId, usuarioId);
    }
  }
  const estado = falta && !d.cerrar ? "RECIBIDO_PARCIAL" : "RECIBIDO";
  const albaranes = c.albaran ? `${c.albaran}, ${albaran}` : albaran;
  const notas = d.albaranProveedor ? [c.notas, `Albarán del proveedor: ${d.albaranProveedor}`].filter(Boolean).join("\n") : c.notas;
  await tx.pedidoCompra.update({ where: { id }, data: { estado, recibidoEn: new Date(), albaran: albaranes, notas } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: id, accion: "recibir", despues: { albaran, estado, importe: r2(importe) } });
  await emitir(tx, tenantId, "almacen.compra.recibida", { compraId: id, numero: c.numero, albaran, area, proveedorId: c.proveedorId, centroId: c.centroId, importe: r2(importe), estado });
  return { albaran, estado };
}

/**
 * Cerrar una compra recibida en parte sin esperar lo que falta (el proveedor no lo va a traer).
 * No mueve stock: lo recibido ya entró; lo pendiente se queda apuntado como no recibido.
 */
export async function cerrarCompra(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, motivo?: string | null) {
  const c = await tx.pedidoCompra.findFirst({ where: { id, tenantId, area }, include: { lineas: true } });
  if (!c) throw new ErrorNegocio("La compra no existe.");
  if (c.estado !== "RECIBIDO_PARCIAL") throw new ErrorNegocio("Solo se cierra así una compra recibida en parte.");
  const pendiente = c.lineas
    .map((l) => ({ productoId: l.productoId, falta: r3(num(l.cantidad) - num(l.recibida)) }))
    .filter((x) => x.falta > 0);
  const nota = `Cerrada sin lo que faltaba${motivo?.trim() ? `: ${motivo.trim()}` : ""}`;
  await tx.pedidoCompra.update({ where: { id }, data: { estado: "RECIBIDO", notas: [c.notas, nota].filter(Boolean).join("\n") } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoCompra", entidadId: id, accion: "cerrar-sin-lo-pendiente", despues: { pendiente, motivo: motivo ?? null } });
  await emitir(tx, tenantId, "almacen.compra.cerrada", { compraId: id, numero: c.numero, area, proveedorId: c.proveedorId, centroId: c.centroId, lineasPendientes: pendiente.length });
}

const UNIDAD_TEXTO: Record<string, string> = { UD: "ud", BOTELLA: "bot.", KG: "kg", L: "l", CAJA: "cajas", LATA: "latas", BARRIL: "barriles", PAQUETE: "paquetes", BANDEJA: "bandejas", RACION: "raciones" };

/**
 * Lo pedido en formatos de compra del proveedor: 14 botellas con 6 por caja → « (2 × 6 + 2)».
 * Vacío si el producto se compra por unidades sueltas (unidades por formato = 1).
 */
export function enFormatos(cantidad: number, unidadesCompra: number | null | undefined): string {
  const u = unidadesCompra ?? 1;
  if (!(u > 1) || !(cantidad > 0)) return "";
  const enteros = Math.floor(r3(cantidad / u) + 1e-9);
  const sueltas = r3(cantidad - enteros * u);
  if (enteros === 0) return "";
  return ` (${fmtNumero(enteros, 0)} × ${fmtNumero(u, 3)}${sueltas > 0 ? ` + ${fmtNumero(sueltas, 3)}` : ""})`;
}

/** Texto del pedido para WhatsApp (como hace hoy BODEGA 360), con formato español. */
export function textoWhatsApp(c: {
  numero: string;
  cadena: string;
  centro: string;
  contacto?: string | null;
  notas?: string | null;
  lineas: { nombre: string; referencia: string; unidad: string; cantidad: number; unidadesCompra?: number }[];
}): string {
  const saludo = c.contacto ? `Hola ${c.contacto}, ` : "Hola, ";
  const lineas = c.lineas.map(
    (l) => `- ${fmtNumero(l.cantidad, 3)} ${UNIDAD_TEXTO[l.unidad] ?? l.unidad.toLowerCase()}${enFormatos(l.cantidad, l.unidadesCompra)} · ${l.nombre} (${l.referencia})`,
  );
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
 * Propuesta de compra para un centro: lo que está bajo mínimo, hasta el máximo (o el mínimo si no hay máximo),
 * redondeado hacia arriba a formatos de compra completos (Producto.unidadesCompra: 6 botellas por caja → 6, 12, 18…).
 * Devuelve productoId → cantidad sugerida (en unidades de stock).
 */
export async function propuestaCompra(tx: Tx, tenantId: string, area: AreaAlmacen, centroId: string, proveedorId?: string) {
  const centro = await tx.centro.findFirst({ where: { id: centroId, tenantId } });
  if (!centro) return new Map<string, number>();
  const [productos, ajustes, stock] = await Promise.all([
    tx.producto.findMany({ where: { tenantId, area, activo: true, ...(proveedorId ? { proveedorId } : {}) }, select: { id: true, stockMinimo: true, unidadesCompra: true } }),
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
      // se redondea hacia arriba a formatos completos del proveedor (cajas de 6, sacos de 25…)
      const formato = num(p.unidadesCompra) > 0 ? num(p.unidadesCompra) : 1;
      const cantidad = r3(Math.ceil(r3(Math.max(0, objetivo - s) / formato)) * formato);
      if (cantidad > 0) res.set(p.id, cantidad);
    }
  }
  return res;
}

/** Compras del área en unos centros. Filtro de estado: uno de EstadoCompra o «POR_RECIBIR» (enviadas + recibidas en parte). */
export async function listarCompras(tx: Tx, tenantId: string, area: AreaAlmacen, centroIds: string[], filtros: { estado?: string; limite?: number } = {}) {
  return tx.pedidoCompra.findMany({
    where: {
      tenantId,
      area,
      centroId: { in: centroIds },
      // POR_RECIBIR = enviadas y recibidas en parte (lo que aún puede llegar)
      ...(filtros.estado === "POR_RECIBIR" ? { estado: { in: ["ENVIADO", "RECIBIDO_PARCIAL"] as never } } : filtros.estado ? { estado: filtros.estado as never } : {}),
    },
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

/**
 * Importe de una compra. Sin recibir (borrador, enviada, cancelada): lo pedido × €/ud.
 * Recibida (en parte o del todo): lo RECIBIDO × €/ud (el €/ud de la línea es el precio medio de lo recibido).
 */
export function importeCompra(c: { estado: string; lineas: { cantidad: unknown; recibida: unknown; precio: unknown }[] }): number {
  const recibida = c.estado === "RECIBIDO" || c.estado === "RECIBIDO_PARCIAL";
  return r2(c.lineas.reduce((a, l) => a + num((recibida ? l.recibida : l.cantidad) as never) * num(l.precio as never), 0));
}

/** Importe de lo pedido (× €/ud), aunque se haya recibido en parte. */
export function importePedidoCompra(c: { lineas: { cantidad: unknown; precio: unknown }[] }): number {
  return r2(c.lineas.reduce((a, l) => a + num(l.cantidad as never) * num(l.precio as never), 0));
}

