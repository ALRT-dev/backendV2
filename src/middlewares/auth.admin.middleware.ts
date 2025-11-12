import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { verifyAdminAccessToken } from "../utils/jwt.admin.util.js";
import prisma from "../utils/prisma_client.util.js";
import { AdminRole } from "@prisma/client";

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: AdminRole;
    sessionId?: string;
  };
}

/// Middleware to check for a valid admin JWT access token
export const requireAdminAuth = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "Authorization header missing or malformed");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new HttpError(401, "Token missing");
    }

    const decoded = verifyAdminAccessToken(token);
    if (!decoded) {
      throw new HttpError(401, "Invalid or expired token");
    }

    // Verify admin exists and is active
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lockedUntil: true,
      },
    });

    if (!admin) {
      throw new HttpError(401, "Admin account not found");
    }

    if (!admin.isActive) {
      throw new HttpError(403, "Admin account is disabled");
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new HttpError(403, "Admin account is temporarily locked");
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      ...(decoded.sessionId && { sessionId: decoded.sessionId }),
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
    } else {
      next(new HttpError(401, "Authentication failed"));
    }
  }
};

/// Middleware to check admin role permissions
export const requireAdminRole = (allowedRoles: string[]) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new HttpError(401, "Admin authentication required"));
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return next(new HttpError(403, "Insufficient permissions"));
    }

    next();
  };
};

/// Middleware shortcuts for common role checks
export const requireSuperAdmin = requireAdminRole([AdminRole.SUPER_ADMIN]);
export const requireAdminOrAbove = requireAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.ADMIN,
]);
export const requireAnyAdmin = requireAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.ADMIN,
  AdminRole.MODERATOR,
]);
