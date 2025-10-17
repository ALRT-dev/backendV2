import { HazardVoteType } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";

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
 * Retrieves a user by their ID, excluding sensitive information like password hash.
 */
export const getUserById = async (userId: string) => {
  const userPromise = prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          hazardViews: true,
          hazardsReported: true,
        },
      },
    },
    omit: { passwordHash: true },
  });

  // Get upvotes received count by counting votes on hazards reported by this user
  const upvotesReceivedCountPromise = prisma.hazardVote.count({
    where: {
      voteType: HazardVoteType.upvote,
      hazard: {
        reportedById: userId,
      },
      NOT: {
        userId: userId,
      },
    },
  });

  const [user, upvotesReceivedCount] = await Promise.all([
    userPromise,
    upvotesReceivedCountPromise,
  ]);

  if (user) {
    // rename _count fields for clarity and add upvotesReceivedCount
    (user as any)["hazardsViewedCount"] = user._count.hazardViews;
    (user as any)["hazardsReportedCount"] = user._count.hazardsReported;
    (user as any)["upvotesReceivedCount"] = upvotesReceivedCount;
    delete (user as any)._count;
  }

  return user;
};
