import type { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HazardReviewStatus, XpEventType } from "@prisma/client";
import { HttpError } from "../models/http_error.js";
import { getXpSummary } from "../services/xp_ledger.service.js";
import { getBadgesFor } from "../services/badge.service.js";

/**
 * GET /api/xp/breakdown — where the caller's points actually came from.
 *
 * This used to recompute an estimate from AI confidence, upvotes and view
 * counts, none of which award points any more. It produced a number that
 * disagreed with the total on the same screen (product owner 2026-08-06).
 * It now reads the XP ledger, which is the single writer for every point
 * awarded, so the parts always add up to the whole.
 */
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        xpPoints: true,
        reliabilityScore: true,
        _count: { select: { hazardsReported: true } },
      },
    });
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const [byType, byHazard, approvedCount, corroborations] =
      await Promise.all([
        prisma.xpEvent.groupBy({
          by: ["type"],
          where: { userId },
          _sum: { points: true },
          _count: { _all: true },
        }),
        // Per-report totals over the WHOLE ledger, never a capped window:
        // a truncated sum shown as "what this report earned" is the exact
        // parts-don't-add-up defect this endpoint exists to kill.
        prisma.xpEvent.groupBy({
          by: ["hazardId"],
          where: { userId, hazardId: { not: null } },
          _sum: { points: true },
        }),
        prisma.hazard.count({
          where: {
            reportedById: userId,
            reviewStatus: HazardReviewStatus.accepted,
          },
        }),
        prisma.hazardCorroboration.count({
          where: { hazard: { reportedById: userId } },
        }),
      ]);

    // Every point the ledger has ever applied. Equal to the user's total
    // unless a floor-at-zero clamp bit, which is worth being able to see.
    const ledgerTotal = byType.reduce(
      (sum, row) => sum + (row._sum.points ?? 0),
      0
    );

    // Only the reports actually shown get their titles and event detail
    // fetched: biggest movers first, top 20.
    const topHazards = byHazard
      .map((row) => ({
        hazardId: row.hazardId as string,
        points: row._sum.points ?? 0,
      }))
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      .slice(0, 20);
    const topIds = topHazards.map((row) => row.hazardId);

    const [hazards, events] = await Promise.all([
      prisma.hazard.findMany({
        where: { id: { in: topIds } },
        select: { id: true, title: true, reviewStatus: true, createdAt: true },
      }),
      prisma.xpEvent.findMany({
        where: { userId, hazardId: { in: topIds } },
        orderBy: { createdAt: "desc" },
        select: { type: true, points: true, hazardId: true, createdAt: true },
      }),
    ]);
    const hazardById = new Map(hazards.map((h) => [h.id, h]));
    const eventsByHazard = new Map<string, typeof events>();
    for (const event of events) {
      const list = eventsByHazard.get(event.hazardId!) ?? [];
      list.push(event);
      eventsByHazard.set(event.hazardId!, list);
    }

    // Learning, itemised the way reports are: each completed guide by
    // name with what it paid, plus the weekly challenge. "Safety guide
    // completed x4" told nobody WHICH guides earned their points.
    const learningEvents = await prisma.xpEvent.findMany({
      where: {
        userId,
        type: {
          in: [XpEventType.guideCompleted, XpEventType.questCompleted],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { type: true, points: true, guideId: true, createdAt: true },
      take: 50,
    });
    const guideIds = [
      ...new Set(
        learningEvents
          .map((e) => e.guideId)
          .filter((id): id is string => !!id),
      ),
    ];
    const guideTitles = await prisma.safetyGuide.findMany({
      where: { id: { in: guideIds } },
      select: { id: true, title: true },
    });
    const guideTitleById = new Map(guideTitles.map((g) => [g.id, g.title]));

    const learning = {
      guides: learningEvents
        .filter((e) => e.type === XpEventType.guideCompleted)
        .map((e) => ({
          guideId: e.guideId,
          title:
            (e.guideId && guideTitleById.get(e.guideId)) || "Safety guide",
          points: e.points,
          createdAt: e.createdAt,
        })),
      challenges: learningEvents
        .filter((e) => e.type === XpEventType.questCompleted)
        .map((e) => ({ points: e.points, createdAt: e.createdAt })),
    };

    const reports = topHazards.map(({ hazardId, points }) => {
      const hazard = hazardById.get(hazardId);
      return {
        hazardId,
        title: hazard?.title ?? "Removed report",
        reviewStatus: hazard?.reviewStatus ?? "unknown",
        // What this report actually earned, positive or negative.
        points,
        events: (eventsByHazard.get(hazardId) ?? []).map((e) => ({
          type: e.type,
          points: e.points,
          createdAt: e.createdAt,
        })),
        createdAt: hazard?.createdAt ?? null,
      };
    });

    const usersWithMoreXp = await prisma.user.count({
      where: { xpPoints: { gt: user.xpPoints } },
    });
    const totalUsers = await prisma.user.count();
    const userRank = usersWithMoreXp + 1;

    res.status(200).json({
      currentXpPoints: user.xpPoints,
      reliabilityScore: user.reliabilityScore,
      ledgerTotal,
      rank: userRank,
      totalUsers,
      percentile:
        totalUsers > 0
          ? Math.round(((totalUsers - userRank) / totalUsers) * 100)
          : 0,
      stats: {
        totalHazardsReported: user._count.hazardsReported,
        approvedReports: approvedCount,
        corroborationsReceived: corroborations,
      },
      // Where the points came from, by kind of event.
      byType: byType
        .map((row) => ({
          type: row.type,
          count: row._count._all,
          points: row._sum.points ?? 0,
        }))
        .sort((a, b) => b.points - a.points),
      reports,
      learning,
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
