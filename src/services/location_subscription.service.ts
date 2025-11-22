import type { LocationSubscription } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";

/**
 * Retrieves all location subscriptions for a user, optionally filtered by bounding box.
 *
 * @param userId - The ID of the user
 * @param northeastLat - The northeast latitude of the bounding box (optional)
 * @param northeastLng - The northeast longitude of the bounding box (optional)
 * @param southwestLat - The southwest latitude of the bounding box (optional)
 * @param southwestLng - The southwest longitude of the bounding box (optional)
 * @returns An array of LocationSubscription objects
 */
export const getUserLocationSubscriptions = async ({
  userId,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
}: {
  userId: string;
  northeastLat?: number;
  northeastLng?: number;
  southwestLat?: number;
  southwestLng?: number;
}): Promise<LocationSubscription[]> => {
  const subscriptions = await prisma.locationSubscription.findMany({
    where: {
      userId: userId!,
      ...(northeastLat &&
        northeastLng &&
        southwestLat &&
        southwestLng && {
          northeastLat: { lte: northeastLat },
          northeastLng: { lte: northeastLng },
          southwestLat: { gte: southwestLat },
          southwestLng: { gte: southwestLng },
        }),
    },
    orderBy: [
      { isOwnLocation: "desc" }, // Own location subscription first
      { createdAt: "desc" },
    ],
  });

  return subscriptions;
};

/**
 * Retrieves a single location subscription for a user by its ID.
 *
 * @param userId - The ID of the user
 * @param subscriptionId - The ID of the location subscription
 * @returns The LocationSubscription object or null if not found
 */
export const getSingleUserLocationSubscriptionById = async ({
  userId,
  subscriptionId,
}: {
  userId: string;
  subscriptionId: string;
}): Promise<LocationSubscription | null> => {
  const subscription = await prisma.locationSubscription.findFirst({
    where: {
      userId: userId!,
      id: subscriptionId,
    },
  });
  return subscription;
};

/**
 * Retrieves a single location subscription for a user that matches the given bounds.
 *
 * @param userId - The ID of the user
 * @param northeastLat - The northeast latitude of the subscription bounds
 * @param northeastLng - The northeast longitude of the subscription bounds
 * @param southwestLat - The southwest latitude of the subscription bounds
 * @param southwestLng - The southwest longitude of the subscription bounds
 * @returns The matching LocationSubscription or null if none found
 */
export const getSingleUserLocationSubscriptionByBounds = async ({
  userId,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
}: {
  userId: string;
  northeastLat: number;
  northeastLng: number;
  southwestLat: number;
  southwestLng: number;
}): Promise<LocationSubscription | null> => {
  const subscription = await prisma.locationSubscription.findFirst({
    where: {
      userId: userId!,
      northeastLat: { lte: northeastLat },
      northeastLng: { lte: northeastLng },
      southwestLat: { gte: southwestLat },
      southwestLng: { gte: southwestLng },
    },
  });
  return subscription;
};

/**
 * Creates a new location subscription for the user.
 *
 * @param userId - The ID of the user
 * @param northeastLat - The northeast latitude of the subscription bounds
 * @param northeastLng - The northeast longitude of the subscription bounds
 * @param southwestLat - The southwest latitude of the subscription bounds
 * @param southwestLng - The southwest longitude of the subscription bounds
 * @param address - The address of the subscription (optional)
 * @param name - The name of the subscription (optional)
 * @returns The created LocationSubscription
 */
export const createUserLocationSubscription = async ({
  userId,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
  address,
  name,
}: {
  userId: string;
  northeastLat: number;
  northeastLng: number;
  southwestLat: number;
  southwestLng: number;
  address?: string | undefined;
  name?: string | undefined;
}): Promise<LocationSubscription> => {
  return await prisma.locationSubscription.create({
    data: {
      userId,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      ...(address && { address }),
      ...(name && { name }),
    },
  });
};

/**
 * Deletes a location subscription by its ID.
 *
 * @param subscriptionId - The ID of the location subscription to delete
 */
export const deleteUserLocationSubscription = async (
  subscriptionId: string
): Promise<void> => {
  await prisma.locationSubscription.delete({
    where: { id: subscriptionId },
  });
};

/**
 * Creates or updates a user's own location subscription when their lat/lng is updated.
 * This creates a subscription area around the user's location for receiving hazard notifications.
 */
export const upsertUserOwnLocationSubscription = async ({
  userId,
  latitude,
  longitude,
  locationName,
  radiusKm = 10, // Default 10km radius around user's location
}: {
  userId: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  radiusKm?: number;
}) => {
  // Calculate bounding box for the subscription area
  // Rough conversion: 1 degree ≈ 111 km at equator
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

  const northeastLat = latitude + latDelta;
  const northeastLng = longitude + lngDelta;
  const southwestLat = latitude - latDelta;
  const southwestLng = longitude - lngDelta;

  // Check if user already has an own location subscription
  const existingSubscription = await prisma.locationSubscription.findFirst({
    where: {
      userId,
      isOwnLocation: true,
    },
  });

  if (existingSubscription) {
    // Update existing own location subscription
    return await prisma.locationSubscription.update({
      where: { id: existingSubscription.id },
      data: {
        northeastLat,
        northeastLng,
        southwestLat,
        southwestLng,
        name: locationName || "My Location",
        address: locationName || null,
      },
    });
  } else {
    // Create new own location subscription
    return await prisma.locationSubscription.create({
      data: {
        userId,
        northeastLat,
        northeastLng,
        southwestLat,
        southwestLng,
        name: locationName || "My Location",
        address: locationName || null,
        isOwnLocation: true,
      },
    });
  }
};

/**
 * Retrieves user IDs who have location subscriptions within the given bounds.
 *
 * @param northeastLat - The northeast latitude of the bounding box
 * @param northeastLng - The northeast longitude of the bounding box
 * @param southwestLat - The southwest latitude of the bounding box
 * @param southwestLng - The southwest longitude of the bounding box
 * @returns An array of unique user IDs
 */
export const getUserIdsForLocationSubscriptionBounds = async ({
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
}: {
  northeastLat: number;
  northeastLng: number;
  southwestLat: number;
  southwestLng: number;
}): Promise<string[]> => {
  const subscriptions = await prisma.locationSubscription.findMany({
    where: {
      northeastLat: { lte: northeastLat },
      northeastLng: { lte: northeastLng },
      southwestLat: { gte: southwestLat },
      southwestLng: { gte: southwestLng },
    },
    select: {
      userId: true,
    },
  });
  const userIds = subscriptions.map((sub) => sub.userId);
  return [...new Set(userIds)];
};
