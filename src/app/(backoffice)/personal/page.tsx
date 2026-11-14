import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { fecha } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Tarjeta, Tabla, Etiqueta, BotonEnlace, Vacio } from "@/ui";
import { resumenPersonal, mapaCentros, nombreCompleto } from "@/modulos/personal/servicio";
import { nombreMes } from "@/modulos/personal/fechas";
import { nombreAusencia } from "./_componentes/comun";

export default async function ResumenPersonal() {
  const ctx = await exigir("personal", "personal:plantilla:ver");
  const [r, centros] = await Promise.all([resumenPersonal(ctx), mapaCentros(ctx)]);
  const errores = r.avisos.filter((a) => a.tono === "error");
  const vencen = r.avisos.filter((a) => a.tipo === "CONTRATO_VENCE" || a.tipo === "CONTRATO_VENCIDO" || a.tipo === "PERIODO_PRUEBA");
  const certificados = r.avisos.filter((a) => a.tipo.startsWith("CERTIFICADO") || a.tipo === "DOCUMENTO_CADUCA");

  return (
    <>
      <Cabecera
        titulo="Personal"
        subtitulo={`${ctx.centroActivo ? ctx.centroActivo.nombre : "Todos tus centros"} · ${nombreMes(r.mes)}`}
        acciones={
          ctx.puede("personal:plantilla:editar") ? (
            <>
              <BotonEnlace href="/personal/empleados/nuevo">Alta de empleado</BotonEnlace>
              <BotonEnlace href="/personal/cuadrantes" variante="secundario">
                Cuadrante
              </BotonEnlace>
            </>
          ) : undefined
        }
      />
      <Rejilla columnas={4}>
        <Cifra etiqueta="Plantilla activa" valor={r.activos} detalle={`${r.turnosHoy} turnos hoy`} href="/personal/empleados" />
        <Cifra etiqueta="Altas y bajas del mes" valor={`${r.altas.length} / ${r.bajas.length}`} detalle="altas / bajas" />
        <Cifra etiqueta="Ausentes hoy" valor={r.ausenciasHoy.length} detalle={`${r.pendientes} peticiones por aprobar`} tono={r.pendientes ? "aviso" : "normal"} href="/personal/ausencias" />
        <Cifra etiqueta="Avisos" valor={r.avisos.length} detalle={`${errores.length} urgentes`} tono={errores.length ? "error" : r.avisos.length ? "aviso" : "ok"} />
      </Rejilla>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Contratos que vencen (30 días) y periodos de prueba">
          <Tabla
            filas={vencen}
            clave={(a) => `${a.empleadoId}-${a.tipo}-${a.fecha?.toISOString()}`}
            vacio="Ningún contrato vence en los próximos 30 días."
            columnas={[
              { titulo: "Empleado", celda: (a) => <Link className="text-acento hover:underline" href={`/personal/empleados/${a.empleadoId}?pestana=contratos`}>{a.empleado}</Link> },
              { titulo: "Centro", celda: (a) => centros.get(a.centroId)?.nombre ?? "—" },
              { titulo: "Aviso", celda: (a) => <Etiqueta tono={a.tono}>{a.texto}</Etiqueta> },
              { titulo: "Fecha", celda: (a) => fecha(a.fecha), alinear: "derecha" },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo="Certificados y documentos caducados o por caducar">
          <Tabla
            filas={certificados}
            clave={(a) => `${a.empleadoId}-${a.texto}`}
            vacio="Todos los certificados están en vigor."
            columnas={[
              { titulo: "Empleado", celda: (a) => <Link className="text-acento hover:underline" href={`/personal/empleados/${a.empleadoId}?pestana=formacion`}>{a.empleado}</Link> },
              { titulo: "Centro", celda: (a) => centros.get(a.centroId)?.nombre ?? "—" },
              { titulo: "Aviso", celda: (a) => <Etiqueta tono={a.tono}>{a.texto}</Etiqueta> },
              { titulo: "Fecha", celda: (a) => fecha(a.fecha), alinear: "derecha" },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo="Ausencias de hoy">
          <Tabla
            filas={r.ausenciasHoy}
            clave={(a) => a.id}
            vacio="Hoy no falta nadie."
            columnas={[
              { titulo: "Empleado", celda: (a) => nombreCompleto(a.empleado) },
              { titulo: "Puesto", celda: (a) => a.empleado.puesto?.nombre ?? "—" },
              { titulo: "Motivo", celda: (a) => nombreAusencia(a.tipo) },
              { titulo: "Vuelve", celda: (a) => fecha(new Date(a.hasta.getTime() + 86_400_000)), alinear: "derecha" },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo="Altas y bajas del mes">
          {r.altas.length + r.bajas.length === 0 ? (
            <Vacio>No hay altas ni bajas este mes.</Vacio>
          ) : (
            <Tabla
              filas={[...r.altas.map((e) => ({ e, tipo: "Alta" as const, f: e.fechaAlta })), ...r.bajas.map((e) => ({ e, tipo: "Baja" as const, f: e.fechaBaja }))]}
              clave={(x) => `${x.tipo}-${x.e.id}`}
              columnas={[
                { titulo: "Empleado", celda: (x) => <Link className="text-acento hover:underline" href={`/personal/empleados/${x.e.id}`}>{nombreCompleto(x.e)}</Link> },
                { titulo: "Puesto", celda: (x) => x.e.puesto?.nombre ?? "—" },
                { titulo: "Centro", celda: (x) => centros.get(x.e.centroPrincipalId)?.nombre ?? "—" },
                { titulo: "Movimiento", celda: (x) => <Etiqueta tono={x.tipo === "Alta" ? "ok" : "normal"}>{x.tipo}</Etiqueta> },
                { titulo: "Fecha", celda: (x) => fecha(x.f), alinear: "derecha" },
              ]}
            />
          )}
        </Tarjeta>
      </div>
    </>
  );
}
