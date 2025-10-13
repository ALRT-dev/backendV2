import { HazardVoteType } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";

/// Retrieves a user by their ID, excluding sensitive information like password hash.
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
