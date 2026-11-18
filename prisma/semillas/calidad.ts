/**
 * Semilla del módulo Calidad (SOLO DESARROLLO).
 * Plantillas APPCC comunes (apertura, cierre, limpieza, recepción) y una del obrador; equipos de frío
 * en el obrador, Vaca Ayala y Albufera Moraleja con lecturas de 3 días (una fuera de rango);
 * listas hechas ayer, incidencias de ejemplo y mantenimiento preventivo.
 * Solo se carga si la cadena no tiene ninguna plantilla de calidad.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { ContextoSemilla } from "./index";
import { hoyMadrid } from "../../src/kernel/fechas";

const DIA_MS = 24 * 60 * 60 * 1000;

type Plantilla = [nombre: string, tipo: "APERTURA" | "CIERRE" | "LIMPIEZA" | "RECEPCION" | "OTRA", soloCentro: string | null, puntos: [string, boolean][]];

const PLANTILLAS: Plantilla[] = [
  [
    "Apertura de cocina",
    "APERTURA",
    null,
    [
      ["Cámaras y neveras dentro de rango (temperaturas anotadas)", false],
      ["Superficies y utensilios limpios y desinfectados", false],
      ["Personal con uniforme limpio, sin joyas y manos lavadas", false],
      ["Producto de mise en place etiquetado y dentro de fecha", false],
      ["Temperatura del agua del lavavajillas (°C)", true],
    ],
  ],
  [
    "Cierre de cocina",
    "CIERRE",
    null,
    [
      ["Producto sobrante tapado, etiquetado y en cámara", false],
      ["Fogones, plancha y parrilla apagados y limpios", false],
      ["Suelos barridos y fregados", false],
      ["Basura retirada y cubos limpios", false],
      ["Puertas de cámaras cerradas", false],
    ],
  ],
  [
    "Limpieza diaria",
    "LIMPIEZA",
    null,
    [
      ["Tablas de corte lavadas y desinfectadas por colores", false],
      ["Interior de neveras de línea limpio", false],
      ["Campana: filtros sin grasa acumulada", false],
      ["Freidoras: aceite revisado (cambiar si > 25 % compuestos polares)", false],
      ["Lavamanos con jabón y papel", false],
      ["Office y desagües limpios", false],
    ],
  ],
  [
    "Recepción de mercancía",
    "RECEPCION",
    null,
    [
      ["Vehículo del proveedor limpio y refrigerado", false],
      ["Envases íntegros y etiquetados (lote y caducidad)", false],
      ["Temperatura del producto refrigerado (°C)", true],
      ["Cantidades conformes al albarán", false],
      ["Número de albarán", true],
    ],
  ],
  [
    "Control de producción y etiquetado",
    "OTRA",
    "OB",
    [
      ["Abatimiento de cocinados por debajo de 8 °C en menos de 2 h", false],
      ["Todos los lotes del día etiquetados", false],
      ["Muestras testigo guardadas 5 días", false],
      ["Temperatura de la cámara de producto terminado (°C)", true],
    ],
  ],
];

// [centro, nombre, tipo, mínima, máxima, temperatura habitual]
const EQUIPOS: [string, string, "CAMARA_REFRIGERACION" | "CAMARA_CONGELACION" | "NEVERA" | "ARCON_CONGELADOR" | "MESA_FRIA", number, number, number][] = [
  ["OB", "Cámara de carnes", "CAMARA_REFRIGERACION", 0, 4, 2.4],
  ["OB", "Cámara de producto terminado", "CAMARA_REFRIGERACION", 0, 4, 3.1],
  ["OB", "Cámara de congelados", "CAMARA_CONGELACION", -22, -18, -19.6],
  ["VA-AYA", "Cámara de carnes", "CAMARA_REFRIGERACION", 0, 3, 1.8],
  ["VA-AYA", "Nevera de barra", "NEVERA", 2, 6, 4.2],
  ["VA-AYA", "Mesa fría de parrilla", "MESA_FRIA", 1, 5, 3.6],
  ["VA-AYA", "Arcón congelador", "ARCON_CONGELADOR", -22, -18, -20.1],
  ["AL-MOR", "Cámara de pescado", "CAMARA_REFRIGERACION", 0, 2, 1.1],
  ["AL-MOR", "Nevera de cocina", "NEVERA", 0, 4, 2.9],
  ["AL-MOR", "Congelador de marisco", "CAMARA_CONGELACION", -22, -18, -20.4],
];

// [centro, tarea, equipo, empresa, cada días, días desde hoy de la próxima]
const MANTENIMIENTO: [string, string, string | null, string | null, number, number][] = [
  ["OB", "Limpieza de campana y conductos", "Campana del obrador", "Higienizaciones Madrid S.L.", 90, 12],
  ["OB", "Revisión de extintores", null, "Extintores Centro S.A.", 365, 40],
  ["OB", "Desratización y desinsectación", null, "Plagas Control 3D", 30, -3],
  ["OB", "Revisión de cámaras frigoríficas", "Cámaras de carnes y congelados", "Frío Industrial Norte", 180, 25],
  ["VA-AYA", "Limpieza de campana y conductos", "Campana de la parrilla", "Higienizaciones Madrid S.L.", 90, 5],
  ["VA-AYA", "Limpieza de filtros de campana", "Campana de la parrilla", null, 7, 2],
  ["VA-AYA", "Revisión de extintores", null, "Extintores Centro S.A.", 365, 70],
  ["VA-AYA", "Desratización y desinsectación", null, "Plagas Control 3D", 30, 9],
  ["AL-MOR", "Limpieza de campana y conductos", "Campana de paellas", "Higienizaciones Madrid S.L.", 90, -1],
  ["AL-MOR", "Revisión de quemadores de paella", "Paelleros de gas", "Gas Servicios Alcobendas", 180, 33],
  ["AL-MOR", "Desratización y desinsectación", null, "Plagas Control 3D", 30, 14],
];

async function siguiente(prisma: PrismaClient, tenantId: string, serie: string, digitos = 6) {
  const anio = new Date().getFullYear();
  const c = await prisma.contador.upsert({
    where: { tenantId_serie_anio: { tenantId, serie, anio } },
    create: { tenantId, serie, anio, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return `${serie}-${String(c.valor).padStart(digitos, "0")}`;
}


export async function sembrar(prisma: PrismaClient, ctx: ContextoSemilla): Promise<void> {
  const t = ctx.tenantId;
  if ((await prisma.calidadPlantilla.count({ where: { tenantId: t } })) > 0) return;
  const hoy = new Date(`${hoyMadrid()}T00:00:00Z`);
  const dia = (n: number) => new Date(hoy.getTime() + n * DIA_MS);

  // Plantillas
  const plantillas: { id: string; nombre: string; soloCentro: string | null; puntos: { id: string; texto: string; pideValor: boolean }[] }[] = [];
  for (const [i, [nombre, tipo, solo, puntos]] of PLANTILLAS.entries()) {
    const centroId = solo ? ctx.centros[solo] : null;
    if (solo && !centroId) continue;
    const p = await prisma.calidadPlantilla.create({
      data: { tenantId: t, centroId, nombre, tipo, orden: i + 1, puntos: { create: puntos.map(([texto, pideValor], j) => ({ texto, pideValor, orden: j + 1 })) } },
      include: { puntos: true },
    });
    plantillas.push({ id: p.id, nombre, soloCentro: solo, puntos: p.puntos });
  }

  // Listas hechas ayer en tres centros (una con un fallo → incidencia)
  for (const codigo of ["OB", "VA-AYA", "AL-MOR"]) {
    const centroId = ctx.centros[codigo];
    if (!centroId) continue;
    for (const p of plantillas.filter((x) => !x.soloCentro || x.soloCentro === codigo)) {
      const falla = codigo === "AL-MOR" && p.nombre === "Limpieza diaria";
      const ej = await prisma.calidadEjecucion.create({
        data: {
          tenantId: t,
          centroId,
          plantillaId: p.id,
          fecha: dia(-1),
          todoCorrecto: !falla,
          observaciones: falla ? "Filtros de campana con grasa: se limpian al cierre y se pide adelantar la limpieza profunda." : null,
          realizadoNombre: codigo === "OB" ? "Economato" : codigo === "VA-AYA" ? "Gerente Vaca Ayala" : "Jefe de cocina Albufera",
          createdAt: new Date(dia(-1).getTime() + 10 * 60 * 60 * 1000),
          respuestas: {
            create: p.puntos.map((pt) => ({
              puntoId: pt.id,
              texto: pt.texto,
              correcto: !(falla && pt.texto.startsWith("Campana")),
              valor: pt.pideValor ? (pt.texto.includes("albarán") ? "ALB-48213" : pt.texto.includes("lavavajillas") ? "82" : "3,2") : null,
            })),
          },
        },
      });
      if (falla)
        await prisma.calidadIncidencia.create({
          data: {
            tenantId: t,
            centroId,
            numero: await siguiente(prisma, t, "INC"),
            tipo: "SEGURIDAD_ALIMENTARIA",
            titulo: "Limpieza diaria: 1 punto(s) no conformes",
            descripcion: "- Campana: filtros sin grasa acumulada",
            prioridad: "MEDIA",
            origen: "APPCC",
            origenId: ej.id,
            plazo: dia(1),
            estado: "EN_CURSO",
            responsableNombre: "Jefe de cocina Albufera",
            creadoNombre: "Jefe de cocina Albufera",
          },
        });
    }
  }

  // Equipos de frío y lecturas de los últimos 3 días (mañana y tarde)
  for (const [codigo, nombre, tipo, minimo, maximo, habitual] of EQUIPOS) {
    const centroId = ctx.centros[codigo];
    if (!centroId) continue;
    const e = await prisma.calidadEquipo.create({ data: { tenantId: t, centroId, nombre, tipo, minimo, maximo } });
    for (let d = -3; d <= 0; d++) {
      for (const hora of [8, 17]) {
        const cuando = new Date(dia(d).getTime() + (hora - 1) * 60 * 60 * 1000);
        if (cuando > new Date()) continue;
        const alarma = codigo === "VA-AYA" && nombre === "Nevera de barra" && d === -1 && hora === 17;
        const temperatura = alarma ? 8.5 : Math.round((habitual + (((d * 7 + hora) % 5) - 2) * 0.2) * 10) / 10;
        const r = await prisma.calidadTemperatura.create({
          data: {
            tenantId: t,
            centroId,
            equipoId: e.id,
            temperatura,
            fueraDeRango: alarma,
            accionCorrectora: alarma ? "Puerta mal cerrada. Se cierra, se comprueba a los 30 min (4,8 °C) y se revisa la goma." : null,
            registradoNombre: codigo === "OB" ? "Economato" : "Gerente Vaca Ayala",
            createdAt: cuando,
          },
        });
        if (alarma)
          await prisma.calidadIncidencia.create({
            data: {
              tenantId: t,
              centroId,
              numero: await siguiente(prisma, t, "INC"),
              tipo: "TEMPERATURA",
              titulo: "Nevera de barra: 8,5 °C fuera de rango",
              descripcion: "Rango permitido de 2 a 6 °C.\nAcción correctora: puerta mal cerrada; se cambia la goma.",
              prioridad: "ALTA",
              origen: "TEMPERATURA",
              origenId: r.id,
              estado: "RESUELTA",
              solucion: "Goma de la puerta cambiada por el técnico. Lecturas normales desde entonces.",
              resueltaEn: new Date(cuando.getTime() + 20 * 60 * 60 * 1000),
              plazo: dia(0),
              creadoNombre: "Gerente Vaca Ayala",
              responsableNombre: "Gerente Vaca Ayala",
              createdAt: cuando,
            },
          });
      }
    }
  }

  // Incidencias manuales
  const usuarios = await prisma.usuario.findMany({ where: { tenantId: t }, select: { id: true, nombre: true, email: true } });
  const gerente = usuarios.find((u) => u.email.startsWith("gerente"));
  const economato = usuarios.find((u) => u.email.startsWith("economato"));
  const manuales: [string, "AVERIA" | "QUEJA" | "ACCIDENTE", string, string, "BAJA" | "MEDIA" | "ALTA", "ABIERTA" | "EN_CURSO" | "RESUELTA", typeof gerente, number][] = [
    ["VA-AYA", "AVERIA", "Fuga de agua en el grifo del office", "Gotea de forma continua bajo el fregadero.", "MEDIA", "EN_CURSO", gerente, 2],
    ["AL-MOR", "QUEJA", "Cliente se queja de arroz pasado de punto", "Mesa 12, arroz a banda para 4. Se invita al postre.", "BAJA", "ABIERTA", undefined, 5],
    ["OB", "ACCIDENTE", "Corte leve en la mano al deshuesar", "Primeros auxilios en el obrador. Sin baja.", "ALTA", "RESUELTA", economato, -1],
    ["OB", "AVERIA", "La envasadora al vacío no sella bien", "Sella solo un lado de la bolsa.", "ALTA", "ABIERTA", economato, -1],
  ];
  for (const [codigo, tipo, titulo, descripcion, prioridad, estado, resp, plazo] of manuales) {
    const centroId = ctx.centros[codigo];
    if (!centroId) continue;
    await prisma.calidadIncidencia.create({
      data: {
        tenantId: t,
        centroId,
        numero: await siguiente(prisma, t, "INC"),
        tipo,
        titulo,
        descripcion,
        prioridad,
        estado,
        responsableId: resp?.id,
        responsableNombre: resp?.nombre,
        plazo: dia(plazo),
        solucion: estado === "RESUELTA" ? "Cura y revisión de guantes anticorte: se compran dos pares nuevos." : null,
        resueltaEn: estado === "RESUELTA" ? dia(-1) : null,
        creadoNombre: "Semilla",
      },
    });
  }

  // Mantenimiento preventivo
  for (const [codigo, nombre, equipo, empresa, cadaDias, proxima] of MANTENIMIENTO) {
    const centroId = ctx.centros[codigo];
    if (!centroId) continue;
    const ultima = dia(proxima - cadaDias);
    await prisma.calidadMantenimiento.create({
      data: {
        tenantId: t,
        centroId,
        nombre,
        equipo,
        empresa,
        cadaDias,
        ultimaVez: ultima,
        proximaVez: dia(proxima),
        hechos: { create: [{ fecha: ultima, coste: empresa ? (cadaDias >= 180 ? 240 : cadaDias >= 90 ? 380 : 65) : null, nota: "Registro de ejemplo (semilla)", realizadoNombre: empresa ?? "Personal propio" }] },
      },
    });
  }
}
