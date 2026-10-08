import type { Express, Request, Response } from "express";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./storage";
import { storage } from "./storage";
import * as schema from "@shared/schema";

type ApiContext = { companyId: number; keyId: number; keyPrefix: string; scopes: string[]; rateLimit: number };
type ApiRequest = Request & { externalApi?: ApiContext };
const usage = new Map<number, { minute: number; count: number }>();
const asyncRoute = (fn: (req: ApiRequest, res: Response) => Promise<unknown>) => (req: ApiRequest, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function equalHash(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function scopesOf(value: unknown): string[] {
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed.map(String) : []; }
  catch { return String(value || "").split(/[, ]+/).filter(Boolean); }
}

async function authenticate(req: ApiRequest, res: Response, next: any) {
  const header = String(req.headers.authorization || "");
  const rawKey = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!rawKey || !rawKey.startsWith("sr_live_")) return res.status(401).json({ error: "En gyldig Bearer API-nøgle er påkrævet." });
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const candidate = db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hash)).get();
  const key = candidate?.keyHash && equalHash(String(candidate.keyHash), hash) ? candidate : null;
  if (!key || key.status !== "aktiv") return res.status(401).json({ error: "API-nøglen er ugyldig eller tilbagekaldt." });
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return res.status(401).json({ error: "API-nøglen er udløbet." });
  const plan = await storage.getCompanyPlan(Number(key.companyId));
  let features: string[] = [];
  try { features = JSON.parse(plan?.features || "[]"); } catch {}
  if (!features.includes("api_integration")) return res.status(402).json({ error: "API og webhooks er ikke inkluderet i virksomhedens abonnement." });
  const minute = Math.floor(Date.now() / 60_000);
  const rateLimit = Math.min(10_000, Math.max(60, Number(key.rateLimit) || 1_000));
  const current = usage.get(key.id);
  const counter = current?.minute === minute ? current : { minute, count: 0 };
  counter.count += 1; usage.set(key.id, counter);
  res.setHeader("X-RateLimit-Limit", String(rateLimit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, rateLimit - counter.count)));
  res.setHeader("X-RateLimit-Reset", String((minute + 1) * 60));
  if (counter.count > rateLimit) return res.status(429).json({ error: "API-rate limit er overskredet." });
  req.externalApi = { companyId: Number(key.companyId), keyId: key.id, keyPrefix: String(key.keyPrefix), scopes: scopesOf(key.scopes), rateLimit };
  await storage.update("api_keys", key.id, { lastUsed: new Date().toISOString() }, Number(key.companyId));
  next();
}

function requireScope(scope: "read" | "write") {
  return (req: ApiRequest, res: Response, next: any) => req.externalApi?.scopes.includes(scope)
    ? next()
    : res.status(403).json({ error: `API-nøglen mangler scope: ${scope}.` });
}

function invoiceLines(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) throw { status: 400, message: "Fakturaen skal have mellem 1 og 500 linjer." };
  return value.map((line: any, index) => {
    const description = String(line?.description || "").trim().slice(0, 500);
    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unitPrice);
    const vatRate = Number(line?.vatRate ?? 25);
    const accountNumber = line?.accountNumber ? String(line.accountNumber).trim() : null;
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      throw { status: 400, message: `Fakturalinje ${index + 1} er ugyldig.` };
    }
    const amount = round2(quantity * unitPrice);
    return { description, quantity, unitPrice, vatRate, accountNumber, amount, vatAmount: round2(amount * vatRate / 100) };
  });
}

async function deliverWebhook(companyId: number, event: string, data: unknown) {
  const keys = (await storage.all("api_keys", companyId)).filter((key: any) => {
    if (key.status !== "aktiv" || !/^https:\/\//i.test(String(key.webhookUrl || ""))) return false;
    try { const events = JSON.parse(key.webhookEvents || "[]"); return Array.isArray(events) && events.includes(event); }
    catch { return false; }
  });
  const payload = JSON.stringify({ id: randomUUID(), event, occurredAt: new Date().toISOString(), companyId, data });
  await Promise.allSettled(keys.map(async (key: any) => {
    const signature = createHmac("sha256", String(key.keyHash)).update(payload).digest("hex");
    try {
      const response = await fetch(String(key.webhookUrl), {
        method: "POST", signal: AbortSignal.timeout(5_000),
        headers: { "content-type": "application/json", "x-smartregnskab-signature": signature, "x-smartregnskab-event": event },
        body: payload,
      });
      await storage.update("api_keys", key.id, { webhookLog: JSON.stringify({ event, deliveredAt: new Date().toISOString(), status: response.status, ok: response.ok }) }, companyId);
    } catch (error) {
      await storage.update("api_keys", key.id, { webhookLog: JSON.stringify({ event, attemptedAt: new Date().toISOString(), ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "Levering fejlede" }) }, companyId);
    }
  }));
}

export function registerExternalAccountingApi(app: Express) {
  app.use("/api/external/v1", authenticate);

  app.get("/api/external/v1/company", requireScope("read"), asyncRoute(async (req, res) => {
    const company = await storage.getCompany(req.externalApi!.companyId);
    if (!company) return res.status(404).json({ error: "Virksomheden findes ikke." });
    res.json({ id: company.id, name: company.name, cvr: company.cvr, currency: "DKK" });
  }));

  app.get("/api/external/v1/customers", requireScope("read"), asyncRoute(async (req, res) => {
    const rows = await storage.getCustomers(req.externalApi!.companyId);
    res.json(rows.map((customer: any) => ({ id: customer.id, name: customer.name, cvr: customer.cvr, email: customer.email })));
  }));

  app.get("/api/external/v1/invoices", requireScope("read"), asyncRoute(async (req, res) => {
    const rows = await storage.getInvoices(req.externalApi!.companyId);
    res.json(rows.map((invoice: any) => ({
      id: invoice.id, invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId,
      status: invoice.status, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
      netAmount: invoice.netAmount, vatAmount: invoice.vatAmount, totalAmount: invoice.totalAmount,
    })));
  }));

  app.post("/api/external/v1/invoices", requireScope("write"), asyncRoute(async (req, res) => {
    const cid = req.externalApi!.companyId;
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim().slice(0, 200);
    if (!idempotencyKey) return res.status(400).json({ error: "Idempotency-Key-headeren er påkrævet." });
    const prior = (await storage.all("audit_logs", cid)).find((row: any) => {
      if (row.action !== "external_invoice_created") return false;
      try { return JSON.parse(row.detail || "{}").idempotencyKey === idempotencyKey; } catch { return false; }
    });
    if (prior?.target?.startsWith("invoice:")) {
      const existing = await storage.getInvoice(Number(prior.target.slice(8)), cid);
      if (existing) return res.status(200).json({ ...existing, idempotentReplay: true });
    }

    const documentType = String(req.body?.documentType || "draft");
    if (!["draft", "invoice"].includes(documentType)) return res.status(400).json({ error: "documentType skal være draft eller invoice." });
    const customerId = Number(req.body?.customerId);
    const customer = await storage.getCustomer(customerId, cid);
    if (!customer) return res.status(400).json({ error: "customerId tilhører ikke virksomheden." });
    const lines = invoiceLines(req.body?.lines);
    const issueDate = String(req.body?.issueDate || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return res.status(400).json({ error: "issueDate skal angives som YYYY-MM-DD." });
    const paymentTerms = Math.min(365, Math.max(0, Math.round(Number(req.body?.paymentTerms) || 14)));
    const dueDate = req.body?.dueDate ? String(req.body.dueDate) : new Date(new Date(`${issueDate}T12:00:00Z`).getTime() + paymentTerms * 86_400_000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < issueDate) return res.status(400).json({ error: "dueDate skal være en gyldig dato på eller efter issueDate." });
    const netAmount = round2(lines.reduce((sum, line) => sum + line.amount, 0));
    const vatAmount = round2(lines.reduce((sum, line) => sum + line.vatAmount, 0));
    const totalAmount = round2(netAmount + vatAmount);
    const existingInvoices = await storage.getInvoices(cid);
    const requestedNumber = String(req.body?.invoiceNumber || "").trim().slice(0, 80);
    if (documentType === "invoice" && !requestedNumber) return res.status(400).json({ error: "En endelig faktura skal have invoiceNumber fra kildesystemet." });
    const invoiceNumber = requestedNumber || `EKST-KLADDE-${new Date().getFullYear()}-${String(existingInvoices.length + 1).padStart(5, "0")}`;
    if (existingInvoices.some((invoice) => invoice.invoiceNumber === invoiceNumber)) return res.status(409).json({ error: "Fakturanummeret findes allerede." });

    const accounts = await storage.all("accounts", cid);
    const debtor = accounts.find((account: any) => account.accountNumber === "1200" && account.active);
    const vatAccount = accounts.find((account: any) => account.accountNumber === "2310" && account.active);
    const defaultRevenue = accounts.find((account: any) => account.type === "indtaegt" && account.active);
    if (documentType === "invoice" && (!debtor || (vatAmount > 0 && !vatAccount) || !defaultRevenue)) {
      return res.status(409).json({ error: "Kontoplanen mangler en aktiv debitorkonto (1200), salgsmomskonto (2310) eller indtægtskonto." });
    }
    const accountByNumber = new Map(accounts.map((account: any) => [String(account.accountNumber), account]));
    if (documentType === "invoice") {
      const invalidAccount = lines.find((line) => {
        if (!line.accountNumber) return false;
        const account: any = accountByNumber.get(line.accountNumber);
        return !account || !account.active || account.type !== "indtaegt";
      });
      if (invalidAccount) return res.status(400).json({ error: `Konto ${invalidAccount.accountNumber} er ikke en aktiv indtægtskonto.` });
    }

    const now = new Date().toISOString();
    const result = db.transaction((tx) => {
      const invoice = tx.insert(schema.invoices).values({
        companyId: cid, customerId, invoiceNumber,
        status: documentType === "invoice" ? "sendt" : "kladde", issueDate, dueDate,
        netAmount, vatRate: Number(lines[0]?.vatRate ?? 25), vatAmount, totalAmount, paymentTerms,
        sentAt: documentType === "invoice" ? now : null, notes: req.body?.notes ? String(req.body.notes).slice(0, 2_000) : null,
      }).returning().get();
      for (const line of lines) tx.insert(schema.invoiceItems).values({ invoiceId: invoice.id, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount, vatRate: line.vatRate }).run();
      let journalEntryId: number | null = null;
      if (documentType === "invoice") {
        const count = tx.select().from(schema.journalEntries).where(eq(schema.journalEntries.companyId, cid)).all().length;
        const entry = tx.insert(schema.journalEntries).values({
          companyId: cid, entryNumber: `API-${new Date(issueDate).getFullYear()}-${String(count + 1).padStart(6, "0")}`,
          date: issueDate, description: `Ekstern faktura ${invoiceNumber}`, reference: invoiceNumber,
          sourceType: "faktura", sourceId: invoice.id, status: "bogfoert", createdBy: `API:${req.externalApi!.keyPrefix}`, createdAt: now,
        }).returning().get();
        journalEntryId = entry.id;
        tx.insert(schema.journalLines).values({ companyId: cid, journalEntryId: entry.id, accountId: debtor.id, description: `Debitor ${invoiceNumber}`, debit: totalAmount, credit: 0, vatCode: "ingen" }).run();
        for (const line of lines) {
          const account: any = line.accountNumber ? accountByNumber.get(line.accountNumber) : defaultRevenue;
          tx.insert(schema.journalLines).values({ companyId: cid, journalEntryId: entry.id, accountId: account.id, description: line.description, debit: 0, credit: line.amount, vatCode: line.vatRate ? `I${line.vatRate}` : "ingen" }).run();
        }
        if (vatAmount > 0) tx.insert(schema.journalLines).values({ companyId: cid, journalEntryId: entry.id, accountId: vatAccount.id, description: `Salgsmoms ${invoiceNumber}`, debit: 0, credit: vatAmount, vatCode: "I25" }).run();
      }
      tx.insert(schema.auditLogs).values({ companyId: cid, userId: null, userEmail: `API:${req.externalApi!.keyPrefix}`, action: "external_invoice_created", target: `invoice:${invoice.id}`, detail: JSON.stringify({ idempotencyKey, documentType, journalEntryId }), createdAt: now }).run();
      return { invoice, journalEntryId };
    });
    void deliverWebhook(cid, "invoice.created", { invoiceId: result.invoice.id, invoiceNumber, documentType, status: result.invoice.status });
    res.status(201).json({ ...result.invoice, booked: documentType === "invoice", journalEntryId: result.journalEntryId });
  }));
}
