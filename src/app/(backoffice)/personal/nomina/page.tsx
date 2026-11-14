import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Boton, BotonEnlace, Campo, Selector, Entrada, Cifra, Rejilla, HuecoIntegracion, Aviso } from "@/ui";
import { costePersonal, variablesNomina, listarSociedades, mapaCentros, SEMANAS_EFECTIVAS } from "@/modulos/personal/servicio";
import { esMes, hoyMadrid, diasDelMes, mesSiguiente, nombreMes, NOMBRES_DIA, diaSemana } from "@/modulos/personal/fechas";
import { horasTexto, param, type Busqueda } from "../_componentes/comun";

export default async function CostesNomina({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:costes:ver");
  const sp = await searchParams;
  const mesP = param(sp, "mes");
  const mes = esMes(mesP) ? mesP : hoyMadrid().slice(0, 7);
  const sociedadId = param(sp, "sociedadId") ?? "";
  const dias = diasDelMes(mes);
  const exportar = ctx.puede("personal:nomina:exportar");
  const [costes, centros, sociedades, variables] = await Promise.all([
    costePersonal(ctx, dias[0], dias[dias.length - 1]),
    mapaCentros(ctx),
    listarSociedades(ctx),
    exportar ? variablesNomina(ctx, mes, sociedadId || undefined) : Promise.resolve([]),
  ]);

  // por centro (mes) y por día (todos los centros visibles)
  const porCentro = new Map<string, { horasP: number; costeP: number; horasR: number; costeR: number; sinCoste: number }>();
  const porDia = new Map<string, { horasP: number; costeP: number; horasR: number; costeR: number }>();
  for (const c of costes) {
    const x = porCentro.get(c.centroId) ?? { horasP: 0, costeP: 0, horasR: 0, costeR: 0, sinCoste: 0 };
    x.horasP += c.horasPrevistas; x.costeP += c.costePrevisto; x.horasR += c.horasReales; x.costeR += c.costeReal; x.sinCoste += c.sinCoste;
    porCentro.set(c.centroId, x);
    const d = porDia.get(c.dia) ?? { horasP: 0, costeP: 0, horasR: 0, costeR: 0 };
    d.horasP += c.horasPrevistas; d.costeP += c.costePrevisto; d.horasR += c.horasReales; d.costeR += c.costeReal;
    porDia.set(c.dia, d);
  }
  const total = Array.from(porCentro.values()).reduce((t, x) => ({ horasP: t.horasP + x.horasP, costeP: t.costeP + x.costeP, horasR: t.horasR + x.horasR, costeR: t.costeR + x.costeR, sinCoste: t.sinCoste + x.sinCoste }), { horasP: 0, costeP: 0, horasR: 0, costeR: 0, sinCoste: 0 });

  return (
    <>
      <Cabecera
        titulo="Costes de personal y nómina"
        subtitulo={`${ctx.centroActivo?.nombre ?? "Todos tus centros"} · ${nombreMes(mes)}`}
        acciones={
          <>
            <BotonEnlace href={`/personal/nomina?mes=${mesSiguiente(mes, -1)}`} variante="secundario">Mes anterior</BotonEnlace>
            <BotonEnlace href="/personal/nomina" variante="secundario">Este mes</BotonEnlace>
            <BotonEnlace href={`/personal/nomina?mes=${mesSiguiente(mes)}`} variante="secundario">Mes siguiente</BotonEnlace>
          </>
        }
      />
      <Rejilla columnas={4}>
        <Cifra etiqueta="Horas previstas" valor={horasTexto(total.horasP)} detalle="cuadrante" />
        <Cifra etiqueta="Coste previsto" valor={euros(total.costeP, 0)} />
        <Cifra etiqueta="Horas fichadas" valor={horasTexto(total.horasR)} />
        <Cifra etiqueta="Coste real" valor={euros(total.costeR, 0)} detalle={total.sinCoste ? `${horasTexto(total.sinCoste)} sin coste/hora` : "horas fichadas × coste/hora"} tono={total.sinCoste ? "aviso" : "normal"} />
      </Rejilla>
      <p className="mt-2 text-xs text-slate-500">
        Coste/hora: el indicado en el contrato o, si está vacío, salario bruto anual × (1 + % cotización) ÷ (jornada semanal × {numero(SEMANAS_EFECTIVAS, 1)} semanas). Los préstamos cuentan en el centro donde se trabaja.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Por centro">
          <Tabla
            filas={Array.from(porCentro.entries()).sort((a, b) => b[1].costeR - a[1].costeR)}
            clave={([id]) => id}
            vacio="Sin turnos ni fichajes este mes."
            columnas={[
              { titulo: "Centro", celda: ([id]) => centros.get(id)?.nombre ?? "—" },
              { titulo: "Horas previstas", celda: ([, x]) => horasTexto(x.horasP), alinear: "derecha" },
              { titulo: "Coste previsto", celda: ([, x]) => euros(x.costeP), alinear: "derecha" },
              { titulo: "Horas reales", celda: ([, x]) => horasTexto(x.horasR), alinear: "derecha" },
              { titulo: "Coste real", celda: ([, x]) => euros(x.costeR), alinear: "derecha" },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo="Por día">
          <Tabla
            filas={dias.filter((d) => porDia.has(d))}
            clave={(d) => d}
            vacio="Sin datos."
            columnas={[
              { titulo: "Día", celda: (d) => `${NOMBRES_DIA[diaSemana(d)]} ${fecha(d + "T12:00:00Z")}` },
              { titulo: "Horas previstas", celda: (d) => horasTexto(porDia.get(d)!.horasP), alinear: "derecha" },
              { titulo: "Coste previsto", celda: (d) => euros(porDia.get(d)!.costeP), alinear: "derecha" },
              { titulo: "Horas reales", celda: (d) => horasTexto(porDia.get(d)!.horasR), alinear: "derecha" },
              { titulo: "Coste real", celda: (d) => euros(porDia.get(d)!.costeR), alinear: "derecha" },
            ]}
          />
        </Tarjeta>
      </div>

      {exportar ? (
        <Tarjeta titulo="Exportación mensual para la gestoría" className="mt-6">
          <form className="mb-4 flex flex-wrap items-end gap-3">
            <Campo etiqueta="Mes">
              <Entrada type="month" name="mes" defaultValue={mes} />
            </Campo>
            <Campo etiqueta="Sociedad">
              <Selector name="sociedadId" defaultValue={sociedadId}>
                <option value="">Todas</option>
                {sociedades.map((s) => (
                  <option key={s.id} value={s.id}>{s.razonSocial}</option>
                ))}
              </Selector>
            </Campo>
            <Boton type="submit" variante="secundario">Ver</Boton>
            <BotonEnlace href={`/personal/nomina/exportar?mes=${mes}${sociedadId ? `&sociedadId=${sociedadId}` : ""}`}>Descargar CSV de horas</BotonEnlace>
          </form>
          <Tabla
            filas={variables}
            clave={(f) => f.codigo}
            vacio="Nadie en plantilla ese mes."
            columnas={[
              { titulo: "Sociedad", celda: (f) => f.sociedad },
              { titulo: "Empleado", celda: (f) => `${f.empleado} (${f.codigo})` },
              { titulo: "Centro", celda: (f) => f.centro },
              { titulo: "Contrato mes", celda: (f) => horasTexto(f.horasContrato), alinear: "derecha" },
              { titulo: "Fichadas", celda: (f) => horasTexto(f.horasReales), alinear: "derecha" },
              { titulo: "Extra", celda: (f) => (f.horasExtra ? horasTexto(f.horasExtra) : "—"), alinear: "derecha" },
              { titulo: "Ausencias", celda: (f) => Object.values(f.ausencias).reduce((t, n) => t + n, 0) || "—", alinear: "derecha" },
              { titulo: "Alta / baja", celda: (f) => [f.alta && `Alta ${fecha(f.alta + "T12:00:00Z")}`, f.baja && `Baja ${fecha(f.baja + "T12:00:00Z")}`].filter(Boolean).join(" · ") },
            ]}
          />
          <div className="mt-4">
            <HuecoIntegracion nombre="Gestoría (nóminas)" descripcion="El envío automático de las variables de nómina a la gestoría, en el formato de su programa, está pendiente (P-04). Por ahora, descarga el CSV y mándaselo" />
          </div>
        </Tarjeta>
      ) : (
        <div className="mt-6">
          <Aviso>La exportación a la gestoría necesita el permiso «Exportar las variables de nómina».</Aviso>
        </div>
      )}
    </>
  );
}
