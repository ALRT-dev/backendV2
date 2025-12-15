import { Router } from "express";
import { createHazardViaWebhook } from "../controllers/webhook.controller.js";
import {
  requireWebhookAuth,
  webhookRateLimiter,
  webhookSpeedLimiter,
  webhookDailyQuota,
  webhookBurstProtection,
} from "../middlewares/webhook.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createHazardWebhookBodySchema } from "../validators/webhook.validator.js";

const router = Router();

/**
 * @route   POST /api/webhook/hazards
 * @desc    Create a new hazard via webhook (for N8N or other automation tools)
 * @access  Webhook (requires X-Webhook-Api-Key header)
 *
 * Security layers applied:
 * 1. Burst protection: Max 10 requests/minute
 * 2. Rate limiter: Max 100 requests/15 minutes
 * 3. Speed limiter: Gradual slowdown after 50 requests
 * 4. Daily quota: Max 1000 requests/day
 * 5. API key authentication with logging
 * 6. Request validation
 */
router.post(
  "/hazards",
  webhookBurstProtection, // First line of defense: prevent rapid-fire
  webhookRateLimiter, // Main rate limiting
  webhookSpeedLimiter, // Gradual slowdown
  webhookDailyQuota, // Daily hard limit
  requireWebhookAuth, // API key validation + logging
  validate(createHazardWebhookBodySchema), // Input validation
  createHazardViaWebhook // Controller
);

export default router;
