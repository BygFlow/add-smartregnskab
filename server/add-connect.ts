import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { and, eq } from "drizzle-orm";
import { db, storage } from "./storage";
import {
  apiKeys,
  addConnectInvoiceDocuments,
  accounts,
  companies,
  customers,
  invoices,
  invoiceItems,
  journalEntries,
  journalLines,
  periodCloses,
  platformSyncJobs,
  platformSyncMappings,
} from "@shared/schema";
import { deleteFile, readFile, saveFile, storageBackend } from "./files";
import { validateEInvoice } from "./einvoice";

type AddConnectRequest = Request & {
  addConnect?: { companyId: number; keyId: number; scopes: string[] };
};

const PRODUCTS = ["smartdrift_pro", "smartdrift_clean"] as const;
const EXTERNAL_SOURCE = /^external_[a-z0-9_]{3,40}$/;
const EVENT_TYPES = ["customer.upsert", "invoice.draft", "invoice.issued", "payment.updated"] as const;
const nowIso = () => new Date().toISOString();

function sourceAllowed(sourceProduct: string, scopes: string[]): boolean {
  const boundSources = scopes.filter((scope) => scope.startsWith("add_connect:source:"));
  if (boundSources.length) return EXTERNAL_SOURCE.test(sourceProduct)
    && boundSources.includes(`add_connect:source:${sourceProduct}`);
  if (PRODUCTS.includes(sourceProduct as any)) return true;
  return false;
}

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

/** A source draft gets a NEW SmartRegnskab number and is not sent or booked on import. */
function importDraftInvoice(companyId: number, sourceProduct: string, payload: any) {
  const sourceId = text(payload.sourceId, 120);
  const issueDate = text(payload.issueDate, 10);
  if (!sourceId || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)
      || Number.isNaN(Date.parse(issueDate)) || new Date(issueDate).toISOString().slice(0, 10) !== issueDate) {
    throw new Error("invoice.draft kræver sourceId og gyldig issueDate.");
  }
  const dueDate = text(payload.dueDate, 10);
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      || Number.isNaN(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate
      || dueDate < issueDate)) {
    throw new Error("Fakturakladdens forfaldsdato skal være gyldig og tidligst fakturadatoen.");
  }
  if (text(payload.currency || "DKK", 3).toUpperCase() !== "DKK") {
    throw new Error("Kladder i anden valuta end DKK kræver særskilt valutaflow.");
  }
  const mappedCustomer = findMapping(companyId, sourceProduct, "customer", text(payload.customerSourceId, 120));
  if (!mappedCustomer) throw new Error("Kunden skal være synkroniseret før fakturakladden.");
  const customerId = Number(mappedCustomer.targetId);
  if (!db.select().from(customers).where(and(eq(customers.companyId, companyId), eq(customers.id, customerId))).get()) {
    throw new Error("Den synkroniserede kunde findes ikke i virksomheden.");
  }
  if (findMapping(companyId, sourceProduct, "invoice_draft", sourceId)) {
    throw new Error("Kilden har allerede oprettet denne fakturakladde. Genforsøg skal bruge samme idempotencyKey.");
  }
  if (findMapping(companyId, sourceProduct, "invoice", sourceId)) {
    throw new Error("Fakturaen er allerede importeret som udstedt og kan ikke også oprettes som kladde.");
  }
  const rawLines = payload.lines;
  if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 250) {
    throw new Error("invoice.draft kræver 1-250 fakturalinjer.");
  }
  const cents = (value: number) => Math.round(value * 100);
  const lines = rawLines.map((row: any) => {
    const quantity = Number(row.quantity), unitPrice = Number(row.unitPrice);
    const amount = Number(row.amount), vatRate = Number(row.vatRate);
    if (!text(row.description, 500) || ![quantity, unitPrice, amount, vatRate].every(Number.isFinite)
        || quantity <= 0 || unitPrice < 0 || amount < 0 || vatRate < 0 || vatRate > 100
        || cents(quantity * unitPrice) !== cents(amount)) {
      throw new Error("Fakturakladdens linjer har ugyldigt beløb, pris eller momssats.");
    }
    return { description: text(row.description, 500), quantity, unitPrice, amount, vatRate };
  });
  const netAmount = lines.reduce((sum, line) => sum + cents(line.amount), 0) / 100;
  const vatAmount = lines.reduce((sum, line) => sum + cents(line.amount * line.vatRate / 100), 0) / 100;
  const totalAmount = (cents(netAmount) + cents(vatAmount)) / 100;
  if (totalAmount <= 0) throw new Error("Fakturakladden skal have et positivt beløb.");
  const year = issueDate.slice(0, 4);
  return db.transaction((tx) => {
    const existing = tx.select().from(invoices).where(eq(invoices.companyId, companyId)).all();
    const used = new Set(existing.map((row) => row.invoiceNumber));
    let sequence = Math.max(1, existing.length + 1);
    let invoiceNumber = `F-${year}-${String(sequence).padStart(4, "0")}`;
    while (used.has(invoiceNumber)) invoiceNumber = `F-${year}-${String(++sequence).padStart(4, "0")}`;
    const invoice = tx.insert(invoices).values({
      companyId, customerId, invoiceNumber, issueDate,
      dueDate: dueDate || null, status: "kladde",
      netAmount, vatAmount, totalAmount, vatRate: netAmount ? Math.round(vatAmount / netAmount * 10000) / 100 : 0,
      paymentTerms: Math.max(0, Math.round(number(payload.paymentTerms, 14))),
      notes: `Fakturakladde fra ${sourceProduct}; kilde-ID ${sourceId}. Ikke sendt eller bogført.`.slice(0, 1000),
    }).returning().get();
    tx.insert(invoiceItems).values(lines.map((line) => ({ invoiceId: invoice.id, ...line }))).run();
    tx.insert(platformSyncMappings).values({
      companyId, sourcePlatform: sourceProduct, syncType: "invoice_draft", sourceId,
      targetPlatform: "add_smartregnskab", targetId: String(invoice.id), status: "synkroniseret", lastSyncedAt: nowIso(),
    }).run();
    return invoice;
  }, { behavior: "immediate" });
}

/** An already delivered source invoice is imported once and booked, never reissued. */
async function bookIssuedInvoice(companyId: number, sourceProduct: string, payload: any) {
  const sourceId = text(payload.sourceId, 120);
  const invoiceNumber = text(payload.invoiceNumber, 80);
  const issueDate = text(payload.issueDate, 10);
  const sentAt = text(payload.sentAt, 40);
  const deliveryChannel = text(payload.deliveryChannel, 40);
  const deliveryReference = text(payload.deliveryReference, 160);
  const documentHash = text(payload.documentHash, 64).toLowerCase();
  const documentMimeType = text(payload.documentMimeType || "application/pdf", 40).toLowerCase();
  if (text(payload.currency || "DKK", 3).toUpperCase() !== "DKK") {
    throw new Error("Valuta ud over DKK kræver særskilt kurs- og bogføringsflow.");
  }
  if (!sourceId || !invoiceNumber || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)
      || Number.isNaN(Date.parse(issueDate)) || new Date(issueDate).toISOString().slice(0, 10) !== issueDate
      || !sentAt || Number.isNaN(Date.parse(sentAt)) || !deliveryChannel || !deliveryReference
      || !/^[a-f0-9]{64}$/.test(documentHash)) {
    throw new Error("invoice.issued kræver sourceId, fakturanummer, gyldig dato og dokumenteret afsendelse (sentAt, deliveryChannel, deliveryReference, documentHash).");
  }
  const mappedCustomer = findMapping(companyId, sourceProduct, "customer", text(payload.customerSourceId, 120));
  if (!mappedCustomer) throw new Error("Kunden skal være synkroniseret før den udstedte faktura.");
  const customerId = Number(mappedCustomer.targetId);
  if (!db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get()) {
    throw new Error("Den synkroniserede kunde findes ikke i virksomheden.");
  }
  if (findMapping(companyId, sourceProduct, "invoice", sourceId)) {
    throw new Error("Fakturaens sourceId er allerede importeret. Brug oprindelig idempotencyKey ved genforsøg.");
  }
  if (findMapping(companyId, sourceProduct, "invoice_draft", sourceId)) {
    throw new Error("Fakturaen er allerede overdraget som kladde til SmartRegnskab og må ikke også importeres som udstedt.");
  }
  if (db.select().from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.invoiceNumber, invoiceNumber))).get()) {
    throw new Error("Fakturanummeret findes allerede i virksomheden.");
  }
  const closedPeriod = db.select().from(periodCloses).where(eq(periodCloses.companyId, companyId)).all()
    .some((period) => period.status === "afsluttet" && period.startDate <= issueDate && issueDate <= period.endDate);
  if (closedPeriod) throw new Error("Fakturaen kan ikke bogføres i en afsluttet regnskabsperiode.");
  const net = Number(payload.netAmount);
  const vat = Number(payload.vatAmount);
  const total = Number(payload.totalAmount);
  const cents = (value: number) => Math.round(value * 100);
  if (![net, vat, total].every((value) => Number.isFinite(value) && value >= 0)
      || total <= 0 || Math.abs(cents(net) + cents(vat) - cents(total)) > 0) {
    throw new Error("Fakturabeløbene skal være ikke-negative og stemme på øreniveau.");
  }
  const rawLines = payload.lines;
  if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 250) {
    throw new Error("invoice.issued kræver 1-250 fakturalinjer.");
  }
  const lines = rawLines.map((row: any) => {
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    const amount = Number(row.amount);
    const vatRate = Number(row.vatRate ?? 0);
    if (!text(row.description, 500) || ![quantity, unitPrice, amount, vatRate].every(Number.isFinite)
        || quantity <= 0 || unitPrice < 0 || amount < 0
        || vatRate < 0 || vatRate > 100
        || Math.abs(cents(quantity * unitPrice) - cents(amount)) > 0) {
      throw new Error("Fakturalinjerne skal have gyldig beskrivelse, antal, pris og beløb.");
    }
    return { description: text(row.description, 500), quantity, unitPrice, amount, vatRate };
  });
  if (lines.reduce((sum: number, line: any) => sum + cents(line.amount), 0) !== cents(net)) {
    throw new Error("Fakturalinjernes beløb stemmer ikke med netto.");
  }
  if (lines.reduce((sum: number, line: any) => sum + cents(line.amount * line.vatRate / 100), 0) !== cents(vat)) {
    throw new Error("Fakturalinjernes moms stemmer ikke med fakturaens moms.");
  }
  const mapping = payload.ledgerAccounts;
  const accountNumber = (value: unknown) => text(value, 40);
  if (!mapping || !accountNumber(mapping.receivables) || !accountNumber(mapping.revenue)
      || (vat > 0 && !accountNumber(mapping.outputVat))) {
    throw new Error("Bogføringskonti for debitor, omsætning og eventuel salgsmoms skal angives.");
  }
  const companyAccounts = db.select().from(accounts).where(eq(accounts.companyId, companyId)).all();
  const account = (number: string, type: string) => companyAccounts.find((row) => row.active
    && row.accountNumber === number && row.type === type);
  const receivable = account(accountNumber(mapping.receivables), "aktiv");
  const revenue = account(accountNumber(mapping.revenue), "indtaegt");
  const outputVat = vat > 0 ? account(accountNumber(mapping.outputVat), "passiv") : null;
  if (!receivable || !revenue || (vat > 0 && !outputVat)) {
    throw new Error("En eller flere bogføringskonti mangler, er inaktive eller har forkert type.");
  }
  const encoded = payload.documentBase64;
  // Keep the complete sync envelope below the application's 12 MB JSON limit.
  if (typeof encoded !== "string" || !encoded || encoded.length > 8_000_000
      || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("Original PDF-faktura mangler eller har ugyldigt base64-format.");
  }
  const pdf = Buffer.from(encoded, "base64");
  if (!pdf.length || pdf.toString("base64") !== encoded
      || createHash("sha256").update(pdf).digest("hex") !== documentHash) {
    throw new Error("Originaldokumentet matcher ikke dokumentets SHA-256.");
  }
  if (documentMimeType !== (deliveryChannel === "edi" ? "application/xml" : "application/pdf")) {
    throw new Error("EDI kræver original XML; øvrige afsendelser kræver original PDF.");
  }
  if (documentMimeType === "application/xml") {
    const payloadXml = pdf.toString("utf8");
    if (validateEInvoice(payloadXml).length) throw new Error("Originalt EDI-dokument er ikke en gyldig e-faktura.");
    const root = new XMLParser({ ignoreAttributes: false }).parse(payloadXml)?.Invoice;
    const id = String(root?.["cbc:ID"] ?? "");
    const amountValue = root?.["cac:LegalMonetaryTotal"]?.["cbc:PayableAmount"];
    const payable = Number(typeof amountValue === "object" ? amountValue?.["#text"] : amountValue);
    if (id !== invoiceNumber || !Number.isFinite(payable) || cents(payable) !== cents(total)) {
      throw new Error("Originalt EDI-dokument stemmer ikke med fakturanummer eller totalbeløb.");
    }
  }
  if (process.env.NODE_ENV === "production" && storageBackend() === "disk" && !process.env.FILE_STORAGE_DIR) {
    throw new Error("Fakturaarkivet kræver S3 eller et konfigureret vedvarende FILE_STORAGE_DIR i produktion.");
  }
  const file = await saveFile({ companyId, fileName: documentMimeType === "application/xml" ? "original-faktura.xml" : "original-faktura.pdf", mimeType: documentMimeType, buffer: pdf });
  try {
    return db.transaction((tx) => {
    // The unique invoice number and journal entry number also protect concurrent retries.
    const invoice = tx.insert(invoices).values({
      companyId, customerId, invoiceNumber, status: "sendt", issueDate,
      dueDate: text(payload.dueDate, 10) || null, sentAt,
      netAmount: net, vatAmount: vat, totalAmount: total,
      vatRate: net ? Math.round((vat / net) * 10000) / 100 : 0,
      paymentTerms: Math.max(0, Math.round(number(payload.paymentTerms, 14))),
      paidAmount: 0,
      notes: `Import fra ${sourceProduct}; leveret via ${deliveryChannel}; kvittering ${deliveryReference}; dokument SHA-256 ${documentHash}`.slice(0, 1000),
    }).returning().get();
    tx.insert(invoiceItems).values(lines.map((line: any) => ({ invoiceId: invoice.id, ...line }))).run();
    const entry = tx.insert(journalEntries).values({
      companyId, entryNumber: `ADD-CONNECT-${invoice.id}`, date: issueDate,
      description: `Udstedt faktura ${invoiceNumber} fra ${sourceProduct}`,
      reference: invoiceNumber, sourceType: "faktura", sourceId: invoice.id,
      status: "bogført", createdBy: `add-connect:${sourceProduct}`, createdAt: nowIso(),
    }).returning().get();
    tx.insert(journalLines).values([
      { companyId, journalEntryId: entry.id, accountId: receivable.id, debit: total, credit: 0 },
      { companyId, journalEntryId: entry.id, accountId: revenue.id, debit: 0, credit: net },
      ...(vat > 0 ? [{ companyId, journalEntryId: entry.id, accountId: outputVat!.id, debit: 0, credit: vat }] : []),
    ]).run();
    tx.insert(platformSyncMappings).values({
      companyId, sourcePlatform: sourceProduct, syncType: "invoice", sourceId,
      targetPlatform: "add_smartregnskab", targetId: String(invoice.id), status: "synkroniseret",
      lastSyncedAt: nowIso(),
    }).run();
    tx.insert(addConnectInvoiceDocuments).values({
      companyId, invoiceId: invoice.id, sourceProduct, sourceId,
      storage: file.storage, storageKey: file.storageKey, mimeType: documentMimeType, sizeBytes: file.sizeBytes,
      sha256: documentHash, deliveryChannel, deliveryReference, createdAt: nowIso(),
    }).run();
    return invoice;
    }, { behavior: "immediate" });
  } catch (error) {
    await deleteFile(file.storage, file.storageKey).catch(() => {});
    throw error;
  }
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

  /** Let the approved source observe a draft's later send/booking without seeing other tenants or sources. */
  app.get("/api/add-connect/records", requireAddConnect("read"), (req: AddConnectRequest, res) => {
    const companyId = req.addConnect!.companyId;
    const sourceProduct = text(req.query.sourceProduct, 40);
    const sourceId = text(req.query.sourceId, 120);
    if (!sourceAllowed(sourceProduct, req.addConnect!.scopes)) {
      return res.status(403).json({ error: "API-nøglen er ikke godkendt til kildeprogrammet." });
    }
    if (!sourceId) return res.status(400).json({ error: "sourceId er påkrævet." });
    const mapping = findMapping(companyId, sourceProduct, "invoice_draft", sourceId)
      || findMapping(companyId, sourceProduct, "invoice", sourceId);
    if (!mapping) return res.status(404).json({ error: "Fakturaen findes ikke for denne kilde." });
    const invoice = db.select().from(invoices).where(and(
      eq(invoices.companyId, companyId), eq(invoices.id, Number(mapping.targetId)),
    )).get();
    if (!invoice) return res.status(404).json({ error: "Fakturaen findes ikke længere i virksomheden." });
    const booked = !!db.select().from(journalEntries).where(and(
      eq(journalEntries.companyId, companyId), eq(journalEntries.sourceType, "faktura"),
      eq(journalEntries.sourceId, invoice.id), eq(journalEntries.status, "bogført"),
    )).get();
    const archive = db.select().from(addConnectInvoiceDocuments).where(and(
      eq(addConnectInvoiceDocuments.companyId, companyId), eq(addConnectInvoiceDocuments.invoiceId, invoice.id),
    )).get();
    res.json({ sourceProduct, sourceId, flow: mapping.syncType === "invoice_draft" ? "draft" : "issued",
      invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status,
      sentAt: invoice.sentAt, booked, documentArchived: !!archive });
  });

  app.get("/api/add-connect/documents", requireAddConnect("read"), async (req: AddConnectRequest, res) => {
    const companyId = req.addConnect!.companyId;
    const sourceProduct = text(req.query.sourceProduct, 40);
    const sourceId = text(req.query.sourceId, 120);
    if (!sourceAllowed(sourceProduct, req.addConnect!.scopes))
      return res.status(403).json({ error: "API-nøglen er ikke godkendt til kildeprogrammet." });
    if (!sourceId) return res.status(400).json({ error: "sourceId er påkrævet." });
    const archive = db.select().from(addConnectInvoiceDocuments).where(and(
      eq(addConnectInvoiceDocuments.companyId, companyId),
      eq(addConnectInvoiceDocuments.sourceProduct, sourceProduct),
      eq(addConnectInvoiceDocuments.sourceId, sourceId),
    )).get();
    if (!archive) return res.status(404).json({ error: "Originaldokumentet findes ikke for denne kilde." });
    try {
      const pdf = await readFile(archive.storage, archive.storageKey);
      if (createHash("sha256").update(pdf).digest("hex") !== archive.sha256)
        return res.status(500).json({ error: "Originaldokumentets integritet kunne ikke verificeres." });
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", archive.mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(pdf);
    } catch {
      return res.status(503).json({ error: "Originaldokumentet er midlertidigt utilgængeligt." });
    }
  });

  app.get("/api/add-connect/payments", requireAddConnect("read"), async (req: AddConnectRequest, res) => {
    const companyId = req.addConnect!.companyId;
    const sourceProduct = text(req.query.sourceProduct, 40);
    if (!sourceAllowed(sourceProduct, req.addConnect!.scopes)) return res.status(403).json({ error: "API-nøglen er ikke godkendt til kildeprogrammet." });
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
    if (!sourceAllowed(sourceProduct, req.addConnect!.scopes)) return res.status(403).json({ error: "API-nøglen er ikke godkendt til kildeprogrammet." });
    if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey er påkrævet." });
    if (!events.length || events.length > 100) return res.status(400).json({ error: "events skal indeholde 1-100 hændelser." });

    const requestSourceId = `request:${idempotencyKey}`;
    const duplicate = findMapping(companyId, sourceProduct, "request", requestSourceId);
    if (duplicate) {
      const prior = db.select().from(platformSyncJobs).where(and(
        eq(platformSyncJobs.id, Number(duplicate.targetId)), eq(platformSyncJobs.companyId, companyId),
      )).get();
      const failed = (prior?.errorRecords ?? 0) > 0;
      return res.status(failed ? 207 : 200).json({
        ok: !failed, duplicate: true, jobId: Number(duplicate.targetId),
        failed: prior?.errorRecords ?? 0,
        errors: failed && prior?.errorMessage ? JSON.parse(prior.errorMessage) : [],
      });
    }

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
    for (const [index, event] of events.entries()) {
      const type = text(event?.type, 60);
      try {
        if (type === "customer.upsert") upsertCustomer(companyId, sourceProduct, event.data || {});
        else if (type === "invoice.upsert") throw new Error("invoice.upsert er lukket. Brug invoice.draft til en kladde eller invoice.issued til en allerede sendt faktura.");
        else if (type === "invoice.draft") importDraftInvoice(companyId, sourceProduct, event.data || {});
        else if (type === "invoice.issued") await bookIssuedInvoice(companyId, sourceProduct, event.data || {});
        else if (type === "payment.updated") updatePayment(companyId, sourceProduct, event.data || {});
        else throw new Error(`Ikke-understøttet hændelsestype: ${type || "tom"}.`);
        success += 1;
      } catch (error) {
        errors.push({ index, type, error: error instanceof Error ? error.message : "Ukendt fejl" });
      }
    }

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
