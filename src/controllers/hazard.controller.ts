import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import {
  HazardReviewStatus,
  HazardSeverity,
  HazardVoteType,
  MediaType,
  type Hazard,
} from "@prisma/client";
import {
  getHazardsApplyingFiltersRaw,
  reviewHazard,
} from "../services/hazard.service.js";
import { getCategoriesApplyingFilters } from "../services/hazard_category.service.js";
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
import { awardXpPointsForHazard } from "../services/xpPoints.service.js";
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
import { getSeveritiesApplyingFilters } from "../services/hazard_severity.service.js";

/// Controller to handle fetching hazards with optional filters and pagination.
export const getHazards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      searchString,
      categoryIds,
      severities,
      reportedById,
      reviewStatus,
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

    const hazards = await getHazardsApplyingFiltersRaw({
      searchString,
      reportedById,
      reviewStatus,
      categoryIds,
      severities,
      userId,
      showExpired: parseBoolean(showExpired),
      userLat,
      userLng,
      sortSettings,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    // Enrich hazards with presigned URLs for media access
    const hazardsWithPresignedUrls = await enrichHazardsWithPresignedUrls(
      hazards
    );

    res.status(200).json(hazardsWithPresignedUrls);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle fetching hazards along with their categories, applying various filters.
export const getHazardsWithCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      searchString,
      categoryIds,
      severities,
      reportedById,
      reviewStatus,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
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

    const subscriptionPromise = prisma.locationSubscription.findFirst({
      where: {
        northeastLat: Number(northeastLat),
        northeastLng: Number(northeastLng),
        southwestLat: Number(southwestLat),
        southwestLng: Number(southwestLng),
        userId: userId!,
      },
      select: { id: true },
    });

    const categoriesPromise = getCategoriesApplyingFilters({
      hazardSearchString: searchString,
      hazardSeverities: severities,
      hazardReviewStatus: reviewStatus,
      hazardReportedById: reportedById,
      hazardNortheastLat: Number(northeastLat),
      hazardNortheastLng: Number(northeastLng),
      hazardSouthwestLat: Number(southwestLat),
      hazardSouthwestLng: Number(southwestLng),
      showExpiredHazards: parseBoolean(showExpired),
    });

    const severitiesPromise = getSeveritiesApplyingFilters({
      hazardSearchString: searchString,
      hazardCategoryIds: categoryIds,
      hazardReviewStatus: reviewStatus,
      hazardReportedById: reportedById,
      hazardNortheastLat: Number(northeastLat),
      hazardNortheastLng: Number(northeastLng),
      hazardSouthwestLat: Number(southwestLat),
      hazardSouthwestLng: Number(southwestLng),
      showExpiredHazards: parseBoolean(showExpired),
    });

    const hazardsPromise = getHazardsApplyingFiltersRaw({
      searchString,
      categoryIds,
      severities,
      reviewStatus,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
      userId,
      userLat,
      userLng,
      showExpired: parseBoolean(showExpired),
      sortSettings,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    const [subscription, categoryFilters, severityFilters, hazards] =
      await Promise.all([
        subscriptionPromise,
        categoriesPromise,
        severitiesPromise,
        hazardsPromise,
      ]);

    const subscriptionId = subscription?.id;

    // If no hazards found, return empty categories and hazards
    if (hazards.length === 0) {
      return res.status(200).json({
        subscriptionId,
        categoryFilters: [],
        severityFilters: [],
        hazards: [],
      });
    }

    // Enrich hazards with presigned URLs for media access
    const hazardsWithPresignedUrls = await enrichHazardsWithPresignedUrls(
      hazards
    );

    res.status(200).json({
      subscriptionId,
      categoryFilters,
      severityFilters,
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
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }

    const hazard = await prisma.hazard.findUnique({
      where: { id },
      include: buildHazardInclude(),
    });

    if (!hazard) {
      return res.status(404).json({ message: "Hazard not found" });
    }

    // Enrich hazard with presigned URLs for media access
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
  next: NextFunction
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

    // Validate that category exists
    const category = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new HttpError(400, "Invalid Category ID");
    }

    console.log("File upload - req.files:", req.files);

    // Upload media files to S3 if provided <----------------------------------------------------------------------------------
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    let mediaUploadResults: MediaUploadResult[] = [];

    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        mediaUploadResults = await uploadMultipleFilesToS3(
          uploadedFiles,
          "hazards"
        );
        console.log(
          `Successfully uploaded ${mediaUploadResults.length} media files to S3`
        );
      } catch (error) {
        console.error("Error uploading media files:", error);
        throw new HttpError(
          500,
          "Failed to upload media files. Please try again."
        );
      }
    }

    // Perform AI review of the hazard report <----------------------------------------------------------------------------------
    let review: any;
    try {
      review = await reviewHazard({
        title,
        description,
        latitude,
        longitude,
        locationName,
        occurredAt: occurredAt || new Date(),
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

    const {
      reviewStatus,
      reviewFeedback,
      title: suggestedTitle,
      shortDescription,
      summary: aiSummary,
      confidence: aiConfidence,
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
          title: suggestedTitle || title,
          description,
          reviewStatus,
          reviewFeedback,
          ...(reviewStatus === HazardReviewStatus.accepted && {
            reviewedAt: new Date(),
          }),
          shortDescription,
          aiSummary,
          ...(aiConfidence && { aiConfidence }),
          categoryId,
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
            cleanupError
          );
        }
      }
      throw new HttpError(500, "Failed to create hazard");
    }

    const hazard = await enrichHazardWithPresignedUrls(result);

    // Award XP points to the user based on AI review <----------------------------------------------------------------------------
    let xpResult = null;
    if (userId && hazard.reviewStatus !== HazardReviewStatus.pending) {
      try {
        xpResult = await awardXpPointsForHazard(userId, hazard.id, {
          confidence: hazard.aiConfidence || ("medium" as any),
          severity: hazard.severity,
          reviewStatus: hazard.reviewStatus,
        });
      } catch (error) {
        console.error("Error awarding XP points:", error);
        // Don't fail the entire request if XP calculation fails
      }
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
    }

    // Now also send a notification to the user who reported the hazard
    if (reviewStatus === HazardReviewStatus.accepted) {
      const xpMessage = xpResult
        ? ` You earned ${xpResult.pointsAwarded} XP points!`
        : "";
      sendPushNotificationToUser({
        userId: userId!,
        title: "Alrt Reported Successfully",
        body: `Your alrt "${hazard.title}" has been reported successfully.${xpMessage}`,
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
        title: "Invalid Alrt Report",
        body: `Our review found your alrt report to be invalid. ${reviewFeedback}${xpMessage}`,
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
  next: NextFunction
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

    // Upload new media files to S3 if provided <----------------------------------------------------------------------------------
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    let mediaUploadResults: MediaUploadResult[] = [];

    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        mediaUploadResults = await uploadMultipleFilesToS3(
          uploadedFiles,
          "hazards"
        );
        console.log(
          `Successfully uploaded ${mediaUploadResults.length} new media files to S3`
        );
      } catch (error) {
        console.error("Error uploading new media files:", error);
        throw new HttpError(
          500,
          "Failed to upload media files. Please try again."
        );
      }
    }

    // Perform AI review of the hazard report <----------------------------------------------------------------------------------
    let review: any;
    try {
      review = await reviewHazard({
        title: title || existingHazard.title,
        description: description || existingHazard.description,
        latitude: latitude || existingHazard.latitude!,
        longitude: longitude || existingHazard.longitude!,
        locationName: locationName || existingHazard.locationName,
        occurredAt: occurredAt || existingHazard.occurredAt || new Date(),
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

    const {
      reviewStatus,
      reviewFeedback,
      title: suggestedTitle,
      shortDescription,
      summary: aiSummary,
      confidence: aiConfidence,
    } = review;

    const date = new Date();

    // Update hazard with new media in a transaction <----------------------------------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {
      // Update the hazard
      const updatedHazard = await tx.hazard.update({
        where: { id },
        data: {
          title: suggestedTitle || title || existingHazard.title,
          ...(description && { description }),
          reviewStatus,
          reviewFeedback,
          ...(reviewStatus === HazardReviewStatus.accepted && {
            reviewedAt: new Date(),
          }),
          shortDescription,
          aiSummary,
          ...(aiConfidence && { aiConfidence }),
          ...(categoryId && { categoryId }),
          ...(latitude && { latitude }),
          ...(longitude && { longitude }),
          ...(locationName && { locationName }),
          ...(occurredAt && { occurredAt: new Date(occurredAt) }),
          ...(reviewStatus === HazardReviewStatus.accepted && {
            expiresAt:
              existingHazard.expiresAt ||
              new Date(date.setMinutes(date.getMinutes() + 30)), // Default expiry to 30 minutes from now
          }),
        },
      });

      // Add new media records if there are uploaded files
      if (mediaUploadResults.length > 0) {
        // If this is the first media being added, mark it as primary
        const hasPrimaryMedia = existingHazard.medias?.some(
          (media) => media.isPrimary
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
          removedMediaIds.includes(media.id)
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
              cleanupError
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
            cleanupError
          );
        }
      }
      throw new HttpError(500, "Failed to update hazard");
    }

    const updatedHazard = await enrichHazardWithPresignedUrls(result);

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
  next: NextFunction
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
          `Successfully deleted ${s3KeysToDelete.length} media files from S3`
        );
      } catch (s3Error) {
        console.error("Error deleting media files from S3:", s3Error);
        // Don't fail the entire request if S3 cleanup fails
        // The hazard is already deleted from the database
      }
    }

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
  next: NextFunction
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

    // New upvote: +2 XP to reporter
    // New downvote: -1 XP to reporter
    // Remove upvote: -2 XP to reporter
    // Remove downvote: +1 XP to reporter
    // Change upvote→downvote: -3 XP to reporter (lost +2, gained -1)
    // Change downvote→upvote: +3 XP to reporter (lost -1, gained +2)
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
          error
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
  next: NextFunction
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

/// Controller to handle populating the database with sample hazards and categories.
export const populateHazards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // First, ensure hazard categories exist
    const categories = [
      { name: "Safety & Security", emoji: "🔒" },
      { name: "Traffic & Transport", emoji: "🚗" },
      { name: "Weather & Environment", emoji: "🌧️" },
      { name: "Health & Emergency", emoji: "🚑" },
      { name: "Infrastructure & Services", emoji: "🏗️" },
    ];

    const createdCategories = [];
    for (const category of categories) {
      const existingCategory = await prisma.hazardCategory.findFirst({
        where: { name: category.name },
      });

      if (!existingCategory) {
        const newCategory = await prisma.hazardCategory.create({
          data: category,
        });
        createdCategories.push(newCategory);
      } else {
        createdCategories.push(existingCategory);
      }
    }

    // Sample hazard data based on your requirements
    const sampleHazards = [
      {
        title: "Landslide in Kathmandu",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "A massive landslide has occurred in Kathmandu.",
        latitude: 27.7172,
        longitude: 85.324,
        createdAt: new Date("2025-10-01T10:00:00Z"),
      },
      {
        title: "Flood in Chitwan",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description: "Severe flooding reported in Chitwan area.",
        latitude: 27.5291,
        longitude: 84.3542,
        createdAt: new Date("2025-09-30T12:30:00Z"),
      },
      {
        title: "Earthquake near Pokhara",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "A 5.6 magnitude earthquake struck near Pokhara.",
        latitude: 28.2096,
        longitude: 83.9856,
        createdAt: new Date("2025-09-28T14:15:00Z"),
      },
      {
        title: "Wildfire in Bardiya",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "Wildfire spreading rapidly in Bardiya National Park.",
        latitude: 28.356,
        longitude: 81.491,
        createdAt: new Date("2024-03-04T16:45:00Z"),
      },
      {
        title: "Tornado in Biratnagar",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "A tornado has caused damage in Biratnagar region.",
        latitude: 26.4525,
        longitude: 87.2718,
        createdAt: new Date("2023-10-05T18:00:00Z"),
      },
      {
        title: "Flood near Bagmati River",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description:
          "The Bagmati River overflowed due to heavy rainfall, causing localized flooding.",
        latitude: 27.6931,
        longitude: 85.3145,
        createdAt: new Date("2025-10-01T11:00:00Z"),
      },
      {
        title: "Earthquake tremor felt in Thamel",
        categoryName: "Weather & Environment",
        severity: "advice",
        description: "Mild earthquake tremor shook buildings in Thamel area.",
        latitude: 27.7154,
        longitude: 85.3123,
        createdAt: new Date("2025-10-01T11:30:00Z"),
      },
      {
        title: "Wildfire in Shivapuri forest",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description:
          "A wildfire has broken out in the Shivapuri National Park forest area.",
        latitude: 27.8333,
        longitude: 85.3667,
        createdAt: new Date("2025-10-01T12:00:00Z"),
      },
      {
        title: "Building collapse in Baneshwor",
        categoryName: "Infrastructure & Services",
        severity: "emergency",
        description:
          "A residential building collapsed due to weak structure and recent tremors.",
        latitude: 27.7033,
        longitude: 85.3333,
        createdAt: new Date("2025-10-01T12:30:00Z"),
      },
      {
        title: "Tornado spotted in Bhaktapur outskirts",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description:
          "A small tornado was spotted on the outskirts near Bhaktapur, affecting nearby houses.",
        latitude: 27.671,
        longitude: 85.4298,
        createdAt: new Date("2025-10-01T13:00:00Z"),
      },
      {
        title: "Flooded streets in Patan",
        categoryName: "Weather & Environment",
        severity: "advice",
        description:
          "Monsoon rains caused waterlogging in Patan Durbar Square area.",
        latitude: 27.6722,
        longitude: 85.324,
        createdAt: new Date("2025-10-01T13:30:00Z"),
      },
      {
        title: "Gas leak in Baneshwor",
        categoryName: "Health & Emergency",
        severity: "emergency",
        description:
          "A gas leak was reported in a small factory near Baneshwor.",
        latitude: 27.703,
        longitude: 85.3345,
        createdAt: new Date("2025-10-01T14:00:00Z"),
      },
      {
        title: "Fire outbreak in Kalimati market",
        categoryName: "Health & Emergency",
        severity: "emergency",
        description:
          "A fire broke out in the crowded Kalimati vegetable market.",
        latitude: 27.6915,
        longitude: 85.301,
        createdAt: new Date("2025-10-01T14:30:00Z"),
      },
      {
        title: "Power outage in Bhaktapur",
        categoryName: "Infrastructure & Services",
        severity: "info",
        description:
          "Large parts of Bhaktapur experienced blackout due to storm.",
        latitude: 27.671,
        longitude: 85.4298,
        createdAt: new Date("2025-10-01T15:00:00Z"),
      },
      {
        title: "Structural damage at Dharahara",
        categoryName: "Infrastructure & Services",
        severity: "watchAndAct",
        description: "Cracks appeared in Dharahara tower after recent tremors.",
        latitude: 27.7039,
        longitude: 85.3157,
        createdAt: new Date("2025-10-01T15:15:00Z"),
      },
      {
        title: "Earthquake tremors in Lalitpur",
        categoryName: "Weather & Environment",
        severity: "advice",
        description: "People rushed out of their homes after mild tremors.",
        latitude: 27.6588,
        longitude: 85.3247,
        createdAt: new Date("2025-10-01T15:30:00Z"),
      },
      {
        title: "Heavy rainfall in Kirtipur",
        categoryName: "Weather & Environment",
        severity: "advice",
        description: "Continuous rainfall flooded low-lying roads in Kirtipur.",
        latitude: 27.6675,
        longitude: 85.278,
        createdAt: new Date("2025-10-01T16:00:00Z"),
      },
      {
        title: "Small landslide in Sundarijal",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description:
          "Road blocked due to small landslide near Sundarijal hiking trail.",
        latitude: 27.7892,
        longitude: 85.4253,
        createdAt: new Date("2025-10-01T16:30:00Z"),
      },
      {
        title: "Bridge collapse in Gorkha",
        categoryName: "Infrastructure & Services",
        severity: "emergency",
        description: "A suspension bridge collapsed due to rust and overuse.",
        latitude: 28.0135,
        longitude: 84.6339,
        createdAt: new Date("2025-10-01T17:00:00Z"),
      },
      {
        title: "Robbery reported in New Road",
        categoryName: "Safety & Security",
        severity: "info",
        description: "Two individuals reported being robbed at New Road.",
        latitude: 27.7045,
        longitude: 85.3073,
        createdAt: new Date("2025-10-01T17:30:00Z"),
      },
    ];

    // Clear existing hazards (optional - remove this if you want to keep existing data)
    await prisma.hazard.deleteMany({});

    // Create hazards
    const createdHazards = [];
    for (const hazardData of sampleHazards) {
      const category = createdCategories.find(
        (cat) => cat.name === hazardData.categoryName
      );
      if (!category) {
        console.warn(`Category not found for: ${hazardData.categoryName}`);
        continue;
      }

      const hazard = await prisma.hazard.create({
        data: {
          title: hazardData.title,
          description: hazardData.description,
          categoryId: category.id,
          latitude: hazardData.latitude,
          longitude: hazardData.longitude,
          severity: hazardData.severity as HazardSeverity,
        },
        include: buildHazardInclude(),
      });

      // Update the createdAt timestamp to match the sample data
      await prisma.hazard.update({
        where: { id: hazard.id },
        data: { createdAt: hazardData.createdAt },
      });

      createdHazards.push(hazard);
    }

    res.status(201).json({
      message: `Successfully populated ${createdHazards.length} hazards with ${createdCategories.length} categories`,
      hazards: createdHazards,
      categories: createdCategories,
    });
  } catch (error) {
    next(error);
  }
};
