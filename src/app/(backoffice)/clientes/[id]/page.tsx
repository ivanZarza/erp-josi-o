import { notFound } from "next/navigation";
import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, euros, numero } from "@/kernel/formato";
import { Cabecera, Tarjeta, Cifra, Rejilla, Boton, BotonEnlace, Etiqueta, Tabla, Aviso } from "@/ui";
import { fichaCliente } from "@/modulos/clientes/servicio";
import { actualizarClienteAccion, cambiarConsentimientoAccion, suprimirClienteAccion } from "@/modulos/clientes/acciones";
import { FormularioCliente } from "@/modulos/clientes/formulario-cliente";
import { AvisosUrl, EtiquetaConsentimiento, Estrellas, type Busqueda } from "@/modulos/clientes/ui";

const TIPOS = [
  { tipo: "RESERVA", nombre: "Datos para gestionar reservas" },
  { tipo: "CORREO", nombre: "Ofertas por correo" },
  { tipo: "WHATSAPP", nombre: "Ofertas por WhatsApp" },
] as const;

export default async function FichaCliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Busqueda }) {
  const ctx = await exigir("clientes", "clientes:ver");
  const { id } = await params;
  const sp = await searchParams;
  const c = await fichaCliente(ctx, id);
  if (!c) notFound();
  const puede = ctx.puede("clientes:editar") && c.activo;
  const gasto = c.visitasLista.reduce((a, v) => a + Number(v.importe ?? 0), 0);
  const locales = new Set(c.visitasLista.map((v) => v.centroId)).size;
  const notas = c.encuestas.filter((e) => e.nota !== null);
  const media = notas.length ? notas.reduce((a, e) => a + (e.nota ?? 0), 0) / notas.length : null;

  return (
    <>
      <Cabecera
        titulo={`${c.nombre} ${c.apellidos ?? ""}`}
        subtitulo={[c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
        acciones={<BotonEnlace variante="secundario" href="/clientes">Volver</BotonEnlace>}
      />
      <AvisosUrl sp={sp} />
      {!c.activo && <div className="mb-4"><Aviso tono="aviso">Este cliente pidió la supresión de sus datos. Solo se conserva la historia anónima.</Aviso></div>}
      {c.alergias && <div className="mb-4"><Aviso tono="error" titulo="Alergias">{c.alergias}</Aviso></div>}

      <div className="mb-6">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Visitas" valor={numero(c.visitas)} detalle={`en ${numero(locales)} locales`} />
          <Cifra etiqueta="Última visita" valor={fecha(c.ultimaVisita)} />
          <Cifra etiqueta="Gasto registrado" valor={euros(gasto)} detalle="cuando el TPV lo dé" />
          <Cifra etiqueta="Nota media" valor={media === null ? "—" : `${numero(media, 1)} / 5`} tono={media === null ? "normal" : media >= 4 ? "ok" : media <= 2 ? "error" : "aviso"} />
        </Rejilla>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Tarjeta titulo="Datos" acciones={<span className="flex gap-1">{c.etiquetas.map((e) => <Etiqueta key={e} tono={e === "VIP" ? "info" : "normal"}>{e}</Etiqueta>)}</span>}>
            {puede ? (
              <FormularioCliente accion={actualizarClienteAccion} v={c} boton="Guardar cambios" />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-suave">Preferencias</dt><dd>{c.preferencias ?? "—"}</dd></div>
                <div><dt className="text-suave">Notas</dt><dd>{c.notas ?? "—"}</dd></div>
              </dl>
            )}
          </Tarjeta>

          <Tarjeta titulo="Visitas">
            <Tabla
              clave={(v) => v.id}
              filas={c.visitasLista}
              vacio="Sin visitas registradas. Se apuntan al terminar una reserva."
              columnas={[
                { titulo: "Fecha", celda: (v) => fecha(v.fecha) },
                { titulo: "Local", celda: (v) => c.nombreCentro[v.centroId] ?? "—" },
                { titulo: "Personas", alinear: "derecha", celda: (v) => numero(v.personas) },
                { titulo: "Importe", alinear: "derecha", celda: (v) => (v.importe ? euros(v.importe) : "—") },
                { titulo: "Origen", celda: (v) => v.origen },
              ]}
            />
          </Tarjeta>

          <Tarjeta titulo="Encuestas">
            <Tabla
              clave={(e) => e.id}
              filas={c.encuestas}
              vacio="Sin encuestas."
              columnas={[
                { titulo: "Enviada", celda: (e) => fecha(e.enviadaEn) },
                { titulo: "Local", celda: (e) => c.nombreCentro[e.centroId] ?? "—" },
                { titulo: "Nota", celda: (e) => <Estrellas nota={e.nota} /> },
                { titulo: "Comentario", celda: (e) => e.comentario ?? "—" },
              ]}
            />
          </Tarjeta>
        </div>

        <div className="space-y-4">
          <Tarjeta titulo="Consentimientos">
            <ul className="space-y-3">
              {TIPOS.map((t) => {
                const v = c.vigentes[t.tipo];
                return (
                  <li key={t.tipo} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <div>{t.nombre}</div>
                      <EtiquetaConsentimiento c={v} />
                    </div>
                    {puede && (
                      <form action={cambiarConsentimientoAccion}>
                        <input type="hidden" name="clienteId" value={c.id} />
                        <input type="hidden" name="tipo" value={t.tipo} />
                        {!v?.otorgado && <input type="hidden" name="otorgado" value="on" />}
                        <Boton type="submit" variante="secundario">{v?.otorgado ? "Retirar" : "Lo acepta"}</Boton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
            <details className="mt-4 text-xs text-suave">
              <summary className="cursor-pointer">Historial de consentimientos ({c.consentimientos.length})</summary>
              <ul className="mt-2 space-y-1">
                {c.consentimientos.map((x) => (
                  <li key={x.id}>
                    {fechaHora(x.fecha)} · {x.tipo} · {x.otorgado ? "acepta" : "no acepta"}{x.marcaId ? " (una marca)" : ""} · {x.origen}
                    {x.texto ? ` · ${x.texto}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </Tarjeta>

          {puede && (
            <Tarjeta titulo="Derecho de supresión (RGPD)">
              <form action={suprimirClienteAccion} className="space-y-3 text-sm">
                <input type="hidden" name="id" value={c.id} />
                <p className="text-suave">Borra nombre, teléfono, correo, alergias y notas. Las visitas quedan sin datos personales. No se puede deshacer.</p>
                <label className="flex items-center gap-2"><input type="checkbox" name="confirmar" /> El cliente lo ha pedido</label>
                <Boton type="submit" variante="peligro">Suprimir datos</Boton>
              </form>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
