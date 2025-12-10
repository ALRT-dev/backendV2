import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import {
  getUserById,
  getUserPushNotificationSettings,
  updateUserPushNotificationSettings,
} from "../services/user.service.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  SubscribeLocationInput,
  UpdateNotificationSettingsInput,
  UpdateOwnLocationSubscriptionInput,
  UpdateOwnLocationSubscriptionRadiusInput,
  UpdateUserInput,
} from "../validators/user.validator.js";
import {
  deleteFileFromS3,
  extractS3KeyFromUrl,
  uploadFileToS3,
} from "../services/s3.service.js";
import {
  createUserLocationSubscription,
  deleteUserLocationSubscription,
  getSingleUserLocationSubscriptionById,
  getUserLocationSubscriptions,
  updateUserOwnLocationSubscriptionRadius,
  upsertUserOwnLocationSubscription,
} from "../services/location_subscription.service.js";

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

/// Controller to handle updating user's profile.
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

    const { name, latitude, longitude, locationName }: UpdateUserInput =
      req.body;

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

/// Controller to handle updating user's profile picture.
export const updateUserProfilePicture = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const file = req.file;
    if (!file) {
      throw new HttpError(400, "Profile picture file is required");
    }

    // Validate file type (should be image only for profile pictures)
    if (!file.mimetype.startsWith("image/")) {
      throw new HttpError(400, "Profile picture must be an image file");
    }

    // Get current user to check for existing profile picture
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePictureUrl: true },
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Upload new profile picture to S3
    const uploadResult = await uploadFileToS3(file, "profile-pictures");

    // Update user with new profile picture URL
    await prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl: uploadResult.url },
      omit: { passwordHash: true },
    });

    // Delete old profile picture from S3 if it exists
    if (currentUser.profilePictureUrl) {
      try {
        const oldS3Key = extractS3KeyFromUrl(currentUser.profilePictureUrl);
        if (oldS3Key) {
          await deleteFileFromS3(oldS3Key);
        }
      } catch (error) {
        console.error("Error deleting old profile picture:", error);
        // Don't fail the request if old file deletion fails
      }
    }

    const updatedUser = await getUserById(userId);
    if (!updatedUser) {
      throw new HttpError(404, "User not found after updating profile picture");
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

    const subscription = await createUserLocationSubscription({
      userId: userId!,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      address,
      name,
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

    const subscription = await getSingleUserLocationSubscriptionById({
      userId,
      subscriptionId,
    });

    if (!subscription || subscription.userId !== userId) {
      throw new HttpError(404, "Subscription not found");
    }

    await deleteUserLocationSubscription(subscriptionId);

    res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle updating user's own location subscription.
export const updateUserOwnLocationSubscriptionController = async (
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
      latitude,
      longitude,
      locationName,
    }: UpdateOwnLocationSubscriptionInput = req.body;

    const newSubscription = await upsertUserOwnLocationSubscription({
      userId,
      latitude,
      longitude,
      locationName,
    });

    res.status(200).json(newSubscription);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle updating user's own location subscription radius.
export const updateUserOwnLocationSubscriptionRadiusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { radiusKm }: UpdateOwnLocationSubscriptionRadiusInput = req.body;

    const newSubscription = await updateUserOwnLocationSubscriptionRadius(
      userId,
      radiusKm
    );

    res.status(200).json(newSubscription);
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

    const subscriptions = await getUserLocationSubscriptions({ userId });

    res.status(200).json(subscriptions);
  } catch (error) {
    next(error);
  }
};

/// Controller to get user push notification settings
export const getUserPushNotificationSettingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const settings = await getUserPushNotificationSettings(userId);

    res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
};

/// Controller to update user notification settings
export const updateUserNotificationSettingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const settingsToUpdate: UpdateNotificationSettingsInput = req.body;

    const settings = await updateUserPushNotificationSettings(
      userId,
      settingsToUpdate
    );

    res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
};
