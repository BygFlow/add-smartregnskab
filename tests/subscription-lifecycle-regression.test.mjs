import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("expired trials are restricted without deleting accounting data", () => {
  const auth = read("server/auth.ts");
  const routes = read("server/routes.ts");
  assert.match(auth, /subscriptionAccessState\(subscription, todayIso/);
  assert.match(auth, /resolveSubscriptionAccess/);
  assert.match(auth, /invoice\.status === "betalt"/);
  assert.match(auth, /code: "proeveperiode_udloebet"/);
  assert.match(auth, /"\/subscription"[\s\S]*"\/payment"[\s\S]*"\/billing"/);
  assert.doesNotMatch(auth, /subscriptionAccessGuard[\s\S]{0,2500}(delete|remove).*Subscription/i);
  assert.match(routes, /app\.use\("\/api", subscriptionAccessGuard\)/);
  assert.match(routes, /access: a\.subscriptionAccess/);
});
test("trial activation requires settled payment and never bills the free period", () => {
  const domain = read("server/domain.ts");
  const payments = read("server/payments.ts");
  assert.doesNotMatch(domain, /status: sub\.status === "proeve" \? "aktiv"/);
  assert.match(domain, /invoicePeriodStart = sub\.status === "proeve" \? today/);
  assert.match(payments, /status: "aktiv",[\s\S]{0,100}trialEndsAt: null,[\s\S]{0,100}dunningStage: 0/);
  assert.match(payments, /subscriptionAccessState\(subscription, todayIso\)\.restricted/);
  assert.match(payments, /getDefaultPaymentMethod\(subscription\.companyId\)/);
});

test("client presents a recoverable billing-only state", () => {
  const app = read("client/src/App.tsx");
  const subscriptionPage = read("client/src/pages/regnskab-tabs/abonnement.tsx");
  assert.match(app, /access\?\.restricted/);
  assert.match(app, /Vælg pakke og betalingsaftale/);
  assert.match(app, /Alle data for/);
  assert.match(subscriptionPage, /Prøveperioden er udløbet/);
  assert.match(subscriptionPage, /\[1500, 4000, 8000\]/);
});
