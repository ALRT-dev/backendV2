import {
  type Prisma,
  type LocationSubscription,
  HazardVoteType,
  HazardSeverity,
  type Hazard,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import openai from "../utils/open_ai_client.util.js";
import { HttpError } from "../models/http_error.js";
import type { AISummaryResponse } from "../models/ai_summary_response_interface.js";
import type { AIReviewResponse } from "../models/ai_review_response_interface.js";
import type { HazardSearchParams } from "../models/hazard_search_params_interface.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";
import { calculateUserReportsStatus } from "./user.service.js";

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
  }
): Prisma.HazardWhereInput => {
  const {
    searchString,
    categoryIds,
    reportedById,
    reviewStatus,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
  } = params;

  // Build the where clause for filtering hazards
  const andConditions: Prisma.HazardWhereInput[] = [];

  // Only include hazards that haven't expired yet
  andConditions.push({
    expiresAt: {
      gt: new Date(),
    },
  });

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

    andConditions.push({
      categoryId: {
        in: categoryIdArray,
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
    category: true,
    source: true,
    reportedBy: true,
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
    reportedById,
    reviewStatus,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
  } = params;

  const whereConditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  // Only include hazards that haven't expired yet
  whereConditions.push(
    `(h."expiresAt" IS NULL OR h."expiresAt" > NOW() AT TIME ZONE 'UTC')`
  );

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
    const placeholders = categoryArray.map(() => `$${paramIndex++}`).join(",");
    whereConditions.push(`h."categoryId" IN (${placeholders})`);
    queryParams.push(...categoryArray);
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
 * @returns Object containing ORDER BY clause and updated parameter index
 */
export const buildHazardsOrderByClauseRaw = (
  userLat?: number,
  userLng?: number,
  paramIndex: number = 1,
  queryParams: any[] = []
): { orderByClause: string; paramIndex: number } => {
  // Start with severity ordering
  let orderByClause = `
    CASE h.severity
      WHEN 'emergency' THEN 1
      WHEN 'watchAndAct' THEN 2
      WHEN 'advice' THEN 3
      WHEN 'info' THEN 4
      ELSE 5
    END ASC`;

  let currentParamIndex = paramIndex;

  // Add distance ordering if user location is provided
  if (userLat && userLng) {
    orderByClause += `,
    CASE 
      WHEN h.latitude IS NOT NULL AND h.longitude IS NOT NULL THEN
        (6371 * acos(cos(radians($${currentParamIndex})) * cos(radians(h.latitude)) * cos(radians(h.longitude) - radians($${
      currentParamIndex + 1
    })) + sin(radians($${currentParamIndex})) * sin(radians(h.latitude))))
      ELSE 999999
    END ASC`;
    queryParams.push(userLat, userLng);
    currentParamIndex += 2;
  }

  // Add recency and confidence score ordering
  orderByClause += `,
    h."createdAt" DESC,
    COALESCE(h."confidenceScore", 0) DESC`;

  return { orderByClause, paramIndex: currentParamIndex };
};

/**
 * Fetches hazards using raw SQL with database-level sorting for optimal performance.
 * This is the main function that combines WHERE and ORDER BY clause builders.
 */
export const getHazardsApplyingFiltersRaw = async (
  searchParams: HazardSearchParams & {
    userId?: string | undefined;
    subscriptions?: LocationSubscription[] | undefined;
  }
): Promise<Hazard[]> => {
  const { userLat, userLng, userId, page = 1, pageSize = 20 } = searchParams;

  // Build WHERE clause and get initial parameters
  const { whereClause, queryParams, paramIndex } =
    buildHazardsWhereClauseRaw(searchParams);

  // Build ORDER BY clause
  const { orderByClause, paramIndex: updatedParamIndex } =
    buildHazardsOrderByClauseRaw(userLat, userLng, paramIndex, queryParams);

  // Add pagination parameters
  queryParams.push(pageSize, (page - 1) * pageSize);
  const paginationParamIndex = updatedParamIndex;
  const limitClause = `LIMIT $${paginationParamIndex} OFFSET $${
    paginationParamIndex + 1
  }`;

  // Add userId parameter for vote join if needed
  let userVoteParamIndex: number | undefined;
  if (userId) {
    queryParams.push(userId);
    userVoteParamIndex = queryParams.length;
  }

  // Build the complete query
  let query = `
    SELECT 
      h.*,
      hc.name as "categoryName",
      hc.emoji as "categoryEmoji", 
      hs.name as "sourceName",
      hs.url as "sourceUrl",
      u.id as "reportedByUserId",
      u.name as "reportedByName",
      u.email as "reportedByEmail"`;

  if (userId) {
    query += `, v."voteType" as "userVoteType"`;
  }

  query += `
    FROM "Hazard" h
    LEFT JOIN "HazardCategory" hc ON h."categoryId" = hc.id
    LEFT JOIN "HazardSource" hs ON h."sourceId" = hs.id  
    LEFT JOIN "User" u ON h."reportedById" = u.id`;

  if (userId && userVoteParamIndex) {
    query += ` LEFT JOIN "HazardVote" v ON h.id = v."hazardId" AND v."userId" = $${userVoteParamIndex}`;
  }

  query += `
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
    ${limitClause}`;

  // Execute the query
  const hazards = (await prisma.$queryRawUnsafe(
    query,
    ...queryParams
  )) as any[];

  console.log("Query: ", query);
  console.log("Query Parameters: ", queryParams);
  console.log("Query Results: ", hazards.length);

  // Get unique reporter IDs from hazards that have reporters
  const reporterIds = Array.from(
    new Set(
      hazards
        .map((hazard: any) => hazard.reportedById)
        .filter(Boolean) as string[]
    )
  );

  // Calculate UserReportsStatus for each unique reporter
  const reportersStatusMap = new Map<string, UserReportsStatus>();
  if (reporterIds.length > 0) {
    const statusPromises = reporterIds.map(async (reporterId) => {
      const status = await calculateUserReportsStatus(reporterId);
      return { reporterId, status };
    });

    const statusResults = await Promise.all(statusPromises);
    statusResults.forEach(({ reporterId, status }) => {
      reportersStatusMap.set(reporterId, status);
    });
  }

  // Transform the result to include proper structure
  return hazards.map((hazard: any) => {
    // Create reportedBy object with reportsStatus
    const enhancedReportedBy = hazard.reportedByUserId
      ? {
          id: hazard.reportedByUserId,
          name: hazard.reportedByName,
          email: hazard.reportedByEmail,
          reportsStatus:
            reportersStatusMap.get(hazard.reportedByUserId) ??
            UserReportsStatus.unverified,
        }
      : null;

    // Clean up the hazard object
    const {
      reportedByUserId,
      reportedByName,
      reportedByEmail,
      categoryName,
      categoryEmoji,
      sourceName,
      sourceUrl,
      userVoteType,
      ...cleanHazard
    } = hazard;

    return {
      ...cleanHazard,
      userVoteType: userVoteType || undefined,
      reportedBy: enhancedReportedBy,
      category: hazard.categoryId
        ? {
            id: hazard.categoryId,
            name: categoryName,
            emoji: categoryEmoji,
          }
        : null,
      source: hazard.sourceId
        ? {
            id: hazard.sourceId,
            name: sourceName,
            url: sourceUrl,
          }
        : null,
    };
  });
};

/**
 * Fetches hazards from the database applying various filters and pagination.
 *
 * This function retrieves hazards based on search strings, categories, reporting user,
 * review status, geographic bounds, and user subscriptions. It also supports pagination
 * and includes related entities as specified.
 */
export const getHazardsApplyingFilters = async (
  params: HazardSearchParams & {
    userId?: string | undefined;
    subscriptions?: LocationSubscription[] | undefined;
  }
) => {
  const {
    searchString,
    categoryIds,
    reportedById,
    reviewStatus,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
    userId,
    page = 1,
    pageSize = 20,
  } = params;

  const whereClause = buildHazardsWhereClause({
    searchString,
    categoryIds,
    reportedById,
    reviewStatus,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    subscriptions,
  });

  const hazards = await prisma.hazard.findMany({
    where: whereClause,
    include: buildHazardInclude({
      ...(userId && {
        votes: {
          where: {
            userId: userId,
          },
          select: {
            voteType: true,
          },
        },
      }),
    }),
    orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Get unique reporter IDs from hazards that have reporters
  const reporterIds = Array.from(
    new Set(
      hazards.map((hazard) => hazard.reportedById).filter(Boolean) as string[]
    )
  );

  // Calculate UserReportsStatus for each unique reporter
  const reportersStatusMap = new Map<string, UserReportsStatus>();
  if (reporterIds.length > 0) {
    const statusPromises = reporterIds.map(async (reporterId) => {
      const status = await calculateUserReportsStatus(reporterId);
      return { reporterId, status };
    });

    const statusResults = await Promise.all(statusPromises);
    statusResults.forEach(({ reporterId, status }) => {
      reportersStatusMap.set(reporterId, status);
    });
  }

  type TransformedHazardPayload = Prisma.HazardGetPayload<{}> & {
    userVoteType?: HazardVoteType | undefined;
    reportedBy?: any;
  };

  // Transform the result to include userVoteType and reporterReportsStatus
  return hazards.map((hazard): TransformedHazardPayload => {
    const { votes, ...hazardWithoutVotes } = hazard;

    // Create reportedBy object with reportsStatus
    const enhancedReportedBy = hazard.reportedBy
      ? {
          ...hazard.reportedBy,
          reportsStatus: hazard.reportedById
            ? reportersStatusMap.get(hazard.reportedById) ??
              UserReportsStatus.unverified
            : UserReportsStatus.unverified,
        }
      : null;

    return {
      ...hazardWithoutVotes,
      userVoteType: votes?.[0]?.voteType,
      reportedBy: enhancedReportedBy,
    };
  });
};

/**
 * Reviews a hazard report using AI to determine its validity, severity, and clarity.
 *
 * The AI provides a structured response indicating whether the report is accepted or rejected,
 * along with feedback, a concise title, a short description, a summary, and a confidence level.
 */
export const reviewHazard = async ({
  title,
  description,
  latitude,
  longitude,
  locationName,
  severity,
  occurredAt,
}: {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  locationName?: string | undefined | null;
  severity: HazardSeverity;
  occurredAt: string | Date;
}): Promise<AIReviewResponse> => {
  const systemPrompt = `
You are an AI reviewer for a hazard alert system. Your task is to evaluate user-submitted hazard reports for validity, severity, and clarity.

CONFIDENCE LEVELS:
- "high": Detailed, specific, credible information with clear location and time
- "medium": Reasonable detail but some ambiguity or missing information
- "low": Vague, unclear, or potentially unreliable information

Always respond with valid JSON containing these exact fields:
{
  "reviewStatus": "accepted|rejected (accepted if the description is a valid hazard report (not spam or nonsense or profanity), rejected otherwise)",
  "reviewFeedback": "string (constructive feedback for the reporter, max 200 chars)"
  "title": "string (a concise, clear title for the hazard, max 80 chars)",
  "shortDescription": "string (a one-line summary for notifications, max 120 chars)",
  "summary": "string (a 3-4 sentence summary of the hazard)",
  "confidence": "high|medium|low (based on detail quality and specificity)",
}
`;

  const userPrompt = `
Evaluate this hazard:

Title: ${title}
Description: ${description}
Location: ${locationName ? `${locationName}, ` : ""}(${latitude}, ${longitude})
Severity Level: ${severity}
Occurred At: ${occurredAt}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  if (response.choices.length === 0 || !response.choices[0]?.message?.content) {
    throw new HttpError(500, "AI review failed: No response from AI");
  }

  const content = response.choices[0].message.content;
  if (!content) {
    throw new HttpError(500, "AI review failed: Empty response from AI");
  }

  try {
    const aiReview = JSON.parse(content) as AIReviewResponse;
    return aiReview;
  } catch (parseError) {
    console.error("Failed to parse AI review response:", parseError);
    throw new HttpError(500, "AI review failed: Invalid response format");
  }
};

/**
 * Summarizes a hazard report using AI to generate a concise title, short description, summary, confidence level, and severity.
 *
 * The AI provides a structured response to standardize the hazard report for clarity and actionability.
 */
export const summarizeHazard = async ({
  title,
  description,
  latitude,
  longitude,
}: {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
}): Promise<AISummaryResponse> => {
  const systemPrompt = `
You are a hazard analysis assistant for a public safety application. Your role is to review and standardize hazard reports to ensure they are clear, actionable, and appropriately categorized.

SEVERITY LEVELS:
- "info": General awareness, no immediate action needed (traffic updates, minor incidents)
- "advice": Caution recommended (weather warnings, road closures)
- "watchAndAct": Active monitoring and preparation needed (approaching storms, evacuation warnings)
- "emergency": Immediate danger requiring urgent action (active fires, severe flooding)

CONFIDENCE LEVELS:
- "high": Detailed, specific, credible information with clear location and time
- "medium": Reasonable detail but some ambiguity or missing information
- "low": Vague, unclear, or potentially unreliable information

Always respond with valid JSON containing these exact fields:
{
  "title": "string (a concise, clear title for the hazard, max 80 chars)",
  "shortDescription": "string (a one-line summary for notifications, max 120 chars)",
  "summary": "string (a 3-4 sentence summary of the hazard)",
  "confidence": "high|medium|low (based on detail quality and specificity)",
  "severity": "info|advice|watchAndAct|emergency (based on immediate danger level)"
}
`;

  const userPrompt = `
Analyze this hazard report:

TITLE: ${title}
DESCRIPTION: ${description}
LOCATION: ${latitude}, ${longitude}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  if (response.choices.length === 0 || !response.choices[0]?.message?.content) {
    throw new HttpError(500, "AI summarization failed: No response from AI");
  }

  const content = response.choices[0].message.content;
  if (!content) {
    throw new HttpError(500, "AI summarization failed: Empty response from AI");
  }

  try {
    const aiSummary = JSON.parse(content) as AISummaryResponse;
    return aiSummary;
  } catch (parseError) {
    console.error("Failed to parse AI summary response:", parseError);
    throw new HttpError(
      500,
      "AI summarization failed: Invalid response format"
    );
  }
};
