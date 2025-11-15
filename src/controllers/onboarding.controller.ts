import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import {
  startOnboarding,
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
import { OnboardingStep } from "@prisma/client";

/// Controller to start the onboarding process for the authenticated user
export const startUserOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    await startOnboarding(userId);

    res.status(200).json({
      message: "Onboarding started successfully",
      nextOnboardingStep: OnboardingStep.location,
    });
  } catch (error) {
    next(error);
  }
};

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
      nextOnboardingStep: OnboardingStep.radius,
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
      nextOnboardingStep: OnboardingStep.pushNotification,
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
      nextOnboardingStep: OnboardingStep.tosAcceptance,
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
      nextOnboardingStep: OnboardingStep.completed,
    });
  } catch (error) {
    next(error);
  }
};
