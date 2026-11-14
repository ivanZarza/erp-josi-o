import { exigir } from "@/kernel/contexto";
import { fechaHora } from "@/kernel/formato";
import { Boton, Cabecera, Etiqueta, Selector } from "@/ui";
import { DatosDetalle, TablaDesplegable } from "@/ui/tabla-desplegable";
import { AvisosPagina, param, type ParametrosPagina } from "@/modulos/organizacion/vistas";
import { listarAuditoria } from "@/modulos/usuarios/servicio";

/** Registro de cambios (tabla Auditoria): permisos, módulos, centros, dinero, stock… */
export default async function RegistroPagina({ searchParams }: { searchParams: ParametrosPagina }) {
  const ctx = await exigir("usuarios", "ajustes:registro:ver");
  const sp = await searchParams;
  const entidad = param(sp, "entidad");
  const { filas, entidades } = await listarAuditoria(ctx, { entidad, limite: 300 });
  const json = (v: unknown) => <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{v === null || v === undefined ? "—" : JSON.stringify(v, null, 2)}</pre>;

  return (
    <>
      <Cabecera titulo="Registro de cambios" subtitulo="Quién cambió qué y cuándo. Se muestran los 300 últimos." />
      <AvisosPagina sp={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <Selector name="entidad" defaultValue={entidad ?? ""} className="w-auto">
          <option value="">Todo</option>
          {entidades.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Selector>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>
      <TablaDesplegable
        columnas={[{ titulo: "Fecha" }, { titulo: "Qué" }, { titulo: "Acción" }, { titulo: "Quién" }, { titulo: "Referencia", secundaria: true }]}
        vacio="Todavía no hay cambios registrados."
        total={`${filas.length} cambios`}
        filas={filas.map((f) => ({
          id: f.id,
          celdas: [fechaHora(f.createdAt), f.entidad, <Etiqueta key="a">{f.accion}</Etiqueta>, f.usuario ?? "Sistema", <span key="r" className="text-xs text-suave">{f.entidadId}</span>],
          detalle: (
            <DatosDetalle
              columnas={2}
              datos={[
                { etiqueta: "Antes", valor: json(f.antes) },
                { etiqueta: "Después", valor: json(f.despues) },
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
