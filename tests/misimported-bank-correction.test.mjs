import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

const migration = readFileSync(
  new URL("../migrations/0021_move_misimported_multiservice_bank.sql", import.meta.url),
  "utf8",
);
const removalMigration = readFileSync(
  new URL("../migrations/0022_remove_unused_multiclean_bank_import.sql", import.meta.url),
  "utf8",
);
const nullReferenceMigration = readFileSync(
  new URL("../migrations/0023_correct_null_account_ref_imports.sql", import.meta.url),
  "utf8",
);
const label2025ImportsMigration = readFileSync(
  new URL("../migrations/0029_label_2025_bank_imports.sql", import.meta.url),
  "utf8",
);
const removeAiiaTestBankMigration = readFileSync(
  new URL("../migrations/0030_remove_smartdrift_aiia_test_bank.sql", import.meta.url),
  "utf8",
);
const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

function applyMigration(db, sql = migration) {
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

test("production container backs up and migrates the persistent database before startup", () => {
  assert.match(
    dockerfile,
    /node scripts\/migrate-sqlite-prod\.mjs && exec node dist\/index\.cjs/,
  );
});

test("only the approved fresh 2024 bank imports move from SmartDrift to Multi Service", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES
      (1, 'ADD SmartDrift ApS', '11111111'),
      (2, 'ADD Multi Service ApS', '44822539'),
      (3, 'Anden virksomhed', '22222222');
    INSERT INTO bank_transactions (id, company_id, date, provider, account_ref, external_id, imported_at) VALUES
      (10, 1, '2024-07-22', 'danske-bank', '13424713', 'move-1', '2026-11-06T12:00:00.000Z'),
      (11, 1, '2024-12-02', 'danske-bank', '13800707', 'move-2', '2026-11-06T12:01:00.000Z'),
      (12, 1, '2024-12-03', 'danske-bank', '13800707', 'duplicate', '2026-11-06T12:01:00.000Z'),
      (13, 2, '2024-12-03', 'danske-bank', '13800707', 'duplicate', '2026-11-06T11:00:00.000Z'),
      (14, 1, '2024-07-23', 'danske-bank', '13424713', 'old-import', '2026-11-05T12:00:00.000Z'),
      (15, 1, '2025-01-02', 'danske-bank', '13800707', 'wrong-year', '2026-11-06T12:00:00.000Z'),
      (16, 3, '2024-07-22', 'danske-bank', '13424713', 'other-tenant', '2026-11-06T12:00:00.000Z');
  `);

  applyMigration(db);

  assert.deepEqual(
    db.prepare("SELECT id, company_id FROM bank_transactions ORDER BY id").all(),
    [
      { id: 10, company_id: 2 },
      { id: 11, company_id: 2 },
      { id: 13, company_id: 2 },
      { id: 14, company_id: 1 },
      { id: 15, company_id: 1 },
      { id: 16, company_id: 3 },
    ],
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'bank_import_company_correction'").get().count,
    1,
  );
  db.close();
});

test("customer-approved removal deletes only the fresh unused MultiClean import", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES
      (1, 'ADD SmartDrift ApS', '11111111'),
      (2, 'ADD Multi Service ApS', '44822539'),
      (3, 'Anden virksomhed', '22222222');
    INSERT INTO bank_transactions (id, company_id, date, provider, account_ref, external_id, imported_at) VALUES
      (20, 1, '2024-07-22', 'danske-bank', '13424713', 'delete-smartdrift', '2026-11-06T12:00:00.000Z'),
      (21, 2, '2024-07-23', 'danske-bank', '13424713', 'delete-service', '2026-11-06T12:00:00.000Z'),
      (23, 2, '2024-12-02', 'danske-bank', '13800707', 'keep-multiservice', '2026-11-06T12:00:00.000Z'),
      (24, 2, '2024-07-25', 'danske-bank', '13424713', 'keep-old-import', '2026-11-05T12:00:00.000Z'),
      (25, 3, '2024-07-22', 'danske-bank', '13424713', 'keep-other-tenant', '2026-11-06T12:00:00.000Z');
  `);

  applyMigration(db, removalMigration);

  assert.deepEqual(
    db.prepare("SELECT id, company_id, account_ref FROM bank_transactions ORDER BY id").all(),
    [
      { id: 23, company_id: 2, account_ref: "13800707" },
      { id: 24, company_id: 2, account_ref: "13424713" },
      { id: 25, company_id: 3, account_ref: "13424713" },
    ],
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'bank_import_deleted'").get().count,
    1,
  );
  db.close();
});

test("null-reference imports are separated by their exact observed import windows", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES
      (1, 'ADD SmartDrift ApS', '46761898'),
      (2, 'ADD Multi Service ApS', '44822539'),
      (3, 'Anden virksomhed', '22222222');
    INSERT INTO bank_transactions (id, company_id, date, provider, account_ref, external_id, imported_at) VALUES
      (30, 1, '2024-07-22', 'danske-bank', NULL, 'danske-bank||old-clean-1', '2026-11-06T17:19:52.617Z'),
      (31, 1, '2024-11-21', 'danske-bank', NULL, 'danske-bank||old-clean-2', '2026-11-06T17:19:53.397Z'),
      (32, 1, '2024-12-02', 'danske-bank', NULL, 'danske-bank||service-1', '2026-11-06T17:20:13.214Z'),
      (33, 1, '2024-12-31', 'danske-bank', NULL, 'danske-bank||service-2', '2026-11-06T17:20:13.235Z'),
      (34, 1, '2024-12-03', 'danske-bank', NULL, 'danske-bank||other-time', '2026-11-06T17:20:14.000Z'),
      (35, 3, '2024-07-22', 'danske-bank', NULL, 'danske-bank||other-company', '2026-11-06T17:19:52.700Z'),
      (36, 1, '2024-07-22', 'danske-bank', 'already-labelled', 'danske-bank|labelled|row', '2026-11-06T17:19:52.800Z');
  `);

  applyMigration(db, nullReferenceMigration);

  assert.deepEqual(
    db.prepare("SELECT id, company_id, account_ref FROM bank_transactions ORDER BY id").all(),
    [
      { id: 32, company_id: 2, account_ref: "13800707" },
      { id: 33, company_id: 2, account_ref: "13800707" },
      { id: 34, company_id: 1, account_ref: null },
      { id: 35, company_id: 3, account_ref: null },
      { id: 36, company_id: 1, account_ref: "already-labelled" },
    ],
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_logs").get().count, 2);
  db.close();
});

test("2025 import batches receive only their customer-confirmed bank references", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT,
      status TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES
      (1, 'ADD Multi Service ApS', '44822539'),
      (2, 'Anden virksomhed', '22222222');
    INSERT INTO bank_transactions (id, company_id, date, provider, account_ref, external_id, status, imported_at) VALUES
      (1, 1, '2025-01-01', 'csv', NULL, 'drift', 'afventer', '2026-11-07T12:49:32.001Z'),
      (2, 1, '2025-02-01', 'csv', NULL, 'payroll', 'afventer', '2026-11-07T12:50:09.001Z'),
      (3, 1, '2025-03-01', 'csv', NULL, 'marketing', 'afventer', '2026-11-07T12:51:28.001Z'),
      (4, 1, '2025-04-01', 'csv', NULL, 'danske-2025', 'afventer', '2026-11-07T12:52:42.001Z'),
      (5, 1, '2024-12-02', 'csv', NULL, 'danske-duplicate', 'ignoreret', '2026-11-07T12:50:34.500Z'),
      (6, 1, '2025-01-01', 'csv', NULL, 'outside-window', 'afventer', '2026-11-07T12:49:34.000Z'),
      (7, 2, '2025-01-01', 'csv', NULL, 'other-company', 'afventer', '2026-11-07T12:49:32.001Z'),
      (8, 1, '2025-01-01', 'csv', 'existing', 'already-labelled', 'afventer', '2026-11-07T12:49:32.001Z');
  `);

  applyMigration(db, label2025ImportsMigration);
  applyMigration(db, label2025ImportsMigration);

  assert.deepEqual(
    db.prepare("SELECT id, account_ref FROM bank_transactions ORDER BY id").all(),
    [
      { id: 1, account_ref: "0112" },
      { id: 2, account_ref: "4483" },
      { id: 3, account_ref: "9278" },
      { id: 4, account_ref: "13800707" },
      { id: 5, account_ref: "13800707" },
      { id: 6, account_ref: null },
      { id: 7, account_ref: null },
      { id: 8, account_ref: "existing" },
    ],
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'bank_import_accounts_labelled'").get().count, 1);
  db.close();
});

test("customer-approved cleanup deletes exactly the 972 SmartDrift AiiA test rows", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES
      (1, 'ADD SmartDrift ApS', '46761898'),
      (2, 'Anden virksomhed', '22222222');
  `);
  const accountRef = "MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8SGllbFB2d21iTnp0cFJibUVfWVJnTVJnMXUxMGRzZVd4dzNGTDVSSDRMOC4xNjZlZjcwMDVjOGI=";
  const secondAccountRef = "MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8UnRvQUdPeHFlMk5nLUhUS09SZFVWMG1DWkdFYUdmLWQyWjZWVVNnTDRicy5jODFjMDE4MzFhOGY=";
  const insert = db.prepare("INSERT INTO bank_transactions (id, company_id, provider, account_ref, external_id) VALUES (?, ?, ?, ?, ?)");
  const seed = db.transaction(() => {
    for (let id = 1; id <= 799; id += 1) {
      insert.run(id, 1, "aiia", accountRef, `aiia:${accountRef}:test-${id}`);
    }
    for (let id = 800; id <= 972; id += 1) {
      insert.run(id, 1, "aiia", secondAccountRef, `aiia:${secondAccountRef}:test-${id}`);
    }
    insert.run(973, 1, "csv", "0112", "real-smartdrift-row");
    insert.run(974, 2, "aiia", accountRef, `aiia:${accountRef}:other-company`);
  });
  seed();

  applyMigration(db, removeAiiaTestBankMigration);

  assert.deepEqual(
    db.prepare("SELECT id, company_id, provider FROM bank_transactions ORDER BY id").all(),
    [
      { id: 973, company_id: 1, provider: "csv" },
      { id: 974, company_id: 2, provider: "aiia" },
    ],
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'aiia_test_bank_deleted'").get().count,
    1,
  );
  db.close();
});

test("AiiA test cleanup fails closed for an unexpected partial batch", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES (1, 'ADD SmartDrift ApS', '46761898');
  `);
  const accountRef = "MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8SGllbFB2d21iTnp0cFJibUVfWVJnTVJnMXUxMGRzZVd4dzNGTDVSSDRMOC4xNjZlZjcwMDVjOGI=";
  db.prepare("INSERT INTO bank_transactions (id, company_id, provider, account_ref, external_id) VALUES (1, 1, 'aiia', ?, ?)")
    .run(accountRef, `aiia:${accountRef}:partial`);

  assert.throws(() => applyMigration(db, removeAiiaTestBankMigration), /CHECK constraint failed/);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bank_transactions").get().count, 1);
  db.close();
});

test("partially journalled legacy production database runs approved corrections exactly once", () => {
  const directory = mkdtempSync(join(tmpdir(), "smartregnskab-legacy-bank-fix-"));
  const databasePath = join(directory, "data.db");
  const backupDir = join(directory, "backups");
  const db = new Database(databasePath);
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cvr TEXT);
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    );
    INSERT INTO __drizzle_migrations (hash, created_at) VALUES
      ('0000-applied', 1788808682459),
      ('0000-duplicate-legacy-record', 1788808682459);
    CREATE TABLE ai_decision_logs (id INTEGER PRIMARY KEY);
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      provider TEXT,
      account_ref TEXT,
      external_id TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO companies (id, name, cvr) VALUES
      (1, 'ADD SmartDrift ApS', '46761898'),
      (2, 'ADD Multi Service ApS', '44822539');
    INSERT INTO bank_transactions (id, company_id, date, provider, account_ref, external_id, imported_at) VALUES
      (1, 1, '2024-07-22', 'danske-bank', '13424713', 'remove-old-clean', '2026-11-06T12:00:00.000Z'),
      (2, 1, '2024-12-02', 'danske-bank', '13800707', 'keep-service', '2026-11-06T12:00:00.000Z');
  `);
  db.close();

  const run = () => execFileSync(process.execPath, ["scripts/migrate-sqlite-prod.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: databasePath, BACKUP_DIR: backupDir },
    encoding: "utf8",
  });

  try {
    assert.match(run(), /Ældre produktionsdatabase fundet/);
    assert.match(run(), /Migrering fuldført/);

    const checked = new Database(databasePath, { readonly: true });
    try {
      assert.deepEqual(
        checked.prepare("SELECT id, company_id, account_ref FROM bank_transactions ORDER BY id").all(),
        [{ id: 2, company_id: 2, account_ref: "13800707" }],
      );
      assert.equal(checked.prepare("SELECT COUNT(*) AS count FROM add_legacy_migrations").get().count, 5);
      assert.equal(checked.prepare("SELECT COUNT(*) AS count FROM audit_logs").get().count, 2);
    } finally {
      checked.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
