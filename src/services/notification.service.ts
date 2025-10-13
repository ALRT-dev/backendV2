import type { Hazard } from "@prisma/client";
import { firebaseAdmin } from "../utils/firebase_admin_client.util.js";
import prisma from "../utils/prisma_client.util.js";
import { PushNotificationType } from "../models/push_notification_types.js";

/// A function to get user push notification tokens of a specific user by their user ID.
const getUserPushNotificationTokens = async (userId: string) => {
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

/// Sends a push notification to multiple device tokens.
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

    const response = await firebaseAdmin
      .messaging()
      .sendEachForMulticast(message);

    console.log(
      "Successfully sent push notification:",
      JSON.stringify(response)
    );
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

/// Sends a push notification to a specific user by their user ID.
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

/// Sends push notifications to users who have subscribed to the area around the hazard.
export const sendPushNotificationAboutNewHazard = async (hazard: Hazard) => {
  try {
    const { latitude, longitude, title, reportedById } = hazard;
    if (!latitude || !longitude) {
      console.log(
        "Hazard does not have valid coordinates to send notifications"
      );
      return;
    }

    const subscriptions = await prisma.locationSubscription.findMany({
      where: {
        northeastLat: { gte: latitude },
        northeastLng: { gte: longitude },
        southwestLat: { lte: latitude },
        southwestLng: { lte: longitude },
        // don't notify the user who reported the hazard
        ...(reportedById && { userId: { not: reportedById } }),
      },
      select: {
        user: {
          select: { devices: true },
        },
      },
    });

    const userTokens = subscriptions.flatMap((sub) =>
      sub.user.devices.map((device) => device.deviceToken)
    );

    await sendPushNotificationToTokens({
      tokens: userTokens,
      title: title,
      body: `A new hazard has been reported in your area`,
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
