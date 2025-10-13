import { Router } from "express";
import {
  createHazard,
  getHazardById,
  getHazards,
  deleteHazard,
  getHazardsWithCategories,
  voteHazard,
  populateFromSource,
} from "../controllers/hazard.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createHazardSchema,
  voteHazardSchema,
  getHazardsQuerySchema,
} from "../validators/hazard.schema.js";

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
hazardRouter.post("/populate", requireAuth, populateFromSource);
hazardRouter.delete("/:id", requireAuth, deleteHazard);
hazardRouter.post(
  "/:id/vote",
  requireAuth,
  validate(voteHazardSchema),
  voteHazard
);

export default hazardRouter;
