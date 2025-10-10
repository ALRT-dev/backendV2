import prisma from "../utils/prisma_client.util.js";
import { buildHazardsWhereClause } from "./hazard.service.js";

export const getCategoriesApplyingFilters = async ({
  hazardSearchString,
  hazardNortheastLat,
  hazardNortheastLng,
  hazardSouthwestLat,
  hazardSouthwestLng,
  subscriptions,
}: {
  hazardSearchString?: any;
  hazardNortheastLat?: any;
  hazardNortheastLng?: any;
  hazardSouthwestLat?: any;
  hazardSouthwestLng?: any;
  subscriptions?: any[] | undefined;
}) => {
  const hazardsWhereClause = buildHazardsWhereClause({
    searchString: hazardSearchString,
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
