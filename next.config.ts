import type { NextConfig } from "next";

/**
 * Herramientas de desarrollo que Next.js rastrea por error y que NO deben ir al paquete de
 * Cloudflare (límite de 10 MiB comprimido). Ver docs/tecnico/prueba-cloudflare.md.
 */
const SOLO_DESARROLLO = [
  "node_modules/prisma/**",
  "node_modules/@prisma/engines/**",
  "node_modules/@prisma/dev/**",
  "node_modules/@prisma/studio-core/**",
  "node_modules/@electric-sql/**",
  "node_modules/wrangler/**",
  "node_modules/miniflare/**",
  "node_modules/workerd/**",
  "node_modules/@cloudflare/**",
  "node_modules/@opennextjs/**",
  "node_modules/@aws-sdk/**",
  "node_modules/@smithy/**",
  "node_modules/typescript/**",
  "node_modules/esbuild/**",
  "node_modules/@esbuild/**",
  "node_modules/effect/**",
  "node_modules/@img/**",
  "node_modules/sharp/**",
  "node_modules/tailwindcss/**",
  "node_modules/@tailwindcss/**",
  "node_modules/lightningcss*/**",
  "node_modules/tsx/**",
];

const nextConfig: NextConfig = {
  outputFileTracingExcludes: { "*": SOLO_DESARROLLO },
};

export default nextConfig;
