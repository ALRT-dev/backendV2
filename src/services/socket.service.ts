import type { Hazard } from "@prisma/client";
import { getSocketClient } from "../utils/socket_client.util.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { getUserIdsForLocationSubscriptionBounds } from "./location_subscription.service.js";

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
  excludeUserIds,
}: {
  hazard: Hazard;
  socketEvent: SocketEvent;
  excludeUserIds?: string[];
}) => {
  try {
    const {
      latitude,
      longitude,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
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

    const userIds = await getUserIdsForLocationSubscriptionBounds({
      northeastLat: hazardNortheastLat,
      northeastLng: hazardNortheastLng,
      southwestLat: hazardSouthwestLat,
      southwestLng: hazardSouthwestLng,
    });

    const filteredUserIds = userIds.filter(
      (id) => !excludeUserIds?.includes(id)
    );

    sendSocketEventToUsers({
      userIds: filteredUserIds,
      event: socketEvent,
      data: hazard,
    });
  } catch (error) {
    console.error("Error sending socket event about new hazard:", error);
  }
};
