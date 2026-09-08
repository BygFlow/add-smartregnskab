import { type Express } from "express";
import { db } from "../server/storage";
import { eq, and } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId, requireRole } from "./auth";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function registerExtendedRoutes4(app: Express) {

  // ════════════════════════════════════════
  //  LEVERANDØRKARTOTEK
  // ════════════════════════════════════════
  app.get("/api/suppliers", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.suppliers)
      .where(eq(schema.suppliers.companyId, cid)).all();
    res.json(rows);
  }));

  app.get("/api/suppliers/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.select().from(schema.suppliers)
      .where(and(eq(schema.suppliers.id, parseInt(req.params.id)), eq(schema.suppliers.companyId, cid))).get();
    if (!row) return res.status(404).json({ error: "Leverandør ikke fundet" });
    res.json(row);
  }));

  app.post("/api/suppliers", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid };
    const row = db.insert(schema.suppliers).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/suppliers/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.suppliers)
      .set(req.body)
      .where(and(eq(schema.suppliers.id, parseInt(req.params.id)), eq(schema.suppliers.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Leverandør ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/suppliers/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.suppliers)
      .where(and(eq(schema.suppliers.id, parseInt(req.params.id)), eq(schema.suppliers.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  PRODUKT-/YDELSESKARTOTEK
  // ════════════════════════════════════════
  app.get("/api/products", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.products)
      .where(eq(schema.products.companyId, cid)).all();
    res.json(rows);
  }));

  app.get("/api/products/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.select().from(schema.products)
      .where(and(eq(schema.products.id, parseInt(req.params.id)), eq(schema.products.companyId, cid))).get();
    if (!row) return res.status(404).json({ error: "Produkt ikke fundet" });
    res.json(row);
  }));

  app.post("/api/products", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid };
    const row = db.insert(schema.products).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/products/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.products)
      .set(req.body)
      .where(and(eq(schema.products.id, parseInt(req.params.id)), eq(schema.products.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Produkt ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/products/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.products)
      .where(and(eq(schema.products.id, parseInt(req.params.id)), eq(schema.products.companyId, cid))).run();
    res.json({ success: true });
  }));

  // ════════════════════════════════════════
  //  FASTE FAKTURAER / ABONNEMENTER
  // ════════════════════════════════════════
  app.get("/api/recurring-invoices", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.recurringInvoices)
      .where(eq(schema.recurringInvoices.companyId, cid)).all();
    res.json(rows);
  }));

  app.get("/api/recurring-invoices/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.select().from(schema.recurringInvoices)
      .where(and(eq(schema.recurringInvoices.id, parseInt(req.params.id)), eq(schema.recurringInvoices.companyId, cid))).get();
    if (!row) return res.status(404).json({ error: "Abonnement ikke fundet" });
    res.json(row);
  }));

  app.post("/api/recurring-invoices", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.recurringInvoices).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/recurring-invoices/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.recurringInvoices)
      .set(req.body)
      .where(and(eq(schema.recurringInvoices.id, parseInt(req.params.id)), eq(schema.recurringInvoices.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Abonnement ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/recurring-invoices/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.recurringInvoices)
      .where(and(eq(schema.recurringInvoices.id, parseInt(req.params.id)), eq(schema.recurringInvoices.companyId, cid))).run();
    res.json({ success: true });
  }));
}
