import { Router } from "express";
import {
  getUserProfile,
  getUserSubscriptions,
  subscribeToLocation,
  unsubscribeFromLocation,
  getUserPushNotificationSettings,
  updateUserNotificationSettings,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  subscribeLocationSchema,
  updateNotificationSettingsSchema,
} from "../validators/user.validator.js";

const userRouter = Router();

userRouter.get("/", requireAuth, getUserProfile);

userRouter.post(
  "/subscribe-location",
  requireAuth,
  validate(subscribeLocationSchema),
  subscribeToLocation
);
userRouter.delete(
  "/unsubscribe-location/:subscriptionId",
  requireAuth,
  unsubscribeFromLocation
);
userRouter.get("/location-subscriptions", requireAuth, getUserSubscriptions);

userRouter.get(
  "/push-notification-settings",
  requireAuth,
  getUserPushNotificationSettings
);
userRouter.put(
  "/push-notification-settings",
  requireAuth,
  validate(updateNotificationSettingsSchema),
  updateUserNotificationSettings
);

export default userRouter;
