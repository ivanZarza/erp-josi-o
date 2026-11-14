"use server";
/**
 * Acciones de servidor comunes de Bebidas y Comidas. Cada formulario manda el área en un campo
 * oculto `area`; con ella se decide el módulo y el permiso que se exige (bebidas:… o comidas:…).
 * La lógica está en src/nucleo/*; aquí solo se valida, se comprueba el permiso y el ámbito de centros.
 */
import { exigir, type Contexto } from "@/kernel/contexto";
import { db } from "@/kernel/db";
import { ErrorNegocio, moduloDeArea, type AreaAlmacen } from "@/nucleo/comun-almacen";
import { crearProducto, editarProducto, cambiarActivoProducto, ajustarProductoCentro } from "@/nucleo/productos";
import { registrarMerma } from "@/nucleo/mermas";
import {
  crearPedidoInterno,
  editarPedidoInterno,
  servirPedidoInterno,
  recibirPedidoInterno,
  rechazarPedidoInterno,
  cancelarPedidoInterno,
} from "@/nucleo/pedidos";
import { crearCompra, editarCompra, marcarCompraEnviada, recibirCompra, cancelarCompra, type LineaCompra } from "@/nucleo/compras";
import { crearInventario, guardarRecuento, terminarInventario, aprobarInventario, reabrirInventario } from "@/nucleo/inventarios";
import { euros } from "@/kernel/formato";
import { ejecutar, rutaSegura } from "./ejecutar";
import {
  EsquemaArea,
  EsquemaProducto,
  EsquemaAjusteCentro,
  EsquemaMerma,
  EsquemaPedidoNuevo,
  EsquemaCompraNueva,
  EsquemaInventarioNuevo,
  EsquemaEnvio,
  leerCantidades,
} from "./esquemas";

async function preparar(form: FormData, permiso: string) {
  const area = EsquemaArea.parse(form.get("area")) as AreaAlmacen;
  const m = moduloDeArea(area);
  const ctx = await exigir(m, `${m}:${permiso}`);
  const volver = rutaSegura(form.get("volver"), `/${m}`);
  return { area, m, ctx, volver, prisma: await db(), revalidar: [`/${m}`] };
}

function veCentro(ctx: Contexto, centroId: string) {
  if (!ctx.centros.some((c) => c.id === centroId)) throw new ErrorNegocio("No tienes acceso a ese centro.");
}

const idDe = (form: FormData) => String(form.get("id") ?? "");

// ---------------------------------------------------------------- productos

function leerProducto(form: FormData) {
  return EsquemaProducto.parse({
    referencia: form.get("referencia") ?? "",
    nombre: form.get("nombre") ?? "",
    familiaId: form.get("familiaId") ?? "",
    nuevaFamilia: form.get("nuevaFamilia") ?? "",
    proveedorId: form.get("proveedorId") ?? "",
    unidad: form.get("unidad") ?? "",
    unidadesCompra: form.get("unidadesCompra") ?? "1",
    costeUnitario: form.get("costeUnitario") ?? "",
    sinCoste: form.get("sinCoste") === "on",
    motivoSinCoste: form.get("motivoSinCoste") ?? "",
    iva: form.get("iva") ?? "21",
    stockMinimo: form.get("stockMinimo") ?? "",
    codigoBarras: form.get("codigoBarras") ?? "",
  });
}

export async function accionCrearProducto(form: FormData) {
  const p = await preparar(form, "productos:editar");
  return ejecutar(p, async () => {
    const d = leerProducto(form);
    const creado = await p.prisma.$transaction((tx) => crearProducto(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, d));
    return { ir: `/${p.m}/productos?ok=${encodeURIComponent(`Producto «${creado.nombre}» dado de alta.`)}` };
  });
}

export async function accionEditarProducto(form: FormData) {
  const p = await preparar(form, "productos:editar");
  return ejecutar(p, async () => {
    const d = leerProducto(form);
    await p.prisma.$transaction((tx) => editarProducto(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, idDe(form), d));
    return { ok: `Producto «${d.nombre}» guardado.` };
  });
}

export async function accionActivarProducto(form: FormData) {
  const p = await preparar(form, "productos:editar");
  const activo = form.get("activo") === "1";
  return ejecutar(p, async () => {
    await p.prisma.$transaction((tx) => cambiarActivoProducto(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, idDe(form), activo));
    return { ok: activo ? "Producto activado." : "Producto desactivado. Sus movimientos se conservan." };
  });
}

export async function accionAjustarCentro(form: FormData) {
  const p = await preparar(form, "productos:editar");
  return ejecutar(p, async () => {
    const d = EsquemaAjusteCentro.parse({
      productoId: form.get("productoId") ?? "",
      centroId: form.get("centroId") ?? "",
      activo: form.get("activoEnCentro") === "on",
      minimo: form.get("minimo") ?? "",
      maximo: form.get("maximo") ?? "",
      precioVenta: form.get("precioVenta") ?? "",
    });
    await p.prisma.$transaction((tx) => ajustarProductoCentro(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, d));
    return { ok: "Ajustes del producto en el centro guardados." };
  });
}

// ---------------------------------------------------------------- mermas

export async function accionMerma(form: FormData) {
  const p = await preparar(form, "mermas:crear");
  return ejecutar(p, async () => {
    const d = EsquemaMerma.parse({
      productoId: form.get("productoId") ?? "",
      centroId: form.get("centroId") ?? "",
      cantidad: form.get("cantidad") ?? "",
      motivo: form.get("motivo") ?? "",
      nota: form.get("nota") ?? "",
    });
    veCentro(p.ctx, d.centroId);
    const doc = await p.prisma.$transaction((tx) => registrarMerma(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, d));
    return { ok: `Merma registrada (${doc}).` };
  });
}

// ---------------------------------------------------------------- pedidos de locales

function lineasPedidas(form: FormData) {
  return Array.from(leerCantidades(form, "c_", { quitarVacios: true }))
    .filter(([, v]) => v !== null && v > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad: cantidad as number }));
}

async function pedidoConAcceso(p: Awaited<ReturnType<typeof preparar>>, id: string, lado: "origen" | "destino") {
  const ped = await p.prisma.pedidoInterno.findFirst({ where: { id, tenantId: p.ctx.tenant.id, area: p.area } });
  if (!ped) throw new ErrorNegocio("El pedido no existe.");
  veCentro(p.ctx, lado === "origen" ? ped.origenId : ped.destinoId);
  return ped;
}

export async function accionCrearPedido(form: FormData) {
  const p = await preparar(form, "pedidos:crear");
  return ejecutar(p, async () => {
    const d = EsquemaPedidoNuevo.parse({ origenId: form.get("origenId") ?? "", destinoId: form.get("destinoId") ?? "", notas: form.get("notas") ?? "" });
    veCentro(p.ctx, d.destinoId);
    const ped = await p.prisma.$transaction((tx) => crearPedidoInterno(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, { ...d, lineas: lineasPedidas(form) }));
    return { ir: `/${p.m}/pedidos/${ped.id}?ok=${encodeURIComponent(`Pedido ${ped.numero} enviado. Mientras no se sirva puedes cambiarlo.`)}` };
  });
}

export async function accionEditarPedido(form: FormData) {
  const p = await preparar(form, "pedidos:crear");
  return ejecutar(p, async () => {
    const ped = await pedidoConAcceso(p, idDe(form), "destino");
    const notas = String(form.get("notas") ?? "").trim() || null;
    await p.prisma.$transaction((tx) => editarPedidoInterno(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, ped.id, { notas, lineas: lineasPedidas(form) }));
    return { ir: `/${p.m}/pedidos/${ped.id}?ok=${encodeURIComponent(`Pedido ${ped.numero} cambiado.`)}` };
  });
}

export async function accionServirPedido(form: FormData) {
  const p = await preparar(form, "pedidos:servir");
  return ejecutar(p, async () => {
    const ped = await pedidoConAcceso(p, idDe(form), "origen");
    const servidas = leerCantidades(form, "s_");
    const r = await p.prisma.$transaction((tx) => servirPedidoInterno(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, ped.id, servidas));
    return { ok: `Pedido ${ped.numero} servido con el albarán ${r.albaran}.${r.recortadas ? ` ${r.recortadas} línea(s) ajustadas al stock disponible.` : ""}` };
  });
}

export async function accionRecibirPedido(form: FormData) {
  const p = await preparar(form, "pedidos:recibir");
  return ejecutar(p, async () => {
    const ped = await pedidoConAcceso(p, idDe(form), "destino");
    const recibidas = leerCantidades(form, "r_");
    const nota = String(form.get("nota") ?? "").trim() || null;
    const r = await p.prisma.$transaction((tx) => recibirPedidoInterno(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, ped.id, recibidas, nota));
    return { ok: r.diferencias ? `Recepción confirmada con ${r.diferencias} diferencia(s); el stock del local se ha regularizado.` : "Recepción confirmada: todo correcto." };
  });
}

export async function accionRechazarPedido(form: FormData) {
  const p = await preparar(form, "pedidos:servir");
  return ejecutar(p, async () => {
    const ped = await pedidoConAcceso(p, idDe(form), "origen");
    await p.prisma.$transaction((tx) => rechazarPedidoInterno(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, ped.id, String(form.get("motivo") ?? "")));
    return { ok: `Pedido ${ped.numero} rechazado.` };
  });
}

export async function accionCancelarPedido(form: FormData) {
  const p = await preparar(form, "pedidos:crear");
  return ejecutar(p, async () => {
    const ped = await pedidoConAcceso(p, idDe(form), "destino");
    await p.prisma.$transaction((tx) => cancelarPedidoInterno(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, ped.id));
    return { ok: `Pedido ${ped.numero} cancelado.` };
  });
}

// ---------------------------------------------------------------- compras a proveedor

function lineasCompra(form: FormData): LineaCompra[] {
  const cantidades = leerCantidades(form, "c_", { quitarVacios: true });
  const precios = leerCantidades(form, "p_", { quitarVacios: true });
  return Array.from(cantidades)
    .filter(([, v]) => v !== null && v > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad: cantidad as number, precio: precios.get(productoId) ?? 0 }));
}

async function compraConAcceso(p: Awaited<ReturnType<typeof preparar>>, id: string) {
  const c = await p.prisma.pedidoCompra.findFirst({ where: { id, tenantId: p.ctx.tenant.id, area: p.area } });
  if (!c) throw new ErrorNegocio("La compra no existe.");
  veCentro(p.ctx, c.centroId);
  return c;
}

export async function accionCrearCompra(form: FormData) {
  const p = await preparar(form, "compras:crear");
  return ejecutar(p, async () => {
    const d = EsquemaCompraNueva.parse({ proveedorId: form.get("proveedorId") ?? "", centroId: form.get("centroId") ?? "", notas: form.get("notas") ?? "" });
    veCentro(p.ctx, d.centroId);
    const c = await p.prisma.$transaction((tx) => crearCompra(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, { ...d, lineas: lineasCompra(form) }));
    return { ir: `/${p.m}/compras/${c.id}?ok=${encodeURIComponent(`Compra ${c.numero} preparada. Envíala al proveedor.`)}` };
  });
}

export async function accionEditarCompra(form: FormData) {
  const p = await preparar(form, "compras:crear");
  return ejecutar(p, async () => {
    const c = await compraConAcceso(p, idDe(form));
    const notas = String(form.get("notas") ?? "").trim() || null;
    await p.prisma.$transaction((tx) => editarCompra(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, c.id, { notas, lineas: lineasCompra(form) }));
    return { ir: `/${p.m}/compras/${c.id}?ok=${encodeURIComponent(`Compra ${c.numero} cambiada.`)}` };
  });
}

export async function accionEnviarCompra(form: FormData) {
  const p = await preparar(form, "compras:crear");
  return ejecutar(p, async () => {
    const c = await compraConAcceso(p, idDe(form));
    const via = EsquemaEnvio.parse(form.get("via") ?? "whatsapp");
    await p.prisma.$transaction((tx) => marcarCompraEnviada(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, c.id, via));
    return { ok: `Compra ${c.numero} marcada como enviada.` };
  });
}

export async function accionRecibirCompra(form: FormData) {
  const p = await preparar(form, "compras:recibir");
  return ejecutar(p, async () => {
    const c = await compraConAcceso(p, idDe(form));
    const recibidas = leerCantidades(form, "r_");
    const precios = leerCantidades(form, "p_");
    const lineas = new Map<string, { recibida: number | null; precio: number | null }>();
    for (const k of new Set([...recibidas.keys(), ...precios.keys()])) lineas.set(k, { recibida: recibidas.get(k) ?? 0, precio: precios.get(k) ?? null });
    const albaranProveedor = String(form.get("albaranProveedor") ?? "").trim().slice(0, 60) || null;
    const r = await p.prisma.$transaction((tx) => recibirCompra(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, c.id, { lineas, albaranProveedor, cerrar: form.get("cerrar") === "on" }));
    return { ok: `Recepción guardada con el albarán ${r.albaran}. ${r.estado === "RECIBIDO" ? "Compra completa." : "Queda mercancía pendiente."}` };
  });
}

export async function accionCancelarCompra(form: FormData) {
  const p = await preparar(form, "compras:crear");
  return ejecutar(p, async () => {
    const c = await compraConAcceso(p, idDe(form));
    await p.prisma.$transaction((tx) => cancelarCompra(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, c.id));
    return { ok: `Compra ${c.numero} cancelada.` };
  });
}

// ---------------------------------------------------------------- inventarios

async function inventarioConAcceso(p: Awaited<ReturnType<typeof preparar>>, id: string) {
  const inv = await p.prisma.inventario.findFirst({ where: { id, tenantId: p.ctx.tenant.id, area: p.area } });
  if (!inv) throw new ErrorNegocio("El inventario no existe.");
  veCentro(p.ctx, inv.centroId);
  return inv;
}

export async function accionCrearInventario(form: FormData) {
  const p = await preparar(form, "inventarios:crear");
  return ejecutar(p, async () => {
    const d = EsquemaInventarioNuevo.parse({ centroId: form.get("centroId") ?? "", nombre: form.get("nombre") ?? "" });
    veCentro(p.ctx, d.centroId);
    const inv = await p.prisma.$transaction((tx) => crearInventario(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, d));
    return { ir: `/${p.m}/inventarios/${inv.id}?ok=${encodeURIComponent(`Inventario ${inv.numero} abierto. Ya puedes contar.`)}` };
  });
}

export async function accionGuardarRecuento(form: FormData) {
  const p = await preparar(form, "inventarios:crear");
  return ejecutar(p, async () => {
    const inv = await inventarioConAcceso(p, idDe(form));
    const contados = leerCantidades(form, "n_");
    const cambios = await p.prisma.$transaction((tx) => guardarRecuento(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, inv.id, contados));
    if (form.get("terminar") === "1") {
      const r = await p.prisma.$transaction((tx) => terminarInventario(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, inv.id));
      return {
        ok:
          r.estado === "CERRADO"
            ? `Inventario cerrado. Diferencia: ${euros(r.cuentas.diferenciaEuros)}.`
            : `El descuadre (${euros(r.cuentas.descuadreEuros)}) supera 500 €: queda pendiente de aprobación por quien pueda cerrar inventarios.`,
      };
    }
    return { ok: cambios ? `Recuento guardado (${cambios} línea(s) cambiadas).` : "No había cambios que guardar." };
  });
}

export async function accionAprobarInventario(form: FormData) {
  const p = await preparar(form, "inventarios:cerrar");
  return ejecutar(p, async () => {
    const inv = await inventarioConAcceso(p, idDe(form));
    const c = await p.prisma.$transaction((tx) => aprobarInventario(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, inv.id));
    return { ok: `Inventario aprobado y cerrado. Diferencia: ${euros(c.diferenciaEuros)}.` };
  });
}

export async function accionReabrirInventario(form: FormData) {
  const p = await preparar(form, "inventarios:cerrar");
  return ejecutar(p, async () => {
    const inv = await inventarioConAcceso(p, idDe(form));
    await p.prisma.$transaction((tx) => reabrirInventario(tx, p.ctx.tenant.id, p.ctx.usuario.id, p.area, inv.id));
    return { ok: "Inventario devuelto a recuento." };
  });
}
