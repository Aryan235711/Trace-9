import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";
import { promisify } from "node:util";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

const PRECOMPRESS_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".svg",
  ".json",
  ".txt",
  ".xml",
  ".wasm",
]);

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
      continue;
    }
    if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function precompressStaticAssets(distPublicDir: string) {
  console.log("precompressing static assets...");

  let processed = 0;
  for await (const filePath of walkFiles(distPublicDir)) {
    if (filePath.endsWith(".br") || filePath.endsWith(".gz")) continue;

    const ext = path.extname(filePath).toLowerCase();
    if (!PRECOMPRESS_EXTENSIONS.has(ext)) continue;

    const info = await stat(filePath);
    if (!info.isFile() || info.size < 512) continue;

    const raw = await readFile(filePath);

    const brPath = filePath + ".br";
    const gzPath = filePath + ".gz";

    const [br, gz] = await Promise.all([
      brotliAsync(raw, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        },
      }),
      gzipAsync(raw, { level: 9 }),
    ]);

    await Promise.all([
      writeFile(brPath, br),
      writeFile(gzPath, gz),
    ]);

    processed += 1;
  }

  console.log(`precompressed ${processed} files`);
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  await precompressStaticAssets(path.resolve("dist", "public"));

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
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
