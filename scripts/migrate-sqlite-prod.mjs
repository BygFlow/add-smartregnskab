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
  "0023_correct_null_account_ref_imports",
  "0024_register_filed_2024_annual_reports",
  "0025_reconcile_filed_2024_reports",
  "0029_label_2025_bank_imports",
  "0030_remove_smartdrift_aiia_test_bank",
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

    // Nogle tidlige legacy-databaser indeholder kun kerne- og banktabellerne.
    // Lad årsrapportregistreringen vente, indtil dens tabeller findes, i stedet
    // for at blokere de uafhængige bankkorrektioner og hele opstarten.
    if (tag === "0024_register_filed_2024_annual_reports"
      && (!tableExists(sqlite, "annual_reports") || !tableExists(sqlite, "audit_logs"))) {
      console.log(`   Springer ${tag} over — årsrapporttabellerne findes ikke i denne legacy-database.`);
      continue;
    }
    if (tag === "0025_reconcile_filed_2024_reports"
      && ["annual_reports", "accounts", "journal_entries", "journal_lines", "audit_logs"]
        .some((table) => !tableExists(sqlite, table))) {
      console.log(`   Springer ${tag} over — bogførings- eller årsrapporttabellerne findes ikke i denne legacy-database.`);
      continue;
    }

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
    const lastDrizzleMigrationAt = hasDrizzleJournal
      ? Number(sqlite.prepare("SELECT MAX(created_at) AS createdAt FROM __drizzle_migrations").get()?.createdAt || 0)
      : 0;
    // Den oprindelige produktionsdatabase nåede at journalføre 0000, hvorefter
    // de additive tabeller blev oprettet af den idempotente legacy-opstart.
    // Et efterfølgende fuldt Drizzle-run ville derfor starte ved 0001 og ramme
    // "table already exists". Genkend denne konkrete mellemtilstand som legacy.
    const hasPartiallyJournalledLegacySchema = hasApplicationSchema
      && hasDrizzleJournal
      && lastDrizzleMigrationAt < 1788850178183
      && tableExists(sqlite, "ai_decision_logs");

    if (!hasApplicationSchema || (hasDrizzleJournal && !hasPartiallyJournalledLegacySchema)) {
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
