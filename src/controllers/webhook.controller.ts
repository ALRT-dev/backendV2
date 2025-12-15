import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { HazardReviewStatus, type HazardCategory } from "@prisma/client";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "../services/confidence_score.service.js";
import { getHazardExpiryDateFromSeverity } from "../utils/hazard.util.js";
import { summarizeHazard } from "../services/hazard.service.js";
import type {
  CreateHazardWebhookBody,
  CreateHazardsWebhookBody,
} from "../validators/webhook.validator.js";
import { getHazardAttributesFromDescription } from "../utils/ingestion.util.js";
import { getAllSubHazardCategories } from "../services/hazard_category.service.js";

/**
 * Helper function to process a single hazard
 */
const processSingleHazard = async (
  hazardData: CreateHazardWebhookBody,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
) => {
  const attributes = getHazardAttributesFromDescription(
    hazardData.description,
    availableCategories
  );

  const {
    title,
    description,
    aiSummary,
    severity = attributes.severity,
    severityBand = attributes.severityBand,
    callToAction,
    fireStatus = attributes.fireStatus || undefined,
    latitude,
    longitude,
    locationName,
    northeastLat,
    northeastLng,
    southwestLat,
    southwestLng,
    categoryId,
    sourceId,
    isAwsCompliant = attributes.isAwsCompliant,
    link,
    occurredAt,
    expiresAt,
  } = hazardData;

  // Validate sourceId
  const source = await prisma.hazardSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) {
    throw new HttpError(400, `Invalid sourceId provided: ${sourceId}`);
  }

  // Validate location (either latitude & longitude OR bounds MUST be provided)
  if (
    (latitude === undefined || longitude === undefined) &&
    (northeastLat === undefined ||
      northeastLng === undefined ||
      southwestLat === undefined ||
      southwestLng === undefined)
  ) {
    throw new HttpError(
      400,
      "Either latitude & longitude or northeast & southwest bounds must be provided"
    );
  }

  // Validate categoryId if provided, else use the one from attributes
  let category: HazardCategory | undefined;
  if (categoryId) {
    const foundCategory = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
    });
    if (!foundCategory) {
      throw new HttpError(400, `Invalid categoryId provided: ${categoryId}`);
    }
    category = foundCategory;
  }
  category = category || attributes.category;

  // Summarize hazard using AI
  const summarized = await summarizeHazard({
    title: title || "",
    description,
    locationName,
    category,
    source,
    isAwsCompliant,
    severityBand,
  });

  // Calculate confidence score for the webhook created hazard
  let confidenceScore = 70; // Default good score for webhook created hazards
  try {
    const hazardForCalculation: HazardForConfidenceCalculation = {
      severity,
      aiConfidence: summarized.confidence,
      upvoteCount: 0,
      downvoteCount: 0,
      createdAt: new Date(),
      reportedBy: null,
    };

    confidenceScore = calculateConfidenceScore(hazardForCalculation);
  } catch (error) {
    console.error(
      "Error calculating confidence score for webhook created hazard:",
      error
    );
  }

  // Create hazard in the database
  const createdHazard = await prisma.hazard.create({
    data: {
      title: title || summarized.title,
      description,
      aiSummary: aiSummary || summarized.summary,
      severity,
      severityBand,
      callToAction: callToAction || summarized.callToAction,
      ...(fireStatus && { fireStatus }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(locationName && { locationName }),
      ...(northeastLat !== undefined && { northeastLat }),
      ...(northeastLng !== undefined && { northeastLng }),
      ...(southwestLat !== undefined && { southwestLat }),
      ...(southwestLng !== undefined && { southwestLng }),
      categoryId: category.id,
      sourceId: source.id,
      isAwsCompliant,
      ...(link && { link }),
      ...(occurredAt && { occurredAt: new Date(occurredAt) }),
      expiresAt: expiresAt
        ? new Date(expiresAt)
        : getHazardExpiryDateFromSeverity(severity),
      aiConfidence: summarized.confidence,
      confidenceScore,
      confidenceScoreCalculatedAt: new Date(),
      reviewStatus: HazardReviewStatus.accepted,
    },
    include: {
      category: true,
      source: true,
    },
  });

  return createdHazard;
};

/**
 * Webhook endpoint to create multiple hazards from external tools like N8N
 * Accepts an array of hazards.
 *
 * Authentication: Requires X-Webhook-Api-Key header
 *
 * @route POST /api/webhook/hazards
 */
export const createHazardViaWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const availableCategories = await getAllSubHazardCategories();
    const hazardsData: CreateHazardsWebhookBody = req.body;

    // Process all hazards
    const results = await Promise.allSettled(
      hazardsData.map((hazardData, index) =>
        processSingleHazard(hazardData, availableCategories).then((hazard) => ({
          hazard,
          index,
        }))
      )
    );

    type CreatedHazard = Awaited<ReturnType<typeof processSingleHazard>>;
    const createdHazards: CreatedHazard[] = [];
    const errors: {
      index: number;
      hazard: CreateHazardWebhookBody;
      error: string;
    }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        createdHazards.push(result.value.hazard);
      } else {
        const errorMessage =
          result.reason instanceof HttpError
            ? result.reason.message
            : "Unknown error occurred";
        const hazardData = hazardsData[index];
        if (hazardData) {
          errors.push({
            index,
            hazard: hazardData,
            error: errorMessage,
          });
        }
      }
    });

    // Determine response status
    const allFailed = createdHazards.length === 0;
    const partialSuccess = createdHazards.length > 0 && errors.length > 0;

    if (allFailed) {
      return res.status(400).json({
        success: false,
        message: "Failed to create any hazards",
        errors,
      });
    }

    res.status(partialSuccess ? 207 : 201).json({
      success: true,
      hazards: createdHazards,
      count: createdHazards.length,
      message: partialSuccess
        ? `Created ${createdHazards.length} out of ${hazardsData.length} hazards`
        : `Successfully created ${createdHazards.length} hazards via webhook`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    next(error);
  }
};
