import type Database from "better-sqlite3";
import { archivePeriod } from "./bookkeeping-archive-readiness";

type IdRow = { id: number };
type DocumentRow = IdRow & { storage: string | null; storage_key: string | null; content_hash: string | null };

/** Read-only preflight. This is not an archive export or proof of legal completeness. */
export function bookkeepingArchiveInventory(snapshot: Database.Database, companyId: number, referenceDate: string) {
  if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error("Ugyldigt virksomheds-id.");
  const company = snapshot.prepare("SELECT id FROM companies WHERE id = ?").get(companyId) as IdRow | undefined;
  if (!company) throw new Error("Virksomheden blev ikke fundet i databasekopien.");
  const profile = snapshot.prepare("SELECT fiscal_year_start AS fiscalYearStart FROM business_profiles WHERE company_id = ? ORDER BY id DESC LIMIT 1")
    .get(companyId) as { fiscalYearStart: string | null } | undefined;
  if (!profile?.fiscalYearStart) throw new Error("Virksomhedens regnskabsår mangler.");
  const period = archivePeriod(profile.fiscalYearStart, referenceDate);
  const params = [companyId, period.start, period.end] as const;

  const journalEntries = snapshot.prepare(`SELECT id FROM journal_entries
    WHERE company_id = ? AND date BETWEEN ? AND ? AND status IN ('bogført', 'bogfort', 'afstemt') ORDER BY id`).all(...params) as IdRow[];
  const journalLines = snapshot.prepare(`SELECT jl.id FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.company_id = jl.company_id
    WHERE je.company_id = ? AND je.date BETWEEN ? AND ? AND je.status IN ('bogført', 'bogfort', 'afstemt') ORDER BY jl.id`).all(...params) as IdRow[];
  const invoices = snapshot.prepare(`SELECT id FROM invoices
    WHERE company_id = ? AND issue_date BETWEEN ? AND ? AND status <> 'kladde' ORDER BY id`).all(...params) as IdRow[];
  const invoiceItems = snapshot.prepare(`SELECT ii.id FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.company_id = ? AND i.issue_date BETWEEN ? AND ? AND i.status <> 'kladde' ORDER BY ii.id`).all(...params) as IdRow[];
  const vouchers = snapshot.prepare(`SELECT id FROM vouchers
    WHERE company_id = ? AND date BETWEEN ? AND ? AND status IN ('bogfoert', 'bogført') ORDER BY id`).all(...params) as IdRow[];
  const documents = snapshot.prepare(`SELECT d.id, d.storage, d.storage_key, d.content_hash FROM document_inbox d
    WHERE d.company_id = ? AND (d.posted_journal_entry_id IN (
      SELECT id FROM journal_entries WHERE company_id = ? AND date BETWEEN ? AND ? AND status IN ('bogført', 'bogfort', 'afstemt')
    ) OR d.matched_voucher_id IN (
      SELECT id FROM vouchers WHERE company_id = ? AND date BETWEEN ? AND ? AND status IN ('bogfoert', 'bogført')
    )) ORDER BY d.id`).all(companyId, ...params, ...params) as DocumentRow[];

  const issues: string[] = [];
  const entriesWithoutLines = snapshot.prepare(`SELECT COUNT(*) AS count FROM journal_entries je
    WHERE je.company_id = ? AND je.date BETWEEN ? AND ? AND je.status IN ('bogført', 'bogfort', 'afstemt')
      AND NOT EXISTS (SELECT 1 FROM journal_lines jl WHERE jl.company_id = je.company_id AND jl.journal_entry_id = je.id)`)
    .get(...params) as { count: number };
  if (entriesWithoutLines.count) issues.push("posted_entries_without_lines");
  if (documents.some((row) => !["s3", "disk"].includes(row.storage || "")
      || !row.storage_key || !/^[a-f0-9]{64}$/i.test(row.content_hash || ""))) {
    issues.push("linked_originals_without_verified_file_reference");
  }
  const unmatchedDocuments = snapshot.prepare(`SELECT COUNT(*) AS count FROM document_inbox
    WHERE company_id = ? AND posted_journal_entry_id IS NULL AND matched_voucher_id IS NULL
      AND substr(created_at, 1, 10) BETWEEN ? AND ?
      AND status NOT IN ('afvist', 'papirkurv')`).get(...params) as { count: number };
  if (unmatchedDocuments.count) issues.push("unmatched_documents_require_classification");

  return {
    companyId, period,
    counts: { journalEntries: journalEntries.length, journalLines: journalLines.length,
      invoices: invoices.length, invoiceItems: invoiceItems.length, vouchers: vouchers.length,
      linkedOriginals: documents.length, unmatchedDocuments: unmatchedDocuments.count },
    issues,
    scope: "inventory_only" as const,
    readyForAutomaticArchive: false as const,
  };
}
