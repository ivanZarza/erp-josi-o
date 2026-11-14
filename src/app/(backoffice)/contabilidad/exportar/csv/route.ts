/** Descarga del CSV para la gestoría: /contabilidad/exportar/csv?sociedad=<id>&mes=AAAA-MM */
import { NextResponse, type NextRequest } from "next/server";
import { exigir } from "@/kernel/contexto";
import { exportarMesCsv, ErrorContable, rangoMes, centrosDeSociedad } from "@/modulos/contabilidad/servicio";
import { ExportarEsquema } from "@/modulos/contabilidad/esquemas";
import { ventasPorCentroYDia } from "@/modulos/caja/servicio";

export async function GET(peticion: NextRequest) {
  const ctx = await exigir("contabilidad", "contabilidad:exportar");
  const p = ExportarEsquema.safeParse({ sociedadId: peticion.nextUrl.searchParams.get("sociedad"), mes: peticion.nextUrl.searchParams.get("mes") });
  if (!p.success) return NextResponse.redirect(new URL(`/contabilidad/exportar?error=${encodeURIComponent(p.error.issues[0]?.message ?? "Datos no válidos")}`, peticion.url));
  try {
    let ventas;
    if (ctx.tieneModulo("caja")) {
      // ventas diarias de los centros de esa sociedad que ve el usuario
      const r = rangoMes(p.data.mes);
      ventas = await ventasPorCentroYDia(ctx.tenant.id, await centrosDeSociedad(ctx, p.data.sociedadId), r.desde, r.hasta);
    }
    const { nombre, contenido } = await exportarMesCsv(ctx, p.data.sociedadId, p.data.mes, ventas);
    return new NextResponse(contenido, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ErrorContable) return NextResponse.redirect(new URL(`/contabilidad/exportar?error=${encodeURIComponent(e.message)}`, peticion.url));
    throw e;
  }
}
