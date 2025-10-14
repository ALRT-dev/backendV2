import { HazardReviewStatus } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import openai from "../utils/open_ai_client.util.js";
import { HttpError } from "../models/http_error.js";

/// Builds the where clause for filtering hazards based on various criteria.
export const buildHazardsWhereClause = ({
  searchString,
  categoryIds,
  reportedById,
  reviewStatus,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
  subscriptions,
}: {
  searchString?: any;
  categoryIds?: any;
  reportedById?: any;
  reviewStatus?: any;
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

  // Apply reportedById filter if provided
  if (reportedById) {
    whereClause.AND.push({
      reportedById: reportedById,
    });
  }

  // Apply reviewStatus filter if provided
  if (reviewStatus) {
    whereClause.AND.push({
      reviewStatus: reviewStatus,
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

/// Fetch hazards applying various filters and pagination.
export const getHazardsApplyingFilters = async ({
  searchString,
  categoryIds,
  reportedById,
  reviewStatus,
  northeastLat,
  northeastLng,
  southwestLat,
  southwestLng,
  subscriptions,
  userId, // if userId is provided, include user's vote type in the result
  page = 1,
  pageSize = 20,
}: {
  searchString?: any;
  categoryIds?: any;
  reportedById?: any;
  reviewStatus?: any;
  northeastLat?: any;
  northeastLng?: any;
  southwestLat?: any;
  southwestLng?: any;
  subscriptions?: any[] | undefined;
  userId?: string | undefined;
  page?: any;
  pageSize?: any;
}) => {
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
    include: {
      category: true,
      source: true,
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
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (Number(page) - 1) * Number(pageSize),
    take: Number(pageSize),
  });

  // Transform the result to include userVoteType
  return hazards.map((hazard) => ({
    ...hazard,
    userVoteType: hazard.votes?.[0]?.voteType,
    votes: undefined, // Remove the votes array from the result
  }));
};

/// Uses AI to review a hazard report for validity, severity, and suggestions.
export const reviewHazard = async ({
  title,
  description,
  latitude,
  longitude,
}: {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
}) => {
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
Location: ${latitude}, ${longitude}
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

  if (
    response.choices.length === 0 ||
    !response.choices[0]!!.message?.content
  ) {
    throw new HttpError(500, "AI review failed: No response from AI");
  }

  const aiReview = JSON.parse(response.choices[0]!!.message.content!!) as {
    reviewStatus: "accepted" | "rejected";
    reviewFeedback: string;
    title: string;
    shortDescription: string;
    summary: string;
    confidence: "high" | "medium" | "low";
  };

  return aiReview;
};

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
}) => {
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

  if (
    response.choices.length === 0 ||
    !response.choices[0]!!.message?.content
  ) {
    throw new HttpError(500, "AI summarization failed: No response from AI");
  }

  const aiSummary = JSON.parse(response.choices[0]!!.message.content!!) as {
    title: string;
    shortDescription: string;
    summary: string;
    confidence: "high" | "medium" | "low";
    severity: "info" | "advice" | "watchAndAct" | "emergency";
  };

  return aiSummary;
};
