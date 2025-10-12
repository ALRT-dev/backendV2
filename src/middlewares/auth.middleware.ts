import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
import type { Socket } from "socket.io";

/// Middleware to check for a valid JWT access token in the Authorization header.
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

/// Middleware to authenticate a socket connection using a JWT access token in the Authorization header.
export const requireSocketAuth = (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    const authHeader = socket.handshake.headers.authorization;
    if (!authHeader || authHeader.startsWith("Bearer ") === false) {
      return next(
        new HttpError(401, "Authorization header missing or malformed")
      );
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return next(new HttpError(401, "Token missing"));
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded === "string") {
      return next(new HttpError(401, "Invalid or expired token"));
    }

    socket.userId = decoded.userId;

    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Authentication error"));
  }
};

declare global {
  namespace Express {
    interface Response {
      userId?: string;
    }
  }
}

declare module "socket.io" {
  interface Socket {
    userId?: string;
  }
}
