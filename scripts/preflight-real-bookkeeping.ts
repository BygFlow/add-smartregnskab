import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { fingerprintRealBookkeepingYear } from "../server/bookkeeping-archive-stream";

async function main() {
  const companyId = Number(process.env.ARCHIVE_COMPANY_ID);
  const fiscalYearStart = process.env.ARCHIVE_FISCAL_YEAR_START || "";
  const referenceDate = process.env.ARCHIVE_REFERENCE_DATE || "";
  if (!Number.isSafeInteger(companyId) || companyId <= 0 || !fiscalYearStart || !referenceDate) {
    throw new Error("ARCHIVE_COMPANY_ID, ARCHIVE_FISCAL_YEAR_START og ARCHIVE_REFERENCE_DATE kræves.");
  }
  const sourcePath = process.env.DATABASE_PATH;
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error("DATABASE_PATH skal pege på den eksisterende database.");
  }

  const temp = mkdtempSync(join(tmpdir(), "smartregnskab-archive-preflight-"));
  let source: Database.Database | undefined;
  let snapshot: Database.Database | undefined;
  try {
    source = new Database(sourcePath, { readonly: true, fileMustExist: true });
    const snapshotPath = join(temp, "snapshot.db");
    await source.backup(snapshotPath);
    snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    if (snapshot.pragma("quick_check", { simple: true }) !== "ok") {
      throw new Error("Databasekopien bestod ikke integritetskontrollen.");
    }

    const result = await fingerprintRealBookkeepingYear({
      db: snapshot,
      companyId,
      fiscalYearStart,
      referenceDate,
    });
    console.log(JSON.stringify({
      ok: true,
      mode: "read-only-preflight",
      companyId: result.companyId,
      fiscalYearStart: result.fiscalYearStart,
      referenceDate: result.referenceDate,
      sourceSha256: result.sourceSha256,
      sourceBytes: result.sourceBytes,
      counts: result.counts,
      fileCount: result.fileCount,
      permanentArchiveCreated: false,
    }));
  } finally {
    snapshot?.close();
    source?.close();
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "For-kontrollen fejlede.");
  process.exitCode = 1;
});
