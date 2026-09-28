import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import express from "express";
import { and, eq } from "drizzle-orm";

process.env.DATABASE_PATH = ":memory:";
const fileRoot = mkdtempSync(path.join(tmpdir(), "add-connect-docs-"));
process.env.FILE_STORAGE_DIR = fileRoot;
after(() => rmSync(fileRoot, { recursive: true, force: true }));
const pdf = Buffer.from("%PDF-1.4\n% Faktura til isoleret integrationstest\n");
const documentBase64 = pdf.toString("base64");
const documentHash = createHash("sha256").update(pdf).digest("hex");
const { registerPublicAddConnectRoutes } = await import("../server/add-connect");
const { db, storage } = await import("../server/storage");
const { accounts, addConnectInvoiceDocuments, apiKeys, customers, invoices, journalEntries, journalLines, platformSyncMappings } = await import("../shared/schema");

test("ADD Connect isolates a full-suite customer and rejects a standalone customer without a SmartRegnskab key", async () => {
  const fullSuite = await storage.createCompany({ name: "Fiktiv fuld-suite kunde", createdAt: new Date().toISOString() } as any);
  const other = await storage.createCompany({ name: "Anden regnskabskunde", createdAt: new Date().toISOString() } as any);
  const token = `sk_${"a".repeat(48)}`;
  db.insert(apiKeys).values({
    companyId: fullSuite.id,
    name: "Fiktiv Pro-forbindelse",
    keyPrefix: token.slice(0, 10),
    keyHash: createHash("sha256").update(token).digest("hex"),
    scopes: JSON.stringify(["add_connect:write"]),
    status: "aktiv",
    createdAt: new Date().toISOString(),
  }).run();

  const app = express();
  app.use(express.json());
  registerPublicAddConnectRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/add-connect/sync`;
    const batch = {
      sourceProduct: "smartdrift_pro",
      idempotencyKey: "full-suite-case-1",
      events: [
        { type: "customer.upsert", data: { sourceId: "customer-1", name: "Fiktiv slutkunde" } },
        { type: "invoice.upsert", data: { sourceId: "case-1", invoiceNumber: "DRAFT-1", customerSourceId: "customer-1", status: "sendt", netAmount: 100, vatAmount: 25, totalAmount: 125 } },
      ],
    };
    const send = (authorization?: string) => fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(batch),
    });

    // A standalone Pro/Clean customer has no SmartRegnskab connection or key.
    assert.equal((await send()).status, 401);
    assert.equal(db.select().from(customers).where(eq(customers.companyId, fullSuite.id)).all().length, 0);

    const accepted = await send(`Bearer ${token}`);
    assert.equal(accepted.status, 207);
    assert.equal((await accepted.json() as any).success, 1);
    assert.equal((await send(`Bearer ${token}`)).status, 207);
    assert.equal(db.select().from(customers).where(eq(customers.companyId, fullSuite.id)).all().length, 1);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, fullSuite.id)).all().length, 0);
    const revision = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...batch, idempotencyKey: "full-suite-case-1-revision", events: [
        { type: "invoice.upsert", data: { sourceId: "case-1", invoiceNumber: "CHANGED-1", customerSourceId: "customer-1", netAmount: 999, vatAmount: 0, totalAmount: 999 } },
      ] }),
    });
    assert.equal(revision.status, 207);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, fullSuite.id)).all().length, 0);
    assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, fullSuite.id)).all().length, 0);
    assert.equal(db.select().from(customers).where(eq(customers.companyId, other.id)).all().length, 0);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, other.id)).all().length, 0);
    assert.equal(db.select().from(platformSyncMappings).where(and(
      eq(platformSyncMappings.companyId, other.id),
      eq(platformSyncMappings.sourceId, "case-1"),
    )).all().length, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("an already issued Pro invoice is booked once without being sent again", async () => {
  const company = await storage.createCompany({ name: "Fiktiv regnskabskunde", createdAt: new Date().toISOString() } as any);
  const token = `sk_${"b".repeat(48)}`;
  db.insert(apiKeys).values({ companyId: company.id, name: "Pro test", keyPrefix: token.slice(0, 10),
    keyHash: createHash("sha256").update(token).digest("hex"), scopes: JSON.stringify(["add_connect:write"]),
    status: "aktiv", createdAt: new Date().toISOString() }).run();
  for (const row of [
    { accountNumber: "1200", name: "Debitorer", type: "aktiv" },
    { accountNumber: "3000", name: "Salg", type: "indtaegt" },
    { accountNumber: "2310", name: "Salgsmoms", type: "passiv" },
  ]) db.insert(accounts).values({ companyId: company.id, ...row, active: 1, createdAt: new Date().toISOString() }).run();
  const app = express();
  app.use(express.json());
  registerPublicAddConnectRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/add-connect/sync`;
    const issued = { sourceId: "pro-invoice-1", invoiceNumber: "PRO-2026-1", customerSourceId: "pro-customer-1",
      issueDate: "2026-09-27", sentAt: "2026-09-27T10:00:00.000Z", deliveryChannel: "email",
      deliveryReference: "message-test-1", documentHash, documentBase64,
      netAmount: 100, vatAmount: 25, totalAmount: 125,
      ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "2310" },
      lines: [{ description: "Fiktiv service", quantity: 1, unitPrice: 100, amount: 100, vatRate: 25 }] };
    const send = (idempotencyKey: string, events: any[]) => fetch(endpoint, { method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ sourceProduct: "smartdrift_pro", idempotencyKey, events }) });
    const first = await send("issued-1", [
      { type: "customer.upsert", data: { sourceId: "pro-customer-1", name: "Fiktiv modtager" } },
      { type: "invoice.issued", data: issued },
    ]);
    assert.equal(first.status, 200);
    assert.equal((await first.json() as any).success, 2);
    const invoice = db.select().from(invoices).where(eq(invoices.companyId, company.id)).get();
    assert.ok(invoice);
    assert.equal(invoice.status, "sendt");
    assert.equal(invoice.invoiceNumber, "PRO-2026-1");
    assert.equal(db.select().from(addConnectInvoiceDocuments).where(eq(addConnectInvoiceDocuments.invoiceId, invoice.id)).all().length, 1);
    const entry = db.select().from(journalEntries).where(eq(journalEntries.companyId, company.id)).get();
    assert.ok(entry);
    assert.equal(entry.status, "bogført");
    assert.equal(entry.sourceId, invoice.id);
    const lines = db.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id)).all();
    assert.equal(lines.reduce((sum, line) => sum + line.debit, 0), 125);
    assert.equal(lines.reduce((sum, line) => sum + line.credit, 0), 125);
    assert.equal((await send("issued-1", [{ type: "invoice.issued", data: issued }])).status, 200);
    assert.equal((await send("issued-2", [{ type: "invoice.issued", data: { ...issued, totalAmount: 999 } }])).status, 207);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, company.id)).all().length, 1);
    assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, company.id)).all().length, 1);
    const invalid = await send("issued-3", [{ type: "invoice.issued", data: {
      ...issued, sourceId: "pro-invoice-2", invoiceNumber: "PRO-2026-2",
      ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "MISSING" },
    } }]);
    assert.equal(invalid.status, 207);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, company.id)).all().length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("an approved external program may hand over a draft or an issued invoice, never both", async () => {
  const company = await storage.createCompany({ name: "Fiktiv ekstern kunde", createdAt: new Date().toISOString() } as any);
  const sourceProduct = "external_other_invoice_app";
  const token = `sk_${"c".repeat(48)}`;
  db.insert(apiKeys).values({ companyId: company.id, name: "Ekstern test", keyPrefix: token.slice(0, 10),
    keyHash: createHash("sha256").update(token).digest("hex"),
    scopes: JSON.stringify(["add_connect:read", "add_connect:write", `add_connect:source:${sourceProduct}`]),
    status: "aktiv", createdAt: new Date().toISOString() }).run();
  const app = express();
  app.use(express.json());
  registerPublicAddConnectRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/add-connect/sync`;
    const send = (source: string, idempotencyKey: string, events: any[]) => fetch(endpoint, { method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ sourceProduct: source, idempotencyKey, events }) });
    const draft = { sourceId: "other-1", customerSourceId: "other-customer-1", issueDate: "2026-09-27",
      currency: "DKK", lines: [{ description: "Fiktiv ydelse", quantity: 2, unitPrice: 50, amount: 100, vatRate: 25 }] };
    assert.equal((await send("external_wrong_app", "wrong-source", [{ type: "invoice.draft", data: draft }])).status, 403);
    assert.equal((await send("smartdrift_pro", "wrong-built-in-source", [{ type: "invoice.draft", data: draft }])).status, 403);
    const created = await send(sourceProduct, "draft-1", [
      { type: "customer.upsert", data: { sourceId: "other-customer-1", name: "Fiktiv modtager" } },
      { type: "invoice.draft", data: draft },
    ]);
    assert.equal(created.status, 200);
    assert.equal((await created.json() as any).success, 2);
    const local = db.select().from(invoices).where(eq(invoices.companyId, company.id)).get();
    assert.ok(local);
    assert.equal(local.status, "kladde");
    assert.match(local.invoiceNumber, /^F-2026-\d+$/);
    assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, company.id)).all().length, 0);
    const recordUrl = `http://127.0.0.1:${address.port}/api/add-connect/records`;
    const record = await fetch(`${recordUrl}?sourceProduct=${sourceProduct}&sourceId=other-1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(record.status, 200);
    const recordBody = await record.json() as any;
    assert.deepEqual({ flow: recordBody.flow, invoiceNumber: recordBody.invoiceNumber,
      status: recordBody.status, booked: recordBody.booked },
    { flow: "draft", invoiceNumber: local.invoiceNumber, status: "kladde", booked: false });
    assert.equal((await fetch(`${recordUrl}?sourceProduct=smartdrift_pro&sourceId=other-1`, {
      headers: { authorization: `Bearer ${token}` },
    })).status, 403);
    assert.equal((await send(sourceProduct, "draft-1", [{ type: "invoice.draft", data: draft }])).status, 200);
    const issuedSameSource = await send(sourceProduct, "issued-same-source", [{ type: "invoice.issued", data: {
      ...draft, invoiceNumber: "OTHER-1", sentAt: "2026-09-27T10:00:00Z", deliveryChannel: "email",
      deliveryReference: "provider-1", documentHash, documentBase64, netAmount: 100,
      vatAmount: 25, totalAmount: 125, ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "2310" },
    } }]);
    assert.equal(issuedSameSource.status, 207);
    assert.match((await issuedSameSource.json() as any).errors[0].error, /allerede overdraget som kladde/);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, company.id)).all().length, 1);
    for (const row of [
      { accountNumber: "1200", name: "Debitorer", type: "aktiv" },
      { accountNumber: "3000", name: "Salg", type: "indtaegt" },
      { accountNumber: "2310", name: "Salgsmoms", type: "passiv" },
    ]) db.insert(accounts).values({ companyId: company.id, ...row, active: 1, createdAt: new Date().toISOString() }).run();
    const tampered = await send(sourceProduct, "issued-tampered", [{ type: "invoice.issued", data: {
      ...draft, sourceId: "other-2", invoiceNumber: "OTHER-2", sentAt: "2026-09-27T10:00:00Z",
      deliveryChannel: "email", deliveryReference: "provider-2", documentHash: "0".repeat(64), documentBase64,
      netAmount: 100, vatAmount: 25, totalAmount: 125,
      ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "2310" },
    } }]);
    assert.equal(tampered.status, 207);
    assert.match((await tampered.json() as any).errors[0].error, /matcher ikke dokumentets SHA-256/);
    assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, company.id)).all().length, 0);
    const anotherIssued = await send(sourceProduct, "issued-other-2", [{ type: "invoice.issued", data: {
      ...draft, sourceId: "other-2", invoiceNumber: "OTHER-2", sentAt: "2026-09-27T10:00:00Z",
      deliveryChannel: "email", deliveryReference: "provider-2", documentHash, documentBase64,
      netAmount: 100, vatAmount: 25, totalAmount: 125,
      ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "2310" },
    } }]);
    assert.equal(anotherIssued.status, 200);
    assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, company.id)).all().length, 1);
    assert.equal(db.select().from(invoices).where(eq(invoices.companyId, company.id)).all().length, 2);
    const issuedRecord = await fetch(`${recordUrl}?sourceProduct=${sourceProduct}&sourceId=other-2`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(issuedRecord.status, 200);
    const issuedBody = await issuedRecord.json() as any;
    assert.equal(issuedBody.flow, "issued");
    assert.equal(issuedBody.booked, true);
    assert.equal(issuedBody.documentArchived, true);
    const original = await fetch(`http://127.0.0.1:${address.port}/api/add-connect/documents?sourceProduct=${sourceProduct}&sourceId=other-2`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(original.status, 200);
    assert.deepEqual(Buffer.from(await original.arrayBuffer()), pdf);
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/add-connect/documents?sourceProduct=smartdrift_pro&sourceId=other-2`, {
      headers: { authorization: `Bearer ${token}` },
    })).status, 403);
    const ediXml = '<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"><cbc:ID>OTHER-3</cbc:ID><cbc:IssueDate>2026-09-27</cbc:IssueDate><cbc:EndpointID>DK12345678</cbc:EndpointID><cac:InvoiceLine><cbc:ID>1</cbc:ID></cac:InvoiceLine><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="DKK">125.00</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>';
    const ediBytes = Buffer.from(ediXml);
    const edi = await send(sourceProduct, "issued-edi-3", [{ type: "invoice.issued", data: {
      ...draft, sourceId: "other-3", invoiceNumber: "OTHER-3", sentAt: "2026-09-27T10:00:00Z",
      deliveryChannel: "edi", deliveryReference: "sproom-doc-3", documentMimeType: "application/xml",
      documentHash: createHash("sha256").update(ediBytes).digest("hex"), documentBase64: ediBytes.toString("base64"),
      netAmount: 100, vatAmount: 25, totalAmount: 125,
      ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "2310" },
    } }]);
    assert.equal(edi.status, 200);
    const ediOriginal = await fetch(`http://127.0.0.1:${address.port}/api/add-connect/documents?sourceProduct=${sourceProduct}&sourceId=other-3`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(ediOriginal.headers.get("content-type"), "application/xml");
    assert.deepEqual(Buffer.from(await ediOriginal.arrayBuffer()), ediBytes);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
