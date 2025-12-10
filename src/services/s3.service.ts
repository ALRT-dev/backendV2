import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import s3Client from "../utils/s3_client.util.js";
import type { MediaUploadResult } from "../models/media_upload_result_interface.js";
import { config } from "../utils/config.js";
import type { Hazard, HazardMedia } from "@prisma/client";

const BUCKET_NAME = config.aws.s3BucketName;
const CLOUDFRONT_DOMAIN = config.aws.cloudfrontDomain;

/**
 * Upload a file to S3 and return the public URL
 */
export const uploadFileToS3 = async (
  file: Express.Multer.File,
  folder: string
): Promise<MediaUploadResult> => {
  try {
    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${fileName}`;

    // Upload file to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: "inline",
      // Set cache control for better performance
      CacheControl: "max-age=31536000", // 1 year
    });

    await s3Client.send(command);

    // Generate public URL
    const url =
      CLOUDFRONT_DOMAIN.length > 0
        ? `https://${CLOUDFRONT_DOMAIN}/${key}`
        : `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${key}`;

    return {
      key,
      url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw new Error("Failed to upload file to S3");
  }
};

/**
 * Upload multiple files to S3
 */
export const uploadMultipleFilesToS3 = async (
  files: Express.Multer.File[],
  folder: string
): Promise<MediaUploadResult[]> => {
  try {
    const uploadPromises = files.map((file) => uploadFileToS3(file, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error uploading multiple files to S3:", error);
    throw new Error("Failed to upload files to S3");
  }
};

/**
 * Delete a file from S3
 */
export const deleteFileFromS3 = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw new Error("Failed to delete file from S3");
  }
};

/**
 * Delete multiple files from S3
 */
export const deleteMultipleFilesFromS3 = async (
  keys: string[]
): Promise<void> => {
  try {
    const deletePromises = keys.map((key) => deleteFileFromS3(key));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting multiple files from S3:", error);
    throw new Error("Failed to delete files from S3");
  }
};

/**
 * Validate file type for hazard media
 */
export const validateMediaFile = (file: Express.Multer.File): boolean => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",

    // Videos
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo", // .avi
    "video/webm",
  ];

  return allowedMimeTypes.includes(file.mimetype);
};

/**
 * Extract S3 key from URL
 */
export const extractS3KeyFromUrl = (url: string): string | null => {
  try {
    if (CLOUDFRONT_DOMAIN.length > 0 && url.includes(CLOUDFRONT_DOMAIN)) {
      const splitResult = url.split(`https://${CLOUDFRONT_DOMAIN}/`)[1];
      return splitResult || null;
    }

    if (url.includes(BUCKET_NAME)) {
      const urlParts = url.split("/");
      const bucketIndex = urlParts.findIndex((part) =>
        part.includes(BUCKET_NAME)
      );
      if (bucketIndex >= 0) {
        return urlParts.slice(bucketIndex + 1).join("/");
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting S3 key from URL:", error);
    return null;
  }
};

/**
 * Generate a presigned URL for downloading/viewing a file from S3
 * @param key - The S3 object key
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Promise<string> - The presigned URL
 */
export const generatePresignedUrl = async (
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error("Failed to generate presigned URL");
  }
};

/**
 * Generate presigned URLs for multiple S3 keys
 * @param keys - Array of S3 object keys
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Promise<Record<string, string>> - Object mapping keys to presigned URLs
 */
export const generateMultiplePresignedUrls = async (
  keys: string[],
  expiresIn: number = 3600
): Promise<Record<string, string>> => {
  try {
    const urlPromises = keys.map(async (key) => {
      const url = await generatePresignedUrl(key, expiresIn);
      return { key, url };
    });

    const results = await Promise.all(urlPromises);

    // Convert array to object for easy lookup
    return results.reduce((acc, { key, url }) => {
      acc[key] = url;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    console.error("Error generating multiple presigned URLs:", error);
    throw new Error("Failed to generate presigned URLs");
  }
};

/**
 * Enriches hazard media with presigned URLs for frontend access
 * @param hazards - Array of hazards with media
 * @param expiresIn - Expiration time for presigned URLs in seconds (default: 1 hour)
 * @returns Hazards with presigned URLs added to media
 */
export const enrichHazardsWithPresignedUrls = async <
  T extends Hazard & { medias?: HazardMedia[] }
>(
  hazards: T[],
  expiresIn: number = 3600 // 1 hour default
): Promise<T[]> => {
  try {
    // Collect all S3 keys from all hazards
    const s3Keys: string[] = [];
    hazards.forEach((hazard) => {
      if (hazard.medias) {
        hazard.medias.forEach((media) => {
          if (media.s3Key) {
            s3Keys.push(media.s3Key);
          }
        });
      }
    });

    // If no media files, return hazards as-is
    if (s3Keys.length === 0) {
      return hazards;
    }

    // Generate presigned URLs for all keys
    const presignedUrls = await generateMultiplePresignedUrls(
      s3Keys,
      expiresIn
    );

    // Enrich hazards with presigned URLs
    const enrichedHazards = hazards.map((hazard) => {
      if (!hazard.medias || hazard.medias.length === 0) {
        return hazard;
      }

      const enrichedMedias = hazard.medias.map((media) => ({
        ...media,
        // Add presigned URL while keeping the original URL for reference
        presignedUrl: media.s3Key ? presignedUrls[media.s3Key] : undefined,
      }));

      return {
        ...hazard,
        medias: enrichedMedias,
      };
    });

    return enrichedHazards;
  } catch (error) {
    console.error("Error enriching hazards with presigned URLs:", error);
    // Return original hazards if presigned URL generation fails
    return hazards;
  }
};

/**
 * Enriches a single hazard with presigned URLs for frontend access
 * @param hazard - Single hazard with media
 * @param expiresIn - Expiration time for presigned URLs in seconds (default: 1 hour)
 * @returns Hazard with presigned URLs added to media
 */
export const enrichHazardWithPresignedUrls = async <
  T extends Hazard & { medias?: HazardMedia[] }
>(
  hazard: T,
  expiresIn: number = 3600 // 1 hour default
): Promise<T> => {
  const enrichedHazards = await enrichHazardsWithPresignedUrls(
    [hazard],
    expiresIn
  );
  return enrichedHazards[0]!; // We know it exists since we passed exactly one hazard
};
