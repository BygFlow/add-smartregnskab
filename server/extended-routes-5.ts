import { type Express } from "express";
import { db } from "../server/storage";
import { eq, and } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId, requireRole } from "./auth";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function registerExtendedRoutes5(app: Express) {

  // ════════════════════════════════════════
  //  UDGIFTSREGISTRERING
  // ════════════════════════════════════════
  app.get("/api/expense-reports", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.expenseReports)
      .where(eq(schema.expenseReports.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/expense-reports", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.expenseReports).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/expense-reports/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.expenseReports)
      .set(req.body)
      .where(and(eq(schema.expenseReports.id, parseInt(req.params.id)), eq(schema.expenseReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Udgift ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/expense-reports/:id", h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.expenseReports)
      .where(and(eq(schema.expenseReports.id, parseInt(req.params.id)), eq(schema.expenseReports.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  KØRSELSREGISTRERING
  // ════════════════════════════════════════
  app.get("/api/mileage-reports", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.mileageReports)
      .where(eq(schema.mileageReports.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/mileage-reports", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.mileageReports).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/mileage-reports/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.mileageReports)
      .set(req.body)
      .where(and(eq(schema.mileageReports.id, parseInt(req.params.id)), eq(schema.mileageReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Kørsel ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/mileage-reports/:id", h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.mileageReports)
      .where(and(eq(schema.mileageReports.id, parseInt(req.params.id)), eq(schema.mileageReports.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  FLÅDESTYRING — Køretøjer
  // ════════════════════════════════════════
  app.get("/api/vehicles", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.vehicles)
      .where(eq(schema.vehicles.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/vehicles", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.vehicles).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/vehicles/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.vehicles)
      .set(req.body)
      .where(and(eq(schema.vehicles.id, parseInt(req.params.id)), eq(schema.vehicles.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Køretøj ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/vehicles/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.vehicles)
      .where(and(eq(schema.vehicles.id, parseInt(req.params.id)), eq(schema.vehicles.companyId, cid))).run();
    res.json({ success: true });
  }));

  // Køretøjslog
  app.get("/api/vehicle-logs", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.vehicleLogs)
      .where(eq(schema.vehicleLogs.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/vehicle-logs", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.vehicleLogs).values(data).returning().get();
    res.json(row);
  }));

  app.delete("/api/vehicle-logs/:id", h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.vehicleLogs)
      .where(and(eq(schema.vehicleLogs.id, parseInt(req.params.id)), eq(schema.vehicleLogs.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  KUNDETILFREDSHED
  // ════════════════════════════════════════
  app.get("/api/customer-feedback", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.customerFeedback)
      .where(eq(schema.customerFeedback.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/customer-feedback", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.customerFeedback).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/customer-feedback/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.customerFeedback)
      .set(req.body)
      .where(and(eq(schema.customerFeedback.id, parseInt(req.params.id)), eq(schema.customerFeedback.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Feedback ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/customer-feedback/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.customerFeedback)
      .where(and(eq(schema.customerFeedback.id, parseInt(req.params.id)), eq(schema.customerFeedback.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  MEDARBEJDERKOMPETENCER
  // ════════════════════════════════════════
  app.get("/api/employee-certifications", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.employeeCertifications)
      .where(eq(schema.employeeCertifications.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/employee-certifications", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.employeeCertifications).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/employee-certifications/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.employeeCertifications)
      .set(req.body)
      .where(and(eq(schema.employeeCertifications.id, parseInt(req.params.id)), eq(schema.employeeCertifications.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Certifikat ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/employee-certifications/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.employeeCertifications)
      .where(and(eq(schema.employeeCertifications.id, parseInt(req.params.id)), eq(schema.employeeCertifications.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  TJEKLISTER PR. LOKATION
  // ════════════════════════════════════════
  app.get("/api/location-checklists", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.locationChecklists)
      .where(eq(schema.locationChecklists.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/location-checklists", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.locationChecklists).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/location-checklists/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.locationChecklists)
      .set(req.body)
      .where(and(eq(schema.locationChecklists.id, parseInt(req.params.id)), eq(schema.locationChecklists.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Tjekliste ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/location-checklists/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.locationChecklists)
      .where(and(eq(schema.locationChecklists.id, parseInt(req.params.id)), eq(schema.locationChecklists.companyId, cid))).run();
    res.json({ success: true });
  }));

  // Tjekliste udførelse
  app.get("/api/checklist-executions", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.checklistExecutions)
      .where(eq(schema.checklistExecutions.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/checklist-executions", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.checklistExecutions).values(data).returning().get();
    res.json(row);
  }));
}
