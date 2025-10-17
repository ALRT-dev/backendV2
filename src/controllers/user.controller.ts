import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import {
  getUserById,
  upsertUserOwnLocationSubscription,
} from "../services/user.service.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  NotificationSettingUpdate,
  SubscribeLocationInput,
  UpdateNotificationSettingsInput,
  UpdateUserInput,
} from "../validators/user.validator.js";

/// Controller to handle fetching the profile of the authenticated user.
export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const user = await getUserById(userId!);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const {
      name,
      latitude,
      longitude,
      locationName,
      subscriptionRadiusKm,
    }: UpdateUserInput = req.body;

    if (!name && !latitude && !longitude && !locationName) {
      throw new HttpError(
        400,
        "Nothing to update. Provide at least one field to update."
      );
    }

    // Update user profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(latitude && { latitude }),
        ...(longitude && { longitude }),
        ...(locationName && { locationName }),
      },
    });

    // If latitude and longitude are being updated, create/update user's own location subscription
    if (latitude && longitude) {
      await upsertUserOwnLocationSubscription({
        userId,
        latitude,
        longitude,
        ...(locationName && { locationName }),
        radiusKm: subscriptionRadiusKm || 10, // Use provided radius or default to 10km
      });
    }

    const updatedUser = await getUserById(userId);
    if (!updatedUser) {
      throw new HttpError(404, "User not found after update");
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle subscribing the authenticated user to a location.
export const subscribeToLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const {
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      address,
      name,
    }: SubscribeLocationInput = req.body;

    const subscription = await prisma.locationSubscription.create({
      data: {
        userId,
        northeastLat,
        northeastLng,
        southwestLat,
        southwestLng,
        ...(address && { address }),
        ...(name && { name }),
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

/// Controller to handle unsubscribing the authenticated user from a location.
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

/// Controller to handle fetching all location subscriptions of the authenticated user.
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
      orderBy: [
        { isOwnLocation: "desc" }, // Own location subscription first
        { createdAt: "desc" },
      ],
    });

    res.status(200).json(subscriptions);
  } catch (error) {
    next(error);
  }
};

/// Controller to get user push notification settings
export const getUserPushNotificationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const settings = await prisma.userPushNotificationSetting.findMany({
      where: { userId },
      orderBy: [{ settingType: "asc" }, { settingKey: "asc" }],
    });

    // Group settings by type for organized response
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.settingType]) {
        acc[setting.settingType] = {};
      }
      acc[setting.settingType]![setting.settingKey] = setting.isEnabled;
      return acc;
    }, {} as Record<string, Record<string, any>>);

    res.status(200).json(groupedSettings);
  } catch (error) {
    next(error);
  }
};

/// Controller to update user notification settings
export const updateUserNotificationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { updates }: UpdateNotificationSettingsInput = req.body;

    // Update settings
    const updatedSettings = await Promise.all(
      updates.map((update: NotificationSettingUpdate) =>
        prisma.userPushNotificationSetting.upsert({
          where: {
            userId_settingType_settingKey: {
              userId,
              settingType: update.settingType,
              settingKey: update.settingKey,
            },
          },
          update: {
            isEnabled: update.isEnabled,
            updatedAt: new Date(),
          },
          create: {
            userId,
            settingType: update.settingType,
            settingKey: update.settingKey,
            isEnabled: update.isEnabled,
          },
        })
      )
    );

    // Group updated settings by type
    const groupedSettings = updatedSettings.reduce((acc, setting) => {
      if (!acc[setting.settingType]) {
        acc[setting.settingType] = {};
      }
      acc[setting.settingType]![setting.settingKey] = setting.isEnabled;
      return acc;
    }, {} as Record<string, Record<string, any>>);

    res.status(200).json(groupedSettings);
  } catch (error) {
    next(error);
  }
};
