import {
  HazardReviewStatus,
  XpEventType,
  Prisma,
  type Hazard,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { haversineKm } from "./family.service.js";
import { sendSocketEventToUsers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";
import {
  getBadgesFor,
  isWidelyCorroborated,
  recordCorroboration,
} from "./badge.service.js";

/**
 * Scoring v2 — every XP change flows through a single auditable ledger.
 *
 * Points are only awarded for verifiable safety value (reports, guides,
 * corroboration, official matches). SOS and proximity events NEVER earn
 * points: nobody should be incentivised to trigger safety-critical flows.
 */

export const XP_POINTS: Record<XpEventType, number> = {
  reportApproved: 10,
  reportRejected: -15,
  reportCorroborated: 5,
  officialMatch: 15,
  onboardingCompleted: 20,
  firstReportPosted: 10,
  profileCompleted: 10,
  familyJoined: 10,
  savedPlaceAdded: 5,
  reportWidelyCorroborated: 10,
  guideCompleted: 10,
  questCompleted: 20,
  shareInstall: 25,
};

/** Streak bonus: reports earn 1.2x once the streak reaches 3 days. */
const STREAK_MULTIPLIER = 1.2;
const STREAK_MIN_DAYS = 3;

const CORROBORATION_RADIUS_KM = 1;
const OFFICIAL_MATCH_RADIUS_KM = 5;
const MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Weekly quest: complete this many guides in a (UTC, Monday-based) week. */
export const WEEKLY_QUEST = {
  id: "weekly-guides",
  title: "Learn 2 safety guides",
  description:
    "Complete any 2 guides in the Learn hub this week to earn bonus XP.",
  target: 2,
  xpReward: XP_POINTS.questCompleted,
};

// ---------------------------------------------------------------------------
// Core ledger write
// ---------------------------------------------------------------------------

/**
 * Records an XP event and applies it to the user's total (floored at 0 —
 * the applied delta is what gets stored, so the ledger always sums to the
 * displayed total). Pushes the new total over the user's socket.
 */
export const recordXpEvent = async (params: {
  userId: string;
  type: XpEventType;
  points?: number;
  hazardId?: string | undefined;
  guideId?: string | undefined;
  meta?: Prisma.InputJsonValue | undefined;
}) => {
  const points = params.points ?? XP_POINTS[params.type];

  const { event, user } = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({
      where: { id: params.userId },
      select: { xpPoints: true },
    });

    const newTotal = Math.max(0, current.xpPoints + points);
    const appliedDelta = newTotal - current.xpPoints;

    const event = await tx.xpEvent.create({
      data: {
        userId: params.userId,
        type: params.type,
        points: appliedDelta,
        ...(params.hazardId !== undefined && { hazardId: params.hazardId }),
        ...(params.guideId !== undefined && { guideId: params.guideId }),
        ...(params.meta !== undefined && { meta: params.meta }),
      },
    });

    const user = await tx.user.update({
      where: { id: params.userId },
      data: { xpPoints: newTotal },
      select: { id: true, xpPoints: true, reliabilityScore: true },
    });

    return { event, user };
  });

  sendSocketEventToUsers({
    userIds: [params.userId],
    event: SocketEvent.updateUserXp,
    data: {
      userId: user.id,
      xpPoints: user.xpPoints,
      reliabilityScore: user.reliabilityScore,
    },
  });

  return { event, newXpTotal: user.xpPoints };
};

/**
 * One-off milestone awards from Points & Badge Logic v1.1 section 2.
 *
 * All idempotent on the ledger rather than on a flag, so a retry, a double
 * tap or a replayed request cannot pay twice. Each swallows its own errors:
 * a milestone is never worth failing the action that earned it.
 */
const awardOnce = async (params: {
  userId: string;
  type: XpEventType;
  meta?: Prisma.InputJsonValue;
}): Promise<void> => {
  try {
    const existing = await prisma.xpEvent.findFirst({
      where: { userId: params.userId, type: params.type },
      select: { id: true },
    });
    if (existing) return;

    await recordXpEvent({
      userId: params.userId,
      type: params.type,
      ...(params.meta !== undefined && { meta: params.meta }),
    });
  } catch (error) {
    console.error("Milestone XP award failed:", {
      userId: params.userId,
      type: params.type,
      error,
    });
  }
};

/** First ALRT posted (+10, once). */
export const awardFirstReport = (userId: string, hazardId: string) =>
  awardOnce({ userId, type: XpEventType.firstReportPosted, meta: { hazardId } });

/** Joined a family circle (+10, once). */
export const awardFamilyJoined = (userId: string, circleId: string) =>
  awardOnce({ userId, type: XpEventType.familyJoined, meta: { circleId } });

/**
 * Profile completed (+10, once): name, photo and location all present.
 * Called after any profile write, so it fires on whichever edit finishes
 * the set rather than needing its own button.
 */
export const awardProfileCompletedIfReady = async (
  userId: string,
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profilePictureUrl: true, latitude: true },
    });
    if (!user) return;

    const isComplete =
      (user.name ?? "").trim().length > 0 &&
      (user.profilePictureUrl ?? "").trim().length > 0 &&
      user.latitude != null;
    if (!isComplete) return;

    await awardOnce({ userId, type: XpEventType.profileCompleted });
  } catch (error) {
    console.error("Profile-completed XP check failed:", { userId, error });
  }
};

/**
 * Saved place added (+5). Per place, not once per user, so it is keyed on
 * the place rather than going through awardOnce.
 */
export const awardSavedPlace = async (
  userId: string,
  placeId: string,
): Promise<void> => {
  try {
    const existing = await prisma.xpEvent.findFirst({
      where: {
        userId,
        type: XpEventType.savedPlaceAdded,
        meta: { path: ["placeId"], equals: placeId },
      },
      select: { id: true },
    });
    if (existing) return;

    await recordXpEvent({
      userId,
      type: XpEventType.savedPlaceAdded,
      meta: { placeId },
    });
  } catch (error) {
    console.error("Saved-place XP award failed:", { userId, placeId, error });
  }
};

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

const utcDayString = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Marks the user active today (UTC) and updates their streak: consecutive
 * days extend it, gaps reset it to 1. Returns the current streak length.
 */
export const touchActivityStreak = async (userId: string): Promise<number> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActivityDate: true },
  });
  if (!user) return 0;

  const today = utcDayString(new Date());
  const last = user.lastActivityDate
    ? utcDayString(user.lastActivityDate)
    : null;

  if (last === today) return user.streakDays;

  const yesterday = utcDayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const newStreak = last === yesterday ? user.streakDays + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: { streakDays: newStreak, lastActivityDate: new Date() },
  });

  return newStreak;
};

export const streakMultiplierFor = (streakDays: number): number =>
  streakDays >= STREAK_MIN_DAYS ? STREAK_MULTIPLIER : 1;

// ---------------------------------------------------------------------------
// Report outcomes
// ---------------------------------------------------------------------------

/**
 * Applies Scoring v2 to a just-reviewed user report:
 * - accepted: +10 (streak-multiplied), plus official-match and
 *   corroboration bonuses where they apply
 * - rejected: -15
 * Also refreshes the reporter's reliability score (verification rate).
 * Never throws — scoring must not break report submission.
 */
export const handleReportReviewOutcome = async (
  hazard: Pick<
    Hazard,
    | "id"
    | "reportedById"
    | "reviewStatus"
    | "categoryId"
    | "latitude"
    | "longitude"
    | "occurredAt"
  >,
): Promise<{ pointsAwarded: number; newXpTotal: number } | null> => {
  const userId = hazard.reportedById;
  if (!userId) return null;

  try {
    if (hazard.reviewStatus === HazardReviewStatus.rejected) {
      const { event, newXpTotal } = await recordXpEvent({
        userId,
        type: XpEventType.reportRejected,
        hazardId: hazard.id,
      });
      await refreshReliabilityScore(userId);
      return { pointsAwarded: event.points, newXpTotal };
    }

    if (hazard.reviewStatus !== HazardReviewStatus.accepted) return null;

    const streakDays = await touchActivityStreak(userId);
    const multiplier = streakMultiplierFor(streakDays);
    const points = Math.round(XP_POINTS.reportApproved * multiplier);

    const { event, newXpTotal } = await recordXpEvent({
      userId,
      type: XpEventType.reportApproved,
      points,
      hazardId: hazard.id,
      meta: { streakDays, multiplier },
    });

    await refreshReliabilityScore(userId);

    // Bonuses are best-effort and non-blocking.
    applyMatchBonuses(hazard, userId).catch((error) =>
      console.error("XP match bonus check failed:", error),
    );

    return { pointsAwarded: event.points, newXpTotal };
  } catch (error) {
    console.error("Scoring v2 failed for hazard", hazard.id, error);
    return null;
  }
};

/**
 * Official-match: the reporter earns +15 when an official-source hazard of
 * the same category exists within 5km and ±12h of their report.
 *
 * Corroboration: earlier reporters of the same thing (same category, within
 * 1km and ±12h, accepted, by someone else) each earn +5 — once per report.
 */
const applyMatchBonuses = async (
  hazard: Pick<
    Hazard,
    "id" | "categoryId" | "latitude" | "longitude" | "occurredAt"
  >,
  reporterId: string,
) => {
  if (hazard.latitude == null || hazard.longitude == null) return;

  const occurredAt = hazard.occurredAt ?? new Date();
  const windowStart = new Date(occurredAt.getTime() - MATCH_WINDOW_MS);
  const windowEnd = new Date(occurredAt.getTime() + MATCH_WINDOW_MS);

  // Pre-filter with a degree box (~0.1° ≈ 11km) before exact distance math.
  const boxDegrees = 0.1;
  const candidates = await prisma.hazard.findMany({
    where: {
      id: { not: hazard.id },
      categoryId: hazard.categoryId,
      reviewStatus: HazardReviewStatus.accepted,
      latitude: {
        gte: hazard.latitude - boxDegrees,
        lte: hazard.latitude + boxDegrees,
      },
      longitude: {
        gte: hazard.longitude - boxDegrees,
        lte: hazard.longitude + boxDegrees,
      },
      occurredAt: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      sourceId: true,
      reportedById: true,
    },
    take: 100,
  });

  let officialMatched = false;

  for (const candidate of candidates) {
    if (candidate.latitude == null || candidate.longitude == null) continue;
    const distanceKm = haversineKm(
      hazard.latitude,
      hazard.longitude,
      candidate.latitude,
      candidate.longitude,
    );

    // Official confirmation of this user's report.
    if (
      !officialMatched &&
      candidate.sourceId != null &&
      distanceKm <= OFFICIAL_MATCH_RADIUS_KM
    ) {
      officialMatched = true;
      await recordXpEvent({
        userId: reporterId,
        type: XpEventType.officialMatch,
        hazardId: hazard.id,
        meta: { matchedHazardId: candidate.id, distanceKm },
      });
      continue;
    }

    // Corroboration for the earlier reporter (never self).
    if (
      candidate.reportedById != null &&
      candidate.reportedById !== reporterId &&
      distanceKm <= CORROBORATION_RADIUS_KM
    ) {
      // The confirmation itself is always recorded, even when the XP for
      // this report has already been paid: badges and the wide-
      // corroboration milestone are counted on how many people confirmed,
      // not on how many times it paid.
      const confirmations = await recordCorroboration({
        hazardId: candidate.id,
        reporterUserId: candidate.reportedById,
        corroboratedByUserId: reporterId,
        corroboratedByHazardId: hazard.id,
        distanceKm,
      });

      // Wide corroboration (+10, once per report). This event has been in
      // the XP table since v1.1 and was never awarded by anything.
      if (isWidelyCorroborated(confirmations)) {
        const alreadyWide = await prisma.xpEvent.findFirst({
          where: {
            hazardId: candidate.id,
            type: XpEventType.reportWidelyCorroborated,
          },
          select: { id: true },
        });
        if (!alreadyWide) {
          await recordXpEvent({
            userId: candidate.reportedById,
            type: XpEventType.reportWidelyCorroborated,
            hazardId: candidate.id,
            meta: { confirmations },
          });
        }
      }

      // Once per corroborated report, no matter how many confirmations.
      const alreadyAwarded = await prisma.xpEvent.findFirst({
        where: {
          hazardId: candidate.id,
          type: XpEventType.reportCorroborated,
        },
        select: { id: true },
      });
      if (alreadyAwarded) continue;

      await recordXpEvent({
        userId: candidate.reportedById,
        type: XpEventType.reportCorroborated,
        hazardId: candidate.id,
        meta: { corroboratedByHazardId: hazard.id, distanceKm },
      });
    }
  }
};

/** Reliability score is simply the verification rate of reviewed reports. */
const refreshReliabilityScore = async (userId: string) => {
  const [accepted, rejected] = await Promise.all([
    prisma.hazard.count({
      where: { reportedById: userId, reviewStatus: HazardReviewStatus.accepted },
    }),
    prisma.hazard.count({
      where: { reportedById: userId, reviewStatus: HazardReviewStatus.rejected },
    }),
  ]);
  const total = accepted + rejected;
  const rate = total > 0 ? accepted / total : 0;
  await prisma.user.update({
    where: { id: userId },
    data: { reliabilityScore: rate },
  });
};

// ---------------------------------------------------------------------------
// Guides + weekly quest
// ---------------------------------------------------------------------------

/** Monday 00:00 UTC of the current week. */
const currentWeekStart = (): Date => {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return monday;
};

/**
 * Ledger hook for a completed guide: awards the XP, extends the streak and
 * awards the weekly quest bonus when the target is hit.
 *
 * This is the ONLY place a guide's XP is applied. The guide service used
 * to increment user.xpPoints itself and then ask this to journal a
 * matching row, which meant the header total and the ledger were two
 * separate writes that could disagree: the journal is best-effort, so a
 * failure here left the user with the points but no ledger row, and the
 * weekly quest counter (which counts guideCompleted rows) never moved.
 * One write now, one source of truth.
 */
export const recordGuideCompletion = async (params: {
  userId: string;
  guideId: string;
  xpAwarded: number;
}) => {
  try {
    await recordXpEvent({
      userId: params.userId,
      type: XpEventType.guideCompleted,
      points: params.xpAwarded,
      guideId: params.guideId,
    });

    await touchActivityStreak(params.userId);

    // Weekly quest check.
    const weekStart = currentWeekStart();
    const [guidesThisWeek, questAlreadyAwarded] = await Promise.all([
      prisma.xpEvent.count({
        where: {
          userId: params.userId,
          type: XpEventType.guideCompleted,
          createdAt: { gte: weekStart },
        },
      }),
      prisma.xpEvent.findFirst({
        where: {
          userId: params.userId,
          type: XpEventType.questCompleted,
          createdAt: { gte: weekStart },
        },
        select: { id: true },
      }),
    ]);

    if (guidesThisWeek >= WEEKLY_QUEST.target && !questAlreadyAwarded) {
      await recordXpEvent({
        userId: params.userId,
        type: XpEventType.questCompleted,
        meta: { questId: WEEKLY_QUEST.id, week: weekStart.toISOString() },
      });
    }
  } catch (error) {
    // The streak and the quest bonus are the parts that can fail here.
    // Swallowing kept the guide completion itself safe, but it also meant
    // a lost +20 was invisible to everyone, which is how the totals drift
    // away from what the quest card promises. Still non-fatal, but loud.
    console.error("Guide completion ledger hook failed:", {
      userId: params.userId,
      guideId: params.guideId,
      error,
    });
  }
};

// ---------------------------------------------------------------------------
// Trust tier + summary
// ---------------------------------------------------------------------------

export type TrustTier = {
  tier: number;
  name: string;
  approvedCount: number;
  rejectedCount: number;
  verificationRate: number;
  next: { name: string; approvedNeeded: number; rateNeeded: number } | null;
};

export const trustTierFor = (
  approvedCount: number,
  rejectedCount: number,
): TrustTier => {
  const total = approvedCount + rejectedCount;
  const rate = total > 0 ? approvedCount / total : 0;

  if (approvedCount >= 20 && rate >= 0.8) {
    return {
      tier: 3,
      name: "Trusted Reporter",
      approvedCount,
      rejectedCount,
      verificationRate: rate,
      next: null,
    };
  }
  if (approvedCount >= 5 && rate >= 0.6) {
    return {
      tier: 2,
      name: "Verified Reporter",
      approvedCount,
      rejectedCount,
      verificationRate: rate,
      next: { name: "Trusted Reporter", approvedNeeded: 20, rateNeeded: 0.8 },
    };
  }
  return {
    tier: 1,
    name: "Newcomer",
    approvedCount,
    rejectedCount,
    verificationRate: rate,
    next: { name: "Verified Reporter", approvedNeeded: 5, rateNeeded: 0.6 },
  };
};

/** Everything the profile scoring UI needs in one call. */
export const getXpSummary = async (userId: string) => {
  const weekStart = currentWeekStart();

  const [
    user,
    approvedCount,
    rejectedCount,
    guidesThisWeek,
    quest,
    events,
    badges,
  ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          xpPoints: true,
          streakDays: true,
          lastActivityDate: true,
          reliabilityScore: true,
        },
      }),
      prisma.hazard.count({
        where: {
          reportedById: userId,
          reviewStatus: HazardReviewStatus.accepted,
        },
      }),
      prisma.hazard.count({
        where: {
          reportedById: userId,
          reviewStatus: HazardReviewStatus.rejected,
        },
      }),
      prisma.xpEvent.count({
        where: {
          userId,
          type: XpEventType.guideCompleted,
          createdAt: { gte: weekStart },
        },
      }),
      prisma.xpEvent.findFirst({
        where: {
          userId,
          type: XpEventType.questCompleted,
          createdAt: { gte: weekStart },
        },
        select: { id: true },
      }),
      prisma.xpEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      getBadgesFor(userId),
    ]);

  if (!user) return null;

  // A streak is only "alive" if the user was active today or yesterday.
  const today = utcDayString(new Date());
  const yesterday = utcDayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const lastActive = user.lastActivityDate
    ? utcDayString(user.lastActivityDate)
    : null;
  const streakAlive = lastActive === today || lastActive === yesterday;

  return {
    xpPoints: user.xpPoints,
    streakDays: streakAlive ? user.streakDays : 0,
    streakMultiplierActive:
      streakAlive && streakMultiplierFor(user.streakDays) > 1,
    trustTier: trustTierFor(approvedCount, rejectedCount),
    badges: badges.badges,
    badgeCounts: badges.counts,
    weeklyQuest: {
      id: WEEKLY_QUEST.id,
      title: WEEKLY_QUEST.title,
      description: WEEKLY_QUEST.description,
      target: WEEKLY_QUEST.target,
      progress: Math.min(guidesThisWeek, WEEKLY_QUEST.target),
      xpReward: WEEKLY_QUEST.xpReward,
      completed: quest != null,
    },
    pointValues: XP_POINTS,
    recentEvents: events.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points,
      hazardId: e.hazardId,
      guideId: e.guideId,
      createdAt: e.createdAt,
    })),
  };
};
