import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireFeature, requireRole, tenantId } from "./auth";
import { storage } from "./storage";
import { previewImport, type MigrationEntity, type MigrationSource } from "./import-adapters";

const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);
const sources = new Set<MigrationSource>(["economic", "dinero", "billy", "excel", "csv"]);
const entities = new Set<MigrationEntity>(["customers", "suppliers", "accounts", "journal_entries"]);
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
  if (entity === "journal_entries") return String(row.entryNumber || "");
  return entity === "accounts" ? String(row.accountNumber || "") : String(row.cvr || row.email || row.name || "");
}

async function deleteImportedJournalEntry(entryId: number, companyId: number): Promise<boolean> {
  const lines = (await storage.all("journal_lines", companyId)).filter((line: any) => line.journalEntryId === entryId);
  for (const line of lines) await storage.delete("journal_lines", line.id, companyId);
  return storage.delete("journal_entries", entryId, companyId);
}

export function registerMigrationRoutes(app: Express) {
  app.post("/api/migration/preview", requireFeature("dedikeret_onboarding"), requireRole("leder", "bogholder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const value = input(req);
    try {
      const preview = previewImport(value.content, value.entity);
      res.json({ ...preview, source: value.source, entity: value.entity, token: tokenFor(cid, value.source, value.entity, value.content) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Importen kunne ikke læses." });
    }
  }));

  app.post("/api/migration/commit", requireFeature("dedikeret_onboarding"), requireRole("leder", "bogholder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const value = input(req);
    const suppliedToken = String(req.body?.token || "");
    if (!safeEqual(suppliedToken, tokenFor(cid, value.source, value.entity, value.content))) return void res.status(409).json({ error: "Forhåndsvisningen er udløbet eller importindholdet er ændret. Validér igen." });
    let preview;
    try { preview = previewImport(value.content, value.entity); }
    catch (error) { return void res.status(400).json({ error: error instanceof Error ? error.message : "Importen kunne ikke læses." }); }
    if (preview.errors.length) return void res.status(400).json({ error: "Importen har valideringsfejl.", errors: preview.errors });
    if (value.entity === "journal_entries") {
      const [accounts, existingEntries] = await Promise.all([
        storage.all("accounts", cid),
        storage.all("journal_entries", cid),
      ]);
      const accountsByNumber = new Map(accounts.map((account: any) => [String(account.accountNumber).trim(), account]));
      const existingKeys = new Set(existingEntries.map((entry: any) => String(entry.entryNumber || "").trim().toLowerCase()).filter(Boolean));
      const createdIds: number[] = [];
      const skipped: string[] = [];
      try {
        for (const row of preview.rows as any[]) {
          const key = naturalKey(value.entity, row).trim().toLowerCase();
          if (existingKeys.has(key)) { skipped.push(key); continue; }
          const lines = Array.isArray(row.lines) ? row.lines : [];
          if (lines.length < 2) throw new Error(`Kladde ${row.entryNumber} har ikke mindst to linjer.`);
          const missingAccounts = Array.from(new Set<string>(lines.map((line: any) => String(line.accountNumber || "").trim()).filter((number: string) => !accountsByNumber.has(number))));
          if (missingAccounts.length) throw new Error(`Kladde ${row.entryNumber} bruger konti, som ikke findes: ${missingAccounts.join(", ")}. Importér kontoplanen først.`);
          const debit = lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);
          const credit = lines.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0);
          if (Math.abs(debit - credit) > 0.005) throw new Error(`Kladde ${row.entryNumber} balancerer ikke i debet og kredit.`);
          const entry = await storage.insert("journal_entries", {
            companyId: cid,
            entryNumber: String(row.entryNumber),
            date: String(row.date),
            description: String(row.description),
            reference: row.reference ? String(row.reference) : null,
            sourceType: "economic_kladde",
            status: "kladde",
            createdBy: "e-conomic migrering",
            createdAt: new Date().toISOString(),
          });
          createdIds.push(entry.id);
          for (const line of lines) {
            await storage.insert("journal_lines", {
              companyId: cid,
              journalEntryId: entry.id,
              accountId: accountsByNumber.get(String(line.accountNumber).trim())!.id,
              description: String(line.description || row.description),
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
              vatCode: line.vatCode ? String(line.vatCode) : null,
            });
          }
          existingKeys.add(key);
        }
      } catch (error) {
        for (const entryId of [...createdIds].reverse()) await deleteImportedJournalEntry(entryId, cid);
        throw error;
      }
      const validationNotes = [
        ...(((preview as any).warnings || []) as string[]),
        ...skipped.map((key) => `Sprunget over som eksisterende kladde: ${key}`),
      ];
      const job = await storage.insert("migration_jobs", {
        companyId: cid,
        source: value.source,
        fileName: String(req.body?.fileName || `${value.source}-kassekladde.csv`),
        mapping: JSON.stringify({ entity: value.entity, createdIds, matchedFields: preview.matchedFields }),
        totalRows: preview.totalRows,
        importedRows: createdIds.length,
        errorRows: Math.max(0, preview.totalRows - preview.validRows) + skipped.length,
        validationErrors: validationNotes.length ? JSON.stringify(validationNotes) : null,
        rollbackAvailable: createdIds.length > 0,
        status: "færdig",
        createdAt: new Date().toISOString(),
      });
      return void res.status(201).json({ job, importedRows: createdIds.length, skippedRows: Math.max(0, preview.totalRows - preview.validRows) + skipped.length });
    }
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

  app.post("/api/migration-jobs/:id/rollback", requireFeature("dedikeret_onboarding"), requireRole("leder", "bogholder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = tenantId(req);
    const id = Number(req.params.id);
    const job = await storage.get("migration_jobs", id, cid);
    if (!job) return void res.status(404).json({ error: "Migreringsjobbet findes ikke." });
    if (job.status === "rolled_back") return void res.status(409).json({ error: "Migreringen er allerede rullet tilbage." });
    let metadata: any = {};
    try { metadata = JSON.parse(job.mapping || "{}"); } catch {}
    if (!entities.has(metadata.entity) || !Array.isArray(metadata.createdIds)) return void res.status(409).json({ error: "Dette ældre migreringsjob har ikke et sikkert rollback-manifest." });
    let removed = 0;
    for (const rowId of [...metadata.createdIds].reverse()) {
      const deleted = metadata.entity === "journal_entries"
        ? await deleteImportedJournalEntry(Number(rowId), cid)
        : await storage.delete(metadata.entity, Number(rowId), cid);
      if (deleted) removed += 1;
    }
    const updated = await storage.update("migration_jobs", id, { status: "rolled_back", rollbackAvailable: false, rolledBackAt: new Date().toISOString() }, cid);
    res.json({ ...updated, removedRows: removed });
  }));
}
