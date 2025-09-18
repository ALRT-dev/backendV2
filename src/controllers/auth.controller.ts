import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.util.js";
import { comparePassword, hashPassword } from "../services/auth.service.js";

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

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};
