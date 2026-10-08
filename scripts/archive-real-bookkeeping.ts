import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { archiveRealCompanyYearStream } from "../server/bookkeeping-archive-stream";
import { archivePeriod } from "../server/bookkeeping-archive-readiness";
import { recordBookkeepingArchiveReceipt } from "../server/bookkeeping-archive-receipts";

async function main() {
  if (process.env.ARCHIVE_REAL_DATA_CONFIRM !== "YES") {
    throw new Error("Sæt ARCHIVE_REAL_DATA_CONFIRM=YES for en bevidst, permanent låst arkivering.");
  }
  const companyId = Number(process.env.ARCHIVE_COMPANY_ID);
  const fiscalYearStart = process.env.ARCHIVE_FISCAL_YEAR_START || "";
  const referenceDate = process.env.ARCHIVE_REFERENCE_DATE || "";
  if (!Number.isSafeInteger(companyId) || companyId <= 0 || !fiscalYearStart || !referenceDate) {
    throw new Error("ARCHIVE_COMPANY_ID, ARCHIVE_FISCAL_YEAR_START og ARCHIVE_REFERENCE_DATE kræves.");
  }
  const sourcePath = process.env.DATABASE_PATH;
  if (!sourcePath || !existsSync(sourcePath)) throw new Error("DATABASE_PATH skal pege på den eksisterende database.");
  const temp = mkdtempSync(join(tmpdir(), "smartregnskab-archive-"));
  let source: Database.Database | undefined;
  let snapshot: Database.Database | undefined;
  let ledger: Database.Database | undefined;
  try {
    source = new Database(sourcePath, { readonly: true, fileMustExist: true });
    const snapshotPath = join(temp, "snapshot.db");
    await source.backup(snapshotPath);
    snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    if (snapshot.pragma("quick_check", { simple: true }) !== "ok") throw new Error("Databasekopien bestod ikke integritetskontrollen.");
    const result = await archiveRealCompanyYearStream({ db: snapshot, companyId, fiscalYearStart, referenceDate });
    if (!result.verified) throw new Error("Arkivet blev ikke gendannelseskontrolleret.");
    ledger = new Database(sourcePath, { fileMustExist: true });
    const receiptId = recordBookkeepingArchiveReceipt(ledger, {
      companyId,
      fiscalYearStart: archivePeriod(fiscalYearStart, referenceDate).start,
      archivedAt: new Date().toISOString(),
      receipt: result.receipt,
    });
    // Kvitteringen er nødvendig for senere selektiv gendannelse; ingen kilde-/bilagsindhold udskrives.
    console.log(JSON.stringify({ ...result, receiptId }));
  } finally {
    ledger?.close();
    snapshot?.close();
    source?.close();
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Arkiveringen fejlede.");
  process.exitCode = 1;
});
