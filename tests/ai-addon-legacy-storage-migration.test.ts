import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const temp = mkdtempSync(join(tmpdir(), "smartregnskab-ai-addon-legacy-"));
const databasePath = join(temp, "legacy.db");
const legacy = new Database(databasePath);
legacy.exec(`
  CREATE TABLE companies (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    ai_enabled integer DEFAULT 0 NOT NULL
  );
  CREATE TABLE subscriptions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    company_id integer NOT NULL,
    ai_addon_enabled integer DEFAULT 0 NOT NULL
  );
  INSERT INTO companies (id, ai_enabled) VALUES (1, 0), (2, 0);
  INSERT INTO subscriptions (company_id, ai_addon_enabled) VALUES (1, 1), (2, 0);
`);
legacy.close();

process.env.DATABASE_PATH = databasePath;
await import("../server/storage");

test("legacy-databasen synkroniserer aktive AI-tilkøb til virksomhedsadgang", () => {
  const db = new Database(databasePath, { readonly: true });
  const rows = db.prepare("SELECT id, ai_enabled FROM companies ORDER BY id").all() as Array<{ id: number; ai_enabled: number }>;
  db.close();
  assert.deepEqual(rows, [
    { id: 1, ai_enabled: 1 },
    { id: 2, ai_enabled: 0 },
  ]);
});
