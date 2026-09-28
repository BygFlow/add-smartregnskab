import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import express from "express";

const root = mkdtempSync(path.join(tmpdir(), "add-connect-restore-"));
const liveFiles = path.join(root, "live-files");
const restoredFiles = path.join(root, "restored", "files");
const restoredDatabase = path.join(root, "restored", "smartregnskab.db");
process.env.DATABASE_PATH = ":memory:";
process.env.FILE_STORAGE_DIR = liveFiles;
after(() => rmSync(root, { recursive: true, force: true }));

const { db, storage } = await import("../server/storage");
const { registerPublicAddConnectRoutes } = await import("../server/add-connect");
const { accounts, apiKeys } = await import("../shared/schema");

test("a consistent ADD Connect backup restores booked invoice and original PDF together", async () => {
  const company = await storage.createCompany({ name: "Fiktiv restore-kunde", createdAt: new Date().toISOString() } as any);
  const token = `sk_${"r".repeat(48)}`;
  db.insert(apiKeys).values({ companyId: company.id, name: "Kun lokal restore-test", keyPrefix: token.slice(0, 10),
    keyHash: createHash("sha256").update(token).digest("hex"), scopes: JSON.stringify(["add_connect:write"]),
    status: "aktiv", createdAt: new Date().toISOString() }).run();
  for (const row of [
    { accountNumber: "1200", name: "Testdebitor", type: "aktiv" },
    { accountNumber: "3000", name: "Testsalg", type: "indtaegt" },
    { accountNumber: "2310", name: "Testmoms", type: "passiv" },
  ]) db.insert(accounts).values({ companyId: company.id, ...row, active: 1, createdAt: new Date().toISOString() }).run();

  const pdf = Buffer.from("%PDF-1.4\n% FIKTIV GENDANNELSESTEST - IKKE AFSENDT\n");
  const hash = createHash("sha256").update(pdf).digest("hex");
  const app = express();
  app.use(express.json());
  registerPublicAddConnectRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/add-connect/sync`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sourceProduct: "smartdrift_pro", idempotencyKey: "local-restore-drill-1", events: [
        { type: "customer.upsert", data: { sourceId: "restore-customer-1", name: "Fiktiv modtager" } },
        { type: "invoice.issued", data: { sourceId: "restore-invoice-1", invoiceNumber: "RESTORE-TEST-1",
          customerSourceId: "restore-customer-1", issueDate: "2026-09-28", sentAt: "2026-09-28T10:00:00Z",
          deliveryChannel: "email", deliveryReference: "synthetic-not-sent", documentHash: hash,
          documentBase64: pdf.toString("base64"), netAmount: 100, vatAmount: 25, totalAmount: 125,
          ledgerAccounts: { receivables: "1200", revenue: "3000", outputVat: "2310" },
          lines: [{ description: "Fiktiv ydelse", quantity: 1, unitPrice: 100, amount: 100, vatRate: 25 }],
        } },
      ] }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as any).success, 2);

    mkdirSync(path.dirname(restoredDatabase), { recursive: true });
    await db.$client.backup(restoredDatabase);
    cpSync(liveFiles, restoredFiles, { recursive: true });

    const restored = new Database(restoredDatabase, { readonly: true, fileMustExist: true });
    try {
      assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
      const invoice = restored.prepare("SELECT id, status, total_amount FROM invoices WHERE invoice_number = ?")
        .get("RESTORE-TEST-1") as { id: number; status: string; total_amount: number } | undefined;
      assert.ok(invoice);
      assert.equal(invoice.status, "sendt");
      assert.equal(invoice.total_amount, 125);
      const booked = restored.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE source_type = 'faktura' AND source_id = ? AND status = 'bogført'")
        .get(invoice.id) as { n: number };
      assert.equal(booked.n, 1);
      const archived = restored.prepare("SELECT storage, storage_key, sha256 FROM add_connect_invoice_documents WHERE invoice_id = ?")
        .get(invoice.id) as { storage: string; storage_key: string; sha256: string } | undefined;
      assert.ok(archived);
      assert.equal(archived.storage, "disk");
      const restoredFile = path.join(restoredFiles, archived.storage_key);
      assert.deepEqual(readFileSync(restoredFile), pdf);
      assert.equal(createHash("sha256").update(readFileSync(restoredFile)).digest("hex"), archived.sha256);
      writeFileSync(restoredFile, "korrupt-testkopi");
      assert.notEqual(createHash("sha256").update(readFileSync(restoredFile)).digest("hex"), archived.sha256);
    } finally {
      restored.close();
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
