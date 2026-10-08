import type Database from "better-sqlite3";
import type { SegmentedBookkeepingReceipt } from "./bookkeeping-archive-stream";

export function recordBookkeepingArchiveReceipt(
  db: Database.Database,
  input: {
    companyId: number;
    fiscalYearStart: string;
    archivedAt: string;
    receipt: SegmentedBookkeepingReceipt;
  },
) {
  if (!Number.isSafeInteger(input.companyId) || input.companyId <= 0) {
    throw new Error("Ugyldigt virksomheds-ID til arkivkvitteringen.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fiscalYearStart)) {
    throw new Error("Ugyldig regnskabsårsstart til arkivkvitteringen.");
  }
  if (!input.receipt.sourceSha256 || input.receipt.format !== "smartregnskab-segmented-receipt-v1") {
    throw new Error("Arkivkvitteringen har et ugyldigt format eller mangler kildehash.");
  }
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='bookkeeping_archive_receipts'").get()) {
    throw new Error("Arkivkvitteringernes databasemigration mangler.");
  }
  const result = db.prepare(`INSERT INTO bookkeeping_archive_receipts
    (company_id, fiscal_year_start, archived_at, source_sha256, receipt_json)
    VALUES (?,?,?,?,?)`).run(
      input.companyId,
      input.fiscalYearStart,
      input.archivedAt,
      input.receipt.sourceSha256,
      JSON.stringify(input.receipt),
    );
  return Number(result.lastInsertRowid);
}
