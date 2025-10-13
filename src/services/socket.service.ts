import type { Hazard } from "@prisma/client";
import { getSocketClient } from "../utils/socket_client.util.js";
import prisma from "../utils/prisma_client.util.js";
import { SocketEvent } from "../models/socket_event_types.js";

/**
 * Sends a socket event to multiple users identified by their user IDs.
 */
export const sendSocketEventToUsers = ({
  userIds,
  event,
  data,
}: {
  userIds: string[];
  event: SocketEvent;
  data: any;
}) => {
  // Remove duplicate user IDs
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    console.log("No user IDs provided for socket event.");
    return;
  }

  console.log(`Sending socket event '${event}' to users:`, uniqueUserIds);

  const ioClient = getSocketClient();
  uniqueUserIds.forEach((userId) => {
    ioClient?.to("user_" + userId).emit(event, data);
  });
};

/**
 * Sends a socket event about a new hazard to users subscribed to the hazard's location.
 */
export const sendSocketEventAboutHazardToSubscribers = async ({
  hazard,
  socketEvent,
}: {
  hazard: Hazard;
  socketEvent: SocketEvent;
}) => {
  try {
    const { latitude, longitude } = hazard;
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
      },
      select: {
        userId: true,
      },
    });

    const userIds = subscriptions.map((sub) => sub.userId);
    sendSocketEventToUsers({
      userIds,
      event: socketEvent,
      data: hazard,
    });
  } catch (error) {
    console.error("Error sending socket event about new hazard:", error);
  }
};
