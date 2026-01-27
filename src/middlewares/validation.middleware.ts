import type { Request, Response, NextFunction } from "express";
import * as zod from "zod";
import { HttpError } from "../models/http_error.js";

type ValidationTarget = "body" | "query" | "params";

export const validate =
  (schema: zod.ZodSchema, target: ValidationTarget = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      (req as any)[target] = schema.parse((req as any)[target] || {});
      next();
    } catch (error: any) {
      if (error instanceof zod.ZodError) {
        const errors = error.issues.map((err: any) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        throw new HttpError(
          400,
          `${errors.map((e: any) => e.message).join(", ")}`
        );
      }
      next(error);
    }
  };
