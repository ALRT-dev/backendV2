import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../models/http_error.js";
import * as communitySafety from "../services/community_safety.service.js";
import type {
  BlockUserInput,
  FlagHazardInput,
} from "../validators/community_safety.validator.js";
import type { HazardFlagReason } from "@prisma/client";

const requireUserId = (res: Response): string => {
  const userId = res.userId;
  if (!userId) throw new HttpError(401, "Not authenticated");
  return userId;
};

export const flagHazardController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { hazardId } = req.params;
    if (!hazardId) throw new HttpError(400, "hazardId is required");
    const { reason } = req.body as FlagHazardInput;

    const result = await communitySafety.flagHazard(
      userId,
      hazardId,
      reason as HazardFlagReason,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const blockUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const blockerId = requireUserId(res);
    const { userId: blockedId } = req.body as BlockUserInput;
    const result = await communitySafety.blockUser(blockerId, blockedId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const unblockUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const blockerId = requireUserId(res);
    const { userId: blockedId } = req.params;
    if (!blockedId) throw new HttpError(400, "userId is required");
    const result = await communitySafety.unblockUser(blockerId, blockedId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const listBlockedUsersController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const blockerId = requireUserId(res);
    const blocked = await communitySafety.listBlockedUsers(blockerId);
    res.status(200).json({ blocked });
  } catch (error) {
    next(error);
  }
};
