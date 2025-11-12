import type { NextFunction, Request, Response } from "express";
import {
  getHazardsApplyingFilters,
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
import { getAllSubHazardCategories } from "../../services/hazard_category.service.js";
import prisma from "../../utils/prisma_client.util.js";
import { HttpError } from "../../models/http_error.js";
import { HazardReviewStatus } from "@prisma/client";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "../../services/confidence_score.service.js";
import type { AISummaryResponse } from "../../models/ai_summary_response_interface.js";
import { buildHazardInclude } from "../../utils/hazard.util.js";
import { syncHazardsFromDifferentSources } from "../../services/ingestion.service.js";

export const getHazardsForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      searchString,
      categoryIds,
      severityFilter,
      reviewStatus,
      reportedById,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      showExpired,
      sortSettings,
      page = "1",
      pageSize = "100",
    }: GetHazardsForAdminQuery = req.query;

    const hazards = await getHazardsApplyingFiltersRaw({
      searchString,
      categoryIds,
      severityFilter,
      reviewStatus,
      reportedById,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
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
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      shortDescription,
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

    const { userId } = res;
    if (!userId) {
      throw new HttpError(401, "Unauthorized user");
    }

    if (categoryId) {
      const category = await prisma.hazardCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new HttpError(400, "Invalid categoryId provided");
      }
    }

    const availableCategories = await getAllSubHazardCategories();

    const summarized = await summarizeHazard({
      title: title || "",
      description,
      latitude,
      longitude,
      locationName,
      availableCategories,
    });

    // Calculate confidence score for the admin created hazard
    let confidenceScore = 75; // Default high score for admin created hazards
    try {
      const hazardForCalculation: HazardForConfidenceCalculation = {
        severity: summarized.severity,
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

    const createdHazard = await prisma.hazard.create({
      data: {
        title: title || summarized.title,
        shortDescription: shortDescription || summarized.shortDescription,
        description,
        aiSummary: aiSummary || summarized.summary,
        callToAction: callToAction || summarized.callToAction,
        latitude,
        longitude,
        ...(locationName && { locationName }),
        categoryId: categoryId || summarized.category,
        fireStatus: fireStatus || summarized.fireStatus,
        ...(isAwsCompliant !== undefined && { isAwsCompliant }),
        severity: severity || summarized.severity,
        ...(sourceId && { sourceId }),
        ...(!sourceId ? { reportedById: userId } : {}),
        ...(occurredAt && { occurredAt }),
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
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const hazardId = req.params.hazardId;
    if (!hazardId) {
      throw new HttpError(400, "hazardId parameter is required");
    }

    const {
      title,
      shortDescription,
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

    if (categoryId) {
      const category = await prisma.hazardCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new HttpError(400, "Invalid categoryId provided");
      }
    }

    const existingHazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
    });
    if (!existingHazard) {
      throw new HttpError(404, `Hazard with id ${hazardId} not found`);
    }

    const availableCategories = await getAllSubHazardCategories();

    let summarized: AISummaryResponse = {
      title: existingHazard.title,
      shortDescription: existingHazard.shortDescription || "",
      summary: existingHazard.aiSummary || "",
      callToAction: existingHazard.callToAction || "",
      category: existingHazard.categoryId,
      fireStatus: existingHazard.fireStatus,
      severity: existingHazard.severity,
      confidence: existingHazard.aiConfidence || "low",
    };

    if (
      !title ||
      !description ||
      !shortDescription ||
      !aiSummary ||
      !callToAction ||
      !categoryId ||
      !severity
    ) {
      summarized = await summarizeHazard({
        title: title || existingHazard.title,
        description: description || existingHazard.description,
        latitude: latitude ?? existingHazard.latitude!,
        longitude: longitude ?? existingHazard.longitude!,
        locationName: locationName || existingHazard.locationName,
        availableCategories,
      });
    }

    const updatedHazard = await prisma.hazard.update({
      where: { id: hazardId },
      include: buildHazardInclude(),
      data: {
        title: title || summarized.title,
        shortDescription: shortDescription || summarized.shortDescription,
        ...(description && { description }),
        aiSummary: aiSummary || summarized.summary,
        callToAction: callToAction || summarized.callToAction,
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(locationName && { locationName }),
        categoryId: categoryId || summarized.category,
        fireStatus: fireStatus || summarized.fireStatus,
        ...(isAwsCompliant !== undefined && { isAwsCompliant }),
        severity: severity || summarized.severity,
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
