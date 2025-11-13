import {
  type Prisma,
  type LocationSubscription,
  HazardVoteType,
  HazardSeverity,
  type Hazard,
  type HazardCategory,
  FireStatus,
  ConfigurationKey,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import openai from "../utils/open_ai_client.util.js";
import { HttpError } from "../models/http_error.js";
import type { AISummaryResponse } from "../models/ai_summary_response_interface.js";
import type { AIReviewResponse } from "../models/ai_review_response_interface.js";
import type { HazardSearchParams } from "../models/hazard_search_params_interface.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";
import { calculateBulkUserReportsStatus } from "../utils/user_status.util.js";
import {
  buildHazardInclude,
  buildHazardsOrderByClauseRaw,
  buildHazardsWhereClause,
  buildHazardsWhereClauseRaw,
  getSeverityCallToActions,
  performKeywordMatchingForSeverity,
} from "../utils/hazard.util.js";
import type { SeverityKeywords } from "../models/severity_keywords_interface.js";
import type { SeverityCallToActions } from "../models/severity_call_to_action_interface.js";
import { getPromptById } from "./ai-prompt.service.js";
import { getAIPromptConfiguration } from "./configuration.service.js";

/**
 * Utility function to add delay between API calls
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Utility function to retry API calls with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // If it's a rate limit error and we have retries left
      if (error?.status === 429 && attempt < maxRetries) {
        // Don't retry if it's a quota exceeded error (insufficient_quota)
        if (
          error?.code === "insufficient_quota" ||
          error?.type === "insufficient_quota"
        ) {
          console.log(
            "OpenAI quota exceeded, not retrying. Please check your billing and quota limits."
          );
          throw error;
        }

        const retryAfterMs =
          error?.headers?.["retry-after-ms"] ||
          (error?.headers?.["retry-after"]
            ? parseInt(error.headers["retry-after"]) * 1000
            : null);
        const delayMs = retryAfterMs || baseDelay * Math.pow(2, attempt);

        console.log(
          `Rate limit hit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${
            maxRetries + 1
          })`
        );
        await delay(delayMs);
        continue;
      }

      // If it's not a rate limit error or we're out of retries, throw
      throw error;
    }
  }

  throw lastError!;
};

/**
 * Process items in batches with rate limiting to avoid hitting OpenAI rate limits
 */
const processBatchWithRateLimit = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayBetweenBatches: number = 2000
): Promise<R[]> => {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        items.length / batchSize
      )} (${batch.length} items)`
    );

    const batchResults = await Promise.all(
      batch.map((item) => processor(item))
    );

    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
      await delay(delayBetweenBatches);
    }
  }

  return results;
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
): Promise<Hazard[]> => {
  const { userId, page = 1, pageSize = 20 } = params;

  const whereClause = buildHazardsWhereClause(params);

  // Use a more optimized query strategy
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
    orderBy: [
      // Optimize ordering for performance - use indexed columns first
      { severity: "desc" }, // Use enum ordering which is faster
      { confidenceScore: "desc" },
      { createdAt: "desc" },
    ],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Optimize user reports status calculation by using bulk calculation
  const reporterIds = Array.from(
    new Set(
      hazards.map((hazard) => hazard.reportedById).filter(Boolean) as string[]
    )
  );

  // Use bulk calculation instead of individual calls for better performance
  const reportersStatusMap = await calculateBulkUserReportsStatus(reporterIds);

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
 * Fetches hazards using raw SQL with database-level sorting for optimal performance.
 * This is the main function that combines WHERE and ORDER BY clause builders.
 * OPTIMIZED VERSION with improved query structure and reduced N+1 queries.
 */
export const getHazardsApplyingFiltersRaw = async (
  params: HazardSearchParams & {
    userId?: string | undefined;
    subscriptions?: LocationSubscription[] | undefined;
  }
): Promise<Hazard[]> => {
  const {
    userLat,
    userLng,
    userId,
    sortSettings,
    page = 1,
    pageSize = 20,
  } = params;

  // Build WHERE clause and get initial parameters
  const { whereClause, queryParams, paramIndex } =
    buildHazardsWhereClauseRaw(params);

  // Build ORDER BY clause
  const { orderByClause, paramIndex: updatedParamIndex } =
    buildHazardsOrderByClauseRaw(
      userLat,
      userLng,
      paramIndex,
      queryParams,
      sortSettings
    );

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

  // OPTIMIZED: Build a more efficient query with better JOINs and aggregations
  let query = `
    WITH hazard_data AS (
      SELECT 
        h.*,
        hc.name as "categoryName",
        hc.description as "categoryDescription", 
        hc.color as "categoryColor",
        hc."parentId" as "categoryParentId",
        hcp.name as "categoryParentName",
        hcp.description as "categoryParentDescription",
        hcp.color as "categoryParentColor",
        hs.name as "sourceName",
        hs.url as "sourceUrl",
        u.id as "reportedByUserId",
        u.name as "reportedByName",
        u.email as "reportedByEmail",
        u."xpPoints" as "reportedByXpPoints",
        u."reliabilityScore" as "reportedByReliabilityScore"`;

  if (userId) {
    query += `, v."voteType" as "userVoteType"`;
  }

  query += `
      FROM "Hazard" h
      LEFT JOIN "HazardCategory" hc ON h."categoryId" = hc.id
      LEFT JOIN "HazardCategory" hcp ON hc."parentId" = hcp.id
      LEFT JOIN "HazardSource" hs ON h."sourceId" = hs.id  
      LEFT JOIN "User" u ON h."reportedById" = u.id`;

  if (userId && userVoteParamIndex) {
    query += ` LEFT JOIN "HazardVote" v ON h.id = v."hazardId" AND v."userId" = $${userVoteParamIndex}`;
  }

  query += `
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      ${limitClause}
    ),
    hazard_medias AS (
      SELECT 
        hm."hazardId",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', hm.id,
            'hazardId', hm."hazardId",
            'userId', hm."userId",
            'url', hm.url,
            's3Key', hm."s3Key",
            'type', hm.type,
            'mimeType', hm."mimeType",
            'fileSize', hm."fileSize",
            'originalName', hm."originalName",
            'thumbnailUrl', hm."thumbnailUrl",
            'isPrimary', hm."isPrimary",
            'createdAt', hm."createdAt",
            'updatedAt', hm."updatedAt"
          )
          ORDER BY hm."isPrimary" DESC, hm."createdAt" ASC
        ) as medias
      FROM "HazardMedia" hm
      WHERE hm."hazardId" IN (SELECT id FROM hazard_data)
      GROUP BY hm."hazardId"
    )
    SELECT 
      hd.*,
      COALESCE(hm.medias, '[]'::json) as medias
    FROM hazard_data hd
    LEFT JOIN hazard_medias hm ON hd.id = hm."hazardId"`;

  // Execute the optimized query
  const hazards = (await prisma.$queryRawUnsafe(
    query,
    ...queryParams
  )) as any[];

  // Get unique reporter IDs from hazards that have reporters
  const reporterIds = Array.from(
    new Set(
      hazards
        .map((hazard: any) => hazard.reportedByUserId)
        .filter(Boolean) as string[]
    )
  );

  // Calculate UserReportsStatus for each unique reporter using the correct bulk method
  const reportersStatusMap = await calculateBulkUserReportsStatus(reporterIds);

  // Transform the result to include proper structure
  return hazards.map((hazard: any) => {
    // Create reportedBy object with reportsStatus
    const enhancedReportedBy = hazard.reportedByUserId
      ? {
          id: hazard.reportedByUserId,
          name: hazard.reportedByName,
          email: hazard.reportedByEmail,
          xpPoints: hazard.reportedByXpPoints,
          reliabilityScore: hazard.reportedByReliabilityScore,
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
      reportedByXpPoints,
      reportedByReliabilityScore,
      categoryName,
      categoryDescription,
      categoryColor,
      categoryParentId,
      categoryParentName,
      categoryParentDescription,
      categoryParentColor,
      sourceName,
      sourceUrl,
      userVoteType,
      medias,
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
            description: categoryDescription,
            color: categoryColor,
            parentId: categoryParentId,
            parent: categoryParentId
              ? {
                  id: categoryParentId,
                  name: categoryParentName,
                  description: categoryParentDescription,
                  color: categoryParentColor,
                }
              : null,
          }
        : null,
      source: hazard.sourceId
        ? {
            id: hazard.sourceId,
            name: sourceName,
            url: sourceUrl,
          }
        : null,
      medias: medias || [],
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
  category,
  latitude,
  longitude,
  locationName,
}: {
  title: string | undefined | null;
  description: string | undefined | null;
  category: HazardCategory;
  latitude: number;
  longitude: number;
  locationName?: string | undefined | null;
}): Promise<AIReviewResponse> => {
  const { userReportReviewAndSummarizePromptId } =
    await getAIPromptConfiguration();
  const { content: promptContent } = await getPromptById(
    userReportReviewAndSummarizePromptId
  );

  const userContent = `Please analyze this hazard report:
      TITLE: ${title || "[No title provided]"}
      DESCRIPTION: ${description || "[No description provided]"}
      LOCATION: ${locationName || ""} (${latitude}, ${longitude})
      CATEGORY: ${category.name}`;

  const response = await retryWithBackoff(async () => {
    return await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: promptContent },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });
  });

  const content = response.choices[0]?.message?.content;
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
  locationName,
  availableCategories,
}: {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  locationName?: string | undefined | null;
  availableCategories?:
    | (HazardCategory & { parent: HazardCategory | null })[]
    | undefined
    | null;
}): Promise<AISummaryResponse> => {
  const { summarizePromptId } = await getAIPromptConfiguration();
  const { content: promptContent } = await getPromptById(summarizePromptId);

  const parentCategories =
    availableCategories
      ?.map((cat) => cat.parent)
      ?.filter((cat) => cat !== null)
      .reduce<HazardCategory[]>((acc, curr) => {
        if (curr && !acc.find((c) => c.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []) || [];

  const categoriesInfo =
    availableCategories
      ?.map((cat) =>
        cat.aiInstructions && cat.aiInstructions.length !== 0
          ? `- CATEGORY: ${cat.id}\nSPECIAL RULES FOR ${cat.id}: ${cat.aiInstructions}`
          : `- CATEGORY: ${cat.id}`
      )
      .join("\n\n") || "";

  const parentCategoriesInfo =
    parentCategories
      ?.map((cat) =>
        cat.aiInstructions && cat.aiInstructions.length !== 0
          ? `- CATEGORY: ${cat.id}\nSPECIAL RULES FOR ${cat.id}: ${cat.aiInstructions}`
          : `- CATEGORY: ${cat.id}`
      )
      .join("\n\n") || "";

  const userContent = `Please standardize this hazard report:
    TITLE: ${title}
    DESCRIPTION: ${description}
    LOCATION: ${locationName || ""} (${latitude}, ${longitude})

    AVAILABLE CATEGORIES:
    ${categoriesInfo}

    AVAILABLE PARENT CATEGORIES:
    ${parentCategoriesInfo}`;

  const response = await retryWithBackoff(async () => {
    return await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: promptContent },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(500, "AI summarization failed: Empty response from AI");
  }

  try {
    const aiSummary = JSON.parse(content) as {
      title: string;
      shortDescription: string;
      summary: string;
      confidence: "high" | "medium" | "low";
      category?: string;
      fireStatus?: string | null;
    };

    const { severity, callToAction } = await getAISeverity({
      title,
      description,
      latitude,
      longitude,
      locationName,
      categoryId: aiSummary.category ?? "other",
    });

    const fullResponse: AISummaryResponse = {
      ...aiSummary,
      category: aiSummary.category ?? "other",
      severity,
      callToAction,
      fireStatus:
        aiSummary.fireStatus && aiSummary.fireStatus in FireStatus
          ? (aiSummary.fireStatus as FireStatus)
          : null,
    };

    return fullResponse;
  } catch (parseError) {
    console.error("Failed to parse AI summary response:", parseError);
    throw new HttpError(
      500,
      "AI summarization failed: Invalid response format"
    );
  }
};

/**
 * Determines the severity of a hazard report using AI based on its title, description, and location.
 *
 * The AI analyzes the content and provides a severity level from predefined categories.
 */
export const getAISeverity = async ({
  title,
  description,
  latitude,
  longitude,
  locationName,
  categoryId,
}: {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  categoryId: string;
  locationName?: string | undefined | null;
}): Promise<{
  severity: HazardSeverity;
  callToAction: string;
}> => {
  try {
    const { severityAndCallToActionPromptId } =
      await getAIPromptConfiguration();
    const { content: promptContent } = await getPromptById(
      severityAndCallToActionPromptId
    );

    const defaultSeverityKeywords: SeverityKeywords = {
      unknown: ["not applicable"],
      info: ["miscellaneous incident", "unclassified", "investigating"],
      advice: ["notable incident", "monitor situation", "potential concern"],
      watchAndAct: [
        "significant incident",
        "action required",
        "serious concern",
      ],
      emergency: ["critical incident", "immediate action", "life threatening"],
    };
    const defaultCallToActions: SeverityCallToActions = {
      unknown: ["No action required"],
      info: ["Stay informed and monitor updates"],
      advice: ["Be cautious and stay alert", "Follow official guidance"],
      watchAndAct: [
        "Prepare to take action",
        "Follow evacuation orders if issued",
      ],
      emergency: [
        "Evacuate immediately",
        "Seek shelter and follow emergency services instructions",
      ],
    };

    let category = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      category = await prisma.hazardCategory.findFirst({
        where: { id: "other" },
      });
      if (!category) {
        category = await prisma.hazardCategory.create({
          data: {
            id: "other",
            name: "Other",
            description: "Miscellaneous hazards not fitting other categories",
            severityKeywords: defaultSeverityKeywords,
            callToActions: defaultCallToActions,
          },
        });
      }
    }
    let severityKeywords = category.severityKeywords as SeverityKeywords | null;
    if (!severityKeywords) {
      severityKeywords = defaultSeverityKeywords;
    }
    let callToActions = category.callToActions as SeverityCallToActions | null;
    if (!callToActions) {
      callToActions = defaultCallToActions;
    }

    // Available severity levels
    const severityLevels = Object.keys(
      severityKeywords
    ) as (keyof SeverityKeywords)[];

    // If callToActions is missing any severity level, fill with defaults
    for (const level of severityLevels) {
      if (!callToActions[level] || callToActions[level].length === 0) {
        callToActions[level] = defaultCallToActions[level];
      }
    }

    // Create keyword context for each severity level
    const keywordContext = Object.entries(severityKeywords)
      .map(([severity, keywords]) => {
        if (keywords.length === 0) return `${severity}: ${severity}`;
        return `${severity}: ${keywords.map((e) => `"${e}"`).join(", ")}`;
      })
      .filter(Boolean)
      .join("\n");

    const userContent = `Please assess the severity of this hazard:

      TITLE: ${title}
      DESCRIPTION: ${description}
      LOCATION: ${locationName || ""} (${latitude}, ${longitude})
      CATEGORY: ${category.name}

      SEVERITY KEYWORDS:
      ${keywordContext}

      ALLOWED SEVERITY LEVELS:
      - ${severityLevels.join("\n- ")}`;

    const response = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: promptContent },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });
    });

    const context = response.choices[0]?.message?.content;
    if (!context) {
      throw new HttpError(
        500,
        "Severity determination failed: Empty response from AI"
      );
    }

    const aiResponse = JSON.parse(context) as {
      severity: HazardSeverity;
      callToAction: string;
    };
    return aiResponse;
  } catch (error) {
    console.error("Error in getAISeverity:", error);

    // Fallback to keyword matching if OpenAI fails
    try {
      const category = await prisma.hazardCategory.findUnique({
        where: { id: categoryId },
      });

      if (category?.severityKeywords) {
        const severityKeywords = category.severityKeywords as SeverityKeywords;
        const severity = performKeywordMatchingForSeverity(
          title,
          description,
          severityKeywords
        );

        return {
          severity,
          callToAction: getSeverityCallToActions(severity)[0] || "",
        };
      }
    } catch (fallbackError) {
      console.error("Error in fallback keyword matching:", fallbackError);
    }

    return {
      severity: HazardSeverity.unknown,
      callToAction: getSeverityCallToActions(HazardSeverity.unknown)[0] || "",
    };
  }
};

/**
 * Rate-limited batch processing for AI operations
 * Use this function when processing multiple hazards to avoid rate limits
 */
export { processBatchWithRateLimit };
