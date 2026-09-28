import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import express from "express";

process.env.DATABASE_PATH = ":memory:";
process.env.RENDER_SERVICE_ID = "srv-dat13nbncjis73cmttg0";
process.env.RENDER_GIT_BRANCH = "staging/internal-integration-2026-09-28";
process.env.STAGING_CONNECT_TOKEN = `sk_${"a".repeat(64)}`;

const { ensureStagingConnectFixture } = await import("../server/staging-connect-fixture");
const { registerPublicAddConnectRoutes } = await import("../server/add-connect");
const { db } = await import("../server/storage");
const { apiKeys } = await import("../shared/schema");

test("staging fixture grants only temporary ADD Connect read/write access and deactivates it", async () => {
  await ensureStagingConnectFixture();
  const row = db.select().from(apiKeys).where(eq(apiKeys.name, "Midlertidig Pro/Clean-integrationstest")).get();
  assert.ok(row);
  assert.deepEqual(JSON.parse(row.scopes || "[]"), ["add_connect:read", "add_connect:write"]);
  assert.equal(row.status, "aktiv");
  assert.ok(row.expiresAt && new Date(row.expiresAt).getTime() > Date.now());

  const app = express();
  registerPublicAddConnectRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/add-connect/records?sourceProduct=smartdrift_pro&sourceId=missing`;
    const request = () => fetch(url, { headers: { authorization: `Bearer ${process.env.STAGING_CONNECT_TOKEN}` } });
    assert.equal((await request()).status, 404);

    delete process.env.STAGING_CONNECT_TOKEN;
    await ensureStagingConnectFixture();
    const deactivated = db.select().from(apiKeys).where(eq(apiKeys.id, row.id)).get();
    assert.equal(deactivated?.status, "deaktiveret");
    assert.equal((await fetch(url, { headers: { authorization: `Bearer sk_${"a".repeat(64)}` } })).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
