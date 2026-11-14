import { exigir } from "@/kernel/contexto";
import { fecha, fechaHora, euros, numero } from "@/kernel/formato";
import { Cabecera, Cifra, Rejilla, Tarjeta, Campo, Boton, BotonEnlace, Entrada, Selector, Etiqueta, Tabla } from "@/ui";
import { TablaDesplegable, DatosDetalle } from "@/ui/tabla-desplegable";
import { listarTarjetas, marcasDeLaCadena } from "@/modulos/clientes/servicio";
import { emitirTarjetaAccion, canjearTarjetaAccion, anularTarjetaAccion } from "@/modulos/clientes/acciones";
import { AvisosUrl, PestanasClientes, param, type Busqueda } from "@/modulos/clientes/ui";

const ESTADOS = { ACTIVA: "Activa", AGOTADA: "Agotada", CADUCADA: "Caducada", ANULADA: "Anulada" } as const;
const MOVIMIENTOS = { EMISION: "Emisión", CANJE: "Canje", AJUSTE: "Ajuste", ANULACION: "Anulación" } as const;

export default async function TarjetasRegalo({ searchParams }: { searchParams: Busqueda }) {
  const ctx = await exigir("clientes", "clientes:ver");
  const sp = await searchParams;
  const q = param(sp, "q");
  const estado = param(sp, "estado");
  const [tarjetas, marcas] = await Promise.all([listarTarjetas(ctx, { q, estado }), marcasDeLaCadena(ctx.tenant.id)]);
  const puede = ctx.puede("clientes:tarjetas:gestionar");
  const nombreMarca = Object.fromEntries(marcas.map((m) => [m.id, m.nombre]));
  const nombreCentro = Object.fromEntries(ctx.centros.map((c) => [c.id, c.nombre]));
  const activas = tarjetas.filter((t) => t.estado === "ACTIVA");
  const saldoVivo = activas.reduce((a, t) => a + Number(t.saldo), 0);
  const vendido = tarjetas.reduce((a, t) => a + Number(t.importeInicial), 0);
  const enUnAno = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

  return (
    <>
      <Cabecera titulo="Tarjetas regalo" subtitulo="Código único, saldo y caducidad; válidas en todo el grupo o en una marca" />
      <PestanasClientes activa="/clientes/tarjetas-regalo" />
      <AvisosUrl sp={sp} />
      <div className="mb-6">
        <Rejilla columnas={4}>
          <Cifra etiqueta="Activas" valor={numero(activas.length)} />
          <Cifra etiqueta="Saldo pendiente de canjear" valor={euros(saldoVivo)} tono="aviso" />
          <Cifra etiqueta="Emitido (listado)" valor={euros(vendido)} />
          <Cifra etiqueta="Caducan en 30 días" valor={numero(activas.filter((t) => t.caducidad.getTime() < Date.now() + 30 * 86_400_000).length)} />
        </Rejilla>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <Entrada name="q" defaultValue={q} placeholder="Código, comprador o destinatario" className="w-72" />
        <Selector name="estado" defaultValue={estado ?? ""} className="w-40">
          <option value="">Todas</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selector>
        <Boton variante="secundario" type="submit">Buscar</Boton>
        {(q || estado) && <BotonEnlace variante="secundario" href="/clientes/tarjetas-regalo">Quitar filtros</BotonEnlace>}
      </form>

      <TablaDesplegable
        columnas={[{ titulo: "Código" }, { titulo: "Para" }, { titulo: "Validez", secundaria: true }, { titulo: "Importe", alinear: "derecha" }, { titulo: "Saldo", alinear: "derecha" }, { titulo: "Caduca" }, { titulo: "Estado" }]}
        vacio="No hay tarjetas regalo."
        filas={tarjetas.map((t) => ({
          id: t.id,
          celdas: [
            <span key="c" className="font-mono font-medium">{t.codigo}</span>,
            t.destinatario ?? t.compradorNombre ?? "—",
            t.marcaId ? nombreMarca[t.marcaId] ?? "Una marca" : "Todo el grupo",
            euros(t.importeInicial),
            euros(t.saldo),
            fecha(t.caducidad),
            <Etiqueta key="e" tono={t.estado === "ACTIVA" ? "ok" : t.estado === "ANULADA" || t.estado === "CADUCADA" ? "error" : "normal"}>{ESTADOS[t.estado]}</Etiqueta>,
          ],
          detalle: (
            <div className="space-y-4">
              <DatosDetalle
                datos={[
                  { etiqueta: "Comprador", valor: t.compradorNombre ?? "—" },
                  { etiqueta: "Correo comprador", valor: t.compradorEmail ?? "—" },
                  { etiqueta: "Mensaje", valor: t.mensaje ?? "—" },
                  { etiqueta: "Origen", valor: t.origen },
                ]}
              />
              <Tabla
                clave={(m) => m.id}
                filas={t.movimientos}
                columnas={[
                  { titulo: "Fecha", celda: (m) => fechaHora(m.createdAt) },
                  { titulo: "Movimiento", celda: (m) => MOVIMIENTOS[m.tipo] },
                  { titulo: "Local", celda: (m) => (m.centroId ? nombreCentro[m.centroId] ?? "—" : "—") },
                  { titulo: "Importe", alinear: "derecha", celda: (m) => euros(m.importe) },
                  { titulo: "Saldo", alinear: "derecha", celda: (m) => euros(m.saldoTras) },
                  { titulo: "Nota", celda: (m) => m.nota ?? "" },
                ]}
              />
              {puede && t.estado === "ACTIVA" && (
                <div className="flex flex-wrap gap-4">
                  <form action={canjearTarjetaAccion} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="tarjetaId" value={t.id} />
                    <Campo etiqueta="Canjear (€)"><Entrada type="number" name="importe" min={0.01} step="0.01" max={Number(t.saldo)} className="w-32" required /></Campo>
                    <Campo etiqueta="Local">
                      <Selector name="centroId" defaultValue={ctx.centroActivo?.id ?? ""} className="w-48">
                        <option value="">Sin indicar</option>
                        {ctx.centros.filter((c) => c.tipo === "LOCAL").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </Selector>
                    </Campo>
                    <Entrada name="nota" placeholder="Mesa, ticket…" className="w-40" />
                    <Boton type="submit">Canjear</Boton>
                  </form>
                  <form action={anularTarjetaAccion} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="tarjetaId" value={t.id} />
                    <Entrada name="nota" placeholder="Motivo de la anulación" className="w-56" required />
                    <Boton type="submit" variante="peligro">Anular</Boton>
                  </form>
                </div>
              )}
            </div>
          ),
        }))}
      />

      {puede && (
        <div className="mt-6">
          <Tarjeta titulo="Emitir tarjeta">
            <form action={emitirTarjetaAccion} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Importe (€)"><Entrada type="number" name="importe" min={1} step="0.01" defaultValue={100} required /></Campo>
              <Campo etiqueta="Caduca"><Entrada type="date" name="caducidad" defaultValue={enUnAno} required /></Campo>
              <Campo etiqueta="Válida en">
                <Selector name="marcaId" defaultValue="">
                  <option value="">Todo el grupo</option>
                  {marcas.map((m) => <option key={m.id} value={m.id}>Solo {m.nombre}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Para (destinatario)"><Entrada name="destinatario" /></Campo>
              <Campo etiqueta="Comprador"><Entrada name="compradorNombre" /></Campo>
              <Campo etiqueta="Correo del comprador"><Entrada type="email" name="compradorEmail" /></Campo>
              <div className="sm:col-span-2"><Campo etiqueta="Mensaje"><Entrada name="mensaje" /></Campo></div>
              <div className="sm:col-span-2 lg:col-span-4"><Boton type="submit">Emitir tarjeta</Boton></div>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
