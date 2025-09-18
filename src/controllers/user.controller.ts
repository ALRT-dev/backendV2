import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { getUserById } from "../services/user.service.js";

export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.userId;
    if (!userId) {
      throw new Error("User ID not found");
    }

    const user = await getUserById(userId);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};
