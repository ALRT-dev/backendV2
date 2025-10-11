import { Router } from "express";
import {
  getNotificationsFeed,
  sendPushNotificationToken,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const notificationRouter = Router();

notificationRouter.get("/feed", requireAuth, getNotificationsFeed);
notificationRouter.post(
  "/push-notification-token",
  requireAuth,
  sendPushNotificationToken
);

export default notificationRouter;
