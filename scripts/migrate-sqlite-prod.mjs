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

console.log("=== ADD SmartRegnskab — produktionsmigrering ===\n");

// 1. Backup
console.log("1. Tager backup...");
try {
  execFileSync(process.execPath, ["scripts/backup-sqlite.mjs"], { stdio: "inherit" });
} catch {
  console.error("Backup fejlede — afbryder migrering!");
  process.exit(1);
}

// 2. Migrer
console.log("\n2. Kører versionsstyrede Drizzle-migrationer...");
try {
  const sqlite = new Database(process.env.DATABASE_PATH || "data.db");
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite), { migrationsFolder: process.env.MIGRATIONS_DIR || "migrations" });
  } finally {
    sqlite.close();
  }
  console.log("\nMigrering fuldført.");
} catch (err) {
  console.error("\nMigrering fejlede! Backup er tilgængelig i BACKUP_DIR.");
  console.error("Gendan med: cp <backup-fil> " + (process.env.DATABASE_PATH || "data.db"));
  process.exit(1);
}
