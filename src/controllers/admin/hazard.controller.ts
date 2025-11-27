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
import { buildHazardInclude } from "../../utils/hazard.util.js";
import { syncHazardsFromDifferentSources } from "../../services/ingestion.service.js";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";

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
    }: CreateHazardForAdminBody = req.body;

    const category = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new HttpError(400, "Invalid categoryId provided");
    }

    let source: HazardSource;
    if (sourceId) {
      const foundSource = await prisma.hazardSource.findUnique({
        where: { id: sourceId },
      });
      if (!foundSource) {
        throw new HttpError(400, "Invalid sourceId provided");
      }
      source = foundSource;
    }

    const summarized = await summarizeHazard({
      title: title || "",
      description,
      latitude,
      longitude,
      locationName,
      category,
      source: source!,
      isAwsCompliant: isAwsCompliant ?? false,
      severityBand: HazardSeverityBand.info,
    });

    // Calculate confidence score for the admin created hazard
    let confidenceScore = 75; // Default high score for admin created hazards
    try {
      const hazardForCalculation: HazardForConfidenceCalculation = {
        severity: severity || HazardSeverity.unknown,
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

    const today = new Date();
    const createdHazard = await prisma.hazard.create({
      data: {
        title: title || summarized.title,
        description,
        aiSummary: aiSummary || summarized.summary,
        callToAction: callToAction || summarized.callToAction,
        latitude,
        longitude,
        ...(locationName && { locationName }),
        ...(categoryId && { categoryId }),
        ...(fireStatus && { fireStatus }),
        ...(isAwsCompliant !== undefined && { isAwsCompliant }),
        ...(severity && { severity }),
        ...(sourceId && { sourceId }),
        ...(occurredAt && { occurredAt }),
        aiConfidence: summarized.confidence,
        confidenceScore,
        confidenceScoreCalculatedAt: new Date(),
        reviewStatus: HazardReviewStatus.accepted,
        expiresAt: new Date(today.setMinutes(today.getMinutes() + 30)), // Default expiry 30 minutes from now
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
        latitude: latitude ?? existingHazard.latitude!,
        longitude: longitude ?? existingHazard.longitude!,
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
