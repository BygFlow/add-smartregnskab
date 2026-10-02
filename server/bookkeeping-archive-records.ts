import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { bookkeepingArchiveInventory } from "./bookkeeping-archive-inventory";
import { readLockedArchiveObject, storeLockedArchiveObject, type ArchiveReceipt } from "./bookkeeping-archive-object";
import type { ArchiveBucketConfig } from "./bookkeeping-archive-readiness";

type Row = Record<string, string | number | null>;

function rows(snapshot: Database.Database, sql: string, ...params: Array<string | number>): Row[] {
  return snapshot.prepare(sql).all(...params) as Row[];
}

function assertReferences(kind: string, referenced: number[], available: number[]) {
  const known = new Set(available);
  const missing = Array.from(new Set(referenced)).filter((id) => !known.has(id));
  if (missing.length) throw new Error(`${kind} mangler eller tilhører en anden virksomhed: ${missing.join(", ")}.`);
}

/** Tenant-scoped record candidate. Not a complete legal archive or historical invoice rendering. */
export function buildBookkeepingRecordBundle(snapshot: Database.Database, companyId: number, referenceDate: string) {
  const inventory = bookkeepingArchiveInventory(snapshot, companyId, referenceDate);
  if (inventory.issues.length) throw new Error(`Bogføringsgrundlaget har uafklarede forhold: ${inventory.issues.join(", ")}.`);
  const { start, end } = inventory.period;
  const scoped = [companyId, start, end] as const;
  const company = snapshot.prepare("SELECT id, name, cvr, currency FROM companies WHERE id = ?")
    .get(companyId) as Row | undefined;
  if (!company) throw new Error("Virksomheden blev ikke fundet i databasekopien.");
  const profile = snapshot.prepare(`SELECT id, company_id, fiscal_year_start, currency, reporting_standard, vat_setup
    FROM business_profiles WHERE company_id = ? ORDER BY id DESC LIMIT 1`).get(companyId) as Row | undefined;
  if (!profile) throw new Error("Virksomhedens regnskabsprofil mangler.");

  const journalEntries = rows(snapshot, `SELECT id, company_id, entry_number, date, description, reference,
    source_type, source_id, status, created_by, created_at FROM journal_entries
    WHERE company_id = ? AND date BETWEEN ? AND ? AND status IN ('bogført','bogfort','afstemt') ORDER BY id`, ...scoped);
  const journalLines = rows(snapshot, `SELECT jl.id, jl.company_id, jl.journal_entry_id, jl.account_id,
    jl.description, jl.debit, jl.credit, jl.vat_code FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.company_id = jl.company_id
    WHERE je.company_id = ? AND je.date BETWEEN ? AND ? AND je.status IN ('bogført','bogfort','afstemt')
    ORDER BY jl.id`, ...scoped);
  const accountIds = journalLines.map((row) => Number(row.account_id));
  const accounts = rows(snapshot, `SELECT id, company_id, account_number, standard_account_number,
    name, type, vat_code FROM accounts WHERE company_id = ? ORDER BY id`, companyId)
    .filter((row) => accountIds.includes(Number(row.id)));
  assertReferences("Posteringens konto", accountIds, accounts.map((row) => Number(row.id)));

  const invoices = rows(snapshot, `SELECT id, company_id, customer_id, invoice_number, status, issue_date,
    due_date, net_amount, vat_rate, vat_amount, total_amount, payment_terms, sent_at, paid_at,
    credited_amount, paid_amount, notes FROM invoices
    WHERE company_id = ? AND issue_date BETWEEN ? AND ? AND status <> 'kladde' ORDER BY id`, ...scoped);
  const invoiceItems = rows(snapshot, `SELECT ii.id, ii.invoice_id, ii.description, ii.quantity,
    ii.unit_price, ii.amount, ii.vat_rate FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id WHERE i.company_id = ? AND i.issue_date BETWEEN ? AND ?
    AND i.status <> 'kladde' ORDER BY ii.id`, ...scoped);
  const creditNotes = rows(snapshot, `SELECT id, company_id, customer_id, invoice_id, credit_number,
    amount, reason, status, created_at FROM credit_notes WHERE company_id = ?
    AND substr(created_at,1,10) BETWEEN ? AND ? AND status <> 'kladde' ORDER BY id`, ...scoped);
  const creditCustomerIds = creditNotes.filter((row) => row.customer_id != null).map((row) => Number(row.customer_id));
  const creditInvoiceIds = creditNotes.filter((row) => row.invoice_id != null).map((row) => Number(row.invoice_id));
  const customerIds = [...invoices.map((row) => Number(row.customer_id)), ...creditCustomerIds];
  const customers = rows(snapshot, `SELECT id, company_id, name, address, customer_number, cvr, ean,
    invoice_email, payment_terms FROM customers WHERE company_id = ? ORDER BY id`, companyId)
    .filter((row) => customerIds.includes(Number(row.id)));
  assertReferences("Fakturaens kunde", customerIds, customers.map((row) => Number(row.id)));
  const itemInvoiceIds = new Set(invoiceItems.map((row) => Number(row.invoice_id)));
  if (invoices.some((row) => !itemInvoiceIds.has(Number(row.id)))) {
    throw new Error("En udstedt faktura mangler fakturalinjer.");
  }

  const vouchers = rows(snapshot, `SELECT id, company_id, voucher_number, supplier, date, amount,
    vat_amount, vat_rate, description, category, account_id, status, created_at FROM vouchers
    WHERE company_id = ? AND date BETWEEN ? AND ? AND status IN ('bogfoert','bogført') ORDER BY id`, ...scoped);
  const documents = rows(snapshot, `SELECT d.id, d.company_id, d.file_name, d.file_type, d.storage,
    d.storage_key, d.size_bytes, d.content_hash, d.sender_email, d.posted_journal_entry_id,
    d.matched_voucher_id, d.source, d.invoice_date, d.invoice_number, d.status, d.created_at
    FROM document_inbox d WHERE d.company_id = ? AND (
      d.posted_journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ? AND date BETWEEN ? AND ?
        AND status IN ('bogført','bogfort','afstemt')) OR
      d.matched_voucher_id IN (SELECT id FROM vouchers WHERE company_id = ? AND date BETWEEN ? AND ?
        AND status IN ('bogfoert','bogført'))
    ) ORDER BY d.id`, companyId, ...scoped, ...scoped);
  const allOwnInvoiceIds = rows(snapshot, "SELECT id FROM invoices WHERE company_id = ?", companyId)
    .map((row) => Number(row.id));
  assertReferences("Kreditnotaens faktura", creditInvoiceIds, allOwnInvoiceIds);
  const bankTransactions = rows(snapshot, `SELECT id, company_id, date, description, amount, balance,
    provider, account_ref, external_id, matched_type, matched_id, status, imported_at
    FROM bank_transactions WHERE company_id = ? AND date BETWEEN ? AND ? ORDER BY id`, ...scoped);
  const periodCloses = rows(snapshot, `SELECT id, company_id, period_type, period_label, start_date,
    end_date, status, checklist, closed_by, closed_at, created_at FROM period_closes
    WHERE company_id = ? AND end_date BETWEEN ? AND ? ORDER BY id`, ...scoped);
  const vatPeriods = rows(snapshot, `SELECT id, company_id, period, vat_type, output_vat, input_vat,
    net_vat, status, reported_at, created_at FROM vat_periods WHERE company_id = ? ORDER BY id`, companyId)
    .filter((row) => row.reported_at && String(row.reported_at).slice(0, 10) >= start
      && String(row.reported_at).slice(0, 10) <= end);

  const bundle = {
    format: "add-smartregnskab-bookkeeping-records-v1",
    scope: "candidate_records_only" as const,
    completeBookkeepingArchive: false as const,
    companyId, period: inventory.period,
    inventoryCounts: inventory.counts,
    company, businessProfile: profile,
    journalEntries, journalLines, accounts, invoices, invoiceItems, customers,
    vouchers, documents, creditNotes, bankTransactions, periodCloses, vatPeriods,
    coverageCaveats: [
      "VAT periods are selected by reported_at; unreported periods are not covered.",
      "Credit notes are selected by created_at, not a dedicated issue date.",
      "Credit notes may reference an invoice from another fiscal year; that source invoice is not duplicated here.",
      "Customer and account master data are current snapshot values, not historical invoice renderings.",
      "Accounting audit trails and other source dependencies are not fully mapped.",
    ],
  };
  const bytes = Buffer.from(JSON.stringify(bundle), "utf8");
  return { bundle, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Manual candidate upload; a verified receipt does not make the entire archive complete. */
export async function captureBookkeepingRecordCandidate(input: {
  snapshot: Database.Database;
  companyId: number;
  referenceDate: string;
  config: ArchiveBucketConfig;
  encryptionSecret: string;
  now?: Date;
}, store: (input: Parameters<typeof storeLockedArchiveObject>[0]) => Promise<ArchiveReceipt> = storeLockedArchiveObject) {
  const { bundle, bytes, sha256 } = buildBookkeepingRecordBundle(
    input.snapshot, input.companyId, input.referenceDate,
  );
  const objectKey = `companies/${input.companyId}/fiscal-years/${bundle.period.start}/records/candidate-${sha256}.json`;
  const receipt = await store({ config: input.config,
    key: objectKey,
    plain: bytes, retainUntil: bundle.period.retainUntil,
    encryptionSecret: input.encryptionSecret, now: input.now });
  if (!receipt.verified || receipt.bucket !== input.config.bucket || receipt.objectKey !== objectKey
      || receipt.sha256 !== sha256
      || receipt.plainBytes !== bytes.length || !receipt.versionId) {
    throw new Error("Arkivlagerets kvittering for regnskabsdata er ikke verificeret.");
  }
  return { scope: "candidate_records_only" as const, completeBookkeepingArchive: false as const,
    companyId: input.companyId, period: bundle.period, receipt, coverageCaveats: bundle.coverageCaveats };
}

/** Readback verifies the locked version and basic cross-table counts; it is not a complete restore drill. */
export async function verifyBookkeepingRecordCandidateReceipt(input: {
  config: ArchiveBucketConfig;
  receipt: ArchiveReceipt;
  encryptionSecret: string;
  companyId: number;
  fiscalYearStart: string;
}, read: (input: Parameters<typeof readLockedArchiveObject>[0]) => Promise<Buffer> = readLockedArchiveObject) {
  const prefix = `companies/${input.companyId}/fiscal-years/${input.fiscalYearStart}/records/`;
  if (!input.receipt.objectKey.startsWith(prefix)) throw new Error("Arkivkvitteringen peger på forkert virksomhed eller regnskabsår.");
  const bytes = await read({ config: input.config, receipt: input.receipt, encryptionSecret: input.encryptionSecret });
  let bundle: Record<string, any>;
  try { bundle = JSON.parse(bytes.toString("utf8")); }
  catch { throw new Error("Arkivets regnskabsdata kan ikke læses som JSON."); }
  if (bundle.format !== "add-smartregnskab-bookkeeping-records-v1"
      || bundle.scope !== "candidate_records_only" || bundle.completeBookkeepingArchive !== false
      || bundle.companyId !== input.companyId || bundle.period?.start !== input.fiscalYearStart
      || bundle.company?.id !== input.companyId || bundle.businessProfile?.company_id !== input.companyId) {
    throw new Error("Arkivets regnskabsdata har forkert virksomhed, regnskabsår eller format.");
  }
  const mapped = ["journalEntries", "journalLines", "invoices", "invoiceItems", "vouchers", "documents"] as const;
  for (const name of mapped) {
    const expected = bundle.inventoryCounts?.[name === "documents" ? "linkedOriginals" : name];
    if (!Array.isArray(bundle[name]) || !Number.isSafeInteger(expected) || bundle[name].length !== expected) {
      throw new Error(`Arkivets ${name} stemmer ikke med forundersøgelsens antal.`);
    }
  }
  for (const name of ["journalEntries", "journalLines", "accounts", "invoices", "customers", "vouchers",
    "documents", "creditNotes", "bankTransactions", "periodCloses", "vatPeriods"] as const) {
    if (!Array.isArray(bundle[name]) || bundle[name].some((row: any) => row.company_id !== input.companyId)) {
      throw new Error(`Arkivets ${name} indeholder data fra en anden virksomhed.`);
    }
  }
  return { verified: true as const, scope: "candidate_records_only" as const,
    completeBookkeepingArchive: false as const, companyId: input.companyId,
    period: bundle.period, counts: bundle.inventoryCounts };
}
