import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import Database from "better-sqlite3";
import { verifyBookkeepingArchiveReceipt } from "../server/bookkeeping-archive-restore";
import type { readLockedArchiveObject } from "../server/bookkeeping-archive-object";
import type { readSegmentedArchive } from "../server/bookkeeping-archive-segments";

test("gendannelseskontrol læser en bestemt virksomheds årsarkiv uden databaseskrivning", async () => {
  const db = new Database(":memory:");
  const original = {
    ARCHIVE_S3_BUCKET: process.env.ARCHIVE_S3_BUCKET,
    S3_BUCKET: process.env.S3_BUCKET,
    ARCHIVE_S3_REGION: process.env.ARCHIVE_S3_REGION,
    ARCHIVE_S3_ENDPOINT: process.env.ARCHIVE_S3_ENDPOINT,
    ARCHIVE_S3_ACCESS_KEY_ID: process.env.ARCHIVE_S3_ACCESS_KEY_ID,
    ARCHIVE_S3_SECRET_ACCESS_KEY: process.env.ARCHIVE_S3_SECRET_ACCESS_KEY,
  };
  try {
    Object.assign(process.env, {
      ARCHIVE_S3_BUCKET: "locked-archive", S3_BUCKET: "rolling-backup",
      ARCHIVE_S3_REGION: "eu-central", ARCHIVE_S3_ENDPOINT: "https://nbg1.your-objectstorage.com/",
      ARCHIVE_S3_ACCESS_KEY_ID: "test", ARCHIVE_S3_SECRET_ACCESS_KEY: "test",
    });
    db.exec(`CREATE TABLE bookkeeping_archive_receipts (
      id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT,
      source_sha256 TEXT, receipt_json TEXT)`);
    const names = ["journalEntries", "journalLines", "invoices", "invoiceItems", "vouchers", "expenseReports", "expenseAttachments", "accountingFileObjects", "fileObjectVersions", "archiveRecords",
      "creditNotes", "bankTransactions", "vatPeriods", "periodCloses", "einvoiceQueue", "documentInbox", "accounts"];
    const plain = Buffer.from(JSON.stringify({ format: "smartregnskab-bookkeeping-extract-v6",
      companyId: 7, fiscalYear: { start: "2026-01-01", end: "2026-12-31" },
      tables: Object.fromEntries(names.map((name) => [name, []])), files: [], expenseFiles: [], fileObjectFiles: [], fileObjectVersionFiles: [] }));
    const sha256 = createHash("sha256").update(plain).digest("hex");
    const receipt = { bucket: "locked-archive", objectKey: "companies/7/fiscal-years/2026-01-01/real-data/a.json",
      versionId: "v1", sha256, plainBytes: plain.length, retainUntil: "2031-12-31T23:59:59.999Z", verified: true };
    db.prepare("INSERT INTO bookkeeping_archive_receipts VALUES (?,?,?,?,?)")
      .run(1, 7, "2026-01-01", sha256, JSON.stringify(receipt));
    const read = (async ({ receipt: requested }: { receipt: typeof receipt }) => {
      assert.equal(requested.versionId, "v1");
      return plain;
    }) as typeof readLockedArchiveObject;
    const result = await verifyBookkeepingArchiveReceipt(db, 1, read);
    assert.equal(result.verified, true);
    assert.equal(result.companyId, 7);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM bookkeeping_archive_receipts").get() as { n: number }).n, 1);
    db.prepare("UPDATE bookkeeping_archive_receipts SET company_id=8 WHERE id=1").run();
    await assert.rejects(verifyBookkeepingArchiveReceipt(db, 1, read), /passer ikke/);
  } finally {
    db.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("gendannelseskontrol læser en ny segmenteret manifestkvittering", async () => {
  const db = new Database(":memory:");
  const original = {
    ARCHIVE_S3_BUCKET: process.env.ARCHIVE_S3_BUCKET, S3_BUCKET: process.env.S3_BUCKET,
    ARCHIVE_S3_REGION: process.env.ARCHIVE_S3_REGION, ARCHIVE_S3_ENDPOINT: process.env.ARCHIVE_S3_ENDPOINT,
    ARCHIVE_S3_ACCESS_KEY_ID: process.env.ARCHIVE_S3_ACCESS_KEY_ID,
    ARCHIVE_S3_SECRET_ACCESS_KEY: process.env.ARCHIVE_S3_SECRET_ACCESS_KEY,
  };
  try {
    Object.assign(process.env, {
      ARCHIVE_S3_BUCKET: "locked-archive", S3_BUCKET: "rolling-backup",
      ARCHIVE_S3_REGION: "eu-central", ARCHIVE_S3_ENDPOINT: "https://nbg1.your-objectstorage.com/",
      ARCHIVE_S3_ACCESS_KEY_ID: "test", ARCHIVE_S3_SECRET_ACCESS_KEY: "test",
    });
    db.exec(`CREATE TABLE bookkeeping_archive_receipts (
      id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT,
      source_sha256 TEXT, receipt_json TEXT)`);
    const stream = Buffer.from([
      JSON.stringify({ kind: "header", format: "smartregnskab-bookkeeping-stream-v1", companyId: 7,
        fiscalYear: { start: "2026-01-01", end: "2026-12-31" } }),
      JSON.stringify({ kind: "row", table: "journalEntries", row: { id: 1, company_id: 7 } }),
      JSON.stringify({ kind: "row", table: "journalLines", row: { id: 2, company_id: 7, journal_entry_id: 1 } }),
    ].join("\n") + "\n");
    const sourceSha256 = createHash("sha256").update(stream).digest("hex");
    const manifestReceipt = { bucket: "locked-archive",
      objectKey: "companies/7/fiscal-years/2026-01-01/real-data/9a3c63f1-c70b-4d8a-a781-a4cb0aba53ef/manifest-aabbccdd-aabb-4ccd-8eee-aabbccddeeff.json",
      versionId: "manifest-v1", sha256: "b".repeat(64), plainBytes: 100,
      retainUntil: "2031-12-31T23:59:59.999Z", verified: true };
    const receipt = { format: "smartregnskab-segmented-receipt-v1", sourceSha256, manifestReceipt };
    db.prepare("INSERT INTO bookkeeping_archive_receipts VALUES (?,?,?,?,?)")
      .run(2, 7, "2026-01-01", sourceSha256, JSON.stringify(receipt));
    const noLegacyRead = (async () => { throw new Error("gammel læser må ikke bruges"); }) as typeof readLockedArchiveObject;
    const readSegments = (async ({ sink }: Parameters<typeof readSegmentedArchive>[0]) => {
      await sink?.(stream.subarray(0, 53));
      await sink?.(stream.subarray(53));
      return { verified: true, companyId: 7, fiscalYearStart: "2026-01-01",
        sourceSha256, sourceBytes: stream.length, partCount: 2 };
    }) as typeof readSegmentedArchive;
    const result = await verifyBookkeepingArchiveReceipt(db, 2, noLegacyRead, readSegments);
    assert.equal(result.verified, true);
    assert.equal(result.counts.journalEntries, 1);
    assert.equal(result.counts.journalLines, 1);
    assert.equal(result.fileCount, 0);
  } finally {
    db.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
