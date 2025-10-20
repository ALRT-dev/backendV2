import type { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { getHazardsApplyingFiltersRaw } from "../services/hazard.service.js";
import { getCategoriesApplyingFilters } from "../services/hazard_category.service.js";
import type {
  GetNotificationsFeedQuery,
  PushNotificationTokenInput,
} from "../validators/notification.validator.js";
import { parseBoolean } from "../utils/parse.util.js";
import { enrichHazardsWithPresignedUrls } from "../services/s3.service.js";

export const getNotificationsFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    const {
      searchString,
      categoryIds,
      reviewStatus,
      showExpired,
      sortSettings,
      page = "1",
      pageSize = "20",
    }: GetNotificationsFeedQuery = req.query;

    const subscriptions = await prisma.locationSubscription.findMany({
      where: { userId: userId! },
    });

    if (subscriptions.length === 0) {
      return res.status(200).json({ categories: [], hazards: [] });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: { latitude: true, longitude: true },
    });
    const userLat = user?.latitude || undefined;
    const userLng = user?.longitude || undefined;

    const categoriesPromise = getCategoriesApplyingFilters({
      hazardSearchString: searchString,
      hazardReviewStatus: reviewStatus,
      showExpiredHazards: parseBoolean(showExpired),
      subscriptions,
    });

    const hazardsPromise = getHazardsApplyingFiltersRaw({
      searchString,
      categoryIds,
      reviewStatus,
      userId,
      page: Number(page),
      pageSize: Number(pageSize),
      subscriptions,
      userLat,
      userLng,
      sortSettings,
      showExpired: parseBoolean(showExpired),
    });

    const [categories, hazards] = await Promise.all([
      categoriesPromise,
      hazardsPromise,
    ]);

    // If no hazards found, return empty categories and hazards
    if (hazards.length === 0) {
      return res.status(200).json({ categories: [], hazards: [] });
    }

    // Enrich hazards with presigned URLs for media access
    const hazardsWithPresignedUrls = await enrichHazardsWithPresignedUrls(
      hazards
    );

    res.status(200).json({ categories, hazards: hazardsWithPresignedUrls });
  } catch (error) {
    next(error);
  }
};

export const sendPushNotificationToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, platform }: PushNotificationTokenInput = req.body;
    const { userId } = res;

    const newDevice = await prisma.userDevice.upsert({
      where: {
        deviceToken: token,
      },
      create: {
        userId: userId!,
        deviceToken: token,
        platform: platform || null,
      },
      update: {
        platform: platform || null,
      },
    });

    if (!newDevice) {
      throw new HttpError(500, "Failed to register device token");
    }

    res.status(200).json({ message: "Device token registered successfully" });
  } catch (error) {
    next(error);
  }
};
