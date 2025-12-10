import { Router } from "express";
import {
  getUserProfile,
  getUserSubscriptions,
  subscribeToLocation,
  unsubscribeFromLocation,
  getUserPushNotificationSettingsController,
  updateUserNotificationSettingsController,
  updateUserProfile,
  updateUserProfilePicture,
  updateUserOwnLocationSubscriptionRadiusController,
  updateUserOwnLocationSubscriptionController,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  subscribeLocationSchema,
  updateOwnLocationSubscriptionRadiusSchema,
  updateNotificationSettingsSchema,
  updateUserSchema,
  updateUserOwnLocationSubscriptionSchema,
} from "../validators/user.validator.js";
import {
  handleMulterError,
  uploadProfilePicture,
} from "../middlewares/upload.middleware.js";

const userRouter = Router();

userRouter.get("/", requireAuth, getUserProfile);
userRouter.put("/", requireAuth, validate(updateUserSchema), updateUserProfile);
userRouter.put(
  "/profile-picture",
  requireAuth,
  uploadProfilePicture,
  handleMulterError,
  updateUserProfilePicture
);

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
userRouter.put(
  "/own-location-subscription",
  requireAuth,
  validate(updateUserOwnLocationSubscriptionSchema),
  updateUserOwnLocationSubscriptionController
);
userRouter.put(
  "/own-location-subscription-radius",
  requireAuth,
  validate(updateOwnLocationSubscriptionRadiusSchema),
  updateUserOwnLocationSubscriptionRadiusController
);

userRouter.get(
  "/push-notification-settings",
  requireAuth,
  getUserPushNotificationSettingsController
);
userRouter.put(
  "/push-notification-settings",
  requireAuth,
  validate(updateNotificationSettingsSchema),
  updateUserNotificationSettingsController
);

export default userRouter;
