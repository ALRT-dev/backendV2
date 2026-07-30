import { Router } from "express";
import {
  createHazardCategory,
  deleteAllHazardCategories,
  getAllHazardCategories,
  getAllParentHazardCategories,
  getAllSubHazardCategories,
  populateCategories,
} from "../controllers/hazard_category.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  requireAdminAuth,
  requireAdminOrAbove,
} from "../middlewares/auth.admin.middleware.js";

const hazardCategoryRouter = Router();

hazardCategoryRouter.get("/", requireAuth, getAllHazardCategories);
hazardCategoryRouter.get("/parent", requireAuth, getAllParentHazardCategories);
hazardCategoryRouter.get("/sub", requireAuth, getAllSubHazardCategories);
hazardCategoryRouter.post("/", requireAuth, createHazardCategory);

// admin — destructive / seed operations, restricted to admin-or-above.
// (Previously these were exposed with no authentication at all.)
hazardCategoryRouter.post(
  "/delete-all",
  requireAdminAuth,
  requireAdminOrAbove,
  deleteAllHazardCategories
);
hazardCategoryRouter.post(
  "/populate",
  requireAdminAuth,
  requireAdminOrAbove,
  populateCategories
);

export default hazardCategoryRouter;
