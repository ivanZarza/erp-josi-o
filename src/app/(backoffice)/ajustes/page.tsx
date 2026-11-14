import { redirect } from "next/navigation";
import { exigir } from "@/kernel/contexto";

/** /ajustes lleva a la primera sección que el usuario puede ver. */
export default async function AjustesPagina() {
  const ctx = await exigir("usuarios");
  if (ctx.puede("ajustes:usuarios:ver")) redirect("/ajustes/usuarios");
  if (ctx.puede("ajustes:modulos:ver")) redirect("/ajustes/modulos");
  if (ctx.puede("ajustes:integraciones:ver")) redirect("/ajustes/integraciones");
  if (ctx.puede("ajustes:registro:ver")) redirect("/ajustes/registro");
  redirect("/sin-permiso");
}
