import { Router } from "express";
import {
  getUserProfile,
  getUserSubscriptions,
  subscribeToLocation,
  unsubscribeFromLocation,
  getUserPushNotificationSettings,
  updateUserNotificationSettings,
  updateUserProfile,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  subscribeLocationSchema,
  updateNotificationSettingsSchema,
  updateUserSchema,
} from "../validators/user.validator.js";

const userRouter = Router();

userRouter.get("/", requireAuth, getUserProfile);
userRouter.put("/", requireAuth, validate(updateUserSchema), updateUserProfile);

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
