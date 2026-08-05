import { Router } from "express";
import {
  createHazard,
  getHazardById,
  getHazards,
  deleteHazard,
  getHazardsWithSubscriptionId,
  voteHazard,
  viewHazard,
  updateHazard,
} from "../controllers/hazard.controller.js";
import {
  deleteHazardMedia,
  updateHazardMedia,
} from "../controllers/hazard_media.controller.js";
import { flagHazardController } from "../controllers/community_safety.controller.js";
import { flagHazardSchema } from "../validators/community_safety.validator.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createHazardSchema,
  voteHazardSchema,
  getHazardsQuerySchema,
  updateHazardSchema,
} from "../validators/hazard.validator.js";
import {
  uploadMultiple,
  handleMulterError,
} from "../middlewares/upload.middleware.js";
import {
  hazardGetIpLimiter,
  hazardReadUserLimiter,
} from "../middlewares/api_rate_limit.middleware.js";

const hazardRouter = Router();

hazardRouter.use((req, res, next) => {
  if (req.method !== "GET") return next();
  hazardGetIpLimiter(req, res, next);
});

hazardRouter.get(
  "/",
  requireAuth,
  hazardReadUserLimiter,
  validate(getHazardsQuerySchema),
  getHazards,
);
hazardRouter.get(
  "/hazards-with-subscription-id",
  requireAuth,
  hazardReadUserLimiter,
  validate(getHazardsQuerySchema),
  getHazardsWithSubscriptionId,
);
hazardRouter.get("/:id", requireAuth, hazardReadUserLimiter, getHazardById);

hazardRouter.post(
  "/",
  requireAuth,
  uploadMultiple,
  handleMulterError,
  validate(createHazardSchema),
  createHazard,
);
hazardRouter.put(
  "/:id",
  requireAuth,
  uploadMultiple,
  handleMulterError,
  validate(updateHazardSchema),
  updateHazard,
);
hazardRouter.post(
  "/:id/vote",
  requireAuth,
  validate(voteHazardSchema),
  voteHazard,
);
hazardRouter.post("/:id/view", requireAuth, viewHazard);
hazardRouter.delete("/:id", requireAuth, deleteHazard);

hazardRouter.delete(
  "/:hazardId/media/:mediaId",
  requireAuth,
  deleteHazardMedia,
);
hazardRouter.patch("/:hazardId/media/:mediaId", requireAuth, updateHazardMedia);

// Community safety: anyone can flag a community report for review. The
// automated pipeline screens content before it publishes; this covers what
// automation cannot judge.
hazardRouter.post(
  "/:hazardId/flag",
  requireAuth,
  validate(flagHazardSchema),
  flagHazardController,
);

export default hazardRouter;
