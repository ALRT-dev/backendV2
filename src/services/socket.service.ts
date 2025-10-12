import type { Hazard } from "@prisma/client";
import ioClient from "../utils/socket_client.util.js";
import prisma from "../utils/prisma_client.util.js";
import { SocketEvent } from "../models/socket_event_types.js";

/// Sends a socket event to multiple users identified by their user IDs.
export const sendSocketEventToUsers = ({
  userIds,
  event,
  data,
}: {
  userIds: string[];
  event: SocketEvent;
  data: any;
}) => {
  userIds.forEach((userId) => {
    ioClient?.to("user_" + userId).emit(event, data);
  });
};

/// Sends socket events to users who have subscribed to the area around the hazard.
export const sendSocketEventAboutNewHazard = async (hazard: Hazard) => {
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
        northeastLat: { gte: latitude - 0.1 },
        northeastLng: { gte: longitude - 0.1 },
        southwestLat: { lte: latitude + 0.1 },
        southwestLng: { lte: longitude + 0.1 },
      },
      select: {
        userId: true,
      },
    });

    const userIds = subscriptions.map((sub) => sub.userId);
    sendSocketEventToUsers({
      userIds,
      event: SocketEvent.newHazard,
      data: hazard,
    });
  } catch (error) {
    console.error("Error sending socket event about new hazard:", error);
  }
};
