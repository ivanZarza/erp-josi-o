import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, BotonEnlace, Pestanas, Aviso, Tabla, Vacio } from "@/ui";
import { detalleIndicador, mesValido, nombreMes, redondear, ErrorCuadro, type Indicador } from "@/modulos/cuadro/servicio";
import { param, type ParametrosBusqueda } from "../_comun";

const NOMBRE: Record<Indicador, string> = { ventas: "Ventas", mercancia: "Mercancía", gastos: "Gastos", personal: "Personal" };

export default async function DetalleIndicador({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("cuadro", "cuadro:ver");
  const sp = await searchParams;
  const mes = mesValido(param(sp, "mes"));
  const i = param(sp, "indicador");
  const indicador: Indicador = i === "mercancia" || i === "gastos" || i === "personal" ? i : "ventas";
  const centroId = param(sp, "centro") ?? "";
  let datos;
  try {
    datos = await detalleIndicador(ctx, indicador, centroId, mes);
  } catch (e) {
    if (e instanceof ErrorCuadro)
      return (
        <>
          <Cabecera titulo="Detalle" />
          <Aviso tono="error">{e.message}</Aviso>
        </>
      );
    throw e;
  }
  const { centro, filas, motivo, avisos, hastaDia } = datos;
  const suma = filas ? redondear(filas.reduce((s, f) => s + f.importe, 0)) : null;
  const base = `/cuadro/detalle?centro=${centroId}&mes=${mes}`;
  const enlaceModulo =
    indicador === "ventas" && ctx.tieneModulo("caja")
      ? "/caja"
      : indicador === "gastos" && ctx.tieneModulo("contabilidad")
        ? `/contabilidad/gastos?mes=${mes}`
        : indicador === "personal" && ctx.tieneModulo("personal") && ctx.puede("personal:nominas:ver")
          ? `/personal/nominas?mes=${mes}`
          : null;

  return (
    <>
      <Cabecera
        titulo={`${NOMBRE[indicador]} · ${centro.nombre}`}
        subtitulo={`${nombreMes(mes)}${hastaDia ? ` hasta ayer (${fecha(hastaDia)})` : ""} · ${[centro.marca?.nombre, centro.sociedad?.razonSocial].filter(Boolean).join(" · ")}. Fuente: ${motivo}.`}
        acciones={
          <>
            {enlaceModulo && (
              <BotonEnlace variante="secundario" href={enlaceModulo}>
                Abrir en su módulo
              </BotonEnlace>
            )}
            <BotonEnlace variante="secundario" href={`/cuadro?mes=${mes}`}>
              Volver al cuadro
            </BotonEnlace>
          </>
        }
      />
      <Pestanas
        activa={`${base}&indicador=${indicador}`}
        items={(["ventas", "mercancia", "gastos", "personal"] as Indicador[]).map((k) => ({ href: `${base}&indicador=${k}`, titulo: NOMBRE[k] }))}
      />
      {avisos && avisos.length > 0 && (
        <div className="mb-4">
          <Aviso tono="aviso">{avisos.join(" ")}</Aviso>
        </div>
      )}
      {filas === null ? (
        <Vacio>Sin datos: {motivo}.</Vacio>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
            {numero(filas.length)} apuntes · total {euros(suma)}
          </p>
          <Tabla
            clave={(f) => f.id}
            filas={filas}
            vacio="No hay apuntes en este mes."
            columnas={[
              { titulo: "Fecha", celda: (f) => fecha(f.fecha) },
              { titulo: "Documento", celda: (f) => f.documento },
              { titulo: "Concepto", celda: (f) => f.concepto },
              { titulo: indicador === "personal" ? "Coste" : "Importe sin IVA", celda: (f) => euros(f.importe), alinear: "derecha" },
            ]}
          />
        </>
      )}
    </>
  );
}
