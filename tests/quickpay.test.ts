import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { handleWebhook, quickpayRequest, quickpayWebhookVerification } from "../server/payments";
import { storage } from "../server/storage";

const originalFetch = globalThis.fetch;
const originalEnv = {
  apiKey: process.env.QUICKPAY_API_KEY,
  privateKey: process.env.QUICKPAY_PRIVATE_KEY,
  appBaseUrl: process.env.APP_BASE_URL,
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.QUICKPAY_API_KEY = originalEnv.apiKey;
  process.env.QUICKPAY_PRIVATE_KEY = originalEnv.privateKey;
  process.env.APP_BASE_URL = originalEnv.appBaseUrl;
});

test("QuickPay API-kald sender versions-, auth- og callback-header", async () => {
  process.env.QUICKPAY_API_KEY = "api-test-key";
  process.env.APP_BASE_URL = "https://app.addsmartregnskab.dk/";
  let captured: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ id: 123 }), { status: 201 });
  }) as typeof fetch;

  const result = await quickpayRequest("POST", "/subscriptions", {
    order_id: "sub1000",
    currency: "DKK",
    description: "Test",
  });

  assert.equal(result.ok, true);
  assert.equal(captured.url, "https://api.quickpay.net/subscriptions");
  const headers = new Headers(captured.init?.headers);
  assert.equal(headers.get("Accept-Version"), "v10");
  assert.equal(headers.get("QuickPay-Callback-Url"), "https://app.addsmartregnskab.dk/api/webhooks/quickpay");
  assert.equal(headers.get("Authorization"), `Basic ${Buffer.from(":api-test-key").toString("base64")}`);
});

test("QuickPay callback valideres over den rå body", () => {
  process.env.QUICKPAY_PRIVATE_KEY = "private-test-key";
  const body = JSON.stringify({ id: 987, type: "Subscription", accepted: true, state: "processed" });
  const signature = createHmac("sha256", "private-test-key").update(body).digest("hex");

  const verified = quickpayWebhookVerification(body, signature);
  assert.equal(verified.valid, true);
  assert.equal(verified.eventType, "subscription.authorized");
  assert.equal(quickpayWebhookVerification(`${body} `, signature).valid, false);
});

test("signeret QuickPay-aftale aktiverer afventende metode som standard", async () => {
  process.env.QUICKPAY_PRIVATE_KEY = "private-test-key";
  const mutable = storage as any;
  const names = [
    "getWebhookEvent", "createWebhookEvent", "updateWebhookEvent", "getCompanies",
    "getPaymentMethods", "clearDefaultPaymentMethods", "updatePaymentMethod",
    "getSubscriptionByCompany", "updateSubscription", "createAuditLog",
  ] as const;
  const originals = Object.fromEntries(names.map((name) => [name, mutable[name]]));
  const methodUpdates: Array<{ id: number; data: Record<string, unknown> }> = [];
  const subscriptionUpdates: Array<Record<string, unknown>> = [];

  mutable.getWebhookEvent = async () => undefined;
  mutable.createWebhookEvent = async (data: any) => ({ id: 1, ...data });
  mutable.updateWebhookEvent = async () => undefined;
  mutable.getCompanies = async () => [{ id: 7 }];
  mutable.getPaymentMethods = async (_companyId: number, includeInactive: boolean) => {
    assert.equal(includeInactive, true, "aktivering skal også kunne finde en afventende metode");
    return [
      { id: 8, companyId: 7, provider: "quickpay", providerRef: "old", status: "aktiv", isDefault: 1 },
      { id: 9, companyId: 7, provider: "quickpay", providerRef: "987", status: "afventer", isDefault: 0 },
    ];
  };
  mutable.clearDefaultPaymentMethods = async () => undefined;
  mutable.updatePaymentMethod = async (id: number, data: Record<string, unknown>) => {
    methodUpdates.push({ id, data });
    return { id, ...data };
  };
  mutable.getSubscriptionByCompany = async () => ({ id: 4 });
  mutable.updateSubscription = async (_id: number, data: Record<string, unknown>) => {
    subscriptionUpdates.push(data);
    return data;
  };
  mutable.createAuditLog = async (data: any) => ({ id: 1, ...data });

  try {
    const body = JSON.stringify({ id: 987, type: "Subscription", accepted: true, state: "processed" });
    const signature = createHmac("sha256", "private-test-key").update(body).digest("hex");
    const result = await handleWebhook("quickpay", body, signature);

    assert.equal(result.action, "betalingsmiddel_aktiveret");
    assert.deepEqual(methodUpdates, [
      { id: 8, data: { status: "fjernet", isDefault: 0 } },
      { id: 9, data: { status: "aktiv", isDefault: 1 } },
    ]);
    assert.deepEqual(subscriptionUpdates, [{ paymentMethodId: 9, autoRenew: 1, cancelledAt: null }]);
  } finally {
    for (const name of names) mutable[name] = originals[name];
  }
});
