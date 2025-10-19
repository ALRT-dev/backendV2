import { HazardVoteType } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";

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

  // Get last 3 hazards reported by this user and calculate user reports status
  const userReportsStatusPromise = calculateUserReportsStatus(userId);

  const [user, upvotesReceivedCount, userReportsStatus] = await Promise.all([
    userPromise,
    upvotesReceivedCountPromise,
    userReportsStatusPromise,
  ]);

  if (user) {
    // rename _count fields for clarity and add additional fields
    (user as any)["hazardsViewedCount"] = user._count.hazardViews;
    (user as any)["hazardsReportedCount"] = user._count.hazardsReported;
    (user as any)["upvotesReceivedCount"] = upvotesReceivedCount;
    (user as any)["reportsStatus"] = userReportsStatus;
    delete (user as any)._count;
  }

  return user;
};

/**
 * Calculates the UserReportsStatus for a given user based on their last 3 hazard reports.
 *
 * If the last 3 hazards each have at least 5 upvotes (excluding the user's own votes), the status is 'verified'.
 * If the last 3 hazards each have at least 3 upvotes (excluding the user's own votes), the status is 'emerging'.
 * Otherwise, the status is 'unverified'.
 */
export const calculateUserReportsStatus = async (
  userId: string
): Promise<UserReportsStatus> => {
  // Get last 3 hazards reported by this user
  const lastThreeHazards = await prisma.hazard.findMany({
    where: {
      reportedById: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
    select: {
      id: true,
    },
  });

  let userReportsStatus = UserReportsStatus.unverified;

  if (lastThreeHazards.length === 3) {
    // Get upvote counts for each of the last 3 hazards
    const hazardUpvoteCounts = await Promise.all(
      lastThreeHazards.map((hazard) =>
        prisma.hazardVote.count({
          where: {
            hazardId: hazard.id,
            voteType: HazardVoteType.upvote,
            NOT: {
              userId: userId, // Exclude user's own votes
            },
          },
        })
      )
    );

    // Check if all 3 hazards meet the criteria for each status
    const allHaveMinUpvotes = (minUpvotes: number) =>
      hazardUpvoteCounts.every((count) => count >= minUpvotes);

    if (allHaveMinUpvotes(5)) {
      userReportsStatus = UserReportsStatus.verified;
    } else if (allHaveMinUpvotes(3)) {
      userReportsStatus = UserReportsStatus.emerging;
    } else {
      userReportsStatus = UserReportsStatus.unverified;
    }
  }

  return userReportsStatus;
};
