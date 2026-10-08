// Extended routes batch 2 — 24 new features
import type { Express } from "express";
import { storage } from "./storage";
import { requireFeature, requireRole, tenantId } from "./auth";

const nowIso = () => new Date().toISOString();
const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const tid = tenantId; // Sikker tenant-isolation via auth.ts
const updates = (fields: string[]) => (req: any): Record<string, any> => {
  const u: Record<string, any> = {};
  for (const k of fields) if (req.body[k] !== undefined) u[k] = req.body[k];
  return u;
};

import {
  insertMobileSyncQueueSchema, insertLiveBoardEventSchema, insertCustomerLocationSchema,
  insertPayrollCalculationSchema, insertEsignatureSchema, insertDocumentCenterSchema,
  insertPurchaseOrderSchema, insertProfitabilityReportSchema, insertServiceHistorySchema,
  insertWorkplaceIncidentSchema, insertCustomerSelfServiceSchema, insertPlatformSubscriptionSchema,
  insertIntegrationConfigSchema, insertComplianceCheckSchema, insertConsolidationEntrySchema,
  insertAdvancedVatSchema, insertBankPaymentSchema, insertPayrollEngineSchema,
  insertAuditPackageSchema, insertBudgetVersionSchema, insertReconciliationCenterSchema,
} from "@shared/schema";

function validate(schema: any, data: any) {
  const r = schema.safeParse(data);
  if (!r.success) throw { status: 400, message: "Validering fejlede", details: r.error.issues };
  return r.data;
}

const advancedVatTypes = new Set(["oss", "intrastat", "delvist_fradrag", "momsregistrering_udland"]);
function validatedAdvancedVat(body: any) {
  const period = String(body.period ?? "").trim();
  const vatType = String(body.vatType ?? "").trim();
  const country = String(body.country ?? "").trim().toUpperCase();
  const basis = Number(body.basis);
  const vatRate = Number(body.vatRate ?? 0);
  const deductionRate = Number(body.deductionRate ?? 0);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw { status: 400, message: "Perioden skal angives som YYYY-MM." };
  if (!advancedVatTypes.has(vatType)) throw { status: 400, message: "Vælg en gyldig international momsregel." };
  if (!/^[A-Z]{2}$/.test(country)) throw { status: 400, message: "Land skal angives med en ISO-landekode på to bogstaver." };
  if (!Number.isFinite(basis) || basis < 0) throw { status: 400, message: "Grundlaget skal være et positivt tal eller nul." };
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw { status: 400, message: "Momssatsen skal ligge mellem 0 og 100 procent." };
  if (!Number.isFinite(deductionRate) || deductionRate < 0 || deductionRate > 100) throw { status: 400, message: "Fradragsprocenten skal ligge mellem 0 og 100 procent." };
  const vatAmount = Math.round((basis * vatRate / 100) * 100) / 100;
  const deductibleAmount = Math.round((vatAmount * deductionRate / 100) * 100) / 100;
  return {
    period, vatType, country, basis, vatRate, vatAmount, deductionRate, deductibleAmount,
    description: body.description ? String(body.description).trim().slice(0, 1_000) : null,
    status: "kladde",
  };
}

const allowedApiScopes = new Set(["read", "write"]);
function parsedApiScopes(value: unknown): string[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) values = value;
  else if (typeof value === "string") {
    try { const parsed = JSON.parse(value); values = Array.isArray(parsed) ? parsed : value.split(/[, ]+/); }
    catch { values = value.split(/[, ]+/); }
  }
  const scopes = Array.from(new Set(values.map(String).map((item) => item.trim()).filter((item) => allowedApiScopes.has(item))));
  if (!scopes.length) throw { status: 400, message: "Vælg mindst ét gyldigt scope: read eller write." };
  return scopes;
}

function safeApiKey(row: any) {
  const { keyHash: _keyHash, webhookLog: _webhookLog, ...safe } = row;
  return safe;
}

async function consolidationContext(req: any) {
  const activeCompany = await storage.getCompany(tid(req));
  if (!activeCompany) throw { status: 404, message: "Virksomheden findes ikke." };
  const ownerId = activeCompany.subscriptionOwnerId || activeCompany.id;
  const companies = (await storage.getCompanies()).filter((company: any) =>
    (company.subscriptionOwnerId || company.id) === ownerId,
  );
  return { ownerId, companies };
}

function validateConsolidationEntry(body: any, companies: any[]) {
  const parentCompany = String(body.parentCompany ?? "").trim();
  const subsidiaryCompany = String(body.subsidiaryCompany ?? "").trim();
  const names = new Set(companies.map((company: any) => String(company.name)));
  if (companies.length < 2) throw { status: 409, message: "Konsolidering kræver mindst to juridiske virksomheder i kundeorganisationen." };
  if (!names.has(parentCompany) || !names.has(subsidiaryCompany)) {
    throw { status: 400, message: "Vælg moder- og datterselskab fra kundeorganisationens registrerede virksomheder." };
  }
  if (parentCompany === subsidiaryCompany) throw { status: 400, message: "Moder- og datterselskab skal være forskellige virksomheder." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.period ?? ""))) throw { status: 400, message: "Perioden skal angives som YYYY-MM." };
  if (!String(body.description ?? "").trim()) throw { status: 400, message: "Beskrivelse er påkrævet." };
  if (!Number.isFinite(Number(body.amount))) throw { status: 400, message: "Beløbet skal være et gyldigt tal." };
}

// Helper: standard CRUD for a table
function crud(app: Express, basePath: string, tableName: string, insertSchema: any, fields: string[], extra?: (app: Express) => void, guards: any[] = []) {
  app.get(basePath, ...guards, h(async (req, res) => { res.json(await storage.all(tableName, tid(req))); }));
  app.post(basePath, ...guards, h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin && !["leder", "holdleder"].includes(req.auth?.role)) return res.status(403).json({ error: "Ingen adgang." });
    const data = validate(insertSchema, { ...req.body, companyId: tid(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert(tableName, data));
  }));
  app.patch(`${basePath}/:id`, ...guards, h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin && !["leder", "holdleder"].includes(req.auth?.role)) return res.status(403).json({ error: "Ingen adgang." });
    res.json(await storage.update(tableName, Number(req.params.id), updates(fields)(req), tid(req)));
  }));
  app.delete(`${basePath}/:id`, ...guards, h(async (req, res) => {
    if (!req.auth?.isPlatformAdmin && !["leder", "holdleder"].includes(req.auth?.role)) return res.status(403).json({ error: "Ingen adgang." });
    await storage.delete(tableName, Number(req.params.id), tid(req));
    res.json({ success: true });
  }));
  if (extra) extra(app);
}

export function registerExtendedRoutes2(app: Express) {
  // ══ SmartRegnskab (12) ══
  crud(app, "/api/mobile-sync", "mobile_sync_queue", insertMobileSyncQueueSchema, ["employeeId", "employeeName", "deviceInfo", "syncType", "payload", "status", "syncedAt", "errorMessage"]);
  crud(app, "/api/live-board", "live_board_events", insertLiveBoardEventSchema, ["type", "title", "description", "severity", "relatedId", "relatedType", "location", "timestamp", "status"]);
  crud(app, "/api/customer-locations", "customer_locations", insertCustomerLocationSchema, ["customerId", "customerName", "name", "address", "zip", "city", "contactPerson", "contactPhone", "contactEmail", "accessInstructions", "keyNumber", "alarmCode", "cleaningAreas", "status"]);
  crud(app, "/api/payroll-calculations", "payroll_calculations", insertPayrollCalculationSchema, ["employeeId", "employeeName", "period", "baseHours", "overtimeHours", "holidayHours", "nightHours", "weekendHours", "basePay", "overtimePay", "holidayPay", "nightSurcharge", "weekendSurcharge", "kilometers", "mileageAllowance", "pension", "atp", "amContribution", "aTax", "grossSalary", "netSalary", "vacationPay", "status"], undefined, [requireFeature("loen")]);
  crud(app, "/api/esignatures", "esignatures", insertEsignatureSchema, ["documentType", "documentTitle", "relatedId", "signerName", "signerEmail", "signerRole", "signatureHash", "signedAt", "expiresAt", "status", "ip"]);
  crud(app, "/api/document-center", "document_center", insertDocumentCenterSchema, ["category", "linkedId", "title", "fileName", "fileType", "version", "uploadedBy", "description", "tags", "status"]);
  crud(app, "/api/purchase-orders", "purchase_orders", insertPurchaseOrderSchema, ["poNumber", "supplier", "supplierEmail", "supplierPhone", "items", "totalAmount", "status", "expectedDate", "receivedDate", "notes"]);
  crud(app, "/api/profitability", "profitability_reports", insertProfitabilityReportSchema, ["entityType", "entityId", "entityName", "period", "revenue", "laborCost", "materialCost", "transportCost", "overhead", "totalCost", "profit", "margin", "hoursWorked"]);
  crud(app, "/api/service-history", "service_history", insertServiceHistorySchema, ["customerName", "locationName", "taskType", "date", "employeeName", "beforePhotos", "afterPhotos", "notes", "rating", "status"]);
  crud(app, "/api/workplace-incidents", "workplace_incidents", insertWorkplaceIncidentSchema, ["type", "title", "description", "date", "location", "involvedEmployee", "severity", "chemicalName", "sdsNumber", "reportedBy", "actions", "status"]);
  crud(app, "/api/customer-self-service", "customer_self_service", insertCustomerSelfServiceSchema, ["customerId", "customerName", "requestType", "title", "description", "preferredDate", "status", "response", "respondedBy", "respondedAt"]);
  crud(app, "/api/platform-subscriptions", "platform_subscriptions", insertPlatformSubscriptionSchema, ["companyName", "plan", "price", "billingCycle", "maxUsers", "maxEmployees", "aiEnabled", "status", "trialEndsAt", "nextBillingDate"]);

  // ══ SmartRegnskab (12) ══
  crud(app, "/api/integration-configs", "integration_configs", insertIntegrationConfigSchema, ["type", "provider", "displayName", "status", "authMethod", "config", "lastSync", "syncStatus", "errorMessage", "apiAgreement"]);
  crud(app, "/api/compliance-checks", "compliance_checks", insertComplianceCheckSchema, ["category", "checkName", "description", "status", "result", "checkedAt", "notes", "requiresLegal"]);
  const consolidationFields = ["period", "parentCompany", "subsidiaryCompany", "type", "accountNumber", "description", "amount", "eliminationType", "status"];
  app.get("/api/consolidation", requireFeature("konsolidering"), requireRole("leder", "bogholder", "revisor", "revisor_admin", "platform_admin"), h(async (req, res) => {
    const { ownerId } = await consolidationContext(req);
    res.json(await storage.all("consolidation_entries", ownerId));
  }));
  app.post("/api/consolidation", requireFeature("konsolidering"), requireRole("leder", "bogholder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    const { ownerId, companies } = await consolidationContext(req);
    const candidate = { ...req.body, status: "kladde" };
    validateConsolidationEntry(candidate, companies);
    const data = validate(insertConsolidationEntrySchema, { ...candidate, companyId: ownerId, createdAt: nowIso() });
    res.status(201).json(await storage.insert("consolidation_entries", data));
  }));
  app.patch("/api/consolidation/:id", requireFeature("konsolidering"), requireRole("leder", "bogholder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    const { ownerId, companies } = await consolidationContext(req);
    const existing = await storage.get("consolidation_entries", Number(req.params.id), ownerId);
    if (!existing) return res.status(404).json({ error: "Konsolideringsposten findes ikke." });
    if (existing.status === "bogført") return res.status(409).json({ error: "En bogført konsolideringspost er låst. Opret en modpost i stedet." });
    const change = updates(consolidationFields)(req);
    const candidate = { ...existing, ...change };
    if (!["kladde", "bogført"].includes(String(candidate.status))) return res.status(400).json({ error: "Status skal være kladde eller bogført." });
    validateConsolidationEntry(candidate, companies);
    res.json(await storage.update("consolidation_entries", Number(req.params.id), change, ownerId));
  }));
  app.delete("/api/consolidation/:id", requireFeature("konsolidering"), requireRole("leder", "bogholder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    const { ownerId } = await consolidationContext(req);
    const existing = await storage.get("consolidation_entries", Number(req.params.id), ownerId);
    if (!existing) return res.status(404).json({ error: "Konsolideringsposten findes ikke." });
    if (existing.status === "bogført") return res.status(409).json({ error: "En bogført konsolideringspost kan ikke slettes. Opret en modpost i stedet." });
    await storage.delete("consolidation_entries", Number(req.params.id), ownerId);
    res.json({ success: true });
  }));
  app.get("/api/advanced-vat", requireFeature("avanceret_moms"), requireRole("leder", "bogholder", "revisor", "revisor_admin", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("advanced_vat", tid(req)));
  }));
  app.post("/api/advanced-vat", requireFeature("avanceret_moms"), requireRole("leder", "bogholder", "platform_admin"), h(async (req, res) => {
    const candidate = validatedAdvancedVat(req.body);
    const data = validate(insertAdvancedVatSchema, { ...candidate, companyId: tid(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("advanced_vat", data));
  }));
  app.patch("/api/advanced-vat/:id", requireFeature("avanceret_moms"), requireRole("leder", "bogholder", "platform_admin"), h(async (req, res) => {
    const cid = tid(req);
    const existing = await storage.get("advanced_vat", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Momsposteringen findes ikke." });
    if (existing.status !== "kladde") return res.status(409).json({ error: "En kontrolleret eller indberettet momspostering er låst." });
    const change = validatedAdvancedVat({ ...existing, ...req.body });
    res.json(await storage.update("advanced_vat", existing.id, change, cid));
  }));
  app.delete("/api/advanced-vat/:id", requireFeature("avanceret_moms"), requireRole("leder", "bogholder", "platform_admin"), h(async (req, res) => {
    const cid = tid(req);
    const existing = await storage.get("advanced_vat", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "Momsposteringen findes ikke." });
    if (existing.status !== "kladde") return res.status(409).json({ error: "Kun kladder kan slettes." });
    await storage.delete("advanced_vat", existing.id, cid);
    res.json({ success: true });
  }));
  crud(app, "/api/bank-payments", "bank_payments", insertBankPaymentSchema, ["paymentFileId", "recipientName", "recipientAccount", "recipientReg", "amount", "currency", "paymentDate", "reference", "message", "status", "approvedBy", "approvedAt", "bankStatus", "errorMessage"], undefined, [requireFeature("betalinger")]);
  crud(app, "/api/payroll-engine", "payroll_engine", insertPayrollEngineSchema, ["employeeId", "employeeName", "period", "payslipNumber", "grossSalary", "aTax", "atp", "amContribution", "holidayPay", "pension", "healthInsurance", "unionContribution", "netSalary", "hours", "hourlyRate", "overtime", "mileage", "deductions", "eindkomstStatus", "feriekontoStatus", "status", "approvedBy", "approvedAt"], undefined, [requireFeature("loen")]);
  const auditPackageFields = ["year", "type", "title", "description", "content", "preparedBy", "reviewedBy", "status", "signedOffAt"];
  app.get("/api/audit-package", requireFeature("revision"), requireRole("leder", "bogholder", "revisor", "revisor_admin", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("audit_package", tid(req)));
  }));
  app.post("/api/audit-package", requireFeature("revision"), requireRole("leder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    const data = validate(insertAuditPackageSchema, { ...req.body, companyId: tid(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("audit_package", data));
  }));
  app.patch("/api/audit-package/:id", requireFeature("revision"), requireRole("leder", "revisor", "revisor_admin", "platform_admin"), h(async (req, res) => {
    res.json(await storage.update("audit_package", Number(req.params.id), updates(auditPackageFields)(req), tid(req)));
  }));
  app.delete("/api/audit-package/:id", requireFeature("revision"), requireRole("leder", "revisor_admin", "platform_admin"), h(async (req, res) => {
    await storage.delete("audit_package", Number(req.params.id), tid(req));
    res.json({ success: true });
  }));
  crud(app, "/api/budget-versions", "budget_versions", insertBudgetVersionSchema, ["name", "year", "scenario", "version", "data", "totalRevenue", "totalCosts", "totalResult", "approvedBy", "approvedAt", "status"]);
  crud(app, "/api/reconciliation-center", "reconciliation_center", insertReconciliationCenterSchema, ["period", "type", "accountNumber", "bookAmount", "externalAmount", "difference", "matchedTransactions", "unmatchedTransactions", "autoMatched", "status", "notes"]);
  app.get("/api/api-keys", requireFeature("api_integration"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    res.json((await storage.all("api_keys", tid(req))).map(safeApiKey));
  }));
  app.patch("/api/api-keys/:id", requireFeature("api_integration"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tid(req);
    const existing = await storage.get("api_keys", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "API-nøglen findes ikke." });
    const change: Record<string, unknown> = {};
    if (req.body.name !== undefined) change.name = String(req.body.name).trim().slice(0, 120);
    if (req.body.status !== undefined) {
      const status = String(req.body.status);
      if (!new Set(["aktiv", "inaktiv", "tilbagekaldt"]).has(status)) return res.status(400).json({ error: "Ugyldig nøglestatus." });
      if (existing.status === "tilbagekaldt" && status !== "tilbagekaldt") return res.status(409).json({ error: "En tilbagekaldt nøgle kan ikke aktiveres igen. Opret en ny nøgle." });
      change.status = status;
    }
    if (req.body.webhookUrl !== undefined) {
      const url = String(req.body.webhookUrl || "").trim();
      if (url && !/^https:\/\//i.test(url)) return res.status(400).json({ error: "Webhook-URL skal bruge HTTPS." });
      change.webhookUrl = url || null;
    }
    if (req.body.webhookEvents !== undefined) change.webhookEvents = JSON.stringify(Array.isArray(req.body.webhookEvents)
      ? req.body.webhookEvents.map(String).filter((event: string) => event === "invoice.created")
      : []);
    res.json(safeApiKey(await storage.update("api_keys", existing.id, change, cid)));
  }));
  app.delete("/api/api-keys/:id", requireFeature("api_integration"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tid(req);
    const existing = await storage.get("api_keys", Number(req.params.id), cid);
    if (!existing) return res.status(404).json({ error: "API-nøglen findes ikke." });
    await storage.update("api_keys", existing.id, { status: "tilbagekaldt" }, cid);
    res.json({ success: true, status: "tilbagekaldt" });
  }));
  app.get("/api/migration-jobs", requireFeature("dedikeret_onboarding"), requireRole("leder", "bogholder", "revisor", "revisor_admin", "platform_admin"), h(async (req, res) => {
    res.json(await storage.all("migration_jobs", tid(req)));
  }));

  // ── Profitabilitet auto-generate ──
  app.post("/api/profitability/auto-generate", h(async (req, res) => {
    const cid = tid(req);
    const { period } = req.body;
    const invoices = await storage.all("invoices", cid);
    const tasks = await storage.all("tasks", cid);
    const timeEntries = await storage.all("time_entries", cid);
    const periodInv = invoices.filter((i: any) => i.issueDate?.startsWith(period));
    const byCustomer: Record<string, any> = {};
    for (const inv of periodInv) {
      const name = inv.customerName || "Ukendt";
      if (!byCustomer[name]) byCustomer[name] = { revenue: 0, hoursWorked: 0, laborCost: 0, materialCost: 0, transportCost: 0, overhead: 0 };
      byCustomer[name].revenue += inv.totalAmount || 0;
    }
    for (const te of timeEntries.filter((t: any) => t.date?.startsWith(period))) {
      const name = te.customerName || "Ukendt";
      if (!byCustomer[name]) byCustomer[name] = { revenue: 0, hoursWorked: 0, laborCost: 0, materialCost: 0, transportCost: 0, overhead: 0 };
      byCustomer[name].hoursWorked += te.hours || 0;
      byCustomer[name].laborCost += (te.hours || 0) * 250;
    }
    const created: any[] = [];
    for (const [name, data] of Object.entries(byCustomer)) {
      const totalCost = data.laborCost + data.materialCost + data.transportCost + data.overhead;
      const profit = data.revenue - totalCost;
      const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
      const r = await storage.insert("profitability_reports", {
        companyId: cid, entityType: "kunde", entityName: name, period,
        revenue: data.revenue, laborCost: data.laborCost, materialCost: data.materialCost,
        transportCost: data.transportCost, overhead: data.overhead, totalCost, profit, margin,
        hoursWorked: data.hoursWorked, createdAt: nowIso(),
      } as any);
      created.push(r);
    }
    res.json({ created: created.length, reports: created });
  }));

  // ── Live board auto-scan ──
  app.post("/api/live-board/scan", h(async (req, res) => {
    const cid = tid(req);
    const created: any[] = [];
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    const tasks = await storage.all("tasks", cid);
    const employees = await storage.all("employees", cid);
    const absences = await storage.all("absences", cid);
    // Overdue tasks
    for (const t of tasks.filter((t: any) => t.date < today && t.status !== "afsluttet")) {
      created.push(await storage.insert("live_board_events", {
        companyId: cid, type: "forsinkelse", severity: "warning",
        title: `Forsinket: ${t.title || t.description || ""}`,
        description: `Opgave for ${t.customerName || ""} er forsinket`,
        timestamp: now.toISOString(), status: "aktiv", createdAt: nowIso(),
      } as any));
    }
    // Sick employees
    for (const a of absences.filter((a: any) => a.type === "syg" && (!a.endDate || a.endDate >= today))) {
      created.push(await storage.insert("live_board_events", {
        companyId: cid, type: "sygdom", severity: "critical",
        title: `Syg: ${a.employeeName || "Ukendt"}`,
        description: `Medarbejder sygemeldt`,
        timestamp: now.toISOString(), status: "aktiv", createdAt: nowIso(),
      } as any));
    }
    res.json({ created: created.length, events: created });
  }));

  // ── API key generate ──
  app.post("/api/api-keys/generate", requireFeature("api_integration"), requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tid(req);
    const name = String(req.body?.name ?? "").trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: "Navn er påkrævet." });
    const scopes = parsedApiScopes(req.body?.scopes);
    const rateLimit = Math.min(10_000, Math.max(60, Math.round(Number(req.body?.rateLimit) || 1_000)));
    const expiresAt = req.body?.expiresAt ? String(req.body.expiresAt) : null;
    if (expiresAt && (!/^\d{4}-\d{2}-\d{2}/.test(expiresAt) || new Date(expiresAt).getTime() <= Date.now())) {
      return res.status(400).json({ error: "Udløbsdatoen skal ligge i fremtiden." });
    }
    const webhookUrl = String(req.body?.webhookUrl || "").trim();
    if (webhookUrl && !/^https:\/\//i.test(webhookUrl)) return res.status(400).json({ error: "Webhook-URL skal bruge HTTPS." });
    const webhookEvents = Array.isArray(req.body?.webhookEvents)
      ? req.body.webhookEvents.map(String).filter((event: string) => event === "invoice.created")
      : [];
    const crypto = await import("crypto");
    const rawKey = `sr_live_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 16);
    const record = await storage.insert("api_keys", {
      companyId: cid, name, keyPrefix, keyHash,
      scopes: JSON.stringify(scopes), rateLimit, expiresAt,
      webhookUrl: webhookUrl || null, webhookEvents: JSON.stringify(webhookEvents),
      status: "aktiv", createdAt: nowIso(),
    } as any);
    res.status(201).json({ ...safeApiKey(record), key: rawKey });
  }));

}
