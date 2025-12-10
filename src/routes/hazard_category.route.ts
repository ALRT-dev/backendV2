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

const hazardCategoryRouter = Router();

hazardCategoryRouter.get("/", requireAuth, getAllHazardCategories);
hazardCategoryRouter.get("/parent", requireAuth, getAllParentHazardCategories);
hazardCategoryRouter.get("/sub", requireAuth, getAllSubHazardCategories);
hazardCategoryRouter.post("/", requireAuth, createHazardCategory);

// admin
hazardCategoryRouter.post("/delete-all", deleteAllHazardCategories);
hazardCategoryRouter.post("/populate", populateCategories);

export default hazardCategoryRouter;
