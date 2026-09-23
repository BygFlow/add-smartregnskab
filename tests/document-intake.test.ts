import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
const { validExtraction, verifiedWebhook, bookDocument } = await import("../server/document-intake");
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
