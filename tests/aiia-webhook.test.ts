import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { parseAiiaWebhook, verifyAiiaWebhookSignature } from "../server/aiia";

test("verifies the official X-Viia-Signature HMAC format", () => {
  const raw = JSON.stringify({ consentRevokedWebhook: { consentId: "consent-1", data: null, event: "ConsentRevoked" } });
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  assert.equal(verifyAiiaWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyAiiaWebhookSignature(`${raw} `, signature, secret), false);
  assert.equal(verifyAiiaWebhookSignature(raw, "not-a-signature", secret), false);
});

test("parses Mastercard AiiA webhook envelopes", () => {
  assert.deepEqual(parseAiiaWebhook({
    accountsUpdatedWebhook: {
      consentId: "consent-2",
      data: { changedAccounts: [] },
      event: "AccountsUpdated",
    },
  }), {
    consentId: "consent-2",
    data: { changedAccounts: [] },
    event: "AccountsUpdated",
  });
  assert.equal(parseAiiaWebhook({ nope: { event: "AccountsUpdated" } }), null);
});
