import { PushNotificationPreference } from "../enums/notification_preference_types.js";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import { updateUserPushNotificationSettings } from "./user.service.js";
import type { PushNotificationSettings } from "../models/push_notification_settings_interface.js";
import { upsertUserOwnLocationSubscription } from "./location_subscription.service.js";
import { getAllMainHazardCategoryIds } from "./hazard_category.service.js";

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true, locationName: true },
  });
  if (!user || user.latitude === null || user.longitude === null) {
    throw new HttpError(400, "User location must be set before setting radius");
  }

  // Create or update the user's own location subscription when setting radius
  await upsertUserOwnLocationSubscription({
    userId,
    latitude: user.latitude,
    longitude: user.longitude,
    locationName: user.locationName || "My Location",
    radiusKm: radiusInKm,
  });
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

/**
 * Marks the terms of service as accepted for a given user
 * @param userId - The ID of the user
 */
export const acceptTermsOfService = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { isTOSAccepted: true, isOnboardingCompleted: true },
  });
};
