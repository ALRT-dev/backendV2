import type { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { getHazardsApplyingFilters } from "../services/hazard.service.js";
import { getCategoriesApplyingFilters } from "../services/hazardCategory.service.js";
import type {
  GetNotificationsFeedQuery,
  PushNotificationTokenInput,
} from "../validators/notification.validator.js";

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
      page = "1",
      pageSize = "20",
    }: GetNotificationsFeedQuery = req.query;

    const subscriptions = await prisma.locationSubscription.findMany({
      where: { userId: userId! },
    });

    if (subscriptions.length === 0) {
      return res.status(200).json({ categories: [], hazards: [] });
    }

    const categoriesPromise = getCategoriesApplyingFilters({
      hazardSearchString: searchString,
      subscriptions,
    });

    const hazardsPromise = getHazardsApplyingFilters({
      searchString,
      categoryIds,
      userId,
      page,
      pageSize,
      subscriptions,
    });

    const [categories, hazards] = await Promise.all([
      categoriesPromise,
      hazardsPromise,
    ]);

    // If no hazards found, return empty categories and hazards
    if (hazards.length === 0) {
      return res.status(200).json({ categories: [], hazards: [] });
    }

    res.status(200).json({ categories, hazards });
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
