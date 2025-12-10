import { UserReportsStatus } from "../enums/user_reports_status_types.js";
import { HazardVoteType } from "@prisma/client";
import prisma from "./prisma_client.util.js";

/**
 * Efficiently calculates user report status for multiple users in a single batch operation
 * This replaces individual calculateUserReportsStatus calls to avoid N+1 queries
 *
 * Logic:
 * - If the last 3 hazards each have at least 5 upvotes (excluding the user's own votes), the status is 'verified'.
 * - If the last 3 hazards each have at least 3 upvotes (excluding the user's own votes), the status is 'emerging'.
 * - Otherwise, the status is 'unverified'.
 */
export const calculateBulkUserReportsStatus = async (
  userIds: string[]
): Promise<Map<string, UserReportsStatus>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  // Get last 3 hazards for each user in a single query
  const hazardsByUser = await prisma.hazard.findMany({
    where: {
      reportedById: { in: userIds },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      reportedById: true,
      createdAt: true,
    },
  });

  // Group hazards by user and get only the last 3 for each
  const userHazardsMap = new Map<string, string[]>();

  for (const userId of userIds) {
    const userHazards = hazardsByUser
      .filter((h) => h.reportedById === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3)
      .map((h) => h.id);

    userHazardsMap.set(userId, userHazards);
  }

  // Get all hazard IDs that we need to check votes for
  const allHazardIds = Array.from(userHazardsMap.values()).flat();

  if (allHazardIds.length === 0) {
    // No hazards found for any user, all are unverified
    return new Map(userIds.map((id) => [id, UserReportsStatus.unverified]));
  }

  // Get upvote counts for all hazards in a single query
  const hazardVoteCounts = await prisma.hazardVote.groupBy({
    by: ["hazardId"],
    where: {
      hazardId: { in: allHazardIds },
      voteType: HazardVoteType.upvote,
      NOT: {
        userId: { in: userIds }, // Exclude votes from the users themselves
      },
    },
    _count: {
      id: true,
    },
  });

  // Create a map of hazardId -> upvote count
  const hazardUpvoteMap = new Map<string, number>();
  for (const vote of hazardVoteCounts) {
    hazardUpvoteMap.set(vote.hazardId, vote._count.id);
  }

  // Calculate status for each user
  const statusMap = new Map<string, UserReportsStatus>();

  for (const userId of userIds) {
    const userHazardIds = userHazardsMap.get(userId) || [];

    if (userHazardIds.length < 3) {
      // User doesn't have 3 hazards, so status is unverified
      statusMap.set(userId, UserReportsStatus.unverified);
      continue;
    }

    // Get upvote counts for this user's last 3 hazards
    const upvoteCounts = userHazardIds.map(
      (hazardId) => hazardUpvoteMap.get(hazardId) || 0
    );

    // Check if all 3 hazards meet the criteria for each status
    const allHaveMinUpvotes = (minUpvotes: number) =>
      upvoteCounts.every((count) => count >= minUpvotes);

    let status = UserReportsStatus.unverified;
    if (allHaveMinUpvotes(5)) {
      status = UserReportsStatus.verified;
    } else if (allHaveMinUpvotes(3)) {
      status = UserReportsStatus.emerging;
    }

    statusMap.set(userId, status);
  }

  return statusMap;
};

/**
 * Optimized function to get user report status based on pre-fetched upvote data
 * Use this when you already have upvote counts for the user's last 3 hazards
 */
export const calculateUserStatusFromUpvotes = (
  upvoteCounts: number[]
): UserReportsStatus => {
  if (upvoteCounts.length < 3) {
    return UserReportsStatus.unverified;
  }

  const allHaveMinUpvotes = (minUpvotes: number) =>
    upvoteCounts.every((count) => count >= minUpvotes);

  if (allHaveMinUpvotes(5)) {
    return UserReportsStatus.verified;
  } else if (allHaveMinUpvotes(3)) {
    return UserReportsStatus.emerging;
  }

  return UserReportsStatus.unverified;
};
