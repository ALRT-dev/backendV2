import { Router } from "express";
import {
  createHazard,
  getHazardById,
  getHazards,
  deleteHazard,
  getHazardsWithSubscriptionId,
  voteHazard,
  populateHazards,
  viewHazard,
  updateHazard,
  getHazardFilters,
} from "../controllers/hazard.controller.js";
import {
  deleteHazardMedia,
  updateHazardMedia,
} from "../controllers/hazard_media.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createHazardSchema,
  voteHazardSchema,
  getHazardsQuerySchema,
  updateHazardSchema,
  getHazardFiltersQuerySchema,
} from "../validators/hazard.validator.js";
import {
  uploadMultiple,
  handleMulterError,
} from "../middlewares/upload.middleware.js";

const hazardRouter = Router();

hazardRouter.get("/", requireAuth, validate(getHazardsQuerySchema), getHazards);
hazardRouter.get(
  "/hazards-with-subscription-id",
  requireAuth,
  validate(getHazardsQuerySchema),
  getHazardsWithSubscriptionId
);
hazardRouter.get(
  "/filters",
  validate(getHazardFiltersQuerySchema),
  requireAuth,
  getHazardFilters
);
hazardRouter.get("/:id", requireAuth, getHazardById);

hazardRouter.post(
  "/",
  requireAuth,
  uploadMultiple,
  handleMulterError,
  validate(createHazardSchema),
  createHazard
);
hazardRouter.put(
  "/:id",
  requireAuth,
  uploadMultiple,
  handleMulterError,
  validate(updateHazardSchema),
  updateHazard
);
hazardRouter.post(
  "/:id/vote",
  requireAuth,
  validate(voteHazardSchema),
  voteHazard
);
hazardRouter.post("/:id/view", requireAuth, viewHazard);
hazardRouter.post("/populate", requireAuth, populateHazards);

hazardRouter.delete("/:id", requireAuth, deleteHazard);

hazardRouter.delete(
  "/:hazardId/media/:mediaId",
  requireAuth,
  deleteHazardMedia
);
hazardRouter.patch("/:hazardId/media/:mediaId", requireAuth, updateHazardMedia);

export default hazardRouter;
