#!/usr/bin/env node
/**
 * Ikke-destruktiv restore-øvelse for SQLite.
 * Opretter en selvstændig kopi i en midlertidig mappe, åbner den som en
 * gendannet database og kontrollerer integritet samt centrale tabeller.
 */
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";

const sourcePath = process.env.DATABASE_PATH || process.argv[2] || "data.db";
if (!existsSync(sourcePath)) {
  console.error(JSON.stringify({ ok: false, error: `Database ikke fundet: ${sourcePath}` }));
  process.exit(1);
}

const drillDir = mkdtempSync(join(tmpdir(), "add-smartregnskab-restore-"));
const restoredPath = join(drillDir, "restored.db");
let source;
let restored;
try {
  source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  await source.backup(restoredPath);
  source.close();
  source = undefined;

  restored = new Database(restoredPath, { readonly: true, fileMustExist: true });
  const integrity = restored.pragma("integrity_check", { simple: true });
  const tableRows = restored.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tables = tableRows.map((row) => row.name);
  const required = ["companies", "users", "invoices", "audit_logs"];
  const missing = required.filter((name) => !tables.includes(name));
  const counts = Object.fromEntries(required.filter((name) => tables.includes(name)).map((name) => [name, restored.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count]));
  const ok = integrity === "ok" && missing.length === 0;
  console.log(JSON.stringify({ ok, sourcePath, restoredBytes: statSync(restoredPath).size, integrity, tableCount: tables.length, missing, counts, testedAt: new Date().toISOString() }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }));
  process.exitCode = 1;
} finally {
  try { source?.close(); } catch {}
  try { restored?.close(); } catch {}
  rmSync(drillDir, { recursive: true, force: true });
}
