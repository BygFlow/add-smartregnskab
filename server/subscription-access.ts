import type { Subscription } from "@shared/schema";

export type SubscriptionAccessCode = "active" | "trial_expired";

export interface SubscriptionAccessState {
  restricted: boolean;
  code: SubscriptionAccessCode;
  message: string | null;
  trialEndsAt: string | null;
}
function isoDate(value: string | null | undefined): string | null {
  const candidate = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

/**
 * The trial end date is inclusive. A trial ending on 14 October therefore
 * remains usable throughout 14 October and becomes restricted on 15 October.
 *
 * This state is derived instead of persisted, so existing expired trials are
 * protected immediately without a migration or a scheduler run.
 */
export function subscriptionAccessState(
  subscription: Subscription | null | undefined,
  todayIso = new Date().toISOString().slice(0, 10),
  evidence: { hasSettledPayment?: boolean } = {},
): SubscriptionAccessState {
  const today = isoDate(todayIso) ?? new Date().toISOString().slice(0, 10);
  const recordedTrialEnd = isoDate(subscription?.trialEndsAt);
  const trialEndsAt = subscription?.status === "proeve"
    ? recordedTrialEnd ?? isoDate(subscription.currentPeriodEnd)
    : recordedTrialEnd;
  const expiredTrial = Boolean(subscription?.status === "proeve" && trialEndsAt && trialEndsAt < today);
  // Kompatibilitetsværn for konti, som den tidligere faktureringskode nåede
  // at markere aktive ved fakturaoprettelse, selv om betalingen aldrig faldt.
  const legacyUnpaidActivation = Boolean(
    subscription?.status === "aktiv"
      && recordedTrialEnd
      && recordedTrialEnd < today
      && evidence.hasSettledPayment === false,
  );

  if (expiredTrial || legacyUnpaidActivation) {
    return {
      restricted: true,
      code: "trial_expired",
      message: "Prøveperioden er udløbet. Vælg en pakke og opret en betalingsaftale for at fortsætte.",
      trialEndsAt,
    };
  }

  return {
    restricted: false,
    code: "active",
    message: null,
    trialEndsAt,
  };
}
