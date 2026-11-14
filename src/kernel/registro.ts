/**
 * Registro de módulos: lee todos los manifiestos. El menú, la página de permisos y
 * la página de módulos contratados salen de aquí. Para añadir un módulo: crear
 * src/modulos/<id>/modulo.ts y añadirlo a esta lista.
 */
import type { ManifiestoModulo } from "./tipos-modulo";
import { modulo as organizacion } from "@/modulos/organizacion/modulo";
import { modulo as usuarios } from "@/modulos/usuarios/modulo";
import { modulo as proveedores } from "@/modulos/proveedores/modulo";
import { modulo as bebidas } from "@/modulos/bebidas/modulo";
import { modulo as comidas } from "@/modulos/comidas/modulo";
import { modulo as obrador } from "@/modulos/obrador/modulo";
import { modulo as caja } from "@/modulos/caja/modulo";
import { modulo as personal } from "@/modulos/personal/modulo";
import { modulo as contabilidad } from "@/modulos/contabilidad/modulo";
import { modulo as cuadro } from "@/modulos/cuadro/modulo";
import { modulo as calidad } from "@/modulos/calidad/modulo";
import { modulo as reservas } from "@/modulos/reservas/modulo";
import { modulo as eventos } from "@/modulos/eventos/modulo";
import { modulo as clientes } from "@/modulos/clientes/modulo";
import { modulo as webs } from "@/modulos/webs/modulo";

export const MODULOS: ManifiestoModulo[] = [
  organizacion,
  usuarios,
  proveedores,
  bebidas,
  comidas,
  obrador,
  caja,
  personal,
  contabilidad,
  cuadro,
  calidad,
  reservas,
  eventos,
  clientes,
  webs,
].sort((a, b) => a.orden - b.orden);

export function moduloPorId(id: string): ManifiestoModulo | undefined {
  return MODULOS.find((m) => m.id === id);
}
