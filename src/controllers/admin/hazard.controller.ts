import type { NextFunction, Request, Response } from "express";
import {
  getHazardsApplyingFiltersRaw,
  summarizeHazard,
} from "../../services/hazard.service.js";
import type {
  CreateHazardForAdminBody,
  GetHazardsForAdminQuery,
  SyncHazardsFromExternalSourceForAdminBody,
  UpdateHazardForAdminBody,
} from "../../validators/admin/hazard.validator.js";
import { parseBoolean } from "../../utils/parse.util.js";
import prisma from "../../utils/prisma_client.util.js";
import { HttpError } from "../../models/http_error.js";
import {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
  type HazardCategory,
  type HazardSource,
} from "@prisma/client";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "../../services/confidence_score.service.js";
import type { AISummaryResponse } from "../../models/ai_summary_response_interface.js";
import {
  buildHazardInclude,
  getHazardExpiryDateFromSeverity,
} from "../../utils/hazard.util.js";
import { syncHazardsFromDifferentSources } from "../../services/ingestion.service.js";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";
import { getHazardAttributesFromDescription } from "../../utils/ingestion.util.js";
import { getAllSubHazardCategories } from "../../services/hazard_category.service.js";

export const getHazardsForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      searchString,
      categoryIds,
      awsEmergency,
      awsWatchAndAct,
      awsAdvice,
      officialNonAws,
      userReported,
      reviewStatus,
      reportedById,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      ignoreHazardLatLngBounds,
      showExpired,
      sortSettings,
      page = "1",
      pageSize = "100",
    }: GetHazardsForAdminQuery = req.query;

    const hazards = await getHazardsApplyingFiltersRaw({
      searchString,
      categoryIds,
      awsEmergency: parseBoolean(awsEmergency),
      awsWatchAndAct: parseBoolean(awsWatchAndAct),
      awsAdvice: parseBoolean(awsAdvice),
      officialNonAws: parseBoolean(officialNonAws),
      userReported: parseBoolean(userReported),
      reviewStatus,
      reportedById,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
      ignoreHazardLatLngBounds: parseBoolean(ignoreHazardLatLngBounds),
      showExpired: parseBoolean(showExpired),
      sortSettings,
      page: Number(page),
      pageSize: Number(pageSize),
    });
    res.status(200).json(hazards);
  } catch (error) {
    next(error);
  }
};

export const createHazardForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

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
    }: CreateHazardForAdminBody = req.body;

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

    // Calculate confidence score for the admin created hazard
    let confidenceScore = 75; // Default high score for admin created hazards
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
        "Error calculating confidence score for admin created hazard:",
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
        ...(occurredAt && { occurredAt }),
        expiresAt: expiresAt || getHazardExpiryDateFromSeverity(severity),
        aiConfidence: summarized.confidence,
        confidenceScore,
        confidenceScoreCalculatedAt: new Date(),
        reviewStatus: HazardReviewStatus.accepted,
      },
    });

    res.status(201).json(createdHazard);
  } catch (error) {
    next(error);
  }
};

export const updateHazardForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const hazardId = req.params.hazardId;
    if (!hazardId) {
      throw new HttpError(400, "hazardId parameter is required");
    }

    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const {
      title,
      description,
      aiSummary,
      callToAction,
      latitude,
      longitude,
      locationName,
      categoryId,
      fireStatus,
      isAwsCompliant,
      severity,
      sourceId,
      occurredAt,
    }: UpdateHazardForAdminBody = req.body;

    const existingHazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      include: { category: true, source: true },
    });
    if (!existingHazard) {
      throw new HttpError(404, `Hazard with id ${hazardId} not found`);
    }

    let category: HazardCategory | undefined = undefined;
    if (categoryId) {
      const foundCategory = await prisma.hazardCategory.findUnique({
        where: { id: categoryId },
      });
      if (!foundCategory) {
        throw new HttpError(400, "Invalid categoryId provided");
      }
      category = foundCategory;
    }

    let source: HazardSource | undefined = undefined;
    if (sourceId) {
      const foundSource = await prisma.hazardSource.findUnique({
        where: { id: sourceId },
      });
      if (!foundSource) {
        throw new HttpError(400, "Invalid sourceId provided");
      }
      source = foundSource;
    }

    let summarized: AISummaryResponse = {
      title: existingHazard.title,
      summary: existingHazard.aiSummary || "",
      callToAction: existingHazard.callToAction || "",
      confidence: existingHazard.aiConfidence || "low",
    };

    if (!title || !description || !aiSummary || !callToAction) {
      summarized = await summarizeHazard({
        title: title || existingHazard.title,
        description: description || existingHazard.description,
        locationName: locationName || existingHazard.locationName,
        category: category || existingHazard.category!,
        source: source || existingHazard.source!,
        isAwsCompliant: isAwsCompliant ?? existingHazard.isAwsCompliant,
        severityBand: HazardSeverityBand.info,
      });
    }

    const updatedHazard = await prisma.hazard.update({
      where: { id: hazardId },
      include: buildHazardInclude(),
      data: {
        title: title || summarized.title,
        ...(description && { description }),
        aiSummary: aiSummary || summarized.summary,
        callToAction: callToAction || summarized.callToAction,
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(locationName && { locationName }),
        ...(categoryId && { categoryId }),
        ...(fireStatus && { fireStatus }),
        ...(isAwsCompliant !== undefined && { isAwsCompliant }),
        ...(severity && { severity }),
        ...(sourceId && { sourceId }),
        ...(occurredAt && { occurredAt }),
        aiConfidence: summarized.confidence,
      },
    });

    res.status(200).json(updatedHazard);
  } catch (error) {
    next(error);
  }
};

export const deleteHazardForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const hazardId = req.params.hazardId;
    if (!hazardId) {
      throw new HttpError(400, "hazardId parameter is required");
    }

    const existingHazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
    });
    if (!existingHazard) {
      throw new HttpError(404, `Hazard with id ${hazardId} not found`);
    }

    await prisma.hazard.delete({
      where: { id: hazardId },
    });

    res.status(200).json({ message: "Hazard deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const syncHazardsFromExternalSourceForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sourceIds, syncOption }: SyncHazardsFromExternalSourceForAdminBody =
      req.body;

    const createdHazards = await syncHazardsFromDifferentSources({
      sourceIds,
      syncOption,
    });
    res.status(200).json(createdHazards);
  } catch (error) {
    next(error);
  }
};

export const getHazardSourcesForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sources = await prisma.hazardSource.findMany({
      orderBy: { name: "asc" },
    });
    res.status(200).json(sources);
  } catch (error) {
    next(error);
  }
};
