import { HazardSeverity, type Hazard } from "@prisma/client";
import { firebaseAdmin } from "../utils/firebase_admin_client.util.js";
import prisma from "../utils/prisma_client.util.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import {
  getFormattedHazardSeverity,
  getFormattedHazardSeverityBand,
} from "../utils/hazard.util.js";

/**
 * A function to get user push notification tokens of a specific user by their user ID.
 * Returns empty array if user has initiated account deletion (scheduledDeletionAt is set).
 */
const getUserPushNotificationTokens = async (
  userId: string
): Promise<string[]> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        scheduledDeletionAt: true,
        devices: { select: { deviceToken: true } },
      },
    });

    if (!user) {
      console.log("User not found:", userId);
      return [];
    }

    // Don't send notifications to users who have initiated account deletion
    if (user.scheduledDeletionAt) {
      console.log(
        "User has initiated account deletion, skipping notifications:",
        userId
      );
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
 * A function to get user push notification tokens subscribed to a hazard location and type.
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
      isAwsCompliant,
      severity,
      categoryId,
    } = hazard;

    const isUserReported = reportedById !== null;
    const isOfficialNonAws = !isAwsCompliant && !isUserReported;

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

    // Determine which notification setting field applies to this hazard
    let notificationFilter:
      | { awsEmergency: true }
      | { awsWatchAndAct: true }
      | { awsAdvice: true }
      | { officialNonAws: true }
      | { userReported: true };

    if (isUserReported) {
      notificationFilter = { userReported: true };
    } else if (isOfficialNonAws) {
      notificationFilter = { officialNonAws: true };
    } else if (isAwsCompliant && severity === HazardSeverity.emergency) {
      notificationFilter = { awsEmergency: true };
    } else if (isAwsCompliant && severity === HazardSeverity.watchAndAct) {
      notificationFilter = { awsWatchAndAct: true };
    } else if (isAwsCompliant && severity === HazardSeverity.advice) {
      notificationFilter = { awsAdvice: true };
    } else {
      // Fallback for AWS info/unknown - use awsAdvice
      notificationFilter = { awsAdvice: true };
    }

    // Get the hazard's parent category ID if it exists (for subcategories)
    let parentCategoryId: string | null = null;
    if (categoryId) {
      const category = await prisma.hazardCategory.findUnique({
        where: { id: categoryId },
        select: { parentId: true },
      });
      parentCategoryId = category?.parentId || null;
    }

    // Determine which category ID to check against subscribedCategoryIds
    // If the hazard has a parent category, use that; otherwise use the category itself
    const categoryIdToCheck = parentCategoryId || categoryId;

    // Find subscriptions where the hazard location intersects with the subscription's bounding box
    // For point hazards: check if the point is inside the subscription box
    // For area hazards: check if any part of the hazard area overlaps with the subscription box
    const subscriptions = await prisma.locationSubscription.findMany({
      where: {
        // Bounding box intersection: subscription box overlaps with hazard box
        // Subscription's NE (max) must be >= Hazard's SW (min)
        // Subscription's SW (min) must be <= Hazard's NE (max)
        northeastLat: { gte: hazardSouthwestLat }, // subscription's max lat >= hazard's min lat
        southwestLat: { lte: hazardNortheastLat }, // subscription's min lat <= hazard's max lat
        northeastLng: { gte: hazardSouthwestLng }, // subscription's max lng >= hazard's min lng
        southwestLng: { lte: hazardNortheastLng }, // subscription's min lng <= hazard's max lng

        // don't notify the user who reported the hazard
        ...(reportedById && { userId: { not: reportedById } }),

        // Only get subscriptions for users who have notifications enabled for this hazard type
        // AND have at least one category subscribed (subscribedCategoryIds not empty)
        // AND have NOT initiated account deletion (scheduledDeletionAt is null)
        user: {
          scheduledDeletionAt: null, // Exclude users who have initiated account deletion
          pushNotificationSettings: {
            some: {
              ...notificationFilter,
              subscribedCategoryIds: { has: categoryIdToCheck },
            },
          },
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

    const baseMessage = {
      notification: {
        title,
        body,
      },
      data: {
        payload: JSON.stringify(data),
        notificationType: type.toString(),
      },
    };

    // FCM caps sendEachForMulticast at 500 tokens per call. In a densely
    // subscribed area a single hazard can exceed that, and a too-large array
    // throws — meaning NObody in that area gets the safety alert. Chunk it.
    const FCM_MULTICAST_LIMIT = 500;
    const batches = [];
    for (let i = 0; i < uniqueTokens.length; i += FCM_MULTICAST_LIMIT) {
      batches.push(uniqueTokens.slice(i, i + FCM_MULTICAST_LIMIT));
    }

    const responses = await Promise.all(
      batches.map((tokenBatch) =>
        firebaseAdmin
          .messaging()
          .sendEachForMulticast({ ...baseMessage, tokens: tokenBatch })
      )
    );

    // Return the first batch's response to preserve the previous single-batch
    // return shape for existing callers.
    return responses[0];
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
  const { severity, title, isAwsCompliant, severityBand } = hazard;

  const formattedSeverity = getFormattedHazardSeverity(severity);
  const foramttedSeverityBand = getFormattedHazardSeverityBand(severityBand);

  const requiredSeverity = isAwsCompliant
    ? formattedSeverity
    : foramttedSeverityBand;

  return `${requiredSeverity} | ${title}`;
};

/**
 * Returns the notification body for a new hazard based on its short description or description.
 */
const getNotificationBodyForNewHazard = (hazard: Hazard): string => {
  const { aiSummary, description } = hazard;
  return aiSummary || description || "New hazard reported.";
};
