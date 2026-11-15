# Normas para programar el ERP Josiño

Léelas antes de tocar nada. Las especificaciones completas están en `/home/ivan/Escritorio/ERP Josiño/docs/specs/` (empieza por `general/00_LEEME.md`, `general/03_arquitectura.md`, `general/06_diseno.md` y la ficha de tu módulo en `modulos/<modulo>/README.md`). Índice de toda la documentación: `/home/ivan/Escritorio/ERP Josiño/docs/00_INDICE.md`.

**Norma obligatoria: después de cada modificación se actualiza la documentación** (ficha del módulo, `docs/specs/CAMBIOS.md`, decisiones, preguntas). Ver `docs/specs/general/08_calidad_documentacion.md` §1.

## Idioma
- **Todo en español**: textos de pantalla, nombres de funciones y variables de negocio, comentarios. (Las palabras reservadas de TypeScript/React, en inglés, claro).
- Números y fechas SIEMPRE con `src/kernel/formato.ts` (`euros`, `numero`, `fecha`, `fechaHora`, `porcentaje`). Nunca `toFixed` ni `toLocaleString` sueltos.

## Estructura
```
src/
  kernel/            común: db, sesión, contexto, permisos, registro de módulos, formato, numeración, eventos
  nucleo/            motores comunes (stock, movimientos…) que usan varias áreas
  modulos/<id>/      UN MÓDULO = UNA CARPETA: modulo.ts (manifiesto), servicio.ts (lógica), esquemas.ts (zod), acciones.ts ("use server")
  app/(backoffice)/<id>/   pantallas del módulo (Server Components)
  integraciones/<x>/       conectores externos (por ahora solo huecos)
  ui/                componentes comunes: index.tsx y tabla-desplegable.tsx
prisma/schema/<id>.prisma  tablas del módulo (un archivo por módulo)
prisma/semillas/<id>.ts    datos de ejemplo del módulo
```

## Reglas
1. **Un módulo no toca las tablas de otro** salvo las del núcleo (`prisma/schema/nucleo.prisma`) y lo que otro módulo exporte en su `servicio.ts`. No edites `nucleo.prisma` ni `src/kernel/*` ni `src/ui/*`: si te falta algo, dilo en tu informe final.
2. Cada página empieza con `const ctx = await exigir("<modulo>", "<permiso>")` (de `@/kernel/contexto`). Cada acción de servidor igual.
3. **Toda consulta filtra por `tenantId: ctx.tenant.id`** y, si los datos son de centro, por `centrosFiltro(ctx)`.
4. Lógica en `servicio.ts`, nunca en la página ni en la acción. Validación con **zod** en `esquemas.ts`.
5. Dinero y cantidades con `Decimal` de Prisma en la base; en pantalla, con `formato.ts`. Nunca `Float` para dinero.
6. **El stock nunca se escribe a mano**: solo con `registrarMovimientos` de `src/nucleo/movimientos.ts`.
7. Nada se borra si tiene historial: se desactiva (`activo: false`) o se anula.
8. Documentos numerados con `siguienteNumero(tx, tenantId, "SERIE")` de `src/kernel/numeracion.ts`, dentro de `prisma.$transaction`.
9. Lo que toca dinero, stock, precios o personal: `auditar(...)` de `src/kernel/eventos.ts`. Lo que interesa a otros módulos: `emitir(...)`.
10. Cliente de base de datos: `const prisma = await db()` (de `@/kernel/db`).

## Pantallas (docs/specs/general/06_diseno.md)
- Usa SIEMPRE los componentes de `@/ui` (`Cabecera`, `Tarjeta`, `Cifra`, `Rejilla`, `Etiqueta`, `Boton`, `BotonEnlace`, `Campo`, `Entrada`, `Selector`, `AreaTexto`, `Aviso`, `HuecoIntegracion`, `Pestanas`, `Vacio`) y `@/ui/tabla-desplegable` (`TablaDesplegable`, `DatosDetalle`).
- **Los listados son `TablaDesplegable`**: en la fila, 4–7 datos principales; en el detalle (`detalle`), el resto con `DatosDetalle` y los botones de acción (formularios con `action={accionDeServidor}`).
- Formularios con `<form action={accion}>` y acciones de servidor; tras guardar, `revalidatePath` y/o `redirect`.
- Componentes de cliente (`"use client"`) solo cuando haga falta interacción (contadores, plano de mesas…). Desde un Server Component no se pueden pasar funciones normales a un componente de cliente (sí acciones de servidor y ReactNode).
- Estados: si no hay datos, `Vacio` con qué hacer. Iconos de `lucide-react`. Nada de emojis.
- Donde irá una integración externa, pon `<HuecoIntegracion nombre="…" descripcion="…" />` y deja que los datos se metan a mano.

## Ayuda de cada pantalla (obligatorio)
- Cada pantalla tiene su ayuda en `src/ayuda/contenido/<area>.ts` (tipos en `src/ayuda/tipos.ts`; clave = ruta con parámetros entre corchetes). Si creas o cambias una pantalla, crea o actualiza su ayuda: para qué sirve, quién, cada campo, columna, cifra, filtro y botón (qué es, cómo se calcula, en qué influye). Escríbela leyendo el código, no de memoria.
- `npm run ayuda:comprobar` tiene que terminar sin avisos.

## Comprobar tu trabajo
- `npm run db:generate` y `npm run db:push` usan un candado para no pisarse entre módulos:
  `flock /tmp/erp-prisma.lock npx prisma generate` y `flock /tmp/erp-prisma.lock npx prisma db push`
- Tipos: `npx tsc --noEmit` (puede mostrar errores de otros módulos en obras: arregla solo los tuyos).
- NO arranques el servidor de desarrollo ni `next build` (lo hace quien coordina al final).
- Node 22: antes de cualquier comando, `export PATH=/home/ivan/.nvm/versions/node/v22.14.0/bin:$PATH`.
