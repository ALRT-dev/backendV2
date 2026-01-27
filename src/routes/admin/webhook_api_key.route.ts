import { Router } from "express";
import {
  getWebhookApiKeysForAdmin,
  getWebhookApiKeyByIdForAdmin,
  createWebhookApiKeyForAdmin,
  updateWebhookApiKeyForAdmin,
  deleteWebhookApiKeyForAdmin,
  getWebhookLogsForAdmin,
} from "../../controllers/admin/webhook_api_key.controller.js";
import { requireAdminAuth } from "../../middlewares/auth.admin.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  createWebhookApiKeyBodySchema,
  updateWebhookApiKeyBodySchema,
} from "../../validators/admin/webhook_api_key.validator.js";

const router = Router();

// All routes require admin authentication
router.use(requireAdminAuth);

/**
 * @route   GET /api/admin/webhook-api-keys
 * @desc    Get all webhook API keys
 * @access  Admin
 */
router.get("/", getWebhookApiKeysForAdmin);

/**
 * @route   GET /api/admin/webhook-api-keys/:keyId
 * @desc    Get single webhook API key with stats
 * @access  Admin
 */
router.get("/:keyId", getWebhookApiKeyByIdForAdmin);

/**
 * @route   POST /api/admin/webhook-api-keys
 * @desc    Create new webhook API key
 * @access  Admin
 */
router.post(
  "/",
  validate(createWebhookApiKeyBodySchema),
  createWebhookApiKeyForAdmin
);

/**
 * @route   PATCH /api/admin/webhook-api-keys/:keyId
 * @desc    Update webhook API key (including enable/disable)
 * @access  Admin
 */
router.patch(
  "/:keyId",
  validate(updateWebhookApiKeyBodySchema),
  updateWebhookApiKeyForAdmin
);

/**
 * @route   DELETE /api/admin/webhook-api-keys/:keyId
 * @desc    Delete webhook API key
 * @access  Admin
 */
router.delete("/:keyId", deleteWebhookApiKeyForAdmin);

/**
 * @route   GET /api/admin/webhook-logs
 * @desc    Get webhook logs with filtering
 * @access  Admin
 */
router.get("/logs/all", getWebhookLogsForAdmin);

export default router;
