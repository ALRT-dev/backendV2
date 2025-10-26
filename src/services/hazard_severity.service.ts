import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  HazardReviewStatus,
  HazardSeverity,
  LocationSubscription,
} from "@prisma/client";

/**
 * Fetches hazard severities and the count of hazards for each severity applying various filters.
 */
export const getSeveritiesApplyingFilters = async ({
  hazardSearchString,
  hazardCategoryIds,
  hazardReviewStatus,
  hazardReportedById,
  hazardNortheastLat,
  hazardNortheastLng,
  hazardSouthwestLat,
  hazardSouthwestLng,
  showExpiredHazards,
  subscriptions,
}: {
  hazardSearchString?: string | undefined;
  hazardCategoryIds?: string | string[] | undefined;
  hazardReviewStatus?: HazardReviewStatus | undefined;
  hazardReportedById?: string | undefined;
  hazardNortheastLat?: number | undefined;
  hazardNortheastLng?: number | undefined;
  hazardSouthwestLat?: number | undefined;
  hazardSouthwestLng?: number | undefined;
  showExpiredHazards?: boolean | undefined;
  subscriptions?: LocationSubscription[] | undefined;
}): Promise<
  {
    severity: HazardSeverity;
    hazardsCount: number;
  }[]
> => {
  const hazardsWhereClause = buildHazardsWhereClause({
    searchString: hazardSearchString,
    categoryIds: hazardCategoryIds,
    reviewStatus: hazardReviewStatus,
    reportedById: hazardReportedById,
    northeastLat: hazardNortheastLat,
    northeastLng: hazardNortheastLng,
    southwestLat: hazardSouthwestLat,
    southwestLng: hazardSouthwestLng,
    showExpired: showExpiredHazards,
    subscriptions,
  });

  const severities = await prisma.hazard.groupBy({
    by: ["severity"],
    where: hazardsWhereClause,
    _count: {
      id: true,
    },
    orderBy: {
      severity: "desc",
    },
  });

  return severities.map((item) => ({
    severity: item.severity,
    hazardsCount: item._count.id,
  }));
};
