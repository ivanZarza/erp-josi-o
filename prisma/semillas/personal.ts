/**
 * Semilla del módulo Personal (solo desarrollo). Datos inventados, de ejemplo:
 * - 15 puestos, 3 convenios (hostelería de Madrid, Baleares y Murcia) con sus categorías.
 * - 40 empleados repartidos por Vaca Ayala, Raza Barquillo, Vaca Roxa Chamberí, Albufera Plaza Castilla,
 *   Vaca Ibiza (fijos discontinuos), Vaca Murcia y el Obrador, con contrato, certificados y algún préstamo.
 * - Turnos tipo, cuadrante de esta semana (lunes a domingo) y fichajes de los días ya pasados.
 * - Ausencias (vacaciones aprobadas, una pedida, una baja médica, una rechazada).
 * - Dos ofertas de empleo con candidatos y dos candidatos en la bolsa.
 * Incluye a propósito casos para los avisos: contrato que vence, periodo de prueba, certificado
 * caducado, descanso menor de 12 h, un retraso y una salida sin fichar.
 * Si ya hay empleados en la cadena, no hace nada.
 */
import type { Sembrar } from "./index";
import { aDia, sumarDias, hoyMadrid, lunesDe, limitesTurno, instanteMadrid, diasEntre } from "../../src/modulos/personal/fechas";

type Dep = "COCINA" | "SALA" | "BARRA" | "OFFICE" | "ALMACEN" | "OBRADOR" | "REPARTO" | "DIRECCION" | "ADMINISTRACION";

const PUESTOS: [string, Dep, number][] = [
  // nombre, departamento, salario bruto anual de ejemplo
  ["Gerente", "DIRECCION", 38000],
  ["Jefe de cocina", "COCINA", 32000],
  ["Cocinero/a", "COCINA", 22500],
  ["Ayudante de cocina", "COCINA", 19000],
  ["Parrillero/a", "COCINA", 24000],
  ["Friegaplatos", "OFFICE", 17500],
  ["Jefe de sala", "SALA", 28000],
  ["Camarero/a", "SALA", 20000],
  ["Barman", "BARRA", 21000],
  ["Sumiller", "SALA", 26000],
  ["Encargado de obrador", "OBRADOR", 30000],
  ["Cocinero/a de obrador", "OBRADOR", 22000],
  ["Mozo de almacén", "ALMACEN", 19500],
  ["Repartidor/a", "REPARTO", 19500],
  ["Administración", "ADMINISTRACION", 24000],
];

const NOMBRES = ["Lucía", "Javier", "María", "Carlos", "Ana", "Diego", "Laura", "Pablo", "Marta", "Sergio", "Elena", "Andrés", "Paula", "Raúl", "Cristina", "Miguel", "Sara", "Álvaro", "Irene", "Jorge", "Nerea", "Iván", "Claudia", "Rubén", "Alba", "Hugo", "Carmen", "Adrián", "Noelia", "Óscar", "Patricia", "Daniel", "Rocío", "Manuel", "Beatriz", "Toni", "Xisca", "Joan", "Encarna", "Ginés"];
const APELLIDOS = ["García López", "Martínez Ruiz", "Sánchez Gil", "Fernández Mora", "López Navarro", "Gómez Prieto", "Díaz Romero", "Pérez Vidal", "Moreno Cano", "Jiménez Soto", "Álvarez Rey", "Romero Cruz", "Navarro Ibáñez", "Torres Ramos", "Domínguez Peña", "Vázquez Lara", "Ramos Ortega", "Gil Serrano", "Serrano Molina", "Blanco Castro", "Suárez Medina", "Ortiz Garrido", "Rubio Cortés", "Marín Delgado", "Sanz León", "Iglesias Vega", "Núñez Herrera", "Castro Méndez", "Ortega Fuentes", "Delgado Pascual", "Morales Rojas", "Herrera Benítez", "Cabrera Santana", "Campos Aguilar", "Vega Nieto", "Ferrer Mas", "Riera Bonet", "Marí Torres", "Pérez Sánchez", "Martínez Hernández"];

// [centro, puesto, turno habitual] por persona (40)
type Turno = "M" | "T" | "P" | "O" | "R";
const PLANTILLA: [string, string, Turno][] = [
  ["VA-AYA", "Gerente", "P"], ["VA-AYA", "Jefe de cocina", "P"], ["VA-AYA", "Parrillero/a", "T"], ["VA-AYA", "Cocinero/a", "M"], ["VA-AYA", "Jefe de sala", "P"], ["VA-AYA", "Camarero/a", "T"], ["VA-AYA", "Camarero/a", "M"], ["VA-AYA", "Friegaplatos", "T"],
  ["RZ-BAR", "Jefe de cocina", "P"], ["RZ-BAR", "Cocinero/a", "T"], ["RZ-BAR", "Jefe de sala", "P"], ["RZ-BAR", "Camarero/a", "T"], ["RZ-BAR", "Barman", "T"], ["RZ-BAR", "Sumiller", "P"],
  ["VR-CHA", "Jefe de cocina", "P"], ["VR-CHA", "Ayudante de cocina", "M"], ["VR-CHA", "Camarero/a", "T"], ["VR-CHA", "Camarero/a", "P"],
  ["AL-PCA", "Jefe de cocina", "P"], ["AL-PCA", "Cocinero/a", "M"], ["AL-PCA", "Camarero/a", "P"], ["AL-PCA", "Camarero/a", "T"], ["AL-PCA", "Friegaplatos", "T"],
  ["VA-IBI", "Jefe de cocina", "P"], ["VA-IBI", "Parrillero/a", "T"], ["VA-IBI", "Camarero/a", "T"], ["VA-IBI", "Barman", "T"],
  ["VA-MUR", "Gerente", "P"], ["VA-MUR", "Cocinero/a", "P"], ["VA-MUR", "Camarero/a", "T"], ["VA-MUR", "Ayudante de cocina", "M"],
  ["OB", "Encargado de obrador", "O"], ["OB", "Cocinero/a de obrador", "O"], ["OB", "Cocinero/a de obrador", "O"], ["OB", "Cocinero/a de obrador", "O"], ["OB", "Mozo de almacén", "O"], ["OB", "Mozo de almacén", "O"], ["OB", "Repartidor/a", "R"], ["OB", "Repartidor/a", "R"], ["OB", "Administración", "M"],
];

const TURNOS: Record<Turno, { inicio: string; fin: string; inicio2?: string; fin2?: string; pausa: number }> = {
  M: { inicio: "09:00", fin: "17:00", pausa: 30 },
  T: { inicio: "17:00", fin: "01:00", pausa: 30 },
  P: { inicio: "12:00", fin: "16:00", inicio2: "20:00", fin2: "00:00", pausa: 0 },
  O: { inicio: "06:00", fin: "14:00", pausa: 30 },
  R: { inicio: "07:00", fin: "15:00", pausa: 30 },
};

/** Pseudoaleatorio determinista para que la semilla salga siempre igual. */
function azar(semilla: number) {
  let x = semilla;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

export const sembrar: Sembrar = async (prisma, ctx) => {
  const t = ctx.tenantId;
  if ((await prisma.empleado.count({ where: { tenantId: t } })) > 0) return; // ya sembrado
  const centro = (codigo: string) => {
    const id = ctx.centros[codigo];
    if (!id) throw new Error(`Semilla de Personal: falta el centro ${codigo}`);
    return id;
  };
  const r = azar(2026);
  const hoy = hoyMadrid();
  const lunes = lunesDe(hoy);

  // ---------- Catálogos ----------
  const puestos: Record<string, string> = {};
  for (const [i, [nombre, departamento]] of PUESTOS.entries()) {
    const p = await prisma.puesto.create({ data: { tenantId: t, nombre, departamento, orden: i } });
    puestos[nombre] = p.id;
  }
  const convenios: Record<string, { id: string; categorias: Record<string, string> }> = {};
  for (const [clave, nombre, comunidad, horas] of [
    ["MAD", "Hostelería de la Comunidad de Madrid", "Madrid", 1776],
    ["BAL", "Hostelería de las Illes Balears", "Illes Balears", 1792],
    ["MUR", "Hostelería de la Región de Murcia", "Región de Murcia", 1800],
  ] as const) {
    const c = await prisma.convenio.create({ data: { tenantId: t, nombre, comunidad, horasAnuales: horas, diasVacaciones: 30, descansoMinimoHoras: 12 } });
    convenios[clave] = { id: c.id, categorias: {} };
    for (const [nombreP, , salario] of PUESTOS) {
      const k = await prisma.categoriaConvenio.create({ data: { convenioId: c.id, nombre: nombreP, salarioBaseAnual: Math.round(salario * 0.85) } });
      convenios[clave].categorias[nombreP] = k.id;
    }
  }
  const convenioDe = (codigo: string) => (codigo === "VA-IBI" ? "BAL" : codigo === "VA-MUR" ? "MUR" : "MAD");

  // turnos tipo para todos los centros
  await prisma.turnoTipo.createMany({
    data: [
      { tenantId: t, nombre: "Mañana", inicio: "09:00", fin: "17:00" },
      { tenantId: t, nombre: "Tarde-noche", inicio: "17:00", fin: "01:00" },
      { tenantId: t, nombre: "Partido", inicio: "12:00", fin: "16:00", inicio2: "20:00", fin2: "00:00" },
      { tenantId: t, centroId: centro("OB"), nombre: "Obrador", inicio: "06:00", fin: "14:00" },
      { tenantId: t, centroId: centro("OB"), nombre: "Reparto", inicio: "07:00", fin: "15:00" },
    ],
  });

  // ---------- Empleados, contratos y certificados ----------
  const gerenteAyala = await prisma.usuario.findFirst({ where: { tenantId: t, email: "gerente.ayala@erp.local" } });
  const empleados: { id: string; centroId: string; turno: Turno; i: number }[] = [];
  for (const [i, [codigoCentro, puesto, turno]] of PLANTILLA.entries()) {
    const centroId = centro(codigoCentro);
    const conv = convenioDe(codigoCentro);
    const salario = PUESTOS.find((p) => p[0] === puesto)![2];
    const antiguedad = Math.floor(r() * 2400) + 20; // días
    const fechaAlta = codigoCentro === "VA-IBI" ? sumarDias(hoy, -400) : sumarDias(hoy, -antiguedad);
    const extra: string[] = [];
    if (codigoCentro === "AL-PCA" && ctx.centros["VA-PCA"]) extra.push(ctx.centros["VA-PCA"]); // mismo edificio
    if (i === 32 || i === 33) extra.push(centro("VA-AYA")); // cocineros del obrador que refuerzan Ayala
    if (i === 11) extra.push(centro("VR-CHA"));
    const e = await prisma.empleado.create({
      data: {
        tenantId: t,
        codigo: `EMP-${String(i + 1).padStart(4, "0")}`,
        nombre: NOMBRES[i],
        apellidos: APELLIDOS[i],
        dni: `${String(10000000 + Math.floor(r() * 89999999))}${"TRWAGMYFPDXBNJZSQVHLCKE"[i % 23]}`,
        nss: `28${String(Math.floor(r() * 1e10)).padStart(10, "0")}`,
        telefono: `+346${String(Math.floor(r() * 1e8)).padStart(8, "0")}`,
        email: `${NOMBRES[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${APELLIDOS[i].split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@ejemplo.es`,
        fechaNacimiento: aDia(`${1970 + Math.floor(r() * 35)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`),
        centroPrincipalId: centroId,
        puestoId: puestos[puesto],
        categoriaId: convenios[conv].categorias[puesto],
        fechaAlta: aDia(fechaAlta),
        pin: String(1000 + i * 37).slice(0, 4),
        usuarioId: i === 0 && gerenteAyala ? gerenteAyala.id : null,
        centros: { create: extra.map((c) => ({ centroId: c })) },
      },
    });
    empleados.push({ id: e.id, centroId, turno, i });

    // contrato: casos variados para los avisos
    let tipo: "INDEFINIDO" | "TEMPORAL" | "FIJO_DISCONTINUO" | "PRACTICAS" | "PARCIAL" = "INDEFINIDO";
    let jornada = 40;
    let inicio = fechaAlta;
    let fin: string | null = null;
    let prueba: string | null = null;
    if (codigoCentro === "VA-IBI") tipo = "FIJO_DISCONTINUO";
    if ([6, 17, 29].includes(i)) {
      tipo = "PARCIAL";
      jornada = 20;
    }
    if ([5, 12, 21].includes(i)) {
      tipo = "TEMPORAL";
      inicio = sumarDias(hoy, -160);
      fin = sumarDias(hoy, [5, 12, 21].indexOf(i) * 9 + 6); // vence en 6, 15 y 24 días
    }
    if ([7, 25].includes(i)) {
      tipo = "TEMPORAL";
      inicio = sumarDias(hoy, -20);
      fin = sumarDias(hoy, 160);
      prueba = sumarDias(hoy, i === 7 ? 4 : 10); // fin del periodo de prueba
    }
    if (i === 38) {
      tipo = "PRACTICAS";
      inicio = sumarDias(hoy, -100);
      fin = sumarDias(hoy, 80);
    }
    if (inicio < fechaAlta) inicio = fechaAlta;
    if (diasEntre(fechaAlta, inicio) < 1) inicio = fechaAlta;
    await prisma.contrato.create({
      data: {
        tenantId: t,
        empleadoId: e.id,
        tipo,
        jornadaSemanal: jornada,
        convenioId: convenios[conv].id,
        categoriaId: convenios[conv].categorias[puesto],
        salarioBrutoAnual: Math.round((salario * jornada) / 40),
        porcentajeCotizacion: 32,
        // a los repartidores se les pone el coste/hora a mano (ejemplo de coste configurable)
        costeHora: puesto === "Repartidor/a" ? 16.5 : null,
        fechaInicio: aDia(inicio),
        fechaFin: fin ? aDia(fin) : null,
        finPeriodoPrueba: prueba ? aDia(prueba) : null,
      },
    });

    // certificados: manipulador y alérgenos a quien toca alimentos; algún caducado o por caducar
    const tocaAlimentos = !["Gerente", "Administración", "Repartidor/a", "Mozo de almacén"].includes(puesto);
    if (tocaAlimentos && i !== 15) {
      const caduca = i === 3 ? sumarDias(hoy, -12) : i === 19 ? sumarDias(hoy, 18) : sumarDias(hoy, 300 + Math.floor(r() * 900));
      await prisma.certificadoEmpleado.create({ data: { tenantId: t, empleadoId: e.id, tipo: "MANIPULADOR", nombre: "Manipulador de alimentos", entidad: "Academia Hostelería Madrid", obtenidoEn: aDia(sumarDias(caduca, -1460)), caducaEn: aDia(caduca) } });
      await prisma.certificadoEmpleado.create({ data: { tenantId: t, empleadoId: e.id, tipo: "ALERGENOS", nombre: "Alérgenos alimentarios", entidad: "Formación interna", obtenidoEn: aDia(sumarDias(hoy, -200)), caducaEn: i === 26 ? aDia(sumarDias(hoy, 9)) : null } });
    }
    if (puesto === "Mozo de almacén") {
      await prisma.certificadoEmpleado.create({ data: { tenantId: t, empleadoId: e.id, tipo: "CARRETILLERO", nombre: "Carné de carretillero", entidad: "OCA", obtenidoEn: aDia(sumarDias(hoy, -900)), caducaEn: aDia(sumarDias(hoy, i === 35 ? 25 : 900)) } });
    }
    await prisma.certificadoEmpleado.create({ data: { tenantId: t, empleadoId: e.id, tipo: "PRL", nombre: "Prevención de riesgos laborales (hostelería)", entidad: "Servicio de prevención", obtenidoEn: aDia(fechaAlta), caducaEn: null } });
    await prisma.documentoEmpleado.create({ data: { tenantId: t, empleadoId: e.id, tipo: "CONTRATO", nombre: `Contrato firmado ${inicio.slice(0, 4)}` } });
    if (i === 24) await prisma.documentoEmpleado.create({ data: { tenantId: t, empleadoId: e.id, tipo: "PERMISO_TRABAJO", nombre: "Permiso de residencia y trabajo", caducaEn: aDia(sumarDias(hoy, 27)) } });
  }

  // un empleado dado de baja el mes pasado (historial)
  const baja = await prisma.empleado.create({
    data: { tenantId: t, codigo: "EMP-0041", nombre: "Tomás", apellidos: "Gallego Ruiz", centroPrincipalId: centro("VA-AYA"), puestoId: puestos["Camarero/a"], fechaAlta: aDia(sumarDias(hoy, -500)), fechaBaja: aDia(sumarDias(hoy, -25)), motivoBaja: "Baja voluntaria", activo: false },
  });
  await prisma.contrato.create({ data: { tenantId: t, empleadoId: baja.id, tipo: "INDEFINIDO", jornadaSemanal: 40, convenioId: convenios.MAD.id, salarioBrutoAnual: 20000, fechaInicio: aDia(sumarDias(hoy, -500)), fechaFin: aDia(sumarDias(hoy, -25)), activo: false, motivoFin: "Baja: Baja voluntaria" } });

  // ---------- Ausencias ----------
  const aus = async (i: number, tipo: "VACACIONES" | "ASUNTOS_PROPIOS" | "BAJA_ENFERMEDAD", desde: string, hasta: string, estado: "PEDIDA" | "APROBADA" | "RECHAZADA", extra: { comentario?: string; motivoRechazo?: string } = {}) => {
    const e = empleados[i];
    await prisma.ausencia.create({ data: { tenantId: t, empleadoId: e.id, centroId: e.centroId, tipo, desde: aDia(desde), hasta: aDia(hasta), dias: diasEntre(desde, hasta), estado, ...(estado !== "PEDIDA" ? { resueltaEn: new Date() } : {}), ...extra } });
  };
  await aus(9, "VACACIONES", sumarDias(lunes, 2), sumarDias(lunes, 8), "APROBADA", { comentario: "Viaje familiar" });
  await aus(16, "VACACIONES", sumarDias(lunes, 14), sumarDias(lunes, 27), "PEDIDA");
  await aus(30, "BAJA_ENFERMEDAD", sumarDias(lunes, -3), sumarDias(lunes, 10), "APROBADA");
  await aus(20, "ASUNTOS_PROPIOS", sumarDias(lunes, 9), sumarDias(lunes, 9), "PEDIDA", { comentario: "Mudanza" });
  await aus(2, "VACACIONES", sumarDias(lunes, 21), sumarDias(lunes, 35), "RECHAZADA", { motivoRechazo: "Coincide con el jefe de cocina" });
  await aus(33, "VACACIONES", sumarDias(lunes, -40), sumarDias(lunes, -30), "APROBADA");

  // ---------- Cuadrante de esta semana y fichajes de los días pasados ----------
  const ausentes = new Map<number, [string, string]>([
    [9, [sumarDias(lunes, 2), sumarDias(lunes, 8)]],
    [30, [sumarDias(lunes, -3), sumarDias(lunes, 10)]],
  ]);
  const ahora = Date.now();
  for (const e of empleados) {
    const base = TURNOS[e.turno];
    // dos días libres seguidos, distintos según la persona; el obrador libra fin de semana
    const libre1 = e.turno === "O" || e.turno === "R" ? 5 : (e.i * 3) % 7;
    const libres = new Set([libre1, (libre1 + 1) % 7]);
    const parcial = [6, 17, 29].includes(e.i);
    // primer día trabajado de la semana (desde el martes): ahí se ponen los casos de prueba
    const diaCaso = [1, 2, 3, 4, 5, 6].find((d) => !libres.has(d) && !libres.has(d + 1) && d + 1 < 7 && !(parcial && d % 2 === 1)) ?? 1;
    for (let d = 0; d < 7; d++) {
      if (libres.has(d)) continue;
      if (parcial && d % 2 === 1) continue; // media jornada: menos días
      const dia = sumarDias(lunes, d);
      const a = ausentes.get(e.i);
      if (a && a[0] <= dia && a[1] >= dia) continue;
      let turno = { ...base };
      // caso para el aviso de descanso: cierra a la 01:00 y al día siguiente entra a las 09:00
      if (e.i === 5 && d === diaCaso) turno = { ...TURNOS.T };
      if (e.i === 5 && d === diaCaso + 1) turno = { ...TURNOS.M };
      if (parcial) turno = { inicio: "19:00", fin: "23:00", pausa: 0 };
      // préstamo: un cocinero del obrador refuerza Vaca Ayala el sábado
      const centroTurno = e.i === 32 && d === 5 ? centro("VA-AYA") : e.centroId;
      if (e.i === 32 && d === 5) turno = { ...TURNOS.T };
      await prisma.asignacionTurno.create({
        data: { tenantId: t, centroId: centroTurno, empleadoId: e.id, fecha: aDia(dia), inicio: turno.inicio, fin: turno.fin, inicio2: turno.inicio2 ?? null, fin2: turno.fin2 ?? null, pausaMinutos: turno.pausa },
      });

      // fichajes de los turnos empezados (los que están en curso, solo hasta ahora)
      const lim = limitesTurno(dia, turno);
      if (lim.inicio.getTime() > ahora) continue;
      if (e.i === 14 && d === diaCaso) continue; // no fichó: sale en «Sin fichar»
      const varia = () => Math.round((r() - 0.5) * 8) * 60_000; // ±4 min
      const retraso = e.i === 10 && d === diaCaso ? 22 * 60_000 : 0;
      const marcas: { tipo: "ENTRADA" | "INICIO_PAUSA" | "FIN_PAUSA" | "SALIDA"; momento: Date }[] = [];
      marcas.push({ tipo: "ENTRADA", momento: new Date(lim.inicio.getTime() + varia() + retraso) });
      if (turno.inicio2 && turno.fin2) {
        marcas.push({ tipo: "INICIO_PAUSA", momento: new Date(instanteMadrid(dia, turno.fin).getTime() + varia()) });
        marcas.push({ tipo: "FIN_PAUSA", momento: new Date(instanteMadrid(dia, turno.inicio2).getTime() + varia()) });
      } else if (turno.pausa) {
        const mitad = lim.inicio.getTime() + (lim.fin.getTime() - lim.inicio.getTime()) / 2;
        marcas.push({ tipo: "INICIO_PAUSA", momento: new Date(mitad) });
        marcas.push({ tipo: "FIN_PAUSA", momento: new Date(mitad + turno.pausa * 60_000) });
      }
      // olvido de la salida (jornada incompleta) para un caso
      if (!(e.i === 22 && d === diaCaso)) marcas.push({ tipo: "SALIDA", momento: new Date(lim.fin.getTime() + varia() + (e.i === 1 && d === diaCaso ? 75 * 60_000 : 0)) });
      await prisma.fichaje.createMany({ data: marcas.filter((m) => m.momento.getTime() < ahora).map((m) => ({ tenantId: t, empleadoId: e.id, centroId: centroTurno, tipo: m.tipo, momento: m.momento, origen: "TABLETA" })) });
    }
  }
  await prisma.cuadranteSemana.create({ data: { tenantId: t, centroId: centro("VA-AYA"), lunes: aDia(lunes), estado: "PUBLICADO", publicadoEn: aDia(sumarDias(lunes, -3)) } });

  // ---------- Selección ----------
  const oferta1 = await prisma.ofertaEmpleo.create({
    data: { tenantId: t, centroId: centro("VA-IBI"), puestoId: puestos["Camarero/a"], titulo: "Camarero/a temporada 2027 · Vaca Ibiza", descripcion: "Temporada de abril a octubre. Experiencia en sala e inglés.", tipoContrato: "FIJO_DISCONTINUO", jornada: 40, plazas: 3 },
  });
  const oferta2 = await prisma.ofertaEmpleo.create({
    data: { tenantId: t, centroId: centro("OB"), puestoId: puestos["Cocinero/a de obrador"], titulo: "Cocinero/a de obrador (turno de mañana)", descripcion: "Producción de salsas, guarniciones y masas para los locales.", tipoContrato: "INDEFINIDO", jornada: 40, plazas: 1 },
  });
  const borrar = aDia(sumarDias(hoy, 365));
  await prisma.candidato.createMany({
    data: [
      { tenantId: t, ofertaId: oferta1.id, nombre: "Marina", apellidos: "Costa Planells", telefono: "+34611223344", email: "marina.costa@ejemplo.es", origen: "Web", estado: "ENTREVISTA", consentimientoEn: new Date(), borrarEn: borrar },
      { tenantId: t, ofertaId: oferta1.id, nombre: "Kevin", apellidos: "Walsh", telefono: "+34622334455", origen: "InfoJobs", estado: "RECIBIDO", consentimientoEn: new Date(), borrarEn: borrar },
      { tenantId: t, ofertaId: oferta1.id, nombre: "Aina", apellidos: "Ribas Ferrer", telefono: "+34633445566", origen: "Recomendación", estado: "OFERTA", consentimientoEn: new Date(), borrarEn: borrar },
      { tenantId: t, ofertaId: oferta2.id, nombre: "Rafael", apellidos: "Ortiz Luna", telefono: "+34644556677", email: "rafa.ortiz@ejemplo.es", origen: "Web", estado: "PRUEBA", consentimientoEn: new Date(), borrarEn: borrar },
      { tenantId: t, ofertaId: oferta2.id, nombre: "Silvia", apellidos: "Mena Pardo", telefono: "+34655667788", origen: "InfoJobs", estado: "DESCARTADO", borrarEn: aDia(sumarDias(hoy, 90)) },
      { tenantId: t, nombre: "Luis", apellidos: "Calvo Ramos", telefono: "+34666778899", origen: "Currículum en mano", notas: "Parrillero con experiencia, disponible fines de semana", estado: "RECIBIDO", consentimientoEn: new Date(), borrarEn: borrar },
      { tenantId: t, nombre: "Estefanía", apellidos: "Prado Gil", email: "estefania.prado@ejemplo.es", origen: "Web", notas: "Ayudante de cocina, busca jornada parcial", estado: "RECIBIDO", consentimientoEn: new Date(), borrarEn: borrar },
    ],
  });
};

export default sembrar;
