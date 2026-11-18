/**
 * Hueco de integración del TPV (Revo, Ágora, Last.app… o Chift): formato PROPIO del ERP para recibir
 * tickets. El futuro conector de cada TPV solo tiene que traducir lo suyo a este formato y llamar a
 * `importarVentasTpv` (src/modulos/caja/servicio.ts). Aún no hay ningún TPV conectado (P-03).
 *
 * Formato (JSON), documentado en docs/specs/modulos/caja/README.md §Importar ventas del TPV:
 * {
 *   "tickets": [{
 *     "id": "R-88231",                 // id del ticket en el TPV (no se importa dos veces)
 *     "numero": "88231",               // opcional: número que se enseña (si no, el id)
 *     "abierto": "2026-11-13T21:05:00+01:00",
 *     "cobrado": "2026-11-13T23:10:00+01:00",   // opcional
 *     "estado": "cobrado",             // cobrado | abierto | anulado
 *     "motivoAnulacion": "…",          // si está anulado
 *     "mesa": "12", "comensales": 4, "camarero": "Lucía",
 *     "lineas": [{
 *       "plato": "Entraña",            // nombre del plato en la carta (o "platoId")
 *       "formato": "Copa",             // opcional: nombre del formato (botella, copa, mágnum…)
 *       "cantidad": 2, "precio": 24.5, // precio unitario con IVA (si no viene, el de la carta)
 *       "descuento": 0, "invitacion": false,
 *       "anulada": false, "motivoAnulacion": null, "hora": "2026-11-13T21:20:00+01:00"
 *     }],
 *     "cobros": [{ "forma": "TARJETA", "importe": 98.0, "propina": 5 }]
 *   }]
 * }
 * Formas de cobro: EFECTIVO, TARJETA, BIZUM, VALE, CREDITO, OTRA.
 *
 * CSV sencillo (una fila por línea; separador «;»; decimales con coma o punto; primera fila de títulos):
 *   ticket;abierto;cobrado;mesa;comensales;camarero;plato;formato;cantidad;precio;descuento;invitacion;anulada;forma_pago;propina
 * Las filas con el mismo «ticket» forman un ticket; el cobro es el total de sus líneas con la forma de pago
 * y la propina de su primera fila. «invitacion» y «anulada»: sí/no (o 1/0). Fechas «AAAA-MM-DD HH:MM»
 * (hora de Madrid) o ISO.
 */
import { z } from "zod";
import { partesMadrid } from "@/kernel/fechas";

export const FORMAS_TPV = ["EFECTIVO", "TARJETA", "BIZUM", "VALE", "CREDITO", "OTRA"] as const;

const numeroLibre = z.preprocess((v) => (typeof v === "string" ? Number(v.trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) : v), z.number().finite());

export const LineaTpvEsquema = z.object({
  plato: z.string().trim().optional(),
  platoId: z.string().trim().optional(),
  formato: z.string().trim().optional().nullable(),
  cantidad: numeroLibre.refine((n) => n > 0, "La cantidad tiene que ser mayor que cero"),
  precio: numeroLibre.optional(),
  descuento: numeroLibre.optional(),
  invitacion: z.boolean().optional(),
  anulada: z.boolean().optional(),
  motivoAnulacion: z.string().optional().nullable(),
  hora: z.string().optional().nullable(),
});

export const TicketTpvEsquema = z.object({
  id: z.string().trim().min(1, "Cada ticket necesita su id del TPV"),
  numero: z.string().trim().optional(),
  abierto: z.string().min(1, "Falta la hora de apertura del ticket"),
  cobrado: z.string().optional().nullable(),
  estado: z.enum(["cobrado", "abierto", "anulado"]).default("cobrado"),
  motivoAnulacion: z.string().optional().nullable(),
  mesa: z.string().optional().nullable(),
  comensales: z.coerce.number().int().min(0).default(0),
  camarero: z.string().optional().nullable(),
  lineas: z.array(LineaTpvEsquema).min(1, "Un ticket sin líneas no se importa"),
  cobros: z.array(z.object({ forma: z.enum(FORMAS_TPV), importe: numeroLibre, propina: numeroLibre.optional() })).default([]),
});

export const ImportacionTpvEsquema = z.object({ tickets: z.array(TicketTpvEsquema).min(1, "No hay tickets que importar") });

export type LineaTpv = z.infer<typeof LineaTpvEsquema>;
export type TicketTpv = z.infer<typeof TicketTpvEsquema>;

/** «2026-11-13 21:05» (hora de Madrid) o ISO → instante. */
export function leerFechaTpv(texto: string): Date {
  const s = texto.trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    // hora de Madrid sin zona: se prueba con +01:00 y +02:00 y se queda la que da esa hora en Madrid
    for (const z of ["+01:00", "+02:00"]) {
      const d = new Date(`${m[1]}T${m[2].padStart(2, "0")}:${m[3]}:${m[4] ?? "00"}${z}`);
      if (Math.floor(partesMadrid(d).minutos / 60) === Number(m[2])) return d;
    }
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha no válida: «${texto}»`);
  return d;
}

const siNo = (v: string | undefined) => /^(s[ií]|1|true|x)$/i.test((v ?? "").trim());

/** Lee el CSV sencillo y lo convierte al formato propio (sin validar contra la carta). */
export function leerCsvTpv(texto: string): { tickets: TicketTpv[]; errores: string[] } {
  const filas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (filas.length < 2) return { tickets: [], errores: ["El archivo no tiene filas de datos."] };
  const sep = filas[0].includes(";") ? ";" : ",";
  const titulos = filas[0].split(sep).map((t) => t.trim().toLowerCase());
  const col = (fila: string[], nombre: string) => {
    const i = titulos.indexOf(nombre);
    return i >= 0 ? fila[i]?.trim() : undefined;
  };
  for (const obligatorio of ["ticket", "abierto", "plato", "cantidad"]) if (!titulos.includes(obligatorio)) return { tickets: [], errores: [`Falta la columna «${obligatorio}».`] };
  const errores: string[] = [];
  const porTicket = new Map<string, { cab: string[]; filas: string[][] }>();
  filas.slice(1).forEach((linea) => {
    const f = linea.split(sep);
    const id = col(f, "ticket");
    if (!id) return;
    const g = porTicket.get(id) ?? { cab: f, filas: [] };
    g.filas.push(f);
    porTicket.set(id, g);
  });
  const tickets: TicketTpv[] = [];
  for (const [id, g] of porTicket) {
    try {
      const lineas = g.filas.map((f) => ({
        plato: col(f, "plato"),
        formato: col(f, "formato") || null,
        cantidad: col(f, "cantidad"),
        precio: col(f, "precio") || undefined,
        descuento: col(f, "descuento") || undefined,
        invitacion: siNo(col(f, "invitacion")),
        anulada: siNo(col(f, "anulada")),
        motivoAnulacion: siNo(col(f, "anulada")) ? "Anulada en el TPV" : null,
      }));
      const forma = (col(g.cab, "forma_pago") || "TARJETA").toUpperCase();
      const propina = col(g.cab, "propina");
      tickets.push(
        TicketTpvEsquema.parse({
          id,
          abierto: col(g.cab, "abierto"),
          cobrado: col(g.cab, "cobrado") || null,
          estado: "cobrado",
          mesa: col(g.cab, "mesa") || null,
          comensales: col(g.cab, "comensales") || 0,
          camarero: col(g.cab, "camarero") || null,
          lineas,
          // el importe del cobro se completa al importar (total de las líneas con los precios de la carta)
          cobros: [{ forma, importe: -1, propina: propina || 0 }],
        }),
      );
    } catch (e) {
      errores.push(`Ticket ${id}: ${e instanceof z.ZodError ? (e.issues[0]?.message ?? "datos no válidos") : (e as Error).message}`);
    }
  }
  return { tickets, errores };
}
