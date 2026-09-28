import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";

process.env.DATABASE_PATH = ":memory:";
const { db, storage } = await import("../server/storage");
const { bookLocalIssuedInvoice, validateSalesInvoiceBooking } = await import("../server/invoice-ledger");
const { accounts, customers, invoices, invoiceItems, journalEntries, journalLines, periodCloses } = await import("../shared/schema");

test("standalone SmartRegnskab invoices post only after delivery, once and in the right company", async () => {
  const company = await storage.createCompany({ name: "Fiktivt enkeltprodukt", createdAt: new Date().toISOString() } as any);
  const another = await storage.createCompany({ name: "Anden fiktiv virksomhed", createdAt: new Date().toISOString() } as any);
  const now = new Date().toISOString();
  const customer = db.insert(customers).values({ companyId: company.id, name: "Fiktiv kunde" }).returning().get();
  for (const row of [
    { accountNumber: "1200", name: "Debitorer", type: "aktiv" },
    { accountNumber: "3000", name: "Omsætning", type: "indtaegt" },
    { accountNumber: "2310", name: "Salgsmoms", type: "passiv" },
  ]) db.insert(accounts).values({ companyId: company.id, ...row, active: 1, createdAt: now }).run();
  const invoice = db.insert(invoices).values({ companyId: company.id, customerId: customer.id,
    invoiceNumber: "F-2026-0001", status: "kladde", issueDate: "2026-09-27", netAmount: 100,
    vatAmount: 25, vatRate: 25, totalAmount: 125, paymentTerms: 14 }).returning().get();
  db.insert(invoiceItems).values({ invoiceId: invoice.id, description: "Fiktiv ydelse", quantity: 1,
    unitPrice: 100, amount: 100, vatRate: 25 }).run();
  const mapping = { receivables: "1200", revenue: "3000", outputVat: "2310" };
  assert.throws(() => bookLocalIssuedInvoice(company.id, invoice.id, mapping), /faktisk sendt/);
  assert.throws(() => validateSalesInvoiceBooking(another.id, invoice.id, mapping), /findes ikke/);
  assert.throws(() => validateSalesInvoiceBooking(company.id, invoice.id, { ...mapping, outputVat: "9999" }), /Vælg aktive/);
  db.update(invoices).set({ status: "sendt", sentAt: now }).where(eq(invoices.id, invoice.id)).run();
  const entry = bookLocalIssuedInvoice(company.id, invoice.id, mapping);
  assert.equal(entry.status, "bogført");
  const lines = db.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id)).all();
  assert.equal(lines.reduce((sum, row) => sum + row.debit, 0), 125);
  assert.equal(lines.reduce((sum, row) => sum + row.credit, 0), 125);
  assert.throws(() => bookLocalIssuedInvoice(company.id, invoice.id, mapping), /allerede bogført/);
  assert.equal(db.select().from(journalEntries).where(eq(journalEntries.companyId, company.id)).all().length, 1);

  const second = db.insert(invoices).values({ companyId: company.id, customerId: customer.id,
    invoiceNumber: "F-2026-0002", status: "sendt", issueDate: "2026-09-27", sentAt: now,
    netAmount: 100, vatAmount: 25, vatRate: 25, totalAmount: 125, paymentTerms: 14 }).returning().get();
  db.insert(invoiceItems).values({ invoiceId: second.id, description: "Fiktiv ydelse", quantity: 1,
    unitPrice: 100, amount: 100, vatRate: 25 }).run();
  db.insert(periodCloses).values({ companyId: company.id, periodType: "maaned", periodLabel: "September 2026",
    startDate: "2026-09-01", endDate: "2026-09-30", status: "afsluttet", createdAt: now }).run();
  assert.throws(() => bookLocalIssuedInvoice(company.id, second.id, mapping), /afsluttet/);
});
