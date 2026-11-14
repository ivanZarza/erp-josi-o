import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Esquema repartido en un archivo por módulo: prisma/schema/<modulo>.prisma
export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
