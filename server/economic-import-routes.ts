import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { economicImportRuns, migrationJobs } from "@shared/schema";
import { requireFeature, requireRole, tenantId } from "./auth";
import { createEconomicSnapshot, inspectEconomicYear } from "./economic-import";
import { db, storage } from "./storage";

const nowIso = () => new Date().toISOString();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);
const guarded = [requireFeature("dedikeret_onboarding"), requireRole("leder", "bogholder", "platform_admin")] as const;

function parseYear(value: unknown): string {
  const year = String(value ?? "").trim();
  if (!["2024", "2025", "2026"].includes(year)) {
    throw { status: 400, message: "Vælg 2024, 2025 eller 2026. Årene skal behandles i rækkefølge." };
  }
  return year;
}

function publicRun(run: typeof economicImportRuns.$inferSelect) {
  let manifest: unknown = {};
  try { manifest = JSON.parse(run.manifestJson || "{}"); } catch { manifest = {}; }
  return { ...run, manifestJson: undefined, manifest };
}

export function registerEconomicImportRoutes(app: Express) {
  app.get("/api/economic-import/runs", ...guarded, asyncRoute(async (req, res) => {
    const companyId = tenantId(req);
    const runs = db.select().from(economicImportRuns).where(eq(economicImportRuns.companyId, companyId))
      .orderBy(desc(economicImportRuns.id)).limit(30).all();
    res.json(runs.map(publicRun));
  }));

  app.get("/api/economic-import/runs/:id", ...guarded, asyncRoute(async (req, res) => {
    const companyId = tenantId(req);
    const run = db.select().from(economicImportRuns).where(and(
      eq(economicImportRuns.id, Number(req.params.id)), eq(economicImportRuns.companyId, companyId),
    )).get();
    if (!run) return void res.status(404).json({ error: "Importkørslen blev ikke fundet." });
    res.json(publicRun(run));
  }));

  app.post("/api/economic-import/preflight", ...guarded, asyncRoute(async (req, res) => {
    const companyId = tenantId(req);
    const year = parseYear(req.body?.accountingYear);
    const integration = await storage.getIntegration(Number(req.body?.integrationId), companyId);
    if (!integration) return void res.status(404).json({ error: "e-conomic-integrationen blev ikke fundet." });
    const run = db.insert(economicImportRuns).values({ companyId, integrationId: integration.id,
      accountingYear: year, runType: "preflight", status: "koerer", startedAt: nowIso(), manifestJson: "{}" })
      .returning().get();
    try {
      const manifest = await inspectEconomicYear(integration, year);
      const requiredProblems = manifest.coverage.filter((item) => item.required && ["fejl", "mangler_adgang"].includes(item.status));
      const finishedAt = nowIso();
      const updated = db.update(economicImportRuns).set({ status: requiredProblems.length ? "delvis" : "faerdig",
        sourceAgreementNumber: manifest.agreement.agreementNumber, sourceCompanyName: manifest.agreement.companyName,
        recordCount: Object.values(manifest.counts).reduce((sum, count) => sum + count, 0),
        warningCount: manifest.warnings.length, manifestJson: JSON.stringify({ ...manifest, completedAt: finishedAt }), finishedAt })
        .where(eq(economicImportRuns.id, run.id)).returning().get();
      res.json(publicRun(updated));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      db.update(economicImportRuns).set({ status: "fejlet", errorMessage: message, finishedAt: nowIso() })
        .where(eq(economicImportRuns.id, run.id)).run();
      res.status(502).json({ error: message, runId: run.id });
    }
  }));

  app.post("/api/economic-import/snapshot", ...guarded, asyncRoute(async (req, res) => {
    const companyId = tenantId(req);
    const year = parseYear(req.body?.accountingYear);
    const integration = await storage.getIntegration(Number(req.body?.integrationId), companyId);
    if (!integration) return void res.status(404).json({ error: "e-conomic-integrationen blev ikke fundet." });
    if (integration.provider !== "e-conomic" || !integration.apiKey || !integration.apiSecret) {
      return void res.status(400).json({ error: "Forbind først e-conomic med AppSecretToken og AgreementGrantToken." });
    }
    const preflight = db.select().from(economicImportRuns).where(and(
      eq(economicImportRuns.companyId, companyId), eq(economicImportRuns.accountingYear, year),
      eq(economicImportRuns.runType, "preflight"), inArray(economicImportRuns.status, ["faerdig", "delvis"]),
    )).orderBy(desc(economicImportRuns.id)).get();
    if (!preflight) return void res.status(409).json({
      error: `Kontrollér først, at alle data for ${year} kan hentes fra e-conomic.`,
    });
    let preflightManifest: any = {};
    try { preflightManifest = JSON.parse(preflight.manifestJson || "{}"); } catch { preflightManifest = {}; }
    const preflightFailures = Array.isArray(preflightManifest.coverage)
      ? preflightManifest.coverage.filter((item: any) => item?.required && ["fejl", "mangler_adgang"].includes(item?.status))
      : [];
    if (preflightFailures.length) return void res.status(409).json({
      error: `Kontrollen af ${year} mangler obligatoriske data. Ret adgang eller arkivopsætning før kopiering.`,
    });
    const numericYear = Number(year);
    if (numericYear > 2024) {
      const previousYear = String(numericYear - 1);
      const previous = db.select().from(economicImportRuns).where(and(
        eq(economicImportRuns.companyId, companyId), eq(economicImportRuns.accountingYear, previousYear),
        eq(economicImportRuns.runType, "snapshot"), inArray(economicImportRuns.status, ["faerdig", "delvis"]),
      )).orderBy(desc(economicImportRuns.id)).get();
      if (!previous?.approvedAt) return void res.status(409).json({
        error: `Lav, kontrollér og godkend først den skrivebeskyttede kopi af ${previousYear}. Årene skal behandles i rækkefølge.`,
      });
    }
    const active = db.select().from(economicImportRuns).where(and(
      eq(economicImportRuns.companyId, companyId), eq(economicImportRuns.accountingYear, year),
      inArray(economicImportRuns.status, ["afventer", "koerer"]),
    )).get();
    if (active) return void res.status(409).json({ error: `Der kører allerede en kopi af ${year}.`, run: publicRun(active) });

    const startedAt = nowIso();
    const run = db.insert(economicImportRuns).values({ companyId, integrationId: integration.id,
      accountingYear: year, runType: "snapshot", status: "afventer", startedAt, manifestJson: "{}" })
      .returning().get();
    const mapping = JSON.stringify({ economicImportRunId: run.id, readOnly: true });
    db.insert(migrationJobs).values({ companyId, source: "economic", sourceVersion: "REST + Documents API",
      fileName: `Skrivebeskyttet e-conomic-kopi ${year}`, mapping, totalRows: 0, importedRows: 0, errorRows: 0,
      rollbackAvailable: false, status: "importerer", createdAt: startedAt }).run();

    void createEconomicSnapshot({ integration, companyId, runId: run.id, accountingYear: year })
      .then((manifest) => {
        const total = Object.values(manifest.counts).reduce((sum, count) => sum + count, 0);
        db.update(migrationJobs).set({ totalRows: total, importedRows: total, errorRows: manifest.warnings.length,
          validationErrors: manifest.warnings.length ? JSON.stringify(manifest.warnings) : null,
          status: manifest.warnings.length ? "validerer" : "færdig" })
          .where(and(eq(migrationJobs.companyId, companyId), eq(migrationJobs.mapping, mapping))).run();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        db.update(migrationJobs).set({ errorRows: 1, validationErrors: JSON.stringify([message]), status: "fejlet" })
          .where(and(eq(migrationJobs.companyId, companyId), eq(migrationJobs.mapping, mapping))).run();
      });
    res.status(202).json(publicRun(run));
  }));

  app.post("/api/economic-import/runs/:id/approve", ...guarded, asyncRoute(async (req, res) => {
    const companyId = tenantId(req);
    const run = db.select().from(economicImportRuns).where(and(
      eq(economicImportRuns.id, Number(req.params.id)), eq(economicImportRuns.companyId, companyId),
      eq(economicImportRuns.runType, "snapshot"),
    )).get();
    if (!run) return void res.status(404).json({ error: "Den skrivebeskyttede kopi blev ikke fundet." });
    if (!["faerdig", "delvis"].includes(run.status)) {
      return void res.status(409).json({ error: "Kopien skal være færdig, før den kan godkendes." });
    }
    let manifest: any = {};
    try { manifest = JSON.parse(run.manifestJson || "{}"); } catch { manifest = {}; }
    const requiredFailures = Array.isArray(manifest.coverage)
      ? manifest.coverage.filter((item: any) => item?.required && ["fejl", "mangler_adgang"].includes(item?.status))
      : [];
    if (requiredFailures.length) {
      return void res.status(409).json({ error: "Kopien mangler obligatoriske regnskabsdata og kan ikke godkendes endnu." });
    }
    const approved = db.update(economicImportRuns).set({ approvedAt: nowIso(), approvedBy: req.auth!.userId })
      .where(eq(economicImportRuns.id, run.id)).returning().get();
    res.json(publicRun(approved));
  }));
}
