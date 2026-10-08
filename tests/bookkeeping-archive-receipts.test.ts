import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { recordBookkeepingArchiveReceipt } from "../server/bookkeeping-archive-receipts";

test("stores a segmented archive receipt for later independent verification", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE bookkeeping_archive_receipts (
    id integer PRIMARY KEY AUTOINCREMENT,
    company_id integer NOT NULL,
    fiscal_year_start text NOT NULL,
    archived_at text NOT NULL,
    source_sha256 text NOT NULL,
    receipt_json text NOT NULL
  )`);
  const receipt = {
    format: "smartregnskab-segmented-receipt-v1" as const,
    sourceSha256: "a".repeat(64),
    manifestReceipt: {
      bucket: "archive",
      objectKey: "companies/4/fiscal-years/2026-01-01/real-data/run/manifest.json",
      versionId: "version-1",
      sha256: "b".repeat(64),
      plainBytes: 100,
      retainUntil: "2031-12-31T23:59:59.999Z",
      verified: true,
    },
  };
  const id = recordBookkeepingArchiveReceipt(db, {
    companyId: 4,
    fiscalYearStart: "2026-01-01",
    archivedAt: "2026-10-08T10:00:00.000Z",
    receipt,
  });
  assert.equal(id, 1);
  const row = db.prepare("SELECT * FROM bookkeeping_archive_receipts WHERE id=1").get() as Record<string, unknown>;
  assert.equal(row.company_id, 4);
  assert.equal(row.source_sha256, receipt.sourceSha256);
  assert.deepEqual(JSON.parse(String(row.receipt_json)), receipt);
  db.close();
});

test("fails closed when the receipt ledger migration is absent", () => {
  const db = new Database(":memory:");
  assert.throws(() => recordBookkeepingArchiveReceipt(db, {
    companyId: 4,
    fiscalYearStart: "2026-01-01",
    archivedAt: "2026-10-08T10:00:00.000Z",
    receipt: {
      format: "smartregnskab-segmented-receipt-v1",
      sourceSha256: "a".repeat(64),
      manifestReceipt: {} as never,
    },
  }), /migration mangler/);
  db.close();
});
