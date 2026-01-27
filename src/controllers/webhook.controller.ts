import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { HazardSeverityBand, type HazardCategory } from "@prisma/client";
import type {
  CreateHazardWebhookBody,
  CreateHazardsWebhookBody,
} from "../validators/webhook.validator.js";
import { getHazardAttributesFromDescription } from "../utils/ingestion.util.js";
import { getAllSubHazardCategories } from "../services/hazard_category.service.js";
import {
  summarizeAndPostHazards,
  ExternalSourceId,
  generateHazardId,
} from "../services/ingestion.service.js";
import type { HazardDataWithRelations } from "../models/hazard_data_with_relations_interface.js";

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
  next: NextFunction,
) => {
  try {
    console.log(
      `[Webhook] Received request to create hazards. Count: ${
        req.body.hazards?.length || 0
      }`,
    );
    const availableCategories = await getAllSubHazardCategories();
    const requestBody: CreateHazardsWebhookBody = req.body;

    const { hazards, syncOption, allowedSeverityBands } = requestBody;
    console.log(
      `[Webhook] Request params - syncOption: ${syncOption}, allowedSeverityBands: ${
        allowedSeverityBands?.join(", ") || "none"
      }`,
    );

    // Process all hazards to prepare data
    const validationResults = await Promise.allSettled(
      hazards.map((hazardData) =>
        processSingleHazard(hazardData, availableCategories),
      ),
    );

    // Separate valid hazards from errors
    const validHazardDatas: Array<
      Awaited<ReturnType<typeof processSingleHazard>>
    > = [];
    const validationErrors: {
      index: number;
      hazard: CreateHazardWebhookBody;
      error: string;
    }[] = [];

    validationResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        validHazardDatas.push(result.value);
      } else {
        const errorMessage =
          result.reason instanceof HttpError
            ? result.reason.message
            : "Unknown error occurred";
        const hazardData = hazards[index];
        console.error(
          `[Webhook] Validation failed for hazard at index ${index}:`,
          errorMessage,
        );
        if (hazardData) {
          validationErrors.push({
            index,
            hazard: hazardData,
            error: errorMessage,
          });
        }
      }
    });

    console.log(
      `[Webhook] Validation complete. Valid: ${validHazardDatas.length}, Errors: ${validationErrors.length}`,
    );

    // If all validations failed, return error
    if (validHazardDatas.length === 0) {
      console.error(
        `[Webhook] All ${hazards.length} hazards failed validation`,
      );
      return res.status(400).json({
        success: false,
        message: "Failed to validate any hazards",
        errors: validationErrors,
      });
    }

    // Prepare severity band filters map (if provided)
    const severityBandFilters = new Map<
      ExternalSourceId,
      HazardSeverityBand[]
    >();
    if (allowedSeverityBands && allowedSeverityBands.length > 0) {
      // Group by sourceId to apply filters per source
      const sourceIds = [...new Set(validHazardDatas.map((h) => h.source!.id))];
      sourceIds.forEach((sourceId) => {
        severityBandFilters.set(
          sourceId as ExternalSourceId,
          allowedSeverityBands,
        );
      });
    }

    // Use summarizeAndPostHazards to process all valid hazards at once
    console.log(
      `[Webhook] Processing ${validHazardDatas.length} valid hazards with syncOption: ${syncOption}`,
    );
    const createdHazards = await summarizeAndPostHazards({
      hazardDatas: validHazardDatas,
      syncOption,
      severityBandFilters,
      calledFromWebhook: true,
    });
    console.log(
      `[Webhook] Successfully processed ${createdHazards.length} hazards`,
    );

    // Determine response status
    const partialSuccess =
      validationErrors.length > 0 ||
      createdHazards.length < validHazardDatas.length;

    if (partialSuccess) {
      console.log(
        `[Webhook] Partial success: ${createdHazards.length}/${hazards.length} hazards processed`,
      );
    } else {
      console.log(
        `[Webhook] Full success: All ${createdHazards.length} hazards processed`,
      );
    }

    res.status(partialSuccess ? 207 : 201).json({
      success: true,
      hazards: createdHazards,
      count: createdHazards.length,
      message: partialSuccess
        ? `Processed ${createdHazards.length} out of ${hazards.length} hazards`
        : `Successfully processed ${createdHazards.length} hazards via webhook`,
      ...(validationErrors.length > 0 && { errors: validationErrors }),
    });
  } catch (error) {
    console.error("[Webhook] Error processing hazards via webhook:", error);
    next(error);
  }
};

/**
 * Helper function to process a single hazard from webhook
 * Validates and converts webhook data to HazardDataWithRelations format
 */
const processSingleHazard = async (
  hazardData: CreateHazardWebhookBody,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[],
): Promise<HazardDataWithRelations> => {
  // Step 1: Extract attributes from description
  const attributes = getHazardAttributesFromDescription(
    hazardData.description,
    availableCategories,
  );

  const {
    id,
    title,
    description,
    aiSummary,
    severity = attributes.severity,
    severityBand = attributes.severityBand,
    callsToAction,
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

  // Step 2: Validate source
  const source = await prisma.hazardSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) {
    throw new HttpError(400, `Invalid sourceId provided: ${sourceId}`);
  }

  // Step 3: Validate location
  if ((latitude === undefined || longitude === undefined) && !locationName) {
    throw new HttpError(
      400,
      "Either latitude & longitude or locationName must be provided",
    );
  }

  // Step 4: Validate and determine category
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

  // Step 5: Convert webhook data to HazardDataWithRelations format
  const hazardDataWithRelations: HazardDataWithRelations = {
    title: title || "",
    description,
    ...(aiSummary && { aiSummary }),
    severity,
    severityBand: severityBand || HazardSeverityBand.info,
    ...(callsToAction && { callsToAction }),
    ...(fireStatus && { fireStatus }),
    ...(latitude !== undefined && { latitude }),
    ...(longitude !== undefined && { longitude }),
    ...(locationName && { locationName }),
    ...(northeastLat !== undefined && { northeastLat }),
    ...(northeastLng !== undefined && { northeastLng }),
    ...(southwestLat !== undefined && { southwestLat }),
    ...(southwestLng !== undefined && { southwestLng }),
    category,
    source,
    isAwsCompliant,
    ...(link && { link }),
    ...(occurredAt && { occurredAt: new Date(occurredAt) }),
    ...(expiresAt && { expiresAt: new Date(expiresAt) }),
  };

  return {
    ...hazardDataWithRelations,
    id: id || generateHazardId(hazardDataWithRelations),
  };
};
