import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { BookkeepingStreamValidator, streamRealBookkeepingYear } from "../server/bookkeeping-archive-stream";

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE business_profiles (id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT);
    CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT);
    CREATE TABLE journal_lines (id INTEGER PRIMARY KEY, company_id INTEGER, journal_entry_id INTEGER);
    CREATE TABLE invoices (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER, issue_date TEXT);
    CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, company_id INTEGER);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT);
    CREATE TABLE expense_reports (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, receipt_image TEXT);
    CREATE TABLE file_objects (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, category TEXT, storage_path TEXT, file_size INTEGER, checksum TEXT);
    CREATE TABLE file_versions (id INTEGER PRIMARY KEY, company_id INTEGER, file_id INTEGER, storage_path TEXT, checksum TEXT);
    CREATE TABLE attachments (id INTEGER PRIMARY KEY, company_id INTEGER, storage TEXT, storage_key TEXT, data_url TEXT, size_bytes INTEGER);
    CREATE TABLE archive_records (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, archive_path TEXT);
    CREATE TABLE credit_notes (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE bank_transactions (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT);
    CREATE TABLE vat_periods (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE period_closes (id INTEGER PRIMARY KEY, company_id INTEGER, end_date TEXT);
    CREATE TABLE einvoice_queue (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE document_inbox (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, storage TEXT, storage_key TEXT, content_hash TEXT, posted_journal_entry_id INTEGER, matched_voucher_id INTEGER);
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, company_id INTEGER);
    CREATE TABLE payroll_entries (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE fixed_assets (id INTEGER PRIMARY KEY, company_id INTEGER, purchase_date TEXT, sold_at TEXT);
    CREATE TABLE payment_runs (id INTEGER PRIMARY KEY, company_id INTEGER, run_date TEXT);
    CREATE TABLE year_end_closes (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE vat_reconciliations (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE accruals (id INTEGER PRIMARY KEY, company_id INTEGER, start_date TEXT, end_date TEXT, created_at TEXT);
    CREATE TABLE inventory_accounts (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE currency_transactions (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT);
    CREATE TABLE annual_reports (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE consolidation_entries (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE advanced_vat (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE bank_payments (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE payroll_engine (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE audit_package (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE reconciliation_center (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE accounting_exports (id INTEGER PRIMARY KEY, company_id INTEGER, export_date TEXT);
    CREATE TABLE mileage_reports (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT);
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE tax_deadlines (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    CREATE TABLE reminder_flow (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT);
    INSERT INTO companies VALUES (1,'A'), (2,'B');
    INSERT INTO business_profiles VALUES (1,1,'2026-01-01'), (2,2,'2026-01-01');
    INSERT INTO customers VALUES (10,1);
    INSERT INTO journal_entries VALUES (11,1,'2026-04-01');
    INSERT INTO journal_lines VALUES (12,1,11);
  `);
  return db;
}

test("løbende årsudtræk og gendannelse håndterer mere end 100 MB originale filer", async () => {
  const db = fixture();
  try {
    const bytes = Buffer.alloc(8 * 1024 * 1024, 65);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const insert = db.prepare("INSERT INTO file_objects VALUES (?,1,'2026-05-01T00:00:00Z','bilag',?,?,?)");
    db.transaction(() => {
      for (let id = 100; id < 113; id++) insert.run(id, `disk:1/${id}.pdf`, bytes.length, sha);
    })();
    const validator = new BookkeepingStreamValidator(1, "2026-01-01");
    let totalBytes = 0;
    for await (const chunk of streamRealBookkeepingYear({ db, companyId: 1,
      fiscalYearStart: "2026-01-01", referenceDate: "2026-10-07",
      fileReader: async (_storage, key) => { assert.match(key, /^1\/\d+\.pdf$/); return bytes; },
    })) {
      totalBytes += chunk.length;
      validator.push(chunk);
    }
    assert.ok(totalBytes > 100 * 1024 * 1024);
    const restored = validator.finish();
    assert.equal(restored.counts.accountingFileObjects, 13);
    assert.equal(restored.counts.journalLines, 1);
    assert.equal(restored.fileCount, 13);
  } finally { db.close(); }
});

test("løbende gendannelse afviser fremmede rækker og manglende fildel", async () => {
  const db = fixture();
  try {
    const bytes = Buffer.from("%PDF-test");
    const sha = createHash("sha256").update(bytes).digest("hex");
    db.prepare("INSERT INTO file_objects VALUES (100,1,'2026-05-01T00:00:00Z','bilag','disk:1/100.pdf',?,?)")
      .run(bytes.length, sha);
    const records: Buffer[] = [];
    for await (const record of streamRealBookkeepingYear({ db, companyId: 1,
      fiscalYearStart: "2026-01-01", referenceDate: "2026-10-07", fileReader: async () => bytes,
    })) records.push(record);
    const missing = new BookkeepingStreamValidator(1, "2026-01-01");
    assert.throws(() => records.filter((record) => !record.toString().includes('"kind":"fileChunk"'))
      .forEach((record) => missing.push(record)), /checksumkontrollen|afbrudt/);
    const foreign = new BookkeepingStreamValidator(1, "2026-01-01");
    const changed = records.map((record) => record.toString().includes('"table":"journalLines"')
      ? Buffer.from(record.toString().replace('"company_id":1', '"company_id":2')) : record);
    assert.throws(() => changed.forEach((record) => foreign.push(record)), /fremmed række/);
    const legacy = new BookkeepingStreamValidator(1, "2026-01-01");
    records.filter((record) => !record.toString().includes('"table":"company"')
        && !record.toString().includes('"table":"businessProfiles"')
        && !record.toString().includes('"table":"customers"'))
      .map((record) => Buffer.from(record.toString().replace("smartregnskab-bookkeeping-stream-v2", "smartregnskab-bookkeeping-stream-v1")))
      .forEach((record) => legacy.push(record));
    assert.equal(legacy.finish().counts.journalEntries, 1);
  } finally { db.close(); }
});
