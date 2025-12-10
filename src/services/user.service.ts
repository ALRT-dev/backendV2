import { HazardVoteType } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";
import { extractS3KeyFromUrl, generatePresignedUrl } from "./s3.service.js";
import type { PushNotificationSettings } from "../models/push_notification_settings_interface.js";

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

    // Add presigned URL for profile picture if it exists
    if (user.profilePictureUrl) {
      try {
        const s3Key = extractS3KeyFromUrl(user.profilePictureUrl);
        if (s3Key) {
          (user as any)["profilePicturePresignedUrl"] =
            await generatePresignedUrl(s3Key);
        }
      } catch (error) {
        console.error(
          "Error generating presigned URL for profile picture:",
          error
        );
        // Don't fail the request if presigned URL generation fails
      }
    }
  }

  return user;
};

/**
 * Retrieves the push notification settings for a given user.
 * @param userId - The ID of the user
 */
export const getUserPushNotificationSettings = async (
  userId: string
): Promise<PushNotificationSettings> => {
  const settings = await prisma.userPushNotificationSetting.findUnique({
    where: { userId },
  });

  const defaultSettings: PushNotificationSettings = {
    awsEmergency: false,
    awsWatchAndAct: false,
    awsAdvice: false,
    officialNonAws: false,
    userReported: false,
    subscribedCategoryIds: [],
  };

  return settings || defaultSettings;
};

/**
 * Updates the push notification settings for a given user.
 * If settings do not exist, they will be created.
 *
 * @param userId - The ID of the user
 * @param settings - The new push notification settings
 */
export const updateUserPushNotificationSettings = async (
  userId: string,
  settings: PushNotificationSettings
): Promise<PushNotificationSettings> => {
  return await prisma.userPushNotificationSetting.upsert({
    where: { userId },
    create: {
      userId,
      ...settings,
    },
    update: {
      ...settings,
    },
  });
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
