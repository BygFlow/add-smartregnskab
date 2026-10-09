import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { archiveRealCompanyYearStream, fingerprintRealBookkeepingYear } from "./bookkeeping-archive-stream";
import { archivePeriod } from "./bookkeeping-archive-readiness";
import { recordBookkeepingArchiveReceipt } from "./bookkeeping-archive-receipts";

/** Bevidst lukket indtil fuld datadækning og en produktionsgendannelse er godkendt. */
export function weeklyArchiveEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.BOOKKEEPING_ARCHIVE_WEEKLY_ENABLED === "YES";
}

type ArchiveCall = typeof archiveRealCompanyYearStream;
export const ARCHIVE_DATED_SOURCES = [
  ["journal_entries", "date"], ["invoices", "issue_date"], ["vouchers", "date"], ["expense_reports", "date"], ["archive_records", "date"],
  ["credit_notes", "created_at"], ["bank_transactions", "date"], ["vat_periods", "created_at"],
  ["period_closes", "end_date"],
  ["einvoice_queue", "created_at"], ["document_inbox", "created_at"],
  ["file_objects", "created_at"],
  ["payroll_entries", "created_at"], ["fixed_assets", "purchase_date"], ["payment_runs", "run_date"],
  ["year_end_closes", "created_at"], ["vat_reconciliations", "created_at"], ["accruals", "created_at"],
  ["inventory_accounts", "created_at"], ["currency_transactions", "date"], ["annual_reports", "created_at"],
  ["consolidation_entries", "created_at"], ["advanced_vat", "created_at"], ["bank_payments", "created_at"],
  ["payroll_engine", "created_at"], ["audit_package", "created_at"], ["reconciliation_center", "created_at"],
  ["accounting_exports", "export_date"], ["mileage_reports", "date"], ["audit_logs", "created_at"],
  ["tax_deadlines", "created_at"], ["reminder_flow", "created_at"],
] as const;

/** Include earlier fiscal years too: a late correction must not disappear from
 * the next full archival cycle merely because the current year has begun. */
export function archiveYearCandidates(db: Database.Database, companyId: number, fiscalYearStart: string) {
  const years = new Map<string, string>();
  for (const [table, column] of ARCHIVE_DATED_SOURCES) {
    const dates = db.prepare(`SELECT "${column}" AS sourceDate FROM "${table}" WHERE company_id=?`).all(companyId) as Array<{ sourceDate: string | null }>;
    for (const { sourceDate } of dates) {
      const date = String(sourceDate || "").slice(0, 10);
      const period = archivePeriod(fiscalYearStart, date);
      years.set(period.start, date);
    }
  }
  return Array.from(years.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([start, referenceDate]) => ({ start, referenceDate }));
}

export async function runWeeklyBookkeepingArchive(
  now = new Date(),
  options: { dbPath?: string; archive?: ArchiveCall; enabled?: boolean } = {},
) {
  if (!(options.enabled ?? weeklyArchiveEnabled())) {
    return { archived: 0, skipped: 0, detail: "Femårsarkivets ugentlige job er ikke aktiveret." };
  }
  const dbPath = options.dbPath || process.env.DATABASE_PATH || "data.db";
  const archive = options.archive || archiveRealCompanyYearStream;
  if (!existsSync(dbPath)) throw new Error("Databasen til bogføringsarkivet findes ikke.");
  const temp = mkdtempSync(join(tmpdir(), "smartregnskab-weekly-archive-"));
  let source: Database.Database | undefined;
  let snapshot: Database.Database | undefined;
  let ledger: Database.Database | undefined;
  let archived = 0;
  let skipped = 0;
  const errors: string[] = [];
  try {
    source = new Database(dbPath, { readonly: true, fileMustExist: true });
    const snapshotPath = join(temp, "snapshot.db");
    await source.backup(snapshotPath);
    source.close(); source = undefined;
    snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    if (snapshot.pragma("quick_check", { simple: true }) !== "ok") throw new Error("Arkivets databasekopi er ugyldig.");
    ledger = new Database(dbPath, { fileMustExist: true });
    if (!ledger.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='bookkeeping_archive_receipts'").get()) {
      throw new Error("Arkivkvitteringernes databasemigration mangler.");
    }
    const companies = snapshot.prepare("SELECT id FROM companies WHERE kind <> 'platform' ORDER BY id").all() as Array<{ id: number }>;
    for (const { id: companyId } of companies) {
      try {
        const profile = snapshot.prepare("SELECT fiscal_year_start AS fiscalYearStart FROM business_profiles WHERE company_id=? AND fiscal_year_start IS NOT NULL ORDER BY id DESC LIMIT 1")
          .get(companyId) as { fiscalYearStart: string } | undefined;
        if (!profile) {
          const hasMaterial = ARCHIVE_DATED_SOURCES.some(([table]) => Boolean(snapshot!.prepare(`SELECT 1 FROM "${table}" WHERE company_id=? LIMIT 1`).get(companyId)));
          if (!hasMaterial) { skipped++; continue; }
          throw new Error("Regnskabsårets start mangler.");
        }
        const years = archiveYearCandidates(snapshot, companyId, profile.fiscalYearStart);
        if (!years.length) { skipped++; continue; }
        for (const year of years) {
          const preparedFingerprint = await fingerprintRealBookkeepingYear({ db: snapshot, companyId,
            fiscalYearStart: profile.fiscalYearStart, referenceDate: year.referenceDate });
          const sourceSha256 = preparedFingerprint.sourceSha256;
          const latest = ledger.prepare("SELECT source_sha256 AS sourceSha256 FROM bookkeeping_archive_receipts WHERE company_id=? AND fiscal_year_start=? ORDER BY archived_at DESC, id DESC LIMIT 1")
            .get(companyId, year.start) as { sourceSha256: string } | undefined;
          if (latest?.sourceSha256 === sourceSha256) { skipped++; continue; }
          const result = await archive({ db: snapshot, companyId, fiscalYearStart: profile.fiscalYearStart,
            referenceDate: year.referenceDate, preparedFingerprint });
          if (!result.verified) throw new Error("Arkivet blev ikke gendannelseskontrolleret.");
          if (result.receipt.sourceSha256 !== sourceSha256) throw new Error("Arkivkvitteringen stemmer ikke med databasens årsudtræk.");
          recordBookkeepingArchiveReceipt(ledger, {
            companyId,
            fiscalYearStart: year.start,
            archivedAt: now.toISOString(),
            receipt: result.receipt,
          });
          archived++;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Regnskabsåret indeholder ingen poster eller bilag")) {
          skipped++;
          continue;
        }
        errors.push(`Virksomhed ${companyId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (errors.length) throw new Error(`Femårsarkiv fejlede for ${errors.length} virksomhed(er): ${errors.join(" | ").slice(0, 500)}`);
    return { archived, skipped, detail: `${archived} årsudtræk arkiveret og gendannelseskontrolleret; ${skipped} uændrede eller uden materiale.` };
  } finally {
    ledger?.close();
    snapshot?.close();
    source?.close();
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
