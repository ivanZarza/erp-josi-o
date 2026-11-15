import { exigir } from "@/kernel/contexto";
import { euros, numero, numeroCampo } from "@/kernel/formato";
import { Cabecera, Boton, BotonEnlace, Campo, Entrada, AreaTexto, Etiqueta } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { presupuestosMes, mesValido, nombreMes, mesDesplazado, redondear } from "@/modulos/cuadro/servicio";
import { accionGuardarPresupuesto, accionCopiarPresupuesto } from "@/modulos/cuadro/acciones";
import { Avisos, param, type ParametrosBusqueda } from "../_comun";

/** Valor de la casilla: «12500,5», sin separador de miles (numeroCampo del núcleo). */
const campo = (v: { toString(): string } | null | undefined) => numeroCampo(v);

export default async function Presupuestos({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const ctx = await exigir("cuadro", "cuadro:ver");
  const sp = await searchParams;
  const mes = mesValido(param(sp, "mes"));
  const lista = await presupuestosMes(ctx, mes);
  const puedeEditar = ctx.puede("cuadro:presupuestos:editar");
  const totalVentas = redondear(lista.reduce((s, x) => s + Number(x.presupuesto?.ventas ?? 0), 0));
  const conPresupuesto = lista.filter((x) => x.presupuesto).length;

  return (
    <>
      <Cabecera
        titulo="Presupuestos"
        subtitulo={`${nombreMes(mes)}: lo que se espera vender y gastar en cada centro (sin IVA).`}
        acciones={
          <>
            <BotonEnlace variante="secundario" href={`/cuadro/presupuestos?mes=${mesDesplazado(mes, -1)}`}>
              Mes anterior
            </BotonEnlace>
            <BotonEnlace variante="secundario" href={`/cuadro/presupuestos?mes=${mesDesplazado(mes, 1)}`}>
              Mes siguiente
            </BotonEnlace>
            {puedeEditar && (
              <form action={accionCopiarPresupuesto}>
                <input type="hidden" name="mes" value={mes} />
                <Boton type="submit" variante="secundario">
                  Copiar del mes anterior
                </Boton>
              </form>
            )}
          </>
        }
      />
      <Avisos sp={sp} />
      <TablaDesplegable
        total={`${numero(conPresupuesto)} de ${numero(lista.length)} centros con presupuesto · ventas previstas ${euros(totalVentas)}`}
        vacio="No hay centros en tu selección."
        columnas={[{ titulo: "Centro" }, { titulo: "Ventas", alinear: "derecha" }, { titulo: "Mercancía", alinear: "derecha", secundaria: true }, { titulo: "Personal", alinear: "derecha", secundaria: true }, { titulo: "Gastos", alinear: "derecha", secundaria: true }, { titulo: "Estado" }]}
        filas={lista.map(({ centro, presupuesto: p }) => ({
          id: centro.id,
          tono: p ? undefined : ("aviso" as const),
          celdas: [
            centro.nombre,
            p ? euros(p.ventas) : "—",
            p?.mercancia != null ? euros(p.mercancia) : "—",
            p?.personal != null ? euros(p.personal) : "—",
            p?.gastos != null ? euros(p.gastos) : "—",
            <Etiqueta key="e" tono={p ? "ok" : "aviso"}>
              {p ? "Hecho" : "Sin presupuesto"}
            </Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Marca", valor: centro.marca?.nombre ?? "—" },
                  { etiqueta: "Sociedad", valor: centro.sociedad?.razonSocial ?? "—" },
                  { etiqueta: "Notas", valor: p?.notas ?? "—" },
                ]}
              />
              {puedeEditar && (
                <form action={accionGuardarPresupuesto} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <input type="hidden" name="centroId" value={centro.id} />
                  <input type="hidden" name="mes" value={mes} />
                  <Campo etiqueta="Ventas">
                    <Entrada name="ventas" required inputMode="decimal" className="text-right" defaultValue={campo(p?.ventas)} />
                  </Campo>
                  <Campo etiqueta="Mercancía">
                    <Entrada name="mercancia" inputMode="decimal" className="text-right" defaultValue={campo(p?.mercancia)} />
                  </Campo>
                  <Campo etiqueta="Personal">
                    <Entrada name="personal" inputMode="decimal" className="text-right" defaultValue={campo(p?.personal)} />
                  </Campo>
                  <Campo etiqueta="Gastos">
                    <Entrada name="gastos" inputMode="decimal" className="text-right" defaultValue={campo(p?.gastos)} />
                  </Campo>
                  <Campo etiqueta="Notas">
                    <AreaTexto name="notas" rows={1} defaultValue={p?.notas ?? ""} />
                  </Campo>
                  <div className="self-end">
                    <Boton type="submit">Guardar</Boton>
                  </div>
                </form>
              )}
            </div>
          ),
        }))}
      />
    </>
  );
}
