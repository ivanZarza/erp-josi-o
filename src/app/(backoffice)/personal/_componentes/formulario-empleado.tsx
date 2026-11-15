/**
 * Campos de la ficha del empleado (alta y edición) y del contrato. Server Component.
 */
import { Campo, Entrada, Selector, AreaTexto } from "@/ui";
import { TIPOS_CONTRATO, NOMBRE_CONTRATO, NOMBRE_DEPARTAMENTO } from "@/modulos/personal/esquemas";
import { diaISO } from "@/modulos/personal/fechas";
import type { listarPuestos, listarConvenios, listarSociedades, usuariosParaEnlazar, EmpleadoFicha } from "@/modulos/personal/servicio";

type Puestos = Awaited<ReturnType<typeof listarPuestos>>;
type Convenios = Awaited<ReturnType<typeof listarConvenios>>;
type Sociedades = Awaited<ReturnType<typeof listarSociedades>>;
type Usuarios = Awaited<ReturnType<typeof usuariosParaEnlazar>>;
type CentroOpcion = { id: string; nombre: string };

export function CamposEmpleado({ e, centros, puestos, convenios, sociedades, usuarios }: { e?: EmpleadoFicha; centros: CentroOpcion[]; puestos: Puestos; convenios: Convenios; sociedades: Sociedades; usuarios: Usuarios }) {
  const extra = new Set(e?.centros.map((c) => c.centroId) ?? []);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre">
          <Entrada name="nombre" required defaultValue={e?.nombre} />
        </Campo>
        <Campo etiqueta="Apellidos">
          <Entrada name="apellidos" required defaultValue={e?.apellidos} />
        </Campo>
        <Campo etiqueta="DNI / NIE">
          <Entrada name="dni" defaultValue={e?.dni ?? ""} />
        </Campo>
        <Campo etiqueta="N.º Seguridad Social">
          <Entrada name="nss" defaultValue={e?.nss ?? ""} />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento">
          <Entrada name="fechaNacimiento" type="date" defaultValue={e?.fechaNacimiento ? diaISO(e.fechaNacimiento) : ""} />
        </Campo>
        <Campo etiqueta="Teléfono" ayuda="Con prefijo: +34…">
          <Entrada name="telefono" type="tel" defaultValue={e?.telefono ?? ""} />
        </Campo>
        <Campo etiqueta="Correo">
          <Entrada name="email" type="email" defaultValue={e?.email ?? ""} />
        </Campo>
        <Campo etiqueta="Contacto de emergencia">
          <Entrada name="contactoEmergencia" defaultValue={e?.contactoEmergencia ?? ""} />
        </Campo>
        <Campo etiqueta="Dirección">
          <Entrada name="direccion" defaultValue={e?.direccion ?? ""} />
        </Campo>
        <Campo etiqueta="Cuenta bancaria (IBAN)">
          <Entrada name="iban" defaultValue={e?.iban ?? ""} />
        </Campo>
        <Campo etiqueta="PIN para fichar" ayuda="4 cifras, para la tableta del local">
          <Entrada name="pin" inputMode="numeric" maxLength={4} defaultValue={e?.pin ?? ""} />
        </Campo>
        <Campo etiqueta="Usuario de acceso" ayuda="El de Ajustes → Usuarios. Con él entra en «Fichar (mi portal)»">
          <Selector name="usuarioId" defaultValue={e?.usuarioId ?? ""}>
            <option value="">Sin usuario</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} · {u.email}
                {u.activo ? "" : " (desactivado)"}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Centro principal">
          <Selector name="centroPrincipalId" required defaultValue={e?.centroPrincipalId ?? ""}>
            <option value="">Elige centro…</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Puesto">
          <Selector name="puestoId" defaultValue={e?.puestoId ?? ""}>
            <option value="">Sin puesto</option>
            {puestos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {NOMBRE_DEPARTAMENTO[p.departamento]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Categoría del convenio">
          <Selector name="categoriaId" defaultValue={e?.categoriaId ?? ""}>
            <option value="">Sin categoría</option>
            {convenios.map((c) => (
              <optgroup key={c.id} label={c.nombre}>
                {c.categorias.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nombre}
                    {k.nivel ? ` (${k.nivel})` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Sociedad que contrata">
          <Selector name="sociedadId" defaultValue={e?.sociedadId ?? ""}>
            <option value="">La del centro</option>
            {sociedades.map((s) => (
              <option key={s.id} value={s.id}>
                {s.razonSocial}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Otros centros donde puede trabajar (préstamos)</legend>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {centros.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="centrosExtra" value={c.id} defaultChecked={extra.has(c.id)} className="h-4 w-4 accent-acento" />
              {c.nombre}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo etiqueta="Notas">
        <AreaTexto name="notas" rows={2} defaultValue={e?.notas ?? ""} />
      </Campo>
    </div>
  );
}

export function CamposContrato({ convenios, sociedades, verSalarios, fechaInicio }: { convenios: Convenios; sociedades: Sociedades; verSalarios: boolean; fechaInicio?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Campo etiqueta="Tipo de contrato">
        <Selector name="tipo" defaultValue="INDEFINIDO">
          {TIPOS_CONTRATO.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_CONTRATO[t]}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Jornada semanal (horas)">
        <Entrada name="jornadaSemanal" inputMode="decimal" defaultValue="40" />
      </Campo>
      <Campo etiqueta="Inicio">
        <Entrada name="fechaInicio" type="date" defaultValue={fechaInicio} />
      </Campo>
      <Campo etiqueta="Fin" ayuda="Vacío si es indefinido">
        <Entrada name="fechaFin" type="date" />
      </Campo>
      <Campo etiqueta="Fin del periodo de prueba">
        <Entrada name="finPeriodoPrueba" type="date" />
      </Campo>
      <Campo etiqueta="Convenio">
        <Selector name="convenioId" defaultValue="">
          <option value="">Sin convenio</option>
          {convenios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Categoría">
        <Selector name="categoriaId" defaultValue="">
          <option value="">Sin categoría</option>
          {convenios.map((c) => (
            <optgroup key={c.id} label={c.nombre}>
              {c.categorias.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Sociedad">
        <Selector name="sociedadId" defaultValue="">
          <option value="">La del empleado</option>
          {sociedades.map((s) => (
            <option key={s.id} value={s.id}>
              {s.razonSocial}
            </option>
          ))}
        </Selector>
      </Campo>
      {verSalarios && (
        <>
          <Campo etiqueta="Salario bruto anual (€)">
            <Entrada name="salarioBrutoAnual" inputMode="decimal" />
          </Campo>
          <Campo etiqueta="Cotización de empresa (%)" ayuda="Por defecto 32 %">
            <Entrada name="porcentajeCotizacion" inputMode="decimal" placeholder="32" />
          </Campo>
          <Campo etiqueta="Coste empresa por hora (€)" ayuda="Vacío: se calcula del salario">
            <Entrada name="costeHora" inputMode="decimal" />
          </Campo>
          <Campo etiqueta="Pagas al año" ayuda="12 mensualidades + extra (14 por defecto)">
            <Entrada name="pagasAnuales" inputMode="numeric" placeholder="14" />
          </Campo>
          <Campo etiqueta="Pagas extra">
            <Selector name="pagasProrrateadas" defaultValue="si">
              <option value="si">Prorrateadas cada mes</option>
              <option value="no">En junio y diciembre</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Retención IRPF (%)" ayuda="La que diga la gestoría. Vacío: orientativa">
            <Entrada name="irpfPorcentaje" inputMode="decimal" />
          </Campo>
        </>
      )}
      <Campo etiqueta="Notas del contrato">
        <Entrada name="notas" />
      </Campo>
    </div>
  );
}
