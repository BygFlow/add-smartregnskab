import express, { type Express, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { requireRole } from "./auth";
import { db } from "./storage";
import { accounts, backupJobs, companies, journalEntries, journalLines } from "@shared/schema";
import { commitSaftImport, generateSaft, parseSaft, saftPreflight, SAFT_VERSION, STANDARD_ACCOUNT_VERSION } from "./saft";
import { createExternalBackup, externalBackupConfigured, verifyExternalBackup } from "./backup-service";

const companyId = (req: Request) => Number((req as any).auth?.companyId);
const actor = (req: Request) => String((req as any).auth?.user?.email || (req as any).auth?.userId || "system");
const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);

export function registerComplianceRoutes(app: Express) {
  app.get("/api/saft/accounts", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    res.json(db.select().from(accounts).where(eq(accounts.companyId, companyId(req))).all().map((account) => ({ id: account.id, accountNumber: account.accountNumber, name: account.name, standardAccountNumber: account.standardAccountNumber, active: account.active })));
  }));
  app.patch("/api/saft/accounts/:id", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = companyId(req);
    const id = Number(req.params.id);
    const existing = db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.companyId, cid))).get();
    if (!existing) return void res.status(404).json({ error: "Kontoen findes ikke." });
    const number = String(req.body?.standardAccountNumber || "").trim();
    if (number && !/^\d{4}$/.test(number)) return void res.status(400).json({ error: "Standardkontonummeret skal være 4 cifre." });
    const updated = db.update(accounts).set({ standardAccountNumber: number || null }).where(and(eq(accounts.id, id), eq(accounts.companyId, cid))).returning().get();
    res.json(updated);
  }));
  app.get("/api/saft/status", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const cid = companyId(req);
    const company = db.select().from(companies).where(eq(companies.id, cid)).get();
    const accountRows = db.select().from(accounts).where(eq(accounts.companyId, cid)).all();
    const entryRows = db.select().from(journalEntries).where(eq(journalEntries.companyId, cid)).all().filter((entry) => ["bogført", "bogfort", "afstemt"].includes(entry.status));
    const lineRows = db.select().from(journalLines).where(eq(journalLines.companyId, cid)).all();
    const errors = saftPreflight(company, accountRows, entryRows, lineRows.filter((line) => entryRows.some((entry) => entry.id === line.journalEntryId)));
    res.json({ ready: errors.length === 0, version: SAFT_VERSION, standardAccountVersion: STANDARD_ACCOUNT_VERSION, errors, unmappedAccounts: accountRows.filter((account) => !account.standardAccountNumber).length });
  }));

  app.get("/api/saft/export", requireRole("leder", "platform_admin"), asyncRoute(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);
    const from = String(req.query.from || `${year}-01-01`);
    const to = String(req.query.to || today);
    const result = await generateSaft(companyId(req), from, to, actor(req));
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("X-SAF-T-Version", result.summary.version);
    res.send(result.xml);
  }));

  const xmlBody = express.text({ type: ["application/xml", "text/xml", "application/octet-stream"], limit: "25mb" });
  app.post("/api/saft/import/preview", requireRole("leder", "platform_admin"), xmlBody, asyncRoute(async (req, res) => {
    const preview = parseSaft(String(req.body || ""));
    res.json({ ...preview, importToken: createHash("sha256").update(String(req.body || "")).digest("hex") });
  }));
  app.post("/api/saft/import", requireRole("leder", "platform_admin"), xmlBody, asyncRoute(async (req, res) => {
    const preview = parseSaft(String(req.body || ""));
    const result = commitSaftImport(companyId(req), preview);
    res.status(201).json({ ...result, version: preview.version, totalDebit: preview.totalDebit, totalCredit: preview.totalCredit });
  }));

  app.get("/api/external-backup/status", requireRole("platform_admin"), asyncRoute(async (_req, res) => {
    res.json({ configured: externalBackupConfigured(), provider: "s3-compatible", encryptedAtRest: true, integrity: "sha256-and-sqlite-quick-check" });
  }));
  app.post("/api/external-backup/run", requireRole("platform_admin"), asyncRoute(async (req, res) => {
    const startedAt = new Date().toISOString();
    const job = db.insert(backupJobs).values({ companyId: null, scope: "platform", status: "igang", destination: "s3", createdBy: actor(req), createdAt: startedAt }).returning().get();
    try {
      const result = await createExternalBackup();
      const summary = JSON.stringify({ key: result.key, checksum: result.checksum, verified: result.verified });
      db.update(backupJobs).set({ status: "fuldfort", size: String(result.size), summary }).where(eq(backupJobs.id, job.id)).run();
      res.status(201).json({ backupId: job.id, key: result.key, size: result.size, checksum: result.checksum, verified: result.verified });
    } catch (error: any) {
      db.update(backupJobs).set({ status: "fejlet", summary: JSON.stringify({ error: String(error?.message || error) }) }).where(eq(backupJobs.id, job.id)).run();
      throw error;
    }
  }));
  app.post("/api/external-backup/verify", requireRole("platform_admin"), asyncRoute(async (req, res) => {
    const key = String(req.body?.key || "");
    if (!key) return void res.status(400).json({ error: "Backupnøgle mangler." });
    res.json(await verifyExternalBackup(key));
  }));
}
