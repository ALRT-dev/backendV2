import { PushNotificationPreference } from "../enums/notification_preference_types.js";
import prisma from "../utils/prisma_client.util.js";
import { updateUserPushNotificationSettings } from "./user.service.js";
import type { PushNotificationSettings } from "../models/push_notification_settings_interface.js";
import { updateUserOwnLocationSubscriptionRadius } from "./location_subscription.service.js";
import { getAllMainHazardCategoryIds } from "./hazard_category.service.js";
import { recordXpEvent } from "./xp_ledger.service.js";
import { XpEventType } from "@prisma/client";

/**
 * Marks the disclaimer as accepted for a given user
 * @param userId - The ID of the user
 */
export const acceptDisclaimer = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isDisclaimerAccepted: true,
    },
  });
};

/**
 * Marks the terms of service as accepted for a given user
 * @param userId - The ID of the user
 */
export const acceptTermsOfService = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isTOSAccepted: true,

      // Also accept the privacy policy as it is part of the terms of service.
      isPrivacyPolicyAccepted: true,

      // Complete the onboarding process.
      isOnboardingCompleted: true,
    },
  });

  await awardOnboardingXp(userId);
};

/**
 * Awards the one-off 20 XP for finishing onboarding, through the ledger.
 *
 * This used to be a bare `xpPoints: { increment: 20 }` on the user row, so
 * a person's very first 20 points had no entry in their points history:
 * the total said 20 and the history explained none of it. Every other
 * award goes through recordXpEvent, and now so does this one.
 *
 * Idempotent on the ledger rather than on a boolean, so re-running the
 * step (or a client retry) cannot pay twice.
 */
const awardOnboardingXp = async (userId: string): Promise<void> => {
  try {
    const existing = await prisma.xpEvent.findFirst({
      where: { userId, type: XpEventType.onboardingCompleted },
      select: { id: true },
    });
    if (existing) return;

    await recordXpEvent({
      userId,
      type: XpEventType.onboardingCompleted,
    });
  } catch (error) {
    // Onboarding must complete even if the award fails.
    console.error("Onboarding XP award failed:", { userId, error });
  }
};

/**
 * Sets the user's location information during onboarding
 * @param userId - The ID of the user
 * @param latitude - The latitude of the user's location
 * @param longitude - The longitude of the user's location
 * @param locationName - The name of the user's location
 */
export const setUserLocation = async ({
  userId,
  latitude,
  longitude,
  locationName,
}: {
  userId: string;
  latitude: number;
  longitude: number;
  locationName: string;
}): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      latitude,
      longitude,
      locationName,
    },
  });
};

/**
 * Sets the user's subscription radius and creates/updates their own location subscription
 * @param userId - The ID of the user
 * @param radiusInKm - The subscription radius in kilometers
 */
export const setUserRadius = async ({
  userId,
  radiusInKm,
}: {
  userId: string;
  radiusInKm: number;
}): Promise<void> => {
  await updateUserOwnLocationSubscriptionRadius(userId, radiusInKm);
};

/**
 * Sets the user's notification preferences during onboarding
 * @param userId - The ID of the user
 * @param pushNotificationPreference - The user's push notification preference
 */
export const setPushNotificationPreference = async ({
  userId,
  pushNotificationPreference,
}: {
  userId: string;
  pushNotificationPreference: PushNotificationPreference;
}): Promise<void> => {
  const enableCrowdSourced =
    pushNotificationPreference === PushNotificationPreference.userReported ||
    pushNotificationPreference === PushNotificationPreference.all;

  const enableOfficial =
    pushNotificationPreference === PushNotificationPreference.official ||
    pushNotificationPreference === PushNotificationPreference.all;

  const mainCategoryIds = await getAllMainHazardCategoryIds();

  const settings: PushNotificationSettings = {
    awsEmergency: enableOfficial,
    awsWatchAndAct: enableOfficial,
    awsAdvice: enableOfficial,
    officialNonAws: enableOfficial,
    userReported: enableCrowdSourced,
    subscribedCategoryIds: mainCategoryIds,
  };

  await updateUserPushNotificationSettings(userId, settings);
};

// completeOnboarding used to live here: a second, unreferenced copy of the
// same step carrying its own unguarded `xpPoints: { increment: 20 }`. It was
// never routed, so it paid nobody, but wiring it up would have handed out
// onboarding XP twice with no ledger row either time. Deleted rather than
// left as a trap; acceptTermsOfService is the one path that completes
// onboarding.
