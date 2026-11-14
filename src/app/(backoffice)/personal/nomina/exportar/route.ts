/**
 * Exportación mensual para la gestoría: CSV de horas y ausencias por sociedad.
 * GET /personal/nomina/exportar?mes=2026-11&sociedadId=…
 */
import { exigir } from "@/kernel/contexto";
import { variablesNomina, csvNomina } from "@/modulos/personal/servicio";
import { esquemaMes } from "@/modulos/personal/esquemas";

export async function GET(peticion: Request) {
  const ctx = await exigir("personal", "personal:nomina:exportar");
  const url = new URL(peticion.url);
  const r = esquemaMes.safeParse({ mes: url.searchParams.get("mes") ?? "", sociedadId: url.searchParams.get("sociedadId") ?? "" });
  if (!r.success) return new Response("Mes no válido", { status: 400 });
  const filas = await variablesNomina(ctx, r.data.mes, r.data.sociedadId);
  const nombre = `horas-${r.data.mes}${r.data.sociedadId ? "-" + (filas[0]?.cif || "sociedad") : ""}.csv`;
  return new Response(csvNomina(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
