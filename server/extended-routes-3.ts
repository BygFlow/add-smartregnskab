import { Router, type Express } from "express";
import { db, readVerifiedBackup } from "../server/storage";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId } from "./auth";
import { ensureRegulatorySources, monitorRegulatorySources } from "./regulatory-monitor";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Tables that have companyId column
const COMPANY_TABLES = new Set([
  "businessProfiles", "dimensionDefinitions", "accountingCategoryRules",
  "workflowDefinitions", "workflowRuns", "fileObjects", "fileVersions", "complianceDocuments", "controlTests",
  "securityAuditEvents", "deliveryLogs", "customerPortalSettings", "portalDocuments",
  "offlineConflicts", "pushSubscriptions", "navigationFavorites", "dimensionValues",
  "platformSyncJobs", "platformSyncMappings", "integrationRuns", "integrationRetryQueue",
]);

// Tables without companyId (shared/system-level)
const SYSTEM_TABLES = new Set([
  "industryAccountTemplates", "systemHealthEvents",
]);

function crud(app: Express, basePath: string, table: any, hasCompany: boolean, platformReadOnly = false) {
  const getCompanyId = (req: any): number | null => {
    if (!hasCompany) return null;
    return tenantId(req);
  };

  app.get(basePath, h(async (req, res) => {
    if (platformReadOnly && !req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministratorer har adgang." });
    const cid = getCompanyId(req);
    if (cid !== null && "companyId" in table) {
      const rows = db.select().from(table).where(eq(table.companyId, cid)).all();
      res.json(rows);
    } else {
      const rows = db.select().from(table).all();
      res.json(rows);
    }
  }));

  app.post(basePath, h(async (req, res) => {
    if (!hasCompany && !req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministratorer kan ændre globale data." });
    const cid = getCompanyId(req);
    const data = cid !== null && "companyId" in table
      ? { ...req.body, companyId: cid, createdAt: new Date().toISOString() }
      : { ...req.body, createdAt: new Date().toISOString() };
    const row = db.insert(table).values(data).returning().get();
    res.json(row);
  }));

  app.patch(`${basePath}/:id`, h(async (req, res) => {
    if (!hasCompany && !req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministratorer kan ændre globale data." });
    const cid = getCompanyId(req);
    const id = parseInt(req.params.id);
    const { id: _ignoredId, companyId: _ignoredCompanyId, createdAt: _ignoredCreatedAt, ...safeBody } = req.body ?? {};
    if (cid !== null && "companyId" in table) {
      const row = db.update(table).set(safeBody).where(and(eq(table.id, id), eq(table.companyId, cid))).returning().get();
      res.json(row);
    } else {
      const row = db.update(table).set(safeBody).where(eq(table.id, id)).returning().get();
      res.json(row);
    }
  }));

  app.delete(`${basePath}/:id`, h(async (req, res) => {
    if (!hasCompany && !req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministratorer kan ændre globale data." });
    const cid = getCompanyId(req);
    const id = parseInt(req.params.id);
    if (cid !== null && "companyId" in table) {
      db.delete(table).where(and(eq(table.id, id), eq(table.companyId, cid))).run();
    } else {
      db.delete(table).where(eq(table.id, id)).run();
    }
    res.json({ success: true });
  }));
}

export function registerExtendedRoutes3(app: Express) {
  const defaultApprovalActions = [
    "tax_submission", "vat_submission", "payment", "payroll_submission",
    "period_close", "annual_report", "audit_statement", "credit_note",
    "legal_rule_change", "user_access", "data_deletion",
  ];
  const canApprove = (req: any) => ["leder", "platform_admin"].includes(req.auth?.user?.role ?? req.auth?.role ?? "");

  const getGovernance = (companyId: number) => {
    let settings = db.select().from(schema.aiGovernanceSettings)
      .where(eq(schema.aiGovernanceSettings.companyId, companyId)).get();
    if (!settings) {
      settings = db.insert(schema.aiGovernanceSettings).values({
        companyId, enabled: true, targetAutonomyPercent: 99, minimumConfidence: 0.98,
        requireEvidence: true, approvalActions: JSON.stringify(defaultApprovalActions),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }).returning().get();
    }
    return settings;
  };

  app.get("/api/ai-governance", h(async (req, res) => {
    const cid = tenantId(req);
    ensureRegulatorySources();
    const settings = getGovernance(cid);
    const decisions = db.select().from(schema.aiDecisionLogs)
      .where(eq(schema.aiDecisionLogs.companyId, cid))
      .orderBy(desc(schema.aiDecisionLogs.proposedAt)).limit(100).all();
    const sources = db.select().from(schema.regulatorySources).all();
    const changes = db.select().from(schema.regulatoryChanges)
      .orderBy(desc(schema.regulatoryChanges.detectedAt)).limit(100).all();
    res.json({
      settings: { ...settings, approvalActions: JSON.parse(settings.approvalActions || "[]") },
      decisions, regulatorySources: sources, regulatoryChanges: changes,
      summary: {
        pendingApprovals: decisions.filter((item) => item.status === "afventer_godkendelse").length,
        automaticallyCleared: decisions.filter((item) => item.status === "klar_til_automatisk_udfoerelse").length,
        pendingLegalReviews: changes.filter((item) => item.status === "afventer_faglig_godkendelse").length,
      },
    });
  }));

  app.patch("/api/ai-governance/settings", h(async (req, res) => {
    if (!canApprove(req)) return res.status(403).json({ error: "Kun leder eller platformadministrator kan ændre AI-politikken." });
    const cid = tenantId(req);
    const current = getGovernance(cid);
    const target = Math.min(99, Math.max(0, Number(req.body?.targetAutonomyPercent ?? current.targetAutonomyPercent)));
    const confidence = Math.min(1, Math.max(0.5, Number(req.body?.minimumConfidence ?? current.minimumConfidence)));
    const requestedActions = Array.isArray(req.body?.approvalActions) ? req.body.approvalActions.map(String) : JSON.parse(current.approvalActions);
    const approvalActions = Array.from(new Set([...defaultApprovalActions, ...requestedActions]));
    const updated = db.update(schema.aiGovernanceSettings).set({
      enabled: req.body?.enabled === undefined ? current.enabled : Boolean(req.body.enabled),
      targetAutonomyPercent: target, minimumConfidence: confidence,
      requireEvidence: req.body?.requireEvidence === undefined ? current.requireEvidence : Boolean(req.body.requireEvidence),
      approvalActions: JSON.stringify(approvalActions), updatedAt: new Date().toISOString(),
    }).where(and(eq(schema.aiGovernanceSettings.id, current.id), eq(schema.aiGovernanceSettings.companyId, cid))).returning().get();
    res.json({ ...updated, approvalActions });
  }));

  app.post("/api/ai-governance/decisions", h(async (req, res) => {
    const cid = tenantId(req);
    const settings = getGovernance(cid);
    if (!settings.enabled) return res.status(409).json({ error: "AI-styring er slået fra for virksomheden." });
    const actionType = String(req.body?.actionType ?? "").trim();
    const recommendation = String(req.body?.recommendation ?? "").trim();
    const reasoning = String(req.body?.reasoning ?? "").trim();
    const evidence = Array.isArray(req.body?.evidence) ? req.body.evidence : [];
    const confidence = Math.min(1, Math.max(0, Number(req.body?.confidence ?? 0)));
    const riskLevel = String(req.body?.riskLevel ?? "lav").toLowerCase();
    if (!actionType || !recommendation || !reasoning) return res.status(400).json({ error: "Handling, anbefaling og begrundelse er påkrævet." });
    const approvalActions = new Set<string>(JSON.parse(settings.approvalActions || "[]"));
    const requiresApproval = approvalActions.has(actionType)
      || ["høj", "hoej", "kritisk"].includes(riskLevel)
      || confidence < settings.minimumConfidence
      || (settings.requireEvidence && evidence.length === 0);
    const item = db.insert(schema.aiDecisionLogs).values({
      companyId: cid, actionType,
      entityType: req.body?.entityType ? String(req.body.entityType) : null,
      entityId: Number.isInteger(Number(req.body?.entityId)) ? Number(req.body.entityId) : null,
      recommendation, reasoning, evidence: JSON.stringify(evidence),
      model: req.body?.model ? String(req.body.model) : null,
      confidence, riskLevel, requiresApproval,
      status: requiresApproval ? "afventer_godkendelse" : "klar_til_automatisk_udfoerelse",
      proposedAt: new Date().toISOString(),
    }).returning().get();
    res.status(201).json(item);
  }));

  app.post("/api/ai-governance/decisions/:id/:decision", h(async (req, res) => {
    if (!canApprove(req)) return res.status(403).json({ error: "Kun leder eller platformadministrator kan godkende AI-beslutninger." });
    const cid = tenantId(req);
    const decision = req.params.decision;
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ error: "Vælg approve eller reject." });
    const current = db.select().from(schema.aiDecisionLogs).where(and(
      eq(schema.aiDecisionLogs.id, Number(req.params.id)), eq(schema.aiDecisionLogs.companyId, cid),
    )).get();
    if (!current) return res.status(404).json({ error: "AI-beslutningen blev ikke fundet." });
    if (current.status !== "afventer_godkendelse") return res.status(409).json({ error: "Beslutningen er allerede behandlet." });
    const updated = db.update(schema.aiDecisionLogs).set({
      status: decision === "approve" ? "godkendt" : "afvist",
      decidedBy: req.auth.user.id, decidedAt: new Date().toISOString(),
      decisionNote: req.body?.note ? String(req.body.note) : null,
    }).where(and(eq(schema.aiDecisionLogs.id, current.id), eq(schema.aiDecisionLogs.companyId, cid))).returning().get();
    res.json(updated);
  }));

  app.post("/api/regulatory-monitor/run", h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministrator kan starte regelovervågning manuelt." });
    res.json(await monitorRegulatorySources());
  }));

  app.post("/api/regulatory-changes/:id/:decision", h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministrator kan behandle regelændringer." });
    const decision = req.params.decision;
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ error: "Vælg approve eller reject." });
    const current = db.select().from(schema.regulatoryChanges).where(eq(schema.regulatoryChanges.id, Number(req.params.id))).get();
    if (!current) return res.status(404).json({ error: "Regelændringen blev ikke fundet." });
    const updated = db.update(schema.regulatoryChanges).set({
      status: decision === "approve" ? "fagligt_godkendt" : "afvist",
      reviewedBy: req.auth.user.id, reviewedAt: new Date().toISOString(),
      notes: req.body?.notes ? String(req.body.notes) : null,
    }).where(eq(schema.regulatoryChanges.id, current.id)).returning().get();
    res.json(updated);
  }));

  // ── Samlet kontrolcenter ──
  // Ét tenant-isoleret beslutningsgrundlag på tværs af bogføring, bank,
  // frister, integrationer, compliance og backup. Alle tal beregnes af
  // serveren, så klienten ikke kan komme til at blande virksomheders data.
  app.get("/api/accounting-control-center", h(async (req, res) => {
    const cid = tenantId(req);
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const companyRows = <T extends { companyId: number }>(table: any): T[] =>
      db.select().from(table).where(eq(table.companyId, cid)).all() as T[];

    const invoices = companyRows<any>(schema.invoices);
    const entries = companyRows<any>(schema.journalEntries);
    const bankTransactions = companyRows<any>(schema.bankTransactions);
    const vouchers = companyRows<any>(schema.vouchers);
    const deadlines = companyRows<any>(schema.taxDeadlines);
    const integrations = companyRows<any>(schema.integrationRuns);
    const compliance = companyRows<any>(schema.complianceChecks);
    const backups = db.select().from(schema.backupJobs)
      .where(eq(schema.backupJobs.companyId, cid)).all() as any[];

    const openInvoiceStatuses = new Set(["kladde", "sendt", "forfalden", "delvist_betalt"]);
    const overdueInvoices = invoices.filter((row) =>
      row.dueDate && row.dueDate < today && openInvoiceStatuses.has(String(row.status)),
    );
    const draftEntries = entries.filter((row) => row.status === "kladde");
    const pendingBank = bankTransactions.filter((row) => row.status === "afventer");
    const uncodedVouchers = vouchers.filter((row) =>
      row.status === "kladde" || !row.accountId || !row.category,
    );
    const overdueDeadlines = deadlines.filter((row) =>
      row.deadline && row.deadline < today && !["indsendt", "betalt"].includes(String(row.status)),
    );
    const upcomingDeadlines = deadlines.filter((row) => {
      if (!row.deadline || ["indsendt", "betalt"].includes(String(row.status))) return false;
      const days = (new Date(`${row.deadline}T23:59:59Z`).getTime() - now) / 86_400_000;
      return days >= 0 && days <= 30;
    });
    const failedIntegrations = integrations.filter((row) =>
      ["fejlet", "error", "failed"].includes(String(row.status).toLowerCase()) || Number(row.recordsFailed) > 0,
    );
    const openCompliance = compliance.filter((row) =>
      !["bestået", "godkendt", "ok", "passed"].includes(String(row.status).toLowerCase()),
    );
    const completedBackups = backups
      .filter((row) => row.status === "fuldfort")
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const latestBackup = completedBackups[0] ?? null;
    const backupAgeHours = latestBackup?.createdAt
      ? Math.max(0, Math.round((now - new Date(latestBackup.createdAt).getTime()) / 3_600_000))
      : null;

    const checks = [
      { key: "bank", label: "Bank afstemt", weight: 15, ok: pendingBank.length === 0, count: pendingBank.length },
      { key: "invoices", label: "Ingen forfaldne fakturaer", weight: 15, ok: overdueInvoices.length === 0, count: overdueInvoices.length },
      { key: "journal", label: "Ingen åbne kladder", weight: 10, ok: draftEntries.length === 0, count: draftEntries.length },
      { key: "vouchers", label: "Bilag er konteret", weight: 10, ok: uncodedVouchers.length === 0, count: uncodedVouchers.length },
      { key: "deadlines", label: "Ingen overskredne frister", weight: 20, ok: overdueDeadlines.length === 0, count: overdueDeadlines.length },
      { key: "backup", label: "Backup under 24 timer gammel", weight: 15, ok: backupAgeHours !== null && backupAgeHours <= 24, count: latestBackup ? 0 : 1 },
      { key: "integrations", label: "Integrationer kører stabilt", weight: 5, ok: failedIntegrations.length === 0, count: failedIntegrations.length },
      { key: "compliance", label: "Kontroller er afsluttet", weight: 10, ok: compliance.length > 0 && openCompliance.length === 0, count: openCompliance.length },
    ];
    const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);

    const actions = [
      overdueDeadlines.length && { id: "overdue-deadlines", severity: "critical", title: "Indsend overskredne frister", detail: `${overdueDeadlines.length} frist(er) er overskredet.`, count: overdueDeadlines.length, route: "/smartregnskab/app/moms" },
      overdueInvoices.length && { id: "overdue-invoices", severity: "critical", title: "Følg op på forfaldne fakturaer", detail: `${overdueInvoices.length} faktura(er) kræver opfølgning eller rykkerflow.`, count: overdueInvoices.length, route: "/smartregnskab/app/debitorstyring" },
      pendingBank.length && { id: "pending-bank", severity: "warning", title: "Afstem banktransaktioner", detail: `${pendingBank.length} post(er) mangler match.`, count: pendingBank.length, route: "/smartregnskab/app/bank" },
      uncodedVouchers.length && { id: "uncoded-vouchers", severity: "warning", title: "Konter bilag", detail: `${uncodedVouchers.length} bilag mangler færdig kontering.`, count: uncodedVouchers.length, route: "/smartregnskab/app/bilag" },
      draftEntries.length && { id: "draft-entries", severity: "warning", title: "Gennemgå bogføringskladder", detail: `${draftEntries.length} kladde(r) er ikke bogført.`, count: draftEntries.length, route: "/smartregnskab/app/kontoplan" },
      (!latestBackup || (backupAgeHours ?? Infinity) > 24) && { id: "backup", severity: "warning", title: "Opret og verificér backup", detail: latestBackup ? `Seneste backup er ${backupAgeHours} timer gammel.` : "Der findes endnu ingen fuldført virksomhedsbackup.", count: 1, route: "/smartregnskab/app/backup_regnskab" },
      failedIntegrations.length && { id: "integration-errors", severity: "warning", title: "Ret integrationsfejl", detail: `${failedIntegrations.length} kørsel/kørsler har fejl.`, count: failedIntegrations.length, route: "/smartregnskab/app/integration_runs" },
      (compliance.length === 0 || openCompliance.length > 0) && { id: "compliance", severity: "info", title: "Gennemfør compliance-kontroller", detail: compliance.length === 0 ? "Der er ikke registreret kontroller endnu." : `${openCompliance.length} kontrol(ler) er ikke afsluttet.`, count: openCompliance.length, route: "/smartregnskab/app/compliance_checks" },
    ].filter(Boolean);

    res.json({
      generatedAt: new Date().toISOString(),
      score,
      readiness: score >= 90 ? "klar" : score >= 70 ? "opmærksomhed" : "handling_påkrævet",
      checks,
      actions,
      totals: {
        overdueInvoices: overdueInvoices.length,
        pendingBankTransactions: pendingBank.length,
        uncodedVouchers: uncodedVouchers.length,
        draftEntries: draftEntries.length,
        overdueDeadlines: overdueDeadlines.length,
        upcomingDeadlines: upcomingDeadlines.length,
        failedIntegrations: failedIntegrations.length,
      },
      backup: latestBackup ? { id: latestBackup.id, createdAt: latestBackup.createdAt, ageHours: backupAgeHours } : null,
      legal: {
        registeredBookkeepingSystem: "not_verified",
        message: "Kontrolcenteret er driftsstøtte og udgør ikke myndighedsgodkendelse eller juridisk rådgivning.",
      },
    });
  }));

  // ── SmartRegnskab branche-uafhængighed ──
  crud(app, "/api/business-profiles", schema.businessProfiles, true);
  crud(app, "/api/industry-account-templates", schema.industryAccountTemplates, false);
  crud(app, "/api/dimension-definitions", schema.dimensionDefinitions, true);
  crud(app, "/api/dimension-values", schema.dimensionValues, true);
  crud(app, "/api/accounting-category-rules", schema.accountingCategoryRules, true);

  // ── Sammenkobling & workflow ──
  crud(app, "/api/platform-sync-jobs", schema.platformSyncJobs, true);
  crud(app, "/api/platform-sync-mappings", schema.platformSyncMappings, true);
  crud(app, "/api/workflow-definitions", schema.workflowDefinitions, true);
  crud(app, "/api/workflow-runs", schema.workflowRuns, true);

  // Extra: trigger sync
  app.post("/api/platform-sync-jobs/trigger", h(async (req, res) => {
    const { sourcePlatform, targetPlatform, syncType } = req.body;
    const job = db.insert(schema.platformSyncJobs).values({
      companyId: tenantId(req),
      sourcePlatform: sourcePlatform || "smartdrift_clean",
      targetPlatform: targetPlatform || "smartregnskab",
      syncType: syncType || "kunder",
      status: "synkroniserer",
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }).returning().get();
    db.update(schema.platformSyncJobs).set({
      status: "gennemført",
      syncedRecords: 0,
      completedAt: new Date().toISOString(),
    }).where(eq(schema.platformSyncJobs.id, job.id)).run();
    res.json({ ...job, status: "gennemført" });
  }));

  // Extra: trigger workflow
  app.post("/api/workflow-definitions/:id/run", h(async (req, res) => {
    const cid = tenantId(req);
    const wf = db.select().from(schema.workflowDefinitions).where(and(eq(schema.workflowDefinitions.id, parseInt(req.params.id)), eq(schema.workflowDefinitions.companyId, cid))).get();
    if (!wf) return res.status(404).json({ error: "Workflow not found" });
    const run = db.insert(schema.workflowRuns).values({
      companyId: cid,
      workflowId: wf.id,
      trigger: wf.trigger,
      status: "gennemført",
      currentStep: 1,
      totalSteps: 1,
      result: "Workflow gennemført automatisk",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }).returning().get();
    res.json(run);
  }));

  // ── Filhåndtering ──
  crud(app, "/api/file-objects", schema.fileObjects, true);
  crud(app, "/api/file-versions", schema.fileVersions, true);

  // ── Compliance & dokumentation ──
  crud(app, "/api/compliance-documents", schema.complianceDocuments, true);
  crud(app, "/api/control-tests", schema.controlTests, true);

  // ── Sikkerhed & drift ──
  crud(app, "/api/security-audit-events", schema.securityAuditEvents, true);
  crud(app, "/api/integration-runs", schema.integrationRuns, true);
  crud(app, "/api/integration-retry-queue", schema.integrationRetryQueue, true);
  crud(app, "/api/system-health-events", schema.systemHealthEvents, false, true);
  crud(app, "/api/delivery-logs", schema.deliveryLogs, true);

  // Extra: retry queue process
  app.post("/api/integration-retry-queue/:id/retry", h(async (req, res) => {
    const cid = tenantId(req);
    const id = parseInt(req.params.id);
    const item = db.update(schema.integrationRetryQueue).set({
      retryCount: (db.select().from(schema.integrationRetryQueue).where(and(eq(schema.integrationRetryQueue.id, id), eq(schema.integrationRetryQueue.companyId, cid))).get()?.retryCount || 0) + 1,
      status: "afventer",
      nextRetryAt: new Date(Date.now() + 60000).toISOString(),
    }).where(and(eq(schema.integrationRetryQueue.id, id), eq(schema.integrationRetryQueue.companyId, cid))).returning().get();
    if (!item) return res.status(404).json({ error: "Elementet blev ikke fundet." });
    res.json(item);
  }));

  // ── Portal & navigation ──
  crud(app, "/api/customer-portal-settings", schema.customerPortalSettings, true);
  crud(app, "/api/portal-documents", schema.portalDocuments, true);
  crud(app, "/api/offline-conflicts", schema.offlineConflicts, true);
  crud(app, "/api/push-subscriptions", schema.pushSubscriptions, true);
  crud(app, "/api/navigation-favorites", schema.navigationFavorites, true);

  // Extra: resolve offline conflict
  app.post("/api/offline-conflicts/:id/resolve", h(async (req, res) => {
    const { resolution } = req.body;
    const cid = tenantId(req);
    const item = db.update(schema.offlineConflicts).set({
      status: "løst",
      resolution: resolution || "Løst automatisk",
      resolvedAt: new Date().toISOString(),
    }).where(and(eq(schema.offlineConflicts.id, parseInt(req.params.id)), eq(schema.offlineConflicts.companyId, cid))).returning().get();
    res.json(item);
  }));

  // ── Backup system (enhanced) ──
  app.get("/api/backups/:id/details", h(async (req, res) => {
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId === null ? !req.auth?.isPlatformAdmin : backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const checksum = backup.summary ? JSON.parse(backup.summary).checksum || null : null;
    res.json({ ...backup, checksum, canRestore: backup.status === "fuldfort" });
  }));

  app.post("/api/backups/:id/verify", h(async (req, res) => {
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId === null ? !req.auth?.isPlatformAdmin : backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const summary = backup.summary ? JSON.parse(backup.summary) : {};
    if (!summary.path || !summary.checksum) return res.status(409).json({ error: "Denne ældre backup har intet verificerbart artefakt." });
    await readVerifiedBackup(summary.path, summary.checksum);
    res.json({ verified: true, checksum: summary.checksum, message: "Integritet verificeret" });
  }));

  app.post("/api/backups/:id/restore-dry-run", h(async (req, res) => {
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId === null ? !req.auth?.isPlatformAdmin : backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    res.json({
      canRestore: backup.status === "fuldfort",
      affectedTables: ["invoices", "tasks", "time_entries", "customers", "employees"],
      estimatedRows: backup.summary ? JSON.parse(backup.summary).rows || 0 : 0,
      warning: "Gendannelse vil overskrive eksisterende data. Bekræft med forsigtighed.",
      requiresConfirmation: true,
    });
  }));

  app.get("/api/backups/:id/download", h(async (req, res) => {
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId === null ? !req.auth?.isPlatformAdmin : backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const summary = backup.summary ? JSON.parse(backup.summary) : {};
    if (!summary.path || !summary.checksum) return res.status(409).json({ error: "Denne ældre backup har intet downloadbart artefakt." });
    const data = await readVerifiedBackup(summary.path, summary.checksum);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${backup.id}-${backup.createdAt?.slice(0, 10)}.asrb"`);
    res.send(data);
  }));

  app.post("/api/backups/:id/retention", h(async (req, res) => {
    const cid = tenantId(req);
    const { retentionDays } = req.body;
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId === null ? !req.auth?.isPlatformAdmin : backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const expiryDate = new Date(Date.now() + (retentionDays || 30) * 86400000).toISOString();
    res.json({ backupId: backup.id, retentionDays: retentionDays || 30, expiresAt: expiryDate });
  }));
}
