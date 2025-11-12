import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import {
  hashAdminPassword,
  compareAdminPassword,
  checkRateLimit,
  resetRateLimit,
  getRemainingLockoutTime,
  generateSessionId,
} from "./admin_security.service.js";
import type { AdminLoginBody } from "../validators/admin/auth.validator.js";
import {
  signAdminAccessToken,
  signAdminRefreshToken,
} from "../utils/jwt.admin.util.js";

export const authenticateAdmin = async (data: AdminLoginBody) => {
  const { email, password } = data;

  try {
    // Check rate limiting
    const clientId = `admin:${email}`;
    if (!checkRateLimit(clientId)) {
      const remainingTime = getRemainingLockoutTime(clientId);
      throw new HttpError(
        429,
        `Too many failed attempts. Please try again in ${Math.ceil(
          remainingTime / 60
        )} minutes.`
      );
    }

    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
      },
    });

    if (!admin) {
      throw new HttpError(401, "Invalid email or password");
    }

    // Check if account is active
    if (!admin.isActive) {
      throw new HttpError(403, "Admin account is disabled");
    }

    // Check if account is locked due to failed attempts
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      const lockTime = Math.ceil(
        (admin.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new HttpError(
        403,
        `Account is locked. Please try again in ${lockTime} minutes.`
      );
    }

    // Verify password
    const isPasswordValid = await compareAdminPassword(
      password,
      admin.passwordHash
    );

    console.log("Password verification result:", isPasswordValid);
    if (!isPasswordValid) {
      // Increment failed attempts
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          lockedUntil:
            admin.failedLoginAttempts + 1 >= 5
              ? new Date(Date.now() + 15 * 60 * 1000) // Lock for 15 minutes after 5 failed attempts
              : null,
        },
      });

      throw new HttpError(401, "Invalid email or password");
    }

    // Reset failed attempts and rate limiting on successful login
    resetRateLimit(clientId);
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate session and tokens
    const sessionId = generateSessionId();
    const tokenPayload = {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      sessionId,
    };

    const accessToken = signAdminAccessToken(tokenPayload);
    const refreshToken = signAdminRefreshToken(tokenPayload);

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(500, "Authentication failed");
  }
};

export const updateAdminPassword = async (
  adminId: string,
  newPassword: string
) => {
  try {
    const passwordHash = await hashAdminPassword(newPassword);

    await prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return { success: true };
  } catch (error) {
    throw new HttpError(500, "Failed to update password");
  }
};
