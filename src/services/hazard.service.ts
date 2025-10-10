import prisma from "../utils/prisma_client.util.js";

export const buildHazardsWhereClause = ({
  searchString,
  categoryIds,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
  subscriptions,
}: {
  searchString?: any;
  categoryIds?: any;
  northeastLat?: any;
  northeastLng?: any;
  southwestLat?: any;
  southwestLng?: any;
  subscriptions?: any[] | undefined;
}) => {
  // Build the where clause for filtering hazards
  const whereClause: any = {
    AND: [],
  };

  // Apply search string filter if provided
  if (searchString) {
    whereClause.AND.push({
      OR: [
        {
          title: {
            contains: searchString as string,
            mode: "insensitive",
          },
        },
        {
          shortDescription: {
            contains: searchString as string,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // Apply category filter if provided
  if (categoryIds) {
    whereClause.AND.push({
      categoryId: {
        in: Array.isArray(categoryIds)
          ? (categoryIds as string[])
          : (categoryIds as string).split(","),
      },
    });
  }

  // Filter hazards that fall within subscription regions if provided
  if (subscriptions && subscriptions.length > 0) {
    whereClause.AND.push({
      OR: subscriptions.map((subscription) => ({
        AND: [
          {
            latitude: {
              gte: Math.min(
                subscription.southwestLat,
                subscription.northeastLat
              ),
              lte: Math.max(
                subscription.southwestLat,
                subscription.northeastLat
              ),
            },
          },
          {
            longitude: {
              gte: Math.min(
                subscription.southwestLng,
                subscription.northeastLng
              ),
              lte: Math.max(
                subscription.southwestLng,
                subscription.northeastLng
              ),
            },
          },
        ],
      })),
    });
  }

  // Filter hazards that fall within geographic bounds if provided
  if (northeastLat && northeastLng && southwestLat && southwestLng) {
    whereClause.AND.push({
      latitude: {
        gte: Number(southwestLat),
        lte: Number(northeastLat),
      },
      longitude: {
        gte: Number(southwestLng),
        lte: Number(northeastLng),
      },
    });
  }

  return whereClause;
};

export const getHazardsApplyingFilters = async ({
  searchString,
  categoryIds,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
  subscriptions,
  page = 1,
  pageSize = 20,
}: {
  searchString?: any;
  categoryIds?: any;
  northeastLat?: any;
  northeastLng?: any;
  southwestLat?: any;
  southwestLng?: any;
  subscriptions?: any[] | undefined;
  page?: any;
  pageSize?: any;
}) => {
  const whereClause = buildHazardsWhereClause({
    searchString,
    categoryIds,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
  });

  return await prisma.hazard.findMany({
    where: whereClause,
    include: {
      category: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (Number(page) - 1) * Number(pageSize),
    take: Number(pageSize),
  });
};
