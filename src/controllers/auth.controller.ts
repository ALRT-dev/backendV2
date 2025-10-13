import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.util.js";
import { comparePassword, hashPassword } from "../services/auth.service.js";
import client from "../utils/google_oauth_client.util.js";
import { config } from "../utils/config.js";

/// Controller to handle user registration with email and password.
export const registerWithEmailAndPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new HttpError(400, "Email and password are required");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new HttpError(400, "User already exists");
    }

    const hashedPassword = hashPassword(password);
    if (!hashedPassword) {
      throw new HttpError(500, "Error hashing password");
    }

    const newUser = await prisma.user.create({
      data: { email, passwordHash: hashedPassword },
    });

    const accessToken = signAccessToken({ userId: newUser.id });
    if (!accessToken) {
      throw new HttpError(500, "Error signing access token");
    }

    const refreshToken = signRefreshToken({ userId: newUser.id });
    if (!refreshToken) {
      throw new HttpError(500, "Error signing refresh token");
    }

    res.status(201).json({
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle user login with email and password.
export const loginWithEmailAndPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new HttpError(400, "Email and password are required");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    if (!existingUser) {
      throw new HttpError(400, "User does not exist");
    }

    const isPasswordValid = comparePassword(
      password,
      existingUser.passwordHash
    );
    if (!isPasswordValid) {
      throw new HttpError(400, "Invalid password");
    }

    const accessToken = signAccessToken({ userId: existingUser.id });
    if (!accessToken) {
      throw new HttpError(500, "Error signing access token");
    }

    const refreshToken = signRefreshToken({ userId: existingUser.id });
    if (!refreshToken) {
      throw new HttpError(500, "Error signing refresh token");
    }

    res.status(200).json({
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle user login or registration via Google OAuth.
export const verifyGoogleOAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      throw new HttpError(400, "Email is required");
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        config.googleOAuth.clientIdWeb,
        config.googleOAuth.clientIdIos,
        config.googleOAuth.clientIdAndroid,
      ],
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new HttpError(400, "Invalid ID token");
    }

    if (payload.exp * 1000 < Date.now()) {
      throw new HttpError(400, "ID token has expired");
    }

    const email = payload.email!!;
    const name = payload.name || null;

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email, name },
      });
    }

    const accessToken = signAccessToken({ userId: user.id });
    if (!accessToken) {
      throw new HttpError(500, "Error signing access token");
    }

    const refreshToken = signRefreshToken({ userId: user.id });
    if (!refreshToken) {
      throw new HttpError(500, "Error signing refresh token");
    }

    res.status(200).json({
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle refreshing the access token using a refresh token.
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken: incomingRefreshToken } = req.body;
    if (!incomingRefreshToken) {
      throw new HttpError(400, "Refresh token is required");
    }

    // Verify the refresh token
    const decoded = verifyRefreshToken(incomingRefreshToken);
    if (!decoded || typeof decoded === "string") {
      throw new HttpError(401, "Invalid refresh token");
    }

    const userId = decoded.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new HttpError(401, "User not found");
    }

    const newAccessToken = signAccessToken({ userId: user.id });
    if (!newAccessToken) {
      throw new HttpError(500, "Error signing access token");
    }

    res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};
