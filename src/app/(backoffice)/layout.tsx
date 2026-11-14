import { contexto, modulosVisibles } from "@/kernel/contexto";
import { salir } from "../acceso/acciones";
import { cambiarCentro } from "./acciones-centro";
import { Marco } from "./marco";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  const modulos = modulosVisibles(ctx).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    icono: m.icono,
    menu: m.menu.map((e) => ({ ruta: e.ruta, titulo: e.titulo })),
  }));

  return (
    <Marco
      modulos={modulos}
      cadena={ctx.tenant.nombre}
      usuario={ctx.usuario.nombre}
      centros={ctx.centros.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo }))}
      centroActivo={ctx.centroActivo?.id ?? null}
      cambiarCentro={cambiarCentro}
      salir={salir}
    >
      {children}
    </Marco>
  );
}
