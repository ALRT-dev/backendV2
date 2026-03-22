import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { validateMediaFile } from "../services/s3.service.js";
import { CATEGORY_IMAGE_UPLOAD_FIELDS } from "../constants/category_image.constants.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function to validate uploaded files
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  try {
    if (validateMediaFile(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type or size. Only images and videos under 50MB are allowed."
        )
      );
    }
  } catch (error) {
    cb(new Error("Error validating file"));
  }
};

// Configure multer with file size limits and file filter
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10, // Maximum 10 files per request
  },
});

// Middleware for single file upload
export const uploadSingle = upload.single("mediaFile");

// Middleware for profile picture upload
export const uploadProfilePicture = upload.single("profilePictureFile");

// Middleware for multiple file upload
export const uploadMultiple = upload.array("mediaFiles", 10);

// File filter for support attachments (images only)
const supportAttachmentFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG and PNG images are allowed."));
  }
};

// Configure multer for support attachments
const supportAttachmentUpload = multer({
  storage,
  fileFilter: supportAttachmentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5, // Maximum 5 files per request
  },
});

// Middleware for support attachment upload (multiple images)
export const uploadSupportAttachments = supportAttachmentUpload.array(
  "attachments",
  5
);

// File filter for category images (images only, no video)
const categoryImageFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed for category images."));
  }
};

const categoryImageUpload = multer({
  storage,
  fileFilter: categoryImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 7,
  },
});

export const uploadCategoryImages = categoryImageUpload.fields(
  CATEGORY_IMAGE_UPLOAD_FIELDS
);

/**
 * Runs multer for category images only when Content-Type is multipart/form-data.
 * Use before validation so JSON create/update still works without multer.
 */
export const optionalCategoryImagesUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.is("multipart/form-data")) {
    uploadCategoryImages(req, res, (err) => {
      if (err) next(err);
      else next();
    });
  } else {
    next();
  }
};

// Error handling middleware for multer errors
export const handleMulterError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return next(
          new HttpError(400, "File size too large. Maximum size is 50MB.")
        );
      case "LIMIT_FILE_COUNT":
        return next(
          new HttpError(400, "Too many files. Maximum 10 files allowed.")
        );
      case "LIMIT_UNEXPECTED_FILE":
        return next(new HttpError(400, "Unexpected file field."));
      default:
        return next(new HttpError(400, `File upload error: ${error.message}`));
    }
  }

  if (error.message.includes("Invalid file type")) {
    return next(new HttpError(400, error.message));
  }

  next(error);
};

/** Use after optionalCategoryImagesUpload for category create/update routes (5MB limit, 7 files). */
export const handleCategoryImagesMulterError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return next(
          new HttpError(400, "Category image too large. Maximum size is 5MB.")
        );
      case "LIMIT_FILE_COUNT":
        return next(
          new HttpError(400, "Too many category images. Maximum 7 files allowed.")
        );
      case "LIMIT_UNEXPECTED_FILE":
        return next(new HttpError(400, "Unexpected file field."));
      default:
        return next(new HttpError(400, `File upload error: ${error.message}`));
    }
  }
  if (error.message?.includes("Invalid file type")) {
    return next(new HttpError(400, error.message));
  }
  next(error);
};
