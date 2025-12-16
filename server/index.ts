import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import passport from "./auth";
import { createServer, type IncomingMessage, type ServerResponse } from "http";

const app = express();
const httpServer = createServer(app);
let hasInitialized = false;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: process.env.REQUEST_BODY_LIMIT || "100kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: process.env.REQUEST_BODY_LIMIT || "100kb" }));
app.use(compression());
app.use(passport.initialize());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const includeApiResponseBody = process.env.LOG_API_RESPONSE_BODY === "1";
  let capturedJsonResponse: Record<string, any> | undefined;

  if (includeApiResponseBody) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (includeApiResponseBody && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

const initPromise = registerRoutes(httpServer, app)
  .then(async () => {
    hasInitialized = true;

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

if (!process.env.VERCEL) {
  initPromise.then(() => {
    if (!hasInitialized) return;
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(port, () => {
      log(`serving on port ${port}`);
    });
  });
}

const handler = async (req: IncomingMessage, res: ServerResponse) => {
  await initPromise;
  app(req as any, res as any);
};

export default handler;
export { app, httpServer, initPromise };
