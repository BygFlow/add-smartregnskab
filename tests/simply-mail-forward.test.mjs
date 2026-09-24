import test from "node:test";
import assert from "node:assert/strict";
import { ensureSimplyMailForward, forwardConfiguration } from "../scripts/simply-mail-forward.mjs";

const address = `bilag-${"a".repeat(32)}@addsmartregnskab.dk`;
const config = forwardConfiguration({
  DOCUMENT_INBOUND_DOMAIN: "addsmartregnskab.dk",
  SIMPLY_PRODUCT_HANDLE: "addsmartregnskab.dk",
  DOCUMENT_FORWARD_ADDRESS: address,
});

test("only a company-specific token address on the configured product is accepted", () => {
  assert.equal(config.destination, "bilag-system@addsmartregnskab.dk");
  assert.throws(() => forwardConfiguration({ DOCUMENT_INBOUND_DOMAIN: "addsmartregnskab.dk",
    SIMPLY_PRODUCT_HANDLE: "other.dk", DOCUMENT_FORWARD_ADDRESS: address }), /Simply-produktet/);
  assert.throws(() => forwardConfiguration({ DOCUMENT_INBOUND_DOMAIN: "addsmartregnskab.dk",
    SIMPLY_PRODUCT_HANDLE: "addsmartregnskab.dk", DOCUMENT_FORWARD_ADDRESS: "bilag-test@addsmartregnskab.dk" }), /tokenbaseret/);
});

test("dry run reads existing forwards but never creates one", async () => {
  const calls = [];
  const result = await ensureSimplyMailForward({ config, apiKey: "test-key", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ forwards: [] }) };
  } });
  assert.equal(result.status, "dry-run");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/mail\/forwards\/$/);
  assert.equal(calls[0].options.headers.authorization, "Bearer test-key");
});

test("apply creates only the intended forward", async () => {
  const calls = [];
  const result = await ensureSimplyMailForward({ config, apiKey: "test-key", apply: true,
    fetchImpl: async (_url, options) => {
      calls.push(options);
      return calls.length === 1
        ? { ok: true, json: async () => ({ forwards: [] }) }
        : { ok: true };
    } });
  assert.equal(result.status, "created");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1].body), {
    localpart: `bilag-${"a".repeat(32)}`, destination: "bilag-system@addsmartregnskab.dk",
  });
});

test("existing matching forward is idempotent; conflicting destination fails closed", async () => {
  const fetchFor = (destination) => async () => ({ ok: true,
    json: async () => ({ forwards: [{ address, destination }] }) });
  assert.equal((await ensureSimplyMailForward({ config, apiKey: "test-key", apply: true,
    fetchImpl: fetchFor(config.destination) })).status, "exists");
  await assert.rejects(ensureSimplyMailForward({ config, apiKey: "test-key", apply: true,
    fetchImpl: fetchFor("other@example.com") }), /andet sted/);
});

test("an API failure cannot be treated as a created forward", async () => {
  await assert.rejects(ensureSimplyMailForward({ config, apiKey: "test-key",
    fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
});
