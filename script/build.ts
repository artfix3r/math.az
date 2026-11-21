import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "node:fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "@supabase/storage-js",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "google-auth-library",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "postgres",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Bundle the Vercel serverless handler. esbuild resolves the @shared/@ path
  // aliases and inlines the allowlisted deps, producing a self-contained CJS
  // file that Vercel's @vercel/node builder can wrap without needing to know
  // about tsconfig path aliases or our esbuild allowlist.
  // The repo is "type": "module", so a bare api/index.js is loaded by Vercel as
  // an ES module. Emit ESM (not CJS) so the bundle's module format matches what
  // Vercel's @vercel/node runtime expects for a .js function in an ESM package.
  // The `banner` shims CommonJS globals (require/__dirname/__filename) that some
  // bundled deps reference under the hood.
  console.log("building vercel serverless function...");
  await esbuild({
    entryPoints: ["server/vercel-handler.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    // api/index.js (committed) re-exports this file. Vercel checks that the
    // api/ entry exists before the build runs, so it can't be generated.
    outfile: "dist/server/vercel-handler.mjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    banner: {
      js: [
        "import { createRequire as __createRequire } from 'module';",
        "import { fileURLToPath as __fileURLToPath } from 'url';",
        "import { dirname as __pathDirname } from 'path';",
        "const require = __createRequire(import.meta.url);",
        "const __filename = __fileURLToPath(import.meta.url);",
        "const __dirname = __pathDirname(__filename);",
      ].join("\n"),
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
