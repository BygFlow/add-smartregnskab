import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";

const temp = mkdtempSync(join(tmpdir(), "smartregnskab-sproom-adapter-"));
process.env.DATABASE_PATH = join(temp, "adapter.db");
process.env.MIGRATIONS_DIR = join(process.cwd(), "migrations");
const { generateEInvoice, providerSend, providerStatus, sproomRequestId, verifySproomSignature, verifySproomWebhookSignature } = await import("../server/einvoice");
const { db } = await import("../server/storage");
const { companies } = await import("../shared/schema");

const originalFetch = globalThis.fetch;
const originalEnv = {
  provider: process.env.EINVOICE_PROVIDER,
  apiUrl: process.env.SPROOM_API_URL,
  token: process.env.SPROOM_API_TOKEN,
  companyMap: process.env.SPROOM_COMPANY_MAP,
  parentCvr: process.env.SPROOM_PARENT_CVR,
  platformCvr: process.env.PLATFORM_COMPANY_CVR,
};

function configureSproom() {
  process.env.EINVOICE_PROVIDER = "sproom";
  process.env.SPROOM_API_URL = "https://staging.sproom.test/api";
  process.env.SPROOM_API_TOKEN = "parent-token";
  process.env.SPROOM_COMPANY_MAP = JSON.stringify({ 7: "child-uuid" });
  process.env.SPROOM_PARENT_CVR = "46761898";
  process.env.PLATFORM_COMPANY_CVR = "46761898";
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.EINVOICE_PROVIDER = originalEnv.provider;
  process.env.SPROOM_API_URL = originalEnv.apiUrl;
  process.env.SPROOM_API_TOKEN = originalEnv.token;
  process.env.SPROOM_COMPANY_MAP = originalEnv.companyMap;
  process.env.SPROOM_PARENT_CVR = originalEnv.parentCvr;
  process.env.PLATFORM_COMPANY_CVR = originalEnv.platformCvr;
});

test("OIOUBL og Peppol bruger de rigtige endpoint-koder", () => {
  const base = {
    company: { name: "Afsender ApS", cvr: "12345678", currency: "DKK" } as any,
    customer: { name: "Kunde A/S", cvr: "87654321" } as any,
    invoice: { invoiceNumber: "FA-1", issueDate: "2026-09-21", dueDate: "2026-09-29", netAmount: 100, vatAmount: 25, totalAmount: 125 } as any,
    items: [{ description: "Ydelse", quantity: 1, unitPrice: 100, amount: 100, vatRate: 25 }] as any,
  };
  const oioubl = generateEInvoice({ ...base, format: "OIOUBL_2_1" });
  assert.match(oioubl.xml, /schemeID="DK:CVR">DK12345678/);
  assert.match(oioubl.xml, /schemeID="DK:CVR">DK87654321/);

  const peppol = generateEInvoice({ ...base, format: "PEPPOL_BIS_3" });
  assert.match(peppol.xml, /schemeID="0184">DK12345678/);
  assert.match(peppol.xml, /schemeID="0184">DK87654321/);
});

test("Sproom-upload bruger et stabilt X-Request-Id og accepterer dokument-ID", async () => {
  configureSproom();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/child-companies/child-uuid/token")) return new Response(JSON.stringify({ token: "child-token" }), { status: 200 });
    if (String(url).includes("/recipients/")) return new Response("", { status: 200 });
    return new Response("", { status: 201, headers: { "X-Sproom-DocumentId": "document-123" } });
  }) as typeof fetch;

  const result = await providerSend("<Invoice />", "OIOUBL_2_1", "DK87654321", 7);
  assert.equal(result.messageId, "document-123");
  const upload = requests.at(-1)?.init;
  const headers = new Headers(upload?.headers);
  assert.equal(headers.get("X-Request-Id"), sproomRequestId("<Invoice />", "OIOUBL_2_1", "DK87654321"));
  assert.equal(headers.get("X-Request-Id")?.length, 64);
});

test("ADD SmartDrift ApS bruger parent-tokenet direkte og oprettes ikke som child", async () => {
  configureSproom();
  db.insert(companies).values({ id: 7001, name: "ADD SmartDrift ApS", cvr: "46761898" }).onConflictDoNothing().run();
  const requests: Array<{ url: string; authorization: string | null }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    requests.push({ url: target, authorization: new Headers(init?.headers).get("Authorization") });
    if (target.includes("/recipients/")) return new Response("", { status: 200 });
    return new Response("", { status: 201, headers: { "X-Sproom-DocumentId": "parent-document-1" } });
  }) as typeof fetch;

  const status = providerStatus(7001);
  assert.equal(status.parentCompany, true);
  assert.equal(status.companyMapped, true);
  assert.equal(status.configured, true);
  const result = await providerSend("<Invoice />", "OIOUBL_2_1", "DK87654321", 7001);
  assert.equal(result.messageId, "parent-document-1");
  assert.equal(requests.some((request) => request.url.includes("/child-companies/")), false);
  assert.equal(requests.every((request) => request.authorization === "Bearer parent-token"), true);
});

test("Sproom 409 behandles som et sikkert idempotent genforsøg", async () => {
  configureSproom();
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/child-companies/child-uuid/token")) return new Response(JSON.stringify({ token: "child-token" }), { status: 200 });
    if (String(url).includes("/recipients/")) return new Response("", { status: 200 });
    return new Response(JSON.stringify({ documentId: "existing-456", message: "Document already exists for this RequestID" }), { status: 409 });
  }) as typeof fetch;

  const result = await providerSend("<Invoice />", "OIOUBL_2_1", "DK87654321", 7);
  assert.equal(result.messageId, "existing-456");
  assert.equal(result.duplicate, true);
});

test("Sproom-webhook accepterer en PEM-nøgle med escaped CRLF fra Render", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const payload = JSON.stringify({ webhookType: "test", companyId: "company-test" });
  const signature = sign("RSA-SHA256", Buffer.from(payload, "utf8"), privateKey).toString("base64");
  const previous = process.env.SPROOM_WEBHOOK_PUBLIC_KEY;
  try {
    process.env.SPROOM_WEBHOOK_PUBLIC_KEY = pem.replace(/\n/g, "\\r\\n");
    assert.equal(verifySproomSignature(payload, signature), true);
    assert.equal(verifySproomSignature(payload, `sha256=${signature}`), true);
    assert.equal(verifySproomSignature(payload, `"${signature}"`), true);
  } finally {
    if (previous === undefined) delete process.env.SPROOM_WEBHOOK_PUBLIC_KEY;
    else process.env.SPROOM_WEBHOOK_PUBLIC_KEY = previous;
  }
});

test("Sproom-webhook kan bruge udbyderens aktuelle offentlige nøgle", async () => {
  configureSproom();
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const payload = JSON.stringify({ webhookType: "test", companyId: "company-test" });
  const signature = sign("RSA-SHA256", Buffer.from(payload, "utf8"), privateKey).toString("base64");
  const previous = process.env.SPROOM_WEBHOOK_PUBLIC_KEY;
  try {
    process.env.SPROOM_WEBHOOK_PUBLIC_KEY = "ikke-en-gyldig-noegle";
    globalThis.fetch = (async () => new Response(JSON.stringify({
      publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
      signatureAlgorithm: "SHA256withRSA",
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
    assert.equal(await verifySproomWebhookSignature(payload, signature), true);
  } finally {
    if (previous === undefined) delete process.env.SPROOM_WEBHOOK_PUBLIC_KEY;
    else process.env.SPROOM_WEBHOOK_PUBLIC_KEY = previous;
  }
});
