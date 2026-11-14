import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, numero } from "@/kernel/formato";
import { BotonEnlace, Cabecera } from "@/ui";
import { nombreAlergeno } from "@/modulos/comidas/carta-alergenos";
import { lotePorId } from "@/modulos/obrador/servicio";
import { unidad } from "../../../_comun";
import { BotonImprimir } from "./imprimir";

/** Etiqueta del lote: producto, lote, elaboración, caducidad, alérgenos y conservación. */
export default async function EtiquetaLote({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigir("obrador", "obrador:etiquetas:imprimir");
  const { id } = await params;
  const datos = await lotePorId(ctx, id);
  if (!datos) notFound();
  const { lote, producto, centro } = datos;

  return (
    <>
      {/* Al imprimir solo sale la etiqueta */}
      <style>{`@media print { body * { visibility: hidden !important; } .etiqueta-lote, .etiqueta-lote * { visibility: visible !important; } .etiqueta-lote { position: absolute; left: 0; top: 0; border: none !important; } @page { size: 100mm 70mm; margin: 4mm; } }`}</style>
      <Cabecera
        titulo={`Etiqueta del lote ${lote.codigo}`}
        subtitulo="Tamaño pensado para etiqueta adhesiva de 100 × 70 mm."
        acciones={
          <>
            <BotonEnlace href="/obrador/lotes?estado=TODOS" variante="secundario">
              Volver a lotes
            </BotonEnlace>
            <BotonImprimir />
          </>
        }
      />
      <div className="etiqueta-lote w-[100mm] rounded border-2 border-black bg-white p-3 font-sans text-black">
        <div className="text-lg font-bold leading-tight">{producto?.nombre ?? "—"}</div>
        <div className="text-xs">
          Ref. {producto?.referencia} · {numero(Number(lote.cantidad))} {unidad(producto?.unidad ?? "UD")}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <div>
            <div className="text-[10px] uppercase">Lote</div>
            <div className="font-bold">{lote.codigo}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase">Elaboración</div>
            <div className="font-bold">{fechaHora(lote.elaboradoEn)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase">Consumir antes de</div>
            <div className="text-xl font-bold">{fecha(lote.caducaEn)}</div>
          </div>
        </div>
        <div className="mt-2 text-xs">
          <span className="font-bold">Alérgenos: </span>
          {lote.alergenos.length ? lote.alergenos.map((a) => nombreAlergeno(a).toUpperCase()).join(", ") : "sin alérgenos declarados"}
        </div>
        <div className="mt-1 text-xs">
          <span className="font-bold">Conservación: </span>
          {lote.conservacion ?? "—"}
        </div>
        <div className="mt-2 border-t border-black pt-1 text-[10px]">
          {datos.tenant} · {centro?.nombre}
          {centro?.edificio ? ` · ${centro.edificio.direccion}, ${centro.edificio.ciudad}` : ""}
        </div>
      </div>
      {lote.estado === "RETIRADO" && <p className="mt-4 text-sm font-semibold text-red-600">Este lote está RETIRADO: no lo etiquetes ni lo sirvas.</p>}
    </>
  );
}
