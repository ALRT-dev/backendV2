import type { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { calculateXpPoints } from "../services/xpPoints.service.js";
import { getXpSummary } from "../services/xp_ledger.service.js";
import { getBadgesFor } from "../services/badge.service.js";

/// Controller to get user's XP points breakdown and statistics
export const getUserXpBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    // Get user's current stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        xpPoints: true,
        reliabilityScore: true,
        _count: {
          select: {
            hazardsReported: true,
            hazardVotes: true,
            hazardViews: true,
          },
        },
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    // Get breakdown of user's reported hazards
    const reportedHazards = await prisma.hazard.findMany({
      where: { reportedById: userId },
      select: {
        id: true,
        title: true,
        reviewStatus: true,
        aiConfidence: true,
        severity: true,
        upvoteCount: true,
        downvoteCount: true,
        viewCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate what XP should be for each hazard (for transparency)
    const hazardBreakdowns = reportedHazards.map((hazard) => {
      const baseCalculation = calculateXpPoints({
        confidence: hazard.aiConfidence || ("medium" as any),
        severity: hazard.severity,
        reviewStatus: hazard.reviewStatus,
        userReliabilityScore: user.reliabilityScore,
      });

      // Calculate engagement XP separately (this is awarded in real-time)
      const engagementXp =
        hazard.upvoteCount * 2 -
        hazard.downvoteCount * 1 +
        Math.min(hazard.viewCount * 0.1, 5);
      const totalEstimatedXp =
        baseCalculation.totalXpPoints + Math.round(engagementXp);

      return {
        hazardId: hazard.id,
        title: hazard.title,
        reviewStatus: hazard.reviewStatus,
        baseXpPoints: baseCalculation.totalXpPoints,
        engagementXpPoints: Math.round(engagementXp),
        totalEstimatedXp: totalEstimatedXp,
        breakdown: {
          ...baseCalculation.breakdown,
          engagementBreakdown: `+${Math.round(engagementXp)} engagement (${
            hazard.upvoteCount
          } upvotes, ${hazard.downvoteCount} downvotes, ${
            hazard.viewCount
          } views)`,
        },
        createdAt: hazard.createdAt,
      };
    });

    // Calculate total expected XP (might not match actual due to timing of calculations)
    const expectedTotalXp = hazardBreakdowns.reduce(
      (sum, h) => sum + h.totalEstimatedXp,
      0
    );

    // Get some ranking information
    const usersWithMoreXp = await prisma.user.count({
      where: { xpPoints: { gt: user.xpPoints } },
    });
    const totalUsers = await prisma.user.count();
    const userRank = usersWithMoreXp + 1;

    res.status(200).json({
      currentXpPoints: user.xpPoints,
      reliabilityScore: user.reliabilityScore,
      expectedXpFromCalculation: expectedTotalXp,
      rank: userRank,
      totalUsers: totalUsers,
      percentile: Math.round(((totalUsers - userRank) / totalUsers) * 100),
      stats: {
        totalHazardsReported: user._count.hazardsReported,
        totalVotesCast: user._count.hazardVotes,
        totalHazardViews: user._count.hazardViews,
      },
      hazardBreakdowns: hazardBreakdowns.slice(0, 10), // Limit to last 10 for API response size
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to get XP leaderboard
export const getXpLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(10, parseInt(req.query.limit as string) || 20)
    );
    const skip = (page - 1) * limit;

    const { userId: callerUserId } = res;

    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        xpPoints: true,
        reliabilityScore: true,
        _count: {
          select: {
            hazardsReported: true,
          },
        },
      },
      orderBy: [{ xpPoints: "desc" }, { reliabilityScore: "desc" }],
      skip,
      take: limit,
    });

    const totalUsers = await prisma.user.count();
    const totalPages = Math.ceil(totalUsers / limit);

    // Privacy: other users are never identifiable on the leaderboard.
    // Only the caller's own row carries their name; ids and emails of
    // other accounts are never returned.
    const leaderboard = topUsers.map((user, index) => {
      const isSelf = user.id === callerUserId;
      return {
        rank: skip + index + 1,
        id: isSelf ? user.id : null,
        name: isSelf ? user.name || "You" : "Community member",
        isSelf,
        xpPoints: user.xpPoints,
        reliabilityScore: user.reliabilityScore,
        hazardsReported: user._count.hazardsReported,
      };
    });

    res.status(200).json({
      leaderboard,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/xp/summary — Scoring v2 profile payload: total XP, live streak,
 * trust tier, weekly quest progress and the recent ledger events.
 */
export const getXpSummaryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const summary = await getXpSummary(userId);
    if (!summary) {
      throw new HttpError(404, "User not found");
    }

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/xp/badges — the whole badge catalogue for the caller: earned
 * ones with their date, the rest with how far off they are. Locked badges
 * are returned too, so the app can show what accuracy earns.
 */
export const getBadgesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    res.status(200).json(await getBadgesFor(userId));
  } catch (error) {
    next(error);
  }
};
