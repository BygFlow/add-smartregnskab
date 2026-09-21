import assert from "node:assert/strict";
import test from "node:test";
import { generateEInvoice, providerSend, sproomRequestId } from "../server/einvoice";

const originalFetch = globalThis.fetch;
const originalEnv = {
  provider: process.env.EINVOICE_PROVIDER,
  apiUrl: process.env.SPROOM_API_URL,
  token: process.env.SPROOM_API_TOKEN,
  companyMap: process.env.SPROOM_COMPANY_MAP,
};

function configureSproom() {
  process.env.EINVOICE_PROVIDER = "sproom";
  process.env.SPROOM_API_URL = "https://staging.sproom.test/api";
  process.env.SPROOM_API_TOKEN = "parent-token";
  process.env.SPROOM_COMPANY_MAP = JSON.stringify({ 7: "child-uuid" });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.EINVOICE_PROVIDER = originalEnv.provider;
  process.env.SPROOM_API_URL = originalEnv.apiUrl;
  process.env.SPROOM_API_TOKEN = originalEnv.token;
  process.env.SPROOM_COMPANY_MAP = originalEnv.companyMap;
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
