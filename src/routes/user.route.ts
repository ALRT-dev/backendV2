import {
  blockUserController,
  listBlockedUsersController,
  unblockUserController,
} from "../controllers/community_safety.controller.js";
import { blockUserSchema } from "../validators/community_safety.validator.js";
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
  requestAccountDeletionController,
  cancelAccountDeletionController,
  getAccountDeletionStatusController,
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

// Account deletion routes
userRouter.get("/account/deletion-status", requireAuth, getAccountDeletionStatusController);
userRouter.delete("/account", requireAuth, requestAccountDeletionController);
userRouter.post("/account/cancel-deletion", requireAuth, cancelAccountDeletionController);

// Blocking hides an account's reports for the blocker alone. Nothing is
// deleted, and the blocked person is never told.
userRouter.get("/blocked", requireAuth, listBlockedUsersController);
userRouter.post(
  "/blocked",
  requireAuth,
  validate(blockUserSchema),
  blockUserController,
);
userRouter.delete("/blocked/:userId", requireAuth, unblockUserController);

export default userRouter;
