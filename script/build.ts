import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile } from "fs/promises";
import { createRequire } from "node:module";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "compression",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memoizee",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "openid-client",
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

  const require = createRequire(import.meta.url);
  await copyFile(
    require.resolve("connect-pg-simple/table.sql"),
    "dist/table.sql"
  );
  
  // Run database migration in production
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    console.log("running database migration...");
    const { execSync } = await import("child_process");
    try {
      execSync("npx drizzle-kit push --force", { stdio: "inherit" });
      console.log("database migration completed");
    } catch (error) {
      console.warn("database migration failed:", error);
    }
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
