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
  folder: string,
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
  } catch (error: unknown) {
    console.error("Error uploading file to S3:", error);
    const code = (error as { Code?: string })?.Code;
    const message =
      code === "NoSuchBucket"
        ? "S3 bucket does not exist. Create the bucket in AWS or check AWS_S3_BUCKET_NAME in your environment."
        : "Failed to upload file to S3";
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }
};

/**
 * Upload multiple files to S3
 */
export const uploadMultipleFilesToS3 = async (
  files: Express.Multer.File[],
  folder: string,
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
  keys: string[],
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
        part.includes(BUCKET_NAME),
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
  expiresIn: number = 3600, // 1 hour default
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
  expiresIn: number = 3600,
): Promise<Record<string, string>> => {
  try {
    const urlPromises = keys.map(async (key) => {
      const url = await generatePresignedUrl(key, expiresIn);
      return { key, url };
    });

    const results = await Promise.all(urlPromises);

    // Convert array to object for easy lookup
    return results.reduce(
      (acc, { key, url }) => {
        acc[key] = url;
        return acc;
      },
      {} as Record<string, string>,
    );
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
type CategoryWithImagesForHazard = {
  images?: { s3Key: string }[];
  parent?: { images?: { s3Key: string }[] } | null;
};

function collectCategoryImageS3Keys(
  category: CategoryWithImagesForHazard | null | undefined,
  keys: string[],
) {
  if (!category) return;
  for (const img of category.images ?? []) keys.push(img.s3Key);
  for (const img of category.parent?.images ?? []) keys.push(img.s3Key);
}

export const enrichHazardsWithPresignedUrls = async <
  T extends Hazard & { medias?: HazardMedia[]; category?: unknown },
>(
  hazards: T[],
  expiresIn: number = 3600, // 1 hour default
): Promise<T[]> => {
  try {
    const s3Keys: string[] = [];
    hazards.forEach((hazard) => {
      if (hazard.medias) {
        hazard.medias.forEach((media) => {
          if (media.s3Key) {
            s3Keys.push(media.s3Key);
          }
        });
      }
      collectCategoryImageS3Keys(
        hazard.category as CategoryWithImagesForHazard | null | undefined,
        s3Keys,
      );
    });

    const uniqueKeys = [...new Set(s3Keys)];
    if (uniqueKeys.length === 0) {
      return hazards;
    }

    const presignedUrls = await generateMultiplePresignedUrls(
      uniqueKeys,
      expiresIn,
    );

    return hazards.map((hazard) => {
      const cat = hazard.category as
        | CategoryWithImagesForHazard
        | null
        | undefined;
      let next: Record<string, unknown> = { ...hazard };

      if (hazard.medias?.length) {
        next.medias = hazard.medias.map((media) => ({
          ...media,
          presignedUrl: media.s3Key ? presignedUrls[media.s3Key] : undefined,
        }));
      }

      if (cat) {
        next.category = {
          ...cat,
          images: cat.images?.map((img) => ({
            ...img,
            presignedUrl: presignedUrls[img.s3Key],
          })),
          parent:
            cat.parent === null
              ? null
              : cat.parent
                ? {
                    ...cat.parent,
                    images: cat.parent.images?.map((img) => ({
                      ...img,
                      presignedUrl: presignedUrls[img.s3Key],
                    })),
                  }
                : undefined,
        };
      }

      return next as T;
    });
  } catch (error) {
    console.error("Error enriching hazards with presigned URLs:", error);
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
  T extends Hazard & { medias?: HazardMedia[] },
>(
  hazard: T,
  expiresIn: number = 3600, // 1 hour default
): Promise<T> => {
  const enrichedHazards = await enrichHazardsWithPresignedUrls(
    [hazard],
    expiresIn,
  );
  return enrichedHazards[0]!; // We know it exists since we passed exactly one hazard
};

type CategoryWithImagesLike = {
  images?: { s3Key: string; [k: string]: unknown }[];
  subCategories?: CategoryWithImagesLike[];
  /** Parent category (e.g. Prisma include parent: { include: { images: true } }) */
  parent?: CategoryWithImagesLike | null;
};

/**
 * Enriches category images with presigned URLs (generated from s3Key).
 * Walks each category's `images`, nested `subCategories`, and `parent` (and parent's chain).
 * @param categories - Categories that may include subCategories and/or parent with images
 * @param expiresIn - Presigned URL expiry in seconds (default: 1 hour)
 */
export const enrichCategoryImagesWithPresignedUrls = async <T>(
  categories: T[],
  expiresIn: number = 3600,
): Promise<T[]> => {
  try {
    const keys: string[] = [];
    function collectKeys(cats: CategoryWithImagesLike[]) {
      for (const c of cats) {
        if (c.images) for (const img of c.images) keys.push(img.s3Key);
        if (c.subCategories?.length) collectKeys(c.subCategories);
        if (c.parent) collectKeys([c.parent]);
      }
    }
    collectKeys(categories as CategoryWithImagesLike[]);
    if (keys.length === 0) return categories;
    const urlMap = await generateMultiplePresignedUrls(keys, expiresIn);
    function enrich(cats: CategoryWithImagesLike[]): CategoryWithImagesLike[] {
      return cats.map((c) => {
        const out: CategoryWithImagesLike = { ...c };
        if (c.images?.length) {
          out.images = c.images.map((img) => ({
            ...img,
            presignedUrl: urlMap[img.s3Key],
          }));
        }
        if (c.subCategories?.length) {
          out.subCategories = enrich(c.subCategories);
        }
        if (c.parent) {
          out.parent = enrich([c.parent])[0] ?? null;
        }
        return out;
      });
    }
    return enrich(categories as CategoryWithImagesLike[]) as T[];
  } catch (error) {
    console.error(
      "Error enriching category images with presigned URLs:",
      error,
    );
    return categories;
  }
};
