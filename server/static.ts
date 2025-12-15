import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const PRECOMPRESSED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".svg",
  ".json",
  ".txt",
  ".xml",
  ".wasm",
]);

function resolveSafe(rootDir: string, urlPath: string): string | null {
  // Prevent path traversal; urlPath must be absolute-style like "/assets/x.js".
  const abs = path.resolve(rootDir, "." + urlPath);
  const rel = path.relative(rootDir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return abs;
}

function pickEncoding(acceptEncodingHeader: string | undefined): "br" | "gzip" | null {
  const accept = (acceptEncodingHeader || "").toLowerCase();
  if (accept.includes("br")) return "br";
  if (accept.includes("gzip")) return "gzip";
  return null;
}

function sendPrecompressedFile(
  res: express.Response,
  originalPath: string,
  precompressedPath: string,
  encoding: "br" | "gzip",
) {
  const ext = path.extname(originalPath).toLowerCase();
  // Ensure correct Content-Type for the ORIGINAL file, not the .br/.gz wrapper.
  res.type(ext.slice(1));
  res.setHeader("Content-Encoding", encoding);
  res.setHeader("Vary", "Accept-Encoding");
  res.sendFile(precompressedPath);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve precompressed variants when available.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    if (req.headers.range) return next();

    const encoding = pickEncoding(req.headers["accept-encoding"]);
    if (!encoding) return next();

    const urlPath = req.path === "/" ? "/index.html" : req.path;
    const ext = path.extname(urlPath).toLowerCase();
    if (!PRECOMPRESSED_EXTENSIONS.has(ext)) return next();

    const originalAbs = resolveSafe(distPath, urlPath);
    if (!originalAbs) return next();
    if (!fs.existsSync(originalAbs)) return next();

    const precompressedAbs = originalAbs + (encoding === "br" ? ".br" : ".gz");
    if (!fs.existsSync(precompressedAbs)) return next();

    return sendPrecompressedFile(res, originalAbs, precompressedAbs, encoding);
  });

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexAbs = path.resolve(distPath, "index.html");
    const encoding = pickEncoding(res.req?.headers?.["accept-encoding"]);
    if (encoding && !res.req?.headers?.range) {
      const precompressedAbs = indexAbs + (encoding === "br" ? ".br" : ".gz");
      if (fs.existsSync(precompressedAbs)) {
        return sendPrecompressedFile(res, indexAbs, precompressedAbs, encoding);
      }
    }

    return res.sendFile(indexAbs);
  });
}
