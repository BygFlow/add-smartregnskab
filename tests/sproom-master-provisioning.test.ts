import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "smartregnskab-sproom-provisioning-"));
process.env.DATABASE_PATH = join(temp, "registry.db");
process.env.MIGRATIONS_DIR = join(process.cwd(), "migrations");
process.env.EINVOICE_PROVIDER = "sproom";
process.env.SPROOM_API_URL = "https://sproom.test/api";
process.env.SPROOM_PARENT_CVR = "46761898";
process.env.PLATFORM_COMPANY_CVR = "46761898";
process.env.SPROOM_PARENT_NAME = "ADD SmartDrift ApS";

const originalFetch = globalThis.fetch;
const master = await import("../server/sproom-master");
const registry = await import("../server/sproom-registry");

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SPROOM_AUTOMATIC_PROVISIONING;
  delete process.env.SPROOM_AUTO_REGISTER_NEMHANDEL;
  delete process.env.SPROOM_API_TOKEN;
});

function input(companyId: number, cvr: string) {
  return {
    companyId,
    companyName: `Kunde ${companyId} ApS`,
    cvr,
    userEmail: `ejer${companyId}@example.test`,
    sourceProducts: ["add_smartregnskab" as const],
    consentAt: "2026-10-14T17:00:00.000Z",
    consentBy: `ejer${companyId}@example.test`,
  };
}

test("lokal onboarding foretager ingen Sproom-kald før produktionslåsen åbnes", async () => {
  globalThis.fetch = (async () => { throw new Error("fetch må ikke kaldes"); }) as typeof fetch;
  const result = await master.provisionSproomChildCompany(input(301, "30112233"));
  assert.equal(result.action, "await_master_activation");
  assert.equal(result.connection.status, "afventer_sproom");
  assert.equal(result.connection.externalCompanyId, null);
});

test("parent-CVR afvises før der oprettes en child-profil", async () => {
  process.env.SPROOM_AUTOMATIC_PROVISIONING = "true";
  process.env.SPROOM_API_TOKEN = "master-token";
  globalThis.fetch = (async () => { throw new Error("fetch må ikke kaldes"); }) as typeof fetch;
  await assert.rejects(
    master.provisionSproomChildCompany(input(399, "46761898")),
    /parenten.*ikke oprettes som sit eget child-company/i,
  );
  assert.equal(registry.sproomConnectionForCompany(399), null);
});

test("en ny virksomhed oprettes som child og forbindes uden at aktivere NemHandel", async () => {
  process.env.SPROOM_AUTOMATIC_PROVISIONING = "true";
  process.env.SPROOM_API_TOKEN = "master-token";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response("", { status: 200, headers: { Location: "/api/child-companies/child-company-302" } });
  }) as typeof fetch;

  const result = await master.provisionSproomChildCompany(input(302, "30223344"));
  assert.equal(result.action, "child_created");
  assert.equal(result.connection.status, "forbundet");
  assert.equal(result.connection.externalCompanyId, "child-company-302");
  assert.equal(result.connection.nemhandelStatus, "afventer_aktivering");
  assert.equal(requests.length, 1);
  assert.match(String(requests[0].url), /\/api\/child-companies$/);
  assert.equal(new Headers(requests[0].init?.headers).get("Authorization"), "Bearer master-token");
});

test("en eksisterende Sproom-profil starter det officielle tilmeldingsflow", async () => {
  process.env.SPROOM_AUTOMATIC_PROVISIONING = "true";
  process.env.SPROOM_API_TOKEN = "master-token";
  const requests: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    requests.push(target);
    if (target.endsWith("/child-companies")) {
      return new Response(JSON.stringify({ message: "Company already exists" }), { status: 409, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ enrollmentLink: "https://sproom.test/private-one-time-link" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const result = await master.provisionSproomChildCompany(input(303, "30334455"));
  assert.equal(result.action, "enrollment_requested");
  assert.equal(result.connection.status, "afventer_tilmelding");
  assert.equal(result.connection.externalCompanyId, null);
  assert.equal(result.connection.enrollmentId, null);
  assert.equal(requests.length, 2);
  assert.match(requests[1], /\/child-companies\/enrollments$/);
});

test("tilmeldingskaldet følger Sprooms aktuelle kontrakt uden at gemme autentificeringslinket", async () => {
  process.env.SPROOM_AUTOMATIC_PROVISIONING = "true";
  process.env.SPROOM_API_TOKEN = "master-token";
  let enrollmentPayload: Record<string, unknown> = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target.endsWith("/child-companies")) {
      return new Response(JSON.stringify({ childCompanyId: "existing-company-305", message: "Company already exists" }), { status: 409 });
    }
    enrollmentPayload = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({ enrollmentLink: "https://sproom.test/private-one-time-link" }), { status: 200 });
  }) as typeof fetch;

  const result = await master.provisionSproomChildCompany(input(305, "30556677"));
  assert.equal(result.action, "enrollment_requested");
  assert.deepEqual(enrollmentPayload, {
    childCompanyName: "Kunde 305 ApS",
    organizationIdentifier: { schemeId: "DK:CVR", value: "30556677" },
    userEmail: "ejer305@example.test",
    parentCompanyName: "ADD SmartDrift ApS",
    shouldSendEmail: true,
  });
  assert.equal(result.connection.enrollmentId, null);
});

test("NemHandel registreres med et kortlivet child-token, når den særskilte lås åbnes", async () => {
  process.env.SPROOM_AUTOMATIC_PROVISIONING = "true";
  process.env.SPROOM_AUTO_REGISTER_NEMHANDEL = "true";
  process.env.SPROOM_API_TOKEN = "master-token";
  const requests: Array<{ url: string; authorization: string | null; body: string }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    requests.push({ url: target, authorization: new Headers(init?.headers).get("Authorization"), body: String(init?.body || "") });
    if (target.endsWith("/child-companies")) return new Response("", { status: 200, headers: { Location: "/api/child-companies/child-company-304" } });
    if (target.endsWith("/child-companies/child-company-304/token")) return new Response(JSON.stringify({ token: "child-token-304" }), { status: 200 });
    if (target.endsWith("/registrations/nemhandel")) return new Response(JSON.stringify({ networkID: "network-304" }), { status: 200 });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const result = await master.provisionSproomChildCompany(input(304, "30445566"));
  assert.equal(result.connection.nemhandelStatus, "aktiv");
  assert.equal(result.connection.nemhandelNetworkId, "network-304");
  assert.equal(requests.at(-1)?.authorization, "Bearer child-token-304");
  assert.deepEqual(JSON.parse(requests.at(-1)?.body || "{}"), {
    profiles: ["Nes5Customer"],
    endpointId: { schemeId: "DK:CVR", value: "30445566" },
  });
});

test("godkendt enrollment-webhook forbinder den afventende CVR-profil", async () => {
  const result = await master.acceptSproomEnrollment({ cvr: "30334455", externalCompanyId: "existing-company-303" });
  assert.equal(result.status, "forbundet");
  assert.equal(result.nemhandelStatus, "afventer_aktivering");
  assert.equal(result.enrollmentId, null);
});
