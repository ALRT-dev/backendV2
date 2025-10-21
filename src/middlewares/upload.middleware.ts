import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { validateMediaFile } from "../services/s3.service.js";

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
