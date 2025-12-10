import type { NextFunction, Request, Response } from "express";
import type {
  AdminLoginBody,
  AdminRefreshTokenInput,
} from "../../validators/admin/auth.validator.js";
import { authenticateAdmin } from "../../services/auth.admin.service.js";
import { HttpError } from "../../models/http_error.js";
import {
  verifyAdminRefreshToken,
  signAdminAccessToken,
} from "../../utils/jwt.admin.util.js";

export const loginAsAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password }: AdminLoginBody = req.body;

    // Authenticate admin and get tokens
    const result = await authenticateAdmin({ email, password });

    console.log(
      `Admin login successful: ${
        result.admin.email
      } at ${new Date().toISOString()}`
    );

    res.status(200).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    const { email } = req.body;
    console.warn(
      `Admin login failed for ${email}: ${
        error instanceof HttpError ? error.message : "Unknown error"
      } at ${new Date().toISOString()}`
    );

    next(error);
  }
};

export const refreshAdminToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken }: AdminRefreshTokenInput = req.body;

    // Verify refresh token
    const decoded = verifyAdminRefreshToken(refreshToken);

    // Generate new access token
    const newAccessToken = signAdminAccessToken({
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    });

    res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(new HttpError(401, "Invalid refresh token"));
  }
};

export const logoutAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
