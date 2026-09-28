#!/usr/bin/env node
// Non-destructive, verified SQLite snapshot. Copy the resulting file to an
// access-controlled offsite store; this script never deletes old backups.
import { chmodSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

const sourcePath = process.env.EDI_GATEWAY_DATABASE_PATH;
const backupDir = process.env.EDI_GATEWAY_BACKUP_DIR;
if (!sourcePath || sourcePath === ":memory:" || !backupDir || !existsSync(sourcePath)) {
  console.error("EDI_GATEWAY_DATABASE_PATH og EDI_GATEWAY_BACKUP_DIR skal pege på eksisterende database og backupmappe.");
  process.exit(1);
}
const source = resolve(sourcePath);
const targetDir = resolve(backupDir);
if (source === targetDir || dirname(source) === targetDir) {
  console.error("Backupmappen skal være adskilt fra gateway-databasen.");
  process.exit(1);
}
mkdirSync(targetDir, { recursive: true });
const name = `edi-gateway-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
const pending = join(targetDir, `${name}.pending`);
const destination = join(targetDir, `${name}.db`);
let input;
let output;
try {
  input = new Database(source, { readonly: true, fileMustExist: true });
  await input.backup(pending);
  input.close();
  input = undefined;
  output = new Database(pending, { readonly: true, fileMustExist: true });
  const integrity = output.pragma("integrity_check", { simple: true });
  const tables = output.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  if (integrity !== "ok" || !["edi_gateway_tenants", "edi_gateway_documents", "edi_gateway_webhook_events"].every(name => tables.includes(name))) {
    throw new Error("Backupkopien bestod ikke integritets- og tabelkontrol.");
  }
  output.close();
  output = undefined;
  chmodSync(pending, 0o600);
  renameSync(pending, destination);
  console.log(JSON.stringify({ ok: true, destination, sizeBytes: statSync(destination).size, checkedAt: new Date().toISOString() }));
} catch (error) {
  console.error(`EDI-backup fejlede: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  try { input?.close(); } catch {}
  try { output?.close(); } catch {}
}
