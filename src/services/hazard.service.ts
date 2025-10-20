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
import {
  buildHazardInclude,
  buildHazardsOrderByClauseRaw,
  buildHazardsWhereClause,
  buildHazardsWhereClauseRaw,
} from "../utils/hazard.util.js";

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
 * Fetches hazards using raw SQL with database-level sorting for optimal performance.
 * This is the main function that combines WHERE and ORDER BY clause builders.
 */
export const getHazardsApplyingFiltersRaw = async (
  searchParams: HazardSearchParams & {
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
  } = searchParams;

  // Build WHERE clause and get initial parameters
  const { whereClause, queryParams, paramIndex } =
    buildHazardsWhereClauseRaw(searchParams);

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
    Location: ${
      locationName ? `${locationName}, ` : ""
    }(${latitude}, ${longitude})
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
