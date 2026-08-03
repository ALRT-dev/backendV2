import { Router } from "express";
import { handleRevenueCatWebhook } from "../controllers/revenuecat.controller.js";

const router = Router();

/**
 * @route   POST /api/revenuecat/webhook
 * @desc    RevenueCat subscription events -> User.plan (ALRT+ entitlement)
 * @access  Webhook (Authorization header must equal REVENUECAT_WEBHOOK_AUTH)
 */
router.post("/webhook", handleRevenueCatWebhook);

export default router;
