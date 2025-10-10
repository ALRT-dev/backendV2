import type { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { getHazardsApplyingFilters } from "../services/hazard.service.js";
import { getCategoriesApplyingFilters } from "../services/hazardCategory.service.js";

export const getNotificationsFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }

    const { searchString, categoryIds, page = 1, pageSize = 20 } = req.query;

    const subscriptions = await prisma.locationSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return res.status(200).json([]);
    }

    const categoriesPromise = getCategoriesApplyingFilters({
      hazardSearchString: searchString,
      subscriptions,
    });

    const hazardsPromise = getHazardsApplyingFilters({
      searchString,
      categoryIds,
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
