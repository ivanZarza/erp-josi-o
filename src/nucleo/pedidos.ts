import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { auditar, emitir } from "@/kernel/eventos";
import { siguienteNumero } from "@/kernel/numeracion";
import { registrarMovimientos, type NuevoMovimiento } from "./movimientos";
import { stockEnCentro } from "./stock";
import { ErrorNegocio, num, r2, r3, r4, type AreaAlmacen, type Tx } from "./comun-almacen";

/**
 * Pedidos internos: un local pide al obrador (o almacén central). Motor común de Bebidas y Comidas.
 * Flujo: PENDIENTE (el local puede cambiarlo) → SERVIDO (el obrador ajusta al stock, albarán ALB-S,
 * movimientos SALIDA_PEDIDO en origen y ENTRADA_PEDIDO en destino) → RECIBIDO (el local confirma y
 * puede marcar diferencias). También RECHAZADO (el obrador) y CANCELADO (el local).
 * Precio de cada línea = tarifa del obrador para ese local (ProductoCentro.precioVenta) o, si no hay, el coste.
 */

export interface LineaPedida {
  productoId: string;
  cantidad: number;
}

/** Junta líneas repetidas del mismo producto y quita las de cantidad 0. */
function juntarLineas(lineas: LineaPedida[]): LineaPedida[] {
  const m = new Map<string, number>();
  for (const l of lineas) if (l.cantidad > 0) m.set(l.productoId, r3((m.get(l.productoId) ?? 0) + l.cantidad));
  return Array.from(m, ([productoId, cantidad]) => ({ productoId, cantidad }));
}

/** Tarifas aplicables: precio de venta del obrador al centro destino; si no hay, coste del producto. */
async function preciosPara(tx: Tx, productoIds: string[], destinoId: string) {
  const [productos, tarifas] = await Promise.all([
    tx.producto.findMany({ where: { id: { in: productoIds } }, select: { id: true, costeUnitario: true } }),
    tx.productoCentro.findMany({ where: { productoId: { in: productoIds }, centroId: destinoId } }),
  ]);
  const tarifa = new Map(tarifas.filter((t) => t.precioVenta !== null).map((t) => [t.productoId, num(t.precioVenta)]));
  const coste = new Map(productos.map((p) => [p.id, num(p.costeUnitario)]));
  return { precio: (id: string) => tarifa.get(id) ?? coste.get(id) ?? 0, coste: (id: string) => coste.get(id) ?? 0 };
}

/** Catálogo que ve un local para pedir: productos activos del área (y activos para ese local) con lo disponible en origen. */
export async function catalogoParaPedir(tx: Tx, tenantId: string, area: AreaAlmacen, origenId: string, destinoId: string) {
  const [productos, desactivados, disponible, tarifas] = await Promise.all([
    tx.producto.findMany({
      where: { tenantId, area, activo: true },
      include: { familia: true },
      orderBy: [{ familia: { orden: "asc" } }, { nombre: "asc" }],
    }),
    tx.productoCentro.findMany({ where: { centroId: destinoId, activo: false }, select: { productoId: true } }),
    stockEnCentro(tx, tenantId, area, origenId),
    tx.productoCentro.findMany({ where: { centroId: destinoId, precioVenta: { not: null } } }),
  ]);
  const fuera = new Set(desactivados.map((d) => d.productoId));
  const tarifa = new Map(tarifas.map((t) => [t.productoId, num(t.precioVenta)]));
  return productos
    .filter((p) => !fuera.has(p.id))
    .map((p) => ({
      id: p.id,
      referencia: p.referencia,
      nombre: p.nombre,
      unidad: p.unidad,
      familia: p.familia?.nombre ?? "Sin familia",
      disponible: disponible.get(p.id) ?? 0,
      precio: tarifa.get(p.id) ?? num(p.costeUnitario),
    }));
}

async function comprobarLineas(tx: Tx, tenantId: string, area: AreaAlmacen, destinoId: string, lineas: LineaPedida[]) {
  if (lineas.length === 0) throw new ErrorNegocio("El pedido no tiene ninguna línea con cantidad.");
  const ids = lineas.map((l) => l.productoId);
  const [validos, desactivados] = await Promise.all([
    tx.producto.findMany({ where: { id: { in: ids }, tenantId, area, activo: true }, select: { id: true } }),
    tx.productoCentro.findMany({ where: { productoId: { in: ids }, centroId: destinoId, activo: false }, select: { productoId: true } }),
  ]);
  if (validos.length !== ids.length) throw new ErrorNegocio("Hay productos que no existen, no son de esta área o están desactivados.");
  if (desactivados.length > 0) throw new ErrorNegocio("Hay productos que no están activos para este local.");
}

export async function crearPedidoInterno(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  d: { origenId: string; destinoId: string; notas?: string | null; lineas: LineaPedida[] },
) {
  if (d.origenId === d.destinoId) throw new ErrorNegocio("Un centro no puede pedirse a sí mismo.");
  const [origen, destino] = await Promise.all([
    tx.centro.findFirst({ where: { id: d.origenId, tenantId, tipo: { in: ["OBRADOR", "ALMACEN"] } } }),
    tx.centro.findFirst({ where: { id: d.destinoId, tenantId } }),
  ]);
  if (!origen) throw new ErrorNegocio("El centro que sirve tiene que ser un obrador o un almacén central.");
  if (!destino) throw new ErrorNegocio("El centro que pide no existe.");
  const lineas = juntarLineas(d.lineas);
  await comprobarLineas(tx, tenantId, area, d.destinoId, lineas);
  const precios = await preciosPara(tx, lineas.map((l) => l.productoId), d.destinoId);
  const numero = await siguienteNumero(tx, tenantId, "PL");
  const pedido = await tx.pedidoInterno.create({
    data: {
      tenantId,
      numero,
      area,
      origenId: d.origenId,
      destinoId: d.destinoId,
      estado: "PENDIENTE",
      notas: d.notas || null,
      creadoPor: usuarioId,
      lineas: { create: lineas.map((l) => ({ productoId: l.productoId, pedida: new Prisma.Decimal(l.cantidad), precio: new Prisma.Decimal(r4(precios.precio(l.productoId))) })) },
    },
  });
  await emitir(tx, tenantId, "almacen.pedido.creado", { pedidoId: pedido.id, numero, area, origenId: d.origenId, destinoId: d.destinoId });
  return pedido;
}

async function pedidoDe(tx: Tx, tenantId: string, area: AreaAlmacen, id: string) {
  const p = await tx.pedidoInterno.findFirst({ where: { id, tenantId, area }, include: { lineas: true } });
  if (!p) throw new ErrorNegocio("El pedido no existe.");
  return p;
}

/** Mientras está PENDIENTE, el local puede añadir, cambiar o quitar líneas (en BODEGA 360 no se podía). */
export async function editarPedidoInterno(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, d: { notas?: string | null; lineas: LineaPedida[] }) {
  const p = await pedidoDe(tx, tenantId, area, id);
  if (p.estado !== "PENDIENTE") throw new ErrorNegocio("Solo se puede cambiar un pedido pendiente de servir.");
  const lineas = juntarLineas(d.lineas);
  await comprobarLineas(tx, tenantId, area, p.destinoId, lineas);
  const precios = await preciosPara(tx, lineas.map((l) => l.productoId), p.destinoId);
  await tx.pedidoInternoLinea.deleteMany({ where: { pedidoId: id } });
  await tx.pedidoInternoLinea.createMany({
    data: lineas.map((l) => ({ pedidoId: id, productoId: l.productoId, pedida: new Prisma.Decimal(l.cantidad), precio: new Prisma.Decimal(r4(precios.precio(l.productoId))) })),
  });
  await tx.pedidoInterno.update({ where: { id }, data: { notas: d.notas ?? p.notas } });
  await auditar(tx, {
    tenantId,
    usuarioId,
    entidad: "PedidoInterno",
    entidadId: id,
    accion: "editar",
    antes: p.lineas.map((l) => ({ productoId: l.productoId, pedida: num(l.pedida) })),
    despues: lineas,
  });
}

/**
 * Servir: el obrador manda lo que hay. Cada cantidad se limita sola al stock disponible en origen
 * (como en BODEGA 360). Sale del almacén elegido o, si no se elige, del de por defecto de cada producto
 * (y de los demás si allí no hay bastante). En el local entra en el almacén por defecto de cada producto. Genera el albarán de salida y los movimientos en origen y destino.
 * `servidas`: id de línea → cantidad a servir (si falta, se sirve lo pedido limitado al stock).
 */
export async function servirPedidoInterno(
  tx: Tx,
  tenantId: string,
  usuarioId: string,
  area: AreaAlmacen,
  id: string,
  servidas: Map<string, number | null>,
  almacenOrigenId?: string | null,
) {
  const p = await pedidoDe(tx, tenantId, area, id);
  if (p.estado !== "PENDIENTE") throw new ErrorNegocio("Este pedido ya no está pendiente de servir.");
  if (almacenOrigenId && !(await tx.almacen.findFirst({ where: { id: almacenOrigenId, centroId: p.origenId, activo: true } }))) {
    throw new ErrorNegocio("El almacén de salida no es del centro que sirve.");
  }
  // con almacén de salida elegido, se limita a lo que hay en ese almacén; si no, a lo del centro (el motor reparte)
  const disponible = await stockEnCentro(tx, tenantId, area, p.origenId, almacenOrigenId || undefined);
  const precios = await preciosPara(tx, p.lineas.map((l) => l.productoId), p.destinoId);
  const albaran = await siguienteNumero(tx, tenantId, "ALB-S");
  const movs: NuevoMovimiento[] = [];
  const ajustadas: { productoId: string; pedida: number; pedidaServir: number; servida: number }[] = [];
  let importe = 0;
  for (const l of p.lineas) {
    const pedida = num(l.pedida);
    const queria = servidas.get(l.id);
    const pedidaServir = queria === null || queria === undefined ? pedida : Math.max(0, queria);
    const hay = Math.max(0, disponible.get(l.productoId) ?? 0);
    const servida = r3(Math.min(pedidaServir, hay));
    disponible.set(l.productoId, r3(hay - servida));
    const precio = r4(precios.precio(l.productoId));
    importe += servida * precio;
    ajustadas.push({ productoId: l.productoId, pedida, pedidaServir, servida });
    await tx.pedidoInternoLinea.update({ where: { id: l.id }, data: { servida: new Prisma.Decimal(servida), precio: new Prisma.Decimal(precio) } });
    if (servida > 0) {
      const coste = precios.coste(l.productoId);
      const comun = { tenantId, productoId: l.productoId, costeUnitario: coste, documento: albaran, documentoId: p.id, usuarioId };
      movs.push({ ...comun, centroId: p.origenId, ...(almacenOrigenId ? { almacenId: almacenOrigenId } : {}), tipo: "SALIDA_PEDIDO", cantidad: -servida, motivo: `Pedido ${p.numero}` });
      movs.push({ ...comun, centroId: p.destinoId, tipo: "ENTRADA_PEDIDO", cantidad: servida, motivo: `Pedido ${p.numero}` });
    }
  }
  if (movs.length === 0) throw new ErrorNegocio("No hay nada que servir: no queda stock de ninguna línea o todas están a 0. Si no se puede servir, recházalo.");
  await registrarMovimientos(tx, movs);
  await tx.pedidoInterno.update({ where: { id }, data: { estado: "SERVIDO", servidoPor: usuarioId, servidoEn: new Date(), albaran } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoInterno", entidadId: id, accion: "servir", despues: { albaran, lineas: ajustadas, importe: r2(importe) } });
  const centros = await tx.centro.findMany({ where: { id: { in: [p.origenId, p.destinoId] } }, select: { id: true, sociedadId: true } });
  const soc = new Map(centros.map((c) => [c.id, c.sociedadId]));
  // Lo escucha Obrador / Contabilidad para la venta del obrador y la factura entre sociedades
  await emitir(tx, tenantId, "almacen.pedido.servido", {
    pedidoId: id,
    numero: p.numero,
    albaran,
    area,
    origenId: p.origenId,
    destinoId: p.destinoId,
    sociedadOrigenId: soc.get(p.origenId) ?? null,
    sociedadDestinoId: soc.get(p.destinoId) ?? null,
    importe: r2(importe),
  });
  return { albaran, recortadas: ajustadas.filter((a) => a.servida < a.pedidaServir).length };
}

/** El local confirma lo que le llega. Si recibe menos (o más) de lo servido, se regulariza en destino. */
export async function recibirPedidoInterno(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, recibidas: Map<string, number | null>, nota?: string | null) {
  const p = await pedidoDe(tx, tenantId, area, id);
  if (p.estado !== "SERVIDO") throw new ErrorNegocio("Solo se puede confirmar la recepción de un pedido servido.");
  const precios = await preciosPara(tx, p.lineas.map((l) => l.productoId), p.destinoId);
  const movs: NuevoMovimiento[] = [];
  const diferencias: { productoId: string; servida: number; recibida: number }[] = [];
  for (const l of p.lineas) {
    const servida = num(l.servida);
    const v = recibidas.get(l.id);
    const recibida = r3(v === null || v === undefined ? servida : Math.max(0, v));
    await tx.pedidoInternoLinea.update({ where: { id: l.id }, data: { recibida: new Prisma.Decimal(recibida) } });
    const dif = r3(recibida - servida);
    if (dif !== 0) {
      diferencias.push({ productoId: l.productoId, servida, recibida });
      movs.push({
        tenantId,
        centroId: p.destinoId,
        productoId: l.productoId,
        tipo: "ENTRADA_PEDIDO",
        cantidad: dif,
        costeUnitario: precios.coste(l.productoId),
        documento: p.albaran ?? p.numero,
        documentoId: p.id,
        motivo: `Diferencia al recibir ${p.numero}${nota ? `: ${nota}` : ""}`,
        usuarioId,
      });
    }
  }
  await registrarMovimientos(tx, movs);
  const notas = nota ? [p.notas, `Recepción: ${nota}`].filter(Boolean).join("\n") : p.notas;
  await tx.pedidoInterno.update({ where: { id }, data: { estado: "RECIBIDO", notas } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoInterno", entidadId: id, accion: "recibir", despues: { diferencias, nota } });
  await emitir(tx, tenantId, "almacen.pedido.recibido", { pedidoId: id, numero: p.numero, area, conDiferencias: diferencias.length > 0 });
  return { diferencias: diferencias.length };
}

export async function rechazarPedidoInterno(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string, motivo: string) {
  const p = await pedidoDe(tx, tenantId, area, id);
  if (p.estado !== "PENDIENTE") throw new ErrorNegocio("Solo se puede rechazar un pedido pendiente.");
  if (!motivo.trim()) throw new ErrorNegocio("Escribe el motivo del rechazo para que el local lo sepa.");
  await tx.pedidoInterno.update({ where: { id }, data: { estado: "RECHAZADO", notas: [p.notas, `Rechazado: ${motivo}`].filter(Boolean).join("\n") } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoInterno", entidadId: id, accion: "rechazar", despues: { motivo } });
  await emitir(tx, tenantId, "almacen.pedido.rechazado", { pedidoId: id, numero: p.numero, area, motivo });
}

export async function cancelarPedidoInterno(tx: Tx, tenantId: string, usuarioId: string, area: AreaAlmacen, id: string) {
  const p = await pedidoDe(tx, tenantId, area, id);
  if (p.estado !== "PENDIENTE") throw new ErrorNegocio("Solo se puede cancelar un pedido que aún no se ha servido.");
  await tx.pedidoInterno.update({ where: { id }, data: { estado: "CANCELADO" } });
  await auditar(tx, { tenantId, usuarioId, entidad: "PedidoInterno", entidadId: id, accion: "cancelar" });
}

export async function listarPedidosInternos(tx: Tx, tenantId: string, area: AreaAlmacen, centroIds: string[], filtros: { estado?: string; limite?: number } = {}) {
  return tx.pedidoInterno.findMany({
    where: {
      tenantId,
      area,
      OR: [{ origenId: { in: centroIds } }, { destinoId: { in: centroIds } }],
      ...(filtros.estado ? { estado: filtros.estado as never } : {}),
    },
    include: {
      origen: { select: { id: true, nombre: true, codigo: true } },
      destino: { select: { id: true, nombre: true, codigo: true } },
      lineas: { include: { producto: { select: { nombre: true, referencia: true, unidad: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: filtros.limite ?? 200,
  });
}

export async function leerPedidoInterno(tx: Tx, tenantId: string, area: AreaAlmacen, id: string) {
  return tx.pedidoInterno.findFirst({
    where: { id, tenantId, area },
    include: {
      origen: { select: { id: true, nombre: true, codigo: true } },
      destino: { select: { id: true, nombre: true, codigo: true } },
      lineas: { include: { producto: { include: { familia: true } } }, orderBy: { producto: { nombre: "asc" } } },
    },
  });
}

/** Importe de un pedido (servido si ya se sirvió; pedido si no). */
export function importePedido(p: { estado: string; lineas: { pedida: unknown; servida: unknown; precio: unknown }[] }): number {
  const servido = p.estado === "SERVIDO" || p.estado === "RECIBIDO";
  return r2(p.lineas.reduce((a, l) => a + num((servido ? l.servida : l.pedida) as never) * num(l.precio as never), 0));
}
