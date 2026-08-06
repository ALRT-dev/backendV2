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
import { listBlockedUserIds } from "./community_safety.service.js";
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
import { executePrompt } from "./ai.service.js";
import {
  hazardContentHash,
  getCachedAISummary,
  cacheAISummary,
} from "./hazard_cache.service.js";
import { config } from "../utils/config.js";
import { MainCategoryId } from "./hazard_category.service.js";
import { ExternalSourceId } from "./ingestion.service.js";
import {
  SOURCE_REGISTRY_DEFAULTS,
  type SourceSystemKey,
} from "../utils/source_registry.util.js";

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
  },
): Promise<Hazard[]> => {
  const { userId, page = 1, pageSize = 20 } = params;

  const whereClause = buildHazardsWhereClause(params);

  // A blocked account's reports drop out of this reader's feed. Nothing is
  // deleted and everyone else still sees them: one person's block is not a
  // verdict on whether a hazard is real.
  const blockedIds = userId ? await listBlockedUserIds(userId) : [];
  const scopedWhere =
    blockedIds.length > 0
      ? { AND: [whereClause, { reportedById: { notIn: blockedIds } }] }
      : whereClause;

  // Use a more optimized query strategy
  const hazards = await prisma.hazard.findMany({
    where: scopedWhere,
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
      hazards.map((hazard) => hazard.reportedById).filter(Boolean) as string[],
    ),
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
            ? (reportersStatusMap.get(hazard.reportedById) ??
              UserReportsStatus.unverified)
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
 * All Hazard scalar columns except the generated PostGIS columns (`geom`,
 * `geomBox`) — Prisma cannot deserialize `geometry` values from raw queries,
 * so `h.*` must never reach the driver. Keep in sync with schema.prisma.
 */
const HAZARD_RAW_COLUMNS = [
  "id",
  "title",
  "description",
  "aiSummary",
  "aiConfidence",
  "severity",
  "severityBand",
  "callsToAction",
  "fireStatus",
  "latitude",
  "longitude",
  "locationName",
  "geoLocation",
  "northeastLat",
  "northeastLng",
  "southwestLat",
  "southwestLng",
  "categoryId",
  "sourceId",
  "reportedById",
  "isAwsCompliant",
  "reviewStatus",
  "reviewFeedback",
  "reviewedAt",
  "reviewedById",
  "confidenceScore",
  "confidenceScoreCalculatedAt",
  "upvoteCount",
  "downvoteCount",
  "viewCount",
  "link",
  "occurredAt",
  "createdAt",
  "updatedAt",
  "expiresAt",
]
  .map((c) => `h."${c}"`)
  .join(", ");

/**
 * Fetches hazards using raw SQL with database-level sorting for optimal performance.
 * This is the main function that combines WHERE and ORDER BY clause builders.
 * OPTIMIZED VERSION with improved query structure and reduced N+1 queries.
 */
export const getHazardsApplyingFiltersRaw = async (
  params: HazardSearchParams & {
    userId?: string | undefined;
    subscriptions?: LocationSubscription[] | undefined;
  },
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
      sortSettings,
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
        ${HAZARD_RAW_COLUMNS},
        hc.name as "categoryName",
        hc.description as "categoryDescription", 
        hc.color as "categoryColor",
        hc."parentId" as "categoryParentId",
        hcp.name as "categoryParentName",
        hcp.description as "categoryParentDescription",
        hcp.color as "categoryParentColor",
        hs.name as "sourceName",
        hs.url as "sourceUrl",
        hs."advisoryText" as "sourceAdvisoryText",
        hs."copyrightText" as "sourceCopyrightText",
        hs."copyrightLink" as "sourceCopyrightLink",
        hsl.id as "licenseLicenseId",
        hsl."badgeText" as "licenseBadgeText",
        hsl."licenseText" as "licenseLicenseText",
        hsl.description as "licenseDescription",
        hsl.link as "licenseLink",
        hsl."foregroundColor" as "licenseForegroundColor",
        hsl."backgroundColor" as "licenseBackgroundColor",
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
      LEFT JOIN "HazardSourceLicense" hsl ON hs."licenseId" = hsl.id
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
    ...queryParams,
  )) as any[];

  /** One DB query for all category images referenced by this page (avoids N+1). */
  const uniqueCategoryIds = new Set<string>();
  for (const row of hazards) {
    if (row.categoryId) uniqueCategoryIds.add(row.categoryId);
    if (row.categoryParentId) uniqueCategoryIds.add(row.categoryParentId);
  }

  const categoryImageMap = new Map<
    string,
    Array<{
      id: string;
      categoryId: string;
      imageType: string;
      s3Key: string;
      width: number | null;
      height: number | null;
      fileSizeBytes: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >();

  if (uniqueCategoryIds.size > 0) {
    const imageRows = await prisma.hazardCategoryImage.findMany({
      where: { categoryId: { in: [...uniqueCategoryIds] } },
      orderBy: { imageType: "asc" },
      select: {
        id: true,
        categoryId: true,
        imageType: true,
        s3Key: true,
        width: true,
        height: true,
        fileSizeBytes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    for (const img of imageRows) {
      const list = categoryImageMap.get(img.categoryId) ?? [];
      list.push(img);
      categoryImageMap.set(img.categoryId, list);
    }
  }

  // Get unique reporter IDs from hazards that have reporters
  const reporterIds = Array.from(
    new Set(
      hazards
        .map((hazard: any) => hazard.reportedByUserId)
        .filter(Boolean) as string[],
    ),
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
      sourceAdvisoryText,
      sourceCopyrightText,
      sourceCopyrightLink,
      licenseLicenseId,
      licenseBadgeText,
      licenseLicenseText,
      licenseDescription,
      licenseLink,
      licenseForegroundColor,
      licenseBackgroundColor,
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
            images: categoryImageMap.get(hazard.categoryId) ?? [],
            parent: categoryParentId
              ? {
                  id: categoryParentId,
                  name: categoryParentName,
                  description: categoryParentDescription,
                  color: categoryParentColor,
                  images: categoryImageMap.get(categoryParentId) ?? [],
                }
              : null,
          }
        : null,
      source: hazard.sourceId
        ? {
            id: hazard.sourceId,
            name: sourceName,
            url: sourceUrl,
            advisoryText: sourceAdvisoryText,
            copyrightText: sourceCopyrightText,
            copyrightLink: sourceCopyrightLink,
            license: licenseLicenseId
              ? {
                  id: licenseLicenseId,
                  badgeText: licenseBadgeText,
                  licenseText: licenseLicenseText,
                  description: licenseDescription,
                  link: licenseLink,
                  foregroundColor: licenseForegroundColor,
                  backgroundColor: licenseBackgroundColor,
                }
              : null,
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
    userReportedAlertReviewAndSummarizePromptId[`${severityBand}PromptId`],
  );

  const userContent = `Please analyze this hazard report:
      TITLE: ${title || "[No title provided]"}
      DESCRIPTION: ${description || "[No description provided]"}
      LOCATION: ${locationName || ""} (${latitude}, ${longitude})
      CATEGORY: ${category.name}`;

  const content = await executePrompt({
    model: model,
    systemPromptContent: promptContent,
    userPromptContent: userContent,
  });

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
    // No-AI mode passes the source through untouched. It used to invent a
    // call to action here ("Please stay informed and take necessary
    // precautions"), which the app then displayed under WHAT TO DO as if an
    // agency had said it. ALRT does not write advice (locked rule): with no
    // callsToAction the app simply hides the section, which is honest.
    return {
      title,
      summary: description,
      callsToAction: [],
      confidence: "high",
    };
  }

  const contentHash = hazardContentHash({
    title,
    description,
    locationName: locationName ?? null,
    categoryId: category.id,
    sourceId: source.id,
    isAwsCompliant,
    severityBand,
  });
  const cachedSummary = await getCachedAISummary<AISummaryResponse>(
    contentHash,
  );
  if (cachedSummary) {
    console.log("AI summary cache hit, skipping model call:", title);
    return cachedSummary;
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

  const content = await executePrompt({
    model: model,
    systemPromptContent: systemPromptContent,
    userPromptContent: userPromptContent,
  });

  try {
    const aiSummary = JSON.parse(content) as AISummaryResponse;
    await cacheAISummary(contentHash, aiSummary);
    return aiSummary;
  } catch (parseError) {
    console.error("Failed to parse AI summary response:", parseError);
    throw new HttpError(
      500,
      "AI summarization failed: Invalid response format",
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
          requiredPromptId,
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
          requiredPromptId,
        );
        return getPromptById(requiredPromptId);
      }
    }
  } catch (error) {
    console.error("Error fetching category-specific prompt:", error);
  }

  // Key doesn't exist, use default prompts
  console.error(
    `No specific prompt found for source ${source.id} or category ${category.id}, using default prompts.`,
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
  sourceIds: string[],
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
      ", ",
    )}`,
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

  const content = await executePrompt({
    model: config.aws.bedrock.fallbackModelId,
    systemPromptContent,
    userPromptContent,
  });

  try {
    const aiResponse = JSON.parse(content) as {
      suggestedCategory: string;
    };

    const category = availableCategories.find(
      (cat) => cat.id === aiResponse.suggestedCategory,
    );
    if (!category) {
      throw new HttpError(
        500,
        `AI category suggestion failed: Suggested category "${aiResponse.suggestedCategory}" not found in available categories`,
      );
    }

    return category;
  } catch (parseError) {
    throw new HttpError(
      500,
      `AI category suggestion failed: Invalid response format: ${parseError}`,
    );
  }
};

/**
 * Enum representing different hazard source licenses.
 * Each license type corresponds to a specific set of usage rights and restrictions.
 */
export enum HazardSourceLicenseBadgeText {
  ccBy4 = "CC BY 4.0",
  ccBy3 = "CC BY 3.0",
  oglv3 = "OGL v3.0",
  openGov = "OPEN GOV",
  openData = "OPEN DATA",
  licensed = "LICENSED",
  permission = "PERMISSION",
  pending = "PENDING",
}

/**
 * Initialize hazard sources in the database
 * This function creates or updates hazard sources based on predefined external sources
 */
export const initializeHazardSources = async (): Promise<void> => {
  try {
    const count = await prisma.hazardSource.count();
    if (count > 0) {
      return;
    }

    // Create or update hazard source licenses first
    const hazardSourceLicenses: Prisma.HazardSourceLicenseCreateInput[] = [
      {
        badgeText: HazardSourceLicenseBadgeText.ccBy4,
        licenseText: "Creative Commons Attribution 4.0",
        backgroundColor: "#e8f5e9",
        foregroundColor: "#2e7d32",
        link: "https://creativecommons.org/licenses/by/4.0/",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.ccBy3,
        licenseText: "Creative Commons Attribution 3.0",
        backgroundColor: "#e8f5e9",
        foregroundColor: "#2e7d32",
        link: "https://creativecommons.org/licenses/by/3.0/au/",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.oglv3,
        licenseText: "Open Government Licence v3.0",
        backgroundColor: "#e8f5e9",
        foregroundColor: "#2e7d32",
        link: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.openGov,
        licenseText: "Open Government License",
        backgroundColor: "#e8f5e9",
        foregroundColor: "#2e7d32",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.openData,
        licenseText: "Open Data License",
        backgroundColor: "#e3f2fd",
        foregroundColor: "#0d6efd",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.licensed,
        licenseText: "Commercial License",
        backgroundColor: "#e9ecef",
        foregroundColor: "#6c757d",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.permission,
        licenseText: "Source Permission",
        backgroundColor: "#f8d7da",
        foregroundColor: "#dc3545",
      },
      {
        badgeText: HazardSourceLicenseBadgeText.pending,
        licenseText: "Awaiting License Permission",
        backgroundColor: "#fff3cd",
        foregroundColor: "#856404",
      },
    ];

    await Promise.all(
      hazardSourceLicenses.map((license) => {
        return prisma.hazardSourceLicense.upsert({
          where: { badgeText: license.badgeText },
          create: license,
          update: license,
        });
      }),
    );

    // Now create or update hazard sources
    const hazardSources: Prisma.HazardSourceCreateInput[] = [
      {
        id: ExternalSourceId.rfs,
        name: "New South Wales Rural Fire Service",
        url: "https://www.rfs.nsw.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © State of NSW (NSW RFS).",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.bom,
        name: "Bureau of Meteorology",
        url: "https://www.bom.gov.au",
        copyrightText:
          "Reproduced by permission of the Bureau of Meteorology, © Commonwealth of Australia.",
        copyrightLink:
          "http://www.bom.gov.au/data-access/3rd-party-attribution.shtml",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.licensed,
          },
        },
      },
      {
        id: ExternalSourceId.nswTransport,
        name: "Live Traffic NSW",
        url: "https://www.transport.nsw.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © State of NSW.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.actEs,
        name: "ACT Emergency Services Agency",
        url: "https://www.act.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © Australian Capital Territory.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.cfs,
        name: "South Australian Country Fire Service",
        url: "https://www.cfs.sa.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © Government of South Australia.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.pending,
          },
        },
      },
      {
        id: ExternalSourceId.viceFire,
        name: "VicEmergency",
        url: "https://www.vicefire.com",
        copyrightText:
          "Data sourced from official government feeds, © State of Victoria.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy3,
          },
        },
      },
      {
        id: ExternalSourceId.qldFire,
        name: "Queensland Fire Department",
        url: "https://www.qld.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © State of Queensland.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.ntFireAndRescue,
        name: "Northern Territory Fire and Rescue Service",
        url: "https://www.nt.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © Northern Territory Government.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.permission,
          },
        },
      },
      {
        id: ExternalSourceId.waqi,
        name: "World Air Quality Index",
        url: "https://www.waqi.info",
        advisoryText:
          "For official air quality health advice, consult your state EPA, Bureau of Meteorology, or Department of Health.",
      },
      {
        id: ExternalSourceId.openMeteo,
        name: "Open-Meteo",
        url: "https://open-meteo.com",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.smartraveller,
        name: "Smartraveller",
        url: "https://www.smartraveller.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © Commonwealth of Australia (DFAT).",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.permission,
          },
        },
      },
      {
        id: ExternalSourceId.waDfes,
        name: "Department of Fire and Emergency Services WA",
        url: "https://emergency.wa.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © State of Western Australia.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.licensed,
          },
        },
      },
      {
        id: ExternalSourceId.nswSes,
        name: "New South Wales State Emergency Service",
        url: "https://www.ses.nsw.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © State of NSW (NSW SES).",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.licensed,
          },
        },
      },
      {
        id: ExternalSourceId.earthquakeUsgs,
        name: "USGS Earthquake Hazards Program",
        url: "https://earthquake.usgs.gov",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.qldTraffic,
        name: "QLDTraffic",
        url: "https://qldtraffic.qld.gov.au",
        copyrightText:
          "Data sourced from official government feeds, © State of Queensland.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.qldPark,
        name: "Queensland Parks and Wildlife Service",
        url: "https://parks.qld.gov.au/park-alerts",
        copyrightText:
          "Data sourced from official government feeds, © State of Queensland.",
        license: {
          connect: {
            badgeText: HazardSourceLicenseBadgeText.ccBy4,
          },
        },
      },
      {
        id: ExternalSourceId.canadaGovTra,
        name: "Government of Canada Travel Advice and Advisories",
        url: "https://travel.gc.ca/travelling/advisories",
      },
      {
        id: ExternalSourceId.gdacsGlobal,
        name: "Global Disaster Alert and Coordination System",
        url: "https://www.gdacs.org",
      },
    ];

    // Map each seeded source to its One Glance system so the §1 registry
    // defaults (shape · severity system · level handling · band cap · push
    // policy) are applied at seed time. Anything not listed here falls back to
    // the render default (diamond / band threshold) via `source.shape ?? diamond`.
    const sourceSystemById: Partial<Record<string, SourceSystemKey>> = {
      // Australian Warning System agencies — bushfire/flood/storm warnings that
      // carry Advice / Watch and Act / Emergency levels (triangle).
      [ExternalSourceId.rfs]: "aws",
      [ExternalSourceId.actEs]: "aws",
      [ExternalSourceId.cfs]: "aws",
      [ExternalSourceId.viceFire]: "aws",
      [ExternalSourceId.qldFire]: "aws",
      [ExternalSourceId.ntFireAndRescue]: "aws",
      [ExternalSourceId.waDfes]: "aws",
      [ExternalSourceId.nswSes]: "aws",
      // Official agencies / data sources — band colour only, diamond.
      [ExternalSourceId.bom]: "official",
      [ExternalSourceId.nswTransport]: "official",
      [ExternalSourceId.waqi]: "official",
      [ExternalSourceId.openMeteo]: "official",
      [ExternalSourceId.smartraveller]: "official",
      [ExternalSourceId.earthquakeUsgs]: "official",
      [ExternalSourceId.qldTraffic]: "official",
      [ExternalSourceId.qldPark]: "official",
      [ExternalSourceId.canadaGovTra]: "official",
      // GDACS — square, level-exempt, Green = no push.
      [ExternalSourceId.gdacsGlobal]: "gdacs",
    };

    await Promise.all(
      hazardSources.map((source) => {
        // Always require id for upsert since url is no longer unique
        if (!source.id) {
          throw new Error(
            `HazardSource must have an id for upsert operation: ${source.name}`,
          );
        }
        const system = sourceSystemById[source.id];
        const registry = system ? SOURCE_REGISTRY_DEFAULTS[system] : undefined;
        const sourceWithRegistry: Prisma.HazardSourceCreateInput = registry
          ? {
              ...source,
              shape: registry.shape,
              severitySystem: registry.severitySystem,
              ...(registry.levelHandling && {
                levelHandling: registry.levelHandling,
              }),
              ...(registry.maxInternalBand && {
                maxInternalBand: registry.maxInternalBand,
              }),
              pushPolicy: registry.pushPolicy,
            }
          : source;
        return prisma.hazardSource.upsert({
          where: { id: source.id },
          create: sourceWithRegistry,
          update: sourceWithRegistry,
        });
      }),
    );

    console.log(
      "---------------------------------------> Hazard sources initialized successfully",
    );
  } catch (error) {
    console.error("Error initializing hazard sources:", error);
  }
};

/**
 * Fetches hazards for GeoJSON output using a lightweight query.
 * Skips media, user votes, and reporter enrichment for performance.
 * Only returns hazards with valid lat/lon coordinates.
 */
export const getHazardsForGeoJson = async (
  params: HazardSearchParams,
): Promise<{ hazards: any[]; totalCount: number }> => {
  // Build WHERE clause
  const { whereClause, queryParams, paramIndex } =
    buildHazardsWhereClauseRaw(params);

  // Require valid coordinates for GeoJSON output
  const geoWhereClause = `${whereClause} AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL`;

  // Build ORDER BY clause (no user location needed for geo endpoint)
  const { orderByClause, paramIndex: updatedParamIndex } =
    buildHazardsOrderByClauseRaw(
      undefined,
      undefined,
      paramIndex,
      queryParams,
    );

  // Apply limit
  const limit = params.pageSize ?? 500;
  queryParams.push(limit);
  const limitParamIndex = updatedParamIndex;

  // Count query for metadata
  const countQuery = `
    SELECT COUNT(*)::int as count
    FROM "Hazard" h
    WHERE ${geoWhereClause}
  `;

  // Main query — lightweight: only joins category and source, no media/votes/reporter
  const query = `
    SELECT
      h.id,
      h.title,
      h.description,
      h."aiSummary",
      h.latitude,
      h.longitude,
      h."locationName",
      h."northeastLat",
      h."northeastLng",
      h."southwestLat",
      h."southwestLng",
      h.severity,
      h."severityBand",
      h."reviewStatus",
      h."confidenceScore",
      h."fireStatus",
      h."callsToAction",
      h."isAwsCompliant",
      h."categoryId",
      h."sourceId",
      h."expiresAt",
      h."createdAt",
      h."updatedAt",
      hc.name as "categoryName",
      hc.color as "categoryColor",
      hs.name as "sourceName"
    FROM "Hazard" h
    LEFT JOIN "HazardCategory" hc ON h."categoryId" = hc.id
    LEFT JOIN "HazardSource" hs ON h."sourceId" = hs.id
    WHERE ${geoWhereClause}
    ORDER BY ${orderByClause}
    LIMIT $${limitParamIndex}
  `;

  // Run count and data queries in parallel
  // Count query uses same params minus the limit param
  const countParams = queryParams.slice(0, -1);
  const [countResult, hazards] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery, ...countParams) as Promise<
      { count: number }[]
    >,
    prisma.$queryRawUnsafe(query, ...queryParams) as Promise<any[]>,
  ]);

  return {
    hazards,
    totalCount: countResult[0]?.count ?? 0,
  };
};
