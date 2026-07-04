import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import * as guideService from "../services/guide.service.js";

const requireUserId = (res: Response): string => {
  const { userId } = res;
  if (!userId) throw new HttpError(400, "Unauthenticated user");
  return userId;
};

export const listTopicsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const result = await guideService.listTopicsWithProgress(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getGuideDetailController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { slugOrId } = req.params;
    if (!slugOrId) throw new HttpError(400, "slugOrId is required");
    const guide = await guideService.getGuideDetail(userId, slugOrId);
    res.status(200).json(guide);
  } catch (error) {
    next(error);
  }
};

export const completeGuideController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { slugOrId } = req.params;
    if (!slugOrId) throw new HttpError(400, "slugOrId is required");
    const result = await guideService.completeGuide(userId, slugOrId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getGuideForHazardCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    requireUserId(res);
    const { categoryId } = req.params;
    if (!categoryId) throw new HttpError(400, "categoryId is required");
    const guide = await guideService.getGuideForHazardCategory(categoryId);
    res.status(200).json(guide);
  } catch (error) {
    next(error);
  }
};
