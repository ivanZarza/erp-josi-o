/**
 * Semilla del módulo Eventos (solo desarrollo): menús de grupo por marca y solicitudes de Navidad,
 * empresa y celebración en distintos puntos del embudo, una con presupuesto aceptado.
 * Enlaza con los espacios de Reservas y con Clientes si sus semillas ya se han cargado.
 */
import type { Sembrar } from "./index";

/** Numeración igual que src/kernel/numeracion.ts (contador por cadena, serie y año). */
async function siguiente(prisma: Parameters<Sembrar>[0], tenantId: string, serie: string) {
  const anio = new Date().getFullYear();
  const c = await prisma.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return `${serie}-${String(c.valor).padStart(6, "0")}`;
}

const MENUS: [string | null, string, number, number, string, string][] = [
  ["ALBUFERA", "Fumet", 65, 10, "Entrantes al centro, arroz a elegir y postre", "Ensalada de tomate y ventresca\nCroquetas de jamón\nCalamar a la andaluza\nArroz a banda o paella valenciana\nTarta de queso\nBodega: blanco y tinto de la casa"],
  ["ALBUFERA", "Socarrat", 70, 10, "Menú de arroces con marisco", "Gambas al ajillo\nPulpo a la brasa\nZamburiñas\nArroz del senyoret o negro\nTorrija caramelizada\nBodega: Godello y Rioja crianza"],
  ["RAZA", "Menú Parrilla", 55, 8, "Para compartir", "Provoleta\nEmpanadas criollas\nEntraña y vacío a la parrilla\nPatatas y ensalada\nPanqueque de dulce de leche"],
  ["RAZA", "Menú Raza", 75, 8, "Cortes de vaca madurada", "Steak tartar\nMollejas\nChuletón madurado (400 g por persona)\nGuarniciones\nPostre a elegir"],
  ["PUCHERO", "Menú Cocido", 45, 10, "Cocido madrileño en tres vuelcos", "Sopa de cocido\nGarbanzos y verduras\nCarnes del cocido\nArroz con leche\nVino de Madrid"],
  ["VACA", "Menú Pampa", 50, 10, "Clásico de La Vaca Argentina", "Chorizo criollo\nEmpanada\nBife de chorizo\nPostre de la casa"],
  [null, "Cóctel Navidad", 38, 20, "Cóctel de pie (todas las marcas)", "8 piezas frías\n6 piezas calientes\n2 dulces\nBarra de cerveza, vino y refrescos 90 min"],
];

export const sembrar: Sembrar = async (prisma, ctx) => {
  const t = ctx.tenantId;
  const menus: Record<string, { id: string; precio: number }> = {};
  for (const [marca, nombre, precio, min, descripcion, platos] of MENUS) {
    const m = await prisma.eventoMenu.create({ data: { tenantId: t, marcaId: marca ? ctx.marcas[marca] ?? null : null, nombre, precioPersona: precio, iva: 10, minPersonas: min, descripcion, platos } });
    menus[nombre] = { id: m.id, precio };
  }

  const espacio = async (codigo: string, nombre: string) =>
    ctx.centros[codigo] ? (await prisma.reservaEspacio.findFirst({ where: { tenantId: t, centroId: ctx.centros[codigo], nombre } }))?.id ?? null : null;
  const cliente = async (i: number) => (await prisma.cliente.findMany({ where: { tenantId: t }, orderBy: { createdAt: "asc" }, skip: i, take: 1 }))[0] ?? null;

  const anio = new Date().getFullYear();
  const dic = (d: number) => new Date(Date.UTC(anio, 11, d));
  type Sol = {
    tipo: "EMPRESA" | "CELEBRACION" | "NAVIDAD" | "CATERING"; estado: "NUEVA" | "CONTACTADA" | "PRESUPUESTO" | "ACEPTADA" | "PERDIDA";
    contacto: string; empresa?: string; telefono: string; email?: string; personas: number; fecha: Date; hora: string;
    presupuesto?: number; marca?: string; centro?: string; espacio?: string; recomiendame?: boolean; origen: string; notas?: string; motivo?: string;
    menu?: string; clienteIdx?: number;
  };
  const solicitudes: Sol[] = [
    { tipo: "NAVIDAD", estado: "NUEVA", contacto: "Raquel Benítez", empresa: "Consultora Norte S.L.", telefono: "+34611223344", email: "rbenitez@consultoranorte.example", personas: 45, fecha: dic(12), hora: "14:00", presupuesto: 3000, recomiendame: true, origen: "WEB", notas: "Comida de empresa. Quieren zona privada y algo de música." },
    { tipo: "NAVIDAD", estado: "CONTACTADA", contacto: "Fernando Lara", empresa: "Talleres Lara", telefono: "+34622334455", personas: 14, fecha: dic(19), hora: "21:00", presupuesto: 1000, marca: "ALBUFERA", centro: "AL-MOR", espacio: "Reservado Socarrat", origen: "TELEFONO", menu: "Socarrat", notas: "Dos celíacos." },
    { tipo: "NAVIDAD", estado: "PRESUPUESTO", contacto: "Marina Soler", empresa: "Estudio Soler Arquitectos", telefono: "+34633445566", email: "marina@estudiosoler.example", personas: 18, fecha: dic(17), hora: "14:30", marca: "ALBUFERA", centro: "AL-MOR", espacio: "Reservado Fumet", origen: "CORREO", menu: "Fumet", clienteIdx: 2 },
    { tipo: "NAVIDAD", estado: "ACEPTADA", contacto: "Andrés Quintana", empresa: "Grupo Quintana", telefono: "+34644556677", personas: 12, fecha: dic(11), hora: "21:30", marca: "RAZA", centro: "RZ-BAR", espacio: "Reservado", origen: "TELEFONO", menu: "Menú Raza", clienteIdx: 5 },
    { tipo: "NAVIDAD", estado: "PERDIDA", contacto: "Elena Prados", empresa: "Asesoría Prados", telefono: "+34655667788", personas: 30, fecha: dic(20), hora: "14:00", presupuesto: 1500, marca: "PUCHERO", centro: "PU-CHA", origen: "WEB", motivo: "Precio: buscaban menos de 40 € por persona" },
    { tipo: "CELEBRACION", estado: "NUEVA", contacto: "Carlos Medina", telefono: "+34666778899", personas: 22, fecha: new Date(Date.now() + 20 * 86_400_000), hora: "14:00", marca: "PUCHERO", centro: "PU-CHA", espacio: "Reservado", origen: "TELEFONO", notas: "80 cumpleaños de su madre. Tarta propia." },
    { tipo: "EMPRESA", estado: "CONTACTADA", contacto: "Silvia Robles", empresa: "Laboratorios Ejemplo", telefono: "+34677889900", email: "srobles@labejemplo.example", personas: 60, fecha: dic(3), hora: "20:30", recomiendame: true, origen: "WEB", menu: "Cóctel Navidad", notas: "Cóctel de pie con presentación de producto." },
    { tipo: "CATERING", estado: "NUEVA", contacto: "Hotel Ejemplo Madrid", telefono: "+34688990011", personas: 120, fecha: dic(31), hora: "21:00", origen: "CORREO", notas: "Catering de Nochevieja en sus instalaciones." },
  ];

  const orden = ["NUEVA", "CONTACTADA", "PRESUPUESTO", "ACEPTADA"];
  for (const s of solicitudes) {
    const numero = await siguiente(prisma, t, "EV");
    const cli = s.clienteIdx !== undefined ? await cliente(s.clienteIdx) : null;
    const espacioId = s.centro && s.espacio ? await espacio(s.centro, s.espacio) : null;
    const pasos = s.estado === "PERDIDA" ? ["NUEVA", "CONTACTADA", "PERDIDA"] : orden.slice(0, orden.indexOf(s.estado) + 1);
    const sol = await prisma.eventoSolicitud.create({
      data: {
        tenantId: t, numero, tipo: s.tipo, estado: s.estado, motivoPerdida: s.motivo ?? null,
        nombreContacto: cli ? `${cli.nombre} ${cli.apellidos ?? ""}`.trim() : s.contacto, empresa: s.empresa, telefono: cli?.telefono ?? s.telefono, email: cli?.email ?? s.email,
        clienteId: cli?.id ?? null, personas: s.personas, fecha: s.fecha, hora: s.hora, presupuestoCliente: s.presupuesto ?? null,
        marcaId: s.marca ? ctx.marcas[s.marca] ?? null : null, centroId: s.centro ? ctx.centros[s.centro] ?? null : null, espacioId,
        recomiendame: s.recomiendame ?? false, origen: s.origen, notas: s.notas,
        historial: { create: pasos.map((p, i) => ({ desde: (i ? pasos[i - 1] : null) as never, hasta: p as never, nota: p === "PERDIDA" ? s.motivo : null })) },
      },
    });

    // Presupuesto para las que ya lo tienen
    if (s.menu && (s.estado === "PRESUPUESTO" || s.estado === "ACEPTADA" || s.estado === "CONTACTADA")) {
      const m = menus[s.menu];
      const lineas = [
        { menuId: m.id, concepto: `Menú «${s.menu}»`, cantidad: s.personas, precio: m.precio },
        ...(s.tipo === "NAVIDAD" ? [{ menuId: null, concepto: "Copa de cava de bienvenida", cantidad: s.personas, precio: 6.5 }] : []),
      ];
      const total = lineas.reduce((a, l) => a + l.cantidad * l.precio, 0);
      const estadoP = s.estado === "ACEPTADA" ? "ACEPTADO" : s.estado === "PRESUPUESTO" ? "ENVIADO" : "BORRADOR";
      await prisma.eventoPresupuesto.create({
        data: {
          tenantId: t, solicitudId: sol.id, numero: await siguiente(prisma, t, "PRE"), version: 1, estado: estadoP,
          condiciones: "Precios con IVA incluido. Confirmación del número de comensales 72 horas antes. Señal del 30 % para bloquear la fecha.",
          senal: Math.round(total * 0.3 * 100) / 100, total,
          enviadoEn: estadoP !== "BORRADOR" ? new Date(Date.now() - 5 * 86_400_000) : null,
          aceptadoEn: estadoP === "ACEPTADO" ? new Date(Date.now() - 2 * 86_400_000) : null,
          lineas: { create: lineas.map((l, i) => ({ menuId: l.menuId, concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, iva: 10, importe: Math.round(l.cantidad * l.precio * 100) / 100, orden: i })) },
        },
      });
    }
  }
};
