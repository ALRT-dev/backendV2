import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../utils/config.js";
import {
  getClientIp,
  normalizeClientIpForRateLimitKey,
} from "../utils/client_ip.util.js";

const rateLimitKey = (req: Request) =>
  normalizeClientIpForRateLimitKey(getClientIp(req));

/** Paths mounted at /api/hazards — excluded from general API limit (they use dedicated limits). */
export function isHazardReadApiPath(req: Request): boolean {
  const raw = req.originalUrl ?? req.url ?? "";
  const path = raw.split("?")[0] ?? "";
  return path === "/api/hazards" || path.startsWith("/api/hazards/");
}

const limiterValidate = config.rateLimit.trustProxy
  ? { trustProxy: true as const }
  : { xForwardedForHeader: false as const };

function json429Handler(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({
      error: "Too many requests",
      message,
    });
  };
}

/**
 * Stricter limits on auth routes (login, register, OAuth, refresh) to slow credential stuffing.
 */
export const authApiRateLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: limiterValidate,
  keyGenerator: rateLimitKey,
  handler: json429Handler(
    "Too many authentication attempts from this address. Please wait before trying again.",
  ),
});

/**
 * Default API rate limit for all /api routes except those mounted earlier (webhook, auth).
 * GET /api/hazards* is skipped — those use {@link hazardGetIpLimiter} + {@link hazardReadUserLimiter}.
 */
export const apiGeneralRateLimiter = rateLimit({
  windowMs: config.rateLimit.generalWindowMs,
  max: config.rateLimit.generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: limiterValidate,
  keyGenerator: rateLimitKey,
  skip: (req) => req.method === "GET" && isHazardReadApiPath(req),
  handler: json429Handler(
    "Too many requests. Please slow down and try again later.",
  ),
});

/**
 * All GETs under /api/hazards (before auth). High per-IP ceiling so one map session can poll heavily;
 * still caps scrapers and bad-token spam on the same address.
 */
export const hazardGetIpLimiter = rateLimit({
  windowMs: config.rateLimit.hazardGetIpWindowMs,
  max: config.rateLimit.hazardGetIpMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: limiterValidate,
  keyGenerator: rateLimitKey,
  handler: json429Handler(
    "Too many hazard data requests from this address. Please wait a moment.",
  ),
});

/**
 * After requireAuth — per-user budget for map/list/detail hazard reads (independent of office NAT).
 */
export const hazardReadUserLimiter = rateLimit({
  windowMs: config.rateLimit.hazardReadWindowMs,
  max: config.rateLimit.hazardReadMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: limiterValidate,
  keyGenerator: (req: Request, res: Response) =>
    res.userId ? `u:${res.userId}` : rateLimitKey(req),
  handler: json429Handler(
    "Too many hazard requests for this account. Please try again later.",
  ),
});
