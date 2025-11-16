import { HazardSeverity } from "@prisma/client";
import { PushNotificationPreference } from "../enums/notification_preference_types.js";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import { upsertUserOwnLocationSubscription } from "./user.service.js";

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
  const allSeverities = Object.values(HazardSeverity);

  await Promise.all(
    allSeverities.map((severity) =>
      Object.values(PushNotificationPreference).map(async (preference) => {
        return prisma.userPushNotificationSetting.upsert({
          where: {
            userId_settingType_settingKey: {
              userId,
              settingType: `${preference}_severity`,
              settingKey: severity,
            },
          },
          update: {
            isEnabled:
              pushNotificationPreference === preference ||
              pushNotificationPreference === PushNotificationPreference.all,
            updatedAt: new Date(),
          },
          create: {
            userId,
            settingType: `${preference}_severity`,
            settingKey: severity,
            isEnabled:
              pushNotificationPreference === preference ||
              pushNotificationPreference === PushNotificationPreference.all,
          },
        });
      })
    )
  );
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
