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
  next: NextFunction,
) => {
  try {
    const body = req.body as Record<string, unknown>;
    const parseImageDimensions = (input: unknown) => {
      if (typeof input !== "string" || !input) return undefined;
      try {
        return JSON.parse(input);
      } catch {
        throw new HttpError(
          400,
          "Invalid JSON in form field 'imageDimensions'",
        );
      }
    };

    if (typeof body.data === "string") {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(body.data) as Record<string, unknown>;
      } catch {
        throw new HttpError(400, "Invalid JSON in form field 'data'");
      }
      const parsedImageDimensions = parseImageDimensions(body.imageDimensions);
      if (parsedImageDimensions !== undefined) {
        parsed.imageDimensions = parsedImageDimensions;
      }
      req.body = parsed;
    } else {
      const parsedImageDimensions = parseImageDimensions(body.imageDimensions);
      if (parsedImageDimensions !== undefined) {
        req.body = {
          ...body,
          imageDimensions: parsedImageDimensions,
        };
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};
