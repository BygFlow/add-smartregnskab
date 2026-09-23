import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

test("fresh installations include real document storage and per-company inbox settings", () => {
  const sqlite = new Database(":memory:");
  try {
    migrate(drizzle(sqlite), { migrationsFolder: "migrations" });
    const columns = (table) => new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
    const companies = columns("companies");
    const documents = columns("document_inbox");
    for (const name of ["document_inbox_token", "document_auto_post", "document_payables_account_id", "document_input_vat_account_id"]) {
      assert.ok(companies.has(name), `companies.${name}`);
    }
    for (const name of ["storage_key", "content_hash", "external_message_id", "posted_journal_entry_id"]) {
      assert.ok(documents.has(name), `document_inbox.${name}`);
    }
  } finally {
    sqlite.close();
  }
});
