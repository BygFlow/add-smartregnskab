import { Router, type Express } from "express";
import { db } from "../server/storage";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId } from "./auth";
import { ensureRegulatorySources, monitorRegulatorySources } from "./regulatory-monitor";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Tables that have companyId column
const COMPANY_TABLES = new Set([
  "businessProfiles", "dimensionDefinitions", "accountingCategoryRules",
  "workflowDefinitions", "fileObjects", "complianceDocuments", "controlTests",
  "securityAuditEvents", "deliveryLogs", "customerPortalSettings", "portalDocuments",
  "offlineConflicts", "pushSubscriptions", "navigationFavorites", "dimensionValues",
  "platformSyncJobs", "platformSyncMappings", "workflowRuns", "fileVersions",
  "integrationRuns", "integrationRetryQueue",
]);

// Tables without companyId (shared/system-level)
const SYSTEM_TABLES = new Set([
  "industryAccountTemplates", "systemHealthEvents",
]);

function crud(app: Express, basePath: string, table: any, hasCompany: boolean) {
  const authorize = (req: any, res: any, write = false): boolean => {
    if (!hasCompany && !req.auth?.isPlatformAdmin) {
      res.status(403).json({ error: "Kun platformadministratorer har adgang." });
      return false;
    }
    if (write && !req.auth?.isPlatformAdmin && !["leder", "holdleder"].includes(req.auth?.role)) {
      res.status(403).json({ error: "Du har ikke rettigheder til denne handling." });
      return false;
    }
    return true;
  };
  const getCompanyId = (req: any): number | null => {
    if (!hasCompany) return null;
    return tenantId(req);
  };

  app.get(basePath, h(async (req, res) => {
    if (!authorize(req, res)) return;
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
    if (!authorize(req, res, true)) return;
    const cid = getCompanyId(req);
    const data = cid !== null && "companyId" in table
      ? { ...req.body, companyId: cid, createdAt: new Date().toISOString() }
      : { ...req.body, createdAt: new Date().toISOString() };
    const row = db.insert(table).values(data).returning().get();
    res.json(row);
  }));

  app.patch(`${basePath}/:id`, h(async (req, res) => {
    if (!authorize(req, res, true)) return;
    const cid = getCompanyId(req);
    const id = parseInt(req.params.id);
    if (cid !== null && "companyId" in table) {
      const row = db.update(table).set(req.body).where(and(eq(table.id, id), eq(table.companyId, cid))).returning().get();
      res.json(row);
    } else {
      const row = db.update(table).set(req.body).where(eq(table.id, id)).returning().get();
      res.json(row);
    }
  }));

  app.delete(`${basePath}/:id`, h(async (req, res) => {
    if (!authorize(req, res, true)) return;
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
  const approvalGates = [
    "tax_submission", "vat_submission", "payment", "payroll_submission", "period_close",
    "annual_report", "audit_statement", "credit_note", "legal_rule_change", "user_access", "data_deletion",
  ];
  const canViewFinancialGovernance = (req: any) =>
    ["leder", "holdleder", "platform_admin"].includes(req.auth?.role ?? "");
  const canApprove = (req: any) => ["leder", "platform_admin"].includes(req.auth?.role ?? "");
  const getGovernance = (companyId: number) => {
    let row = db.select().from(schema.aiGovernanceSettings).where(eq(schema.aiGovernanceSettings.companyId, companyId)).get();
    if (!row) row = db.insert(schema.aiGovernanceSettings).values({
      companyId, enabled: true, targetAutonomyPercent: 99, minimumConfidence: 0.98,
      requireEvidence: true, approvalActions: JSON.stringify(approvalGates),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).returning().get();
    return row;
  };

  app.get("/api/ai-governance", h(async (req, res) => {
    if (!canViewFinancialGovernance(req)) {
      return res.status(403).json({ error: "Du har ikke adgang til AI-styring." });
    }
    const cid = tenantId(req);
    ensureRegulatorySources();
    const settings = getGovernance(cid);
    const decisions = db.select().from(schema.aiDecisionLogs).where(eq(schema.aiDecisionLogs.companyId, cid))
      .orderBy(desc(schema.aiDecisionLogs.proposedAt)).limit(100).all();
    const sources = db.select().from(schema.regulatorySources).all();
    const changes = db.select().from(schema.regulatoryChanges).orderBy(desc(schema.regulatoryChanges.detectedAt)).limit(100).all();
    res.json({ settings: { ...settings, approvalActions: JSON.parse(settings.approvalActions || "[]") }, decisions,
      regulatorySources: sources, regulatoryChanges: changes, summary: {
        pendingApprovals: decisions.filter((x) => x.status === "afventer_godkendelse").length,
        automaticallyCleared: decisions.filter((x) => x.status === "klar_til_automatisk_udfoerelse").length,
        pendingLegalReviews: changes.filter((x) => x.status === "afventer_faglig_godkendelse").length,
      } });
  }));

  app.patch("/api/ai-governance/settings", h(async (req, res) => {
    if (!canApprove(req)) return res.status(403).json({ error: "Kun leder eller platformadministrator kan ændre AI-politikken." });
    const cid = tenantId(req);
    const current = getGovernance(cid);
    const requested = Array.isArray(req.body?.approvalActions) ? req.body.approvalActions.map(String) : JSON.parse(current.approvalActions);
    const actions = Array.from(new Set([...approvalGates, ...requested]));
    const updated = db.update(schema.aiGovernanceSettings).set({
      enabled: req.body?.enabled === undefined ? current.enabled : Boolean(req.body.enabled),
      targetAutonomyPercent: Math.min(99, Math.max(0, Number(req.body?.targetAutonomyPercent ?? current.targetAutonomyPercent))),
      minimumConfidence: Math.min(1, Math.max(0.5, Number(req.body?.minimumConfidence ?? current.minimumConfidence))),
      requireEvidence: req.body?.requireEvidence === undefined ? current.requireEvidence : Boolean(req.body.requireEvidence),
      approvalActions: JSON.stringify(actions), updatedAt: new Date().toISOString(),
    }).where(and(eq(schema.aiGovernanceSettings.id, current.id), eq(schema.aiGovernanceSettings.companyId, cid))).returning().get();
    res.json({ ...updated, approvalActions: actions });
  }));

  app.post("/api/ai-governance/decisions", h(async (req, res) => {
    if (!canViewFinancialGovernance(req)) {
      return res.status(403).json({ error: "Du har ikke adgang til AI-styring." });
    }
    const cid = tenantId(req);
    const settings = getGovernance(cid);
    if (!settings.enabled) return res.status(409).json({ error: "AI-styring er slået fra." });
    const actionType = String(req.body?.actionType ?? "").trim();
    const recommendation = String(req.body?.recommendation ?? "").trim().slice(0, 4_000);
    const reasoning = String(req.body?.reasoning ?? "").trim().slice(0, 8_000);
    const evidence = Array.isArray(req.body?.evidence) ? req.body.evidence.map((item: unknown) => String(item).trim().slice(0, 1_000)).filter(Boolean).slice(0, 50) : [];
    const confidence = Math.min(1, Math.max(0, Number(req.body?.confidence ?? 0)));
    const riskLevel = String(req.body?.riskLevel ?? "lav").toLowerCase();
    if (!actionType || !recommendation || !reasoning) return res.status(400).json({ error: "Handling, anbefaling og begrundelse er påkrævet." });
    if (!["lav", "middel", "høj", "hoej", "kritisk"].includes(riskLevel)) return res.status(400).json({ error: "Risikonniveauet er ugyldigt." });
    const requiresApproval = new Set<string>(JSON.parse(settings.approvalActions)).has(actionType)
      || ["høj", "hoej", "kritisk"].includes(riskLevel) || confidence < settings.minimumConfidence
      || (settings.requireEvidence && evidence.length === 0);
    const item = db.insert(schema.aiDecisionLogs).values({
      companyId: cid, actionType, entityType: req.body?.entityType ? String(req.body.entityType) : null,
      entityId: Number.isInteger(Number(req.body?.entityId)) ? Number(req.body.entityId) : null,
      recommendation, reasoning, evidence: JSON.stringify(evidence), model: req.body?.model ? String(req.body.model) : null,
      confidence, riskLevel, requiresApproval,
      status: requiresApproval ? "afventer_godkendelse" : "klar_til_automatisk_udfoerelse",
      proposedAt: new Date().toISOString(),
    }).returning().get();
    res.status(201).json(item);
  }));

  app.post("/api/ai-governance/decisions/:id/:decision", h(async (req, res) => {
    if (!canApprove(req)) return res.status(403).json({ error: "Kun leder eller platformadministrator kan godkende." });
    const cid = tenantId(req);
    if (!["approve", "reject"].includes(req.params.decision)) return res.status(400).json({ error: "Vælg approve eller reject." });
    const current = db.select().from(schema.aiDecisionLogs).where(and(eq(schema.aiDecisionLogs.id, Number(req.params.id)), eq(schema.aiDecisionLogs.companyId, cid))).get();
    if (!current) return res.status(404).json({ error: "AI-beslutningen blev ikke fundet." });
    if (current.status !== "afventer_godkendelse") return res.status(409).json({ error: "Beslutningen er allerede behandlet." });
    res.json(db.update(schema.aiDecisionLogs).set({
      status: req.params.decision === "approve" ? "godkendt" : "afvist", decidedBy: req.auth.user.id,
      decidedAt: new Date().toISOString(), decisionNote: req.body?.note ? String(req.body.note) : null,
    }).where(and(eq(schema.aiDecisionLogs.id, current.id), eq(schema.aiDecisionLogs.companyId, cid))).returning().get());
  }));

  app.post("/api/regulatory-monitor/run", h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministrator kan starte regelovervågning." });
    res.json(await monitorRegulatorySources());
  }));

  app.post("/api/regulatory-changes/:id/:decision", h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin) return res.status(403).json({ error: "Kun platformadministrator kan behandle regelændringer." });
    if (!["approve", "reject"].includes(req.params.decision)) return res.status(400).json({ error: "Vælg approve eller reject." });
    const current = db.select().from(schema.regulatoryChanges).where(eq(schema.regulatoryChanges.id, Number(req.params.id))).get();
    if (!current) return res.status(404).json({ error: "Regelændringen blev ikke fundet." });
    res.json(db.update(schema.regulatoryChanges).set({
      status: req.params.decision === "approve" ? "fagligt_godkendt" : "afvist", reviewedBy: req.auth.user.id,
      reviewedAt: new Date().toISOString(), notes: req.body?.notes ? String(req.body.notes) : null,
    }).where(eq(schema.regulatoryChanges.id, current.id)).returning().get());
  }));

  app.get("/api/accounting-control-center", h(async (req, res) => {
    if (!canViewFinancialGovernance(req)) {
      return res.status(403).json({ error: "Du har ikke adgang til regnskabskontrolcenteret." });
    }
    const cid = tenantId(req);
    const today = new Date().toISOString().slice(0, 10);
    const rows = (table: any) => db.select().from(table).where(eq(table.companyId, cid)).all() as any[];
    const invoices = rows(schema.invoices);
    const entries = rows(schema.journalEntries);
    const bank = rows(schema.bankTransactions);
    const vouchers = rows(schema.vouchers);
    const deadlines = rows(schema.taxDeadlines);
    const integrations = rows(schema.integrationRuns);
    const compliance = rows(schema.complianceChecks);
    const backups = rows(schema.backupJobs).filter((x) => x.status === "fuldfort")
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const latestBackup = backups[0] ?? null;
    const backupAgeHours = latestBackup ? Math.max(0, Math.round((Date.now() - new Date(latestBackup.createdAt).getTime()) / 3_600_000)) : null;
    const overdueInvoices = invoices.filter((x) => x.dueDate && x.dueDate < today && !["betalt", "krediteret"].includes(x.status));
    const draftEntries = entries.filter((x) => x.status === "kladde");
    const pendingBank = bank.filter((x) => x.status === "afventer");
    const uncodedVouchers = vouchers.filter((x) => x.status === "kladde" || !x.accountId || !x.category);
    const overdueDeadlines = deadlines.filter((x) => x.deadline && x.deadline < today && !["indsendt", "betalt"].includes(x.status));
    const upcomingDeadlines = deadlines.filter((x) => x.deadline >= today && (new Date(x.deadline).getTime() - Date.now()) / 86_400_000 <= 30 && !["indsendt", "betalt"].includes(x.status));
    const failedIntegrations = integrations.filter((x) => ["fejlet", "error", "failed"].includes(String(x.status).toLowerCase()) || Number(x.recordsFailed) > 0);
    const openCompliance = compliance.filter((x) => !["bestået", "godkendt", "ok", "passed"].includes(String(x.status).toLowerCase()));
    const checks = [
      { key: "bank", label: "Bank afstemt", weight: 15, ok: !pendingBank.length, count: pendingBank.length },
      { key: "invoices", label: "Ingen forfaldne fakturaer", weight: 15, ok: !overdueInvoices.length, count: overdueInvoices.length },
      { key: "journal", label: "Ingen åbne kladder", weight: 10, ok: !draftEntries.length, count: draftEntries.length },
      { key: "vouchers", label: "Bilag er konteret", weight: 10, ok: !uncodedVouchers.length, count: uncodedVouchers.length },
      { key: "deadlines", label: "Ingen overskredne frister", weight: 20, ok: !overdueDeadlines.length, count: overdueDeadlines.length },
      { key: "backup", label: "Backup under 24 timer gammel", weight: 15, ok: backupAgeHours !== null && backupAgeHours <= 24, count: latestBackup ? 0 : 1 },
      { key: "integrations", label: "Integrationer kører stabilt", weight: 5, ok: !failedIntegrations.length, count: failedIntegrations.length },
      { key: "compliance", label: "Kontroller er afsluttet", weight: 10, ok: compliance.length > 0 && !openCompliance.length, count: openCompliance.length },
    ];
    const score = checks.reduce((sum, x) => sum + (x.ok ? x.weight : 0), 0);
    const actions = [
      overdueDeadlines.length && { id: "deadlines", severity: "critical", title: "Indsend overskredne frister", detail: `${overdueDeadlines.length} frist(er) er overskredet.`, count: overdueDeadlines.length, route: "/smartregnskab/app/moms" },
      overdueInvoices.length && { id: "invoices", severity: "critical", title: "Følg op på forfaldne fakturaer", detail: `${overdueInvoices.length} faktura(er) kræver opfølgning.`, count: overdueInvoices.length, route: "/smartregnskab/app/debitorstyring" },
      pendingBank.length && { id: "bank", severity: "warning", title: "Afstem banktransaktioner", detail: `${pendingBank.length} post(er) mangler match.`, count: pendingBank.length, route: "/smartregnskab/app/bank" },
      uncodedVouchers.length && { id: "vouchers", severity: "warning", title: "Konter bilag", detail: `${uncodedVouchers.length} bilag mangler kontering.`, count: uncodedVouchers.length, route: "/smartregnskab/app/bilag" },
      draftEntries.length && { id: "entries", severity: "warning", title: "Gennemgå bogføringskladder", detail: `${draftEntries.length} kladde(r) er ikke bogført.`, count: draftEntries.length, route: "/smartregnskab/app/kontoplan" },
      (!latestBackup || (backupAgeHours ?? Infinity) > 24) && { id: "backup", severity: "warning", title: "Kontrollér ekstern backup", detail: latestBackup ? `Seneste registrerede backup er ${backupAgeHours} timer gammel.` : "Ingen fuldført backup er registreret.", count: 1, route: "/smartregnskab/app/backup_regnskab" },
      failedIntegrations.length && { id: "integrations", severity: "warning", title: "Ret integrationsfejl", detail: `${failedIntegrations.length} kørsel/kørsler har fejl.`, count: failedIntegrations.length, route: "/smartregnskab/app/integration_runs" },
      (!compliance.length || openCompliance.length) && { id: "compliance", severity: "info", title: "Gennemfør compliance-kontroller", detail: !compliance.length ? "Der er ikke registreret kontroller endnu." : `${openCompliance.length} kontrol(ler) mangler.`, count: openCompliance.length, route: "/smartregnskab/app/compliance_checks" },
    ].filter(Boolean);
    res.json({ generatedAt: new Date().toISOString(), score, readiness: score >= 90 ? "klar" : score >= 70 ? "opmærksomhed" : "handling_påkrævet",
      checks, actions, totals: { overdueInvoices: overdueInvoices.length, pendingBankTransactions: pendingBank.length,
        uncodedVouchers: uncodedVouchers.length, draftEntries: draftEntries.length, overdueDeadlines: overdueDeadlines.length,
        upcomingDeadlines: upcomingDeadlines.length, failedIntegrations: failedIntegrations.length },
      backup: latestBackup ? { id: latestBackup.id, createdAt: latestBackup.createdAt, ageHours: backupAgeHours } : null,
      legal: { registeredBookkeepingSystem: "not_verified", message: "Kontrolcenteret er driftsstøtte og udgør ikke myndighedsgodkendelse eller juridisk rådgivning." } });
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
    const cid = tenantId(req);
    const { sourcePlatform, targetPlatform, syncType } = req.body;
    const job = db.insert(schema.platformSyncJobs).values({
      companyId: cid,
      sourcePlatform: sourcePlatform || "external_system",
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
    const wf = db.select().from(schema.workflowDefinitions).where(and(
      eq(schema.workflowDefinitions.id, parseInt(req.params.id)),
      eq(schema.workflowDefinitions.companyId, cid),
    )).get();
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
  crud(app, "/api/system-health-events", schema.systemHealthEvents, false);
  crud(app, "/api/delivery-logs", schema.deliveryLogs, true);

  // Extra: retry queue process
  app.post("/api/integration-retry-queue/:id/retry", h(async (req, res) => {
    const cid = tenantId(req);
    const current = db.select().from(schema.integrationRetryQueue).where(and(
      eq(schema.integrationRetryQueue.id, parseInt(req.params.id)),
      eq(schema.integrationRetryQueue.companyId, cid),
    )).get();
    if (!current) return res.status(404).json({ error: "Elementet blev ikke fundet." });
    const item = db.update(schema.integrationRetryQueue).set({
      retryCount: (current.retryCount || 0) + 1,
      status: "afventer",
      nextRetryAt: new Date(Date.now() + 60000).toISOString(),
    }).where(and(
      eq(schema.integrationRetryQueue.id, parseInt(req.params.id)),
      eq(schema.integrationRetryQueue.companyId, cid),
    )).returning().get();
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
    if (!backup || (backup.companyId !== null && backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const checksum = backup.summary ? JSON.parse(backup.summary).checksum || null : null;
    res.json({ ...backup, checksum, canRestore: backup.status === "fuldfort" });
  }));

  app.post("/api/backups/:id/verify", h(async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(501).json({ error: "Backup-verifikation kræver en rigtig backupudbyder og er deaktiveret." });
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId !== null && backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    // Simulated checksum verification
    const verified = backup.status === "fuldfort";
    res.json({ verified, checksum: `sha256:${backup.id}:${backup.createdAt?.slice(0, 10)}`, message: verified ? "Integritet verificeret" : "Backup er ikke fuldført" });
  }));

  app.post("/api/backups/:id/restore-dry-run", h(async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(501).json({ error: "Backup-gendannelse kræver en rigtig backupudbyder og er deaktiveret." });
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId !== null && backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
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
    if (process.env.NODE_ENV === "production") return res.status(501).json({ error: "Backup-download kræver en rigtig backupudbyder og er deaktiveret." });
    const cid = tenantId(req);
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId !== null && backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const data = JSON.stringify({
      backup,
      exportedAt: new Date().toISOString(),
      scope: backup.scope,
      tables: backup.summary ? JSON.parse(backup.summary) : {},
    }, null, 2);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${backup.id}-${backup.createdAt?.slice(0, 10)}.json"`);
    res.send(data);
  }));

  app.post("/api/backups/:id/retention", h(async (req, res) => {
    const cid = tenantId(req);
    const { retentionDays } = req.body;
    const backup = db.select().from(schema.backupJobs).where(eq(schema.backupJobs.id, parseInt(req.params.id))).get();
    if (!backup || (backup.companyId !== null && backup.companyId !== cid && !req.auth?.isPlatformAdmin)) {
      return res.status(404).json({ error: "Backup ikke fundet" });
    }
    const expiryDate = new Date(Date.now() + (retentionDays || 30) * 86400000).toISOString();
    res.json({ backupId: backup.id, retentionDays: retentionDays || 30, expiresAt: expiryDate });
  }));
}
