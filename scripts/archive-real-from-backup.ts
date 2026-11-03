import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { latestExternalBackupManifestKey, restoreExternalBackupDatabase } from "../server/backup-service";
import { archiveRealCompanyYearStream } from "../server/bookkeeping-archive-stream";

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

  const temp = mkdtempSync(join(tmpdir(), "smartregnskab-archive-from-backup-"));
  let snapshot: Database.Database | undefined;
  try {
    const backupKey = await latestExternalBackupManifestKey();
    const databasePath = join(temp, "restored.db");
    const restoredBackup = await restoreExternalBackupDatabase(backupKey, databasePath);
    snapshot = new Database(databasePath, { readonly: true, fileMustExist: true });
    const result = await archiveRealCompanyYearStream({
      db: snapshot,
      companyId,
      fiscalYearStart,
      referenceDate,
    });
    console.log(JSON.stringify({
      ok: true,
      mode: "real-data-from-verified-backup",
      companyId: result.companyId,
      fiscalYearStart: result.fiscalYearStart,
      sourceSha256: result.receipt.sourceSha256,
      sourceBytes: result.receipt.sourceBytes,
      counts: result.counts,
      fileCount: result.fileCount,
      archiveManifestKey: result.receipt.manifestReceipt.objectKey,
      archiveVersioned: Boolean(result.receipt.manifestReceipt.versionId),
      backupSha256: restoredBackup.checksum,
      verified: result.verified,
    }));
  } finally {
    snapshot?.close();
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Arkiveringen fra sikkerhedskopien fejlede.");
  process.exitCode = 1;
});
