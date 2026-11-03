import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { latestExternalBackupManifestKey, restoreExternalBackupDatabase } from "../server/backup-service";
import { fingerprintRealBookkeepingYear } from "../server/bookkeeping-archive-stream";
import { archiveYearCandidates } from "../server/bookkeeping-archive-weekly";

type CompanyRow = { id: number };
type ProfileRow = { fiscalYearStart: string };

async function main() {
  const temp = mkdtempSync(join(tmpdir(), "smartregnskab-archive-preflight-from-backup-"));
  let snapshot: Database.Database | undefined;
  try {
    const backupKey = await latestExternalBackupManifestKey();
    const databasePath = join(temp, "restored.db");
    const restoredBackup = await restoreExternalBackupDatabase(backupKey, databasePath);
    snapshot = new Database(databasePath, { readonly: true, fileMustExist: true });

    const companies = snapshot.prepare("SELECT id FROM companies WHERE kind <> 'platform' ORDER BY id")
      .all() as CompanyRow[];
    const periods: Array<Record<string, unknown>> = [];
    const issues: Array<{ companyId: number; message: string }> = [];

    for (const { id: companyId } of companies) {
      try {
        const profile = snapshot.prepare(`
          SELECT fiscal_year_start AS fiscalYearStart
          FROM business_profiles
          WHERE company_id=? AND fiscal_year_start IS NOT NULL
          ORDER BY id DESC LIMIT 1
        `).get(companyId) as ProfileRow | undefined;
        if (!profile?.fiscalYearStart) {
          issues.push({ companyId, message: "Regnskabsårets start mangler." });
          continue;
        }
        const years = archiveYearCandidates(snapshot, companyId, profile.fiscalYearStart);
        for (const year of years) {
          const result = await fingerprintRealBookkeepingYear({
            db: snapshot,
            companyId,
            fiscalYearStart: profile.fiscalYearStart,
            referenceDate: year.referenceDate,
          });
          periods.push({
            companyId,
            fiscalYearStart: result.fiscalYearStart,
            referenceDate: result.referenceDate,
            sourceSha256: result.sourceSha256,
            sourceBytes: result.sourceBytes,
            counts: result.counts,
            fileCount: result.fileCount,
          });
        }
      } catch (error) {
        issues.push({
          companyId,
          message: error instanceof Error ? error.message : "For-kontrollen fejlede.",
        });
      }
    }

    console.log(JSON.stringify({
      ok: true,
      mode: "read-only-inventory-from-verified-backup",
      backupSha256: restoredBackup.checksum,
      periods,
      issues,
      permanentArchiveCreated: false,
    }));
  } finally {
    snapshot?.close();
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "For-kontrollen fra sikkerhedskopien fejlede.");
  process.exitCode = 1;
});
