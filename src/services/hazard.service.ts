import {
  type Prisma,
  type LocationSubscription,
  HazardVoteType,
  HazardSeverity,
  type Hazard,
  type HazardCategory,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import openai from "../utils/open_ai_client.util.js";
import { HttpError } from "../models/http_error.js";
import type { AISummaryResponse } from "../models/ai_summary_response_interface.js";
import type { AIReviewResponse } from "../models/ai_review_response_interface.js";
import type { HazardSearchParams } from "../models/hazard_search_params_interface.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";
import { calculateUserReportsStatus } from "./user.service.js";
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
  const systemPrompt = `
    You are an AI profanity checker and summarizer. Your task is to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.
  
    REVIEW GUIDELINES:
    - Check for profanity, nonsense, sexual content, discriminatory language; reject such reports.
    - **Don't reject** if description is not provided.
    - Provide constructive feedback for improvement **only if rejecting** (max 200 chars).
    - Create a clear, concise title (max 80 chars) summarizing the hazard (follow the SUMMARY GUIDELINES below for summary).
    - Write a one-line short description (max 120 chars) for notifications.

    SUMMARY GUIDELINES:
    - Factual, one-sentence summary of what’s happening and where. Eg. "User report of {hazard} near ${locationName}."
    - MUST be a single sentence.
    - If no description is provided or the report cannot be verified, you must automatically use the following default summary:
      "An unverified incident has been reported near ${
        locationName || `${latitude}, ${longitude}`
      }."
    - Must use simple, calm, plain, natural language suitable for the general public in present tense. 
    - Keep total length ≤50 words.

    CALL TO ACTION GUIDELINES:
    - Based on the given category (${
      category.name
    }) and severity of the hazard, suggest an appropriate action for the public.
    - If no description is provided or the report cannot be verified, you must automatically use the following default callToAction:
      "Stay calm, avoid the area, and wait for official updates."
    - Use simple, natural, plain English suitable for the general public.
    - It should not be overly definitive or alarming.
    - Must use soft tone.
    - Do not include irrelevant or speculative details (follow the category context).
    - Do not give clinical/medical treatment advice.
    - Keep total length ≤20 words.

    CONFIDENCE LEVEL GUIDELINES:
    - "high": Detailed, specific, credible information with clear location and time
    - "medium": Reasonable detail but some ambiguity or missing information
    - "low": Vague, unclear, or potentially unreliable information

    Always respond with valid JSON containing these exact fields:
    {
      "reviewStatus": "accepted|rejected (based on REVIEW GUIDELINES above)",
      "reviewFeedback": "string (constructive feedback for the reporter if reviewStatus is rejected, max 200 chars)",
      "title": "string (a concise, clear title for the hazard, max 80 chars)",
      "shortDescription": "string (a one-line summary for notifications, max 120 chars)",
      "summary": "string (based on SUMMARY GUIDELINES above)",
      "callToAction": "string (based on CALL TO ACTION GUIDELINES above)",
      "confidence": "high|medium|low (based on CONFIDENCE LEVEL GUIDELINES described above)"
    }
    `;

  const userPrompt = `
    Evaluate this hazard:

    Title: ${title && title.length > 0 ? title : "[No title provided]"}
    Description: ${
      description && description.length > 0
        ? description
        : "[No description provided]"
    }
    Category: ${category.name}
    Location: ${
      locationName ? `${locationName}, ` : ""
    }(${latitude}, ${longitude})
    `;

  const response = await retryWithBackoff(async () => {
    return await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
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

  const systemPrompt = `
    You are a hazard analysis assistant for a public safety application. Your role is to review and standardize hazard reports to ensure they are clear, actionable, and appropriately categorized.
    
    ${
      availableCategories && availableCategories.length > 0
        ? `
          AVAILABLE HAZARD CATEGORIES:
          Choose the most appropriate category based on the hazard characteristics.
          \n${categoriesInfo}
          
          ${
            parentCategories && parentCategories.length > 0
              ? `
          If none of the above categories fit well, you may select from the parent categories:
          \n${parentCategoriesInfo}`
              : ""
          }
        `
        : ""
    }

    SUMMARY GUIDELINES:
    - Factual, one-sentence summary of what’s happening, where, and who is responding. 
    - MUST be a single sentence.
    - Must use simple, calm, plain, natural language suitable for the general public. 
    - Must use information that applies to the hazard type, never include irrelevant fields (e.g. “no fire present, if the alert type is not about a fire”). 
    - Keep total length ≤50 words.

    CONFIDENCE LEVELS:
    - "high": Detailed, specific, credible information with clear location and time
    - "medium": Reasonable detail but some ambiguity or missing information
    - "low": Vague, unclear, or potentially unreliable information

    Always respond with valid JSON containing these exact fields:
    {
      "title": "string (a concise, clear title for the hazard, max 80 chars)",
      "shortDescription": "string (a one-line summary for notifications, max 120 chars)",
      "summary": "string (based on SUMMARY GUIDELINES above. MUST be a single sentence)",
      "confidence": "high|medium|low (based on CONFIDENCE LEVELS described above)",
      ${
        availableCategories && availableCategories.length > 0
          ? `"category": "string (the most appropriate hazard category from the AVAILABLE HAZARD CATEGORIES listed above)",`
          : ""
      }
    }
    `;

  const userPrompt = `
    Analyze this hazard report:

    TITLE: ${title}
    DESCRIPTION: ${description}
    LOCATION: ${
      locationName ? `${locationName}, ` : ""
    }(${latitude}, ${longitude})
    `;

  const response = await retryWithBackoff(async () => {
    return await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
  });

  if (response.choices.length === 0 || !response.choices[0]?.message?.content) {
    throw new HttpError(500, "AI summarization failed: No response from AI");
  }

  const content = response.choices[0].message.content;
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
    };

    const { severity, callToAction } = await getAISeverity({
      title,
      description,
      latitude,
      longitude,
      locationName,
      categoryId: aiSummary.category ?? "other",
    });

    const fullResponse = {
      ...aiSummary,
      category: aiSummary.category ?? "other",
      severity,
      callToAction,
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

    // Prepare the prompt for OpenAI
    const hazardContent = `
      Title: ${title}
      Description: ${description}
      Location: ${locationName || `${latitude}, ${longitude}`}
      Category: ${category.name}
    `;

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
        return `${severity}: ${keywords.join(", ")}`;
      })
      .filter(Boolean)
      .join("\n");

    // Build call to action text based on allowed severities
    const callToActionText = Object.entries(callToActions)
      .map(
        ([severity, actions]) =>
          `For "${severity}":\n${actions
            .map((action) => `- ${action}`)
            .join("\n")}`
      )
      .join("\n\n");

    const systemPrompt = `
      You are a hazard severity classification expert. Your task is to analyze hazard reports and classify them into one of these severity levels based on keyword matching and content analysis:

      SEVERITY KEYWORDS:
      ${keywordContext}

      CALL TO ACTION GUIDELINES:
      After determining the severity level and hazard type, select the most appropriate call to action. (Only one sentence from the guidelines below):
      ${callToActionText}

      ALLOWED SEVERITY LEVELS:
      - ${severityLevels.join("\n- ")}

      ANALYSIS INSTRUCTIONS:
      1. First, look for direct keyword matches in the title and description
      2. Consider the context, urgency, and potential impact described
      3. Factor in location relevance if applicable
      4. Choose the most appropriate severity level
      5. If multiple levels could apply, choose the higher severity for safety
      6. If no clear match or insufficient information, return "unknown"

      Respond with valid JSON containing this exact field:
      {
        "severity": "${severityLevels.join(
          "|"
        )} (based on the KEYWORD CONTEXT and ANALYSIS INSTRUCTIONS above)",
        "callToAction": "string (select the most appropriate action from the CALL TO ACTION GUIDELINES above based on severity and hazard type)"
      }
    `;

    const userPrompt = `Analyze this hazard report and determine its severity level: ${hazardContent}`;

    const response = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
    });

    if (
      response.choices.length === 0 ||
      !response.choices[0]?.message?.content
    ) {
      throw new HttpError(
        500,
        "Severity determination failed: No response from AI"
      );
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new HttpError(
        500,
        "Severity determination failed: Empty response from AI"
      );
    }

    const aiResponse = JSON.parse(content) as {
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
