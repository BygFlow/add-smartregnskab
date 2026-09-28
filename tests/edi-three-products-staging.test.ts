import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.EDI_GATEWAY_DATABASE_PATH = ":memory:";

test("local staging: three products share one CVR and child, but only one receives EDI", async () => {
  const { createEdiGatewayApp } = await import("../services/edi-gateway/index");
  const previous = Object.fromEntries(["EDI_GATEWAY_ADMIN_TOKEN", "SPROOM_API_TOKEN", "SPROOM_API_URL",
    "SPROOM_WEBHOOK_PUBLIC_KEY", "EINVOICE_VALIDATOR_URL"].map(name => [name, process.env[name]]));
  const nativeFetch = globalThis.fetch;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const childId = "00000000-0000-4000-8000-000000000011";
  const firstDocumentId = "00000000-0000-4000-8000-000000000021";
  const inboundDocumentId = "00000000-0000-4000-8000-000000000031";
  let sentXml = "", sendCount = 0;
  process.env.EDI_GATEWAY_ADMIN_TOKEN = "local-staging-admin-token";
  process.env.SPROOM_API_TOKEN = "local-staging-parent-token";
  process.env.SPROOM_API_URL = "https://staging.sproom.test/api";
  process.env.EINVOICE_VALIDATOR_URL = "https://validator.test/validate";
  process.env.SPROOM_WEBHOOK_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1:")) return nativeFetch(input, init);
    if (url === "https://validator.test/validate") return new Response("OK", { status: 200 });
    if (url.endsWith(`/child-companies/${childId}/token`)) return Response.json({ token: "test-child-token" });
    if (url.includes("/recipients/")) return new Response("OK", { status: 200 });
    if (url.endsWith("/documents") && init?.method === "POST") {
      sendCount++;
      sentXml = Buffer.from(init.body as Uint8Array).toString("utf8");
      const documentId = `00000000-0000-4000-8000-${String(20 + sendCount).padStart(12, "0")}`;
      return new Response("OK", { status: 201, headers: { "X-Sproom-DocumentId": documentId } });
    }
    if (url.includes(`/documents/${inboundDocumentId}/`)) return new Response(sentXml, { status: 200 });
    throw new Error(`Unexpected local staging request: ${url}`);
  };
  const server = createEdiGatewayApp().listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const request = (path: string, method: string, body?: object, key = process.env.EDI_GATEWAY_ADMIN_TOKEN!) =>
      nativeFetch(base + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body) });
    const products = [
      ["smartregnskab", "reg-1"], ["smartdrift_pro", "pro-1"], ["smartdrift_clean", "clean-1"],
    ] as const;
    const tenants: Array<{ id: number; token: string }> = [];
    for (const [product, sourceTenantId] of products) {
      const response = await request("/api/edi-gateway/tenants", "POST", { product, sourceTenantId,
        cvr: "12345678", companyName: "Fiktiv staging-virksomhed", sproomChildId: childId });
      assert.equal(response.status, 201);
      const tenant = await response.json() as { id: number; token: string };
      tenants.push(tenant);
      const activation = await request(`/api/edi-gateway/tenants/${tenant.id}/activate`, "POST", {
        confirmation: "SPROOM_AFTALE_OG_KUNDEGODKENDELSE_BEKRAEFTET", evidenceReference: "fiktiv-staging-godkendelse",
      });
      assert.equal(activation.status, 200);
    }
    assert.equal((await request(`/api/edi-gateway/tenants/${tenants[0].id}/receive`, "POST", { enabled: true })).status, 200);
    assert.equal((await request(`/api/edi-gateway/tenants/${tenants[1].id}/receive`, "POST", { enabled: true })).status, 409);
    const invoice = (sourceId: string, invoiceNumber: string) => ({ sourceId, format: "OIOUBL_2_1", invoiceNumber,
      issueDate: "2026-09-28", dueDate: "2026-10-12", currency: "DKK",
      customer: { name: "Fiktiv modtager", cvr: "87654321" },
      lines: [{ description: "Staging service", quantity: 1, unitPrice: 100, vatRate: 25 }],
    });
    const sent = await request("/api/edi-gateway/send", "POST", invoice("pro-source-1", "STAGE-1"), tenants[1].token);
    assert.equal(sent.status, 202, await sent.text());
    assert.equal(sendCount, 1);
    const duplicate = await request("/api/edi-gateway/send", "POST", invoice("pro-source-1", "STAGE-1"), tenants[1].token);
    assert.equal(duplicate.status, 200);
    assert.equal(sendCount, 1);
    const doubleIssuer = await request("/api/edi-gateway/send", "POST", invoice("clean-source-1", "STAGE-1"), tenants[2].token);
    assert.equal(doubleIssuer.status, 409);
    assert.equal((await request("/api/edi-gateway/send", "POST", invoice("clean-source-2", "STAGE-2"), tenants[2].token)).status, 202);
    assert.equal((await request("/api/edi-gateway/send", "POST", invoice("smart-source-3", "STAGE-3"), tenants[0].token)).status, 202);
    assert.equal(sendCount, 3);
    const statusEvent = JSON.stringify({ webhookType: "documentStatusChanged", companyId: childId,
      documentId: firstDocumentId, documentStatus: "received" });
    const signature = sign("RSA-SHA256", Buffer.from(statusEvent), privateKey).toString("base64");
    const webhook = await nativeFetch(base + "/api/edi-gateway/sproom/webhook", { method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": signature }, body: statusEvent });
    assert.equal(webhook.status, 202);
    assert.equal((await request("/api/edi-gateway/queue/drain", "POST", {})).status, 200);
    const proStatus = await request("/api/edi-gateway/documents/pro-source-1", "GET", undefined, tenants[1].token);
    assert.equal((await proStatus.json()).status, "delivered");
    assert.equal((await request("/api/edi-gateway/documents/pro-source-1", "GET", undefined, tenants[0].token)).status, 404);
    const received = JSON.stringify({ webhookType: "documentReceived", companyId: childId,
      documentId: inboundDocumentId, documentType: "Invoice" });
    const receivedSignature = sign("RSA-SHA256", Buffer.from(received), privateKey).toString("base64");
    assert.equal((await nativeFetch(base + "/api/edi-gateway/sproom/webhook", { method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": receivedSignature }, body: received })).status, 202);
    assert.equal((await request("/api/edi-gateway/queue/drain", "POST", {})).status, 200);
    const smartInbox = await request("/api/edi-gateway/inbound", "GET", undefined, tenants[0].token);
    assert.equal((await smartInbox.json()).length, 1);
    for (const tenant of tenants.slice(1)) {
      const inbox = await request("/api/edi-gateway/inbound", "GET", undefined, tenant.token);
      assert.equal((await inbox.json()).length, 0);
    }
  } finally {
    globalThis.fetch = nativeFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
