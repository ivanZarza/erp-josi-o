/**
 * Piezas de pantalla de Organización y Ajustes, hechas solo con componentes de @/ui.
 * Server Components (sin "use client").
 */
import type { ReactNode } from "react";
import { Aviso, AreaTexto, Campo, Entrada, Etiqueta, Rejilla, Selector } from "@/ui";
import type { EstadoCentro } from "@/generated/prisma/enums";
import { DIAS, NOMBRE_DIA, SERVICIOS } from "./esquemas";
import { NOMBRE_ESTADO, type DatosExtraCentro } from "./servicio";

export type ParametrosPagina = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  return Array.isArray(v) ? v[0] : v;
}

/** Avisos que vuelven de las acciones (?error=… / ?ok=…). */
export function AvisosPagina({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = param(sp, "error");
  const ok = param(sp, "ok");
  if (!error && !ok) return null;
  return (
    <div className="mb-4">
      {error && <Aviso tono="error">{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}
    </div>
  );
}

export function EtiquetaEstado({ estado }: { estado: EstadoCentro }) {
  const tono = ({ PREPARACION: "info", ABIERTO: "ok", TEMPORADA: "normal", CERRADO_TEMPORAL: "aviso", CERRADO: "error" } as const)[estado];
  return <Etiqueta tono={tono}>{NOMBRE_ESTADO[estado]}</Etiqueta>;
}

/** Casilla con texto (no hay componente propio en @/ui todavía). */
export function Casilla({ nombre, valor, marcada, children, deshabilitada }: { nombre: string; valor?: string; marcada?: boolean; children: ReactNode; deshabilitada?: boolean }) {
  return (
    <label className={`flex min-h-10 items-start gap-2 text-sm ${deshabilitada ? "opacity-50" : ""}`}>
      <input type="checkbox" name={nombre} value={valor ?? "on"} defaultChecked={marcada} disabled={deshabilitada} className="mt-0.5 h-4 w-4 shrink-0 accent-acento" />
      <span>{children}</span>
    </label>
  );
}

export function Muestra({ color }: { color: string | null }) {
  if (!color) return <span className="text-suave">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-4 w-4 rounded border border-borde" style={{ background: color }} />
      <span className="cifra">{color}</span>
    </span>
  );
}

interface OpcionId {
  id: string;
  nombre: string;
}

export interface ValoresCentro {
  codigo?: string;
  nombre?: string;
  tipo?: string;
  marcaId?: string | null;
  sociedadId?: string | null;
  telefono?: string | null;
  email?: string | null;
  horaCorte?: string;
  aperturaEn?: Date | null;
  edificio?: { direccion: string; cp: string | null; ciudad: string; provincia: string | null; comunidad: string | null } | null;
}

function fechaInput(d?: Date | null): string | undefined {
  if (!d) return undefined;
  return new Date(d).toISOString().slice(0, 10);
}

/** Campos de datos del centro (sin <form>: lo pone la página con su acción). */
export function CamposCentro({ v, marcas, sociedades, edificios, edificioSeleccionado }: { v: ValoresCentro; marcas: OpcionId[]; sociedades: OpcionId[]; edificios: OpcionId[]; edificioSeleccionado?: string }) {
  return (
    <div className="space-y-4">
      <Rejilla columnas={4}>
        <Campo etiqueta="Código" ayuda="Corto y único: VA-AYA, OB…">
          <Entrada name="codigo" required defaultValue={v.codigo} maxLength={12} />
        </Campo>
        <Campo etiqueta="Nombre comercial">
          <Entrada name="nombre" required defaultValue={v.nombre} />
        </Campo>
        <Campo etiqueta="Tipo">
          <Selector name="tipo" defaultValue={v.tipo ?? "LOCAL"}>
            <option value="LOCAL">Local</option>
            <option value="OBRADOR">Obrador</option>
            <option value="ALMACEN">Almacén</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Hora de corte" ayuda="La jornada termina a esta hora">
          <Entrada name="horaCorte" type="time" defaultValue={v.horaCorte ?? "05:00"} />
        </Campo>
        <Campo etiqueta="Marca">
          <Selector name="marcaId" defaultValue={v.marcaId ?? ""}>
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Sociedad">
          <Selector name="sociedadId" defaultValue={v.sociedadId ?? ""}>
            <option value="">Sin sociedad</option>
            {sociedades.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Teléfono" ayuda="Con prefijo: +34 …">
          <Entrada name="telefono" type="tel" defaultValue={v.telefono ?? ""} />
        </Campo>
        <Campo etiqueta="Correo">
          <Entrada name="email" type="email" defaultValue={v.email ?? ""} />
        </Campo>
        <Campo etiqueta="Fecha de apertura">
          <Entrada name="aperturaEn" type="date" defaultValue={fechaInput(v.aperturaEn)} />
        </Campo>
      </Rejilla>
      <CamposDireccion v={v.edificio ?? null} edificios={edificios} seleccionado={edificioSeleccionado} />
    </div>
  );
}

export function CamposDireccion({ v, edificios, seleccionado }: { v: ValoresCentro["edificio"] | null; edificios: OpcionId[]; seleccionado?: string }) {
  return (
    <div className="space-y-3">
      <Campo
        etiqueta="Edificio compartido"
        ayuda="Si comparte edificio con otro centro, elígelo (la dirección de abajo no se usa); si no, deja «Dirección propia» y escríbela abajo. Pasar a «Dirección propia» separa el centro del edificio que compartía."
      >
        <Selector name="edificioId" defaultValue={seleccionado ?? ""}>
          <option value="">Dirección propia</option>
          {edificios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Rejilla columnas={4}>
        <Campo etiqueta="Dirección">
          <Entrada name="direccion" defaultValue={v?.direccion ?? ""} />
        </Campo>
        <Campo etiqueta="Código postal">
          <Entrada name="cp" inputMode="numeric" maxLength={5} defaultValue={v?.cp ?? ""} />
        </Campo>
        <Campo etiqueta="Ciudad">
          <Entrada name="ciudad" defaultValue={v?.ciudad ?? ""} />
        </Campo>
        <Campo etiqueta="Provincia">
          <Entrada name="provincia" defaultValue={v?.provincia ?? ""} />
        </Campo>
        <Campo etiqueta="Comunidad autónoma" ayuda="Para festivos y convenio">
          <Entrada name="comunidad" defaultValue={v?.comunidad ?? ""} />
        </Campo>
      </Rejilla>
    </div>
  );
}

/** Campos de horario por día (también para la plantilla de marca). */
export function CamposDias({ horario }: { horario?: Partial<Record<(typeof DIAS)[number], string>> }) {
  return (
    <Rejilla columnas={4}>
      {DIAS.map((d) => (
        <Campo key={d} etiqueta={NOMBRE_DIA[d]}>
          <Entrada name={`dia-${d}`} placeholder="13:00-16:00, 20:00-00:00" defaultValue={horario?.[d] ?? ""} />
        </Campo>
      ))}
    </Rejilla>
  );
}

export function CamposHorario({ extra, horaCorte }: { extra: DatosExtraCentro; horaCorte: string }) {
  const espacios = (extra.espacios ?? []).map((e) => `${e.nombre}, ${e.sentados}, ${e.dePie}`).join("\n");
  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">Tramos separados por comas (por ejemplo 13:00-16:00, 20:00-00:30). Escribe «cerrado» los días que no abre.</p>
      <CamposDias horario={extra.horario} />
      <Rejilla columnas={2}>
        <Campo etiqueta="Hora de corte de la jornada">
          <Entrada name="horaCorte" type="time" defaultValue={horaCorte} />
        </Campo>
        <Campo etiqueta="Festivos y cierres por temporada" ayuda="Uno por línea: 24/12 cierra a las 18:00, agosto cerrado…">
          <AreaTexto name="festivos" rows={3} defaultValue={extra.festivos ?? ""} />
        </Campo>
      </Rejilla>
      <Campo etiqueta="Espacios" ayuda="Uno por línea: nombre, aforo sentado, aforo de pie (por ejemplo: Terraza, 40, 10)">
        <AreaTexto name="espacios" rows={4} defaultValue={espacios} />
      </Campo>
      <div>
        <div className="mb-1 text-sm font-medium">Servicios</div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICIOS.map(([id, nombre]) => (
            <Casilla key={id} nombre="servicios" valor={id} marcada={extra.servicios?.includes(id)}>
              {nombre}
            </Casilla>
          ))}
        </div>
      </div>
    </div>
  );
}

export function textoServicios(ids?: string[]): string {
  if (!ids?.length) return "—";
  return ids.map((id) => SERVICIOS.find(([s]) => s === id)?.[1] ?? id).join(", ");
}

export function textoHorario(h?: Partial<Record<(typeof DIAS)[number], string>>): ReactNode {
  if (!h || !Object.values(h).some(Boolean)) return "Sin horario";
  return (
    <ul className="space-y-0.5">
      {DIAS.map((d) => (
        <li key={d}>
          <span className="inline-block w-24 text-suave">{NOMBRE_DIA[d]}</span>
          {h[d] || "—"}
        </li>
      ))}
    </ul>
  );
}
