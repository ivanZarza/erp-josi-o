import Link from "next/link";
import { exigir } from "@/kernel/contexto";
import { euros, fecha, numero, porcentaje, aNumero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Tabla, Boton, BotonEnlace, Campo, Selector, Entrada, Cifra, Rejilla, Etiqueta, Aviso, HuecoIntegracion } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import * as s from "@/modulos/personal/servicio";
import { calcularNominasAccion, estadoNominasAccion } from "@/modulos/personal/acciones";
import { NOMBRE_ESTADO_NOMINA } from "@/modulos/personal/esquemas";
import { TIPOS_NOMINA } from "@/modulos/personal/nominas";
import { esMes, hoyMadrid, mesSiguiente, nombreMes } from "@/modulos/personal/fechas";
import { EtiquetaContrato, Mensajes, Volver, Acciones, horasTexto, param, type Busqueda } from "../_componentes/comun";

type Linea = s.NominaListado["lineas"][number];

function EtiquetaNomina({ estado }: { estado: string }) {
  const tono = estado === "PAGADA" ? "ok" : estado === "CERRADA" ? "info" : "aviso";
  return <Etiqueta tono={tono}>{NOMBRE_ESTADO_NOMINA[estado as keyof typeof NOMBRE_ESTADO_NOMINA] ?? estado}</Etiqueta>;
}

/** Tabla de conceptos de un tipo (devengos, deducciones o empresa) con su total. */
function Conceptos({ titulo, lineas, total }: { titulo: string; lineas: Linea[]; total: number }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h4>
      <Tabla
        filas={[...lineas, null]}
        clave={(l) => l?.id ?? "total"}
        vacio="Sin conceptos."
        columnas={[
          { titulo: "Concepto", celda: (l) => (l ? l.nombre : <strong>Total</strong>) },
          { titulo: "Cantidad", celda: (l) => (l?.cantidad != null ? numero(l.cantidad) : ""), alinear: "derecha" },
          { titulo: "Precio / base", celda: (l) => (l?.precio != null ? euros(l.precio) : l?.base != null ? euros(l.base) : ""), alinear: "derecha" },
          { titulo: "%", celda: (l) => (l?.porcentaje != null ? porcentaje(l.porcentaje, 2) : ""), alinear: "derecha" },
          { titulo: "Importe", celda: (l) => (l ? euros(l.importe) : <strong>{euros(total)}</strong>), alinear: "derecha" },
        ]}
      />
    </div>
  );
}

const enmascarar = (iban: string | null) => (iban ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : null);

export default async function Nominas({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("personal", "personal:nominas:ver");
  const sp = await searchParams;
  const gestionar = ctx.puede("personal:nominas:gestionar");
  const meses = await s.mesesConNominas(ctx);
  const mesP = param(sp, "mes");
  const mes = esMes(mesP) ? mesP : (meses[0] ?? mesSiguiente(hoyMadrid().slice(0, 7), -1));
  const centroP = param(sp, "centroId") ?? ctx.centroActivo?.id ?? "";
  const centroId = ctx.centros.some((c) => c.id === centroP) ? centroP : "";
  const estado = param(sp, "estado") ?? "";
  const volver = `/personal/nominas?mes=${mes}${centroId ? `&centroId=${centroId}` : ""}${estado ? `&estado=${estado}` : ""}`;

  const [todas, centros] = await Promise.all([s.listarNominas(ctx, { mes, centroId: centroId || undefined }), s.mapaCentros(ctx)]);
  const nominas = estado ? todas.filter((n) => n.estado === estado) : todas;

  // totales por centro (de todas las del mes, sin el filtro de estado)
  const porCentro = new Map<string, { personas: number; bruto: number; ssEmpresa: number; ssTrabajador: number; irpf: number; neto: number; coste: number; estados: Set<string> }>();
  for (const n of todas) {
    const x = porCentro.get(n.centroId) ?? { personas: 0, bruto: 0, ssEmpresa: 0, ssTrabajador: 0, irpf: 0, neto: 0, coste: 0, estados: new Set<string>() };
    x.personas++;
    x.bruto += aNumero(n.devengado);
    x.ssEmpresa += aNumero(n.ssEmpresa);
    x.ssTrabajador += aNumero(n.ssTrabajador);
    x.irpf += aNumero(n.irpf);
    x.neto += aNumero(n.neto);
    x.coste += aNumero(n.costeEmpresa);
    x.estados.add(n.estado);
    porCentro.set(n.centroId, x);
  }
  const total = Array.from(porCentro.values()).reduce((t, x) => ({ bruto: t.bruto + x.bruto, neto: t.neto + x.neto, coste: t.coste + x.coste, ssEmpresa: t.ssEmpresa + x.ssEmpresa }), { bruto: 0, neto: 0, coste: 0, ssEmpresa: 0 });
  const borradores = todas.filter((n) => n.estado === "BORRADOR").length;
  const cerradas = todas.filter((n) => n.estado === "CERRADA").length;
  const horasExtra = todas.reduce((t, n) => t + aNumero(n.horasExtra), 0);
  const enlace = (m: string) => `/personal/nominas?mes=${m}${centroId ? `&centroId=${centroId}` : ""}`;

  return (
    <>
      <Cabecera
        titulo="Nóminas"
        subtitulo={`${centroId ? (centros.get(centroId)?.nombre ?? "") : "Todos tus centros"} · ${nombreMes(mes)}`}
        acciones={
          <>
            <BotonEnlace href={enlace(mesSiguiente(mes, -1))} variante="secundario">Mes anterior</BotonEnlace>
            <BotonEnlace href={enlace(mesSiguiente(mes))} variante="secundario">Mes siguiente</BotonEnlace>
          </>
        }
      />
      <Mensajes sp={sp} />
      <Rejilla columnas={4}>
        <Cifra etiqueta="Nóminas" valor={todas.length} detalle={borradores ? `${borradores} en borrador` : cerradas ? `${cerradas} pendientes de pago` : todas.length ? "todas pagadas" : "sin calcular"} tono={borradores ? "aviso" : "normal"} />
        <Cifra etiqueta="Bruto (devengado)" valor={euros(total.bruto, 0)} detalle={horasExtra ? `incluye ${horasTexto(horasExtra)} extra` : undefined} />
        <Cifra etiqueta="Neto a pagar" valor={euros(total.neto, 0)} />
        <Cifra etiqueta="Coste empresa" valor={euros(total.coste, 0)} detalle={`Seguridad Social empresa ${euros(total.ssEmpresa, 0)}`} />
      </Rejilla>

      <form className="my-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Mes">
          <Entrada type="month" name="mes" defaultValue={mes} />
        </Campo>
        <Campo etiqueta="Centro">
          <Selector name="centroId" defaultValue={centroId}>
            <option value="">Todos mis centros</option>
            {ctx.centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Estado">
          <Selector name="estado" defaultValue={estado}>
            <option value="">Todos</option>
            <option value="BORRADOR">Borrador</option>
            <option value="CERRADA">Cerrada</option>
            <option value="PAGADA">Pagada</option>
          </Selector>
        </Campo>
        <Boton type="submit" variante="secundario">Ver</Boton>
        {meses.length > 0 && (
          <span className="text-xs text-slate-500">
            Meses con nóminas:{" "}
            {meses.slice(0, 6).map((m, i) => (
              <span key={m}>
                {i > 0 && " · "}
                <Link href={enlace(m)} className="text-acento hover:underline">{nombreMes(m)}</Link>
              </span>
            ))}
          </span>
        )}
      </form>

      <Tarjeta titulo="Totales por centro" className="mb-4">
        <Tabla
          filas={Array.from(porCentro.entries()).sort((a, b) => b[1].coste - a[1].coste)}
          clave={([id]) => id}
          vacio="No hay nóminas de este mes. Calcúlalas con el botón de abajo."
          columnas={[
            { titulo: "Centro", celda: ([id]) => centros.get(id)?.nombre ?? "—" },
            { titulo: "Personas", celda: ([, x]) => x.personas, alinear: "derecha" },
            { titulo: "Bruto", celda: ([, x]) => euros(x.bruto), alinear: "derecha" },
            { titulo: "SS trabajador", celda: ([, x]) => euros(x.ssTrabajador), alinear: "derecha" },
            { titulo: "IRPF", celda: ([, x]) => euros(x.irpf), alinear: "derecha" },
            { titulo: "Neto", celda: ([, x]) => euros(x.neto), alinear: "derecha" },
            { titulo: "SS empresa", celda: ([, x]) => euros(x.ssEmpresa), alinear: "derecha" },
            { titulo: "Coste empresa", celda: ([, x]) => <strong>{euros(x.coste)}</strong>, alinear: "derecha" },
            { titulo: "Estado", celda: ([, x]) => Array.from(x.estados).map((e) => <EtiquetaNomina key={e} estado={e} />) },
          ]}
        />
      </Tarjeta>

      {gestionar && (
        <Tarjeta titulo="Calcular y cerrar" className="mb-4">
          <div className="flex flex-wrap items-end gap-6">
            <form action={calcularNominasAccion} className="flex flex-wrap items-end gap-3">
              <Volver a={volver} />
              <input type="hidden" name="mes" value={mes} />
              {centroId && <input type="hidden" name="centroId" value={centroId} />}
              <Boton type="submit" variante="secundario">Calcular borradores de {nombreMes(mes)}</Boton>
            </form>
            {borradores > 0 && (
              <form action={estadoNominasAccion}>
                <Volver a={volver} />
                <input type="hidden" name="mes" value={mes} />
                <input type="hidden" name="a" value="CERRADA" />
                {centroId && <input type="hidden" name="centroId" value={centroId} />}
                <Boton type="submit">Cerrar {borradores} borradores</Boton>
              </form>
            )}
            {cerradas > 0 && (
              <form action={estadoNominasAccion} className="flex flex-wrap items-end gap-3">
                <Volver a={volver} />
                <input type="hidden" name="mes" value={mes} />
                <input type="hidden" name="a" value="PAGADA" />
                {centroId && <input type="hidden" name="centroId" value={centroId} />}
                <Campo etiqueta="Fecha de pago">
                  <Entrada type="date" name="fechaPago" defaultValue={hoyMadrid()} />
                </Campo>
                <Boton type="submit">Marcar {cerradas} como pagadas</Boton>
              </form>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Calcular rehace solo los borradores (las cerradas y pagadas no se tocan). Toma el contrato en vigor, sus complementos, las horas extra de los fichajes (lo que pasa del turno del cuadrante en más de {TIPOS_NOMINA.toleranciaExtraMinutos} min) y las bajas y ausencias sin sueldo aprobadas.
          </p>
        </Tarjeta>
      )}

      <TablaDesplegable
        columnas={[
          { titulo: "Empleado" },
          { titulo: "Puesto", secundaria: true },
          { titulo: "Centro", secundaria: true },
          { titulo: "Días", alinear: "derecha" },
          { titulo: "Bruto", alinear: "derecha" },
          { titulo: "Neto", alinear: "derecha" },
          { titulo: "Coste empresa", alinear: "derecha" },
          { titulo: "Estado" },
        ]}
        total={`${nominas.length} nóminas de ${nombreMes(mes)}`}
        vacio={gestionar ? "No hay nóminas con este filtro. Usa «Calcular borradores» para crearlas." : "No hay nóminas con este filtro."}
        filas={nominas.map((n) => {
          const dev = n.lineas.filter((l) => l.tipo === "DEVENGO");
          const ded = n.lineas.filter((l) => l.tipo === "DEDUCCION");
          const emp = n.lineas.filter((l) => l.tipo === "EMPRESA");
          return {
            id: n.id,
            tono: n.estado === "BORRADOR" ? "aviso" : undefined,
            celdas: [
              <Link key="n" href={`/personal/empleados/${n.empleadoId}`} className="font-medium text-acento hover:underline">
                {s.nombreCompleto(n.empleado)}
              </Link>,
              n.puesto ?? "—",
              centros.get(n.centroId)?.nombre ?? "—",
              <span key="d">
                {n.diasCotizados}
                {n.diasIT > 0 && <span className="ml-1 text-xs text-red-700">({n.diasIT} IT)</span>}
              </span>,
              euros(n.devengado),
              euros(n.neto),
              euros(n.costeEmpresa),
              <EtiquetaNomina key="e" estado={n.estado} />,
            ],
            detalle: (
              <>
                <DatosDetalle
                  datos={[
                    { etiqueta: "Código / DNI", valor: `${n.empleado.codigo} · ${n.empleado.dni ?? "sin DNI"}` },
                    { etiqueta: "N.º Seguridad Social", valor: n.empleado.nss },
                    { etiqueta: "Contrato", valor: <><EtiquetaContrato tipo={n.tipoContrato} /> {numero(n.jornadaSemanal)} h/semana</> },
                    { etiqueta: "Categoría", valor: n.categoria },
                    { etiqueta: "Periodo", valor: `${fecha(n.desde)} – ${fecha(n.hasta)}` },
                    { etiqueta: "Días", valor: `${n.diasCotizados} cotizados${n.diasIT ? ` · ${n.diasIT} de baja (IT)` : ""}${n.diasSinSueldo ? ` · ${n.diasSinSueldo} sin sueldo` : ""}` },
                    { etiqueta: "Horas fichadas", valor: horasTexto(aNumero(n.horasTrabajadas)) },
                    { etiqueta: n.tipoContrato === "PARCIAL" ? "Horas complementarias" : "Horas extra", valor: aNumero(n.horasExtra) ? horasTexto(aNumero(n.horasExtra)) : "—" },
                    { etiqueta: "Base contingencias comunes", valor: euros(n.baseCotizacion) },
                    { etiqueta: "Base profesionales", valor: euros(n.baseProfesionales) },
                    { etiqueta: "Retención IRPF", valor: `${porcentaje(n.irpfPorcentaje, 2)} · ${euros(n.irpf)}` },
                    { etiqueta: "Pago delegado IT", valor: aNumero(n.pagoDelegadoIT) ? `${euros(n.pagoDelegadoIT)} (se descuenta de los seguros sociales)` : "—" },
                    { etiqueta: "Cuenta de cobro", valor: enmascarar(n.empleado.iban) ?? "Sin IBAN" },
                    { etiqueta: "Pago", valor: n.fechaPago ? `Pagada el ${fecha(n.fechaPago)}` : n.estado === "CERRADA" ? "Pendiente de pago" : "—" },
                    { etiqueta: "Calculada", valor: fecha(n.calculadaEn) },
                    { etiqueta: "Cerrada", valor: n.cerradaEn ? fecha(n.cerradaEn) : "—" },
                  ]}
                />
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <Conceptos titulo="Devengos" lineas={dev} total={aNumero(n.devengado)} />
                  <Conceptos titulo="Deducciones" lineas={ded} total={aNumero(n.ssTrabajador) + aNumero(n.irpf) + aNumero(n.otrasDeducciones)} />
                  <Conceptos titulo="Aportación de la empresa" lineas={emp} total={aNumero(n.ssEmpresa)} />
                </div>
                <p className="mt-3 text-sm">
                  Líquido a percibir: <strong>{euros(n.neto)}</strong> · Coste total empresa: <strong>{euros(n.costeEmpresa)}</strong>
                </p>
                {gestionar && n.estado !== "PAGADA" && (
                  <Acciones>
                    <form action={estadoNominasAccion} className="flex flex-wrap items-end gap-3">
                      <Volver a={volver} />
                      <input type="hidden" name="mes" value={mes} />
                      <input type="hidden" name="ids" value={n.id} />
                      <input type="hidden" name="a" value={n.estado === "BORRADOR" ? "CERRADA" : "PAGADA"} />
                      {n.estado === "CERRADA" && (
                        <Campo etiqueta="Fecha de pago">
                          <Entrada type="date" name="fechaPago" defaultValue={hoyMadrid()} />
                        </Campo>
                      )}
                      <Boton type="submit" variante="secundario">{n.estado === "BORRADOR" ? "Cerrar esta nómina" : "Marcar como pagada"}</Boton>
                    </form>
                  </Acciones>
                )}
              </>
            ),
          };
        })}
      />

      <div className="mt-6 space-y-3">
        <Aviso tono="aviso" titulo="Cálculo de ejemplo">
          Los porcentajes de Seguridad Social, la retención de IRPF, el recargo de las horas extra ({numero(TIPOS_NOMINA.recargoHorasExtra)}) y la incapacidad temporal son de ejemplo y hay que comprobarlos con la gestoría. La nómina oficial la hace la gestoría; esta sirve para conocer y revisar el coste de personal por centro y mes.
        </Aviso>
        <HuecoIntegracion nombre="Gestoría (nóminas)" descripcion="Importar los recibos oficiales que haga la gestoría y comparar con este cálculo; publicarlos en el portal del empleado. Pendiente (P-04)" />
      </div>
    </>
  );
}
