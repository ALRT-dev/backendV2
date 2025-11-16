import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import {
  setUserLocation,
  setUserRadius,
  setPushNotificationPreference,
  acceptTermsOfService,
} from "../services/onboarding.service.js";
import type {
  SetUserLocationInput,
  SetUserRadiusInput,
  SetPushNotificationPreferenceInput,
} from "../validators/onboarding.validator.js";

/// Controller to set user location during onboarding
export const setOnboardingLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { latitude, longitude, locationName } =
      req.body as SetUserLocationInput;

    await setUserLocation({
      userId,
      latitude,
      longitude,
      locationName,
    });

    res.status(200).json({
      message: "Location set successfully",
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to set user subscription radius during onboarding
export const setOnboardingRadius = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { radiusInKm } = req.body as SetUserRadiusInput;

    await setUserRadius({
      userId,
      radiusInKm,
    });

    res.status(200).json({
      message: "Subscription radius set successfully",
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to set push notification preferences during onboarding
export const setOnboardingNotificationPreference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { pushNotificationPreference } =
      req.body as SetPushNotificationPreferenceInput;

    await setPushNotificationPreference({
      userId,
      pushNotificationPreference,
    });

    res.status(200).json({
      message: "Push notification preferences set successfully",
    });
  } catch (error) {
    next(error);
  }
};

/// Controller to accept terms of service and complete onboarding
export const acceptOnboardingTermsOfService = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    await acceptTermsOfService(userId);

    res.status(200).json({
      message: "Terms of service accepted successfully",
    });
  } catch (error) {
    next(error);
  }
};
