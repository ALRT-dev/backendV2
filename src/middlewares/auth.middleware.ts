import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { verifyAccessToken } from "../utils/jwt.util.js";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader.startsWith("Bearer ") === false) {
      throw new HttpError(401, "Authorization header missing or malformed");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new HttpError(401, "Token missing");
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded === "string") {
      throw new HttpError(401, "Invalid or expired token");
    }

    res.userId = decoded.userId;

    next();
  } catch (error) {
    next(error);
  }
};

declare global {
  namespace Express {
    interface Response {
      userId?: string;
    }
  }
}
