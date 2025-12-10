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
  isHazardAwsCompliant,
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
  isHazardAwsCompliant?: boolean | undefined;
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
    isAwsCompliant: isHazardAwsCompliant,
    subscriptions,

    // Use matchCategoryIdsWithSubCategoriesAlso: false to avoid joins that cause ambiguous column references in groupBy
    matchCategoryIdsWithSubCategoriesAlso: false,
  });

  const severities = await prisma.hazard.groupBy({
    by: ["severity"],
    where: hazardsWhereClause,
    _count: {
      id: true,
    },
  });

  // Define custom severity order: unknown, info, advice, watchAndAct, emergency
  const severityOrder: Record<HazardSeverity, number> = {
    unknown: 0,
    info: 1,
    advice: 2,
    watchAndAct: 3,
    emergency: 4,
  };

  return severities
    .map((item) => ({
      severity: item.severity,
      hazardsCount: item._count.id,
    }))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
};
