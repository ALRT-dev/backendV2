import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./auth.middleware.js";
import { requireWebhookAuth } from "./webhook.middleware.js";

/**
 * Allows the alerts feed to be consumed either by a logged-in app user
 * (Bearer token) or by an external integration holding a webhook API key
 * (X-Webhook-Api-Key header). Key verification, logging, expiry and
 * suspicious-attempt tracking are all reused from the webhook middleware.
 *
 * API-key clients are marked on the response so downstream handlers can
 * restrict them to publicly shareable data (accepted, non-personal).
 */
export const requireUserOrExportKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.headers["x-webhook-api-key"]) {
    res.locals.isExportApiKeyClient = true;
    return requireWebhookAuth(req, res, next);
  }
  return requireAuth(req, res, next);
};
