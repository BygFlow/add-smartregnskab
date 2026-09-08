import { type Express } from "express";
import { db } from "./storage";
import { eq, and } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId, requireRole } from "./auth";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function registerExtendedRoutes7(app: Express) {

  // ════════════════════════════════════════
  //  AFVIGELSER / REKLAMATIONER / CAPA
  // ════════════════════════════════════════
  app.get("/api/deviations", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.deviations)
      .where(eq(schema.deviations.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/deviations", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.deviations).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/deviations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.deviations)
      .set(req.body)
      .where(and(eq(schema.deviations.id, parseInt(req.params.id)), eq(schema.deviations.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Afvigelse ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/deviations/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.deviations)
      .where(and(eq(schema.deviations.id, parseInt(req.params.id)), eq(schema.deviations.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  KEMIKALIEREGISTER
  // ════════════════════════════════════════
  app.get("/api/chemicals", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.chemicals)
      .where(eq(schema.chemicals.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/chemicals", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.chemicals).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/chemicals/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.chemicals)
      .set(req.body)
      .where(and(eq(schema.chemicals.id, parseInt(req.params.id)), eq(schema.chemicals.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Kemikalie ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/chemicals/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.chemicals)
      .where(and(eq(schema.chemicals.id, parseInt(req.params.id)), eq(schema.chemicals.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  KONTRAKT- OG PRISREGULERING
  // ════════════════════════════════════════
  app.get("/api/contract-adjustments", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.contractAdjustments)
      .where(eq(schema.contractAdjustments.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/contract-adjustments", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.contractAdjustments).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/contract-adjustments/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.contractAdjustments)
      .set(req.body)
      .where(and(eq(schema.contractAdjustments.id, parseInt(req.params.id)), eq(schema.contractAdjustments.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Regulering ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/contract-adjustments/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.contractAdjustments)
      .where(and(eq(schema.contractAdjustments.id, parseInt(req.params.id)), eq(schema.contractAdjustments.companyId, cid))).run();
    res.json({ success: true });
  }));
}
