import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { getUserById } from "../services/user.service.js";
import prisma from "../utils/prisma_client.util.js";

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

export const subscribeToLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "User ID not found");
    }

    const {
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      address,
      name,
    } = req.body;
    if (!northeastLat || !northeastLng || !southwestLat || !southwestLng) {
      throw new HttpError(400, "All coordinates are required");
    }

    const subscription = await prisma.locationSubscription.create({
      data: {
        userId,
        northeastLat,
        northeastLng,
        southwestLat,
        southwestLng,
        address,
        name,
      },
      omit: {
        userId: true,
        geoRegion: true,
      },
    });

    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
};

export const unsubscribeFromLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "User ID not found");
    }

    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      throw new HttpError(400, "Subscription ID is required");
    }

    const subscription = await prisma.locationSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.userId !== userId) {
      throw new HttpError(404, "Subscription not found");
    }

    await prisma.locationSubscription.delete({
      where: { id: subscriptionId },
    });

    res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (error) {
    next(error);
  }
};

export const getUserSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "User ID not found");
    }

    const subscriptions = await prisma.locationSubscription.findMany({
      where: { userId },
      omit: {
        userId: true,
        geoRegion: true,
      },
    });

    res.status(200).json(subscriptions);
  } catch (error) {
    next(error);
  }
};
