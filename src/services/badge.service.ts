import prisma from "../utils/prisma_client.util.js";
import { XpEventType } from "@prisma/client";
import { sendSocketEventToUsers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { sendPushNotificationToUser } from "./notification.service.js";
import { PushNotificationType } from "../models/push_notification_types.js";

/**
 * Badges — Points & Badge Logic v1.1 section 3.
 *
 * Every badge here rewards accuracy, never volume: what other people
 * confirmed about your reports, not how much you posted. That is the locked
 * rule the whole scoring system sits on, and it is why v1.1 retired the
 * streak, upvote and confirmation badges. Those retirements are honoured by
 * their absence from this catalogue.
 *
 * Definitions live in code so they version with the repo; the database
 * stores only who earned what and when. A badge is never revoked once
 * earned, including when a later report is rejected: the catalogue is a
 * record of what was true, not a live score.
 */

/** What a badge counts. */
export type BadgeMetric =
  /** Confirmations received across all of this user's reports. */
  | "corroborationsReceived"
  /** Reports of theirs that reached corroborated status (3+ confirmations). */
  | "corroboratedReports";

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  metric: BadgeMetric;
  threshold: number;
  /** Ordering in the profile grid: lower first. */
  order: number;
};

/**
 * A report counts as "corroborated" at three confirmations, per v1.1.
 *
 * XP is deliberately not aligned to this: production pays +5 on the first
 * confirmation and that is the source of truth for points (see the
 * production note at the top of the v1.1 document). The badges keep the
 * document's own bar.
 */
export const CORROBORATED_THRESHOLD = 3;

/** Wide corroboration, per v1.1: the +10 event, once per report. */
export const WIDELY_CORROBORATED_THRESHOLD = 9;

export const BADGES: BadgeDefinition[] = [
  {
    // v1.1 names this one "Trusted Reporter", which is already the name of
    // trust tier 3 (20 approved reports at 80%). Two different things
    // under one name on one profile screen is a defect, so the badge takes
    // a distinct name (product owner 2026-08-06); the live tier is
    // untouched. It also now pairs with the 25 badge as a progression.
    id: "accurate_5",
    name: "Eyes on the Ground",
    description: "5 of your reports were confirmed by people nearby",
    metric: "corroboratedReports",
    threshold: 5,
    order: 1,
  },
  {
    id: "corroborated_25",
    name: "Community Hero",
    description: "25 nearby people confirmed your reports",
    metric: "corroborationsReceived",
    threshold: 25,
    order: 2,
  },
  {
    id: "accurate_25",
    name: "Proven Eyes",
    description: "25 of your reports were confirmed by people nearby",
    metric: "corroboratedReports",
    threshold: 25,
    order: 3,
  },
  {
    id: "corroborated_100",
    name: "Crowd Favourite",
    description: "100 nearby people confirmed your reports",
    metric: "corroborationsReceived",
    threshold: 100,
    order: 4,
  },
];

export const badgeById = (badgeId: string): BadgeDefinition | undefined =>
  BADGES.find((badge) => badge.id === badgeId);

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

/**
 * The two numbers every badge is measured against, in one pass.
 *
 * Both are read from the corroboration rows rather than from XP events, so
 * a change to what corroboration pays can never quietly change what a badge
 * means.
 */
export const badgeCountsFor = async (
  userId: string,
): Promise<Record<BadgeMetric, number>> => {
  const rows = await prisma.hazardCorroboration.groupBy({
    by: ["hazardId"],
    where: { hazard: { reportedById: userId } },
    _count: { _all: true },
  });

  const corroborationsReceived = rows.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const corroboratedReports = rows.filter(
    (row) => row._count._all >= CORROBORATED_THRESHOLD,
  ).length;

  return { corroborationsReceived, corroboratedReports };
};

// ---------------------------------------------------------------------------
// Awarding
// ---------------------------------------------------------------------------

/**
 * Awards every badge the user has now earned and not yet been given.
 *
 * Idempotent on the unique (userId, badgeId) row rather than on a flag, so
 * a retry or a replayed request cannot award twice. Failures are swallowed
 * and logged: a badge is never worth failing the action that earned it.
 */
export const evaluateBadges = async (userId: string): Promise<string[]> => {
  try {
    const [counts, existing] = await Promise.all([
      badgeCountsFor(userId),
      prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true },
      }),
    ]);
    const earned = new Set(existing.map((row) => row.badgeId));

    const newlyEarned: string[] = [];
    for (const badge of BADGES) {
      if (earned.has(badge.id)) continue;
      const progress = counts[badge.metric];
      if (progress < badge.threshold) continue;

      const created = await prisma.userBadge.createMany({
        data: { userId, badgeId: badge.id, progressAtAward: progress },
        skipDuplicates: true,
      });
      // A duplicate means a concurrent write got there first: not new.
      if (created.count === 0) continue;

      newlyEarned.push(badge.id);
      await announceBadge(userId, badge);
    }
    return newlyEarned;
  } catch (error) {
    console.error("Badge evaluation failed:", { userId, error });
    return [];
  }
};

/**
 * Tells the user they earned it, on both channels: a socket event for the
 * app in the foreground and a push for when it is not. Earning a badge with
 * nothing to show for it was the gap in the old design.
 */
const announceBadge = async (userId: string, badge: BadgeDefinition) => {
  try {
    sendSocketEventToUsers({
      userIds: [userId],
      event: SocketEvent.badgeEarned,
      data: {
        badgeId: badge.id,
        name: badge.name,
        description: badge.description,
      },
    });

    await sendPushNotificationToUser({
      userId,
      title: `Badge earned: ${badge.name}`,
      body: badge.description,
      data: { badgeId: badge.id },
      type: PushNotificationType.badgeEarned,
    });
  } catch (error) {
    console.error("Badge announcement failed:", { userId, badge: badge.id, error });
  }
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * The whole catalogue for the profile: earned ones with their date, the
 * rest with how far off they are. Locked badges are shown, not hidden, so
 * people can see what accuracy earns before they have it.
 */
export const getBadgesFor = async (userId: string) => {
  const [counts, earnedRows] = await Promise.all([
    badgeCountsFor(userId),
    prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true },
    }),
  ]);
  const earnedAtById = new Map(
    earnedRows.map((row) => [row.badgeId, row.earnedAt]),
  );

  return {
    counts,
    badges: [...BADGES]
      .sort((a, b) => a.order - b.order)
      .map((badge) => {
        const earnedAt = earnedAtById.get(badge.id) ?? null;
        const progress = Math.min(counts[badge.metric], badge.threshold);
        return {
          id: badge.id,
          name: badge.name,
          description: badge.description,
          metric: badge.metric,
          threshold: badge.threshold,
          progress: earnedAt ? badge.threshold : progress,
          earned: earnedAt != null,
          earnedAt,
        };
      }),
  };
};

// ---------------------------------------------------------------------------
// Corroboration rows
// ---------------------------------------------------------------------------

/**
 * Records one person confirming one report, and returns the report's new
 * confirmation count (0 when the row already existed, so callers can tell a
 * fresh confirmation from a repeat).
 *
 * XP is not touched here: corroboration still pays once per report, in the
 * XP ledger. This is the count that badges and the wide-corroboration
 * milestone are measured on.
 */
export const recordCorroboration = async (params: {
  hazardId: string;
  reporterUserId: string;
  corroboratedByUserId: string;
  corroboratedByHazardId: string;
  distanceKm?: number | undefined;
}): Promise<number> => {
  try {
    const created = await prisma.hazardCorroboration.createMany({
      data: {
        hazardId: params.hazardId,
        corroboratedByUserId: params.corroboratedByUserId,
        corroboratedByHazardId: params.corroboratedByHazardId,
        ...(params.distanceKm !== undefined && { distanceKm: params.distanceKm }),
      },
      skipDuplicates: true,
    });
    if (created.count === 0) return 0;

    const total = await prisma.hazardCorroboration.count({
      where: { hazardId: params.hazardId },
    });

    // Every new confirmation can push a badge over its line.
    await evaluateBadges(params.reporterUserId);
    return total;
  } catch (error) {
    console.error("Recording corroboration failed:", {
      hazardId: params.hazardId,
      error,
    });
    return 0;
  }
};

/** True once a report has reached the wide-corroboration bar. */
export const isWidelyCorroborated = (count: number): boolean =>
  count >= WIDELY_CORROBORATED_THRESHOLD;

/** The XP event that pairs with the wide-corroboration bar. */
export const WIDE_CORROBORATION_EVENT = XpEventType.reportWidelyCorroborated;
