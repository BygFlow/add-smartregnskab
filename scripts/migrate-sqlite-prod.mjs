#!/usr/bin/env node
/**
 * Migrate-sqlite-prod — tager backup før versionsstyrede migrationer.
 * Brug: node scripts/migrate-sqlite-prod.mjs
 * Sikkerhedsnet: backup før migrering, så data aldrig mistes.
 */
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const LEGACY_DATA_MIGRATIONS = [
  "0021_move_misimported_multiservice_bank",
  "0022_remove_unused_multiclean_bank_import",
];

function tableExists(sqlite, table) {
  return Boolean(
    sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

function runLegacyDataMigrations(sqlite, migrationsFolder) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS add_legacy_migrations (
      tag text PRIMARY KEY NOT NULL,
      applied_at text NOT NULL
    )
  `);

  for (const tag of LEGACY_DATA_MIGRATIONS) {
    const applied = sqlite.prepare("SELECT 1 FROM add_legacy_migrations WHERE tag = ?").get(tag);
    if (applied) continue;

    const sql = readFileSync(join(migrationsFolder, `${tag}.sql`), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    sqlite.transaction(() => {
      for (const statement of statements) sqlite.exec(statement);
      sqlite.prepare(
        "INSERT INTO add_legacy_migrations (tag, applied_at) VALUES (?, ?)",
      ).run(tag, new Date().toISOString());
    })();
    console.log(`   Anvendt ældre-database-migrering: ${tag}`);
  }
}

console.log("=== ADD SmartRegnskab — produktionsmigrering ===\n");

// 1. Backup
console.log("1. Tager backup...");
const databasePath = process.env.DATABASE_PATH || "data.db";
if (existsSync(databasePath)) {
  try {
    execFileSync(process.execPath, ["scripts/backup-sqlite.mjs"], { stdio: "inherit" });
  } catch {
    console.error("Backup fejlede — afbryder migrering!");
    process.exit(1);
  }
} else {
  mkdirSync(dirname(databasePath), { recursive: true });
  console.log("Ny installation — der findes endnu ingen database at sikkerhedskopiere.");
}

// 2. Migrer
console.log("\n2. Kører versionsstyrede Drizzle-migrationer...");
try {
  const sqlite = new Database(databasePath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const migrationsFolder = process.env.MIGRATIONS_DIR || "migrations";
    const hasApplicationSchema = tableExists(sqlite, "companies");
    const hasDrizzleJournal = tableExists(sqlite, "__drizzle_migrations");

    if (!hasApplicationSchema || hasDrizzleJournal) {
      migrate(drizzle(sqlite), { migrationsFolder });
    } else {
      console.log("   Ældre produktionsdatabase fundet — kører kun registrerede datamigreringer.");
      runLegacyDataMigrations(sqlite, migrationsFolder);
    }
  } finally {
    sqlite.close();
  }
  console.log("\nMigrering fuldført.");
} catch (err) {
  console.error("\nMigrering fejlede! Backup er tilgængelig i BACKUP_DIR.");
  console.error("Gendan med: cp <backup-fil> " + (process.env.DATABASE_PATH || "data.db"));
  console.error(err instanceof Error ? (err.stack || err.message) : err);
  process.exit(1);
}
