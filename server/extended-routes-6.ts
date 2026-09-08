import { type Express } from "express";
import { db } from "./storage";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId, requireRole } from "./auth";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function registerExtendedRoutes6(app: Express) {

  // ════════════════════════════════════════
  //  GODKENDELSESCENTER — samlet godkendelses-API
  // ════════════════════════════════════════
  app.get("/api/approvals/pending", h(async (req, res) => {
    const cid = tenantId(req);
    const [expenses, mileage, feedback] = await Promise.all([
      db.select().from(schema.expenseReports).where(and(
        eq(schema.expenseReports.companyId, cid),
        eq(schema.expenseReports.status, "afventer")
      )).all(),
      db.select().from(schema.mileageReports).where(and(
        eq(schema.mileageReports.companyId, cid),
        eq(schema.mileageReports.status, "afventer")
      )).all(),
      db.select().from(schema.customerFeedback).where(and(
        eq(schema.customerFeedback.companyId, cid),
        eq(schema.customerFeedback.status, "ny")
      )).all(),
    ]);
    res.json({
      expenses,
      mileage,
      feedback,
      totalPending: expenses.length + mileage.length + feedback.length,
    });
  }));

  // Godkend udgift
  app.post("/api/approvals/expense/:id/approve", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.expenseReports)
      .set({ status: "godkendt", approvedBy: (req as any).auth.userId, approvedAt: new Date().toISOString() })
      .where(and(eq(schema.expenseReports.id, parseInt(req.params.id)), eq(schema.expenseReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Udgift ikke fundet" });
    res.json(row);
  }));

  app.post("/api/approvals/expense/:id/reject", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.expenseReports)
      .set({ status: "afvist", approvedBy: (req as any).auth.userId, approvedAt: new Date().toISOString(), rejectionReason: req.body.reason || "" })
      .where(and(eq(schema.expenseReports.id, parseInt(req.params.id)), eq(schema.expenseReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Udgift ikke fundet" });
    res.json(row);
  }));

  // Godkend kørsel
  app.post("/api/approvals/mileage/:id/approve", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.mileageReports)
      .set({ status: "godkendt", approvedBy: (req as any).auth.userId, approvedAt: new Date().toISOString() })
      .where(and(eq(schema.mileageReports.id, parseInt(req.params.id)), eq(schema.mileageReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Kørsel ikke fundet" });
    res.json(row);
  }));

  app.post("/api/approvals/mileage/:id/reject", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.mileageReports)
      .set({ status: "afvist", approvedBy: (req as any).auth.userId, approvedAt: new Date().toISOString(), rejectionReason: req.body.reason || "" })
      .where(and(eq(schema.mileageReports.id, parseInt(req.params.id)), eq(schema.mileageReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Kørsel ikke fundet" });
    res.json(row);
  }));

  // Besvar feedback
  app.post("/api/approvals/feedback/:id/respond", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.customerFeedback)
      .set({ status: req.body.status || "under_behandling", response: req.body.response || "", respondedBy: (req as any).auth.userId, respondedAt: new Date().toISOString() })
      .where(and(eq(schema.customerFeedback.id, parseInt(req.params.id)), eq(schema.customerFeedback.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Feedback ikke fundet" });
    res.json(row);
  }));

  // ════════════════════════════════════════
  //  DRIFT → REGNSKAB EKSPORT
  // ════════════════════════════════════════
  app.get("/api/accounting-exports", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.accountingExports)
      .where(eq(schema.accountingExports.companyId, cid)).all();
    res.json(rows);
  }));

  // Eksporter godkendte udgifter til bogføring
  app.post("/api/accounting-exports/export-expenses", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const approvedExpenses = db.select().from(schema.expenseReports).where(and(
      eq(schema.expenseReports.companyId, cid),
      eq(schema.expenseReports.status, "godkendt")
    )).all();

    const exported: any[] = [];
    for (const exp of approvedExpenses) {
      const accountMap: Record<string, string> = {
        braendstof: "6100", materialer: "6120", parkering: "6150",
        frokost: "7100", transport: "6100", andet: "6990",
      };
      const acct = accountMap[exp.category] || "6990";
      const voucherNo = `EXP-${exp.id}-${Date.now()}`;
      const row = db.insert(schema.accountingExports).values({
        companyId: cid,
        sourceType: "expense",
        sourceId: exp.id,
        exportDate: new Date().toISOString(),
        status: "eksporteret",
        voucherNumber: voucherNo,
        accountNumber: acct,
        amount: exp.amount,
        description: `Udgift: ${exp.category} - ${exp.description || ""}`,
        exportedBy: (req as any).auth.userId,
        createdAt: new Date().toISOString(),
      }).returning().get();

      // Mark expense as betalt
      db.update(schema.expenseReports)
        .set({ status: "betalt" })
        .where(eq(schema.expenseReports.id, exp.id)).run();

      exported.push(row);
    }
    res.json({ exported: exported.length, items: exported });
  }));

  // Eksporter godkendt kørsel til løn
  app.post("/api/accounting-exports/export-mileage", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const approvedMileage = db.select().from(schema.mileageReports).where(and(
      eq(schema.mileageReports.companyId, cid),
      eq(schema.mileageReports.status, "godkendt")
    )).all();

    const exported: any[] = [];
    for (const m of approvedMileage) {
      const voucherNo = `KOR-${m.id}-${Date.now()}`;
      const row = db.insert(schema.accountingExports).values({
        companyId: cid,
        sourceType: "mileage",
        sourceId: m.id,
        exportDate: new Date().toISOString(),
        status: "eksporteret",
        voucherNumber: voucherNo,
        accountNumber: "7210",
        amount: m.compensation,
        description: `Kørsel: ${m.kilometers} km - ${m.purpose}`,
        exportedBy: (req as any).auth.userId,
        createdAt: new Date().toISOString(),
      }).returning().get();

      // Mark mileage as betalt
      db.update(schema.mileageReports)
        .set({ status: "betalt" })
        .where(eq(schema.mileageReports.id, m.id)).run();

      exported.push(row);
    }
    res.json({ exported: exported.length, items: exported });
  }));

  // ════════════════════════════════════════
  //  QR CHECK-IN
  // ════════════════════════════════════════
  app.get("/api/qr-checkins", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.qrCheckins)
      .where(eq(schema.qrCheckins.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/qr-checkins", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.qrCheckins).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/qr-checkins/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.qrCheckins)
      .set(req.body)
      .where(and(eq(schema.qrCheckins.id, parseInt(req.params.id)), eq(schema.qrCheckins.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Check-in ikke fundet" });
    res.json(row);
  }));

  // Aktiv check-in for medarbejder
  app.get("/api/qr-checkins/active/:employeeId", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.qrCheckins).where(and(
      eq(schema.qrCheckins.companyId, cid),
      eq(schema.qrCheckins.employeeId, parseInt(req.params.employeeId)),
      eq(schema.qrCheckins.status, "aktiv")
    )).all();
    res.json(rows);
  }));

  // Check-out (afslut)
  app.post("/api/qr-checkins/:id/checkout", h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.qrCheckins)
      .set({
        status: "afsluttet",
        checkOutTime: new Date().toISOString(),
        afterPhotos: JSON.stringify(req.body.afterPhotos || []),
        notes: req.body.notes || "",
      })
      .where(and(eq(schema.qrCheckins.id, parseInt(req.params.id)), eq(schema.qrCheckins.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Check-in ikke fundet" });
    res.json(row);
  }));
}
