import { Router } from "express";
import {
  listTopicsController,
  getGuideDetailController,
  completeGuideController,
  getGuideForHazardCategoryController,
} from "../controllers/guide.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const guideRouter = Router();

// Fixed paths must be registered before the /:slugOrId catch-all.
guideRouter.get("/topics", requireAuth, listTopicsController);
guideRouter.get(
  "/for-category/:categoryId",
  requireAuth,
  getGuideForHazardCategoryController,
);
guideRouter.get("/:slugOrId", requireAuth, getGuideDetailController);
guideRouter.post("/:slugOrId/complete", requireAuth, completeGuideController);

export default guideRouter;
