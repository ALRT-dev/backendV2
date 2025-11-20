import { type Hazard } from "@prisma/client";
import { firebaseAdmin } from "../utils/firebase_admin_client.util.js";
import prisma from "../utils/prisma_client.util.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import { getFormattedHazardSeverity } from "../utils/hazard.util.js";

/**
 * A function to get user push notification tokens of a specific user by their user ID.
 */
const getUserPushNotificationTokens = async (
  userId: string
): Promise<string[]> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { devices: { select: { deviceToken: true } } },
    });

    if (!user) {
      console.log("User not found:", userId);
      return [];
    }

    return user.devices.map((device) => device.deviceToken);
  } catch (error) {
    console.error(
      `Error fetching user push notification tokens for ${userId}:`,
      error
    );
    return [];
  }
};

/**
 * A function to get user push notification tokens subscribed to a hazard location and severity.
 * Supports both point-based and bounding-box based hazard locations.
 * Uses bounding box intersection to match hazards with subscriptions.
 */
const getUserPushNotificationTokensSubscribedToHazard = async (
  hazard: Hazard
): Promise<string[]> => {
  try {
    const {
      latitude,
      longitude,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      reportedById,
      severity,
    } = hazard;

    // Determine the hazard's bounding box
    let hazardNortheastLat: number;
    let hazardNortheastLng: number;
    let hazardSouthwestLat: number;
    let hazardSouthwestLng: number;

    if (northeastLat && northeastLng && southwestLat && southwestLng) {
      // Use explicit bounding box if provided (for general/broad locations)
      hazardNortheastLat = northeastLat;
      hazardNortheastLng = northeastLng;
      hazardSouthwestLat = southwestLat;
      hazardSouthwestLng = southwestLng;
    } else if (latitude && longitude) {
      // For point-based hazards, use the exact point
      hazardNortheastLat = latitude;
      hazardNortheastLng = longitude;
      hazardSouthwestLat = latitude;
      hazardSouthwestLng = longitude;
    } else {
      console.log(
        "Hazard does not have valid coordinates or bounding box to send notifications"
      );
      return [];
    }

    // Find subscriptions where the hazard location falls within the subscription's bounding box
    // For point hazards: check if the point is inside the subscription box
    // For area hazards: check if any part of the hazard area overlaps with the subscription box
    const subscriptions = await prisma.locationSubscription.findMany({
      where: {
        // Check if hazard falls within subscription's bounding box
        AND: [
          { northeastLat: { gte: hazardSouthwestLat } }, // subscription's north is at or above hazard's south
          { northeastLng: { gte: hazardSouthwestLng } }, // subscription's east is at or right of hazard's west
          { southwestLat: { lte: hazardNortheastLat } }, // subscription's south is at or below hazard's north
          { southwestLng: { lte: hazardNortheastLng } }, // subscription's west is at or left of hazard's east
        ],

        // don't notify the user who reported the hazard
        ...(reportedById && { userId: { not: reportedById } }),

        // Only get subscriptions for users who have notifications enabled for this severity
        // OR users who don't have any explicit setting (default to enabled)
        user: {
          OR: [
            // Users who don't have any setting for this severity (default to enabled)
            {
              pushNotificationSettings: {
                none: {
                  settingType: "severity",
                  settingKey: severity,
                },
              },
            },
            // Users who have the setting enabled
            {
              pushNotificationSettings: {
                some: {
                  settingType: "severity",
                  settingKey: severity,
                  isEnabled: true,
                },
              },
            },
          ],
        },
      },
      select: {
        user: {
          select: {
            devices: true,
          },
        },
      },
    });

    const userTokens = subscriptions.flatMap((sub) =>
      sub.user.devices.map((device) => device.deviceToken)
    );

    return userTokens;
  } catch (error) {
    console.error("Error fetching user tokens subscribed to hazardå:", error);
    return [];
  }
};
/**
 * Sends push notifications to a list of device tokens.
 */
const sendPushNotificationToTokens = async ({
  tokens,
  title,
  body,
  data,
  type,
}: {
  tokens: string[];
  title: string;
  body: string;
  data: object;
  type: PushNotificationType;
}) => {
  try {
    // Remove duplicate tokens
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log("No tokens to send notification to.");
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        payload: JSON.stringify(data),
        notificationType: type.toString(),
      },
      tokens: uniqueTokens,
    };

    return firebaseAdmin.messaging().sendEachForMulticast(message);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

/**
 * Sends a push notification to a specific user by their user ID.
 */
export const sendPushNotificationToUser = async ({
  userId,
  title,
  body,
  data,
  type,
}: {
  userId: string;
  title: string;
  body: string;
  data: object;
  type: PushNotificationType;
}) => {
  try {
    // Fetch user tokens from your database
    const userTokens = await getUserPushNotificationTokens(userId);

    if (userTokens.length === 0) {
      console.log("No tokens found for user:", userId);
      return;
    }

    await sendPushNotificationToTokens({
      tokens: userTokens,
      title,
      body,
      data,
      type,
    });
  } catch (error) {
    console.error("Error sending push notification to user:", error);
  }
};

/**
 * Sends push notifications to users subscribed to the location of a new hazard.
 */
export const sendPushNotificationAboutNewHazard = async (hazard: Hazard) => {
  try {
    const userTokens = await getUserPushNotificationTokensSubscribedToHazard(
      hazard
    );

    await sendPushNotificationToTokens({
      tokens: userTokens,
      title: getNotificationTitleForNewHazard(hazard),
      body: getNotificationBodyForNewHazard(hazard),
      data: hazard,
      type: PushNotificationType.viewHazard,
    });
  } catch (error) {
    console.error(
      "Error sending push notifications to subscribed users:",
      error
    );
  }
};

/**
 * Returns the notification title for a new hazard based on its severity and title.
 */
const getNotificationTitleForNewHazard = (hazard: Hazard): string => {
  const { severity, title } = hazard;
  return `${getFormattedHazardSeverity(severity)} | ${title}`;
};

/**
 * Returns the notification body for a new hazard based on its short description or description.
 */
const getNotificationBodyForNewHazard = (hazard: Hazard): string => {
  const { description } = hazard;
  return description || "A new alrt has been reported.";
};
