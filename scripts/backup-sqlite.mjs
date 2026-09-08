#!/usr/bin/env node
/**
 * Backup-sqlite — tager en sikkerhedskopi af SQLite-databasen.
 * Brug: node scripts/backup-sqlite.mjs
 * I produktion: BACKUP_DIR=/var/data/backups
 */
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_PATH || "data.db";
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

if (!existsSync(DB_PATH)) {
  console.error(`Database ikke fundet: ${DB_PATH}`);
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = join(BACKUP_DIR, `data-${timestamp}.db`);

try {
  const source = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    await source.backup(backupPath);
  } finally {
    source.close();
  }
  const verification = new Database(backupPath, { fileMustExist: true });
  try {
    // Gør kopien selvstændig, så en restore kun kræver selve .db-filen.
    verification.pragma("journal_mode = DELETE");
    const result = verification.pragma("quick_check", { simple: true });
    if (result !== "ok") throw new Error(`SQLite quick_check fejlede: ${String(result)}`);
  } finally {
    verification.close();
  }
  console.log(`Backup oprettet: ${backupPath}`);

  // Behold kun de 10 nyeste backups
  const { readdirSync, unlinkSync, statSync } = await import("node:fs");
  const backups = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("data-") && f.endsWith(".db"))
    .map(f => ({ name: f, path: join(BACKUP_DIR, f), mtime: statSync(join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of backups.slice(10)) {
    try { unlinkSync(old.path); console.log(`Gammel backup slettet: ${old.name}`); } catch {}
  }
} catch (err) {
  console.error(`Backup fejlede: ${err.message}`);
  process.exit(1);
}
