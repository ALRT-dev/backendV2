import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import {
  HazardReviewStatus,
  type HazardCategory,
  type HazardSource,
} from "@prisma/client";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "../services/confidence_score.service.js";
import { getHazardExpiryDateFromSeverity } from "../utils/hazard.util.js";
import { summarizeHazard } from "../services/hazard.service.js";
import type { CreateHazardWebhookBody } from "../validators/webhook.validator.js";
import { getHazardAttributesFromDescription } from "../utils/ingestion.util.js";
import { getAllSubHazardCategories } from "../services/hazard_category.service.js";

/**
 * Webhook endpoint to create hazards from external tools like N8N
 *
 * This endpoint provides similar functionality to the admin createHazardForAdmin
 * but is designed to be called by external automation tools.
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
    const attributes = getHazardAttributesFromDescription(
      req.body.description,
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
    }: CreateHazardWebhookBody = req.body;

    // Validate sourceId
    const source = await prisma.hazardSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      throw new HttpError(400, "Invalid sourceId provided");
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
        throw new HttpError(400, "Invalid categoryId provided");
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

    res.status(201).json({
      success: true,
      hazard: createdHazard,
      message: "Hazard created successfully via webhook",
    });
  } catch (error) {
    next(error);
  }
};
