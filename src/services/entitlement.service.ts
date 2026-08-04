import { FamilyPlan } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";

/** The RevenueCat entitlement identifier that maps to ALRT+ (`plus`). */
const PLUS_ENTITLEMENT_ID = "plus";

/** Event types that mean the entitlement is (still) active. */
const ACTIVATING_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
]);

/** Event types that mean access has ended. */
const DEACTIVATING_EVENT_TYPES = new Set(["EXPIRATION"]);

// CANCELLATION only turns auto-renew off — access continues until EXPIRATION,
// so it (and BILLING_ISSUE, TRANSFER, TEST) applies no plan change here.

/**
 * The single switch for the whole billing system.
 *
 * Billing is not launched. Until it is, every entitlement check answers
 * yes and new circles start on `plus`, which is exactly today's behaviour.
 * Set BILLING_ENABLED=true and the same code paths start reading the real
 * RevenueCat-synced entitlement on User.plan — nothing else has to change.
 */
export const billingEnabled = (): boolean =>
  process.env.BILLING_ENABLED === "true";

/**
 * Whether the user holds a live ALRT+ entitlement.
 *
 * Pre-launch this is always true. Once billing is on it reads the plan the
 * RevenueCat webhook maintains, treating a lapsed expiry as no entitlement.
 */
export const hasActiveSubscription = async (
  userId: string,
): Promise<boolean> => {
  if (!billingEnabled()) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  if (!user || user.plan !== FamilyPlan.plus) return false;
  return user.planExpiresAt === null || user.planExpiresAt > new Date();
};

/**
 * The plan a newly created circle starts on: `plus` while billing is off so
 * every feature is unlocked, `free` once the entitlement system decides.
 */
export const defaultCirclePlan = (): FamilyPlan =>
  billingEnabled() ? FamilyPlan.free : FamilyPlan.plus;

/**
 * Whether a circle is paused because its host's entitlement lapsed.
 *
 * Paused means check-ins, snapshots and SOS stop for that circle while
 * nothing is deleted. This can only ever be true once billing is switched
 * on, so the paused surfaces stay unreachable until then rather than
 * rendering against a state that cannot occur.
 */
export const isCirclePaused = async (
  hostUserId: string,
): Promise<boolean> => {
  if (!billingEnabled()) return false;
  return !(await hasActiveSubscription(hostUserId));
};

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  store?: string | null;
}

export interface ApplyResult {
  action: "activated" | "deactivated" | "ignored";
  reason?: string;
}

/**
 * Applies a RevenueCat webhook event to the user's ALRT+ entitlement.
 *
 * The app configures RevenueCat with `Purchases.logIn(user.id)`, so
 * `app_user_id` is our `User.id`. Anonymous ids (`$RCAnonymousID:...`) and
 * unknown users are ignored rather than erroring, so RevenueCat does not
 * endlessly retry sandbox or stale events.
 *
 * The user's hosted family circles are kept in sync with the plan.
 */
export const applyRevenueCatEvent = async (
  event: RevenueCatEvent,
): Promise<ApplyResult> => {
  const type = event.type ?? "";
  const userId = event.app_user_id || event.original_app_user_id || "";

  if (!userId || userId.startsWith("$RCAnonymousID:")) {
    return { action: "ignored", reason: "anonymous or missing app_user_id" };
  }

  const entitlementIds = event.entitlement_ids ?? [];
  const concernsPlus =
    entitlementIds.length === 0 || entitlementIds.includes(PLUS_ENTITLEMENT_ID);
  if (!concernsPlus) {
    return { action: "ignored", reason: "event is not for the plus entitlement" };
  }

  let plan: FamilyPlan;
  if (ACTIVATING_EVENT_TYPES.has(type)) {
    plan = FamilyPlan.plus;
  } else if (DEACTIVATING_EVENT_TYPES.has(type)) {
    plan = FamilyPlan.free;
  } else {
    return { action: "ignored", reason: `no plan change for event type ${type}` };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return { action: "ignored", reason: "unknown user id" };
  }

  const planExpiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        planExpiresAt,
        planStore: event.store ?? null,
        planUpdatedAt: new Date(),
      },
    }),
    // Keep the plan of circles this user owns in sync (owner = the payer).
    prisma.familyCircle.updateMany({
      where: { members: { some: { userId: user.id, role: "owner" } } },
      data: { plan },
    }),
  ]);

  return { action: plan === FamilyPlan.plus ? "activated" : "deactivated" };
};
