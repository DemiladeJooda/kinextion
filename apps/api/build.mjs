/**
 * Production build: one bundled dist/server.js.
 *
 * The workspace packages (@kinextion/shared, database, ai-core) ship as
 * TypeScript source, which Node can't load — `tsc` alone produced a server
 * that crashed on its first import. esbuild compiles them into the bundle;
 * real npm dependencies (Prisma, Fastify, the SDKs) stay external and load
 * from node_modules as usual.
 */

import { build } from "esbuild";

const workspace = /^@kinextion\//;

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "external-npm-packages",
      setup(b) {
        // Bare imports are npm packages — except our own workspace packages.
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          workspace.test(args.path) || args.kind === "entry-point" ? undefined : { path: args.path, external: true }
        );
      },
    },
  ],
  // Some bundled code may call require(); give ESM output a real one.
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
