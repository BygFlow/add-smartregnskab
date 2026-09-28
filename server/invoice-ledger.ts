import { and, eq } from "drizzle-orm";
import { accounts, companies, invoices, invoiceItems, journalEntries, journalLines, periodCloses } from "@shared/schema";
import { db } from "./storage";

export type SalesLedgerAccounts = { receivables: string; revenue: string; outputVat?: string };

/** Validate before external delivery; never guess a company's bookkeeping accounts. */
export function validateSalesInvoiceBooking(companyId: number, invoiceId: number, mapping: SalesLedgerAccounts) {
  const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
  const invoice = db.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId))).get();
  if (!company || !invoice) throw new Error("Fakturaen findes ikke i virksomheden.");
  if (company.currency !== "DKK") throw new Error("Bogføring af fakturaer i anden valuta end DKK kræver en særskilt kursberegning.");
  if (invoice.status !== "kladde" && invoice.status !== "sendt") throw new Error("Fakturaen er ikke klar til bogføring.");
  const existing = db.select().from(journalEntries).where(and(
    eq(journalEntries.companyId, companyId), eq(journalEntries.sourceType, "faktura"), eq(journalEntries.sourceId, invoiceId),
  )).get();
  if (existing) throw new Error("Fakturaen er allerede bogført.");
  if (db.select().from(periodCloses).where(eq(periodCloses.companyId, companyId)).all()
    .some((period) => period.status === "afsluttet" && period.startDate <= invoice.issueDate && invoice.issueDate <= period.endDate)) {
    throw new Error("Fakturaens regnskabsperiode er afsluttet.");
  }
  const cents = (value: number) => Math.round(value * 100);
  if (![invoice.netAmount, invoice.vatAmount, invoice.totalAmount].every((value) => Number.isFinite(value) && value >= 0)
    || invoice.totalAmount <= 0 || cents(invoice.netAmount) + cents(invoice.vatAmount) !== cents(invoice.totalAmount)) {
    throw new Error("Fakturabeløbene stemmer ikke.");
  }
  const lines = db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).all();
  if (!lines.length || lines.reduce((sum, line) => sum + cents(line.amount), 0) !== cents(invoice.netAmount)
    || lines.reduce((sum, line) => sum + cents(line.amount * line.vatRate / 100), 0) !== cents(invoice.vatAmount)) {
    throw new Error("Fakturalinjer og moms stemmer ikke med totalerne.");
  }
  const chart = db.select().from(accounts).where(eq(accounts.companyId, companyId)).all();
  const find = (accountNumber: string | undefined, type: string) => chart.find((row) => row.active
    && row.accountNumber === String(accountNumber || "").trim() && row.type === type);
  const receivable = find(mapping?.receivables, "aktiv");
  const revenue = find(mapping?.revenue, "indtaegt");
  const outputVat = invoice.vatAmount > 0 ? find(mapping?.outputVat, "passiv") : null;
  if (!receivable || !revenue || (invoice.vatAmount > 0 && !outputVat)) {
    throw new Error("Vælg aktive debitor-, omsætnings- og eventuelt salgsmomskonti for virksomheden.");
  }
  return { invoice, receivable, revenue, outputVat };
}

/** Post only after the mail/EDI provider has confirmed delivery. */
export function bookLocalIssuedInvoice(companyId: number, invoiceId: number, mapping: SalesLedgerAccounts) {
  return db.transaction((tx) => {
    const { invoice, receivable, revenue, outputVat } = validateSalesInvoiceBooking(companyId, invoiceId, mapping);
    if (invoice.status !== "sendt" || !invoice.sentAt) throw new Error("Kun en faktisk sendt faktura kan bogføres.");
    const entry = tx.insert(journalEntries).values({
      companyId, entryNumber: `FAKTURA-${invoice.id}`, date: invoice.issueDate,
      description: `Udstedt faktura ${invoice.invoiceNumber}`, reference: invoice.invoiceNumber,
      sourceType: "faktura", sourceId: invoice.id, status: "bogført",
      createdBy: "smartregnskab", createdAt: new Date().toISOString(),
    }).returning().get();
    tx.insert(journalLines).values([
      { companyId, journalEntryId: entry.id, accountId: receivable.id, debit: invoice.totalAmount, credit: 0 },
      { companyId, journalEntryId: entry.id, accountId: revenue.id, debit: 0, credit: invoice.netAmount },
      ...(invoice.vatAmount > 0 ? [{ companyId, journalEntryId: entry.id, accountId: outputVat!.id, debit: 0, credit: invoice.vatAmount }] : []),
    ]).run();
    return entry;
  });
}
