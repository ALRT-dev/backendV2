import { Router } from "express";
import {
  createHazard,
  getHazardById,
  getHazards,
  deleteHazard,
  populateHazards,
  getHazardsWithCategories,
  voteHazard,
} from "../controllers/hazard.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const hazardRouter = Router();

hazardRouter.get("/", requireAuth, getHazards);
hazardRouter.get(
  "/hazards-with-categories",
  requireAuth,
  getHazardsWithCategories
);
hazardRouter.get("/:id", requireAuth, getHazardById);
hazardRouter.post("/", requireAuth, createHazard);
hazardRouter.post("/populate", requireAuth, populateHazards);
hazardRouter.delete("/:id", requireAuth, deleteHazard);
hazardRouter.post("/:id/vote", requireAuth, voteHazard);

export default hazardRouter;
