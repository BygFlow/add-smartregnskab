import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { accounts, companies, invoices, journalEntries, journalLines } from "@shared/schema";
import { db } from "../server/storage";
import { upsertAddConnectInvoice } from "../server/add-connect";

const companyId = 70_000_000 + randomInt(1_000_000);

function payload(status: string, netAmount = 100) {
  const vatAmount = netAmount * 0.25;
  return {
    sourceId: "clean-invoice:CLEAN-1001",
    invoiceNumber: "CLEAN-1001",
    customerSourceId: "clean-customer:42",
    customer: { sourceId: "clean-customer:42", name: "Kontrolleret testkunde" },
    issueDate: "2026-10-27",
    dueDate: "2026-11-10",
    status,
    netAmount,
    vatAmount,
    totalAmount: netAmount + vatAmount,
    vatRate: 25,
    lines: [{ description: "Rengøringsydelse", quantity: 1, unitPrice: netAmount, amount: netAmount, vatRate: 25 }],
  };
}

test("ADD Connect bogfører først den endelige faktura og gør genforsøg idempotent", () => {
  db.insert(companies).values({ id: companyId, name: "ADD Connect test", cvr: "78421000" }).onConflictDoNothing().run();
  const existingAccounts = db.select().from(accounts).where(eq(accounts.companyId, companyId)).all();
  if (!existingAccounts.length) {
    db.insert(accounts).values([
      { companyId, accountNumber: "1200", name: "Debitorer", type: "aktiv", vatCode: null, active: 1, createdAt: "2026-10-27T00:00:00.000Z" },
      { companyId, accountNumber: "2310", name: "Salgsmoms", type: "passiv", vatCode: "S25", active: 1, createdAt: "2026-10-27T00:00:00.000Z" },
      { companyId, accountNumber: "1000", name: "Omsætning", type: "indtaegt", vatCode: "S25", active: 1, createdAt: "2026-10-27T00:00:00.000Z" },
    ]).run();
  }

  const draft = upsertAddConnectInvoice(companyId, "smartdrift_clean", payload("kladde"));
  assert.equal(draft.booked, false);
  assert.equal(draft.invoice.status, "kladde");
  assert.equal(db.select().from(journalEntries).where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.sourceId, draft.invoice.id))).all().length, 0);

  const issued = upsertAddConnectInvoice(companyId, "smartdrift_clean", payload("sendt"));
  assert.equal(issued.booked, true);
  assert.equal(issued.invoice.id, draft.invoice.id);
  assert.equal(issued.invoice.status, "sendt");
  const entries = db.select().from(journalEntries).where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.sourceId, issued.invoice.id))).all();
  assert.equal(entries.length, 1);
  const lines = db.select().from(journalLines).where(eq(journalLines.journalEntryId, entries[0].id)).all();
  assert.equal(lines.reduce((sum, line) => sum + line.debit, 0), 125);
  assert.equal(lines.reduce((sum, line) => sum + line.credit, 0), 125);

  const replay = upsertAddConnectInvoice(companyId, "smartdrift_clean", payload("sendt"));
  assert.equal(replay.journalEntryId, entries[0].id);
  assert.equal(db.select().from(journalEntries).where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.sourceId, issued.invoice.id))).all().length, 1);
  assert.equal(db.select().from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.invoiceNumber, "CLEAN-1001"))).all().length, 1);

  assert.throws(
    () => upsertAddConnectInvoice(companyId, "smartdrift_clean", payload("sendt", 110)),
    /kan ikke ændres gennem ADD Connect/,
  );
});
