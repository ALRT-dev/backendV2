import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";

/**
 * Normalizes multipart body for category create/update.
 * When form field "data" is present (JSON string), parses it into req.body.
 * When form field "imageDimensions" is present (JSON string), parses and adds to req.body.
 * Use after optional category images multer so that validate() receives the same shape as JSON.
 */
export const normalizeCategoryMultipartBody = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.data === "string") {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(body.data) as Record<string, unknown>;
      } catch {
        throw new HttpError(400, "Invalid JSON in form field 'data'");
      }
      if (typeof body.imageDimensions === "string" && body.imageDimensions) {
        try {
          parsed.imageDimensions = JSON.parse(body.imageDimensions);
        } catch {
          throw new HttpError(
            400,
            "Invalid JSON in form field 'imageDimensions'"
          );
        }
      }
      req.body = parsed;
    }
    next();
  } catch (error) {
    next(error);
  }
};
