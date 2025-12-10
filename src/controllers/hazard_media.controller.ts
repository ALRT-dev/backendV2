import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { deleteFileFromS3 } from "../services/s3.service.js";

/// Controller to handle deleting a specific media file from a hazard
export const deleteHazardMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { hazardId, mediaId } = req.params;
    const { userId } = res;

    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }

    if (!hazardId || !mediaId) {
      throw new HttpError(400, "Hazard ID and Media ID are required");
    }

    // Check if the hazard exists and user has permission
    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      select: { id: true, reportedById: true },
    });

    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    if (hazard.reportedById !== userId) {
      throw new HttpError(403, "Forbidden: You cannot modify this hazard");
    }

    // Find the media record
    const media = await prisma.hazardMedia.findFirst({
      where: {
        id: mediaId,
        hazardId: hazardId,
      },
    });

    if (!media) {
      throw new HttpError(404, "Media not found");
    }

    // Delete from S3 first
    if (media.s3Key) {
      try {
        await deleteFileFromS3(media.s3Key);
        console.log(`Successfully deleted media file from S3: ${media.s3Key}`);
      } catch (s3Error) {
        console.error("Error deleting file from S3:", s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await prisma.hazardMedia.delete({
      where: { id: mediaId },
    });

    // If this was the primary media, make another media primary if available
    if (media.isPrimary) {
      const remainingMedia = await prisma.hazardMedia.findFirst({
        where: { hazardId: hazardId },
        orderBy: { createdAt: "asc" },
      });

      if (remainingMedia) {
        await prisma.hazardMedia.update({
          where: { id: remainingMedia.id },
          data: { isPrimary: true },
        });
      }
    }

    res.status(200).json({ message: "Media deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/// Controller to update media metadata (e.g., set as primary)
export const updateHazardMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { hazardId, mediaId } = req.params;
    const { isPrimary } = req.body;
    const { userId } = res;

    if (!userId) {
      throw new HttpError(401, "Unauthorized");
    }

    if (!hazardId || !mediaId) {
      throw new HttpError(400, "Hazard ID and Media ID are required");
    }

    // Check if the hazard exists and user has permission
    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      select: { id: true, reportedById: true },
    });

    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    if (hazard.reportedById !== userId) {
      throw new HttpError(403, "Forbidden: You cannot modify this hazard");
    }

    // If setting as primary, remove primary status from other media
    if (isPrimary) {
      await prisma.hazardMedia.updateMany({
        where: {
          hazardId: hazardId,
          NOT: { id: mediaId },
        },
        data: { isPrimary: false },
      });
    }

    // Update the media
    const updatedMedia = await prisma.hazardMedia.update({
      where: {
        id: mediaId,
        hazardId: hazardId,
      },
      data: {
        isPrimary: Boolean(isPrimary),
      },
    });

    res.status(200).json(updatedMedia);
  } catch (error) {
    next(error);
  }
};
