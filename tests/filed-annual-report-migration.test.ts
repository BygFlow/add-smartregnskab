import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const migrationSql = readFileSync(
  new URL("../migrations/0024_register_filed_2024_annual_reports.sql", import.meta.url),
  "utf8",
);

function runMigration(db: Database.Database) {
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  db.transaction(() => statements.forEach((statement) => db.exec(statement)))();
}

test("registrerer de indsendte 2024-årsrapporter idempotent og med revisionsspor", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (
      id integer PRIMARY KEY,
      name text NOT NULL,
      cvr text
    );
    CREATE TABLE annual_reports (
      id integer PRIMARY KEY AUTOINCREMENT,
      company_id integer NOT NULL,
      year integer NOT NULL,
      result real NOT NULL DEFAULT 0,
      tax_result real NOT NULL DEFAULT 0,
      balance_total real NOT NULL DEFAULT 0,
      equity real NOT NULL DEFAULT 0,
      xbrl_status text NOT NULL DEFAULT 'ikke_genereret',
      auditor_package text,
      status text NOT NULL DEFAULT 'kladde',
      submitted_to_erhvervsstyrelsen integer NOT NULL DEFAULT 0,
      created_at text NOT NULL
    );
    CREATE TABLE audit_logs (
      id integer PRIMARY KEY AUTOINCREMENT,
      company_id integer,
      user_id integer,
      user_email text,
      action text NOT NULL,
      target text NOT NULL,
      detail text,
      created_at text NOT NULL
    );
    INSERT INTO companies VALUES
      (1, 'ADD Multi Service ApS', '44822539'),
      (2, 'ADD Group ApS', '44 81 85 66'),
      (3, 'Anden virksomhed', '12345678');
  `);

  runMigration(db);

  const reports = db.prepare(`
    SELECT company_id AS companyId, year, result, tax_result AS taxResult,
           balance_total AS balanceTotal, equity, status,
           submitted_to_erhvervsstyrelsen AS submitted
    FROM annual_reports ORDER BY company_id
  `).all() as Array<Record<string, unknown>>;

  assert.deepEqual(reports, [
    {
      companyId: 1,
      year: 2024,
      result: -134_428,
      taxResult: 37_662,
      balanceTotal: 183_252,
      equity: -94_428,
      status: "indsendt",
      submitted: 1,
    },
    {
      companyId: 2,
      year: 2024,
      result: -4_875,
      taxResult: 1_375,
      balanceTotal: 41_375,
      equity: 35_125,
      status: "indsendt",
      submitted: 1,
    },
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_logs").get().count, 2);

  db.close();
});
