import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
import type { Socket } from "socket.io";
import prisma from "../utils/prisma_client.util.js";

/// Middleware to check for a valid JWT access token in the Authorization header.
export const requireAuth = async (
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

    // check if userId exists in our database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });
    if (!user) {
      throw new HttpError(401, "Invalid token: user does not exist");
    }

    res.userId = user.id;

    next();
  } catch (error) {
    next(error);
  }
};

/// Middleware to authenticate a socket connection using a JWT access token in the Authorization header or auth data.
export const requireSocketAuth = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    let token: string | undefined;

    // Try to get token from authorization header first
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // If not found in header, try to get from auth data
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      return next(new HttpError(401, "Token missing"));
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded === "string") {
      return next(new HttpError(401, "Invalid or expired token"));
    }

    // check if userId exists in our database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });
    if (!user) {
      return next(new HttpError(401, "Invalid token: user does not exist"));
    }

    socket.userId = user.id;

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
