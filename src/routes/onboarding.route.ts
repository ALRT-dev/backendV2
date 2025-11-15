import { Router } from "express";
import {
  startUserOnboarding,
  setOnboardingLocation,
  setOnboardingRadius,
  setOnboardingNotificationPreference,
  acceptOnboardingTermsOfService,
} from "../controllers/onboarding.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  setUserLocationSchema,
  setUserRadiusSchema,
  setPushNotificationPreferenceSchema,
} from "../validators/onboarding.validator.js";

const onboardingRouter = Router();

onboardingRouter.post("/start", requireAuth, startUserOnboarding);
onboardingRouter.post(
  "/location",
  requireAuth,
  validate(setUserLocationSchema),
  setOnboardingLocation
);
onboardingRouter.post(
  "/radius",
  requireAuth,
  validate(setUserRadiusSchema),
  setOnboardingRadius
);
onboardingRouter.post(
  "/notifications",
  requireAuth,
  validate(setPushNotificationPreferenceSchema),
  setOnboardingNotificationPreference
);
onboardingRouter.post(
  "/accept-tos",
  requireAuth,
  acceptOnboardingTermsOfService
);

export default onboardingRouter;
