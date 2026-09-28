import "dotenv/config";
import express from "express";
import { verifySproomSignature } from "../../server/einvoice";
import { registerEdiGatewayAdminRoutes, registerPublicEdiGatewayRoutes } from "./routes";
import { reconcileSproomDocuments } from "./reconciliation";
import { drainWebhookQueue, enqueueVerifiedWebhook, webhookQueueStatus } from "./webhook-queue";
import { requireGatewayAdmin } from "./security";
import { db } from "./storage";
import { ediGatewayTenants } from "../../shared/schema";
import { startGatewayBackupScheduler } from "./backup-scheduler";

const requiredConfig = ["EDI_GATEWAY_DATABASE_PATH", "EDI_GATEWAY_ADMIN_TOKEN", "EDI_GATEWAY_BACKUP_DIR", "SPROOM_API_TOKEN", "EINVOICE_VALIDATOR_URL"];

export function createEdiGatewayApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb", verify: (req, _res, body) => { (req as any).rawBody = Buffer.from(body); } }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", (_req, res) => {
    try {
      db.select({ id: ediGatewayTenants.id }).from(ediGatewayTenants).limit(1).all();
      const configured = requiredConfig.every(name => Boolean(process.env[name]))
        && Boolean(process.env.SPROOM_WEBHOOK_PUBLIC_KEY || process.env.SPROOM_WEBHOOK_PUBLIC_KEY_BASE64);
      res.status(configured ? 200 : 503).json({ ready: configured });
    } catch {
      res.status(503).json({ ready: false });
    }
  });
  app.post("/api/edi-gateway/sproom/webhook", async (req, res, next) => {
    try {
      const signature = req.header("x-signature") || "";
      const raw = Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody.toString("utf8") : "";
      if (!verifySproomSignature(raw, signature)) return void res.status(401).json({ error: "Ugyldig Sproom-signatur." });
      const result = enqueueVerifiedWebhook(raw, req.body);
      res.status(result.status).json(result.result);
    } catch (error) { next(error); }
  });
  registerPublicEdiGatewayRoutes(app);
  registerEdiGatewayAdminRoutes(app);
  app.get("/api/edi-gateway/queue", requireGatewayAdmin, (_req, res) => res.json(webhookQueueStatus()));
  app.post("/api/edi-gateway/queue/drain", requireGatewayAdmin, async (req, res, next) => {
    try {
      const limit = req.body?.limit === undefined ? 50 : Number(req.body.limit);
      res.json(await drainWebhookQueue(limit));
    } catch (error) { next(error); }
  });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Gatewayen kunne ikke behandle anmodningen." });
  });
  return app;
}

if (process.env.NODE_ENV !== "test") {
  if (process.env.NODE_ENV === "production" && (requiredConfig.some(name => !process.env[name])
    || !(process.env.SPROOM_WEBHOOK_PUBLIC_KEY || process.env.SPROOM_WEBHOOK_PUBLIC_KEY_BASE64))) {
    throw new Error("EDI-gatewayen mangler obligatorisk produktionskonfiguration.");
  }
  const port = Number(process.env.PORT || 8080);
  createEdiGatewayApp().listen(port, "0.0.0.0", () => console.info(`EDI-gateway lytter på ${port}`));
  let draining = false;
  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      const result = await drainWebhookQueue();
      if (result.processed || result.retried) console.info("EDI-webhookkø:", result);
    } catch (error) { console.error("EDI-webhookkø fejlede:", error instanceof Error ? error.message : "Ukendt fejl"); }
    finally { draining = false; }
  };
  const firstDrain = setTimeout(() => void drain(), 1_000);
  firstDrain.unref();
  const queueTimer = setInterval(() => void drain(), 30_000);
  queueTimer.unref();
  startGatewayBackupScheduler();
  if (process.env.EDI_GATEWAY_RECONCILE_ENABLED === "true") {
    const timer = setInterval(() => {
      void reconcileSproomDocuments().then(result => console.info("EDI-statusafstemning:", result))
        .catch(error => console.error("EDI-statusafstemning fejlede:", error instanceof Error ? error.message : "Ukendt fejl"));
    }, 15 * 60_000);
    timer.unref();
  }
}
