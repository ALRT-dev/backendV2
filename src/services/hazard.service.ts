import type { Hazard, HazardCategory } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import openai from "../utils/open_ai_client.util.js";
import { HttpError } from "../models/http_error.js";

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

export const reviewHazard = async ({
  hazard,
  category,
}: {
  hazard: Hazard;
  category: HazardCategory;
}) => {
  const { title, description, latitude, longitude } = hazard;
  const { name: categoryName } = category;

  const prompt = `
You are an AI reviewer for a hazard alert system.
A user has submitted the following hazard:

Title: ${title}
Description: ${description}
Category: ${categoryName}
Location: ${latitude}, ${longitude}

Tasks:
1. Check if the description is valid (not spam or nonsense). If content contains inappropriate or harmful material, mark as invalid.
2. Suggest a better title if necessary.
3. Summarize the hazard in few sentences.
4. Create a very short summary (max 100 characters). Don't repeat the title.
5. Rate confidence in hazard being real: high, medium, low.
6. Estimate severity based on possible danger to life or property: info, advice, watchAndAct, emergency.
7. Return structured JSON only.

Respond in JSON:
{
  "valid": true/false,
  "suggestedTitle": "string",
  "summary": "string",
  "shortSummary": "string",
  "confidence": "high/medium/low",
  "severity": "info/advice/watchAndAct/emergency",
  "feedback": "short feedback message for user"
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
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
    valid: boolean;
    suggestedTitle: string;
    summary: string;
    shortSummary: string;
    confidence: "high" | "medium" | "low";
    severity: "info" | "advice" | "watchAndAct" | "emergency";
    feedback: string;
  };

  return {
    valid: aiReview.valid,
    suggestedTitle: aiReview.suggestedTitle || title,
    summary: aiReview.summary,
    shortSummary: aiReview.shortSummary,
    confidence: aiReview.confidence,
    severity: aiReview.severity,
    feedback: aiReview.feedback,
  };
};
