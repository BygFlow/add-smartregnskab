import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const temp = mkdtempSync(join(tmpdir(), "smartregnskab-economic-import-"));
process.env.DATABASE_PATH = join(temp, "economic.db");
process.env.MIGRATIONS_DIR = join(process.cwd(), "migrations");
process.env.ENCRYPTION_KEY = "economic-import-test-key-at-least-32-characters";

const { db, storage } = await import("../server/storage");
const { integrations } = await import("../shared/schema");

test("e-conomic credentials are encrypted at rest and decrypted only inside the server", async () => {
  const created = await storage.createIntegration({
    companyId: 77,
    category: "regnskab",
    provider: "e-conomic",
    status: "ikke_opsat",
    syncMode: "api",
    apiKey: "app-secret-value",
    apiSecret: "agreement-grant-value",
    autoSync: 0,
  });
  assert.equal(created.apiKey, "app-secret-value");
  assert.equal(created.apiSecret, "agreement-grant-value");

  const stored = db.select().from(integrations).get();
  assert.match(stored!.apiKey!, /^gcm\$/);
  assert.match(stored!.apiSecret!, /^gcm\$/);
  assert.doesNotMatch(stored!.apiKey!, /app-secret-value/);
  assert.doesNotMatch(stored!.apiSecret!, /agreement-grant-value/);

  const loaded = await storage.getIntegration(created.id, 77);
  assert.equal(loaded!.apiKey, "app-secret-value");
  assert.equal(loaded!.apiSecret, "agreement-grant-value");
});

test("e-conomic importer is read-only and forces yearly control and approval", () => {
  const importer = readFileSync(join(process.cwd(), "server", "economic-import.ts"), "utf8");
  const routes = readFileSync(join(process.cwd(), "server", "economic-import-routes.ts"), "utf8");
  const migration = readFileSync(join(process.cwd(), "migrations", "0019_closed_newton_destine.sql"), "utf8");

  assert.match(importer, /method:\s*"GET"/);
  assert.doesNotMatch(importer, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  assert.match(importer, /\["restapi\.e-conomic\.com", "apis\.e-conomic\.com"\]/);
  assert.match(routes, /Kontrollér først, at alle data/);
  assert.match(routes, /previous\?\.approvedAt/);
  assert.match(routes, /\/runs\/:id\/approve/);
  assert.match(migration, /CREATE TABLE `economic_import_runs`/);
  assert.match(migration, /CREATE TABLE `economic_import_records`/);
  assert.match(migration, /CREATE TABLE `economic_import_files`/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/);
});

test("journal lines stay readable for balanced draft verification", () => {
  const routes = readFileSync(join(process.cwd(), "server", "routes.ts"), "utf8");
  const allowList = routes.match(/const regnskabApiPrefixes = \[([\s\S]*?)\];/)?.[1] || "";

  assert.match(allowList, /"\/journal-lines"/);
  assert.match(routes, /app\.get\("\/api\/journal-lines"/);
});
