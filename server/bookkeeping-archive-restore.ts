import type Database from "better-sqlite3";
import type { ArchiveReceipt } from "./bookkeeping-archive-object";
import { readLockedArchiveObject } from "./bookkeeping-archive-object";
import { archiveBucketConfig } from "./bookkeeping-archive-readiness";
import { validateRestoredBookkeepingBundle } from "./bookkeeping-archive-real-data";
import { BookkeepingStreamValidator, type SegmentedBookkeepingReceipt } from "./bookkeeping-archive-stream";
import { readSegmentedArchive } from "./bookkeeping-archive-segments";

type ReceiptRow = {
  id: number;
  companyId: number;
  fiscalYearStart: string;
  sourceSha256: string;
  receiptJson: string;
};

/** Læsende kontrol af én bestemt arkivversion. Der skrives intet til kildedatabasen. */
export async function verifyBookkeepingArchiveReceipt(
  db: Database.Database,
  receiptId: number,
  readObject: typeof readLockedArchiveObject = readLockedArchiveObject,
  readSegments: typeof readSegmentedArchive = readSegmentedArchive,
) {
  if (!Number.isSafeInteger(receiptId) || receiptId <= 0) throw new Error("Et gyldigt arkivkvitterings-ID kræves.");
  const row = db.prepare(`SELECT id, company_id AS companyId, fiscal_year_start AS fiscalYearStart,
    source_sha256 AS sourceSha256, receipt_json AS receiptJson
    FROM bookkeeping_archive_receipts WHERE id=?`).get(receiptId) as ReceiptRow | undefined;
  if (!row) throw new Error("Arkivkvitteringen findes ikke.");
  const receipt = JSON.parse(row.receiptJson) as ArchiveReceipt | SegmentedBookkeepingReceipt;
  if ("format" in receipt && receipt.format === "smartregnskab-segmented-receipt-v1") {
    if (receipt.sourceSha256 !== row.sourceSha256
        || !receipt.manifestReceipt?.objectKey?.startsWith(`companies/${row.companyId}/fiscal-years/${row.fiscalYearStart}/real-data/`)) {
      throw new Error("Arkivkvitteringen passer ikke til virksomheden, året eller kildehashen.");
    }
    const validator = new BookkeepingStreamValidator(row.companyId, row.fiscalYearStart);
    const restored = await readSegments({ config: archiveBucketConfig(), receipt: receipt.manifestReceipt,
      encryptionSecret: process.env.ARCHIVE_ENCRYPTION_KEY || "",
      expectedCompanyId: row.companyId, expectedFiscalYearStart: row.fiscalYearStart,
      sink: async (part) => { validator.push(part); },
    });
    if (restored.sourceSha256 !== row.sourceSha256) throw new Error("Gendannet arkiv har forkert kildehash.");
    const checked = validator.finish();
    return { verified: true, receiptId, companyId: row.companyId,
      fiscalYearStart: row.fiscalYearStart, counts: checked.counts, fileCount: checked.fileCount };
  }
  if ("format" in receipt) throw new Error("Arkivkvitteringen har et ukendt format.");
  if (receipt.sha256 !== row.sourceSha256
      || !receipt.objectKey?.startsWith(`companies/${row.companyId}/fiscal-years/${row.fiscalYearStart}/`)) {
    throw new Error("Arkivkvitteringen passer ikke til virksomheden, året eller kildehashen.");
  }
  const plain = await readObject({
    config: archiveBucketConfig(),
    receipt,
    encryptionSecret: process.env.ARCHIVE_ENCRYPTION_KEY || "",
  });
  const restored = validateRestoredBookkeepingBundle(plain, row.companyId);
  const parsed = JSON.parse(plain.toString("utf8")) as { fiscalYear?: { start?: string } };
  if (parsed.fiscalYear?.start !== row.fiscalYearStart) {
    throw new Error("Det gendannede arkiv tilhører et andet regnskabsår.");
  }
  return { verified: true, receiptId, companyId: row.companyId,
    fiscalYearStart: row.fiscalYearStart, counts: restored.counts, fileCount: restored.fileCount };
}
