import type { NextFunction, Request, Response } from "express";
import { config } from "../utils/config.js";
import {
  applyRevenueCatEvent,
  type RevenueCatEvent,
} from "../services/entitlement.service.js";

/**
 * POST /api/revenuecat/webhook
 *
 * Receives RevenueCat subscription events and syncs the user's ALRT+
 * entitlement. Authenticated by comparing the Authorization header with
 * REVENUECAT_WEBHOOK_AUTH (set the same value in the RevenueCat dashboard).
 *
 * Always answers 200 for authenticated events we choose to ignore (anonymous
 * ids, unknown users, non-plus entitlements) so RevenueCat does not retry
 * them forever; non-2xx is reserved for auth failures and real errors.
 */
export const handleRevenueCatWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const expected = config.revenuecat.webhookAuth;
    if (!expected) {
      // Misconfigured deployment: refuse loudly rather than accepting
      // unauthenticated entitlement writes.
      res
        .status(503)
        .json({ message: "REVENUECAT_WEBHOOK_AUTH is not configured" });
      return;
    }
    if ((req.headers.authorization ?? "") !== expected) {
      res.status(401).json({ message: "Invalid webhook authorization" });
      return;
    }

    const event = (req.body?.event ?? {}) as RevenueCatEvent;
    const result = await applyRevenueCatEvent(event);
    console.log(
      `[revenuecat] event=${event.type ?? "?"} user=${event.app_user_id ?? "?"} -> ${result.action}${result.reason ? ` (${result.reason})` : ""}`,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
