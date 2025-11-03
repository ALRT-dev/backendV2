import { Router } from "express";
import {
  createHazardCategory,
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
hazardCategoryRouter.post("/populate", requireAuth, populateCategories);

export default hazardCategoryRouter;
