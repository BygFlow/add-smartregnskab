import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { seedDatabase } from "./seed";
import { seedSystemData } from "./seed-system";
import { startScheduler } from "./scheduler";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { usingFallbackKey } from "./crypto";
import { assertDatabaseReady } from "./storage";
import { emailConfigured } from "./messaging";

const APP_VERSION = "3.4.0";

const app = express();
const httpServer = createServer(app);
app.set("trust proxy", 1);

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? process.env.APP_BASE_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return res.status(403).end();
    return res.status(204).end();
  }
  next();
});

// Conservative security headers without adding another runtime dependency.
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'");
  next();
});

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
  });
});

// ── Readiness check (public, no auth) ──
app.get("/readyz", async (_req, res) => {
  try {
    // Check DB is accessible
    assertDatabaseReady();
    // Check file storage dir is writable
    const storageDir = process.env.FILE_STORAGE_DIR || "/home/user/workspace/addsmartregnskab/uploads";
    const probe = join(storageDir, `.readyz-${process.pid}`);
    writeFileSync(probe, "ok");
    require("node:fs").unlinkSync(probe);
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
    console.error("Readiness check failed:", err);
    res.status(503).json({
      status: "not_ready",
      error: "En eller flere afhængigheder er ikke klar.",
      timestamp: new Date().toISOString(),
    });
  }
});

(async () => {
  // Validate security-critical configuration before migrations, seeding or binding a port.
  usingFallbackKey();
  if (process.env.ALLOW_DEMO_SEED === "1") {
    if (process.env.NODE_ENV === "production") throw new Error("ALLOW_DEMO_SEED må ikke bruges i produktion.");
    seedDatabase();
  } else {
    seedSystemData();
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
      log(`Encryption: ${usingFallbackKey() ? "development fallback" : "configured"}`);
      startScheduler(); // automatiske job: gentagne opgaver, rykkere, fornyelse, GDPR
    },
  );
})();
