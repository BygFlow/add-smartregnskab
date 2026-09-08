#!/usr/bin/env node
/**
 * Migrate-sqlite-prod — tager backup før drizzle-kit push.
 * Brug: node scripts/migrate-sqlite-prod.mjs
 * Sikkerhedsnet: backup før migrering, så data aldrig mistes.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

console.log("=== ADD SmartRegnskab — Produktion migrering ===\n");

// 1. Backup
console.log("1. Tager backup...");
try {
  execSync("node scripts/backup-sqlite.mjs", { stdio: "inherit" });
} catch {
  console.error("Backup fejlede — afbryder migrering!");
  process.exit(1);
}

// 2. Migrer
console.log("\n2. Kører drizzle-kit push...");
try {
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });
  console.log("\nMigrering fuldført.");
} catch (err) {
  console.error("\nMigrering fejlede! Backup er tilgængelig i BACKUP_DIR.");
  console.error("Gendan med: cp <backup-fil> " + (process.env.DATABASE_PATH || "data.db"));
  process.exit(1);
}
