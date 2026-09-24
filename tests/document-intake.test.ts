import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import express from "express";

process.env.DATABASE_PATH = ":memory:";
const testUploadDir = mkdtempSync(join(tmpdir(), "add-smartregnskab-test-inbox-"));
process.env.FILE_STORAGE_DIR = testUploadDir;
after(() => {
  assert.equal(dirname(resolve(testUploadDir)), resolve(tmpdir()));
  assert.match(basename(testUploadDir), /^add-smartregnskab-test-inbox-/);
  rmSync(testUploadDir, { recursive: true, force: true });
  delete process.env.FILE_STORAGE_DIR;
});
const { validExtraction, verifiedWebhook, bookDocument, registerPublicDocumentIntakeRoutes, emailAddress, provisionEmailAddress } = await import("../server/document-intake");
const { storage, db } = await import("../server/storage");
const { accounts, documentInbox, journalEntries, journalLines, vouchers } = await import("../shared/schema");
const { eq } = await import("drizzle-orm");

test("each newly created customer company receives a distinct permanent inbox token", async () => {
  const first = await storage.createCompany({ name: "Kunde A", createdAt: new Date().toISOString() } as any);
  const second = await storage.createCompany({ name: "Kunde B", createdAt: new Date().toISOString() } as any);
  assert.match(first.documentInboxToken || "", /^[a-f0-9]{32}$/);
  assert.match(second.documentInboxToken || "", /^[a-f0-9]{32}$/);
  assert.notEqual(first.documentInboxToken, second.documentInboxToken);
  assert.equal(first.documentAutoPost, 0);
});

test("pilot email address is visible only to its designated test company", async () => {
  const first = await storage.createCompany({ name: "Pilot A", createdAt: new Date().toISOString() } as any);
  const second = await storage.createCompany({ name: "Pilot B", createdAt: new Date().toISOString() } as any);
  process.env.DOCUMENT_INBOUND_DOMAIN = "addsmartregnskab.dk";
  process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET = "test-document-secret";
  process.env.DOCUMENT_INBOUND_READY = "false";
  process.env.DOCUMENT_INBOUND_TEST_COMPANY_ID = String(first.id);
  try {
    assert.equal(emailAddress(first.id), `bilag-${first.documentInboxToken}@addsmartregnskab.dk`);
    assert.equal(emailAddress(second.id), null);
    process.env.DOCUMENT_INBOUND_TEST_COMPANY_ID = "invalid";
    assert.equal(emailAddress(first.id), null);
  } finally {
    delete process.env.DOCUMENT_INBOUND_DOMAIN;
    delete process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET;
    delete process.env.DOCUMENT_INBOUND_READY;
    delete process.env.DOCUMENT_INBOUND_TEST_COMPANY_ID;
  }
});

test("live addresses provision separate Simply forwards before being exposed", async () => {
  const first = await storage.createCompany({ name: "Forward A", createdAt: new Date().toISOString() } as any);
  const second = await storage.createCompany({ name: "Forward B", createdAt: new Date().toISOString() } as any);
  process.env.DOCUMENT_INBOUND_DOMAIN = "addsmartregnskab.dk";
  process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET = "test-document-secret";
  process.env.DOCUMENT_INBOUND_READY = "true";
  process.env.SIMPLY_PRODUCT_HANDLE = "addsmartregnskab.dk";
  process.env.SIMPLY_API_KEY = "test-only-key";
  const forwards: Array<{ address: string; destination: string }> = [];
  const provider = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "POST") {
      const input = JSON.parse(String(init.body));
      forwards.push({ address: `${input.localpart}@addsmartregnskab.dk`, destination: input.destination });
      return Response.json({ status: 200, message: "success" });
    }
    return Response.json({ status: 200, forwards });
  };
  try {
    const addressA = await provisionEmailAddress(first.id, provider as typeof fetch);
    const addressB = await provisionEmailAddress(second.id, provider as typeof fetch);
    assert.ok(addressA && addressB);
    assert.notEqual(addressA, addressB);
    assert.deepEqual(forwards.map((entry) => entry.address), [addressA, addressB]);
    assert.ok(forwards.every((entry) => entry.destination === "bilag-system@addsmartregnskab.dk"));
    assert.equal(await provisionEmailAddress(first.id, provider as typeof fetch), addressA);
    assert.equal(forwards.length, 2, "a second visit must not create a second forward");
    delete process.env.SIMPLY_API_KEY;
    assert.equal(emailAddress(first.id), null, "no address may be shown without provider credentials");
  } finally {
    delete process.env.DOCUMENT_INBOUND_DOMAIN;
    delete process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET;
    delete process.env.DOCUMENT_INBOUND_READY;
    delete process.env.SIMPLY_PRODUCT_HANDLE;
    delete process.env.SIMPLY_API_KEY;
  }
});

test("a new pilot company gets its own forward while general mail intake stays closed", async () => {
  const pilot = await storage.createCompany({ name: "Forward pilot", createdAt: new Date().toISOString() } as any);
  process.env.DOCUMENT_INBOUND_DOMAIN = "addsmartregnskab.dk";
  process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET = "test-document-secret";
  process.env.DOCUMENT_INBOUND_READY = "false";
  process.env.DOCUMENT_INBOUND_TEST_COMPANY_ID = String(pilot.id);
  process.env.SIMPLY_PRODUCT_HANDLE = "addsmartregnskab.dk";
  process.env.SIMPLY_API_KEY = "test-only-key";
  let createdLocalpart = "";
  const provider = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "POST") {
      createdLocalpart = JSON.parse(String(init.body)).localpart;
      return Response.json({ status: 200, message: "success" });
    }
    return Response.json({ status: 200, forwards: [] });
  };
  try {
    const address = await provisionEmailAddress(pilot.id, provider as typeof fetch);
    assert.equal(address, `${createdLocalpart}@addsmartregnskab.dk`);
    assert.equal(address, `bilag-${pilot.documentInboxToken}@addsmartregnskab.dk`);
  } finally {
    delete process.env.DOCUMENT_INBOUND_DOMAIN;
    delete process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET;
    delete process.env.DOCUMENT_INBOUND_READY;
    delete process.env.DOCUMENT_INBOUND_TEST_COMPANY_ID;
    delete process.env.SIMPLY_PRODUCT_HANDLE;
    delete process.env.SIMPLY_API_KEY;
  }
});

test("document extraction requires valid invoice amounts and date", () => {
  const valid = { supplier: "Leverandør ApS", supplierCvr: "87654321", invoiceDate: "2026-09-23", invoiceNumber: "F-1",
    recipientCvr: "12345678", totalAmount: 125, vatAmount: 25, expenseAccountNumber: "4000",
    confidence: 0.99, documentType: "invoice", currency: "DKK", reverseCharge: false, creditNote: false };
  assert.equal(validExtraction(valid), true);
  assert.equal(validExtraction({ ...valid, vatAmount: 126 }), false);
  assert.equal(validExtraction({ ...valid, invoiceDate: "ukendt" }), false);
  assert.equal(validExtraction({ ...valid, invoiceDate: "2026-02-31" }), false);
  assert.equal(validExtraction({ ...valid, totalAmount: 0 }), false);
});

test("inbound document webhook requires a fresh signature over raw bytes", () => {
  process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET = "test-document-secret";
  const body = Buffer.from('{"recipient":"bilag-test@example.dk"}');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET)
    .update(`${timestamp}.`).update(body).digest("hex");
  const req = { rawBody: body, body: JSON.parse(body.toString("utf8")),
    header: (name: string) => ({ "x-document-timestamp": timestamp, "x-document-signature": signature } as Record<string, string>)[name],
  } as any;
  assert.equal(verifiedWebhook(req), true);
  assert.equal(verifiedWebhook({ ...req, rawBody: Buffer.from(body.toString().replace("test", "evil")) }), false);
  assert.equal(verifiedWebhook({ ...req, header: (name: string) => name === "x-document-timestamp" ? "1" : signature }), false);
  delete process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET;
});

test("email webhook isolates customer inboxes, rejects unknown recipients, and deduplicates retries", async () => {
  process.env.DOCUMENT_INBOUND_DOMAIN = "addsmartregnskab.dk";
  process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET = "test-document-secret";
  const first = await storage.createCompany({ name: "Isoleret bilagstest A", createdAt: new Date().toISOString() } as any);
  const second = await storage.createCompany({ name: "Isoleret bilagstest B", createdAt: new Date().toISOString() } as any);
  const app = express();
  app.use(express.json({ limit: "11mb", verify: (req, _res, body) => { (req as any).rawBody = body; } }));
  registerPublicDocumentIntakeRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/document-receiving/inbound`;
    const recipient = `bilag-${first.documentInboxToken}@addsmartregnskab.dk`;
    const payload = {
      recipient, sender: "supplier@example.com", messageId: "isolated-mail-test-1",
      fileName: "test-only.pdf", dataUrl: `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n%%EOF").toString("base64")}`,
    };
    const send = async (body: typeof payload) => {
      const raw = Buffer.from(JSON.stringify(body));
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET!)
        .update(`${timestamp}.`).update(raw).digest("hex");
      return fetch(endpoint, { method: "POST", body: raw,
        headers: { "content-type": "application/json", "x-document-timestamp": timestamp,
          "x-document-signature": signature } });
    };
    const accepted = await send(payload);
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json() as any).duplicate, false);
    const retry = await send(payload);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json() as any).duplicate, true);
    assert.equal(db.select().from(documentInbox).where(eq(documentInbox.companyId, first.id)).all().length, 1);
    assert.equal(db.select().from(documentInbox).where(eq(documentInbox.companyId, second.id)).all().length, 0);
    assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, first.id)).all().length, 0);
    const unknown = await send({ ...payload, recipient: `bilag-${"f".repeat(32)}@addsmartregnskab.dk`, messageId: "isolated-mail-test-2" });
    assert.equal(unknown.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete process.env.DOCUMENT_INBOUND_DOMAIN;
    delete process.env.DOCUMENT_INBOUND_WEBHOOK_SECRET;
  }
});

test("approved document creates one balanced journal entry, linked voucher, and cannot post twice", async () => {
  const company = await storage.createCompany({ name: "Bilagstest", createdAt: new Date().toISOString() } as any);
  const createdAt = new Date().toISOString();
  const expense = db.insert(accounts).values({ companyId: company.id, accountNumber: "4000", name: "Kontor", type: "udgift", createdAt }).returning().get();
  const vat = db.insert(accounts).values({ companyId: company.id, accountNumber: "6900", name: "Købsmoms", type: "aktiv", createdAt }).returning().get();
  const payable = db.insert(accounts).values({ companyId: company.id, accountNumber: "7800", name: "Kreditorer", type: "passiv", createdAt }).returning().get();
  const document = db.insert(documentInbox).values({ companyId: company.id, fileName: "faktura.pdf", storage: "disk",
    storageKey: "test-only", source: "upload", status: "ny", contentHash: "test-hash", createdAt }).returning().get();
  const extraction = { supplier: "Leverandør ApS", supplierCvr: "87654321", invoiceDate: "2026-09-23", invoiceNumber: "F-1",
    recipientCvr: "12345678", totalAmount: 125, vatAmount: 25, expenseAccountNumber: "4000",
    confidence: 0.99, documentType: "invoice", currency: "DKK", reverseCharge: false, creditNote: false };
  const posted = bookDocument({ companyId: company.id, documentId: document.id, extraction,
    expenseAccountId: expense.id, payableAccountId: payable.id, inputVatAccountId: vat.id,
    actor: "test@example.dk", model: "test" });
  const lines = db.select().from(journalLines).where(eq(journalLines.journalEntryId, posted.id)).all();
  assert.equal(lines.length, 3);
  assert.equal(lines.reduce((sum, line) => sum + line.debit, 0), 125);
  assert.equal(lines.reduce((sum, line) => sum + line.credit, 0), 125);
  assert.equal(db.select().from(journalEntries).where(eq(journalEntries.id, posted.id)).get()?.status, "bogført");
  const updated = db.select().from(documentInbox).where(eq(documentInbox.id, document.id)).get();
  assert.equal(updated?.postedJournalEntryId, posted.id);
  assert.equal(db.select().from(vouchers).where(eq(vouchers.id, updated!.matchedVoucherId!)).get()?.status, "bogfoert");
  assert.throws(() => bookDocument({ companyId: company.id, documentId: document.id, extraction,
    expenseAccountId: expense.id, payableAccountId: payable.id, inputVatAccountId: vat.id,
    actor: "test@example.dk", model: "test" }), /allerede behandlet/);
});
