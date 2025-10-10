import { Router } from "express";
import { getNotificationsFeed } from "../controllers/notification.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const notificationRouter = Router();

notificationRouter.get("/feed", requireAuth, getNotificationsFeed);

export default notificationRouter;
