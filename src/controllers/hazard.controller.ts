import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
  HazardVoteType,
  MediaType,
  type Hazard,
  type HazardCategory,
} from "@prisma/client";
import {
  getHazardsApplyingFiltersRaw,
  getSuggestedCategory,
  reviewHazard,
} from "../services/hazard.service.js";
import {
  sendPushNotificationAboutNewHazard,
  sendPushNotificationToUser,
} from "../services/notification.service.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import {
  sendSocketEventAboutHazardToSubscribers,
  sendSocketEventToUsers,
} from "../services/socket.service.js";
import { HttpError } from "../models/http_error.js";
import { SocketEvent } from "../models/socket_event_types.js";
import {
  awardFirstReport,
  handleReportReviewOutcome,
} from "../services/xp_ledger.service.js";
import { calculateUserReportsStatus } from "../services/user.service.js";
import {
  calculateConfidenceScore,
  recalculateHazardConfidenceScore,
  type HazardForConfidenceCalculation,
} from "../services/confidence_score.service.js";
import type {
  CreateHazardInput,
  GetHazardsQuery,
  UpdateHazardInput,
  VoteHazardInput,
} from "../validators/hazard.validator.js";
import {
  adjustExpirationTime,
  buildHazardInclude,
} from "../utils/hazard.util.js";
import { parseBoolean } from "../utils/parse.util.js";
import {
  uploadMultipleFilesToS3,
  deleteMultipleFilesFromS3,
  enrichHazardsWithPresignedUrls,
  enrichHazardWithPresignedUrls,
} from "../services/s3.service.js";
import type { MediaUploadResult } from "../models/media_upload_result_interface.js";
import { getSeverityBandFromDescription } from "../utils/ingestion.severity.util.js";
import { getSingleUserLocationSubscriptionByBounds } from "../services/location_subscription.service.js";
import { checkMediasForProblems } from "../services/image_video_detection.service.js";
import { notifyFamiliesAboutNewHazard } from "../services/family_alert.service.js";
import { getAllParentHazardCategories } from "./hazard_category.controller.js";
import { getAllMainHazardCategoriesWithoutSubcategories } from "../services/hazard_category.service.js";
import {
  buildHazardListCacheKey,
  getCachedHazardList,
  cacheHazardList,
  getCachedHazard,
  cacheHazard,
  invalidateHazardCaches,
} from "../services/hazard_cache.service.js";

/// Controller to handle fetching hazards with optional filters and pagination.
export const getHazards = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      searchString,
      categoryIds,
      sourceIds,
      awsEmergency,
      awsWatchAndAct,
      awsAdvice,
      officialNonAws,
      userReported,
      reviewStatus,
      reportedById,
      severities,
      severityBands,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      ignoreHazardLatLngBounds,
      showExpired,
      sortSettings,
      page = "1",
      pageSize = "20",
    }: GetHazardsQuery = req.query;
    const { userId } = res;

    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: { latitude: true, longitude: true },
    });
    const userLat = user?.latitude || undefined;
    const userLng = user?.longitude || undefined;

    const filterParams = {
      searchString,
      categoryIds,
      sourceIds,
      reportedById,
      awsEmergency: parseBoolean(awsEmergency),
      awsWatchAndAct: parseBoolean(awsWatchAndAct),
      awsAdvice: parseBoolean(awsAdvice),
      officialNonAws: parseBoolean(officialNonAws),
      userReported: parseBoolean(userReported),
      reviewStatus,
      severities,
      severityBands,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
      ignoreHazardLatLngBounds: parseBoolean(ignoreHazardLatLngBounds),
      userId,
      userLat,
      userLng,
      showExpired: parseBoolean(showExpired),
      sortSettings,
      page: Number(page),
      pageSize: Number(pageSize),
    };

    const cacheKey = await buildHazardListCacheKey(filterParams);
    const cached = await getCachedHazardList<Hazard>(cacheKey);

    let hazards: Hazard[];
    if (cached) {
      hazards = cached;
    } else {
      hazards = await getHazardsApplyingFiltersRaw(filterParams);
      await cacheHazardList(cacheKey, hazards);
    }

    const hazardsWithPresignedUrls =
      await enrichHazardsWithPresignedUrls(hazards);

    res.status(200).json(hazardsWithPresignedUrls);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle fetching hazards along with subscription ID
export const getHazardsWithSubscriptionId = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
      reportedById,
      reviewStatus,
      severities,
      severityBands,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      ignoreHazardLatLngBounds,
      showExpired,
      sortSettings,
      page = "1",
      pageSize = "20",
    }: GetHazardsQuery = req.query;
    const { userId } = res;

    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: { latitude: true, longitude: true },
    });
    const userLat = user?.latitude || undefined;
    const userLng = user?.longitude || undefined;

    const filterParams = {
      searchString,
      categoryIds,
      awsEmergency: parseBoolean(awsEmergency),
      awsWatchAndAct: parseBoolean(awsWatchAndAct),
      awsAdvice: parseBoolean(awsAdvice),
      officialNonAws: parseBoolean(officialNonAws),
      userReported: parseBoolean(userReported),
      reviewStatus,
      severities,
      severityBands,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
      ignoreHazardLatLngBounds: parseBoolean(ignoreHazardLatLngBounds),
      reportedById,
      userId,
      userLat,
      userLng,
      showExpired: parseBoolean(showExpired),
      sortSettings,
      page: Number(page),
      pageSize: Number(pageSize),
    };

    const cacheKey = await buildHazardListCacheKey(filterParams);

    const subscriptionPromise = getSingleUserLocationSubscriptionByBounds({
      userId: userId!,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
    });

    const hazardsPromise = (async (): Promise<Hazard[]> => {
      const cached = await getCachedHazardList<Hazard>(cacheKey);
      if (cached) return cached;

      const fresh = await getHazardsApplyingFiltersRaw(filterParams);
      await cacheHazardList(cacheKey, fresh);
      return fresh;
    })();

    const [subscription, hazards] = await Promise.all([
      subscriptionPromise,
      hazardsPromise,
    ]);

    const subscriptionId = subscription?.id;

    // If no hazards found, return empty response with subscription ID
    if (hazards.length === 0) {
      return res.status(200).json({
        subscriptionId,
        hazards: [],
      });
    }

    // Enrich hazards with presigned URLs for media access
    const hazardsWithPresignedUrls =
      await enrichHazardsWithPresignedUrls(hazards);

    res.status(200).json({
      subscriptionId,
      hazards: hazardsWithPresignedUrls,
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle fetching a single hazard by its ID.
export const getHazardById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }

    let hazard = await getCachedHazard<Hazard>(id);

    if (!hazard) {
      hazard = (await prisma.hazard.findUnique({
        where: { id },
        include: buildHazardInclude(),
      })) as Hazard | null;

      if (!hazard) {
        return res.status(404).json({ message: "Hazard not found" });
      }

      await cacheHazard(id, hazard);
    }

    const hazardWithPresignedUrls = await enrichHazardsWithPresignedUrls([
      hazard,
    ]);

    res.status(200).json(hazardWithPresignedUrls[0]);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle creating a new hazard report.
export const createHazard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { hazard: hazardData }: CreateHazardInput = req.body;
    const {
      title,
      description,
      categoryId,
      latitude,
      longitude,
      locationName,
      occurredAt,
    } = hazardData;
    const { userId } = res;

    // Overwrite category using AI suggestion <----------------------------------------------------------------------------------
    let category: HazardCategory | null = null;
    try {
      if (title || description) {
        const availableCategories =
          await getAllMainHazardCategoriesWithoutSubcategories();
        const suggestedCategory = await getSuggestedCategory({
          title: title || "[No Title Provided]",
          description: description || "[No Description Provided]",
          currentCategoryId: categoryId,
          availableCategories,
        });
        category = suggestedCategory;
      }
    } catch (error) {
      console.error("Error getting AI suggested category:", error);
    }

    if (!category) {
      category = await prisma.hazardCategory.findUnique({
        where: { id: categoryId },
      });
    }
    if (!category) {
      throw new HttpError(400, "Invalid or missing hazard category");
    }

    const uploadedFiles = req.files as Express.Multer.File[] | undefined;

    // Perform AI-based media moderation if media files are provided <--------------------------------------------------------------
    const mediaModerationResult = await checkMediasForProblems(
      uploadedFiles || [],
    );

    // Generate feedback message if some media was rejected
    let mediaModerationFeedback: string | undefined = undefined;
    if (mediaModerationResult.hasProblematicFiles) {
      const uniqueReasons = [
        ...new Set(
          mediaModerationResult.problematicFiles.flatMap(
            (item) => item.reasons,
          ),
        ),
      ];
      mediaModerationFeedback = `We have removed ${
        mediaModerationResult.problematicFiles.length
      } media file${
        mediaModerationResult.problematicFiles.length > 1 ? "s" : ""
      } from the alert because of the following reason(s):\n- ${uniqueReasons.join(
        "\n- ",
      )}`;
    }

    // Upload only valid media files to S3 <----------------------------------------------------------------------------------
    let mediaUploadResults: MediaUploadResult[] = [];

    if (mediaModerationResult.validFiles.length > 0) {
      try {
        mediaUploadResults = await uploadMultipleFilesToS3(
          mediaModerationResult.validFiles,
          "hazards",
        );
        console.log(
          `Successfully uploaded ${mediaUploadResults.length} valid media files to S3`,
        );
      } catch (error) {
        console.error("Error uploading media files:", error);
        throw new HttpError(
          500,
          "Failed to upload media files. Please try again.",
        );
      }
    }

    // Perform AI review of the hazard report <----------------------------------------------------------------------------------
    let review: any;
    try {
      review = await reviewHazard({
        title,
        description,
        category,
        latitude,
        longitude,
        locationName,
        severityBand:
          (description && getSeverityBandFromDescription(description)) ||
          HazardSeverityBand.info,
      });
    } catch (error) {
      console.log("Error during hazard review:", error);
      review = {
        reviewStatus: HazardReviewStatus.pending,
        reviewFeedback:
          "We're sorry, but we couldn't review your alrt at this time. We need more time to process it.",
      };
      // Don't fail the entire request if AI review fails
    }

    // Media that could not be screened must never auto-publish: route the
    // report to manual review instead (fail-safe, not fail-open).
    if (
      mediaModerationResult.moderationUnavailable &&
      review.reviewStatus === HazardReviewStatus.accepted
    ) {
      review.reviewStatus = HazardReviewStatus.pending;
      review.reviewFeedback =
        "Your alrt is awaiting review because the attached media could not be automatically screened.";
    }

    const {
      reviewStatus,
      reviewFeedback,
      title: suggestedTitle,
      summary: aiSummary,
      confidence: aiConfidence,
      callsToAction,
    } = review;

    // Calculate confidence score for the new hazard <----------------------------------------------------------------------------------
    let confidenceScore = 0;
    try {
      // Get reporter data if user is creating the hazard
      let reporterData = null;
      let reportsStatus = undefined;

      if (userId) {
        const reporter = await prisma.user.findUnique({
          where: { id: userId },
          select: { xpPoints: true, reliabilityScore: true },
        });
        reporterData = reporter;
        reportsStatus = await calculateUserReportsStatus(userId);
      }

      // Create hazard data for confidence calculation
      const hazardForCalculation: HazardForConfidenceCalculation = {
        severity: HazardSeverity.unknown,
        aiConfidence: aiConfidence || null,
        upvoteCount: 0,
        downvoteCount: 0,
        createdAt: new Date(),
        reportedBy: reporterData,
        ...(reportsStatus && { reportsStatus }),
      };

      confidenceScore = calculateConfidenceScore(hazardForCalculation);
    } catch (error) {
      console.error("Error calculating confidence score:", error);
      confidenceScore = 50; // Default fallback score
    }

    const date = new Date();

    // Create hazard with media in a transaction <----------------------------------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {
      // Create the hazard first
      const hazard = await tx.hazard.create({
        data: {
          title: suggestedTitle || title || "An unverified incident",
          description: description || "",
          reviewStatus: reviewStatus,
          reviewFeedback: mediaModerationFeedback || reviewFeedback,
          ...(reviewStatus === HazardReviewStatus.accepted && {
            reviewedAt: new Date(),
          }),
          aiSummary,
          ...(aiConfidence && { aiConfidence }),
          callsToAction,
          categoryId: category.id,
          reportedById: userId,
          latitude,
          longitude,
          locationName,
          confidenceScore,
          confidenceScoreCalculatedAt: new Date(),
          ...(occurredAt && { occurredAt: new Date(occurredAt) }),
          ...(reviewStatus === HazardReviewStatus.accepted && {
            expiresAt: new Date(date.setMinutes(date.getMinutes() + 30)),
          }),
        },
      });

      // Create media records if there are uploaded files
      if (mediaUploadResults.length > 0 && userId) {
        const mediaPromises = mediaUploadResults.map((mediaResult, index) => {
          const isImage = mediaResult.mimeType.startsWith("image/");
          const isVideo = mediaResult.mimeType.startsWith("video/");

          let mediaType: MediaType = "image";
          if (isVideo) {
            mediaType = "video";
          } else if (isImage) {
            mediaType = "image";
          }

          return tx.hazardMedia.create({
            data: {
              hazardId: hazard.id,
              userId: userId,
              url: mediaResult.url,
              s3Key: mediaResult.key,
              type: mediaType,
              mimeType: mediaResult.mimeType,
              fileSize: mediaResult.size,
              originalName: mediaResult.originalName,
              isPrimary: index === 0, // First media is primary
            },
          });
        });

        await Promise.all(mediaPromises);
      }

      // Return hazard with all relations
      return await tx.hazard.findUnique({
        where: { id: hazard.id },
        include: buildHazardInclude(),
      });
    });

    // If hazard creation failed, cleanup uploaded S3 files <-----------------------------------------------------------------
    if (!result) {
      if (mediaUploadResults.length > 0) {
        try {
          await deleteMultipleFilesFromS3(mediaUploadResults.map((r) => r.key));
        } catch (cleanupError) {
          console.error(
            "Error cleaning up S3 files after failed hazard creation:",
            cleanupError,
          );
        }
      }
      throw new HttpError(500, "Failed to create hazard");
    }

    const hazard = await enrichHazardWithPresignedUrls(result);

    await invalidateHazardCaches();

    // Scoring v2: ledger-based award for the reviewed report (never throws)
    let xpResult = null;
    if (userId && hazard.reviewStatus !== HazardReviewStatus.pending) {
      xpResult = await handleReportReviewOutcome(hazard);
    }

    // Points & Badge Logic v1.1: the first ALRT a person posts earns 10,
    // once, on top of whatever the review outcome pays. Awarded on posting
    // rather than on approval, because it marks the moment someone became a
    // contributor, not the quality of that one report.
    if (userId) {
      await awardFirstReport(userId, hazard.id);
    }

    if (reviewStatus === HazardReviewStatus.accepted) {
      // Send push notifications to users who subscribed to this area when a new hazard is created
      // This will ignore the user who reported the hazard
      sendPushNotificationAboutNewHazard(hazard);

      // Send socket events to users who subscribed to this area when a new hazard is created
      // This will NOT ignore the user who reported the hazard
      sendSocketEventAboutHazardToSubscribers({
        hazard: hazard,
        socketEvent: SocketEvent.newHazard,
      });

      // Alert family circles with members or saved places near this hazard
      notifyFamiliesAboutNewHazard(hazard);
    }

    // Now also send a notification to the user who reported the hazard
    if (reviewStatus === HazardReviewStatus.accepted) {
      sendPushNotificationToUser({
        userId: userId!,
        title: "ALRT Approved! 🎉",
        body: "Your alert is now live - community notified",
        data: hazard,
        type: PushNotificationType.viewHazard,
      });
    } else if (reviewStatus === HazardReviewStatus.rejected) {
      const xpMessage =
        xpResult && xpResult.pointsAwarded < 0
          ? ` You lost ${Math.abs(xpResult.pointsAwarded)} XP points.`
          : "";
      sendPushNotificationToUser({
        userId: userId!,
        title: "Invalid ALRT Report",
        body: `Our review found your ALRT report to be invalid. ${reviewFeedback}${xpMessage}`,
        data: hazard,
        type: PushNotificationType.viewHazard,
      });
    }

    res.status(201).json(hazard);
  } catch (error) {
    next(error);
  }
};

export const updateHazard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { userId } = res;
    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }
    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }

    const existingHazard = await prisma.hazard.findUnique({
      where: { id },
      include: {
        medias: true,
        category: true,
      },
    });
    if (!existingHazard) {
      throw new HttpError(404, "Hazard not found");
    }

    // only the user who reported the hazard or an admin can update it
    if (existingHazard.reportedById !== userId) {
      throw new HttpError(403, "Forbidden: You cannot update this hazard");
    }

    const { hazard: hazardData, removedMediaIds }: UpdateHazardInput = req.body;

    const {
      title,
      description,
      categoryId,
      latitude,
      longitude,
      locationName,
      occurredAt,
    } = hazardData;

    const catId = categoryId || existingHazard.categoryId;

    // Overwrite category using AI suggestion <----------------------------------------------------------------------------------
    let category: HazardCategory | null = null;
    try {
      if (title || description) {
        const availableCategories =
          await getAllMainHazardCategoriesWithoutSubcategories();
        const suggestedCategory = await getSuggestedCategory({
          title: title || "[No Title Provided]",
          description: description || "[No Description Provided]",
          currentCategoryId: catId,
          availableCategories,
        });
        category = suggestedCategory;
      }
    } catch (error) {
      console.error("Error getting AI suggested category:", error);
    }

    if (!category) {
      category = await prisma.hazardCategory.findUnique({
        where: { id: catId },
      });
    }
    if (!category) {
      category = existingHazard.category;
    }

    const uploadedFiles = req.files as Express.Multer.File[] | undefined;

    // Perform AI-based media moderation if media files are provided <--------------------------------------------------------------
    const mediaModerationResult = await checkMediasForProblems(
      uploadedFiles || [],
    );

    // Generate feedback message if some media was rejected
    let mediaModerationFeedback: string | undefined = undefined;
    if (mediaModerationResult.hasProblematicFiles) {
      const uniqueReasons = [
        ...new Set(
          mediaModerationResult.problematicFiles.flatMap(
            (item) => item.reasons,
          ),
        ),
      ];
      mediaModerationFeedback = `We have removed ${
        mediaModerationResult.problematicFiles.length
      } media file${
        mediaModerationResult.problematicFiles.length > 1 ? "s" : ""
      } from the alert because of the following reason(s):\n- ${uniqueReasons.join(
        "\n- ",
      )}`;
    }

    // Upload only valid new media files to S3 <----------------------------------------------------------------------------------
    let mediaUploadResults: MediaUploadResult[] = [];
    if (mediaModerationResult.validFiles.length > 0) {
      try {
        mediaUploadResults = await uploadMultipleFilesToS3(
          mediaModerationResult.validFiles,
          "hazards",
        );
        console.log(
          `Successfully uploaded ${mediaUploadResults.length} new valid media files to S3`,
        );
      } catch (error) {
        console.error("Error uploading new media files:", error);
        throw new HttpError(
          500,
          "Failed to upload media files. Please try again.",
        );
      }
    }

    // Perform AI review of the hazard report <----------------------------------------------------------------------------------
    let review: any;
    try {
      review = await reviewHazard({
        title,
        description,
        category,
        latitude: latitude || existingHazard.latitude!,
        longitude: longitude || existingHazard.longitude!,
        locationName: locationName || existingHazard.locationName,
        severityBand: getSeverityBandFromDescription(
          description || existingHazard.description,
        ),
      });
    } catch (error) {
      console.log("Error during hazard review:", error);
      review = {
        reviewStatus: HazardReviewStatus.pending,
        reviewFeedback:
          "We're sorry, but we couldn't review your alrt at this time. We need more time to process it.",
      };
      // Don't fail the entire request if AI review fails
    }

    // Media that could not be screened must never auto-publish: route the
    // report to manual review instead (fail-safe, not fail-open).
    if (
      mediaModerationResult.moderationUnavailable &&
      review.reviewStatus === HazardReviewStatus.accepted
    ) {
      review.reviewStatus = HazardReviewStatus.pending;
      review.reviewFeedback =
        "Your alrt is awaiting review because the attached media could not be automatically screened.";
    }

    const {
      reviewStatus,
      reviewFeedback,
      title: suggestedTitle,
      summary: aiSummary,
      confidence: aiConfidence,
      callsToAction,
    } = review;

    const date = new Date();

    // Update hazard with new media in a transaction <----------------------------------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {
      // Delete all existing votes for this hazard
      await tx.hazardVote.deleteMany({
        where: { hazardId: id },
      });

      // Update the hazard and reset vote counts
      const updatedHazard = await tx.hazard.update({
        where: { id },
        data: {
          title: suggestedTitle || title || "An unverified incident",
          description: description || "",
          reviewStatus: reviewStatus,
          reviewFeedback: mediaModerationFeedback || reviewFeedback,
          ...(reviewStatus === HazardReviewStatus.accepted && {
            reviewedAt: new Date(),
          }),
          aiSummary,
          callsToAction,
          ...(aiConfidence && { aiConfidence }),
          categoryId: category.id,
          ...(latitude && { latitude }),
          ...(longitude && { longitude }),
          ...(locationName && { locationName }),
          ...(occurredAt && { occurredAt: new Date(occurredAt) }),
          ...(reviewStatus === HazardReviewStatus.accepted && {
            expiresAt:
              existingHazard.expiresAt ||
              new Date(date.setMinutes(date.getMinutes() + 30)), // Default expiry to 30 minutes from now
          }),
          upvoteCount: 0,
          downvoteCount: 0,
        },
      });

      // Add new media records if there are uploaded files
      if (mediaUploadResults.length > 0) {
        // If this is the first media being added, mark it as primary
        const hasPrimaryMedia = existingHazard.medias?.some(
          (media) => media.isPrimary,
        );

        const mediaPromises = mediaUploadResults.map((mediaResult, index) => {
          const isImage = mediaResult.mimeType.startsWith("image/");
          const isVideo = mediaResult.mimeType.startsWith("video/");

          let mediaType: MediaType = "image";
          if (isVideo) {
            mediaType = "video";
          } else if (isImage) {
            mediaType = "image";
          }

          return tx.hazardMedia.create({
            data: {
              hazardId: updatedHazard.id,
              userId: userId,
              url: mediaResult.url,
              s3Key: mediaResult.key,
              type: mediaType,
              mimeType: mediaResult.mimeType,
              fileSize: mediaResult.size,
              originalName: mediaResult.originalName,
              isPrimary: !hasPrimaryMedia && index === 0, // Mark first new media as primary if no primary exists
            },
          });
        });

        await Promise.all(mediaPromises);
      }

      // Delete removed media files from S3 and database
      if (removedMediaIds && removedMediaIds.length > 0) {
        const mediaToRemove = existingHazard.medias.filter((media) =>
          removedMediaIds.includes(media.id),
        );

        // Delete media files from S3
        if (mediaToRemove.length > 0) {
          try {
            const s3Keys = mediaToRemove
              .map((media) => media.s3Key)
              .filter((media) => media != null);
            await deleteMultipleFilesFromS3(s3Keys);
          } catch (cleanupError) {
            console.error(
              "Error cleaning up S3 files after failed hazard update:",
              cleanupError,
            );
          }

          // Delete media records from database
          await tx.hazardMedia.deleteMany({
            where: {
              id: {
                in: mediaToRemove.map((media) => media.id),
              },
            },
          });
        }
      }

      // Return updated hazard with all relations
      return await tx.hazard.findUnique({
        where: { id: updatedHazard.id },
        include: {
          ...buildHazardInclude(),
          medias: {
            orderBy: {
              isPrimary: "desc",
            },
          },
        },
      });
    });

    // If hazard update failed, cleanup uploaded S3 files <-----------------------------------------------------------------
    if (!result) {
      if (mediaUploadResults.length > 0) {
        try {
          await deleteMultipleFilesFromS3(mediaUploadResults.map((r) => r.key));
        } catch (cleanupError) {
          console.error(
            "Error cleaning up S3 files after failed hazard update:",
            cleanupError,
          );
        }
      }
      throw new HttpError(500, "Failed to update hazard");
    }

    const updatedHazard = await enrichHazardWithPresignedUrls(result);

    await invalidateHazardCaches(id);

    // Send socket event about updated hazard to subscribers
    sendSocketEventAboutHazardToSubscribers({
      hazard: updatedHazard,
      socketEvent: SocketEvent.updateHazard,
    });

    res.status(200).json(updatedHazard);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle deleting a hazard by its ID.
export const deleteHazard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }

    const { id } = req.params;
    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }

    const hazard = await prisma.hazard.findUnique({
      where: { id },
      select: {
        id: true,
        reportedById: true,
        medias: {
          select: {
            s3Key: true,
          },
        },
      },
    });

    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    // only the user who reported the hazard or an admin can delete it
    if (hazard.reportedById !== userId) {
      throw new HttpError(403, "Forbidden: You cannot delete this hazard");
    }

    // Extract S3 keys from media URLs for cleanup
    const s3KeysToDelete: string[] = [];

    if (hazard.medias?.length > 0) {
      for (const media of hazard.medias) {
        if (media.s3Key) {
          s3KeysToDelete.push(media.s3Key);
        }
      }
    }

    const deletedHazard = await prisma.hazard.delete({
      where: { id },
      include: buildHazardInclude(),
    });

    // Delete media files from S3 after successful hazard deletion
    if (s3KeysToDelete.length > 0) {
      try {
        await deleteMultipleFilesFromS3(s3KeysToDelete);
        console.log(
          `Successfully deleted ${s3KeysToDelete.length} media files from S3`,
        );
      } catch (s3Error) {
        console.error("Error deleting media files from S3:", s3Error);
        // Don't fail the entire request if S3 cleanup fails
        // The hazard is already deleted from the database
      }
    }

    await invalidateHazardCaches(id);

    // Notify subscribers about the deleted hazard
    sendSocketEventAboutHazardToSubscribers({
      socketEvent: SocketEvent.deleteHazard,
      hazard: deletedHazard,
    });

    res.status(200).json({ message: "Hazard deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle voting (upvote/downvote) on a hazard.
export const voteHazard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: hazardId } = req.params;
    const { voteType }: VoteHazardInput = req.body;
    const { userId } = res;

    if (!hazardId) {
      throw new HttpError(400, "Hazard ID is required");
    }

    // Check if the hazard exists
    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      select: { id: true },
    });
    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedHazard: Hazard;
      let voteAction: "new" | "remove" | "change" = "new";
      let previousVoteType: HazardVoteType | null = null;

      // Check if the user has already voted on this hazard
      const existingVote = await tx.hazardVote.findUnique({
        where: {
          hazardId_userId: {
            hazardId,
            userId: userId!,
          },
        },
      });

      if (!existingVote) {
        // If no existing vote, create a new one
        voteAction = "new";
        await tx.hazardVote.create({
          data: {
            hazardId,
            userId: userId!,
            voteType: voteType as HazardVoteType,
          },
        });

        // Also increment the appropriate count in Hazard and adjust expiration time
        const currentHazard = await tx.hazard.findUnique({
          where: { id: hazardId },
          select: { expiresAt: true, reportedById: true },
        });

        let newExpiresAt = currentHazard?.expiresAt;
        // Only adjust expiration time if it's not a self-vote
        if (newExpiresAt && currentHazard?.reportedById !== userId) {
          // Add 1 minute for upvote, subtract 30 seconds for downvote
          const adjustmentMs = voteType === "upvote" ? 60 * 1000 : -30 * 1000;
          newExpiresAt = adjustExpirationTime(newExpiresAt, adjustmentMs);
        }

        updatedHazard = await tx.hazard.update({
          where: { id: hazardId },
          include: buildHazardInclude(),
          data: {
            upvoteCount: {
              increment: voteType === "upvote" ? 1 : 0,
            },
            downvoteCount: {
              increment: voteType === "downvote" ? 1 : 0,
            },
            ...(newExpiresAt && { expiresAt: newExpiresAt }),
          },
        });
      } else {
        previousVoteType = existingVote.voteType;

        // If the user has already voted and is trying to vote the same way, then remove the vote
        if (existingVote.voteType === voteType) {
          voteAction = "remove";
          await tx.hazardVote.delete({
            where: { id: existingVote.id },
          });

          // Decrement the appropriate count in Hazard and adjust expiration time
          const currentHazard = await tx.hazard.findUnique({
            where: { id: hazardId },
            select: { expiresAt: true, reportedById: true },
          });

          let newExpiresAt = currentHazard?.expiresAt;
          // Only adjust expiration time if it's not a self-vote
          if (newExpiresAt && currentHazard?.reportedById !== userId) {
            // Reverse the time adjustment when removing vote
            const adjustmentMs = voteType === "upvote" ? -60 * 1000 : 30 * 1000;
            newExpiresAt = adjustExpirationTime(newExpiresAt, adjustmentMs);
          }

          updatedHazard = await tx.hazard.update({
            where: { id: hazardId },
            include: buildHazardInclude(),
            data: {
              upvoteCount: {
                decrement: voteType === "upvote" ? 1 : 0,
              },
              downvoteCount: {
                decrement: voteType === "downvote" ? 1 : 0,
              },
              ...(newExpiresAt && { expiresAt: newExpiresAt }),
            },
          });
        } else {
          voteAction = "change";
          // If the user is changing their vote, update the existing vote
          await tx.hazardVote.update({
            where: { id: existingVote.id },
            data: { voteType: voteType as HazardVoteType },
          });

          // Update the counts in Hazard accordingly and adjust expiration time
          const currentHazard = await tx.hazard.findUnique({
            where: { id: hazardId },
            select: { expiresAt: true, reportedById: true },
          });

          let newExpiresAt = currentHazard?.expiresAt;
          // Only adjust expiration time if it's not a self-vote
          if (newExpiresAt && currentHazard?.reportedById !== userId) {
            // When changing vote, we need to reverse the previous vote effect and apply the new one
            let adjustmentMs = 0;
            if (voteType === "upvote" && previousVoteType === "downvote") {
              // Changing from downvote to upvote: reverse -30s and add +60s = +90s total
              adjustmentMs = 90 * 1000;
            } else if (
              voteType === "downvote" &&
              previousVoteType === "upvote"
            ) {
              // Changing from upvote to downvote: reverse +60s and add -30s = -90s total
              adjustmentMs = -90 * 1000;
            }
            newExpiresAt = adjustExpirationTime(newExpiresAt, adjustmentMs);
          }

          updatedHazard = await tx.hazard.update({
            where: { id: hazardId },
            include: buildHazardInclude(),
            data: {
              upvoteCount: {
                increment: voteType === "upvote" ? 1 : -1,
              },
              downvoteCount: {
                increment: voteType === "downvote" ? 1 : -1,
              },
              ...(newExpiresAt && { expiresAt: newExpiresAt }),
            },
          });
        }
      }

      return { updatedHazard, voteAction, previousVoteType };
    });

    await invalidateHazardCaches(hazardId);

    if (result.updatedHazard) {
      // Award XP points for engagement changes (simple approach)
      try {
        const reporterId = result.updatedHazard.reportedById;

        // Only award engagement XP for accepted hazards with a reporter and not self-voting
        if (
          reporterId &&
          userId !== reporterId &&
          result.updatedHazard.reviewStatus === HazardReviewStatus.accepted
        ) {
          let pointChange = 0;

          if (result.voteAction === "new") {
            // New vote - award points based on vote type
            pointChange = voteType === "upvote" ? 2 : -1;
          } else if (result.voteAction === "remove") {
            // Removing vote - subtract points
            pointChange = voteType === "upvote" ? -2 : 1;
          } else if (result.voteAction === "change") {
            // Changing vote - apply difference
            pointChange = voteType === "upvote" ? 3 : -3; // Going from -1 to +2 or +2 to -1
          }

          if (pointChange !== 0) {
            // Simply increment/decrement the user's XP points and get upvotes count
            const updatedUser = await prisma.user.update({
              where: { id: reporterId },
              data: {
                xpPoints: {
                  increment: pointChange,
                },
              },
            });

            // Calculate upvotes received count by counting votes on user's hazards
            const upvotesReceived = await prisma.hazardVote.count({
              where: {
                voteType: HazardVoteType.upvote,
                hazard: {
                  reportedById: reporterId,
                },
              },
            });

            // Send updated XP and reliability score to the user via socket
            sendSocketEventToUsers({
              userIds: [reporterId],
              event: SocketEvent.updateUserXp,
              data: {
                userId: updatedUser.id,
                xpPoints: updatedUser.xpPoints,
                reliabilityScore: updatedUser.reliabilityScore,
              },
            });

            // Send updated upvotes received count to the user via socket
            sendSocketEventToUsers({
              userIds: [reporterId],
              event: SocketEvent.updateUserUpvotesReceivedCount,
              data: {
                userId: updatedUser.id,
                upvotesReceivedCount: upvotesReceived,
              },
            });
          }
        }
      } catch (error) {
        console.error("Error updating engagement XP:", error);
        // Don't fail the entire request if XP calculation fails
      }

      // Recalculate confidence score after vote change
      try {
        await recalculateHazardConfidenceScore(hazardId);
      } catch (error) {
        console.error(
          "Error recalculating confidence score after vote:",
          error,
        );
        // Don't fail the request if confidence score calculation fails
      }

      // Send socket event about updated hazard to subscribers
      sendSocketEventAboutHazardToSubscribers({
        hazard: result.updatedHazard,
        socketEvent: SocketEvent.updateHazard,
      });
    }

    res.status(200).json({ message: "Vote recorded successfully" });
  } catch (error) {
    next(error);
  }
};

export const viewHazard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { userId } = res;

    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }
    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }

    // Check if the hazard exists
    const hazard = await prisma.hazard.findUnique({
      where: { id },
      select: { id: true, reportedById: true },
    });
    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    // Skip if the user is the reporter of the hazard
    if (hazard.reportedById === userId) {
      return res.status(200).json({
        message: "Skipping view of your own hazard",
        isViewRecorded: false,
      });
    }

    // Check if already viewed
    const existingView = await prisma.hazardView.findUnique({
      where: {
        hazardId_userId: {
          hazardId: hazard.id,
          userId: userId,
        },
      },
      select: { id: true },
    });

    // Skip if already viewed
    if (existingView) {
      return res.status(200).json({
        message: "Skipping view of already viewed hazard",
        isViewRecorded: false,
      });
    }

    // Record the view finally
    await prisma.hazardView.create({
      data: {
        hazardId: hazard.id,
        userId: userId,
        viewedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Hazard view recorded successfully",
      isViewRecorded: true,
    });
  } catch (error) {
    next(error);
  }
};
