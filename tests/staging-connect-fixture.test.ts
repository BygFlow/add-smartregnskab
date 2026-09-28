import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";

process.env.DATABASE_PATH = ":memory:";
process.env.RENDER_SERVICE_ID = "srv-dat13nbncjis73cmttg0";
process.env.RENDER_GIT_BRANCH = "staging/internal-integration-2026-09-28";
process.env.STAGING_CONNECT_TOKEN = `sk_${"a".repeat(64)}`;

const { ensureStagingConnectFixture } = await import("../server/staging-connect-fixture");
const { db } = await import("../server/storage");
const { apiKeys } = await import("../shared/schema");

test("staging fixture grants only temporary ADD Connect read/write access and deactivates it", async () => {
  await ensureStagingConnectFixture();
  const row = db.select().from(apiKeys).where(eq(apiKeys.name, "Midlertidig Pro/Clean-integrationstest")).get();
  assert.ok(row);
  assert.deepEqual(JSON.parse(row.scopes || "[]"), ["add_connect:read", "add_connect:write"]);
  assert.equal(row.status, "aktiv");
  assert.ok(row.expiresAt && new Date(row.expiresAt).getTime() > Date.now());

  delete process.env.STAGING_CONNECT_TOKEN;
  await ensureStagingConnectFixture();
  const deactivated = db.select().from(apiKeys).where(eq(apiKeys.id, row.id)).get();
  assert.equal(deactivated?.status, "deaktiveret");
});
