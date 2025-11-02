import { Router } from "express";
import {
  createHazardCategory,
  getHazardCategories,
} from "../controllers/hazard_category.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const hazardCategoryRouter = Router();

hazardCategoryRouter.get("/", requireAuth, getHazardCategories);
hazardCategoryRouter.post("/", requireAuth, createHazardCategory);

export default hazardCategoryRouter;
