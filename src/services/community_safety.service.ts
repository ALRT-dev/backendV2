import { HazardFlagReason, HazardReviewStatus } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";

/**
 * Community safety: what a person can do about a post, as opposed to what
 * the automated pipeline already does to it.
 *
 * AI review and media screening stop most objectionable content before it
 * publishes. Neither can judge that a report is aimed at someone, so these
 * two exist: flag it for review, or stop seeing that account entirely.
 *
 * Both work on internal ids alone. No personal information is stored by
 * either, and the blocked person is never told they were blocked, because
 * telling them is how blocking a harasser becomes an escalation.
 */

/**
 * Distinct flags that pull a report out of the feed and back into review.
 *
 * Three rather than one, because a single flag is also how a disagreement
 * looks, and a community report is often the first warning of something
 * real: hiding it on one person's say-so is its own kind of harm.
 */
export const FLAGS_TO_AUTO_HIDE = 3;

/** Raise a flag on a community report. Idempotent per person. */
export const flagHazard = async (
  userId: string,
  hazardId: string,
  reason: HazardFlagReason,
) => {
  const hazard = await prisma.hazard.findUnique({
    where: { id: hazardId },
    select: { id: true, reportedById: true, reviewStatus: true },
  });
  if (!hazard) throw new HttpError(404, "Alert not found");

  // Official alerts come from agencies and are not ours to hide. Anyone
  // disputing one should be sent to the agency, not to us.
  if (!hazard.reportedById) {
    throw new HttpError(
      400,
      "Official alerts cannot be flagged. Contact the issuing agency.",
    );
  }
  if (hazard.reportedById === userId) {
    throw new HttpError(400, "You cannot flag your own report");
  }

  await prisma.hazardFlag.upsert({
    where: { hazardId_userId: { hazardId, userId } },
    create: { hazardId, userId, reason },
    update: { reason },
  });

  // Enough independent people objecting sends it back for review. Already
  // rejected reports are left alone: there is nothing further to do.
  const flagCount = await prisma.hazardFlag.count({ where: { hazardId } });
  let hidden = false;
  if (
    flagCount >= FLAGS_TO_AUTO_HIDE &&
    hazard.reviewStatus === HazardReviewStatus.accepted
  ) {
    await prisma.hazard.update({
      where: { id: hazardId },
      data: { reviewStatus: HazardReviewStatus.pending },
    });
    hidden = true;
  }

  return { flagged: true, flagCount, sentForReview: hidden };
};

/**
 * Stop seeing everything from an account. Nothing is deleted: the report
 * stays visible to everyone else, because one person's block is not a
 * verdict on whether a hazard is real.
 */
export const blockUser = async (blockerId: string, blockedId: string) => {
  if (blockerId === blockedId) {
    throw new HttpError(400, "You cannot block yourself");
  }
  const target = await prisma.user.findUnique({
    where: { id: blockedId },
    select: { id: true },
  });
  if (!target) throw new HttpError(404, "User not found");

  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
  return { blocked: true };
};

export const unblockUser = async (blockerId: string, blockedId: string) => {
  await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  return { blocked: false };
};

/**
 * The ids this user has blocked.
 *
 * Ids only: the caller is filtering a feed, not reading a list of people,
 * so there is no reason to hand back names or anything else about them.
 */
export const listBlockedUserIds = async (
  blockerId: string,
): Promise<string[]> => {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    select: { blockedId: true },
  });
  return rows.map((row) => row.blockedId);
};

/** Blocked accounts, with enough to render a manageable list and undo it. */
export const listBlockedUsers = async (blockerId: string) => {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
    select: {
      blockedId: true,
      createdAt: true,
      blocked: { select: { id: true, name: true } },
    },
  });

  return rows.map((row) => ({
    userId: row.blockedId,
    // A blocked account still needs something to identify it in the list,
    // or the user cannot tell which block to undo.
    name: row.blocked.name ?? "Community member",
    blockedAt: row.createdAt,
  }));
};
