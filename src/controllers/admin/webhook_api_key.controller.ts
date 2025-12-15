import type { NextFunction, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../../utils/prisma_client.util.js";
import { HttpError } from "../../models/http_error.js";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";
import type {
  CreateWebhookApiKeyBody,
  UpdateWebhookApiKeyBody,
} from "../../validators/admin/webhook_api_key.validator.js";
import { getWebhookUsageStats } from "../../middlewares/webhook.middleware.js";

/**
 * Get all webhook API keys
 */
export const getWebhookApiKeysForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const apiKeys = await prisma.webhookApiKey.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        maxRequestsPerMinute: true,
        maxRequestsPerHour: true,
        maxRequestsPerDay: true,
        totalRequests: true,
        lastUsedAt: true,
        lastUsedIp: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(apiKeys);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single webhook API key with detailed stats
 */
export const getWebhookApiKeyByIdForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const { keyId } = req.params;

    if (!keyId) {
      throw new HttpError(400, "keyId parameter is required");
    }

    const apiKey = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        maxRequestsPerMinute: true,
        maxRequestsPerHour: true,
        maxRequestsPerDay: true,
        totalRequests: true,
        lastUsedAt: true,
        lastUsedIp: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw new HttpError(404, `Webhook API key with id ${keyId} not found`);
    }

    // Get usage statistics
    const stats = await getWebhookUsageStats(keyId);

    // Get recent logs (last 50)
    const recentLogs = await prisma.webhookLog.findMany({
      where: { apiKeyId: keyId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        success: true,
        statusCode: true,
        reason: true,
        clientIp: true,
        endpoint: true,
        responseTime: true,
        hazardId: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      ...apiKey,
      stats,
      recentLogs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new webhook API key
 * Returns the plain-text key ONCE - it's never shown again
 */
export const createWebhookApiKeyForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const {
      name,
      description,
      maxRequestsPerMinute = 10,
      maxRequestsPerHour = 100,
      maxRequestsPerDay = 1000,
      expiresAt,
    }: CreateWebhookApiKeyBody = req.body;

    // Generate a secure random API key
    const apiKey = `whk_${crypto.randomBytes(32).toString("base64url")}`;

    // Hash the API key for storage (bcrypt with 10 rounds)
    const keyHash = await bcrypt.hash(apiKey, 10);

    // Create in database
    const createdKey = await prisma.webhookApiKey.create({
      data: {
        name,
        ...(description && { description }),
        keyHash,
        maxRequestsPerMinute,
        maxRequestsPerHour,
        maxRequestsPerDay,
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
        createdById: req.admin.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        maxRequestsPerMinute: true,
        maxRequestsPerHour: true,
        maxRequestsPerDay: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    res.status(201).json({
      ...createdKey,
      apiKey, // IMPORTANT: This is the ONLY time the plain-text key is shown
      message:
        "API key created successfully. SAVE THIS KEY NOW - it will never be shown again!",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update webhook API key (name, description, limits, active status)
 */
export const updateWebhookApiKeyForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const { keyId } = req.params;

    if (!keyId) {
      throw new HttpError(400, "keyId parameter is required");
    }

    const {
      name,
      description,
      isActive,
      maxRequestsPerMinute,
      maxRequestsPerHour,
      maxRequestsPerDay,
      expiresAt,
    }: UpdateWebhookApiKeyBody = req.body;

    const existingKey = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      throw new HttpError(404, `Webhook API key with id ${keyId} not found`);
    }

    const updatedKey = await prisma.webhookApiKey.update({
      where: { id: keyId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(maxRequestsPerMinute !== undefined && { maxRequestsPerMinute }),
        ...(maxRequestsPerHour !== undefined && { maxRequestsPerHour }),
        ...(maxRequestsPerDay !== undefined && { maxRequestsPerDay }),
        ...(expiresAt !== undefined && {
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        maxRequestsPerMinute: true,
        maxRequestsPerHour: true,
        maxRequestsPerDay: true,
        totalRequests: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });

    res.status(200).json(updatedKey);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete webhook API key
 */
export const deleteWebhookApiKeyForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const { keyId } = req.params;

    if (!keyId) {
      throw new HttpError(400, "keyId parameter is required");
    }

    const existingKey = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      throw new HttpError(404, `Webhook API key with id ${keyId} not found`);
    }

    await prisma.webhookApiKey.delete({
      where: { id: keyId },
    });

    res.status(200).json({
      message: "Webhook API key deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get webhook logs with filtering
 */
export const getWebhookLogsForAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(403, "Unauthorized");
    }

    const {
      apiKeyId,
      success,
      page = "1",
      pageSize = "50",
    } = req.query as {
      apiKeyId?: string;
      success?: string;
      page?: string;
      pageSize?: string;
    };

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = {};
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (success !== undefined) where.success = success === "true";

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: pageSizeNum,
        skip,
        include: {
          apiKey: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.webhookLog.count({ where }),
    ]);

    res.status(200).json({
      logs,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
