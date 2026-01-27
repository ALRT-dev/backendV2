import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import bcrypt from "bcrypt";
import { HttpError } from "../models/http_error.js";
import { config } from "../utils/config.js";
import prisma from "../utils/prisma_client.util.js";
import type { WebhookApiKey } from "@prisma/client";

/**
 * Store for tracking suspicious attempts (in-memory)
 */
const webhookUsageStore = new Map<
  string,
  {
    suspiciousAttempts: number;
    lastRequest: Date;
  }
>();

/**
 * Middleware to verify webhook API key authentication
 *
 * Security features:
 * - Multi-key support with database validation
 * - Per-key rate limiting
 * - Per-key enable/disable control
 * - Request logging for audit trails
 * - Failed attempt tracking
 *
 * To use this webhook:
 * 1. Create API keys via admin endpoint
 * 2. Send requests with header: X-Webhook-Api-Key: <your-key>
 */
export const requireWebhookAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  try {
    const apiKey = req.headers["x-webhook-api-key"];
    const clientIp = getClientIp(req);

    if (!apiKey) {
      await logWebhookAttempt({
        success: false,
        statusCode: 401,
        reason: "Missing API key",
        clientIp,
        endpoint: req.path,
      });
      throw new HttpError(401, "Webhook API key is missing");
    }

    if (typeof apiKey !== "string") {
      await logWebhookAttempt({
        success: false,
        statusCode: 401,
        reason: "Invalid API key format",
        clientIp,
        endpoint: req.path,
      });
      throw new HttpError(401, "Invalid API key format");
    }

    // Find matching API key in database by comparing bcrypt hash
    const validApiKey = await findValidApiKey(apiKey);

    if (!validApiKey) {
      await logWebhookAttempt({
        success: false,
        statusCode: 403,
        reason: "Invalid API key",
        clientIp,
        endpoint: req.path,
        apiKeyUsed: apiKey.substring(0, 8) + "...",
      });

      // Track suspicious attempts
      trackSuspiciousAttempt(apiKey);

      throw new HttpError(403, "Invalid webhook API key");
    }

    // Check if API key is active
    if (!validApiKey.isActive) {
      await logWebhookAttempt({
        success: false,
        statusCode: 403,
        reason: "API key is disabled",
        clientIp,
        endpoint: req.path,
        apiKeyId: validApiKey.id,
      });
      throw new HttpError(403, "This API key has been disabled");
    }

    // Check if API key has expired
    if (validApiKey.expiresAt && validApiKey.expiresAt < new Date()) {
      await logWebhookAttempt({
        success: false,
        statusCode: 403,
        reason: "API key has expired",
        clientIp,
        endpoint: req.path,
        apiKeyId: validApiKey.id,
      });
      throw new HttpError(403, "This API key has expired");
    }

    // Check if this API key has too many suspicious attempts
    const usage = webhookUsageStore.get(validApiKey.id);
    if (usage && usage.suspiciousAttempts > 10) {
      await logWebhookAttempt({
        success: false,
        statusCode: 429,
        reason: "API key temporarily blocked due to suspicious activity",
        clientIp,
        endpoint: req.path,
        apiKeyId: validApiKey.id,
      });
      throw new HttpError(
        429,
        "Too many failed attempts. Please try again later."
      );
    }

    // Store API key info in request for use in rate limiters and controller
    (req as any).webhookApiKey = validApiKey;

    // Log successful authentication
    await logWebhookAttempt({
      success: true,
      statusCode: 200,
      clientIp,
      endpoint: req.path,
      responseTime: Date.now() - startTime,
      apiKeyId: validApiKey.id,
    });

    // Update usage stats in database
    await updateUsageStats(validApiKey.id, clientIp);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiter: Strict limit on webhook requests
 * Prevents abuse by limiting requests per time window
 * Uses per-key limits from database
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.maxRequestsPerHour || 100; // Use per-key limit or default
  },
  message: {
    error: "Too many webhook requests",
    message:
      "You have exceeded your hourly rate limit. Please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.id || getClientIp(req);
  },
  handler: async (req: Request, res: Response) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    const clientIp = getClientIp(req);

    const logData: any = {
      success: false,
      statusCode: 429,
      reason: "Hourly rate limit exceeded",
      clientIp,
      endpoint: req.path,
    };
    if (apiKey?.id) logData.apiKeyId = apiKey.id;

    await logWebhookAttempt(logData);

    res.status(429).json({
      error: "Too many webhook requests",
      message: `You have exceeded your hourly rate limit of ${
        apiKey?.maxRequestsPerHour || 100
      } requests. Please try again later.`,
      retryAfter: "1 hour",
      limit: apiKey?.maxRequestsPerHour || 100,
    });
  },
});

/**
 * Speed limiter: Gradually slow down requests as limit approaches
 * Provides warning before hitting hard rate limit
 */
export const webhookSpeedLimiter = slowDown({
  windowMs: 60 * 60 * 1000, // 1 hour
  delayAfter: async (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return Math.floor((apiKey?.maxRequestsPerHour || 100) / 2); // Slow down after 50% of limit
  },
  delayMs: (hits) => hits * 100,
  maxDelayMs: 5000,
  keyGenerator: (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.id || getClientIp(req);
  },
});

/**
 * Daily quota limiter: Prevent excessive daily usage
 * Uses per-key limits from database
 */
export const webhookDailyQuota = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: async (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.maxRequestsPerDay || 1000;
  },
  message: {
    error: "Daily quota exceeded",
    message: "You have exceeded your daily quota. Please try again tomorrow.",
    retryAfter: "24 hours",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.id || getClientIp(req);
  },
  skipSuccessfulRequests: false,
  handler: async (req: Request, res: Response) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    const clientIp = getClientIp(req);

    const logData: any = {
      success: false,
      statusCode: 429,
      reason: "Daily quota exceeded",
      clientIp,
      endpoint: req.path,
    };
    if (apiKey?.id) logData.apiKeyId = apiKey.id;

    await logWebhookAttempt(logData);

    res.status(429).json({
      error: "Daily quota exceeded",
      message: `You have exceeded your daily quota of ${
        apiKey?.maxRequestsPerDay || 1000
      } requests. Please try again tomorrow.`,
      retryAfter: "24 hours",
      limit: apiKey?.maxRequestsPerDay || 1000,
    });
  },
});

/**
 * Burst protection: Prevent rapid-fire requests
 * Uses per-key limits from database
 */
export const webhookBurstProtection = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: async (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.maxRequestsPerMinute || 10;
  },
  message: {
    error: "Too many requests in short time",
    message: "You are sending requests too quickly. Please slow down.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    return apiKey?.id || getClientIp(req);
  },
  handler: async (req: Request, res: Response) => {
    const apiKey = (req as any).webhookApiKey as WebhookApiKey | undefined;
    const clientIp = getClientIp(req);

    const logData: any = {
      success: false,
      statusCode: 429,
      reason: "Burst protection triggered",
      clientIp,
      endpoint: req.path,
    };
    if (apiKey?.id) logData.apiKeyId = apiKey.id;

    await logWebhookAttempt(logData);

    res.status(429).json({
      error: "Too many requests in short time",
      message: `You are sending requests too quickly. Maximum ${
        apiKey?.maxRequestsPerMinute || 10
      } requests per minute allowed.`,
      retryAfter: "1 minute",
      limit: apiKey?.maxRequestsPerMinute || 10,
    });
  },
});

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract client IP address from request
 * Handles proxies and load balancers
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const firstIp = forwarded.split(",")[0];
    return firstIp ? firstIp.trim() : "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Find and validate API key from database
 * Uses bcrypt to compare against stored hashes
 */
async function findValidApiKey(apiKey: string): Promise<WebhookApiKey | null> {
  try {
    // Get all active API keys
    const apiKeys = await prisma.webhookApiKey.findMany({
      where: { isActive: true },
    });

    // Check each key hash (bcrypt comparison)
    for (const dbKey of apiKeys) {
      const isValid = await bcrypt.compare(apiKey, dbKey.keyHash);
      if (isValid) {
        return dbKey;
      }
    }

    return null;
  } catch (error) {
    console.error("Error validating API key:", error);
    return null;
  }
}

/**
 * Log webhook attempts for audit and monitoring
 * Stores in database for long-term audit trail
 */
async function logWebhookAttempt(data: {
  success: boolean;
  statusCode: number;
  reason?: string;
  clientIp: string;
  endpoint: string;
  apiKeyUsed?: string;
  apiKeyId?: string;
  responseTime?: number;
  hazardId?: string;
}): Promise<void> {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      success: data.success,
      statusCode: data.statusCode,
      reason:
        data.reason ||
        (data.success ? "Authentication successful" : "Unknown error"),
      clientIp: data.clientIp,
      endpoint: data.endpoint,
      apiKeyUsed: data.apiKeyUsed,
      apiKeyId: data.apiKeyId,
      responseTime: data.responseTime,
      hazardId: data.hazardId,
    };

    // Log to console
    if (data.success) {
      console.log("[WEBHOOK SUCCESS]", JSON.stringify(logEntry));
    } else {
      console.warn("[WEBHOOK FAILURE]", JSON.stringify(logEntry));
    }

    // Store in database for audit trail
    await prisma.webhookLog.create({
      data: {
        ...(data.apiKeyId && { apiKeyId: data.apiKeyId }),
        success: data.success,
        statusCode: data.statusCode,
        ...(data.reason && { reason: data.reason }),
        clientIp: data.clientIp,
        endpoint: data.endpoint,
        method: "POST",
        ...(data.responseTime && { responseTime: data.responseTime }),
        ...(data.hazardId && { hazardId: data.hazardId }),
      },
    });
  } catch (error) {
    console.error("Failed to log webhook attempt:", error);
  }
}

/**
 * Track suspicious authentication attempts (in-memory)
 */
function trackSuspiciousAttempt(apiKey: string): void {
  const usage = webhookUsageStore.get(apiKey) || {
    suspiciousAttempts: 0,
    lastRequest: new Date(),
  };

  usage.suspiciousAttempts += 1;
  usage.lastRequest = new Date();

  webhookUsageStore.set(apiKey, usage);

  // Reset suspicious attempts after 1 hour
  setTimeout(() => {
    const current = webhookUsageStore.get(apiKey);
    if (current) {
      current.suspiciousAttempts = Math.max(0, current.suspiciousAttempts - 1);
      webhookUsageStore.set(apiKey, current);
    }
  }, 60 * 60 * 1000);
}

/**
 * Update usage statistics in database
 */
async function updateUsageStats(
  apiKeyId: string,
  clientIp: string
): Promise<void> {
  try {
    await prisma.webhookApiKey.update({
      where: { id: apiKeyId },
      data: {
        totalRequests: { increment: 1 },
        lastUsedAt: new Date(),
        lastUsedIp: clientIp,
      },
    });
  } catch (error) {
    console.error("Failed to update usage stats:", error);
  }
}

/**
 * Get webhook usage statistics for a specific API key
 */
export async function getWebhookUsageStats(apiKeyId: string) {
  try {
    const apiKey = await prisma.webhookApiKey.findUnique({
      where: { id: apiKeyId },
      select: {
        id: true,
        name: true,
        isActive: true,
        totalRequests: true,
        lastUsedAt: true,
        lastUsedIp: true,
        maxRequestsPerMinute: true,
        maxRequestsPerHour: true,
        maxRequestsPerDay: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    if (!apiKey) return null;

    // Get recent logs count
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequests = await prisma.webhookLog.count({
      where: {
        apiKeyId,
        createdAt: { gte: last24Hours },
      },
    });

    const recentFailures = await prisma.webhookLog.count({
      where: {
        apiKeyId,
        success: false,
        createdAt: { gte: last24Hours },
      },
    });

    return {
      ...apiKey,
      last24HoursRequests: recentRequests,
      last24HoursFailures: recentFailures,
      successRate:
        recentRequests > 0
          ? ((recentRequests - recentFailures) / recentRequests) * 100
          : 100,
    };
  } catch (error) {
    console.error("Failed to get usage stats:", error);
    return null;
  }
}
