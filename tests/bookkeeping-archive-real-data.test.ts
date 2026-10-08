import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { collectRealBookkeepingBundle, validateRestoredBookkeepingBundle } from "../server/bookkeeping-archive-real-data";

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE business_profiles (id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT);
    CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, description TEXT);
    CREATE TABLE journal_lines (id INTEGER PRIMARY KEY, company_id INTEGER, journal_entry_id INTEGER, debit REAL);
    CREATE TABLE invoices (id INTEGER PRIMARY KEY, company_id INTEGER, issue_date TEXT, invoice_number TEXT);
    CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER, amount REAL);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, amount REAL);
    CREATE TABLE expense_reports (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, receipt_image TEXT);
    CREATE TABLE file_objects (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, category TEXT, storage_path TEXT, file_size INTEGER, checksum TEXT);
    CREATE TABLE file_versions (id INTEGER PRIMARY KEY, company_id INTEGER, file_id INTEGER, storage_path TEXT, checksum TEXT);
    CREATE TABLE attachments (id INTEGER PRIMARY KEY, company_id INTEGER, storage TEXT, storage_key TEXT, data_url TEXT, size_bytes INTEGER);
    CREATE TABLE archive_records (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, archive_path TEXT);
    CREATE TABLE credit_notes (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, amount REAL);
    CREATE TABLE bank_transactions (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT, amount REAL);
    CREATE TABLE vat_periods (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, period TEXT);
    CREATE TABLE period_closes (id INTEGER PRIMARY KEY, company_id INTEGER, end_date TEXT, status TEXT);
    CREATE TABLE einvoice_queue (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, payload_xml TEXT);
    CREATE TABLE document_inbox (id INTEGER PRIMARY KEY, company_id INTEGER, created_at TEXT, file_name TEXT, storage TEXT, storage_key TEXT,
      posted_journal_entry_id INTEGER, matched_voucher_id INTEGER);
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, company_id INTEGER, account_number TEXT);
    INSERT INTO companies VALUES (1, 'A'), (2, 'B');
    INSERT INTO business_profiles VALUES (1, 1, '2026-01-01'), (2, 2, '2026-01-01');
    INSERT INTO journal_entries VALUES (11, 1, '2026-02-01', 'real'), (22, 2, '2026-02-01', 'other');
    INSERT INTO journal_lines VALUES (111, 1, 11, 100), (222, 2, 22, 200);
    INSERT INTO invoices VALUES (12, 1, '2026-03-01', 'A1'), (23, 2, '2026-03-01', 'B1');
    INSERT INTO invoice_items VALUES (112, 12, 100), (223, 23, 200);
    INSERT INTO vouchers VALUES (13, 1, '2026-04-01', 100), (24, 2, '2026-04-01', 200);
    INSERT INTO expense_reports VALUES (37, 1, '2026-04-05', '39'), (38, 2, '2026-04-05', '40');
    INSERT INTO attachments VALUES (39, 1, 's3', '1/receipt.png', NULL, 7), (40, 2, 's3', '2/receipt.png', NULL, 7);
    INSERT INTO archive_records VALUES (35, 1, '2026-04-01', NULL), (36, 2, '2026-04-01', NULL);
    INSERT INTO credit_notes VALUES (16, 1, '2026-04-01T00:00:00Z', 10), (27, 2, '2026-04-01T00:00:00Z', 20);
    INSERT INTO bank_transactions VALUES (17, 1, '2026-04-02', 100), (28, 2, '2026-04-02', 200);
    INSERT INTO vat_periods VALUES (18, 1, '2026-04-03T00:00:00Z', '2026-Q1'), (29, 2, '2026-04-03T00:00:00Z', '2026-Q1');
    INSERT INTO period_closes VALUES (31, 1, '2026-04-30', 'afsluttet'), (32, 2, '2026-04-30', 'afsluttet');
    INSERT INTO einvoice_queue VALUES (19, 1, '2026-04-04T00:00:00Z', '<Invoice/>'), (30, 2, '2026-04-04T00:00:00Z', '<Other/>');
    INSERT INTO document_inbox VALUES (14, 1, '2026-05-01T12:00:00Z', 'a.pdf', 's3', '1/a.pdf', NULL, NULL),
      (25, 2, '2026-05-01T12:00:00Z', 'b.pdf', 's3', '2/b.pdf', NULL, NULL);
    INSERT INTO accounts VALUES (15, 1, '1000'), (26, 2, '2000');
  `);
  return db;
}

test("virkeligt regnskabsudtræk isolerer selskab og verificerer bilagsbytes", async () => {
  const db = fixture();
  try {
    const result = await collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) => {
      assert.ok(["1/a.pdf", "1/receipt.png"].includes(key));
      return key === "1/a.pdf" ? Buffer.from("%PDF-test") : Buffer.from("receipt");
    });
    assert.equal(result.data.companyId, 1);
    assert.equal(result.data.tables.journalEntries.length, 1);
    assert.equal(result.data.tables.journalLines.length, 1);
    assert.equal(result.data.tables.invoices.length, 1);
    assert.equal(result.data.tables.invoiceItems.length, 1);
    assert.equal(result.data.tables.vouchers.length, 1);
    assert.equal(result.data.tables.archiveRecords.length, 1);
    assert.equal(result.data.tables.expenseReports.length, 1);
    assert.equal(result.data.tables.expenseAttachments.length, 1);
    assert.equal(result.data.expenseFiles.length, 1);
    assert.equal(result.data.tables.creditNotes.length, 1);
    assert.equal(result.data.tables.bankTransactions.length, 1);
    assert.equal(result.data.tables.vatPeriods.length, 1);
    assert.equal(result.data.tables.periodCloses.length, 1);
    assert.equal(result.data.tables.einvoiceQueue.length, 1);
    assert.equal(result.data.files.length, 1);
    assert.equal(Buffer.from(result.data.files[0].bytesBase64, "base64").toString(), "%PDF-test");
    assert.ok(!result.plain.toString().includes("other"));
    assert.ok(!result.plain.toString().includes("b.pdf"));
    assert.equal(validateRestoredBookkeepingBundle(result.plain, 1).fileCount, 2);
    const corrupt = JSON.parse(result.plain.toString());
    corrupt.files[0].bytesBase64 = Buffer.from("tampered").toString("base64");
    assert.throws(() => validateRestoredBookkeepingBundle(Buffer.from(JSON.stringify(corrupt)), 1), /SHA-256/);
    const corruptExpense = JSON.parse(result.plain.toString());
    corruptExpense.expenseFiles[0].bytesBase64 = Buffer.from("tampered").toString("base64");
    assert.throws(() => validateRestoredBookkeepingBundle(Buffer.from(JSON.stringify(corruptExpense)), 1), /SHA-256/);
    assert.throws(() => validateRestoredBookkeepingBundle(result.plain, 2), /forkert format eller virksomhed/);
    const foreignLine = JSON.parse(result.plain.toString());
    foreignLine.tables.journalLines[0].company_id = 2;
    assert.throws(() => validateRestoredBookkeepingBundle(Buffer.from(JSON.stringify(foreignLine)), 1), /fremmede journalLines/);
  } finally { db.close(); }
});

test("arkivering stopper ved manglende originalbilag eller forkert regnskabsår", async () => {
  const db = fixture();
  try {
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async () => { throw new Error("mangler"); }),
      /mangler/,
    );
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-07-01", "2026-10-06", async () => Buffer.from("x")),
      /gemte brancheprofil/,
    );
    db.prepare("UPDATE archive_records SET archive_path=? WHERE company_id=1").run("missing.pdf");
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async () => Buffer.from("x")),
      /ekstern fil/,
    );
    db.prepare("UPDATE archive_records SET archive_path=NULL WHERE company_id=1").run();
    db.prepare("UPDATE attachments SET company_id=2 WHERE id=39").run();
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async () => Buffer.from("x")),
      /anden virksomhed/,
    );
    db.prepare("UPDATE attachments SET company_id=1 WHERE id=39").run();
    db.prepare("INSERT INTO file_objects VALUES (41,1,'2026-06-01T00:00:00Z','bilag','1/extra.pdf',NULL,NULL)").run();
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) =>
        key === "1/receipt.png" ? Buffer.from("receipt") : Buffer.from("%PDF-test")),
      /gyldig, virksomhedsafgrænset originalfil/,
    );
  } finally { db.close(); }
});

test("årsudtrækket afviser en postering med fremmed virksomheds-ID på linjen", async () => {
  const db = fixture();
  try {
    db.prepare("UPDATE journal_lines SET company_id=2 WHERE id=111").run();
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06"),
      /linjer fra en anden virksomhed/,
    );
  } finally { db.close(); }
});

test("bilag modtaget før regnskabsåret følger den senere bogføring uden tenant-læk", async () => {
  const db = fixture();
  try {
    db.prepare(`INSERT INTO document_inbox VALUES
      (51, 1, '2025-12-20T10:00:00Z', 'old-journal.pdf', 's3', '1/old-journal.pdf', 11, NULL),
      (52, 1, '2025-12-21T10:00:00Z', 'old-voucher.pdf', 's3', '1/old-voucher.pdf', NULL, 13),
      (53, 2, '2025-12-22T10:00:00Z', 'foreign.pdf', 's3', '2/foreign.pdf', 11, NULL)`).run();
    const result = await collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) => {
      assert.notEqual(key, "2/foreign.pdf");
      return key === "1/receipt.png" ? Buffer.from("receipt") : Buffer.from(`%PDF-${key}`);
    });
    assert.deepEqual(result.data.tables.documentInbox.map((item) => item.id), [14, 51, 52]);
    assert.equal(validateRestoredBookkeepingBundle(result.plain, 1).fileCount, 4);
  } finally { db.close(); }
});

test("årsudtræk med over 900 posteringer henter alle linjer og tilknyttede bilag", async () => {
  const db = fixture();
  try {
    const insertEntry = db.prepare("INSERT INTO journal_entries VALUES (?,1,'2026-06-01','many')");
    const insertLine = db.prepare("INSERT INTO journal_lines VALUES (?,1,?,100)");
    db.transaction(() => {
      for (let id = 1000; id < 2005; id++) {
        insertEntry.run(id);
        insertLine.run(id + 10000, id);
      }
    })();
    db.prepare(`INSERT INTO document_inbox VALUES
      (70,1,'2025-12-20T00:00:00Z','late.pdf','s3','1/late.pdf',2000,NULL)`).run();
    const result = await collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) =>
      key === "1/receipt.png" ? Buffer.from("receipt") : Buffer.from(`%PDF-${key}`));
    assert.equal(result.data.tables.journalEntries.length, 1006);
    assert.equal(result.data.tables.journalLines.length, 1006);
    assert.deepEqual(result.data.tables.documentInbox.map((item) => item.id), [14, 70]);
    assert.equal(validateRestoredBookkeepingBundle(result.plain, 1).fileCount, 3);
  } finally { db.close(); }
});

test("årsudtrækket medtager filobjekt og version, men afviser opdigtet versionssti", async () => {
  const db = fixture();
  try {
    const bytes = Buffer.from("%PDF-archive-file");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    db.prepare("INSERT INTO file_objects VALUES (41,1,'2026-06-01T00:00:00Z','bilag','s3:1/extra.pdf',?,?)")
      .run(bytes.length, checksum);
    const result = await collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) => {
      if (key === "1/extra.pdf") return bytes;
      if (key === "1/a.pdf") return Buffer.from("%PDF-test");
      if (key === "1/receipt.png") return Buffer.from("receipt");
      throw new Error("forkert fil");
    });
    assert.equal(result.data.fileObjectFiles.length, 1);
    assert.equal(validateRestoredBookkeepingBundle(result.plain, 1).fileCount, 3);
    db.prepare("INSERT INTO file_versions VALUES (42,1,41,'s3:1/version2.pdf',?)").run(checksum);
    const versioned = await collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) => {
      if (key === "1/extra.pdf" || key === "1/version2.pdf") return bytes;
      if (key === "1/a.pdf") return Buffer.from("%PDF-test");
      if (key === "1/receipt.png") return Buffer.from("receipt");
      throw new Error("forkert fil");
    });
    assert.equal(versioned.data.fileObjectVersionFiles.length, 1);
    assert.equal(validateRestoredBookkeepingBundle(versioned.plain, 1).fileCount, 4);
    db.prepare("UPDATE file_versions SET storage_path='/storage/fake.pdf' WHERE id=42").run();
    await assert.rejects(
      collectRealBookkeepingBundle(db, 1, "2026-01-01", "2026-10-06", async (_storage, key) => {
        if (key === "1/extra.pdf") return bytes;
        if (key === "1/a.pdf") return Buffer.from("%PDF-test");
        if (key === "1/receipt.png") return Buffer.from("receipt");
        throw new Error("forkert fil");
      }),
      /gyldig, virksomhedsafgrænset originalfil/,
    );
  } finally { db.close(); }
});
