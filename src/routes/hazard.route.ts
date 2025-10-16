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
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createHazardSchema,
  voteHazardSchema,
  getHazardsQuerySchema,
  updateHazardSchema,
} from "../validators/hazard.validator.js";

const hazardRouter = Router();

hazardRouter.get("/", requireAuth, validate(getHazardsQuerySchema), getHazards);
hazardRouter.get(
  "/hazards-with-categories",
  requireAuth,
  validate(getHazardsQuerySchema),
  getHazardsWithCategories
);
hazardRouter.get("/:id", requireAuth, getHazardById);
hazardRouter.post("/", requireAuth, validate(createHazardSchema), createHazard);
hazardRouter.put(
  "/:id",
  requireAuth,
  validate(updateHazardSchema),
  updateHazard
);
hazardRouter.delete("/:id", requireAuth, deleteHazard);
hazardRouter.post("/populate", requireAuth, populateHazards);
hazardRouter.post(
  "/:id/vote",
  requireAuth,
  validate(voteHazardSchema),
  voteHazard
);
hazardRouter.post("/:id/view", requireAuth, viewHazard);

export default hazardRouter;
