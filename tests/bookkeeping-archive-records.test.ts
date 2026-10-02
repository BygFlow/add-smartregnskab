import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { buildBookkeepingRecordBundle, captureBookkeepingRecordCandidate,
  verifyBookkeepingRecordCandidateReceipt } from "../server/bookkeeping-archive-records";
import { captureBookkeepingArchiveCandidate, verifyBookkeepingArchiveCandidate } from "../server/bookkeeping-archive-candidate";
import { storeLockedArchiveObject } from "../server/bookkeeping-archive-object";
import type { ArchiveBucketConfig } from "../server/bookkeeping-archive-readiness";

const config: ArchiveBucketConfig = { bucket: "archive", backupBucket: "backup", region: "eu-central",
  endpoint: "https://nbg1.your-objectstorage.com", accessKeyId: "test", secretAccessKey: "test" };

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT, cvr TEXT, currency TEXT);
    CREATE TABLE business_profiles (id INTEGER PRIMARY KEY, company_id INTEGER, fiscal_year_start TEXT,
      currency TEXT, reporting_standard TEXT, vat_setup TEXT);
    CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, company_id INTEGER, entry_number TEXT, date TEXT,
      description TEXT, reference TEXT, source_type TEXT, source_id INTEGER, status TEXT, created_by TEXT, created_at TEXT);
    CREATE TABLE journal_lines (id INTEGER PRIMARY KEY, company_id INTEGER, journal_entry_id INTEGER,
      account_id INTEGER, description TEXT, debit REAL, credit REAL, vat_code TEXT);
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, company_id INTEGER, account_number TEXT,
      standard_account_number TEXT, name TEXT, type TEXT, vat_code TEXT);
    CREATE TABLE invoices (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      invoice_number TEXT, status TEXT, issue_date TEXT, due_date TEXT, net_amount REAL, vat_rate REAL,
      vat_amount REAL, total_amount REAL, payment_terms INTEGER, sent_at TEXT, paid_at TEXT,
      credited_amount REAL, paid_amount REAL, notes TEXT);
    CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER, description TEXT,
      quantity REAL, unit_price REAL, amount REAL, vat_rate REAL);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, address TEXT,
      customer_number TEXT, cvr TEXT, ean TEXT, invoice_email TEXT, payment_terms TEXT, portal_token TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, company_id INTEGER, voucher_number TEXT, supplier TEXT,
      date TEXT, amount REAL, vat_amount REAL, vat_rate REAL, description TEXT, category TEXT,
      account_id TEXT, status TEXT, created_at TEXT);
    CREATE TABLE document_inbox (id INTEGER PRIMARY KEY, company_id INTEGER, file_name TEXT, file_type TEXT,
      storage TEXT, storage_key TEXT, size_bytes INTEGER, content_hash TEXT, sender_email TEXT,
      posted_journal_entry_id INTEGER, matched_voucher_id INTEGER, source TEXT, invoice_date TEXT,
      invoice_number TEXT, status TEXT, created_at TEXT);
    CREATE TABLE credit_notes (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      invoice_id INTEGER, credit_number TEXT, amount REAL, reason TEXT, status TEXT, created_at TEXT);
    CREATE TABLE bank_transactions (id INTEGER PRIMARY KEY, company_id INTEGER, date TEXT,
      description TEXT, amount REAL, balance REAL, provider TEXT, account_ref TEXT, external_id TEXT,
      matched_type TEXT, matched_id INTEGER, status TEXT, imported_at TEXT);
    CREATE TABLE period_closes (id INTEGER PRIMARY KEY, company_id INTEGER, period_type TEXT,
      period_label TEXT, start_date TEXT, end_date TEXT, status TEXT, checklist TEXT, closed_by TEXT,
      closed_at TEXT, created_at TEXT);
    CREATE TABLE vat_periods (id INTEGER PRIMARY KEY, company_id INTEGER, period TEXT, vat_type TEXT,
      output_vat REAL, input_vat REAL, net_vat REAL, status TEXT, reported_at TEXT, created_at TEXT);
    INSERT INTO companies VALUES (1,'One ApS','11111111','DKK'), (2,'Two ApS','22222222','DKK');
    INSERT INTO business_profiles VALUES (1,1,'2026-01-01','DKK','standard','almindelig'),
      (2,2,'2026-01-01','DKK','standard','almindelig');
    INSERT INTO accounts VALUES (1,1,'1000','1000','Bank','aktiv',NULL),
      (2,2,'1000','1000','Other Bank','aktiv',NULL);
    INSERT INTO journal_entries VALUES (1,1,'1','2026-04-01','Sale',NULL,'faktura',1,'bogført','user','2026-04-01'),
      (2,2,'1','2026-04-01','Other',NULL,'faktura',2,'bogført','other','2026-04-01');
    INSERT INTO journal_lines VALUES (1,1,1,1,'Bank',100,0,NULL), (2,2,2,2,'Other',200,0,NULL);
    INSERT INTO customers VALUES (1,1,'Customer A','Address','C1','33333333',NULL,'a@example.test',NULL,'SECRET'),
      (2,2,'Customer B','Address','C2','44444444',NULL,'b@example.test',NULL,'OTHERSECRET');
    INSERT INTO invoices (id,company_id,customer_id,invoice_number,status,issue_date,net_amount,total_amount)
      VALUES (1,1,1,'F1','sendt','2026-04-01',100,125), (2,2,2,'F2','sendt','2026-04-01',200,250);
    INSERT INTO invoice_items VALUES (1,1,'Work',1,100,100,25), (2,2,'Other',1,200,200,25);
    INSERT INTO vouchers (id,company_id,voucher_number,date,status) VALUES (1,1,'V1','2026-04-01','bogfoert'),
      (2,2,'V2','2026-04-01','bogfoert');
    INSERT INTO document_inbox (id,company_id,file_name,storage,storage_key,size_bytes,content_hash,
      posted_journal_entry_id,status,created_at) VALUES
      (1,1,'a.pdf','s3','1/a.pdf',5,'${"a".repeat(64)}',1,'behandlet','2026-04-01'),
      (2,2,'b.pdf','s3','2/b.pdf',5,'${"b".repeat(64)}',2,'behandlet','2026-04-01');
    INSERT INTO credit_notes (id,company_id,customer_id,invoice_id,credit_number,amount,status,created_at)
      VALUES (1,1,1,1,'K1',20,'bogfort','2026-04-02'), (2,2,2,2,'K2',30,'bogfort','2026-04-02');
    INSERT INTO bank_transactions (id,company_id,date,amount,status,imported_at)
      VALUES (1,1,'2026-04-03',125,'matchet','2026-04-03'), (2,2,'2026-04-03',250,'matchet','2026-04-03');
    INSERT INTO period_closes (id,company_id,start_date,end_date,status,created_at)
      VALUES (1,1,'2026-01-01','2026-12-31','afsluttet','2026-12-31'),
      (2,2,'2026-01-01','2026-12-31','afsluttet','2026-12-31');
    INSERT INTO vat_periods (id,company_id,period,status,reported_at,created_at)
      VALUES (1,1,'2026-Q2','indberettet','2026-07-01','2026-07-01'),
      (2,2,'2026-Q2','indberettet','2026-07-01','2026-07-01');
  `);
  return db;
}

test("record candidate is deterministic, tenant-scoped and omits portal credentials", () => {
  const db = fixture();
  try {
    const first = buildBookkeepingRecordBundle(db, 1, "2026-04-01");
    const second = buildBookkeepingRecordBundle(db, 1, "2026-04-01");
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.bundle.completeBookkeepingArchive, false);
    for (const key of ["journalEntries", "journalLines", "accounts", "invoices", "invoiceItems",
      "customers", "vouchers", "documents", "creditNotes", "bankTransactions", "periodCloses", "vatPeriods"] as const) {
      assert.equal(first.bundle[key].length, 1, key);
      assert.equal(first.bundle[key][0].company_id ?? 1, 1, key);
    }
    assert.ok(!first.bytes.toString("utf8").includes("SECRET"));
    assert.ok(!first.bytes.toString("utf8").includes("Two ApS"));
  } finally { db.close(); }
});

test("record candidate rejects a reference to another tenant", () => {
  const db = fixture();
  try {
    db.prepare("UPDATE journal_lines SET account_id = 2 WHERE id = 1").run();
    assert.throws(() => buildBookkeepingRecordBundle(db, 1, "2026-04-01"), /anden virksomhed/);
    db.prepare("UPDATE journal_lines SET account_id = 1 WHERE id = 1").run();
    db.prepare("UPDATE invoices SET customer_id = 2 WHERE id = 1").run();
    assert.throws(() => buildBookkeepingRecordBundle(db, 1, "2026-04-01"), /anden virksomhed/);
    db.prepare("UPDATE invoices SET customer_id = 1 WHERE id = 1").run();
    db.prepare("UPDATE credit_notes SET invoice_id = 2 WHERE id = 1").run();
    assert.throws(() => buildBookkeepingRecordBundle(db, 1, "2026-04-01"), /anden virksomhed/);
  } finally { db.close(); }
});

test("record candidate has a locked-object receipt but remains explicitly incomplete", async () => {
  const db = fixture();
  try {
    const result = await captureBookkeepingRecordCandidate({ snapshot: db, companyId: 1,
      referenceDate: "2026-04-01", config, encryptionSecret: "a".repeat(64),
      now: new Date("2026-10-02T00:00:00Z") }, async (input) => {
      assert.match(input.key, /^companies\/1\/fiscal-years\/2026-01-01\/records\/candidate-[a-f0-9]{64}\.json$/);
      assert.equal(JSON.parse(input.plain.toString("utf8")).completeBookkeepingArchive, false);
      return { bucket: input.config.bucket, objectKey: input.key, versionId: "v1",
        sha256: input.key.match(/candidate-([a-f0-9]{64})/)![1], plainBytes: input.plain.length,
        retainUntil: input.retainUntil, verified: true };
    });
    assert.equal(result.completeBookkeepingArchive, false);
    assert.equal(result.receipt.versionId, "v1");
  } finally { db.close(); }
});

test("candidate readback rejects cross-company or truncated archive data", async () => {
  const db = fixture();
  try {
    const { bytes, sha256 } = buildBookkeepingRecordBundle(db, 1, "2026-04-01");
    const receipt = { bucket: config.bucket,
      objectKey: `companies/1/fiscal-years/2026-01-01/records/candidate-${sha256}.json`,
      versionId: "v1", sha256, plainBytes: bytes.length,
      retainUntil: "2031-12-31T23:59:59.999Z", verified: true };
    const input = { config, receipt, encryptionSecret: "a".repeat(64),
      companyId: 1, fiscalYearStart: "2026-01-01" };
    const valid = await verifyBookkeepingRecordCandidateReceipt(input, async () => bytes);
    assert.equal(valid.verified, true);
    assert.equal(valid.completeBookkeepingArchive, false);
    const corrupted = JSON.parse(bytes.toString("utf8"));
    corrupted.journalLines = [];
    await assert.rejects(() => verifyBookkeepingRecordCandidateReceipt(input,
      async () => Buffer.from(JSON.stringify(corrupted))), /journalLines/);
    corrupted.journalLines = JSON.parse(bytes.toString("utf8")).journalLines;
    corrupted.customers[0].company_id = 2;
    await assert.rejects(() => verifyBookkeepingRecordCandidateReceipt(input,
      async () => Buffer.from(JSON.stringify(corrupted))), /anden virksomhed/);
    await assert.rejects(() => verifyBookkeepingRecordCandidateReceipt({ ...input, companyId: 2 },
      async () => bytes), /forkert virksomhed/);
  } finally { db.close(); }
});

test("combined candidate captures and reads back records plus own originals, still marked incomplete", async () => {
  const db = fixture();
  try {
    const original = Buffer.from("hello");
    const originalHash = (await import("node:crypto")).createHash("sha256").update(original).digest("hex");
    db.prepare("UPDATE document_inbox SET content_hash = ? WHERE id = 1").run(originalHash);
    const objects = new Map<string, Buffer>();
    let nextVersion = 0;
    const store = async (item: Parameters<typeof storeLockedArchiveObject>[0]) => {
      const versionId = `v${++nextVersion}`;
      objects.set(`${item.key}@${versionId}`, item.plain);
      return { bucket: item.config.bucket, objectKey: item.key, versionId,
        sha256: (await import("node:crypto")).createHash("sha256").update(item.plain).digest("hex"),
        plainBytes: item.plain.length, retainUntil: item.retainUntil, verified: true };
    };
    const result = await captureBookkeepingArchiveCandidate({ snapshot: db, companyId: 1,
      referenceDate: "2026-04-01", readOriginal: async (_storage, key) => {
        assert.equal(key, "1/a.pdf"); return original;
      }, config, encryptionSecret: "a".repeat(64), now: new Date("2026-10-02T00:00:00Z") }, store);
    assert.equal(objects.size, 4); // candidate records, original, original manifest, combined manifest
    const restored = await verifyBookkeepingArchiveCandidate({ config, encryptionSecret: "a".repeat(64),
      companyId: 1, fiscalYearStart: "2026-01-01", manifestReceipt: result.manifestReceipt },
    async ({ receipt }) => {
      const bytes = objects.get(`${receipt.objectKey}@${receipt.versionId}`);
      if (!bytes) throw new Error("missing object");
      return bytes;
    });
    assert.equal(restored.verified, true);
    assert.equal(restored.originalCount, 1);
    assert.equal(restored.completeBookkeepingArchive, false);
    db.prepare("UPDATE invoices SET customer_id = 2 WHERE id = 1").run();
    await assert.rejects(() => captureBookkeepingArchiveCandidate({ snapshot: db, companyId: 1,
      referenceDate: "2026-04-01", readOriginal: async () => original,
      config, encryptionSecret: "a".repeat(64) }, store), /anden virksomhed/);
    assert.equal(objects.size, 4);
  } finally { db.close(); }
});
