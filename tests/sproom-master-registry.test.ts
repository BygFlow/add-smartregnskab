import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "smartregnskab-sproom-"));
process.env.DATABASE_PATH = join(temp, "registry.db");
process.env.MIGRATIONS_DIR = join(process.cwd(), "migrations");

const registry = await import("../server/sproom-registry");
const { db } = await import("../server/storage");
const { sproomChildCompanies } = await import("../shared/schema");

test("samme CVR genbruger én Sproom child-profil på tværs af produkter", () => {
  const first = registry.requestSproomOnboarding({
    companyId: 101,
    cvr: "DK 12345678",
    sourceProducts: ["add_smartregnskab", "smartdrift_pro"],
    consentAt: "2026-10-14T10:00:00.000Z",
    consentBy: "leder@example.test",
  });
  assert.equal(first.cvr, "12345678");

  const reused = registry.requestSproomOnboarding({
    companyId: 101,
    cvr: "12345678",
    sourceProducts: ["smartdrift_clean"],
    consentAt: "2026-10-14T10:01:00.000Z",
    consentBy: "leder@example.test",
  });
  const products = JSON.parse(reused.sourceProducts);
  assert.deepEqual(products.sort(), ["add_smartregnskab", "smartdrift_clean", "smartdrift_pro"]);
  assert.equal(db.select().from(sproomChildCompanies).all().length, 1);
});

test("samme CVR kan ikke oprette en parallel child-profil", () => {
  assert.throws(() => registry.requestSproomOnboarding({
    companyId: 202,
    cvr: "12345678",
    sourceProducts: ["smartdrift_pro"],
    consentAt: "2026-10-14T10:02:00.000Z",
    consentBy: "anden@example.test",
  }), /allerede knyttet til en anden kundeorganisation/);
});

test("platformen kobler Sproom-ID én gang og returnerer kun sikker status", () => {
  const linked = registry.linkSproomChildCompany({
    companyId: 101,
    externalCompanyId: "child-company-uuid-101",
    nemhandelStatus: "aktiv",
    peppolStatus: "aktiv",
  });
  assert.equal(linked.status, "forbundet");
  const safe = registry.safeSproomConnection(linked);
  assert.equal(safe?.connected, true);
  assert.equal(safe?.nemhandelStatus, "aktiv");
  assert.equal("externalCompanyId" in (safe as object), false);
});

test("kun de tre ADD-produkter og eksterne forbindelser gemmes som kilder", () => {
  const updated = registry.addSproomProduct(101, "smartdrift_pro");
  assert.ok(updated);
  const ignored = registry.addSproomProduct(101, "ukendt-produkt");
  assert.ok(ignored);
  assert.equal(JSON.parse(ignored!.sourceProducts).includes("ukendt-produkt"), false);
});
