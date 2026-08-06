import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.util.js";
import {
  comparePassword,
  hashPassword,
  verifyAppleToken,
  verifyGoogleToken,
  verifyMicrosoftToken,
} from "../services/auth.service.js";
import type {
  AppleOAuthInput,
  GoogleOAuthInput,
  LoginInput,
  MicrosoftOAuthInput,
  RefreshTokenInput,
  RegisterInput,
} from "../validators/auth.validator.js";

/// Controller to handle user registration with email and password.
export const registerWithEmailAndPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password }: RegisterInput = req.body;

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
    const { email, password }: LoginInput = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    if (!existingUser) {
      throw new HttpError(400, "User does not exist");
    }

    // Google/Apple accounts are created without a password hash. Comparing
    // against a null hash throws (bcrypt) and would surface as a 500; return a
    // clear message instead so the app can guide the user to social login.
    if (!existingUser.passwordHash) {
      throw new HttpError(
        400,
        "This account uses social login. Please sign in with Google or Apple."
      );
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
    const { idToken }: GoogleOAuthInput = req.body;

    const payload = await verifyGoogleToken(idToken);
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

/// Controller to handle user login or registration via Apple OAuth.
export const verifyAppleOAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { identityToken, firstName, lastName }: AppleOAuthInput = req.body;

    const applePayload = await verifyAppleToken(identityToken);

    if (!applePayload || !applePayload.email) {
      throw new HttpError(400, "Invalid identity token");
    }

    const email = applePayload.email;
    let name: string | null = null;

    // Apple only sends user info on first sign-in
    if (firstName || lastName) {
      name = [firstName, lastName].filter(Boolean).join(" ") || null;
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email, name },
      });
    } else if (name && !user.name) {
      // Update name if user exists but doesn't have a name
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name },
        select: { id: true, name: true },
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

/// Controller to handle user login or registration via Microsoft OAuth.
export const verifyMicrosoftOAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idToken }: MicrosoftOAuthInput = req.body;

    const payload = await verifyMicrosoftToken(idToken);

    // Microsoft may expose the email as `email` or, for work/school accounts,
    // as `preferred_username`.
    const email =
      (typeof payload.email === "string" && payload.email) ||
      (typeof payload.preferred_username === "string" &&
        payload.preferred_username) ||
      null;
    if (!email) {
      throw new HttpError(400, "Microsoft token did not include an email");
    }

    const name = typeof payload.name === "string" ? payload.name : null;

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email, name },
        select: { id: true, name: true },
      });
    } else if (name && !user.name) {
      // Backfill the name if we have one and the user doesn't.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name },
        select: { id: true, name: true },
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
    const { refreshToken: incomingRefreshToken }: RefreshTokenInput = req.body;

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
