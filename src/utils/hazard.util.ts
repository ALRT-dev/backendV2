import {
  HazardSeverity,
  Prisma,
  type LocationSubscription,
} from "@prisma/client";
import type {
  HazardSearchParams,
  SortSetting,
} from "../models/hazard_search_params_interface.js";

/**
 * Builds the where clause for querying hazards based on various filters.
 *
 * This function constructs a Prisma-compatible where clause object that can be used
 * to filter hazards based on search strings, categories, reporting user, review status,
 * geographic bounds, and user subscriptions.
 */
export const buildHazardsWhereClause = (
  params: HazardSearchParams & {
    subscriptions?: LocationSubscription[] | undefined;
    matchCategoryIdsWithSubCategoriesAlso?: boolean | undefined;
  }
): Prisma.HazardWhereInput => {
  const {
    searchString,
    categoryIds,
    severities,
    reportedById,
    reviewStatus,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
    showExpired,
    matchCategoryIdsWithSubCategoriesAlso = true, // Default to true to maintain existing behavior
  } = params;

  // Build the where clause for filtering hazards
  const andConditions: Prisma.HazardWhereInput[] = [];

  // Only include hazards that haven't expired yet
  if (!showExpired) {
    andConditions.push({
      expiresAt: {
        gt: new Date(),
      },
    });
  }

  // Apply search string filter if provided
  if (searchString) {
    andConditions.push({
      OR: [
        {
          title: {
            contains: searchString,
            mode: "insensitive",
          },
        },
        {
          shortDescription: {
            contains: searchString,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // Apply category filter if provided
  if (categoryIds) {
    const categoryIdArray = Array.isArray(categoryIds)
      ? categoryIds
      : categoryIds.split(",");

    if (matchCategoryIdsWithSubCategoriesAlso) {
      // Include hierarchical category filtering with joins
      andConditions.push({
        OR: [
          // Match hazards with categories that are directly in the list
          {
            categoryId: {
              in: categoryIdArray,
            },
          },
          // Match hazards with categories whose parent is in the list
          {
            category: {
              parentId: {
                in: categoryIdArray,
              },
            },
          },
        ],
      });
    } else {
      // Simple category filtering without hierarchical search (for groupBy operations)
      andConditions.push({
        categoryId: {
          in: categoryIdArray,
        },
      });
    }
  }

  // Apply severities filter if provided
  if (severities && severities.length > 0) {
    const severityArray = Array.isArray(severities) ? severities : [severities];
    andConditions.push({
      severity: {
        in: severityArray as HazardSeverity[],
      },
    });
  }

  // Apply reportedById filter if provided
  if (reportedById) {
    andConditions.push({
      reportedById: reportedById,
    });
  }

  // Apply reviewStatus filter if provided
  if (reviewStatus) {
    andConditions.push({
      reviewStatus: reviewStatus,
    });
  }

  // Filter hazards that fall within subscription regions if provided
  if (subscriptions && subscriptions.length > 0) {
    andConditions.push({
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
    andConditions.push({
      latitude: {
        gte: southwestLat,
        lte: northeastLat,
      },
      longitude: {
        gte: southwestLng,
        lte: northeastLng,
      },
    });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
};

/**
 * Builds the include object for fetching related entities with hazards.
 *
 * This function ensures that related entities such as category, source, and reportedBy
 * are always included when fetching hazards. Additional include parameters can be merged
 * in as needed.
 */
export const buildHazardInclude = (
  params?: Prisma.HazardInclude
): Prisma.HazardInclude => {
  return {
    category: {
      include: {
        parent: true, // Include parent category for hierarchical queries
      },
    },
    source: true,
    reportedBy: true,
    medias: {
      orderBy: {
        isPrimary: "desc",
      },
    },
    ...params,
  };
};

/**
 * Builds the WHERE clause for raw SQL queries with parameters.
 *
 * @param params - Search parameters including filters and subscriptions
 * @returns Object containing WHERE clause string, parameters array, and next parameter index
 */
export const buildHazardsWhereClauseRaw = (
  params: HazardSearchParams & {
    subscriptions?: LocationSubscription[] | undefined;
  }
): { whereClause: string; queryParams: any[]; paramIndex: number } => {
  const {
    searchString,
    categoryIds,
    severities,
    reportedById,
    reviewStatus,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
    showExpired,
  } = params;

  const whereConditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  // Only include hazards that haven't expired yet
  if (!showExpired) {
    whereConditions.push(`(h."expiresAt" > NOW() AT TIME ZONE 'UTC')`);
  }

  // Apply search string filter if provided
  if (searchString) {
    whereConditions.push(
      `(h.title ILIKE $${paramIndex} OR h."shortDescription" ILIKE $${paramIndex})`
    );
    queryParams.push(`%${searchString}%`);
    paramIndex++;
  }

  // Apply category filter if provided
  if (categoryIds) {
    const categoryArray = Array.isArray(categoryIds)
      ? categoryIds
      : [categoryIds];

    // Create placeholders for direct category match
    const directPlaceholders = categoryArray
      .map(() => `$${paramIndex++}`)
      .join(",");

    // Create placeholders for parent category match
    const parentPlaceholders = categoryArray
      .map(() => `$${paramIndex++}`)
      .join(",");

    // Match hazards where either the category itself is in the list
    // OR the category's parent is in the list (for subcategories)
    whereConditions.push(`(
      h."categoryId" IN (${directPlaceholders}) 
      OR h."categoryId" IN (
        SELECT hc_sub."id" FROM "HazardCategory" hc_sub 
        WHERE hc_sub."parentId" IN (${parentPlaceholders})
      )
    )`);

    // Add parameters twice - once for direct match, once for parent match
    queryParams.push(...categoryArray, ...categoryArray);
  }

  // Apply severities filter if provided
  if (severities && severities.length > 0) {
    const severityArray = Array.isArray(severities) ? severities : [severities];
    const severityPlaceholders = severityArray
      .map(() => `$${paramIndex++}::"HazardSeverity"`)
      .join(",");
    whereConditions.push(`h.severity IN (${severityPlaceholders})`);
    queryParams.push(...severityArray);
  }

  // Apply reporter filter if provided
  if (reportedById) {
    whereConditions.push(`h."reportedById" = $${paramIndex}`);
    queryParams.push(reportedById);
    paramIndex++;
  }

  // Apply review status filter if provided
  if (reviewStatus) {
    whereConditions.push(
      `h."reviewStatus" = $${paramIndex}::"HazardReviewStatus"`
    );
    queryParams.push(reviewStatus);
    paramIndex++;
  }

  // Apply geographic bounds filter if provided
  if (northeastLat && northeastLng && southwestLat && southwestLng) {
    // If we also have subscriptions, combine with OR
    if (subscriptions && subscriptions.length > 0) {
      // Build subscription conditions and regular bounds condition with OR
      const allConditions = [];

      // Add subscription conditions first
      subscriptions.forEach(() => {
        const condition = `(h.latitude BETWEEN $${paramIndex} AND $${
          paramIndex + 1
        } AND h.longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3})`;
        allConditions.push(condition);
        paramIndex += 4;
      });

      // Add regular bounds condition
      const regularBounds = `(h.latitude BETWEEN $${paramIndex} AND $${
        paramIndex + 1
      } AND h.longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3})`;
      allConditions.push(regularBounds);
      paramIndex += 4;

      whereConditions.push(`(${allConditions.join(" OR ")})`);

      // Add subscription parameters first (to match the parameter order)
      subscriptions.forEach((sub) => {
        queryParams.push(
          sub.southwestLat,
          sub.northeastLat,
          sub.southwestLng,
          sub.northeastLng
        );
      });

      // Add regular bounds parameters
      queryParams.push(southwestLat, northeastLat, southwestLng, northeastLng);
    } else {
      // Only regular bounds, no subscriptions
      whereConditions.push(
        `(h.latitude BETWEEN $${paramIndex} AND $${
          paramIndex + 1
        } AND h.longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3})`
      );
      queryParams.push(southwestLat, northeastLat, southwestLng, northeastLng);
      paramIndex += 4;
    }
  } else if (subscriptions && subscriptions.length > 0) {
    // Only subscription bounds, no regular bounds
    const subscriptionConditions = subscriptions.map(() => {
      const condition = `(h.latitude BETWEEN $${paramIndex} AND $${
        paramIndex + 1
      } AND h.longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3})`;
      paramIndex += 4;
      return condition;
    });
    whereConditions.push(`(${subscriptionConditions.join(" OR ")})`);

    subscriptions.forEach((sub) => {
      queryParams.push(
        sub.southwestLat,
        sub.northeastLat,
        sub.southwestLng,
        sub.northeastLng
      );
    });
  }

  const whereClause =
    whereConditions.length > 0 ? whereConditions.join(" AND ") : "TRUE";

  return { whereClause, queryParams, paramIndex };
};

/**
 * Builds the ORDER BY clause for raw SQL queries with optimal database-level sorting.
 * Implements the client's required sorting order:
 * 1. Severity: Emergency -> Watch and Act -> Advice -> Info
 * 2. Distance: Closer first (when user location provided)
 * 3. Recency: Newer first
 * 4. Confidence Score (ACS): Higher first
 *
 * @param userLat - User latitude for distance calculation (optional)
 * @param userLng - User longitude for distance calculation (optional)
 * @param paramIndex - Current parameter index for SQL placeholders
 * @param queryParams - Parameters array to append distance parameters to
 * @param sortSettings - Array of sort settings to apply custom ordering
 * @returns Object containing ORDER BY clause and updated parameter index
 */
export const buildHazardsOrderByClauseRaw = (
  userLat?: number,
  userLng?: number,
  paramIndex: number = 1,
  queryParams: any[] = [],
  sortSettings?: SortSetting[]
): { orderByClause: string; paramIndex: number } => {
  let currentParamIndex = paramIndex;
  const orderByClauses: string[] = [];

  // If sortSettings are provided, use them for ordering
  if (sortSettings && sortSettings.length > 0) {
    for (const setting of sortSettings) {
      // Handle severity sorting
      if (
        setting.severity &&
        (setting.severity === "asc" || setting.severity === "desc")
      ) {
        const direction = setting.severity.toUpperCase();
        orderByClauses.push(`
            CASE h.severity
              WHEN 'unknown' THEN 1
              WHEN 'info' THEN 2
              WHEN 'low' THEN 3
              WHEN 'advice' THEN 4
              WHEN 'watchAndAct' THEN 5
              WHEN 'emergency' THEN 6
              ELSE 7
            END ${direction}`);
      }

      // Handle distance sorting
      if (
        setting.distance &&
        (setting.distance === "asc" || setting.distance === "desc") &&
        userLat &&
        userLng
      ) {
        const direction = setting.distance.toUpperCase();
        orderByClauses.push(`
          CASE 
            WHEN h.latitude IS NOT NULL AND h.longitude IS NOT NULL THEN
              (6371 * acos(cos(radians($${currentParamIndex})) * cos(radians(h.latitude)) * cos(radians(h.longitude) - radians($${
          currentParamIndex + 1
        })) + sin(radians($${currentParamIndex})) * sin(radians(h.latitude))))
            ELSE 999999
          END ${direction}`);
        queryParams.push(userLat, userLng);
        currentParamIndex += 2;
      }

      // Handle createdAt sorting
      if (
        setting.createdAt &&
        (setting.createdAt === "asc" || setting.createdAt === "desc")
      ) {
        const direction = setting.createdAt.toUpperCase();
        orderByClauses.push(`h."createdAt" ${direction}`);
      }

      // Handle confidenceScore sorting
      if (
        setting.confidenceScore &&
        (setting.confidenceScore === "asc" ||
          setting.confidenceScore === "desc")
      ) {
        const direction = setting.confidenceScore.toUpperCase();
        orderByClauses.push(`COALESCE(h."confidenceScore", 0) ${direction}`);
      }
    }
  } else {
    // Default sorting when no sortSettings are provided
    orderByClauses.push(`
      CASE h.severity
        WHEN 'emergency' THEN 1
        WHEN 'watchAndAct' THEN 2
        WHEN 'advice' THEN 3
        WHEN 'info' THEN 4
        ELSE 5
      END ASC`);

    // Add distance ordering if user location is provided
    if (userLat && userLng) {
      orderByClauses.push(`
        CASE 
          WHEN h.latitude IS NOT NULL AND h.longitude IS NOT NULL THEN
            (6371 * acos(cos(radians($${currentParamIndex})) * cos(radians(h.latitude)) * cos(radians(h.longitude) - radians($${
        currentParamIndex + 1
      })) + sin(radians($${currentParamIndex})) * sin(radians(h.latitude))))
          ELSE 999999
        END ASC`);
      queryParams.push(userLat, userLng);
      currentParamIndex += 2;
    }

    // Add default recency and confidence score ordering
    orderByClauses.push(`h."createdAt" DESC`);
    orderByClauses.push(`COALESCE(h."confidenceScore", 0) DESC`);
  }

  const orderByClause = orderByClauses.join(", ");
  return { orderByClause, paramIndex: currentParamIndex };
};

/**
 * Determines the expiry date for a hazard based on its severity level.
 *
 * Different severity levels correspond to different durations before the hazard is considered expired.
 */
export const getHazardExpiryDateFromSeverity = (
  severity: HazardSeverity
): Date => {
  const now = new Date();

  switch (severity) {
    case HazardSeverity.info:
      now.setHours(now.getHours() + 6); // 6 hours for info
      break;
    case HazardSeverity.low:
      now.setHours(now.getHours() + 12); // 12 hours for low
      break;
    case HazardSeverity.advice:
      now.setHours(now.getHours() + 12); // 12 hours for advice
      break;
    case HazardSeverity.watchAndAct:
      now.setHours(now.getHours() + 24); // 24 hours for watchAndAct
      break;
    case HazardSeverity.emergency:
      now.setHours(now.getHours() + 48); // 48 hours for emergency
      break;
    default:
      now.setDate(now.getDate() + 30); // Default to 30 days
  }

  return now;
};

/**
 * Adjusts the expiration time of a hazard by a specified number of milliseconds.
 * If the current expiration time is null, it returns null.
 * If the adjustment results in a past date, it returns null.
 */
export const adjustExpirationTime = (
  currentExpiresAt: Date | null,
  adjustmentMs: number
): Date | null => {
  if (!currentExpiresAt) return null;

  const newExpiresAt = new Date(currentExpiresAt.getTime() + adjustmentMs);
  const now = new Date();

  // Ensure the new expiration time is not in the past
  if (newExpiresAt <= now) {
    // If adjustment would put it in the past, return null
    return null;
  }

  return newExpiresAt;
};

/**
 * Returns a formatted string representation of the hazard severity.
 */
export const getFormattedHazardSeverity = (
  severity: HazardSeverity
): string => {
  switch (severity) {
    case HazardSeverity.info:
      return "Info";
    case HazardSeverity.advice:
      return "Advice";
    case HazardSeverity.watchAndAct:
      return "Watch and Act";
    case HazardSeverity.emergency:
      return "Critical";
    default:
      return "Info";
  }
};

/// Returns the keywords string for each hazard severity level.
export const getSeverityKeywords = (severity: HazardSeverity): string => {
  switch (severity) {
    case HazardSeverity.unknown:
      return `"unknown", "not applicable"`;
    case HazardSeverity.info:
      return `"info", "information"`;
    case HazardSeverity.low:
      return `"low"`;
    case HazardSeverity.advice:
      return `"advice"`;
    case HazardSeverity.watchAndAct:
      return `"watchAndAct", "watch and act", "watch & act"`;
    case HazardSeverity.emergency:
      return `"emergency", "emergency warning"`;
  }
};

/// Returns call to actions list for each hazard severity level.
export const getSeverityCallToActions = (
  severity: HazardSeverity
): string[] => {
  switch (severity) {
    case HazardSeverity.info:
    case HazardSeverity.low:
      return ["Stay informed", "Monitor conditions", "Avoid the area"];
    case HazardSeverity.advice:
      return [
        "Prepare now",
        "Stay informed",
        "Monitor conditions",
        "Stay informed/threat is reduced",
        "Avoid the area",
        "Return with caution",
        "Avoid smoke",
      ];
    case HazardSeverity.watchAndAct:
      return [
        "Prepare to leave/evacuate",
        "Leave/evacuate now (if you are not prepared)",
        "Prepare to take shelter",
        "Move/stay indoors",
        "Stay near shelter",
        "Walk two or more streets back",
        "Monitor conditions as they are changing",
        "Be aware of ember attacks",
        "Move to higher ground (away from creeks/rivers/coast)",
        "Limit time outside (cyclone, heat asthma)",
        "Avoid the area",
        "Stay away from damaged buildings and other hazards",
        "Prepare for isolation",
        "Protect yourself against the impacts of extreme heat",
        "Do not enter flood water",
        "Not safe to return",
        "Prepare your property (cyclone/storm)",
      ];
    case HazardSeverity.emergency:
      return [
        "Leave/evacuate (immediately, by am/pm/hazard timing)",
        "Seek/take shelter now",
        "Shelter indoors now",
        "Too late/dangerous to leave",
      ];
    case HazardSeverity.unknown:
    default:
      return ["Stay informed", "Monitor conditions"];
  }
};

/**
 * Lists of allowed severities for Australian Warnings System (AWS) hazards.
 */
export const allowedSeveritiesAWS: HazardSeverity[] = [
  HazardSeverity.unknown,
  HazardSeverity.advice,
  HazardSeverity.watchAndAct,
  HazardSeverity.emergency,
];

/**
 * Lists of allowed severities for non-AWS hazards.
 */
export const allowedSeveritiesNonAWS: HazardSeverity[] = [
  HazardSeverity.info,
  HazardSeverity.low,
  HazardSeverity.advice, // equivalent to 'moderate'
  HazardSeverity.watchAndAct, // equivalent to 'high'
  HazardSeverity.emergency, // equivalent to 'critical'
];

/**
 * Finds and returns the lowest severity from a list of severities.
 * The severity hierarchy is defined as:
 * unknown < info < low < advice < watchAndAct < emergency
 */
export const getLowestSeverity = (
  severities: HazardSeverity[]
): HazardSeverity => {
  const severityOrder: HazardSeverity[] = [
    HazardSeverity.unknown,
    HazardSeverity.info,
    HazardSeverity.low,
    HazardSeverity.advice,
    HazardSeverity.watchAndAct,
    HazardSeverity.emergency,
  ];

  let lowestSeverity: HazardSeverity = severities[0]!;

  for (const severity of severities) {
    if (
      severityOrder.indexOf(severity) < severityOrder.indexOf(lowestSeverity)
    ) {
      lowestSeverity = severity;
    }
  }

  return lowestSeverity;
};

/**
 * Adjusts the hazard severity to the closest allowed severity from a given list.
 *
 * If the current severity is already allowed, it is returned as is.
 * If not, the function finds the closest severity based on defined hierarchy.
 */
export const getClosestAllowedSeverity = (
  currentSeverity: HazardSeverity,
  allowedSeverities: HazardSeverity[]
): HazardSeverity => {
  let finalSeverity: HazardSeverity = currentSeverity;
  if (allowedSeverities && allowedSeverities.length > 0) {
    if (!allowedSeverities.includes(currentSeverity)) {
      // Define severity hierarchy order
      const severityOrder: HazardSeverity[] = [
        HazardSeverity.unknown,
        HazardSeverity.info,
        HazardSeverity.low,
        HazardSeverity.advice, // equivalent to 'moderate'
        HazardSeverity.watchAndAct, // equivalent to 'high'
        HazardSeverity.emergency, // equivalent to 'critical'
      ];

      const currentSeverityIndex = severityOrder.indexOf(currentSeverity);

      // If severity is less than info, upgrade to info (minimum allowed severity)
      if (currentSeverityIndex < severityOrder.indexOf(HazardSeverity.info)) {
        finalSeverity = allowedSeverities.includes(HazardSeverity.info)
          ? HazardSeverity.info
          : allowedSeverities[0]!;
      }
      // If severity is greater than emergency, cap at emergency (maximum allowed severity)
      else if (
        currentSeverityIndex > severityOrder.indexOf(HazardSeverity.emergency)
      ) {
        finalSeverity = allowedSeverities.includes(HazardSeverity.emergency)
          ? HazardSeverity.emergency
          : allowedSeverities[allowedSeverities.length - 1]!;
      }
      // For severities between info and emergency, find the closest allowed severity
      else {
        finalSeverity = findClosestAllowedSeverity(
          currentSeverity,
          allowedSeverities,
          severityOrder
        );
      }
    }
  }

  return finalSeverity;
};

/**
 * Finds the closest allowed severity to the given severity within the allowed severities array.
 * Prefers upgrading severity over downgrading when distances are equal.
 */
const findClosestAllowedSeverity = (
  currentSeverity: HazardSeverity,
  allowedSeverities: HazardSeverity[],
  severityOrder: HazardSeverity[]
): HazardSeverity => {
  const currentIndex = severityOrder.indexOf(currentSeverity);

  // Map allowed severities to their indices and sort by proximity to current severity
  const allowedWithIndices = allowedSeverities
    .map((severity) => ({
      severity,
      index: severityOrder.indexOf(severity),
      distance: Math.abs(severityOrder.indexOf(severity) - currentIndex),
    }))
    .sort((a, b) => {
      // Sort by distance first
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      // If distances are equal, prefer higher severity (upgrading over downgrading)
      return b.index - a.index;
    });

  return allowedWithIndices[0]!.severity;
};
