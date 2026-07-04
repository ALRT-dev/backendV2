import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { sendSocketEventToUsers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { recordGuideCompletion } from "./xp_ledger.service.js";

/**
 * Lists all safety guide topics (sorted by sortOrder) with their published
 * guides and the user's per-topic and overall completion progress.
 */
export const listTopicsWithProgress = async (userId: string) => {
  const [topics, progressRecords] = await Promise.all([
    prisma.safetyGuideTopic.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        guides: {
          where: { isPublished: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            xpReward: true,
            sortOrder: true,
          },
        },
      },
    }),
    prisma.userGuideProgress.findMany({
      where: { userId },
      select: { guideId: true, xpAwarded: true },
    }),
  ]);

  const completedGuideIds = new Set(progressRecords.map((p) => p.guideId));
  const totalXpEarned = progressRecords.reduce(
    (sum, p) => sum + p.xpAwarded,
    0,
  );

  let totalCount = 0;
  let completedCount = 0;

  const topicsWithProgress = topics.map((topic) => {
    const topicCompletedCount = topic.guides.filter((guide) =>
      completedGuideIds.has(guide.id),
    ).length;

    totalCount += topic.guides.length;
    completedCount += topicCompletedCount;

    return {
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      icon: topic.icon,
      color: topic.color,
      sortOrder: topic.sortOrder,
      guides: topic.guides.map((guide) => ({
        ...guide,
        completed: completedGuideIds.has(guide.id),
      })),
      completedCount: topicCompletedCount,
      totalCount: topic.guides.length,
    };
  });

  return {
    topics: topicsWithProgress,
    completedCount,
    totalCount,
    completedGuideIds: [...completedGuideIds],
    totalXpEarned,
  };
};

const findPublishedGuideBySlugOrId = async (slugOrId: string) => {
  return prisma.safetyGuide.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
      isPublished: true,
    },
    include: {
      topic: {
        select: { id: true, slug: true, name: true, icon: true, color: true },
      },
    },
  });
};

/**
 * Returns the full guide (sections JSON + source fields) with the user's
 * completion state. Throws 404 when the guide is missing or unpublished.
 */
export const getGuideDetail = async (userId: string, slugOrId: string) => {
  const guide = await findPublishedGuideBySlugOrId(slugOrId);

  if (!guide) {
    throw new HttpError(404, "Guide not found");
  }

  const progress = await prisma.userGuideProgress.findUnique({
    where: { userId_guideId: { userId, guideId: guide.id } },
  });

  return {
    ...guide,
    completed: !!progress,
    completedAt: progress?.completedAt ?? null,
  };
};

/**
 * Marks a guide as completed for the user and awards its XP. Idempotent:
 * repeat calls return the existing progress without awarding anything.
 */
export const completeGuide = async (userId: string, slugOrId: string) => {
  const guide = await findPublishedGuideBySlugOrId(slugOrId);

  if (!guide) {
    throw new HttpError(404, "Guide not found");
  }

  const buildAlreadyCompletedResult = async () => {
    const [existingProgress, user] = await Promise.all([
      prisma.userGuideProgress.findUnique({
        where: { userId_guideId: { userId, guideId: guide.id } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { xpPoints: true },
      }),
    ]);

    return {
      progress: existingProgress,
      alreadyCompleted: true,
      xpAwarded: 0,
      newXpTotal: user?.xpPoints ?? 0,
    };
  };

  const existingProgress = await prisma.userGuideProgress.findUnique({
    where: { userId_guideId: { userId, guideId: guide.id } },
  });

  if (existingProgress) {
    return buildAlreadyCompletedResult();
  }

  let progress;
  let updatedUser;
  try {
    [progress, updatedUser] = await prisma.$transaction([
      prisma.userGuideProgress.create({
        data: {
          userId,
          guideId: guide.id,
          xpAwarded: guide.xpReward,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { xpPoints: { increment: guide.xpReward } },
        select: { id: true, xpPoints: true, reliabilityScore: true },
      }),
    ]);
  } catch (error) {
    // Unique constraint hit by a concurrent completion — treat as idempotent.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return buildAlreadyCompletedResult();
    }
    throw error;
  }

  sendSocketEventToUsers({
    userIds: [userId],
    event: SocketEvent.updateUserXp,
    data: {
      userId: updatedUser.id,
      xpPoints: updatedUser.xpPoints,
      reliabilityScore: updatedUser.reliabilityScore,
    },
  });

  // Journal into the XP ledger + streak + weekly quest (non-blocking).
  recordGuideCompletion({
    userId,
    guideId: guide.id,
    xpAwarded: guide.xpReward,
  }).catch((error) =>
    console.error("Guide completion ledger hook failed:", error),
  );

  return {
    progress,
    alreadyCompleted: false,
    xpAwarded: guide.xpReward,
    newXpTotal: updatedUser.xpPoints,
  };
};

/**
 * Returns the first published guide linked to the given hazard category
 * (or its parent category), used for the guide strip on alert cards.
 * Returns null when there is no matching guide.
 */
export const getGuideForHazardCategory = async (categoryId: string) => {
  const category = await prisma.hazardCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, parentId: true },
  });

  if (!category) {
    return null;
  }

  const candidateCategoryIds = [
    category.id,
    ...(category.parentId ? [category.parentId] : []),
  ];

  const guide = await prisma.safetyGuide.findFirst({
    where: {
      isPublished: true,
      categoryIds: { hasSome: candidateCategoryIds },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      topic: { select: { name: true, icon: true, color: true } },
    },
  });

  return guide;
};
