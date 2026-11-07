import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { buildAccountingReport } from "../server/accounting-reports";

const migrationSql = readFileSync(
  new URL("../migrations/0025_reconcile_filed_2024_reports.sql", import.meta.url),
  "utf8",
);

function runMigration(db: Database.Database) {
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  db.transaction(() => statements.forEach((statement) => db.exec(statement)))();
}

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id integer PRIMARY KEY, name text NOT NULL, cvr text);
    CREATE TABLE accounts (
      id integer PRIMARY KEY AUTOINCREMENT,
      company_id integer NOT NULL,
      account_number text NOT NULL,
      standard_account_number text,
      name text NOT NULL,
      type text NOT NULL,
      vat_code text,
      balance real NOT NULL DEFAULT 0,
      active integer NOT NULL DEFAULT 1,
      created_at text NOT NULL
    );
    CREATE TABLE journal_entries (
      id integer PRIMARY KEY AUTOINCREMENT,
      company_id integer NOT NULL,
      entry_number text NOT NULL,
      date text NOT NULL,
      description text NOT NULL,
      reference text,
      source_type text,
      source_id integer,
      status text NOT NULL DEFAULT 'kladde',
      created_by text,
      created_at text NOT NULL,
      UNIQUE(company_id, entry_number)
    );
    CREATE TABLE journal_lines (
      id integer PRIMARY KEY AUTOINCREMENT,
      company_id integer NOT NULL,
      journal_entry_id integer NOT NULL,
      account_id integer NOT NULL,
      description text,
      debit real NOT NULL DEFAULT 0,
      credit real NOT NULL DEFAULT 0,
      vat_code text
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
    CREATE TABLE annual_reports (
      id integer PRIMARY KEY AUTOINCREMENT,
      company_id integer NOT NULL,
      year integer NOT NULL,
      result real NOT NULL
    );
    INSERT INTO companies VALUES
      (1, 'ADD Multi Service ApS', '44822539'),
      (2, 'ADD Group ApS', '44 81 85 66');
    INSERT INTO annual_reports (company_id, year, result) VALUES
      (1, 2024, -134428),
      (2, 2024, -4875);

    INSERT INTO accounts (company_id, account_number, name, type, balance, active, created_at) VALUES
      (1, '1010', 'Salg', 'indtaegt', 0, 1, '2024-01-01'),
      (1, '4998', 'Øvrige udgifter', 'udgift', 0, 1, '2024-01-01'),
      (1, '5222', 'Driftsmidler, årets tilgang', 'aktiv', 0, 1, '2024-01-01'),
      (1, '5660', 'Forudbetalte poster', 'aktiv', 0, 1, '2024-01-01'),
      (1, '6903', 'Indgående moms', 'aktiv', 0, 1, '2024-01-01'),
      (1, '6110', 'Anpartskapital', 'passiv', 0, 1, '2024-01-01'),
      (1, '6999', 'Øvrige gældsforpligtelser', 'passiv', 0, 1, '2024-01-01');

    INSERT INTO journal_entries (company_id, entry_number, date, description, status, created_at)
      VALUES (1, 'RAW-2024', '2024-12-31', 'Sammenfattet e-conomic-import', 'bogført', '2024-12-31');
    INSERT INTO journal_lines (company_id, journal_entry_id, account_id, debit, credit) VALUES
      (1, 1, 1, 0, 58779.98),
      (1, 1, 2, 203315.07, 0),
      (1, 1, 3, 93000.00, 0),
      (1, 1, 4, 24260.87, 0),
      (1, 1, 5, 29884.40, 0),
      (1, 1, 6, 0, 40000.00),
      (1, 1, 7, 0, 251680.36);
  `);
  return db;
}

function report(db: Database.Database, companyId: number, filedResult: number) {
  const rows = (table: string) => db.prepare(`SELECT * FROM ${table} WHERE company_id = ?`).all(companyId) as any[];
  return buildAccountingReport({
    type: "aarskontrol",
    requestedYear: 2024,
    accounts: rows("accounts").map((row) => ({ id: row.id, accountNumber: row.account_number, name: row.name, type: row.type })),
    entries: rows("journal_entries").map((row) => ({ id: row.id, entryNumber: row.entry_number, date: row.date, status: row.status })),
    lines: rows("journal_lines").map((row) => ({ journalEntryId: row.journal_entry_id, accountId: row.account_id, debit: row.debit, credit: row.credit })),
    bankTransactions: [],
    vatPeriods: [],
    annualReports: [{ year: 2024, result: filedResult, taxResult: 0, balanceTotal: 0, equity: 0, status: "indsendt" }],
  });
}

test("bogfører dokumenterede 2024-efterposteringer idempotent for drift og holding", () => {
  const db = setup();
  runMigration(db);
  runMigration(db);

  const entries = db.prepare("SELECT company_id AS companyId, entry_number AS entryNumber, status FROM journal_entries WHERE entry_number = 'AFSLUT-2024-001' ORDER BY company_id").all();
  assert.deepEqual(entries, [
    { companyId: 1, entryNumber: "AFSLUT-2024-001", status: "bogført" },
    { companyId: 2, entryNumber: "AFSLUT-2024-001", status: "bogført" },
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM journal_lines WHERE company_id = 1 AND journal_entry_id <> 1").get().count, 6);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM journal_lines WHERE company_id = 2").get().count, 6);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_logs").get().count, 2);

  const multiTotals = db.prepare(`
    SELECT ROUND(SUM(debit), 2) AS debit, ROUND(SUM(credit), 2) AS credit
    FROM journal_lines WHERE company_id = 1 AND journal_entry_id <> 1
  `).get() as { debit: number; credit: number };
  assert.deepEqual(multiTotals, { debit: 65_217, credit: 65_217 });

  const multiReport = report(db, 1, -134_428);
  assert.equal(multiReport.summary.result, -134_428.09);
  assert.equal(multiReport.filedAnnualReport?.matchesBookkeeping, true);
  assert.equal(multiReport.filedAnnualReport?.reconciliationDifference, 0);

  const holdingReport = report(db, 2, -4_875);
  assert.equal(holdingReport.summary.result, -4_875);
  assert.equal(holdingReport.summary.assets, 41_375);
  assert.equal(holdingReport.filedAnnualReport?.matchesBookkeeping, true);

  db.close();
});
