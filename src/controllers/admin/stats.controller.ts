import type { NextFunction, Response } from "express";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";
import { HttpError } from "../../models/http_error.js";
import { getDashboardStats } from "../../services/stats.admin.service.js";

export const getDashboardStatsController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }

    const stats = await getDashboardStats();

    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};
