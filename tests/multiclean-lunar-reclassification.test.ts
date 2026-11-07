import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const migrationSql = readFileSync(
  new URL("../migrations/0026_reclassify_multiclean_receipts.sql", import.meta.url),
  "utf8",
);
const bankHistoryMigrationSql = readFileSync(
  new URL("../migrations/0027_preserve_danske_bank_history.sql", import.meta.url),
  "utf8",
);

function runSqlMigration(db: Database.Database, sql: string) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  db.transaction(() => statements.forEach((statement) => db.exec(statement)))();
}

function runMigration(db: Database.Database) {
  runSqlMigration(db, migrationSql);
  runSqlMigration(db, bankHistoryMigrationSql);
}

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id integer PRIMARY KEY, name text NOT NULL, cvr text);
    CREATE TABLE company_units (
      id integer PRIMARY KEY,
      company_id integer NOT NULL,
      name text NOT NULL,
      se_number text,
      accounting_company_id integer
    );
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

    INSERT INTO companies VALUES
      (4, 'ADD Multi Service ApS', '44822539'),
      (12, 'ADD MultiClean Service', NULL);
    INSERT INTO company_units VALUES
      (1, 4, 'ADD MultiClean Service', '45147592', 12);

    INSERT INTO accounts (company_id, account_number, name, type, balance, active, created_at) VALUES
      (4, '5820', 'Bankkonto', 'aktiv', 0, 1, '2025-01-01'),
      (4, '5825', 'Bank løn og skat', 'aktiv', 0, 1, '2025-01-01'),
      (4, '6840', 'Mellemregning - MultiClean Service', 'aktiv', 0, 1, '2025-01-01'),
      (12, '5820', 'Bankkonto', 'aktiv', 0, 1, '2025-01-01'),
      (12, '5825', 'Bank løn og moms', 'aktiv', 0, 1, '2025-01-01'),
      (12, '6837', 'Mellemregning - Multi Service', 'aktiv', 0, 1, '2025-01-01');

    INSERT INTO journal_entries (company_id, entry_number, date, description, status, created_at)
      VALUES (4, 'PARENT-EXISTING', '2025-04-30', 'Eksisterende mellemregning', 'bogført', '2025-04-30');
  `);
  return db;
}

test("mærker Lunar-konti og omposterer 0112-indbetalinger idempotent", () => {
  const db = setup();
  runMigration(db);
  runMigration(db);

  const accountNames = db.prepare(`
    SELECT company_id AS companyId, account_number AS accountNumber, name
    FROM accounts
    WHERE account_number IN ('5820', '5825', '5826')
    ORDER BY company_id, account_number
  `).all();
  assert.deepEqual(accountNames, [
    { companyId: 4, accountNumber: "5820", name: "Bankdrift · Danske Bank 13800707 (historisk) / Lunar ·0112" },
    { companyId: 4, accountNumber: "5825", name: "Lunar løn og skat ·4483" },
    { companyId: 4, accountNumber: "5826", name: "Lunar marketing ·9278 (fælles)" },
    { companyId: 12, accountNumber: "5820", name: "Lunar drift ·6477 (MultiClean)" },
    { companyId: 12, accountNumber: "5825", name: "Lunar løn og moms ·9507 (MultiClean)" },
  ]);

  const entries = db.prepare(`
    SELECT entry_number AS entryNumber, date, status
    FROM journal_entries
    WHERE company_id = 12 AND entry_number LIKE 'REKLASS-2025-0112-%'
    ORDER BY entry_number
  `).all() as Array<{ entryNumber: string; date: string; status: string }>;
  assert.equal(entries.length, 13);
  assert.equal(entries[0].entryNumber, "REKLASS-2025-0112-142");
  assert.equal(entries.at(-1)?.entryNumber, "REKLASS-2025-0112-154");
  assert.ok(entries.every((entry) => entry.status === "bogført"));

  const totals = db.prepare(`
    SELECT ROUND(SUM(line.debit), 2) AS debit, ROUND(SUM(line.credit), 2) AS credit,
           COUNT(*) AS lineCount
    FROM journal_lines AS line
    JOIN journal_entries AS entry ON entry.id = line.journal_entry_id
    WHERE entry.company_id = 12 AND entry.entry_number LIKE 'REKLASS-2025-0112-%'
  `).get() as { debit: number; credit: number; lineCount: number };
  assert.deepEqual(totals, { debit: 37_757.51, credit: 37_757.51, lineCount: 26 });

  const byAccount = db.prepare(`
    SELECT account.account_number AS accountNumber,
           ROUND(SUM(line.debit), 2) AS debit,
           ROUND(SUM(line.credit), 2) AS credit
    FROM journal_lines AS line
    JOIN journal_entries AS entry ON entry.id = line.journal_entry_id
    JOIN accounts AS account ON account.id = line.account_id
    WHERE entry.company_id = 12 AND entry.entry_number LIKE 'REKLASS-2025-0112-%'
    GROUP BY account.account_number
    ORDER BY account.account_number
  `).all();
  assert.deepEqual(byAccount, [
    { accountNumber: "5820", debit: 0, credit: 37_757.51 },
    { accountNumber: "6837", debit: 37_757.51, credit: 0 },
  ]);

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM journal_entries WHERE company_id = 4").get().count,
    1,
    "parentens eksisterende posteringer må ikke ændres",
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_logs").get().count, 3);

  const history = db.prepare(`
    SELECT detail FROM audit_logs
    WHERE company_id = 4 AND action = 'bank_account_history_recorded'
  `).get() as { detail: string };
  assert.match(history.detail, /13800707/);
  assert.match(history.detail, /0112/);

  db.close();
});
