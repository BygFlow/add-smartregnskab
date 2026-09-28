import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";

process.env.EDI_GATEWAY_DATABASE_PATH = ":memory:";
const { db, gatewaySqlite } = await import("../services/edi-gateway/storage");
const { ediGatewayDocuments, ediGatewayTenants } = await import("../shared/schema");
const { handleGatewaySproomWebhook, registerPublicEdiGatewayRoutes, registerEdiGatewayAdminRoutes } = await import("../services/edi-gateway/routes");
const { classifySproomState, reconcileSproomDocuments } = await import("../services/edi-gateway/reconciliation");
const { enqueueVerifiedWebhook, drainWebhookQueue, webhookQueueStatus } = await import("../services/edi-gateway/webhook-queue");

test("EDI keys are company scoped and all newly provisioned products start disabled", async () => {
  const first = `edi_${"a".repeat(64)}`;
  const second = `edi_${"b".repeat(64)}`;
  for (const [product, sourceTenantId, token] of [
    ["smartdrift_pro", "pro-1", first], ["smartdrift_clean", "clean-2", second],
  ]) db.insert(ediGatewayTenants).values({ product, sourceTenantId, cvr: "12345678", companyName: "Fiktiv virksomhed",
    sproomChildId: "00000000-0000-4000-8000-000000000001", keyHash: createHash("sha256").update(token).digest("hex"),
    keyPrefix: token.slice(0, 16), createdAt: new Date().toISOString() }).run();
  const app = express();
  app.use(express.json());
  registerPublicEdiGatewayRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}`;
    const validDocument = { sourceId: "invoice-1", format: "OIOUBL_2_1", invoiceNumber: "TEST-1",
      issueDate: "2026-09-27", dueDate: "2026-10-11", currency: "DKK",
      customer: { name: "Fiktiv modtager", cvr: "87654321" },
      lines: [{ description: "Service", quantity: 1, unitPrice: 100, vatRate: 25 }] };
    const post = (key: string) => fetch(`${url}/api/edi-gateway/send`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(validDocument) });
    assert.equal((await post("edi_invalid")).status, 401);
    assert.equal((await post(first)).status, 403);
    assert.equal((await post(second)).status, 403);
    assert.equal((await fetch(`${url}/api/edi-gateway/inbound`, { headers: { Authorization: `Bearer ${first}` } })).status, 403);
    assert.equal((await fetch(`${url}/api/edi-gateway/inbound`, { headers: { Authorization: `Bearer ${second}` } })).status, 403);
    assert.equal(db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "pro-1")).get()?.active, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("Sproom sent is not delivery and a late sent event cannot undo confirmed reception", async () => {
  const tenant = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "pro-1")).get()!;
  const row = db.insert(ediGatewayDocuments).values({ tenantId: tenant.id, sourceId: "pro-invoice:1", direction: "outbound",
    format: "OIOUBL_2_1", documentType: "invoice", payloadXml: "<Invoice/>", sha256: "0".repeat(64),
    providerMessageId: "sproom-test-1", status: "submitted", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }).returning().get();
  const event = (documentStatus: string) => ({ webhookType: "documentStatusChanged", companyId: tenant.sproomChildId,
    documentId: "sproom-test-1", documentStatus });
  await handleGatewaySproomWebhook(event("sent"));
  assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "submitted");
  await handleGatewaySproomWebhook(event("received"));
  assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "delivered");
  await handleGatewaySproomWebhook(event("sent"));
  assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "delivered");
  await handleGatewaySproomWebhook(event("rejected"));
  assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "failed");
  await handleGatewaySproomWebhook(event("sent"));
  assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "failed");
});

test("gateway admin cannot map one CVR to two Sproom children or one child to two CVRs", async () => {
  process.env.EDI_GATEWAY_ADMIN_TOKEN = "test-gateway-admin-secret";
  const app = express();
  app.use(express.json());
  registerEdiGatewayAdminRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/edi-gateway/tenants`;
    const post = (body: object) => fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.EDI_GATEWAY_ADMIN_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const common = { product: "smartregnskab", sourceTenantId: "regnskab-3", cvr: "12345678", companyName: "Fiktiv virksomhed", sproomChildId: "00000000-0000-4000-8000-000000000002" };
    assert.equal((await post(common)).status, 409);
    assert.equal((await post({ ...common, cvr: "87654321", sourceTenantId: "regnskab-4", sproomChildId: "00000000-0000-4000-8000-000000000001" })).status, 409);
    assert.equal((await post({ ...common, sproomChildId: "00000000-0000-4000-8000-000000000001" })).status, 201);
    assert.equal((await fetch(url)).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("activation requires recorded approval and a working Sproom child token", async () => {
  const tenant = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "regnskab-3")).get()!;
  const app = express();
  app.use(express.json());
  registerEdiGatewayAdminRoutes(app);
  const server = app.listen(0);
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.SPROOM_API_TOKEN;
  const oldValidator = process.env.EINVOICE_VALIDATOR_URL;
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/edi-gateway/tenants/${tenant.id}/activate`;
    const body = { confirmation: "SPROOM_AFTALE_OG_KUNDEGODKENDELSE_BEKRAEFTET", evidenceReference: "signed-approval-2026-001" };
    const post = (value: object) => oldFetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.EDI_GATEWAY_ADMIN_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(value) });
    assert.equal((await post({ confirmation: body.confirmation })).status, 400);
    process.env.EINVOICE_VALIDATOR_URL = "https://validator.example.test";
    process.env.SPROOM_API_TOKEN = "test-parent-token";
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    assert.equal((await post(body)).status, 503);
    globalThis.fetch = async () => new Response(JSON.stringify({ token: "verified-child-token" }), { status: 200 });
    assert.equal((await post(body)).status, 200);
    const activated = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.id, tenant.id)).get()!;
    assert.equal(activated.active, 1);
    assert.equal(activated.onboardingEvidence, body.evidenceReference);
    assert.ok(activated.activatedAt);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.SPROOM_API_TOKEN; else process.env.SPROOM_API_TOKEN = oldToken;
    if (oldValidator === undefined) delete process.env.EINVOICE_VALIDATOR_URL; else process.env.EINVOICE_VALIDATOR_URL = oldValidator;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("standalone gateway rejects unsigned Sproom webhooks", async () => {
  process.env.NODE_ENV = "test";
  const { createEdiGatewayApp } = await import("../services/edi-gateway/index");
  const server = createEdiGatewayApp().listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/edi-gateway/sproom/webhook`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookType: "documentReceived", companyId: "unknown", documentId: "test" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("gateway readiness stays closed until archive, validator and Sproom configuration exist", async () => {
  process.env.NODE_ENV = "test";
  const { createEdiGatewayApp } = await import("../services/edi-gateway/index");
  const names = ["EDI_GATEWAY_ADMIN_TOKEN", "EDI_GATEWAY_BACKUP_DIR", "SPROOM_API_TOKEN", "EINVOICE_VALIDATOR_URL", "SPROOM_WEBHOOK_PUBLIC_KEY"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const server = createEdiGatewayApp().listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/ready`;
    for (const name of names) delete process.env[name];
    assert.equal((await fetch(url)).status, 503);
    for (const name of names) process.env[name] = "configured-for-test";
    assert.equal((await fetch(url)).status, 200);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("one CVR cannot reserve the same invoice number through Pro and Clean", () => {
  const pro = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "pro-1")).get()!;
  const clean = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "clean-2")).get()!;
  const values = { sourceId: "shared-invoice-test", direction: "outbound", format: "OIOUBL_2_1", documentType: "invoice",
    invoiceNumber: "2026-001", issuerCvr: "12345678", payloadXml: "<Invoice/>", sha256: "1".repeat(64), status: "pending",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.insert(ediGatewayDocuments).values({ ...values, tenantId: pro.id }).run();
  assert.throws(() => db.insert(ediGatewayDocuments).values({ ...values, tenantId: clean.id }).run(), /UNIQUE/);
});

test("Sproom status polling confirms delivery only after reception", async () => {
  assert.equal(classifySproomState({ statusCode: 302 }), "submitted");
  assert.equal(classifySproomState({ statusCode: 401 }), "delivered");
  assert.equal(classifySproomState({ statusCode: 405 }), "failed");
  const tenant = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "clean-2")).get()!;
  const id = "00000000-0000-4000-8000-000000000099";
  const row = db.insert(ediGatewayDocuments).values({ tenantId: tenant.id, sourceId: "clean-status-test", direction: "outbound",
    format: "PEPPOL_BIS_3", documentType: "invoice", payloadXml: "<Invoice/>", sha256: "9".repeat(64),
    providerMessageId: id, status: "submitted", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }).returning().get();
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.SPROOM_API_TOKEN;
  const oldUrl = process.env.SPROOM_API_URL;
  let statusCode = 302;
  process.env.SPROOM_API_TOKEN = "test-parent-token";
  process.env.SPROOM_API_URL = "https://staging.sproom.test/api";
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith("/token")) return new Response(JSON.stringify({ token: "test-child-token" }), { status: 200 });
    if (url.endsWith(`/${id}/state`)) return new Response(JSON.stringify({ statusCode }), { status: 200 });
    throw new Error(`Uventet Sproom-kald: ${url}`);
  };
  try {
    assert.equal((await reconcileSproomDocuments()).checked, 1);
    assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "submitted");
    statusCode = 402;
    assert.equal((await reconcileSproomDocuments()).changed, 1);
    assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "delivered");
    statusCode = 405;
    assert.equal((await reconcileSproomDocuments()).checked, 0);
    assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.id, row.id)).get()?.status, "delivered");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.SPROOM_API_TOKEN; else process.env.SPROOM_API_TOKEN = oldToken;
    if (oldUrl === undefined) delete process.env.SPROOM_API_URL; else process.env.SPROOM_API_URL = oldUrl;
  }
});

test("signed inbound webhook is durably queued, deduplicated and retried after a transient failure", async () => {
  const tenant = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "pro-1")).get()!;
  db.update(ediGatewayTenants).set({ active: 1, receiveEnabled: 1 }).where(eq(ediGatewayTenants.id, tenant.id)).run();
  const id = "00000000-0000-4000-8000-000000000198";
  const body = { webhookType: "documentReceived", companyId: tenant.sproomChildId, documentId: id, documentType: "Invoice" };
  const raw = JSON.stringify(body);
  assert.equal(enqueueVerifiedWebhook(raw, body).status, 202);
  assert.equal((enqueueVerifiedWebhook(raw, body).result as any).duplicate, true);
  assert.equal(webhookQueueStatus().pending, 1);
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.SPROOM_API_TOKEN;
  const oldValidator = process.env.EINVOICE_VALIDATOR_URL;
  process.env.SPROOM_API_TOKEN = "test-parent-token";
  delete process.env.EINVOICE_VALIDATOR_URL;
  let fail = true;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith("/token")) return new Response(JSON.stringify({ token: "test-child-token" }), { status: 200 });
    if (url.includes(`/documents/${id}/`)) return new Response(fail ? "Unavailable" : "<Invoice/>", { status: fail ? 503 : 200 });
    throw new Error(`Uventet Sproom-kald: ${url}`);
  };
  try {
    assert.equal((await drainWebhookQueue()).retried, 1);
    assert.equal(webhookQueueStatus().pending, 1);
    gatewaySqlite.prepare("UPDATE edi_gateway_webhook_events SET next_attempt_at = 0 WHERE body_json = ?").run(raw);
    fail = false;
    assert.equal((await drainWebhookQueue()).processed, 1);
    assert.equal(webhookQueueStatus().pending, 0);
    assert.equal(db.select().from(ediGatewayDocuments).where(eq(ediGatewayDocuments.sourceId, id)).get()?.status, "invalid");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.SPROOM_API_TOKEN; else process.env.SPROOM_API_TOKEN = oldToken;
    if (oldValidator === undefined) delete process.env.EINVOICE_VALIDATOR_URL; else process.env.EINVOICE_VALIDATOR_URL = oldValidator;
  }
});

test("HTTP webhook verifies exact signed bytes before durable acknowledgement", async () => {
  process.env.NODE_ENV = "test";
  const { createEdiGatewayApp } = await import("../services/edi-gateway/index");
  const tenant = db.select().from(ediGatewayTenants).where(eq(ediGatewayTenants.sourceTenantId, "pro-1")).get()!;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const previous = process.env.SPROOM_WEBHOOK_PUBLIC_KEY;
  process.env.SPROOM_WEBHOOK_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
  const raw = JSON.stringify({ webhookType: "documentReceived", companyId: tenant.sproomChildId,
    documentId: "00000000-0000-4000-8000-000000000199", documentType: "Invoice" });
  const signature = sign("RSA-SHA256", Buffer.from(raw), privateKey).toString("base64");
  const server = createEdiGatewayApp().listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/edi-gateway/sproom/webhook`;
    const send = (body: string, signed: string) => fetch(url, { method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": signed }, body });
    assert.equal((await send(raw, "invalid")).status, 401);
    assert.equal((await send(raw + " ", signature)).status, 401);
    const accepted = await send(raw, signature);
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).duplicate, false);
    const duplicate = await send(raw, signature);
    assert.equal(duplicate.status, 202);
    assert.equal((await duplicate.json()).duplicate, true);
    assert.equal(webhookQueueStatus().pending, 1);
  } finally {
    if (previous === undefined) delete process.env.SPROOM_WEBHOOK_PUBLIC_KEY; else process.env.SPROOM_WEBHOOK_PUBLIC_KEY = previous;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
