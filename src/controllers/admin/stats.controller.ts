import type { NextFunction, Response } from "express";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";
import prisma from "../../utils/prisma_client.util.js";
import { getDashboardStats } from "../../services/stats.admin.service.js";
import { HttpError } from "../../models/http_error.js";

// Queensland does not observe daylight saving, so Australia/Brisbane is a
// fixed UTC+10 offset year-round and the day boundary can be computed
// without a timezone library.
const BRISBANE_UTC_OFFSET_MS = 10 * 60 * 60 * 1000;

const startOfBrisbaneDay = (now: Date): Date => {
  const shifted = new Date(now.getTime() + BRISBANE_UTC_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - BRISBANE_UTC_OFFSET_MS);
};

export const getAdminStatsController = async (
  _req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const dayStart = startOfBrisbaneDay(new Date());

    // Users who have requested account deletion are excluded from user
    // counts but surfaced separately so the dashboard can still show them.
    const [
      totalUsers,
      newUsersToday,
      usersPendingDeletion,
      totalHazards,
      hazardsToday,
    ] = await Promise.all([
      prisma.user.count({ where: { deletionRequestedAt: null } }),
      prisma.user.count({
        where: { deletionRequestedAt: null, createdAt: { gte: dayStart } },
      }),
      prisma.user.count({ where: { deletionRequestedAt: { not: null } } }),
      prisma.hazard.count(),
      prisma.hazard.count({ where: { createdAt: { gte: dayStart } } }),
    ]);

    res.status(200).json({
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        pendingDeletion: usersPendingDeletion,
      },
      hazards: {
        total: totalHazards,
        newToday: hazardsToday,
      },
      dayBoundary: {
        timezone: "Australia/Brisbane",
        dayStartedAt: dayStart.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStatsController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }

    const stats = await getDashboardStats();

    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};
