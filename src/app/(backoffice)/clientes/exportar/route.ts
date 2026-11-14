import { exigir } from "@/kernel/contexto";
import { exportarClientesCsv } from "@/modulos/clientes/servicio";

/** Descarga de clientes en CSV (separador «;», para Excel en español). */
export async function GET() {
  const ctx = await exigir("clientes", "clientes:exportar");
  const csv = await exportarClientesCsv(ctx);
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
