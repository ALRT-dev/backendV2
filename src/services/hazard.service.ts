import {
  type Prisma,
  type LocationSubscription,
  HazardVoteType,
  type Hazard,
  type HazardCategory,
  HazardSeverityBand,
  HazardReviewStatus,
  type HazardSource,
  type AIPrompt,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
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
} from "../utils/hazard.util.js";
import { getPromptById } from "./ai-prompt.service.js";
import { getAIPromptConfiguration } from "./configuration.service.js";
import { executePrompt } from "./open-ai.service.js";
import { MainCategoryId } from "./hazard_category.service.js";

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
  severityBand,
}: {
  title: string | undefined | null;
  description: string | undefined | null;
  category: HazardCategory;
  latitude: number;
  longitude: number;
  locationName?: string | undefined | null;
  severityBand: HazardSeverityBand;
}): Promise<AIReviewResponse> => {
  const { userReportedAlertReviewAndSummarizePromptId } =
    await getAIPromptConfiguration();
  const { content: promptContent, model } = await getPromptById(
    userReportedAlertReviewAndSummarizePromptId[`${severityBand}PromptId`]
  );

  const userContent = `Please analyze this hazard report:
      TITLE: ${title || "[No title provided]"}
      DESCRIPTION: ${description || "[No description provided]"}
      LOCATION: ${locationName || ""} (${latitude}, ${longitude})
      CATEGORY: ${category.name}`;

  const response = await executePrompt({
    model: model,
    systemPromptContent: promptContent,
    userPromptContent: userContent,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(500, "AI review failed: Empty response from AI");
  }

  try {
    const aiReview = JSON.parse(content) as {
      title: string;
      summary: string;
      callsToAction: string[];
      confidence: "high" | "medium" | "low";
    };

    return {
      reviewStatus: HazardReviewStatus.accepted,
      title: aiReview.title,
      summary: aiReview.summary,
      callsToAction: aiReview.callsToAction,
      confidence: aiReview.confidence,
    };
  } catch (parseError) {
    console.error("Failed to parse AI review response:", parseError);
    throw new HttpError(500, "AI review failed: Invalid response format");
  }
};

/**
 * Summarizes a hazard report using AI to generate a concise title, short description, summary, callsToAction and confidence level.
 *
 * The AI provides a structured response to standardize the hazard report for clarity and actionability.
 */
export const summarizeHazard = async ({
  title,
  description,
  locationName,
  category,
  source,
  isAwsCompliant,
  severityBand,
  useDummy = false,
}: {
  title: string;
  description: string;
  locationName?: string | undefined | null;
  category: HazardCategory;
  source: HazardSource;
  isAwsCompliant: boolean;
  severityBand: HazardSeverityBand;
  useDummy?: boolean;
}): Promise<AISummaryResponse> => {
  if (useDummy) {
    return {
      title,
      summary: description,
      callsToAction: ["Please stay informed and take necessary precautions."],
      confidence: "high",
    };
  }

  const { model, content: systemPromptContent } = await getAIPromptForHazard({
    isAwsCompliant,
    severityBand,
    category,
    source,
  });

  const userPromptContent = `Standardize the following hazard report using the rules and templates in the system prompt:
  Inputs:
  - title: ${title || "[No title provided]"}
  - description: ${description}
  - ${locationName && `location: ${locationName}`}
  - category: ${category.name}
  - agency: ${source.name}`;

  const response = await executePrompt({
    model: model,
    systemPromptContent: systemPromptContent,
    userPromptContent: userPromptContent,
  });

  const content = response.choices[0]?.message?.content;
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

/**
 * Determines the appropriate AI prompt based on whether the hazard is AWS compliant and its severity band.
 * @param isAwsCompliant - Indicates if the hazard follows AWS compliance.
 * @param severityBand - The severity band of the hazard.
 * @returns The corresponding AI prompt.
 */
export const getAIPromptForHazard = async ({
  isAwsCompliant,
  severityBand,
  category,
  source,
}: {
  isAwsCompliant: boolean;
  severityBand: HazardSeverityBand;
  category: HazardCategory;
  source: HazardSource;
}): Promise<AIPrompt> => {
  const config = await getAIPromptConfiguration();

  // Check if source-specific prompt key exists in the config
  console.log("Checking for source-specific prompt for:", source.id);
  const sourcePromptKey = `${source.id}SourcePromptId`;
  try {
    if (sourcePromptKey in config) {
      const sourcePromptId = config[sourcePromptKey as keyof typeof config];
      if (sourcePromptId) {
        const requiredPromptId =
          sourcePromptId[
            `${severityBand}PromptId` as keyof typeof sourcePromptId
          ];
        console.log(
          `Found source-specific prompt for ${source.id}:`,
          requiredPromptId
        );
        return getPromptById(requiredPromptId);
      }
    }
  } catch (error) {
    console.error("Error fetching source-specific prompt:", error);
  }

  // Check if the category-specific prompt key exists in the config
  const categoryPromptKey = `${category.id}CategoryPromptId`;
  console.log("Checking for category-specific prompt for:", category.id);
  try {
    if (categoryPromptKey in config) {
      const categoryPromptId = config[categoryPromptKey as keyof typeof config];
      if (categoryPromptId) {
        const requiredPromptId =
          categoryPromptId[
            `${severityBand}PromptId` as keyof typeof categoryPromptId
          ];
        console.log(
          `Found category-specific prompt for ${category.id}:`,
          requiredPromptId
        );
        return getPromptById(requiredPromptId);
      }
    }
  } catch (error) {
    console.error("Error fetching category-specific prompt:", error);
  }

  // Key doesn't exist, use default prompts
  console.error(
    `No specific prompt found for source ${source.id} or category ${category.id}, using default prompts.`
  );
  const requiredPromptId = isAwsCompliant
    ? config.officialAwsAlertSummarizationPromptId[
        `${severityBand}PromptId` as keyof typeof config.officialAwsAlertSummarizationPromptId
      ]
    : config.officialAlertSummarizationPromptId[
        `${severityBand}PromptId` as keyof typeof config.officialAlertSummarizationPromptId
      ];
  return getPromptById(requiredPromptId);
};

/**
 * Deletes all hazards associated with the specified source IDs.
 * @param sourceIds - An array of source IDs whose hazards should be deleted.
 * @returns The number of hazards deleted.
 */
export const deleteAllHazardsForSourceIds = async (
  sourceIds: string[]
): Promise<number> => {
  const deleteResult = await prisma.hazard.deleteMany({
    where: {
      sourceId: {
        in: sourceIds,
      },
    },
  });

  console.log(
    `Deleted ${deleteResult.count} hazards for source IDs: ${sourceIds.join(
      ", "
    )}`
  );

  return deleteResult.count;
};

/**
 * Analyzes the hazard report details and suggests the most appropriate hazard category.
 *
 * @param title - The title of the hazard report.
 * @param description - The description of the hazard report.
 * @param availableCategories - The list of available hazard categories to choose from.
 * @returns The suggested hazard category.
 */
export const getSuggestedCategory = async ({
  title,
  description,
  currentCategoryId,
  availableCategories,
}: {
  title: string;
  description: string;
  currentCategoryId?: string | null | undefined;
  availableCategories: HazardCategory[];
}): Promise<HazardCategory> => {
  const systemPromptContent = `You are an expert in hazard classification. Based on the title and description of a hazard report, suggest the most appropriate hazard category from the provided list. Consider the context and details in the report to make your suggestion.

  AVAILABLE CATEGORIES:
  ${availableCategories
    .map((cat) => `- "${cat.id}": ${cat.description}`)
    .join("\n")}

  INSTRUCTIONS:
  ${
    currentCategoryId &&
    `- If you think that "${currentCategoryId}" category is somewhat appropriate, you MUST NOT suggest a different category unless there is a clearly better fit.`
  }
  - Analyze the title and description carefully.
  - Choose the category that best fits the hazard report.
  - Only suggest one category.
  - "${
    MainCategoryId.communityInfo
  }" category should only be used for non-urgent, informational announcements.
  - "${
    MainCategoryId.other
  }" category should be a last resort when no other category fits.
  - Do not suggest categories that are not in the provided list.

  Always respond with **valid JSON** in this format:
  {
    "suggestedCategory": "${availableCategories
      .map((cat) => cat.id)
      .join("|")}", (MUST be only one.${
    currentCategoryId &&
    ` If you think that "${currentCategoryId}" category is somewhat appropriate, you MUST NOT suggest a different category unless there is a clearly better fit.`
  })
  }`;

  const userPromptContent = `Hazard Report:
  Title: ${title}
  Description: ${description}
  ${currentCategoryId ? `Current Category: ${currentCategoryId}` : ""}`;

  const response = await executePrompt({
    model: "gpt-5-nano",
    systemPromptContent,
    userPromptContent,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(
      500,
      "AI category suggestion failed: Empty response from AI"
    );
  }

  try {
    const aiResponse = JSON.parse(content) as {
      suggestedCategory: string;
    };

    const category = availableCategories.find(
      (cat) => cat.id === aiResponse.suggestedCategory
    );
    if (!category) {
      throw new HttpError(
        500,
        `AI category suggestion failed: Suggested category "${aiResponse.suggestedCategory}" not found in available categories`
      );
    }

    return category;
  } catch (parseError) {
    throw new HttpError(
      500,
      `AI category suggestion failed: Invalid response format: ${parseError}`
    );
  }
};
