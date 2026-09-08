#!/usr/bin/env node
/**
 * Backup-sqlite — tager en sikkerhedskopi af SQLite-databasen.
 * Brug: node scripts/backup-sqlite.mjs
 * I produktion: BACKUP_DIR=/var/data/backups
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

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
  copyFileSync(DB_PATH, backupPath);
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
