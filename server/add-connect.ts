import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, storage } from "./storage";
import {
  accounts,
  auditLogs,
  apiKeys,
  companies,
  customers,
  invoices,
  invoiceItems,
  journalEntries,
  journalLines,
  platformSyncJobs,
  platformSyncMappings,
} from "@shared/schema";
import { providerStatus } from "./einvoice";
import { addSproomProduct, safeSproomConnection, sproomConnectionForCompany } from "./sproom-registry";

type AddConnectRequest = Request & {
  addConnect?: { companyId: number; keyId: number; scopes: string[] };
};

const PRODUCTS = ["smartdrift_pro", "smartdrift_clean"] as const;
type AddConnectProduct = typeof PRODUCTS[number];
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

function parentSproomProducts(companyId: number): string[] {
  const linked = db.select().from(platformSyncMappings).where(and(
    eq(platformSyncMappings.companyId, companyId),
    eq(platformSyncMappings.syncType, "einvoice_product"),
  )).all().map((row) => row.sourcePlatform).filter((product) => PRODUCTS.includes(product as AddConnectProduct));
  return Array.from(new Set(["add_smartregnskab", ...linked]));
}

export function registerSproomProductForCompany(companyId: number, sourceProduct: AddConnectProduct) {
  const provider = providerStatus(companyId);
  if (provider.provider === "sproom" && provider.parentCompany && provider.masterConfigured) {
    saveMapping(companyId, sourceProduct, "einvoice_product", sourceProduct, "sproom_parent");
    return {
      ok: true,
      reusedParentCompany: true,
      reusedExistingChildCompany: false,
      connection: {
        cvr: provider.masterCvr,
        status: "forbundet",
        sourceProducts: parentSproomProducts(companyId),
        nemhandelStatus: "styret_af_sproom",
        peppolStatus: "kræver_verifikation",
        connected: true,
        parentCompany: true,
      },
    };
  }
  const connection = addSproomProduct(companyId, sourceProduct);
  if (!connection) return null;
  return {
    ok: true,
    reusedParentCompany: false,
    reusedExistingChildCompany: true,
    connection: safeSproomConnection(connection),
  };
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

const BOOKABLE_INVOICE_STATUSES = new Set(["sendt", "betalt", "delvist_betalt", "forfalden", "rykket", "overdraget"]);
const DRAFT_INVOICE_STATUSES = new Set(["kladde", "udkast", "draft"]);
const CANCELLED_INVOICE_STATUSES = new Set(["annulleret", "cancelled", "canceled"]);

function canonicalInvoiceStatus(value: unknown): string {
  const status = text(value, 40).toLowerCase().replace(/[\s-]+/g, "_") || "kladde";
  if (DRAFT_INVOICE_STATUSES.has(status)) return "kladde";
  if (CANCELLED_INVOICE_STATUSES.has(status)) return "annulleret";
  if (["udstedt", "issued", "sent"].includes(status)) return "sendt";
  if (["partial_paid", "partially_paid"].includes(status)) return "delvist_betalt";
  if (["kreditnoteret", "credit_note", "credited"].includes(status)) return "krediteret";
  if (BOOKABLE_INVOICE_STATUSES.has(status) || status === "krediteret") return status;
  throw new Error(`Fakturastatus '${text(value, 40)}' understøttes ikke af ADD Connect.`);
}

const roundMoney = (value: unknown): number => Math.round((number(value) + Number.EPSILON) * 100) / 100;

type NormalizedInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number;
  accountNumber: string | null;
};

function normalizedInvoiceLines(payload: any, fallbackVatRate: number): NormalizedInvoiceLine[] {
  if (!Array.isArray(payload.lines) || payload.lines.length < 1 || payload.lines.length > 250) {
    throw new Error("invoice.upsert kræver 1-250 fakturalinjer.");
  }
  return payload.lines.map((row: any, index: number) => {
    const description = text(row?.description, 500);
    const quantity = number(row?.quantity, 1);
    const unitPrice = number(row?.unitPrice);
    const amount = roundMoney(row?.amount ?? quantity * unitPrice);
    const vatRate = number(row?.vatRate, fallbackVatRate);
    const accountNumber = text(row?.accountNumber, 40) || null;
    if (!description || !(quantity > 0) || unitPrice < 0 || amount < 0 || vatRate < 0 || vatRate > 100) {
      throw new Error(`Fakturalinje ${index + 1} er ugyldig.`);
    }
    if (Math.abs(roundMoney(quantity * unitPrice) - amount) > 0.01) {
      throw new Error(`Fakturalinje ${index + 1} stemmer ikke mellem antal, enhedspris og beløb.`);
    }
    return { description, quantity, unitPrice, amount, vatRate, accountNumber };
  });
}

export function upsertAddConnectInvoice(companyId: number, sourceProduct: string, payload: any) {
  const sourceId = text(payload.sourceId, 120);
  const invoiceNumber = text(payload.invoiceNumber, 80);
  if (!sourceId || !invoiceNumber) throw new Error("invoice.upsert kræver sourceId og invoiceNumber.");
  const customerId = resolveCustomer(companyId, sourceProduct, payload);
  const status = canonicalInvoiceStatus(payload.status);
  const netAmount = roundMoney(payload.netAmount ?? payload.amount);
  const vatAmount = roundMoney(payload.vatAmount ?? payload.vat);
  const totalAmount = roundMoney(payload.totalAmount ?? payload.total ?? netAmount + vatAmount);
  if (netAmount < 0 || vatAmount < 0 || Math.abs(roundMoney(netAmount + vatAmount) - totalAmount) > 0.01) {
    throw new Error(`Faktura ${invoiceNumber} har ugyldige eller uafstemte totaler.`);
  }
  const vatRate = number(payload.vatRate, netAmount ? (vatAmount / netAmount) * 100 : 25);
  const lines = normalizedInvoiceLines(payload, vatRate);
  if (Math.abs(roundMoney(lines.reduce((sum, line) => sum + line.amount, 0)) - netAmount) > 0.01) {
    throw new Error(`Faktura ${invoiceNumber} stemmer ikke med fakturalinjerne.`);
  }
  const lineVatAmount = roundMoney(lines.reduce((sum, line) => sum + roundMoney(line.amount * line.vatRate / 100), 0));
  if (Math.abs(lineVatAmount - vatAmount) > 0.02) {
    throw new Error(`Faktura ${invoiceNumber} har et momsbeløb, der ikke stemmer med fakturalinjerne.`);
  }
  const issueDate = text(payload.issueDate || payload.date, 10) || nowIso().slice(0, 10);
  const dueDate = text(payload.dueDate, 10) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < issueDate))) {
    throw new Error(`Faktura ${invoiceNumber} har en ugyldig faktura- eller forfaldsdato.`);
  }
  const paidAmount = payload.paidAmount == null
    ? status === "betalt" ? totalAmount : 0
    : roundMoney(payload.paidAmount);
  if (paidAmount < 0 || paidAmount - totalAmount > 0.01) {
    throw new Error(`Faktura ${invoiceNumber} har et ugyldigt betalt beløb.`);
  }
  const values = {
    customerId,
    invoiceNumber,
    status,
    issueDate,
    dueDate,
    netAmount,
    vatRate,
    vatAmount,
    totalAmount,
    paymentTerms: Math.min(365, Math.max(0, Math.round(number(payload.paymentTerms, 14)))),
    paidAmount,
    paidAt: text(payload.paidAt, 40) || null,
    notes: text(payload.notes, 1000) || null,
    sentAt: BOOKABLE_INVOICE_STATUSES.has(status) || status === "krediteret" ? text(payload.sentAt, 40) || nowIso() : null,
  };
  return db.transaction((tx) => {
    const mapped = tx.select().from(platformSyncMappings).where(and(
      eq(platformSyncMappings.companyId, companyId),
      eq(platformSyncMappings.sourcePlatform, sourceProduct),
      eq(platformSyncMappings.syncType, "invoice"),
      eq(platformSyncMappings.sourceId, sourceId),
    )).get();
    const existing = mapped ? tx.select().from(invoices).where(and(
      eq(invoices.id, Number(mapped.targetId)),
      eq(invoices.companyId, companyId),
    )).get() : undefined;
    const existingEntry = existing ? tx.select().from(journalEntries).where(and(
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.sourceType, "faktura"),
      eq(journalEntries.sourceId, existing.id),
    )).get() : undefined;
    const numberOwner = tx.select().from(invoices).where(and(
      eq(invoices.companyId, companyId),
      eq(invoices.invoiceNumber, invoiceNumber),
    )).get();
    if (numberOwner && numberOwner.id !== existing?.id) {
      throw new Error(`Fakturanummer ${invoiceNumber} findes allerede i SmartRegnskab og tilhører et andet dokument.`);
    }

    if (existingEntry && existing) {
      const changed = existing.invoiceNumber !== invoiceNumber
        || existing.customerId !== customerId
        || existing.issueDate !== values.issueDate
        || existing.dueDate !== values.dueDate
        || Math.abs(existing.netAmount - netAmount) > 0.01
        || Math.abs(existing.vatAmount - vatAmount) > 0.01
        || Math.abs(existing.totalAmount - totalAmount) > 0.01;
      if (changed) throw new Error(`Bogført faktura ${invoiceNumber} kan ikke ændres gennem ADD Connect. Opret en kreditnota eller en ny faktura.`);
      if (status === "kladde" || status === "annulleret") throw new Error(`Bogført faktura ${invoiceNumber} kan ikke føres tilbage til ${status}.`);
    }
    if (status === "krediteret" && !existingEntry) {
      throw new Error(`Faktura ${invoiceNumber} kan ikke oprettes direkte som krediteret. Synkroniser først den udstedte faktura og derefter kreditnotaen.`);
    }

    let target = existing;
    if (target) {
      const updateValues = existingEntry
        ? { status, paidAmount: values.paidAmount, paidAt: values.paidAt }
        : values;
      target = tx.update(invoices).set(updateValues).where(and(
        eq(invoices.id, target.id),
        eq(invoices.companyId, companyId),
      )).returning().get();
    }
    if (!target) target = tx.insert(invoices).values({ companyId, ...values }).returning().get();

    if (!existingEntry) {
      tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, target.id)).run();
      for (const line of lines) tx.insert(invoiceItems).values({
        invoiceId: target.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        vatRate: line.vatRate,
      }).run();
    }

    let journalEntryId: number | null = existingEntry?.id ?? null;
    if (BOOKABLE_INVOICE_STATUSES.has(status) && !existingEntry) {
      const chart = tx.select().from(accounts).where(eq(accounts.companyId, companyId)).all();
      const debtor = chart.find((account) => account.accountNumber === "1200" && account.active);
      const vatAccount = chart.find((account) => account.accountNumber === "2310" && account.active);
      const defaultRevenue = chart.find((account) => account.type === "indtaegt" && account.active);
      if (!debtor || (vatAmount > 0 && !vatAccount) || !defaultRevenue) {
        throw new Error("Kontoplanen mangler en aktiv debitorkonto (1200), salgsmomskonto (2310) eller indtægtskonto.");
      }
      const accountByNumber = new Map(chart.map((account) => [account.accountNumber, account]));
      for (const line of lines) {
        const account = line.accountNumber ? accountByNumber.get(line.accountNumber) : defaultRevenue;
        if (!account || !account.active || account.type !== "indtaegt") {
          throw new Error(`Konto ${line.accountNumber || "standardindtægt"} er ikke en aktiv indtægtskonto.`);
        }
      }
      const year = values.issueDate.slice(0, 4);
      const sourceHash = createHash("sha256").update(`${sourceProduct}:${sourceId}`).digest("hex").slice(0, 12).toUpperCase();
      const entry = tx.insert(journalEntries).values({
        companyId,
        entryNumber: `ADD-${year}-${sourceHash}`,
        date: values.issueDate,
        description: `Ekstern faktura ${invoiceNumber}`,
        reference: invoiceNumber,
        sourceType: "faktura",
        sourceId: target.id,
        status: "bogfoert",
        createdBy: `ADD Connect:${sourceProduct}`,
        createdAt: nowIso(),
      }).returning().get();
      journalEntryId = entry.id;
      tx.insert(journalLines).values({ companyId, journalEntryId: entry.id, accountId: debtor.id, description: `Debitor ${invoiceNumber}`, debit: totalAmount, credit: 0, vatCode: "ingen" }).run();
      for (const line of lines) {
        const account = line.accountNumber ? accountByNumber.get(line.accountNumber)! : defaultRevenue;
        tx.insert(journalLines).values({ companyId, journalEntryId: entry.id, accountId: account.id, description: line.description, debit: 0, credit: line.amount, vatCode: line.vatRate ? account.vatCode || `S${line.vatRate}` : "ingen" }).run();
      }
      if (vatAmount > 0 && vatAccount) tx.insert(journalLines).values({ companyId, journalEntryId: entry.id, accountId: vatAccount.id, description: `Salgsmoms ${invoiceNumber}`, debit: 0, credit: vatAmount, vatCode: vatAccount.vatCode || `S${vatRate}` }).run();
      tx.insert(auditLogs).values({
        companyId,
        userId: null,
        userEmail: `ADD Connect:${sourceProduct}`,
        action: "add_connect_invoice_booked",
        target: `invoice:${target.id}`,
        detail: JSON.stringify({ sourceId, invoiceNumber, journalEntryId }),
        createdAt: nowIso(),
      }).run();
    }

    const mappingValues = { targetId: String(target.id), targetPlatform: "add_smartregnskab", status: "synkroniseret", lastSyncedAt: nowIso() };
    if (mapped) tx.update(platformSyncMappings).set(mappingValues).where(eq(platformSyncMappings.id, mapped.id)).run();
    else tx.insert(platformSyncMappings).values({ companyId, sourcePlatform: sourceProduct, syncType: "invoice", sourceId, ...mappingValues }).run();
    return { invoice: target, booked: journalEntryId !== null, journalEntryId };
  });
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

  app.get("/api/add-connect/einvoice", requireAddConnect("read"), (req: AddConnectRequest, res) => {
    const companyId = req.addConnect!.companyId;
    const provider = providerStatus(companyId);
    const connection = provider.provider === "sproom" && provider.parentCompany && provider.masterConfigured
      ? {
          cvr: provider.masterCvr,
          status: "forbundet",
          sourceProducts: parentSproomProducts(companyId),
          nemhandelStatus: "styret_af_sproom",
          peppolStatus: "kræver_verifikation",
          connected: true,
          parentCompany: true,
        }
      : safeSproomConnection(sproomConnectionForCompany(companyId));
    res.json({
      ok: true,
      model: "one_child_company_per_cvr",
      owner: { name: "ADD SmartDrift ApS", cvr: "46761898" },
      connection,
      provider,
    });
  });

  app.post("/api/add-connect/einvoice/register-product", requireAddConnect("write"), (req: AddConnectRequest, res) => {
    const sourceProduct = text(req.body?.sourceProduct, 40);
    if (!PRODUCTS.includes(sourceProduct as any)) return res.status(400).json({ error: "Ukendt ADD-produkt." });
    const registration = registerSproomProductForCompany(req.addConnect!.companyId, sourceProduct as AddConnectProduct);
    if (!registration) return res.status(409).json({ error: "Virksomheden skal først godkende NemHandel/Peppol-onboarding i ADD SmartRegnskab." });
    res.json(registration);
  });

  app.get("/api/add-connect/payments", requireAddConnect("read"), async (req: AddConnectRequest, res) => {
    const companyId = req.addConnect!.companyId;
    const sourceProduct = text(req.query.sourceProduct, 40);
    if (!PRODUCTS.includes(sourceProduct as any)) return res.status(400).json({ error: "Ukendt ADD-produkt." });
    const mappings = db.select().from(platformSyncMappings).where(and(
      eq(platformSyncMappings.companyId, companyId),
      eq(platformSyncMappings.sourcePlatform, sourceProduct),
      eq(platformSyncMappings.syncType, "invoice"),
    )).all().slice(0, 2000);
    const payments = mappings.flatMap((mapping) => {
      const invoice = db.select().from(invoices).where(and(
        eq(invoices.id, Number(mapping.targetId)),
        eq(invoices.companyId, companyId),
      )).get();
      if (!invoice) return [];
      return [{
        sourceId: mapping.sourceId,
        status: invoice.status,
        paidAmount: invoice.paidAmount,
        totalAmount: invoice.totalAmount,
        paidAt: invoice.paidAt,
      }];
    });
    res.json({ ok: true, sourceProduct, payments });
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
        else if (type === "invoice.upsert") upsertAddConnectInvoice(companyId, sourceProduct, event.data || {});
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
