import { Router } from "express";
import {
  createHazardCategory,
  getHazardCategories,
  populateCategories,
} from "../controllers/hazardCategory.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const hazardCategoryRouter = Router();

hazardCategoryRouter.get("/", requireAuth, getHazardCategories);
hazardCategoryRouter.post("/", requireAuth, createHazardCategory);
hazardCategoryRouter.post("/populate", requireAuth, populateCategories);

export default hazardCategoryRouter;
