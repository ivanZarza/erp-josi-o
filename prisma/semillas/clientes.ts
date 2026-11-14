/**
 * Semilla del módulo Clientes (solo desarrollo): 50 clientes de ejemplo con consentimientos fechados,
 * visitas en varios locales, encuestas y 6 tarjetas regalo. Datos inventados.
 * Conviene ejecutarla ANTES que las de Reservas y Eventos (estas enlazan con los clientes si existen).
 */
import type { Sembrar } from "./index";

const NOMBRES = ["Lucía", "Hugo", "Martina", "Mateo", "Sofía", "Leo", "Julia", "Daniel", "Paula", "Pablo", "Valeria", "Álvaro", "Carmen", "Manuel", "Elena", "Javier", "Irene", "Diego", "Marta", "Adrián", "Laura", "David", "Sara", "Jorge", "Alba", "Carlos", "Claudia", "Sergio", "Andrea", "Raúl"];
const APELLIDOS = ["García", "Fernández", "González", "Rodríguez", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Serrano"];
const ALERGIAS = ["Celíaco", "Frutos secos", "Marisco", "Lactosa", "Huevo"];
const PREFERENCIAS = ["Mesa de ventana", "Terraza siempre que se pueda", "Vino tinto de Ribera", "Carne poco hecha", "Mesa tranquila, lejos de la puerta", "Trona para el niño"];
const LOCALES_VISITA = ["AL-MOR", "RZ-BAR", "PU-CHA", "VA-AYA", "RZ-CHA", "VR-CHA"];

/** Pseudoaleatorio con semilla fija: siempre los mismos datos. */
function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export const sembrar: Sembrar = async (prisma, ctx) => {
  const r = azar(2026);
  const elegir = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
  const t = ctx.tenantId;
  const hoy = new Date();
  const haceDias = (n: number) => new Date(hoy.getTime() - n * 86_400_000);
  const locales = LOCALES_VISITA.map((c) => ctx.centros[c]).filter(Boolean);

  for (let i = 0; i < 50; i++) {
    const nombre = NOMBRES[i % NOMBRES.length];
    const apellidos = `${APELLIDOS[(i * 7) % APELLIDOS.length]} ${APELLIDOS[(i * 3 + 5) % APELLIDOS.length]}`;
    const telefono = `+346${String(10000000 + i * 1234567).slice(0, 8)}`;
    const email = `${nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}.${apellidos.split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}${i}@ejemplo.com`;
    const etiquetas = [...(i % 9 === 0 ? ["VIP"] : []), ...(i % 6 === 0 ? ["Empresa"] : []), ...(i % 4 === 0 ? ["Habitual"] : [])];
    const alta = haceDias(30 + Math.floor(r() * 500));
    const c = await prisma.cliente.create({
      data: {
        tenantId: t, nombre, apellidos, telefono, email: i % 8 === 7 ? null : email,
        fechaNacimiento: i % 5 === 0 ? new Date(Date.UTC(1965 + (i % 35), i % 12, 1 + (i % 27))) : null,
        alergias: i % 7 === 0 ? elegir(ALERGIAS) : null,
        preferencias: i % 3 === 0 ? elegir(PREFERENCIAS) : null,
        notas: i % 11 === 0 ? "Suele venir con su pareja los viernes" : null,
        etiquetas, origen: i % 4 === 0 ? "COVERMANAGER" : "RESERVA", createdAt: alta,
      },
    });

    // Consentimientos fechados: reserva siempre; correo y WhatsApp solo algunos (no marcados por defecto)
    await prisma.clienteConsentimiento.create({ data: { tenantId: t, clienteId: c.id, tipo: "RESERVA", otorgado: true, origen: "RESERVA", texto: "Política de privacidad v1 (2026)", fecha: alta } });
    if (i % 3 !== 2) await prisma.clienteConsentimiento.create({ data: { tenantId: t, clienteId: c.id, tipo: "CORREO", otorgado: true, origen: "RESERVA", texto: "Acepto recibir ofertas del Grupo por correo", fecha: alta } });
    if (i % 4 === 1) await prisma.clienteConsentimiento.create({ data: { tenantId: t, clienteId: c.id, tipo: "WHATSAPP", otorgado: true, origen: "RESERVA", texto: "Acepto recibir ofertas por WhatsApp", fecha: alta } });
    if (i % 10 === 4) await prisma.clienteConsentimiento.create({ data: { tenantId: t, clienteId: c.id, tipo: "CORREO", otorgado: false, origen: "MANUAL", texto: "Se da de baja del boletín", fecha: haceDias(10) } });

    // Visitas pasadas
    const nVisitas = Math.floor(r() * 6);
    let ultima: Date | null = null;
    for (let v = 0; v < nVisitas && locales.length; v++) {
      const fecha = haceDias(3 + Math.floor(r() * 300));
      const centroId = elegir(locales);
      const visita = await prisma.clienteVisita.create({
        data: { tenantId: t, clienteId: c.id, centroId, fecha, personas: 2 + Math.floor(r() * 5), importe: Math.round((40 + r() * 260) * 100) / 100, origen: "RESERVA" },
      });
      if (!ultima || fecha > ultima) ultima = fecha;
      // Encuesta de la visita (algunas respondidas)
      const responde = r() < 0.6;
      const nota = responde ? (r() < 0.75 ? 4 + Math.floor(r() * 2) : 1 + Math.floor(r() * 3)) : null;
      await prisma.clienteEncuesta.create({
        data: {
          tenantId: t, clienteId: c.id, centroId, visitaId: visita.id, enviadaEn: new Date(fecha.getTime() + 86_400_000),
          estado: nota === null ? "PENDIENTE" : nota <= 2 && r() < 0.5 ? "GESTIONADA" : "RESPONDIDA",
          nota, comentario: nota === null ? null : nota >= 4 ? "Todo estupendo, volveremos" : nota <= 2 ? "Tardaron mucho en servir los principales" : "Bien, aunque había mucho ruido",
          invitadoResena: nota !== null && nota >= 4, avisoGerencia: nota !== null && nota <= 2,
          respondidaEn: nota === null ? null : new Date(fecha.getTime() + 2 * 86_400_000),
        },
      });
    }
    if (nVisitas) await prisma.cliente.update({ where: { id: c.id }, data: { visitas: nVisitas, ultimaVisita: ultima } });
  }

  // Tarjetas regalo
  const tarjetas: [string, number, number, string | null, string, string, "ACTIVA" | "AGOTADA" | "CADUCADA"][] = [
    ["GR-7K3M-9QX2", 100, 100, null, "Ana Ruiz", "Pedro Ruiz", "ACTIVA"],
    ["GR-B4TZ-2HNP", 150, 62.5, null, "Empresa Ejemplo S.L.", "Equipo de ventas", "ACTIVA"],
    ["GR-Q8WD-M5LA", 80, 80, "ALBUFERA", "Luis Gómez", "Marta Gómez", "ACTIVA"],
    ["GR-H2RC-7VJE", 200, 0, "RAZA", "Carmen Díaz", "Javier Díaz", "AGOTADA"],
    ["GR-Z6PN-4KUS", 50, 50, null, "Irene Gil", "Sara Gil", "CADUCADA"],
    ["GR-M9FA-3YDT", 120, 120, "PUCHERO", "Jorge Ramos", "Familia Ramos", "ACTIVA"],
  ];
  for (const [codigo, importe, saldo, marca, comprador, destinatario, estado] of tarjetas) {
    const caducidad = estado === "CADUCADA" ? haceDias(20) : new Date(hoy.getTime() + 300 * 86_400_000);
    const tj = await prisma.tarjetaRegalo.create({
      data: {
        tenantId: t, codigo, importeInicial: importe, saldo, caducidad: new Date(caducidad.toISOString().slice(0, 10)), marcaId: marca ? ctx.marcas[marca] ?? null : null,
        estado, compradorNombre: comprador, destinatario, origen: "WEB", mensaje: "¡Que lo disfrutéis!",
      },
    });
    await prisma.tarjetaRegaloMovimiento.create({ data: { tarjetaId: tj.id, tipo: "EMISION", importe, saldoTras: importe, createdAt: haceDias(60) } });
    if (saldo < importe)
      await prisma.tarjetaRegaloMovimiento.create({
        data: { tarjetaId: tj.id, tipo: "CANJE", importe: -(importe - saldo), saldoTras: saldo, centroId: ctx.centros[marca === "RAZA" ? "RZ-BAR" : "AL-MOR"] ?? null, nota: "Canje en mesa", createdAt: haceDias(15) },
      });
  }
};
