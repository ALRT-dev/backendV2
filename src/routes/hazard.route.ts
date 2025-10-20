import { Router } from "express";
import {
  createHazard,
  getHazardById,
  getHazards,
  deleteHazard,
  getHazardsWithCategories,
  voteHazard,
  populateHazards,
  viewHazard,
  updateHazard,
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
} from "../validators/hazard.validator.js";
import {
  uploadMultiple,
  handleMulterError,
} from "../middlewares/upload.middleware.js";

const hazardRouter = Router();

hazardRouter.get("/", requireAuth, validate(getHazardsQuerySchema), getHazards);
hazardRouter.get(
  "/hazards-with-categories",
  requireAuth,
  validate(getHazardsQuerySchema),
  getHazardsWithCategories
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
