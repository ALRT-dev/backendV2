import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import {
  acceptDisclaimer,
  acceptTermsOfService,
  setUserLocation,
  setUserRadius,
  setPushNotificationPreference,
} from "../services/onboarding.service.js";
import type {
  SetUserLocationInput,
  SetUserRadiusInput,
  SetPushNotificationPreferenceInput,
} from "../validators/onboarding.validator.js";

/**
 * Controller to accept disclaimer on onboarding
 *
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns The response object
 */
export const acceptOnboardingDisclaimer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    await acceptDisclaimer(userId);

    res.status(200).json({
      message: "Disclaimer accepted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to accept terms of service and privacy policy on onboarding
 *
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns The response object
 */
export const acceptOnboardingTermsOfService = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

/**
 * Controller to set user location on onboarding
 *
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns The response object
 */
export const setOnboardingLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

/**
 * Controller to set user subscription radius on onboarding
 *
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns The response object
 */
export const setOnboardingRadius = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { radiusInKm }: SetUserRadiusInput = req.body;

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

/**
 * Controller to set push notification preferences on onboarding
 *
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns The response object
 */
export const setOnboardingNotificationPreference = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
