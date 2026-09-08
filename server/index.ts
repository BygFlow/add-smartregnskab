import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { seedDatabase } from "./seed";
import { seedReferenceData } from "./seed";
import { startScheduler, jobOverview } from "./scheduler";
import { usingFallbackKey } from "./crypto";
import { emailConfigured } from "./messaging";
import { ensureDatabaseSchema, checkDatabaseIntegrity } from "./storage";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";

const APP_VERSION = "1.3.1";

function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;
  const missing = ["ENCRYPTION_KEY", "APP_BASE_URL", "DATABASE_PATH", "FILE_STORAGE_DIR"]
    .filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Manglende kritiske produktionsvariabler: ${missing.join(", ")}`);
  }
  if ((process.env.ENCRYPTION_KEY?.length ?? 0) < 32) {
    throw new Error("ENCRYPTION_KEY skal være mindst 32 tegn i produktion.");
  }
  try { new URL(process.env.APP_BASE_URL!); } catch { throw new Error("APP_BASE_URL skal være en gyldig URL."); }
}

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
    requestId?: string;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

app.use(
  express.json({
    limit: "12mb", // fotos sendes som data-URL'er
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "12mb" }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; script-src 'self'; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

const authRate = new Map<string, { count: number; resetAt: number }>();
app.use("/api/auth", (req, res, next) => {
  if (req.method === "GET" || req.path === "/logout") return next();
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = authRate.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 15 * 60_000 } : current;
  bucket.count += 1;
  authRate.set(key, bucket);
  res.setHeader("RateLimit-Limit", "30");
  res.setHeader("RateLimit-Remaining", String(Math.max(0, 30 - bucket.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > 30) return res.status(429).json({ error: "For mange forsøg. Prøv igen senere." });
  if (authRate.size > 10_000) {
    authRate.forEach((value, entryKey) => { if (value.resetAt <= now) authRate.delete(entryKey); });
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// ── Request ID + structured logging ──
app.use((req, res, next) => {
  req.requestId = randomUUID().slice(0, 8);
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path === "/healthz" || path === "/readyz") {
      let logLine = `${req.method} ${path} ${res.statusCode} ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 200)}`;
      }
      log(logLine, `req:${req.requestId ?? ""}`);
    }
  });

  next();
});

// ── Health check (public, no auth) ──
app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  });
});

// ── Readiness check (public, no auth) ──
app.get("/readyz", async (_req, res) => {
  try {
    if (checkDatabaseIntegrity() !== "ok") throw new Error("Databasens quick_check fejlede.");
    // Check file storage dir is writable
    const storageDir = resolve(process.env.FILE_STORAGE_DIR || "uploads");
    mkdirSync(storageDir, { recursive: true });
    const probe = join(storageDir, `.readyz-${process.pid}`);
    writeFileSync(probe, "ok", { flag: "wx" });
    unlinkSync(probe);
    res.json({
      status: "ready",
      checks: {
        database: "ok",
        file_storage: "ok",
        scheduler: "running",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: "not_ready",
      error: err.message ?? "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

(async () => {
  validateProductionEnvironment();
  ensureDatabaseSchema();
  if (process.env.ALLOW_DEMO_SEED === "1" && process.env.NODE_ENV !== "production") {
    seedDatabase();
  } else {
    seedReferenceData();
  }
  await registerRoutes(httpServer, app);

  // ── Production error handler ──
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log full error server-side, but don't leak stack traces to client in production
    console.error(`[ERROR ${status}] ${_req.method} ${_req.path} ::`, err);

    if (res.headersSent) {
      return next(err);
    }

    const isProduction = process.env.NODE_ENV === "production";
    return res.status(status).json({
      message,
      requestId: _req.requestId,
      ...(isProduction ? {} : { stack: err.stack }),
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`ADD SmartRegnskab v${APP_VERSION} serving on port ${port}`);
      log(`Database: ${process.env.DATABASE_PATH ?? "data.db"}`);
      log(`File storage: ${process.env.FILE_STORAGE_DIR ?? "default"}`);
      log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? "configured" : "not configured"}`);
      log(`Email: ${emailConfigured() ? "configured" : "not configured"}`);
      log(`Encryption: ${usingFallbackKey() ? "FALLBACK KEY (not production-safe)" : "configured"}`);
      startScheduler(); // automatiske job: gentagne opgaver, rykkere, fornyelse, GDPR
    },
  );
})();
