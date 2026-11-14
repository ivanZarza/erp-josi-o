/**
 * Añade el local «Raza Pruebas» a una base que YA tiene la semilla general (Grupo Raza).
 * Uso: npx tsx prisma/seed-pruebas-raza.ts [parte1,parte2…]   (sin partes = todas, en orden)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PrismaNode } from "../src/generated/prisma-node/client";
import type { PrismaClient } from "../src/generated/prisma/client";
import { sembrarPruebasRaza } from "./semillas/pruebas-raza";

const prisma = new PrismaNode({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) }) as unknown as PrismaClient;

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { nombre: { contains: "Raza" } } });
  if (!tenant) throw new Error("No hay tenant de Grupo Raza: carga antes la semilla general (npm run db:seed)");
  const t = tenant.id;
  const [centros, sociedades, marcas, familias, proveedores] = await Promise.all([
    prisma.centro.findMany({ where: { tenantId: t } }),
    prisma.sociedad.findMany({ where: { tenantId: t } }),
    prisma.marca.findMany({ where: { tenantId: t } }),
    prisma.familiaProducto.findMany({ where: { tenantId: t } }),
    prisma.proveedor.findMany({ where: { tenantId: t } }),
  ]);
  // Las claves de sociedades y marcas son las de prisma/seed.ts
  const CLAVE_SOCIEDAD: Record<string, string> = { B88600374: "GUELU", B83351007: "INNOGAMA", B72775299: "KIEV", B06884837: "IHA", B85411007: "PUCHERO", PENDIENTE: "PENDIENTE" };
  const CLAVE_MARCA: Record<string, string> = { "La Vaca Argentina": "VACA", Raza: "RAZA", "La Vaca Roxa": "ROXA", "L'Albufera": "ALBUFERA", "El Puchero": "PUCHERO", "La Paloma": "PALOMA", "Taberna El Guapo": "GUAPO" };
  const solo = process.argv[2]?.split(",").filter(Boolean);
  await sembrarPruebasRaza(prisma, {
    tenantId: t,
    centros: Object.fromEntries(centros.map((c) => [c.codigo, c.id])),
    sociedades: Object.fromEntries(sociedades.map((s) => [CLAVE_SOCIEDAD[s.cif ?? ""] ?? s.razonSocial, s.id])),
    marcas: Object.fromEntries(marcas.map((m) => [CLAVE_MARCA[m.nombre] ?? m.nombre, m.id])),
    familias: Object.fromEntries(familias.map((f) => [`${f.area === "BEBIDAS" ? "B" : f.area === "COMIDAS" ? "C" : "X"}|${f.nombre}`, f.id])),
    proveedores: Object.fromEntries(proveedores.map((p) => [p.nombre, p.id])),
  }, solo);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
