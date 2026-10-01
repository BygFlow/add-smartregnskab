import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { bookkeepingArchiveInventory, verifyBookkeepingOriginals } from "../server/bookkeeping-archive-inventory";

test("archive inventory is company- and fiscal-year-scoped without exporting other tenants", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE companies (id INTEGER PRIMARY KEY);
      CREATE TABLE business_profiles (id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT);
      CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, status TEXT);
      CREATE TABLE journal_lines (id INTEGER PRIMARY KEY, company_id INTEGER, journal_entry_id INTEGER);
      CREATE TABLE invoices (id INTEGER PRIMARY KEY, company_id INTEGER, issue_date TEXT, status TEXT);
      CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER);
      CREATE TABLE vouchers (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, status TEXT);
      CREATE TABLE document_inbox (id INTEGER PRIMARY KEY, company_id INTEGER, posted_journal_entry_id INTEGER,
        matched_voucher_id INTEGER, storage TEXT, storage_key TEXT, content_hash TEXT, status TEXT, created_at TEXT,
        size_bytes INTEGER);
      INSERT INTO companies VALUES (1), (2);
      INSERT INTO business_profiles VALUES (1,1,'2025-04-01'), (2,2,'2025-04-01');
      INSERT INTO journal_entries VALUES (1,1,'2026-02-01','bogført'), (2,2,'2026-02-01','bogført'),
        (3,1,'2025-02-01','bogført'), (4,1,'2026-02-02','kladde');
      INSERT INTO journal_lines VALUES (1,1,1), (2,2,2), (3,1,3);
      INSERT INTO invoices VALUES (1,1,'2026-02-01','sendt'), (2,2,'2026-02-01','sendt'),
        (3,1,'2026-02-01','kladde');
      INSERT INTO invoice_items VALUES (1,1), (2,2), (3,3);
      INSERT INTO vouchers VALUES (1,1,'2026-02-01','bogfoert'), (2,2,'2026-02-01','bogfoert');
      INSERT INTO document_inbox VALUES (1,1,1,NULL,'s3','1/original.pdf','${"a".repeat(64)}','behandlet','2026-02-01',4),
        (2,2,2,NULL,'s3','2/foreign.pdf','${"b".repeat(64)}','behandlet','2026-02-01',4),
        (3,1,NULL,NULL,'s3','1/unmatched.pdf','${"c".repeat(64)}','ny','2026-02-01',4),
        (4,1,NULL,NULL,'s3','1/old.pdf','${"d".repeat(64)}','ny','2025-02-01',4);
    `);
    const inventory = bookkeepingArchiveInventory(db, 1, "2026-02-15");
    assert.equal(inventory.period.start, "2025-04-01");
    assert.deepEqual(inventory.counts, { journalEntries: 1, journalLines: 1,
      invoices: 1, invoiceItems: 1, vouchers: 1, linkedOriginals: 1, unmatchedDocuments: 1 });
    assert.deepEqual(inventory.issues, ["unmatched_documents_require_classification"]);
    assert.equal(inventory.readyForAutomaticArchive, false);
    assert.throws(() => bookkeepingArchiveInventory(db, 3, "2026-02-15"), /ikke fundet/);
  } finally { db.close(); }
});

test("archive inventory blocks missing original references and posted entries without lines", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE companies (id INTEGER PRIMARY KEY);
      CREATE TABLE business_profiles (id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT);
      CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, status TEXT);
      CREATE TABLE journal_lines (id INTEGER PRIMARY KEY, company_id INTEGER, journal_entry_id INTEGER);
      CREATE TABLE invoices (id INTEGER PRIMARY KEY, company_id INTEGER, issue_date TEXT, status TEXT);
      CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER);
      CREATE TABLE vouchers (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, status TEXT);
      CREATE TABLE document_inbox (id INTEGER PRIMARY KEY, company_id INTEGER, posted_journal_entry_id INTEGER,
        matched_voucher_id INTEGER, storage TEXT, storage_key TEXT, content_hash TEXT, status TEXT, created_at TEXT,
        size_bytes INTEGER);
      INSERT INTO companies VALUES (1);
      INSERT INTO business_profiles VALUES (1,1,'2026-01-01');
      INSERT INTO journal_entries VALUES (1,1,'2026-05-01','bogført');
      INSERT INTO document_inbox VALUES (1,1,1,NULL,NULL,NULL,NULL,'behandlet','2026-05-01',NULL);
    `);
    const inventory = bookkeepingArchiveInventory(db, 1, "2026-06-01");
    assert.deepEqual(inventory.issues, ["posted_entries_without_lines", "linked_originals_without_verified_file_reference"]);
  } finally { db.close(); }
});

test("original readback checks bytes and never reads another company's file", async () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE companies (id INTEGER PRIMARY KEY);
      CREATE TABLE business_profiles (id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT);
      CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, status TEXT);
      CREATE TABLE journal_lines (id INTEGER PRIMARY KEY, company_id INTEGER, journal_entry_id INTEGER);
      CREATE TABLE invoices (id INTEGER PRIMARY KEY, company_id INTEGER, issue_date TEXT, status TEXT);
      CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER);
      CREATE TABLE vouchers (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, status TEXT);
      CREATE TABLE document_inbox (id INTEGER PRIMARY KEY, company_id INTEGER, posted_journal_entry_id INTEGER,
        matched_voucher_id INTEGER, storage TEXT, storage_key TEXT, content_hash TEXT, status TEXT, created_at TEXT,
        size_bytes INTEGER);
      INSERT INTO companies VALUES (1), (2);
      INSERT INTO business_profiles VALUES (1,1,'2026-01-01'), (2,2,'2026-01-01');
      INSERT INTO journal_entries VALUES (1,1,'2026-02-01','bogfort'), (2,2,'2026-02-01','bogfort');
      INSERT INTO journal_lines VALUES (1,1,1), (2,2,2);
    `);
    const bytes = Buffer.from("original-bilag");
    const hash = createHash("sha256").update(bytes).digest("hex");
    db.prepare(`INSERT INTO document_inbox VALUES (?, ?, ?, NULL, 's3', ?, ?, 'behandlet', '2026-02-01', ?)`)
      .run(1, 1, 1, "1/original.pdf", hash, bytes.length);
    db.prepare(`INSERT INTO document_inbox VALUES (?, ?, ?, NULL, 's3', ?, ?, 'behandlet', '2026-02-01', ?)`)
      .run(2, 2, 2, "2/foreign.pdf", hash, bytes.length);
    const reads: string[] = [];
    const result = await verifyBookkeepingOriginals(db, 1, "2026-02-01", async (_storage, key) => {
      reads.push(key);
      return bytes;
    });
    assert.deepEqual(reads, ["1/original.pdf"]);
    assert.deepEqual(result.verifiedOriginals, [{ documentId: 1, sha256: hash, sizeBytes: bytes.length }]);
    assert.equal(result.readyForAutomaticArchive, false);
    await assert.rejects(() => verifyBookkeepingOriginals(db, 1, "2026-02-01", async () => Buffer.from("tampered")), /stemmer ikke/);
    db.prepare("UPDATE document_inbox SET storage_key = '2/foreign.pdf' WHERE id = 1").run();
    await assert.rejects(() => verifyBookkeepingOriginals(db, 1, "2026-02-01", async () => bytes), /virksomhedsbundet/);
  } finally { db.close(); }
});
