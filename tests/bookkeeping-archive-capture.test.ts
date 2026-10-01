import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { captureBookkeepingOriginals } from "../server/bookkeeping-archive-capture";
import type { ArchiveBucketConfig } from "../server/bookkeeping-archive-readiness";

const config: ArchiveBucketConfig = {
  bucket: "archive", backupBucket: "backup", region: "eu-central",
  endpoint: "https://nbg1.your-objectstorage.com", accessKeyId: "test", secretAccessKey: "test",
};

function fixture() {
  const db = new Database(":memory:");
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
    INSERT INTO journal_entries VALUES (1,1,'2026-04-01','bogført'), (2,2,'2026-04-01','bogført');
    INSERT INTO journal_lines VALUES (1,1,1), (2,2,2);
  `);
  const bytes = Buffer.from("original-pdf-test");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const insert = db.prepare(`INSERT INTO document_inbox VALUES (?, ?, ?, NULL, 's3', ?, ?, 'behandlet', '2026-04-01', ?)`);
  insert.run(1, 1, 1, "1/original.pdf", hash, bytes.length);
  insert.run(2, 2, 2, "2/foreign.pdf", hash, bytes.length);
  return { db, bytes, hash };
}

test("capture locks only own verified originals and a manifest marked incomplete", async () => {
  const { db, bytes, hash } = fixture();
  try {
    const stored: Array<{ key: string; plain: Buffer }> = [];
    const readKeys: string[] = [];
    const result = await captureBookkeepingOriginals({
      snapshot: db, companyId: 1, referenceDate: "2026-04-01", config,
      encryptionSecret: "a".repeat(64), now: new Date("2026-10-01T00:00:00Z"),
      readOriginal: async (_storage, key) => { readKeys.push(key); return bytes; },
    }, async (input) => {
      stored.push({ key: input.key, plain: input.plain });
      return { bucket: input.config.bucket, objectKey: input.key, versionId: `v${stored.length}`,
        sha256: createHash("sha256").update(input.plain).digest("hex"), plainBytes: input.plain.length,
        retainUntil: input.retainUntil, verified: true };
    });
    assert.deepEqual(readKeys, ["1/original.pdf"]);
    assert.equal(stored.length, 2);
    assert.match(stored[0].key, new RegExp(`^companies/1/fiscal-years/2026-01-01/originals/document-1-${hash}\\.bin$`));
    assert.ok(stored[0].plain.equals(bytes));
    const manifest = JSON.parse(stored[1].plain.toString("utf8"));
    assert.equal(manifest.completeBookkeepingArchive, false);
    assert.deepEqual(manifest.originals.map((item: { documentId: number }) => item.documentId), [1]);
    assert.equal(result.completeBookkeepingArchive, false);
    assert.equal(result.originals[0].receipt.versionId, "v1");
  } finally { db.close(); }
});

test("capture refuses unclassified documents and changed originals before any upload", async () => {
  const { db, bytes } = fixture();
  try {
    let calls = 0;
    const store = async (_input: any): Promise<any> => { calls++; throw new Error("should not upload"); };
    db.prepare(`INSERT INTO document_inbox VALUES (3, 1, NULL, NULL, 's3', '1/unmatched.pdf', ?, 'ny', '2026-04-02', ?)`)
      .run("a".repeat(64), bytes.length);
    const input = { snapshot: db, companyId: 1, referenceDate: "2026-04-01", config,
      encryptionSecret: "a".repeat(64), readOriginal: async () => bytes };
    await assert.rejects(() => captureBookkeepingOriginals(input, store), /unmatched_documents/);
    assert.equal(calls, 0);
    db.prepare("DELETE FROM document_inbox WHERE id = 3").run();
    await assert.rejects(() => captureBookkeepingOriginals({ ...input,
      readOriginal: async () => Buffer.from("changed") }, store), /stemmer ikke/);
    assert.equal(calls, 0);
  } finally { db.close(); }
});
