// Extended routes batch 2 — 24 new features
import type { Express } from "express";
import { storage } from "./storage";
import { tenantId } from "./auth";

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
  insertEinvoiceQueueSchema, insertApiKeySchema, insertMigrationJobSchema,
} from "@shared/schema";

function validate(schema: any, data: any) {
  const r = schema.safeParse(data);
  if (!r.success) throw { status: 400, message: "Validering fejlede", details: r.error.issues };
  const managed: Record<string, unknown> = {};
  for (const key of ["companyId", "createdAt", "updatedAt", "uploadedBy"]) {
    if (data && Object.prototype.hasOwnProperty.call(data, key)) managed[key] = data[key];
  }
  return { ...r.data, ...managed };
}

// Helper: standard CRUD for a table
function crud(app: Express, basePath: string, tableName: string, insertSchema: any, fields: string[], extra?: (app: Express) => void) {
  app.get(basePath, h(async (req, res) => { res.json(await storage.all(tableName, tid(req))); }));
  app.post(basePath, h(async (req, res) => {
    const data = validate(insertSchema, { ...req.body, companyId: tid(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert(tableName, data));
  }));
  app.patch(`${basePath}/:id`, h(async (req, res) => {
    res.json(await storage.update(tableName, Number(req.params.id), updates(fields)(req), tid(req)));
  }));
  app.delete(`${basePath}/:id`, h(async (req, res) => {
    await storage.delete(tableName, Number(req.params.id), tid(req));
    res.json({ success: true });
  }));
  if (extra) extra(app);
}

export function registerExtendedRoutes2(app: Express) {
  // ══ SmartDrift Clean (12) ══
  crud(app, "/api/mobile-sync", "mobile_sync_queue", insertMobileSyncQueueSchema, ["employeeId", "employeeName", "deviceInfo", "syncType", "payload", "status", "syncedAt", "errorMessage"]);
  crud(app, "/api/live-board", "live_board_events", insertLiveBoardEventSchema, ["type", "title", "description", "severity", "relatedId", "relatedType", "location", "timestamp", "status"]);
  crud(app, "/api/customer-locations", "customer_locations", insertCustomerLocationSchema, ["customerId", "customerName", "name", "address", "zip", "city", "contactPerson", "contactPhone", "contactEmail", "accessInstructions", "keyNumber", "alarmCode", "cleaningAreas", "status"]);
  crud(app, "/api/payroll-calculations", "payroll_calculations", insertPayrollCalculationSchema, ["employeeId", "employeeName", "period", "baseHours", "overtimeHours", "holidayHours", "nightHours", "weekendHours", "basePay", "overtimePay", "holidayPay", "nightSurcharge", "weekendSurcharge", "kilometers", "mileageAllowance", "pension", "atp", "amContribution", "aTax", "grossSalary", "netSalary", "vacationPay", "status"]);
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
  crud(app, "/api/consolidation", "consolidation_entries", insertConsolidationEntrySchema, ["period", "parentCompany", "subsidiaryCompany", "type", "accountNumber", "description", "amount", "eliminationType", "status"]);
  crud(app, "/api/advanced-vat", "advanced_vat", insertAdvancedVatSchema, ["period", "vatType", "country", "basis", "vatRate", "vatAmount", "deductionRate", "deductibleAmount", "description", "status"]);
  crud(app, "/api/bank-payments", "bank_payments", insertBankPaymentSchema, ["paymentFileId", "recipientName", "recipientAccount", "recipientReg", "amount", "currency", "paymentDate", "reference", "message", "status", "approvedBy", "approvedAt", "bankStatus", "errorMessage"]);
  crud(app, "/api/payroll-engine", "payroll_engine", insertPayrollEngineSchema, ["employeeId", "employeeName", "period", "payslipNumber", "grossSalary", "aTax", "atp", "amContribution", "holidayPay", "pension", "healthInsurance", "unionContribution", "netSalary", "hours", "hourlyRate", "overtime", "mileage", "deductions", "eindkomstStatus", "feriekontoStatus", "status", "approvedBy", "approvedAt"]);
  crud(app, "/api/audit-package", "audit_package", insertAuditPackageSchema, ["year", "type", "title", "description", "content", "preparedBy", "reviewedBy", "status", "signedOffAt"]);
  crud(app, "/api/budget-versions", "budget_versions", insertBudgetVersionSchema, ["name", "year", "scenario", "version", "data", "totalRevenue", "totalCosts", "totalResult", "approvedBy", "approvedAt", "status"]);
  crud(app, "/api/reconciliation-center", "reconciliation_center", insertReconciliationCenterSchema, ["period", "type", "accountNumber", "bookAmount", "externalAmount", "difference", "matchedTransactions", "unmatchedTransactions", "autoMatched", "status", "notes"]);
  crud(app, "/api/einvoice-queue", "einvoice_queue", insertEinvoiceQueueSchema, ["direction", "invoiceNumber", "invoiceId", "counterpartyName", "amount", "format", "validationStatus", "validationErrors", "routingStatus", "status", "processedAt"]);
  app.get("/api/api-keys", h(async (req, res) => {
    const rows = await storage.all("api_keys", tid(req));
    res.json(rows.map(({ keyHash: _secret, ...row }: any) => row));
  }));
  app.patch("/api/api-keys/:id", h(async (req, res) => {
    const safe = updates(["name", "scopes", "rateLimit", "webhookUrl", "webhookEvents", "status", "expiresAt"])(req);
    const row = await storage.update("api_keys", Number(req.params.id), safe, tid(req));
    if (!row) return res.status(404).json({ error: "API-nøglen blev ikke fundet." });
    const { keyHash: _secret, ...publicRow } = row;
    res.json(publicRow);
  }));
  app.delete("/api/api-keys/:id", h(async (req, res) => {
    const deleted = await storage.delete("api_keys", Number(req.params.id), tid(req));
    if (!deleted) return res.status(404).json({ error: "API-nøglen blev ikke fundet." });
    res.status(204).send();
  }));
  crud(app, "/api/migration-jobs", "migration_jobs", insertMigrationJobSchema, ["source", "sourceVersion", "fileName", "mapping", "totalRows", "importedRows", "errorRows", "validationErrors", "rollbackAvailable", "rolledBackAt", "status"]);

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
  app.post("/api/api-keys/generate", h(async (req, res) => {
    const cid = tid(req);
    const { name, scopes } = req.body;
    const crypto = await import("crypto");
    const rawKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 10);
    const record = await storage.insert("api_keys", {
      companyId: cid, name: name || "Ny API-nøgle", keyPrefix, keyHash,
      scopes: scopes || "read", rateLimit: 1000, status: "aktiv", createdAt: nowIso(),
    } as any);
    res.status(201).json({ ...record, key: rawKey });
  }));

  // ── Migration validate ──
  app.post("/api/migration-jobs/:id/rollback", h(async (req, res) => {
    const cid = tid(req);
    const updated = await storage.update("migration_jobs", Number(req.params.id), {
      status: "rolled_back", rolledBackAt: nowIso(),
    }, cid);
    res.json(updated);
  }));
}
