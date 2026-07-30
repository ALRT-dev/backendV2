import prisma from "../utils/prisma_client.util.js";

/**
 * Minimal shape of a RevenueCat webhook event we care about.
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  product_id?: string;
  period_type?: string; // NORMAL | TRIAL | INTRO
  expiration_at_ms?: number | null;
  store?: string; // APP_STORE | PLAY_STORE | STRIPE | PROMOTIONAL
  environment?: string; // PRODUCTION | SANDBOX
}

// Events that mean "the entitlement is (still) granted" — activeness is then
// decided by the expiry timestamp.
const GRANTING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
]);

// Events that revoke immediately regardless of expiry.
const REVOKING = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

// Events that carry no entitlement change (identity/bookkeeping/test).
const IGNORED = new Set(["SUBSCRIBER_ALIAS", "TRANSFER", "TEST"]);

/**
 * Apply a single RevenueCat event to a user's ALRT+ entitlement. The app
 * configures RevenueCat with `app_user_id` == our user id, so we match on id.
 * Entitlements are written ONLY here, never by the client.
 */
export const applyRevenueCatEvent = async (
  event: RevenueCatEvent,
): Promise<{ handled: boolean; reason?: string }> => {
  if (!event?.type || !event.app_user_id) {
    return { handled: false, reason: "missing type or app_user_id" };
  }
  if (IGNORED.has(event.type)) {
    return { handled: false, reason: `ignored event ${event.type}` };
  }

  const user = await prisma.user.findUnique({
    where: { id: event.app_user_id },
    select: { id: true },
  });
  if (!user) {
    // Unknown user (e.g. a sandbox tester not in our DB) — ack without error so
    // RevenueCat does not retry forever.
    return { handled: false, reason: "user not found" };
  }

  const expiresAt =
    event.expiration_at_ms != null ? new Date(event.expiration_at_ms) : null;

  let isPlus: boolean;
  if (REVOKING.has(event.type)) {
    isPlus = false;
  } else if (GRANTING.has(event.type) || event.type === "CANCELLATION") {
    // CANCELLATION only turns off auto-renew; access lasts until expiry.
    isPlus = expiresAt ? expiresAt.getTime() > Date.now() : true;
  } else if (event.type === "BILLING_ISSUE") {
    // Keep access through the store grace period (until expiry passes).
    isPlus = expiresAt ? expiresAt.getTime() > Date.now() : false;
  } else {
    // Unknown event type — recompute from expiry conservatively.
    isPlus = expiresAt ? expiresAt.getTime() > Date.now() : false;
  }

  const willRenew =
    GRANTING.has(event.type) && event.type !== "NON_RENEWING_PURCHASE";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isPlus,
      plusStore: event.store ?? null,
      plusProductId: event.product_id ?? null,
      plusExpiresAt: expiresAt,
      plusWillRenew: willRenew,
      plusTrialActive: event.period_type === "TRIAL",
      revenueCatUserId: event.app_user_id,
    },
  });

  return { handled: true };
};
