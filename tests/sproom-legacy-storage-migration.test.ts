import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const temp = mkdtempSync(join(tmpdir(), "smartregnskab-sproom-legacy-"));
const databasePath = join(temp, "legacy.db");
const legacy = new Database(databasePath);
legacy.exec(`
  CREATE TABLE companies (id integer PRIMARY KEY AUTOINCREMENT NOT NULL);
  CREATE TABLE sproom_child_companies (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    company_id integer NOT NULL,
    cvr text NOT NULL,
    external_company_id text,
    status text DEFAULT 'afventer_sproom' NOT NULL,
    source_products text DEFAULT '[]' NOT NULL,
    nemhandel_status text DEFAULT 'afventer' NOT NULL,
    peppol_status text DEFAULT 'afventer' NOT NULL,
    consent_at text,
    consent_by text,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );
`);
legacy.close();

process.env.DATABASE_PATH = databasePath;
await import("../server/storage");

test("legacy-databasen får alle Sproom provisioning-kolonner", () => {
  const db = new Database(databasePath, { readonly: true });
  const columns = new Set((db.pragma("table_info('sproom_child_companies')") as Array<{ name: string }>).map((item) => item.name));
  db.close();
  for (const column of ["enrollment_id", "nemhandel_network_id", "peppol_network_id", "last_error"]) {
    assert.equal(columns.has(column), true, `${column} mangler`);
  }
});
