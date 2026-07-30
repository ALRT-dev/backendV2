import { Router } from "express";
import { handleRevenueCatWebhook } from "../controllers/revenuecat.controller.js";

const revenueCatRouter = Router();

/**
 * @route   POST /api/revenuecat/webhook
 * @desc    RevenueCat subscriber events -> ALRT+ entitlement updates
 * @access  Webhook (Authorization header must match REVENUECAT_WEBHOOK_AUTH)
 */
revenueCatRouter.post("/webhook", handleRevenueCatWebhook);

export default revenueCatRouter;
