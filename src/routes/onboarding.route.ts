import { Router } from "express";
import {
  setOnboardingLocation,
  setOnboardingRadius,
  setOnboardingNotificationPreference,
  acceptOnboardingTermsOfService,
  acceptOnboardingDisclaimer,
} from "../controllers/onboarding.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  setUserLocationSchema,
  setUserRadiusSchema,
  setPushNotificationPreferenceSchema,
} from "../validators/onboarding.validator.js";

const onboardingRouter = Router();

onboardingRouter.post(
  "/accept-disclaimer",
  requireAuth,
  acceptOnboardingDisclaimer,
);
onboardingRouter.post(
  "/accept-tos",
  requireAuth,
  acceptOnboardingTermsOfService,
);
onboardingRouter.post(
  "/location",
  requireAuth,
  validate(setUserLocationSchema),
  setOnboardingLocation,
);
onboardingRouter.post(
  "/radius",
  requireAuth,
  validate(setUserRadiusSchema),
  setOnboardingRadius,
);
onboardingRouter.post(
  "/notifications",
  requireAuth,
  validate(setPushNotificationPreferenceSchema),
  setOnboardingNotificationPreference,
);

export default onboardingRouter;
