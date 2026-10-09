import assert from "node:assert/strict";
import { test } from "node:test";
import { ARCHIVE_DATED_SOURCES, archiveYearCandidates, runWeeklyBookkeepingArchive, weeklyArchiveEnabled } from "../server/bookkeeping-archive-weekly";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

test("ugentlig arkivering er lukket som standard og kræver et bevidst YES", () => {
  assert.equal(weeklyArchiveEnabled({}), false);
  assert.equal(weeklyArchiveEnabled({ BOOKKEEPING_ARCHIVE_WEEKLY_ENABLED: "true" }), false);
  assert.equal(weeklyArchiveEnabled({ BOOKKEEPING_ARCHIVE_WEEKLY_ENABLED: "YES" }), true);
});

test("afsluttede perioder udløser arkivering af deres regnskabsår", () => {
  const db = new Database(":memory:");
  try {
    for (const [table, column] of ARCHIVE_DATED_SOURCES) {
      db.exec(`CREATE TABLE "${table}" (id integer PRIMARY KEY, company_id integer, "${column}" text)`);
    }
    db.exec("INSERT INTO period_closes VALUES (1, 7, '2025-12-31')");
    assert.deepEqual(archiveYearCandidates(db, 7, "2026-01-01").map((year) => year.start), ["2025-01-01"]);
    assert.deepEqual(archiveYearCandidates(db, 8, "2026-01-01"), []);
  } finally { db.close(); }
});

test("ugejobbet springer uændrede årsudtræk over, men arkiverer en rettelse straks", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smart-archive-weekly-"));
  const dbPath = join(dir, "test.db");
  const sqlite = new Database(dbPath);
  try {
    sqlite.exec(`
      CREATE TABLE companies (id integer PRIMARY KEY, kind text NOT NULL);
      CREATE TABLE business_profiles (id integer PRIMARY KEY, company_id integer, fiscal_year_start text);
      CREATE TABLE bookkeeping_archive_receipts (id integer PRIMARY KEY, company_id integer, fiscal_year_start text, archived_at text, source_sha256 text, receipt_json text);
      CREATE TABLE journal_entries (id integer PRIMARY KEY, company_id integer, date text);
      CREATE TABLE invoices (id integer PRIMARY KEY, company_id integer, customer_id integer, issue_date text);
      CREATE TABLE vouchers (id integer PRIMARY KEY, company_id integer, date text);
      CREATE TABLE archive_records (id integer PRIMARY KEY, company_id integer, date text, archive_path text);
      CREATE TABLE expense_reports (id integer PRIMARY KEY, company_id integer, date text, receipt_image text);
      CREATE TABLE file_objects (id integer PRIMARY KEY, company_id integer, created_at text, category text, storage_path text, file_size integer, checksum text);
      CREATE TABLE file_versions (id integer PRIMARY KEY, company_id integer, file_id integer, storage_path text, checksum text);
      CREATE TABLE attachments (id integer PRIMARY KEY, company_id integer, storage text, storage_key text, data_url text, size_bytes integer);
      CREATE TABLE credit_notes (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE bank_transactions (id integer PRIMARY KEY, company_id integer, date text);
      CREATE TABLE vat_periods (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE period_closes (id integer PRIMARY KEY, company_id integer, end_date text);
      CREATE TABLE einvoice_queue (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE document_inbox (id integer PRIMARY KEY, company_id integer, created_at text, posted_journal_entry_id integer, matched_voucher_id integer);
      CREATE TABLE journal_lines (id integer PRIMARY KEY, company_id integer, journal_entry_id integer);
      CREATE TABLE invoice_items (id integer PRIMARY KEY, invoice_id integer);
      CREATE TABLE customers (id integer PRIMARY KEY, company_id integer);
      CREATE TABLE accounts (id integer PRIMARY KEY, company_id integer);
      CREATE TABLE payroll_entries (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE fixed_assets (id integer PRIMARY KEY, company_id integer, purchase_date text, sold_at text);
      CREATE TABLE payment_runs (id integer PRIMARY KEY, company_id integer, run_date text);
      CREATE TABLE year_end_closes (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE vat_reconciliations (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE accruals (id integer PRIMARY KEY, company_id integer, start_date text, end_date text, created_at text);
      CREATE TABLE inventory_accounts (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE currency_transactions (id integer PRIMARY KEY, company_id integer, date text);
      CREATE TABLE annual_reports (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE consolidation_entries (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE advanced_vat (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE bank_payments (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE payroll_engine (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE audit_package (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE reconciliation_center (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE accounting_exports (id integer PRIMARY KEY, company_id integer, export_date text);
      CREATE TABLE mileage_reports (id integer PRIMARY KEY, company_id integer, date text);
      CREATE TABLE audit_logs (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE tax_deadlines (id integer PRIMARY KEY, company_id integer, created_at text);
      CREATE TABLE reminder_flow (id integer PRIMARY KEY, company_id integer, created_at text);
      INSERT INTO companies VALUES (1,'kunde'), (2,'kunde'), (3,'platform');
      INSERT INTO business_profiles VALUES (1,1,'2026-01-01'), (2,2,'2026-01-01');
      INSERT INTO customers VALUES (101,1), (102,2), (103,3);
      INSERT INTO invoices VALUES (11,1,101,'2026-04-01'), (12,1,101,'2025-11-01'), (22,2,102,'2026-04-01'), (33,3,103,'2026-04-01');
    `);
    assert.deepEqual(archiveYearCandidates(sqlite, 1, "2026-01-01").map(x => x.start), ["2025-01-01", "2026-01-01"]);
    const seen: string[] = [];
    const fakeArchive = async ({ companyId, referenceDate, preparedFingerprint }: { companyId: number; referenceDate: string; preparedFingerprint?: { sourceSha256: string } }) => {
      seen.push(`${companyId}:${referenceDate}`);
      assert.ok(preparedFingerprint);
      return { verified: true, receipt: { format: "smartregnskab-segmented-receipt-v1" as const,
        sourceSha256: preparedFingerprint.sourceSha256,
        manifestReceipt: { bucket: "locked", objectKey: `companies/${companyId}/fiscal-years/2026-01-01/real-data/test/manifest.json`,
          versionId: "v1", sha256: "a".repeat(64), plainBytes: 10,
          retainUntil: "2031-12-31T23:59:59.999Z", verified: true } },
      counts: {}, fileCount: 0 };
    };
    sqlite.close();
    const first = await runWeeklyBookkeepingArchive(new Date("2026-10-06T10:00:00Z"), { dbPath, archive: fakeArchive, enabled: true });
    assert.equal(first.archived, 3);
    assert.deepEqual(seen, ["1:2025-11-01", "1:2026-04-01", "2:2026-04-01"]);
    const second = await runWeeklyBookkeepingArchive(new Date("2026-10-07T10:00:00Z"), { dbPath, archive: fakeArchive, enabled: true });
    assert.equal(second.archived, 0);
    assert.equal(second.skipped, 3);
    const change = new Database(dbPath);
    try { change.exec("INSERT INTO journal_entries VALUES (44,1,'2026-09-30')"); }
    finally { change.close(); }
    const third = await runWeeklyBookkeepingArchive(new Date("2026-10-07T11:00:00Z"), { dbPath, archive: fakeArchive, enabled: true });
    assert.equal(third.archived, 1);
    assert.equal(third.skipped, 2);
    assert.equal(seen.length, 4);
    const verify = new Database(dbPath, { readonly: true });
    try { assert.equal((verify.prepare("SELECT COUNT(*) AS n FROM bookkeeping_archive_receipts").get() as { n: number }).n, 4); }
    finally { verify.close(); }
  } finally {
    if (sqlite.open) sqlite.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("ny database får kvitteringstabellen via versionsstyrede migrationer", () => {
  const dir = mkdtempSync(join(tmpdir(), "smart-archive-migration-"));
  const sqlite = new Database(join(dir, "test.db"));
  try {
    migrate(drizzle(sqlite), { migrationsFolder: resolve("migrations") });
    const found = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='bookkeeping_archive_receipts'").get();
    assert.ok(found);
    sqlite.prepare("INSERT INTO bookkeeping_archive_receipts (company_id, fiscal_year_start, archived_at, source_sha256, receipt_json) VALUES (?,?,?,?,?)")
      .run(1, "2026-01-01", "2026-10-06T00:00:00Z", "a".repeat(64), "{}");
  } finally {
    sqlite.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
