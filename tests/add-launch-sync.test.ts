import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomInt } from "node:crypto";
import express from "express";
import { eq, and } from "drizzle-orm";
import { accounts, apiKeys, companies, customers, invoices, journalEntries } from "@shared/schema";
import { db } from "../server/storage";
import { registerPublicAddConnectRoutes, syncLaunchBatch } from "../server/add-connect";

const companyId = 80_000_000 + randomInt(1_000_000);
function seed(id: number) {
  db.insert(companies).values({ id, name: "Launch integration fixture", cvr: "12345678" }).run();
  db.insert(accounts).values([
    { companyId: id, accountNumber: "1200", name: "Debitorer", type: "aktiv", active: 1, createdAt: new Date().toISOString() },
    { companyId: id, accountNumber: "2310", name: "Salgsmoms", type: "passiv", active: 1, createdAt: new Date().toISOString() },
    { companyId: id, accountNumber: "1000", name: "Omsætning", type: "indtaegt", active: 1, createdAt: new Date().toISOString() },
  ]).run();
}
function invoice() { return { sourceId: "launch-invoice-one", customerSourceId: "launch-customer-one", invoiceNumber: "LAUNCH-TEST-1", issueDate: "2026-11-20", dueDate: "2026-12-04", status: "sendt", netAmount: 100, vatAmount: 25, totalAmount: 125, lines: [{ description: "Kontrolleret test", quantity: 1, unitPrice: 100, vatRate: 25 }] }; }
test("Launch sync rolls back partial work, retries once and isolates company mappings", () => {
  seed(companyId); seed(companyId + 1);
  const events = [{ type: "customer.upsert", data: { sourceId: "launch-customer-one", name: "Testkunde" } }, { type: "invoice.upsert", data: invoice() }];
  assert.throws(() => syncLaunchBatch(companyId, "retry-key", [...events, { type: "unsupported", data: {} }]));
  assert.equal(db.select().from(customers).where(eq(customers.companyId, companyId)).all().length, 0);
  assert.equal(db.select().from(invoices).where(eq(invoices.companyId, companyId)).all().length, 0);
  const result = syncLaunchBatch(companyId, "retry-key", events);
  assert.equal(result.success, 2); assert.equal(syncLaunchBatch(companyId, "retry-key", events).duplicate, true);
  assert.throws(() => syncLaunchBatch(companyId, "retry-key", [events[0]]), /andre data/);
  assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId)).all().length, 1);
  syncLaunchBatch(companyId + 1, "retry-key", events);
  assert.equal(db.select().from(invoices).where(eq(invoices.companyId, companyId + 1)).all().length, 1);
  assert.throws(() => syncLaunchBatch(companyId, "invalid-payment", [{ type: "payment.updated", data: { invoiceSourceId: "launch-invoice-one", paidAmount: 126 } }]), /ugyldigt/);
  syncLaunchBatch(companyId, "payment", [{ type: "payment.updated", data: { invoiceSourceId: "launch-invoice-one", paidAmount: 125 } }]);
  assert.equal(db.select().from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.invoiceNumber, "LAUNCH-TEST-1"))).get()?.status, "betalt");
  assert.equal(db.select().from(invoices).where(and(eq(invoices.companyId, companyId + 1), eq(invoices.invoiceNumber, "LAUNCH-TEST-1"))).get()?.status, "sendt");
});

test("Launch HTTP sync requires authentication and write scope", async () => {
  const token = "sk_test_only_launch_read_scope_" + randomInt(1_000_000);
  db.insert(apiKeys).values({ companyId, name: "fixture", keyHash: createHash("sha256").update(token).digest("hex"), scopes: '["read"]', status: "aktiv", createdAt: new Date().toISOString() }).run();
  const app = express(); app.use(express.json()); registerPublicAddConnectRoutes(app);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  try {
    const url = `http://127.0.0.1:${port}/api/add-connect/sync`;
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    assert.equal((await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sourceProduct: "add_launch", idempotencyKey: "scope", events: [{ type: "customer.upsert", data: { sourceId: "unauthorized", name: "Not created" } }] }) })).status, 403);
    assert.equal(db.select().from(customers).where(and(eq(customers.companyId, companyId), eq(customers.name, "Not created"))).all().length, 0);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
