import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, storage } from "./storage";
import {
  apiKeys,
  companies,
  customers,
  invoices,
  invoiceItems,
  platformSyncJobs,
  platformSyncMappings,
} from "@shared/schema";

type AddConnectRequest = Request & {
  addConnect?: { companyId: number; keyId: number; scopes: string[] };
};

const PRODUCTS = ["smartdrift_pro", "smartdrift_clean"] as const;
const EVENT_TYPES = ["customer.upsert", "invoice.upsert", "payment.updated"] as const;
const nowIso = () => new Date().toISOString();

function jsonScopes(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) return value.map(String);
  } catch {
    // Legacy keys used comma separated scopes.
  }
  return raw.split(/[\s,]+/).filter(Boolean);
}

function bearer(req: Request): string {
  const header = req.header("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireAddConnect(scope: "read" | "write") {
  return async (req: AddConnectRequest, res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      if (!token.startsWith("sk_") || token.length < 24) {
        return res.status(401).json({ error: "Gyldig ADD Connect API-nøgle mangler." });
      }
      const hash = createHash("sha256").update(token).digest("hex");
      const row = db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).get();
      if (!row || !row.keyHash || !safeEqual(row.keyHash, hash) || row.status !== "aktiv") {
        return res.status(401).json({ error: "API-nøglen er ugyldig eller deaktiveret." });
      }
      if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
        return res.status(401).json({ error: "API-nøglen er udløbet." });
      }
      const scopes = jsonScopes(row.scopes);
      const allowed = scopes.includes("admin")
        || scopes.includes(scope)
        || scopes.includes(`add_connect:${scope}`);
      if (!allowed) return res.status(403).json({ error: `API-nøglen mangler add_connect:${scope}.` });

      db.update(apiKeys).set({ lastUsed: nowIso() }).where(eq(apiKeys.id, row.id)).run();
      req.addConnect = { companyId: row.companyId, keyId: row.id, scopes };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function text(value: unknown, max = 255): string {
  return String(value ?? "").trim().slice(0, max);
}

function number(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function findMapping(companyId: number, sourceProduct: string, syncType: string, sourceId: string) {
  return db.select().from(platformSyncMappings).where(and(
    eq(platformSyncMappings.companyId, companyId),
    eq(platformSyncMappings.sourcePlatform, sourceProduct),
    eq(platformSyncMappings.syncType, syncType),
    eq(platformSyncMappings.sourceId, sourceId),
  )).get();
}

function saveMapping(companyId: number, sourceProduct: string, syncType: string, sourceId: string, targetId: string) {
  const existing = findMapping(companyId, sourceProduct, syncType, sourceId);
  const values = { targetId, targetPlatform: "add_smartregnskab", status: "synkroniseret", lastSyncedAt: nowIso() };
  if (existing) {
    db.update(platformSyncMappings).set(values).where(eq(platformSyncMappings.id, existing.id)).run();
    return existing.id;
  }
  return db.insert(platformSyncMappings).values({
    companyId,
    sourcePlatform: sourceProduct,
    syncType,
    sourceId,
    ...values,
  }).returning().get().id;
}

function upsertCustomer(companyId: number, sourceProduct: string, payload: any) {
  const sourceId = text(payload.sourceId, 120);
  const name = text(payload.name, 200);
  if (!sourceId || !name) throw new Error("customer.upsert kræver sourceId og name.");
  const mapped = findMapping(companyId, sourceProduct, "customer", sourceId);
  const values = {
    name,
    customerNumber: text(payload.customerNumber, 80) || null,
    cvr: text(payload.cvr, 20) || null,
    email: text(payload.email, 200) || null,
    invoiceEmail: text(payload.invoiceEmail || payload.email, 200) || null,
    phone: text(payload.phone, 40) || null,
    address: text(payload.address, 300) || null,
    contactPerson: text(payload.contactPerson, 160) || null,
    paymentTerms: text(payload.paymentTerms, 40) || null,
  };
  let target;
  if (mapped) {
    target = db.update(customers).set(values).where(and(
      eq(customers.id, Number(mapped.targetId)),
      eq(customers.companyId, companyId),
    )).returning().get();
  }
  if (!target) target = db.insert(customers).values({ companyId, ...values }).returning().get();
  saveMapping(companyId, sourceProduct, "customer", sourceId, String(target.id));
  return target;
}

function resolveCustomer(companyId: number, sourceProduct: string, payload: any): number {
  const customerSourceId = text(payload.customerSourceId, 120);
  if (customerSourceId) {
    const mapped = findMapping(companyId, sourceProduct, "customer", customerSourceId);
    if (mapped) return Number(mapped.targetId);
  }
  if (payload.customer && typeof payload.customer === "object") {
    return upsertCustomer(companyId, sourceProduct, {
      sourceId: customerSourceId || payload.customer.sourceId || `invoice-customer:${text(payload.sourceId, 120)}`,
      ...payload.customer,
    }).id;
  }
  throw new Error("invoice.upsert kræver customerSourceId eller customer.");
}

function upsertInvoice(companyId: number, sourceProduct: string, payload: any) {
  const sourceId = text(payload.sourceId, 120);
  const invoiceNumber = text(payload.invoiceNumber, 80);
  if (!sourceId || !invoiceNumber) throw new Error("invoice.upsert kræver sourceId og invoiceNumber.");
  const customerId = resolveCustomer(companyId, sourceProduct, payload);
  const mapped = findMapping(companyId, sourceProduct, "invoice", sourceId);
  const netAmount = number(payload.netAmount ?? payload.amount);
  const vatAmount = number(payload.vatAmount ?? payload.vat);
  const totalAmount = number(payload.totalAmount ?? payload.total, netAmount + vatAmount);
  const values = {
    customerId,
    invoiceNumber,
    status: text(payload.status, 40) || "kladde",
    issueDate: text(payload.issueDate || payload.date, 10) || nowIso().slice(0, 10),
    dueDate: text(payload.dueDate, 10) || null,
    netAmount,
    vatRate: number(payload.vatRate, netAmount ? (vatAmount / netAmount) * 100 : 25),
    vatAmount,
    totalAmount,
    paymentTerms: Math.max(0, Math.round(number(payload.paymentTerms, 14))),
    paidAmount: number(payload.paidAmount),
    paidAt: text(payload.paidAt, 40) || null,
    notes: text(payload.notes, 1000) || null,
  };
  let target;
  if (mapped) {
    target = db.update(invoices).set(values).where(and(
      eq(invoices.id, Number(mapped.targetId)),
      eq(invoices.companyId, companyId),
    )).returning().get();
  }
  if (!target) target = db.insert(invoices).values({ companyId, ...values }).returning().get();

  if (Array.isArray(payload.lines)) {
    db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, target.id)).run();
    for (const row of payload.lines.slice(0, 250)) {
      const quantity = number(row.quantity, 1);
      const unitPrice = number(row.unitPrice);
      db.insert(invoiceItems).values({
        invoiceId: target.id,
        description: text(row.description, 500) || "Ydelse",
        quantity,
        unitPrice,
        amount: number(row.amount, quantity * unitPrice),
        vatRate: number(row.vatRate, 25),
      }).run();
    }
  }
  saveMapping(companyId, sourceProduct, "invoice", sourceId, String(target.id));
  return target;
}

function updatePayment(companyId: number, sourceProduct: string, payload: any) {
  const invoiceSourceId = text(payload.invoiceSourceId || payload.sourceId, 120);
  const mapped = findMapping(companyId, sourceProduct, "invoice", invoiceSourceId);
  if (!mapped) throw new Error("payment.updated henviser til en faktura, der ikke er synkroniseret.");
  const paidAmount = number(payload.paidAmount ?? payload.amount);
  const target = db.select().from(invoices).where(and(
    eq(invoices.id, Number(mapped.targetId)),
    eq(invoices.companyId, companyId),
  )).get();
  if (!target) throw new Error("Den synkroniserede faktura findes ikke længere.");
  return db.update(invoices).set({
    paidAmount,
    paidAt: text(payload.paidAt, 40) || nowIso(),
    status: paidAmount >= target.totalAmount ? "betalt" : target.status,
  }).where(eq(invoices.id, target.id)).returning().get();
}

export function registerPublicAddConnectRoutes(app: Express) {
  app.get("/api/add-connect/catalog", (_req, res) => {
    res.json({
      version: "2026-09-22",
      products: [
        { id: "add_smartregnskab", name: "ADD SmartRegnskab", role: "Regnskab og økonomisk system of record" },
        { id: "smartdrift_pro", name: "ADD SmartDrift Pro", role: "Drift, projekter, timer og fakturagrundlag" },
        { id: "smartdrift_clean", name: "ADD SmartDrift Clean", role: "Rengøringsdrift, timer og fakturagrundlag" },
      ],
      eventTypes: EVENT_TYPES,
      security: ["Tenant-isoleret API-nøgle", "Eksplicitte scopes", "Idempotente kald", "Revisionsspor"],
    });
  });

  app.get("/api/add-connect/status", requireAddConnect("read"), async (req: AddConnectRequest, res) => {
    const auth = req.addConnect!;
    const company = db.select().from(companies).where(eq(companies.id, auth.companyId)).get();
    res.json({ ok: true, product: "add_smartregnskab", company: company ? { id: company.id, name: company.name } : null, scopes: auth.scopes });
  });

  app.post("/api/add-connect/sync", requireAddConnect("write"), async (req: AddConnectRequest, res) => {
    const companyId = req.addConnect!.companyId;
    const sourceProduct = text(req.body?.sourceProduct, 40);
    const idempotencyKey = text(req.body?.idempotencyKey || req.header("idempotency-key"), 160);
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!PRODUCTS.includes(sourceProduct as any)) return res.status(400).json({ error: "Ukendt ADD-produkt." });
    if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey er påkrævet." });
    if (!events.length || events.length > 100) return res.status(400).json({ error: "events skal indeholde 1-100 hændelser." });

    const requestSourceId = `request:${idempotencyKey}`;
    const duplicate = findMapping(companyId, sourceProduct, "request", requestSourceId);
    if (duplicate) return res.status(200).json({ ok: true, duplicate: true, jobId: Number(duplicate.targetId) });

    const startedAt = nowIso();
    const job = db.insert(platformSyncJobs).values({
      companyId,
      sourcePlatform: sourceProduct,
      targetPlatform: "add_smartregnskab",
      syncType: "add_connect",
      status: "igang",
      totalRecords: events.length,
      syncedRecords: 0,
      errorRecords: 0,
      startedAt,
      createdAt: startedAt,
    }).returning().get();

    let success = 0;
    const errors: Array<{ index: number; type: string; error: string }> = [];
    events.forEach((event: any, index: number) => {
      const type = text(event?.type, 60);
      try {
        if (type === "customer.upsert") upsertCustomer(companyId, sourceProduct, event.data || {});
        else if (type === "invoice.upsert") upsertInvoice(companyId, sourceProduct, event.data || {});
        else if (type === "payment.updated") updatePayment(companyId, sourceProduct, event.data || {});
        else throw new Error(`Ikke-understøttet hændelsestype: ${type || "tom"}.`);
        success += 1;
      } catch (error) {
        errors.push({ index, type, error: error instanceof Error ? error.message : "Ukendt fejl" });
      }
    });

    const completedAt = nowIso();
    db.update(platformSyncJobs).set({
      status: errors.length ? (success ? "delvist_gennemført" : "fejl") : "gennemført",
      syncedRecords: success,
      errorRecords: errors.length,
      errorMessage: errors.length ? JSON.stringify(errors).slice(0, 4000) : null,
      completedAt,
    }).where(eq(platformSyncJobs.id, job.id)).run();
    saveMapping(companyId, sourceProduct, "request", requestSourceId, String(job.id));
    await storage.createAuditLog({
      companyId,
      userId: null,
      action: "add_connect_sync",
      entityType: "platform_sync_jobs",
      entityId: job.id,
      details: JSON.stringify({ sourceProduct, success, failed: errors.length, idempotencyKey }),
      createdAt: completedAt,
    } as any);

    res.status(errors.length ? 207 : 200).json({ ok: errors.length === 0, duplicate: false, jobId: job.id, processed: events.length, success, failed: errors.length, errors });
  });
}
