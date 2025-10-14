import prisma from "../utils/prisma_client.util.js";
import { buildHazardsWhereClause } from "./hazard.service.js";
import type { HazardReviewStatus, LocationSubscription } from "@prisma/client";

export const getCategoriesApplyingFilters = async ({
  hazardSearchString,
  hazardReviewStatus,
  hazardReportedById,
  hazardNortheastLat,
  hazardNortheastLng,
  hazardSouthwestLat,
  hazardSouthwestLng,
  subscriptions,
}: {
  hazardSearchString?: string | undefined;
  hazardReviewStatus?: HazardReviewStatus | undefined;
  hazardReportedById?: string | undefined;
  hazardNortheastLat?: number | undefined;
  hazardNortheastLng?: number | undefined;
  hazardSouthwestLat?: number | undefined;
  hazardSouthwestLng?: number | undefined;
  subscriptions?: LocationSubscription[] | undefined;
}) => {
  const hazardsWhereClause = buildHazardsWhereClause({
    searchString: hazardSearchString,
    reviewStatus: hazardReviewStatus,
    reportedById: hazardReportedById,
    northeastLat: hazardNortheastLat,
    northeastLng: hazardNortheastLng,
    southwestLat: hazardSouthwestLat,
    southwestLng: hazardSouthwestLng,
    subscriptions,
  });

  const categories = await prisma.hazardCategory.findMany({
    where: {
      hazards: { some: hazardsWhereClause },
    },
    include: {
      _count: {
        select: {
          hazards: {
            where: hazardsWhereClause,
          },
        },
      },
    },
    orderBy: {
      hazards: {
        _count: "desc",
      },
    },
  });

  const transformedCategories = categories.map((category) => ({
    ...category,
    hazardsCount: category._count.hazards,
    _count: undefined,
  }));

  return transformedCategories;
};
