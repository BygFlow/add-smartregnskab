import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Database from "better-sqlite3";

const migration = readFileSync(
  new URL("../migrations/0021_move_misimported_multiservice_bank.sql", import.meta.url),
  "utf8",
);

function applyMigration(db) {
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

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
