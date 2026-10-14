import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

import { subscriptionAccessGuard } from "../server/auth";
import { renewSubscriptions } from "../server/payments";
import { storage } from "../server/storage";
import { subscriptionAccessState } from "../server/subscription-access";
import type { Subscription } from "../shared/schema";

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    companyId: 10,
    planId: 2,
    status: "proeve",
    billingCycle: "maanedlig",
    trialEndsAt: "2026-10-14",
    currentPeriodStart: "2026-10-01",
    currentPeriodEnd: "2026-10-14",
    cancelledAt: null,
    startedAt: "2026-10-01T00:00:00.000Z",
    autoRenew: 1,
    aiAddonEnabled: 0,
    paymentMethodId: null,
    dunningStage: 0,
    lastPaymentAttempt: null,
    ...overrides,
  };
}

test("prøveperiodens slutdato er inkluderet, men næste dag er låst", () => {
  assert.equal(subscriptionAccessState(subscription(), "2026-10-14").restricted, false);
  const expired = subscriptionAccessState(subscription(), "2026-10-15");
  assert.equal(expired.restricted, true);
  assert.equal(expired.code, "trial_expired");
  assert.equal(expired.trialEndsAt, "2026-10-14");
});
test("ældre prøveabonnementer bruger periodeudløbet som sikker fallback", () => {
  const state = subscriptionAccessState(subscription({ trialEndsAt: null }), "2026-10-15");
  assert.equal(state.restricted, true);
  assert.equal(state.trialEndsAt, "2026-10-14");
  assert.equal(subscriptionAccessState(subscription({ status: "aktiv" }), "2030-01-01").restricted, false);
});

test("gammel fejlagtig aktivering uden betalt faktura låses bagudrettet", () => {
  const oldActivation = subscription({ status: "aktiv" });
  assert.equal(subscriptionAccessState(oldActivation, "2026-10-15").restricted, false, "uden betalingsbevis foretager den rene hjælper ingen antagelse");
  assert.equal(subscriptionAccessState(oldActivation, "2026-10-15", { hasSettledPayment: false }).restricted, true);
  assert.equal(subscriptionAccessState(oldActivation, "2026-10-15", { hasSettledPayment: true }).restricted, false);
});

function guardResult(path: string, method = "GET") {
  let nextCalled = false;
  let statusCode = 200;
  let payload: any;
  const req = {
    path,
    method,
    auth: {
      isPlatformAdmin: false,
      subscriptionAccess: subscriptionAccessState(subscription(), "2026-10-15"),
    },
  } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { payload = value; return this; },
  } as unknown as Response;
  subscriptionAccessGuard(req, res, (() => { nextCalled = true; }) as NextFunction);
  return { nextCalled, statusCode, payload };
}

test("udløbet prøve kan betale og få hjælp, men ikke læse regnskabsdata", () => {
  assert.equal(guardResult("/subscription").nextCalled, true);
  assert.equal(guardResult("/billing/create-checkout-session", "POST").nextCalled, true);
  assert.equal(guardResult("/support-cases", "POST").nextCalled, true);
  assert.equal(guardResult("/company").nextCalled, true);

  const blocked = guardResult("/invoices");
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.statusCode, 402);
  assert.equal(blocked.payload.code, "proeveperiode_udloebet");
  assert.equal(guardResult("/company", "PATCH").statusCode, 402);
});

test("fornyelsesjobbet opretter ikke et betalingskrav uden aktiv betalingsaftale", async () => {
  const mutable = storage as any;
  const originals = {
    getSubscriptions: mutable.getSubscriptions,
    getDefaultPaymentMethod: mutable.getDefaultPaymentMethod,
  };
  mutable.getSubscriptions = async () => [subscription()];
  mutable.getDefaultPaymentMethod = async () => undefined;

  try {
    const result = await renewSubscriptions("2026-10-15");
    assert.deepEqual(result, { issued: 0, charged: 0, failed: 0, skippedTrial: 0, expiredTrial: 1 });
  } finally {
    mutable.getSubscriptions = originals.getSubscriptions;
    mutable.getDefaultPaymentMethod = originals.getDefaultPaymentMethod;
  }
});

test("fornyelsesjobbet opkræver ikke på prøveperiodens sidste dag", async () => {
  const mutable = storage as any;
  const original = mutable.getSubscriptions;
  mutable.getSubscriptions = async () => [subscription()];
  try {
    const result = await renewSubscriptions("2026-10-14");
    assert.deepEqual(result, { issued: 0, charged: 0, failed: 0, skippedTrial: 1, expiredTrial: 0 });
  } finally {
    mutable.getSubscriptions = original;
  }
});
