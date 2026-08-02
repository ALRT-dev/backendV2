import type { Request, Response, NextFunction } from "express";
import { config } from "../utils/config.js";
import {
  applyRevenueCatEvent,
  type RevenueCatEvent,
} from "../services/revenuecat.service.js";

/**
 * POST /api/revenuecat/webhook
 *
 * Receives RevenueCat subscriber events and updates the user's ALRT+
 * entitlement. This is the ONLY place entitlements are written — the app can
 * never grant itself ALRT+.
 *
 * Auth: RevenueCat sends the exact Authorization header value configured in the
 * dashboard. We reject anything that doesn't match (when a value is configured).
 */
export const handleRevenueCatWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const expected = config.revenueCat.webhookAuth;
    if (expected) {
      const provided = req.header("authorization") || "";
      if (provided !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const event = (req.body?.event ?? {}) as RevenueCatEvent;
    const result = await applyRevenueCatEvent(event);

    // Always ACK with 200 for benign cases (unknown user, ignored event type)
    // so RevenueCat does not retry indefinitely.
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    next(error);
  }
};
