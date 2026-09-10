import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireRole, tenantId } from "./auth";
import { storage } from "./storage";
import { previewImport, type MigrationEntity, type MigrationSource } from "./import-adapters";

const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);
const sources = new Set<MigrationSource>(["economic", "dinero", "billy", "excel", "csv"]);
const entities = new Set<MigrationEntity>(["customers", "suppliers", "accounts"]);
const tokenKey = () => process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "development-import-key";
const tokenFor = (cid: number, source: string, entity: string, content: string) => createHmac("sha256", tokenKey()).update(`${cid}\0${source}\0${entity}\0${content}`).digest("hex");
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

function input(req: Request) {
  const source = String(req.body?.source || "csv") as MigrationSource;
  const entity = String(req.body?.entity || "customers") as MigrationEntity;
  const content = String(req.body?.content || "");
  if (!sources.has(source)) throw { status: 400, message: "Ukendt kildesystem." };
  if (!entities.has(entity)) throw { status: 400, message: "Ukendt datatype." };
  return { source, entity, content };
}

function naturalKey(entity: MigrationEntity, row: any): string {
  return entity === "accounts" ? String(row.accountNumber || "") : String(row.cvr || row.email || row.name || "");
}

export function registerMigrationRoutes(app: Express) {
  app.post("/api/migration/preview", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const value = input(req);
    try {
      const preview = previewImport(value.content, value.entity);
      res.json({ ...preview, source: value.source, entity: value.entity, token: tokenFor(cid, value.source, value.entity, value.content) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Importen kunne ikke læses." });
    }
  }));

  app.post("/api/migration/commit", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const value = input(req);
    const suppliedToken = String(req.body?.token || "");
    if (!safeEqual(suppliedToken, tokenFor(cid, value.source, value.entity, value.content))) return void res.status(409).json({ error: "Forhåndsvisningen er udløbet eller importindholdet er ændret. Validér igen." });
    let preview;
    try { preview = previewImport(value.content, value.entity); }
    catch (error) { return void res.status(400).json({ error: error instanceof Error ? error.message : "Importen kunne ikke læses." }); }
    if (preview.errors.length) return void res.status(400).json({ error: "Importen har valideringsfejl.", errors: preview.errors });
    const existing = await storage.all(value.entity, cid);
    const existingKeys = new Set(existing.map((row: any) => naturalKey(value.entity, row).trim().toLowerCase()).filter(Boolean));
    const createdIds: number[] = [];
    const skipped: string[] = [];
    try {
      for (const row of preview.rows) {
        const key = naturalKey(value.entity, row).trim().toLowerCase();
        if (existingKeys.has(key)) { skipped.push(key); continue; }
        const data: any = { ...row, companyId: cid };
        if (value.entity === "customers") Object.assign(data, { hourlyRate: 350, geofenceRadius: 150 });
        if (value.entity === "accounts") data.createdAt = new Date().toISOString();
        const item = await storage.insert(value.entity, data);
        createdIds.push(item.id); existingKeys.add(key);
      }
    } catch (error) {
      for (const rowId of [...createdIds].reverse()) await storage.delete(value.entity, rowId, cid);
      throw error;
    }
    const now = new Date().toISOString();
    const job = await storage.insert("migration_jobs", {
      companyId: cid, source: value.source, fileName: String(req.body?.fileName || `${value.source}-${value.entity}.csv`),
      mapping: JSON.stringify({ entity: value.entity, createdIds, matchedFields: preview.matchedFields }),
      totalRows: preview.totalRows, importedRows: createdIds.length, errorRows: skipped.length,
      validationErrors: skipped.length ? JSON.stringify(skipped.map((key) => `Sprunget over som eksisterende: ${key}`)) : null,
      rollbackAvailable: createdIds.length > 0, status: "færdig", createdAt: now,
    });
    res.status(201).json({ job, importedRows: createdIds.length, skippedRows: skipped.length });
  }));

  app.post("/api/migration-jobs/:id/rollback", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const id = Number(req.params.id);
    const job = await storage.get("migration_jobs", id, cid);
    if (!job) return void res.status(404).json({ error: "Migreringsjobbet findes ikke." });
    if (job.status === "rolled_back") return void res.status(409).json({ error: "Migreringen er allerede rullet tilbage." });
    let metadata: any = {};
    try { metadata = JSON.parse(job.mapping || "{}"); } catch {}
    if (!entities.has(metadata.entity) || !Array.isArray(metadata.createdIds)) return void res.status(409).json({ error: "Dette ældre migreringsjob har ikke et sikkert rollback-manifest." });
    let removed = 0;
    for (const rowId of [...metadata.createdIds].reverse()) if (await storage.delete(metadata.entity, Number(rowId), cid)) removed += 1;
    const updated = await storage.update("migration_jobs", id, { status: "rolled_back", rollbackAvailable: false, rolledBackAt: new Date().toISOString() }, cid);
    res.json({ ...updated, removedRows: removed });
  }));
}
