// Additional routes for SmartRegnskab + SmartRegnskab features
// This file is imported and called from routes.ts
import type { Express } from "express";
import { storage } from "./storage";

const nowIso = () => new Date().toISOString();
const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const tenantId = (req: any): number => req.user?.companyId || req.query.companyId || 1;

type SafeParse<T> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } };
};
function validate<T>(schema: SafeParse<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw { status: 400, message: "Validering fejlede", details: r.error.issues };
  return r.data;
}

// Import all insert schemas
import {
  insertRouteSchema,
  insertQualityInspectionSchema,
  insertCustomerRequestSchema,
  insertEmployeeDocumentSchema,
  insertSalesPipelineSchema,
  insertInventorySchema,
  insertEquipmentSchema,
  insertServiceContractSchema,
  insertAiDriftTaskSchema,
  insertBankIntegrationSchema,
  insertArchiveRecordSchema,
  insertPayrollReportSchema,
  insertAnnualReportSchema,
  insertReminderFlowSchema,
  insertAccrualSchema,
  insertInventoryAccountSchema,
  insertCurrencyTransactionSchema,
  insertAuditorPortalSchema,
  insertRoleControlSchema,
  insertImportJob2Schema,
} from "@shared/schema";

export function registerExtendedRoutes(app: Express) {
  const UPDATABLE = (fields: string[]) => (req: any): Record<string, any> => {
    const updates: Record<string, any> = {};
    for (const k of fields) if (req.body[k] !== undefined) updates[k] = req.body[k];
    return updates;
  };

  // ════════════════════════════════════════════════════
  //  Ældre interne driftsruter (afskåret af SmartRegnskabs API-filter)
  // ════════════════════════════════════════════════════

  // ── Ruteplanlægning ──
  const routeFields = ["date", "driverId", "driverName", "vehicleId", "zone", "stops", "totalDistance", "totalTime", "status"];
  app.get("/api/routes", h(async (req, res) => { res.json(await storage.all("routes", tenantId(req))); }));
  app.post("/api/routes", h(async (req, res) => {
    const data = validate(insertRouteSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("routes", data));
  }));
  app.patch("/api/routes/:id", h(async (req, res) => {
    res.json(await storage.update("routes", Number(req.params.id), UPDATABLE(routeFields)(req), tenantId(req)));
  }));
  app.delete("/api/routes/:id", h(async (req, res) => {
    await storage.delete("routes", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Kvalitetskontrol ──
  const qiFields = ["taskId", "customerName", "inspectorName", "date", "score", "maxScore", "checklist", "deviations", "photos", "status", "correctiveActions"];
  app.get("/api/quality-inspections", h(async (req, res) => { res.json(await storage.all("quality_inspections", tenantId(req))); }));
  app.post("/api/quality-inspections", h(async (req, res) => {
    const data = validate(insertQualityInspectionSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("quality_inspections", data));
  }));
  app.patch("/api/quality-inspections/:id", h(async (req, res) => {
    res.json(await storage.update("quality_inspections", Number(req.params.id), UPDATABLE(qiFields)(req), tenantId(req)));
  }));
  app.delete("/api/quality-inspections/:id", h(async (req, res) => {
    await storage.delete("quality_inspections", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Kundeportal forespørgsler ──
  const crFields = ["customerId", "customerName", "type", "subject", "description", "priority", "status", "response"];
  app.get("/api/customer-requests", h(async (req, res) => { res.json(await storage.all("customer_requests", tenantId(req))); }));
  app.post("/api/customer-requests", h(async (req, res) => {
    const data = validate(insertCustomerRequestSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("customer_requests", data));
  }));
  app.patch("/api/customer-requests/:id", h(async (req, res) => {
    res.json(await storage.update("customer_requests", Number(req.params.id), UPDATABLE(crFields)(req), tenantId(req)));
  }));

  // ── HR / medarbejderdokumenter ──
  const edFields = ["employeeId", "employeeName", "type", "title", "fileName", "issueDate", "expiryDate", "status", "notes"];
  app.get("/api/employee-documents", h(async (req, res) => { res.json(await storage.all("employee_documents", tenantId(req))); }));
  app.post("/api/employee-documents", h(async (req, res) => {
    const data = validate(insertEmployeeDocumentSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("employee_documents", data));
  }));
  app.patch("/api/employee-documents/:id", h(async (req, res) => {
    res.json(await storage.update("employee_documents", Number(req.params.id), UPDATABLE(edFields)(req), tenantId(req)));
  }));
  app.delete("/api/employee-documents/:id", h(async (req, res) => {
    await storage.delete("employee_documents", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── CRM / salgspipeline ──
  const spFields = ["leadName", "contactPerson", "phone", "email", "address", "source", "stage", "estimatedValue", "probability", "expectedCloseDate", "notes", "lostReason"];
  app.get("/api/sales-pipeline", h(async (req, res) => { res.json(await storage.all("sales_pipeline", tenantId(req))); }));
  app.post("/api/sales-pipeline", h(async (req, res) => {
    const data = validate(insertSalesPipelineSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("sales_pipeline", data));
  }));
  app.patch("/api/sales-pipeline/:id", h(async (req, res) => {
    res.json(await storage.update("sales_pipeline", Number(req.params.id), UPDATABLE(spFields)(req), tenantId(req)));
  }));
  app.delete("/api/sales-pipeline/:id", h(async (req, res) => {
    await storage.delete("sales_pipeline", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Lager / indkøb ──
  const invFields = ["name", "sku", "category", "unit", "quantity", "minQuantity", "costPrice", "salePrice", "location", "supplier", "autoReorder"];
  app.get("/api/inventory", h(async (req, res) => { res.json(await storage.all("inventory", tenantId(req))); }));
  app.post("/api/inventory", h(async (req, res) => {
    const data = validate(insertInventorySchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("inventory", data));
  }));
  app.patch("/api/inventory/:id", h(async (req, res) => {
    res.json(await storage.update("inventory", Number(req.params.id), UPDATABLE(invFields)(req), tenantId(req)));
  }));
  app.delete("/api/inventory/:id", h(async (req, res) => {
    await storage.delete("inventory", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Udstyr / service ──
  const eqFields = ["name", "type", "serialNumber", "purchaseDate", "purchasePrice", "assignedTo", "location", "serviceInterval", "lastServiceDate", "nextServiceDate", "status", "notes"];
  app.get("/api/equipment", h(async (req, res) => { res.json(await storage.all("equipment", tenantId(req))); }));
  app.post("/api/equipment", h(async (req, res) => {
    const data = validate(insertEquipmentSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    // Auto-beregn næste service dato
    if (data.serviceInterval && data.lastServiceDate) {
      const last = new Date(data.lastServiceDate);
      last.setDate(last.getDate() + data.serviceInterval);
      data.nextServiceDate = last.toISOString().substring(0, 10);
    }
    res.status(201).json(await storage.insert("equipment", data));
  }));
  app.patch("/api/equipment/:id", h(async (req, res) => {
    res.json(await storage.update("equipment", Number(req.params.id), UPDATABLE(eqFields)(req), tenantId(req)));
  }));
  app.delete("/api/equipment/:id", h(async (req, res) => {
    await storage.delete("equipment", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── SLA / kontraktmotor ──
  const scFields = ["customerId", "customerName", "contractNumber", "startDate", "endDate", "type", "price", "billingCycle", "slaLevel", "description", "autoRenew", "priceIndex", "status"];
  app.get("/api/service-contracts", h(async (req, res) => { res.json(await storage.all("service_contracts", tenantId(req))); }));
  app.post("/api/service-contracts", h(async (req, res) => {
    const data = validate(insertServiceContractSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("service_contracts", data));
  }));
  app.patch("/api/service-contracts/:id", h(async (req, res) => {
    res.json(await storage.update("service_contracts", Number(req.params.id), UPDATABLE(scFields)(req), tenantId(req)));
  }));
  app.delete("/api/service-contracts/:id", h(async (req, res) => {
    await storage.delete("service_contracts", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── AI Driftschef ──
  const adtFields = ["type", "title", "description", "severity", "data", "suggestion", "status", "approvedBy", "approvedAt"];
  app.get("/api/ai-drift-tasks", h(async (req, res) => { res.json(await storage.all("ai_drift_tasks", tenantId(req))); }));
  app.post("/api/ai-drift-tasks/chef-run", h(async (req, res) => {
    const cid = tenantId(req);
    const created: any[] = [];
    const now = new Date();
    // 1. Check for scheduling conflicts
    const tasks = await storage.all("tasks", cid);
    const employees = await storage.all("employees", cid);
    const today = now.toISOString().substring(0, 10);
    const todayTasks = tasks.filter((t: any) => t.date === today && t.status !== "afsluttet");
    // Check for double-booking employees
    const empTaskCount: Record<string, number> = {};
    for (const t of todayTasks) { if (t.assignedTo) empTaskCount[t.assignedTo] = (empTaskCount[t.assignedTo] || 0) + 1; }
    for (const [emp, count] of Object.entries(empTaskCount)) {
      if (count > 3) {
        const task = await storage.insert("ai_drift_tasks", {
          companyId: cid, type: "konflikt", severity: "warning",
          title: `${emp} har ${count} opgaver i dag`,
          description: `Medarbejderen kan være overbelastet med ${count} opgaver.`,
          data: JSON.stringify({ employee: emp, count }),
          suggestion: JSON.stringify({ action: "omfordel", note: "Overvej at omfordele opgaver" }),
          status: "afventer", createdAt: nowIso(),
        } as any);
        created.push(task);
      }
    }
    // 2. Check for sick employees without coverage
    const absences = await storage.all("absences", cid);
    const sickToday = absences.filter((a: any) => a.type === "syg" && (!a.endDate || a.endDate >= today));
    for (const emp of sickToday) {
      const task = await storage.insert("ai_drift_tasks", {
        companyId: cid, type: "sygdom", severity: "critical",
        title: `Sygdom: ${emp.employeeName || "Ukendt"}`,
        description: `Medarbejder er sygemeldt. Tjek om opgaver skal omfordeles.`,
        data: JSON.stringify({ employeeId: emp.employeeId, absenceId: emp.id }),
        suggestion: JSON.stringify({ action: "omfordel_opgaver", note: "Find vikar eller omfordel opgaver" }),
        status: "afventer", createdAt: nowIso(),
      } as any);
      created.push(task);
    }
    // 3. Check for overdue tasks
    for (const t of tasks.filter((t: any) => t.date < today && t.status !== "afsluttet")) {
      const daysOverdue = Math.floor((now.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        const task = await storage.insert("ai_drift_tasks", {
          companyId: cid, type: "forsinkelse", severity: daysOverdue > 3 ? "critical" : "warning",
          title: `Forsinket opgave: ${t.title || t.description || "Uden titel"} (${daysOverdue} dage)`,
          description: `Opgave planlagt til ${t.date} er ${daysOverdue} dage forsinket.`,
          data: JSON.stringify({ taskId: t.id }),
          suggestion: JSON.stringify({ action: "gennemgå_opgave", note: "Gennemgå og opdater status" }),
          status: "afventer", createdAt: nowIso(),
        } as any);
        created.push(task);
      }
    }
    // 4. Low inventory check
    const inventory = await storage.all("inventory", cid);
    for (const item of inventory.filter((i: any) => i.quantity <= i.minQuantity)) {
      const task = await storage.insert("ai_drift_tasks", {
        companyId: cid, type: "risiko", severity: "warning",
        title: `Lavt lager: ${item.name} (${item.quantity} ${item.unit || "stk"} tilbage)`,
        description: `Minimum beholdning: ${item.minQuantity}. Leverandør: ${item.supplier || "Ukendt"}.`,
        data: JSON.stringify({ itemId: item.id }),
        suggestion: JSON.stringify({ action: "bestil", itemId: item.id, note: "Genbestil vare" }),
        status: "afventer", createdAt: nowIso(),
      } as any);
      created.push(task);
    }
    // 5. Equipment needing service
    const equipment = await storage.all("equipment", cid);
    for (const eq of equipment.filter((e: any) => e.nextServiceDate && e.nextServiceDate <= today && e.status === "aktiv")) {
      const task = await storage.insert("ai_drift_tasks", {
        companyId: cid, type: "risiko", severity: "warning",
        title: `Service påkrævet: ${eq.name}`,
        description: `Udstyr "${eq.name}" (SN: ${eq.serialNumber || "N/A"}) har overskredet servicedato ${eq.nextServiceDate}.`,
        data: JSON.stringify({ equipmentId: eq.id }),
        suggestion: JSON.stringify({ action: "planlaeg_service", note: "Planlæg service" }),
        status: "afventer", createdAt: nowIso(),
      } as any);
      created.push(task);
    }
    // 6. Contract expiring soon
    const contracts = await storage.all("service_contracts", cid);
    for (const c of contracts.filter((c: any) => c.endDate && c.status === "aktiv")) {
      const daysToExpire = Math.floor((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToExpire <= 30 && daysToExpire >= 0) {
        const task = await storage.insert("ai_drift_tasks", {
          companyId: cid, type: "risiko", severity: daysToExpire <= 7 ? "critical" : "warning",
          title: `Kontrakt udløber snart: ${c.customerName} (${daysToExpire} dage)`,
          description: `Kontrakt ${c.contractNumber || ""} med ${c.customerName} udløber om ${daysToExpire} dage.`,
          data: JSON.stringify({ contractId: c.id }),
          suggestion: JSON.stringify({ action: "forny_kontrakt", note: "Kontakt kunde for fornyelse" }),
          status: "afventer", createdAt: nowIso(),
        } as any);
        created.push(task);
      }
    }
    res.json({ created: created.length, tasks: created, message: `AI Driftschef har gennemgået alt og oprettet ${created.length} opgaver` });
  }));
  app.patch("/api/ai-drift-tasks/:id", h(async (req, res) => {
    const updates = UPDATABLE(adtFields)(req);
    if (req.body.status === "godkendt") { updates.approvedAt = nowIso(); }
    res.json(await storage.update("ai_drift_tasks", Number(req.params.id), updates, tenantId(req)));
  }));

  // ════════════════════════════════════════════════════
  //  SMARTREGNSKAB — 12 nye features
  // ════════════════════════════════════════════════════

  // ── Bank/SKAT/NemHandel integrationer ──
  const biFields = ["type", "displayName", "status", "lastSync", "config", "notes"];
  app.get("/api/bank-integrations", h(async (req, res) => { res.json(await storage.all("bank_integrations", tenantId(req))); }));
  app.post("/api/bank-integrations", h(async (req, res) => {
    const data = validate(insertBankIntegrationSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("bank_integrations", data));
  }));
  app.patch("/api/bank-integrations/:id", h(async (req, res) => {
    res.json(await storage.update("bank_integrations", Number(req.params.id), UPDATABLE(biFields)(req), tenantId(req)));
  }));
  app.delete("/api/bank-integrations/:id", h(async (req, res) => {
    await storage.delete("bank_integrations", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Bogføringslov arkivering ──
  const arFields = ["voucherNumber", "date", "description", "amount", "fileName", "period", "locked", "archivePath"];
  app.get("/api/archive-records", h(async (req, res) => { res.json(await storage.all("archive_records", tenantId(req))); }));
  app.post("/api/archive-records", h(async (req, res) => {
    const data = validate(insertArchiveRecordSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("archive_records", data));
  }));
  app.patch("/api/archive-records/:id", h(async (req, res) => {
    res.json(await storage.update("archive_records", Number(req.params.id), UPDATABLE(arFields)(req), tenantId(req)));
  }));

  // ── Lønindberetning ──
  const prFields = ["period", "employeeCount", "grossTotal", "taxTotal", "holidayPayTotal", "pensionTotal", "atpTotal", "amContributionTotal", "netTotal", "eindkomstStatus", "feriekontoStatus", "status", "submittedAt"];
  app.get("/api/payroll-reports", h(async (req, res) => { res.json(await storage.all("payroll_reports", tenantId(req))); }));
  app.post("/api/payroll-reports", h(async (req, res) => {
    const cid = tenantId(req);
    const { period } = req.body;
    // Auto-generate from payroll entries
    const entries = await storage.all("payroll_entries", cid);
    const periodEntries = entries.filter((e: any) => e.period === period);
    const data = validate(insertPayrollReportSchema, {
      companyId: cid, period,
      employeeCount: periodEntries.length,
      grossTotal: periodEntries.reduce((s: number, e: any) => s + (e.grossSalary || 0), 0),
      taxTotal: periodEntries.reduce((s: number, e: any) => s + (e.aTax || 0), 0),
      holidayPayTotal: periodEntries.reduce((s: number, e: any) => s + (e.holidayPay || 0), 0),
      pensionTotal: periodEntries.reduce((s: number, e: any) => s + (e.pension || 0), 0),
      atpTotal: periodEntries.reduce((s: number, e: any) => s + (e.atp || 0), 0),
      amContributionTotal: periodEntries.reduce((s: number, e: any) => s + (e.amContribution || 0), 0),
      netTotal: periodEntries.reduce((s: number, e: any) => s + (e.netSalary || 0), 0),
      status: "kladde", createdAt: nowIso(),
    });
    res.status(201).json(await storage.insert("payroll_reports", data));
  }));
  app.patch("/api/payroll-reports/:id", h(async (req, res) => {
    res.json(await storage.update("payroll_reports", Number(req.params.id), UPDATABLE(prFields)(req), tenantId(req)));
  }));

  // ── Årsrapport ──
  const annualFields = ["year", "result", "taxResult", "balanceTotal", "equity", "xbrlStatus", "auditorPackage", "status", "submittedToErhvervsstyrelsen"];
  app.get("/api/annual-reports", h(async (req, res) => { res.json(await storage.all("annual_reports", tenantId(req))); }));
  app.post("/api/annual-reports", h(async (req, res) => {
    const data = validate(insertAnnualReportSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("annual_reports", data));
  }));
  app.patch("/api/annual-reports/:id", h(async (req, res) => {
    res.json(await storage.update("annual_reports", Number(req.params.id), UPDATABLE(annualFields)(req), tenantId(req)));
  }));

  // ── Avanceret debitorstyring (rykkerflow) ──
  const rfFields = ["invoiceId", "invoiceNumber", "customerName", "amount", "daysOverdue", "reminderLevel", "reminderFee", "interest", "status", "sentAt"];
  app.get("/api/reminder-flow", h(async (req, res) => { res.json(await storage.all("reminder_flow", tenantId(req))); }));
  app.post("/api/reminder-flow/auto-generate", h(async (req, res) => {
    const cid = tenantId(req);
    const invoices = await storage.all("invoices", cid);
    const now = new Date();
    const created: any[] = [];
    for (const inv of invoices.filter((i: any) => i.status === "sendt" && i.dueDate)) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        const existing = await storage.all("reminder_flow", cid);
        if (existing.some((r: any) => r.invoiceId === inv.id)) continue;
        const level = daysOverdue > 30 ? 3 : daysOverdue > 14 ? 2 : 1;
        const fee = level === 1 ? 100 : level === 2 ? 250 : 500;
        const interest = inv.totalAmount * 0.015 * (daysOverdue / 30);
        const reminder = await storage.insert("reminder_flow", {
          companyId: cid, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName, amount: inv.totalAmount,
          daysOverdue, reminderLevel: level, reminderFee: fee, interest,
          status: "afventer", createdAt: nowIso(),
        } as any);
        created.push(reminder);
      }
    }
    res.json({ created: created.length, reminders: created });
  }));
  app.patch("/api/reminder-flow/:id", h(async (req, res) => {
    res.json(await storage.update("reminder_flow", Number(req.params.id), UPDATABLE(rfFields)(req), tenantId(req)));
  }));

  // ── Periodisering ──
  const accFields = ["description", "type", "amount", "startDate", "endDate", "accountNumber", "monthlyAmount", "status"];
  app.get("/api/accruals", h(async (req, res) => { res.json(await storage.all("accruals", tenantId(req))); }));
  app.post("/api/accruals", h(async (req, res) => {
    const data = validate(insertAccrualSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    // Auto-beregn månedligt beløb
    if (data.amount && data.startDate && data.endDate) {
      const months = Math.max(1, Math.round((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)));
      data.monthlyAmount = data.amount / months;
    }
    res.status(201).json(await storage.insert("accruals", data));
  }));
  app.patch("/api/accruals/:id", h(async (req, res) => {
    res.json(await storage.update("accruals", Number(req.params.id), UPDATABLE(accFields)(req), tenantId(req)));
  }));
  app.delete("/api/accruals/:id", h(async (req, res) => {
    await storage.delete("accruals", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Lagerregnskab ──
  const iaFields = ["itemName", "quantity", "unitCost", "totalValue", "location", "lastCountDate", "status"];
  app.get("/api/inventory-accounts", h(async (req, res) => { res.json(await storage.all("inventory_accounts", tenantId(req))); }));
  app.post("/api/inventory-accounts", h(async (req, res) => {
    const data = validate(insertInventoryAccountSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    data.totalValue = (data.quantity || 0) * (data.unitCost || 0);
    res.status(201).json(await storage.insert("inventory_accounts", data));
  }));
  app.patch("/api/inventory-accounts/:id", h(async (req, res) => {
    const updates = UPDATABLE(iaFields)(req);
    if (updates.quantity !== undefined || updates.unitCost !== undefined) {
      // Recalculate totalValue
      const items = await storage.all("inventory_accounts", tenantId(req));
      const item = items.find((i: any) => i.id === Number(req.params.id));
      if (item) {
        const q = updates.quantity ?? item.quantity;
        const u = updates.unitCost ?? item.unitCost;
        updates.totalValue = q * u;
      }
    }
    res.json(await storage.update("inventory_accounts", Number(req.params.id), updates, tenantId(req)));
  }));
  app.delete("/api/inventory-accounts/:id", h(async (req, res) => {
    await storage.delete("inventory_accounts", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Valuta & udenlandsk moms ──
  const ctFields = ["date", "currency", "amount", "rate", "dkkAmount", "vatType", "description", "status"];
  app.get("/api/currency-transactions", h(async (req, res) => { res.json(await storage.all("currency_transactions", tenantId(req))); }));
  app.post("/api/currency-transactions", h(async (req, res) => {
    const data = validate(insertCurrencyTransactionSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    // Auto-beregn DKK beløb
    if (data.amount && data.rate) data.dkkAmount = data.amount * data.rate;
    res.status(201).json(await storage.insert("currency_transactions", data));
  }));
  app.patch("/api/currency-transactions/:id", h(async (req, res) => {
    res.json(await storage.update("currency_transactions", Number(req.params.id), UPDATABLE(ctFields)(req), tenantId(req)));
  }));
  app.delete("/api/currency-transactions/:id", h(async (req, res) => {
    await storage.delete("currency_transactions", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Revisorportal ──
  const apFields = ["auditorName", "requestType", "description", "status", "response", "dueDate"];
  app.get("/api/auditor-portal", h(async (req, res) => { res.json(await storage.all("auditor_portal", tenantId(req))); }));
  app.post("/api/auditor-portal", h(async (req, res) => {
    const data = validate(insertAuditorPortalSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("auditor_portal", data));
  }));
  app.patch("/api/auditor-portal/:id", h(async (req, res) => {
    res.json(await storage.update("auditor_portal", Number(req.params.id), UPDATABLE(apFields)(req), tenantId(req)));
  }));
  app.delete("/api/auditor-portal/:id", h(async (req, res) => {
    await storage.delete("auditor_portal", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Roller & kontrol ──
  const rcFields = ["roleName", "module", "canCreate", "canEdit", "canDelete", "canApprove", "approvalLimit", "requiresTwoFactor"];
  app.get("/api/role-controls", h(async (req, res) => { res.json(await storage.all("role_controls", tenantId(req))); }));
  app.post("/api/role-controls", h(async (req, res) => {
    const data = validate(insertRoleControlSchema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("role_controls", data));
  }));
  app.patch("/api/role-controls/:id", h(async (req, res) => {
    res.json(await storage.update("role_controls", Number(req.params.id), UPDATABLE(rcFields)(req), tenantId(req)));
  }));
  app.delete("/api/role-controls/:id", h(async (req, res) => {
    await storage.delete("role_controls", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));

  // ── Importguide ──
  const ijFields = ["source", "fileName", "status", "totalRows", "importedRows", "errorRows", "preview", "mapping"];
  app.get("/api/import-jobs2", h(async (req, res) => { res.json(await storage.all("import_jobs2", tenantId(req))); }));
  app.post("/api/import-jobs2", h(async (req, res) => {
    const data = validate(insertImportJob2Schema, { ...req.body, companyId: tenantId(req), createdAt: nowIso() });
    res.status(201).json(await storage.insert("import_jobs2", data));
  }));
  app.patch("/api/import-jobs2/:id", h(async (req, res) => {
    res.json(await storage.update("import_jobs2", Number(req.params.id), UPDATABLE(ijFields)(req), tenantId(req)));
  }));
  app.delete("/api/import-jobs2/:id", h(async (req, res) => {
    await storage.delete("import_jobs2", Number(req.params.id), tenantId(req)); res.status(204).send();
  }));
}
