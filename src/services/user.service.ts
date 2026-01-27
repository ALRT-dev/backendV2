import { HazardVoteType } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";
import {
  deleteFileFromS3,
  deleteMultipleFilesFromS3,
  extractS3KeyFromUrl,
  generatePresignedUrl,
} from "./s3.service.js";
import type { PushNotificationSettings } from "../models/push_notification_settings_interface.js";

/** Grace period in days before account is permanently deleted */
const DELETION_GRACE_PERIOD_DAYS = 30;

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

    // Add account deletion status if scheduled
    if (user.scheduledDeletionAt) {
      (user as any)["isScheduledForDeletion"] = true;
      (user as any)["daysUntilDeletion"] = Math.ceil(
        (user.scheduledDeletionAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    } else {
      (user as any)["isScheduledForDeletion"] = false;
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

/**
 * Requests account deletion for a user.
 * Sets the deletion request timestamp and schedules the deletion for 30 days from now.
 *
 * @param userId - The ID of the user requesting deletion
 * @returns The updated user with deletion schedule info
 */
export const requestAccountDeletion = async (userId: string) => {
  const now = new Date();
  const scheduledDeletionAt = new Date(now);
  scheduledDeletionAt.setDate(
    scheduledDeletionAt.getDate() + DELETION_GRACE_PERIOD_DAYS
  );

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      deletionRequestedAt: now,
      scheduledDeletionAt: scheduledDeletionAt,
    },
    select: {
      id: true,
      email: true,
      deletionRequestedAt: true,
      scheduledDeletionAt: true,
    },
  });

  return user;
};

/**
 * Cancels a scheduled account deletion.
 *
 * @param userId - The ID of the user canceling deletion
 * @returns The updated user
 */
export const cancelAccountDeletion = async (userId: string) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      deletionRequestedAt: null,
      scheduledDeletionAt: null,
    },
    select: {
      id: true,
      email: true,
      deletionRequestedAt: true,
      scheduledDeletionAt: true,
    },
  });

  return user;
};

/**
 * Checks if a user has a scheduled deletion.
 *
 * @param userId - The ID of the user to check
 * @returns Deletion status info or null if no deletion is scheduled
 */
export const getAccountDeletionStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      deletionRequestedAt: true,
      scheduledDeletionAt: true,
    },
  });

  if (!user || !user.scheduledDeletionAt) {
    return null;
  }

  return {
    deletionRequestedAt: user.deletionRequestedAt,
    scheduledDeletionAt: user.scheduledDeletionAt,
    daysRemaining: Math.ceil(
      (user.scheduledDeletionAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
  };
};

/**
 * Executes permanent account deletion for a user.
 * This performs a hard delete with data anonymization for hazards.
 *
 * Steps:
 * 1. Delete profile picture from S3
 * 2. Delete hazard media uploaded by user from S3
 * 3. Anonymize hazards reported by the user (set reportedById to null)
 * 4. Delete all related records (votes, views, devices, subscriptions, notification settings, media records)
 * 5. Delete the user record
 *
 * @param userId - The ID of the user to delete
 */
export const executeAccountDeletion = async (userId: string): Promise<void> => {
  // Get user data for cleanup
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      profilePictureUrl: true,
    },
  });

  if (!user) {
    console.log(`User ${userId} not found, skipping deletion`);
    return;
  }

  // Step 1: Delete profile picture from S3
  if (user.profilePictureUrl) {
    try {
      const s3Key = extractS3KeyFromUrl(user.profilePictureUrl);
      if (s3Key) {
        await deleteFileFromS3(s3Key);
        console.log(`Deleted profile picture for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error deleting profile picture for user ${userId}:`, error);
      // Continue with deletion even if S3 deletion fails
    }
  }

  // Step 2: Get and delete hazard media uploaded by user from S3
  const userHazardMedias = await prisma.hazardMedia.findMany({
    where: { userId: userId },
    select: { s3Key: true },
  });

  if (userHazardMedias.length > 0) {
    const s3Keys = userHazardMedias
      .map((media) => media.s3Key)
      .filter((key): key is string => key !== null);

    if (s3Keys.length > 0) {
      try {
        await deleteMultipleFilesFromS3(s3Keys);
        console.log(
          `Deleted ${s3Keys.length} hazard media files for user ${userId}`
        );
      } catch (error) {
        console.error(
          `Error deleting hazard media files for user ${userId}:`,
          error
        );
        // Continue with deletion even if S3 deletion fails
      }
    }
  }

  // Use a transaction for database operations
  await prisma.$transaction(async (tx) => {
    // Step 3: Anonymize hazards reported by user (set reportedById to null)
    await tx.hazard.updateMany({
      where: { reportedById: userId },
      data: { reportedById: null },
    });
    console.log(`Anonymized hazards for user ${userId}`);

    // Step 4: Delete related records
    // Delete hazard votes by user
    await tx.hazardVote.deleteMany({
      where: { userId: userId },
    });

    // Delete hazard views by user
    await tx.hazardView.deleteMany({
      where: { userId: userId },
    });

    // Delete hazard media records (S3 files already deleted above)
    await tx.hazardMedia.deleteMany({
      where: { userId: userId },
    });

    // Delete user devices
    await tx.userDevice.deleteMany({
      where: { userId: userId },
    });

    // Delete location subscriptions
    await tx.locationSubscription.deleteMany({
      where: { userId: userId },
    });

    // Delete push notification settings (has onDelete: Cascade, but being explicit)
    await tx.userPushNotificationSetting.deleteMany({
      where: { userId: userId },
    });

    // Step 5: Delete the user record
    await tx.user.delete({
      where: { id: userId },
    });

    console.log(`Successfully deleted user ${userId} and all associated data`);
  });
};

/**
 * Processes all scheduled account deletions that are past their deletion date.
 * This should be called by a cron job (e.g., daily).
 *
 * @returns The number of accounts deleted
 */
export const processScheduledAccountDeletions = async (): Promise<number> => {
  const now = new Date();

  // Find all users whose scheduled deletion date has passed
  const usersToDelete = await prisma.user.findMany({
    where: {
      scheduledDeletionAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (usersToDelete.length === 0) {
    console.log("No accounts scheduled for deletion");
    return 0;
  }

  console.log(`Processing ${usersToDelete.length} scheduled account deletions`);

  let deletedCount = 0;
  for (const user of usersToDelete) {
    try {
      await executeAccountDeletion(user.id);
      deletedCount++;
      console.log(`Deleted account: ${user.email}`);
    } catch (error) {
      console.error(`Failed to delete account ${user.email}:`, error);
    }
  }

  console.log(
    `Completed scheduled deletions: ${deletedCount}/${usersToDelete.length} successful`
  );
  return deletedCount;
};
