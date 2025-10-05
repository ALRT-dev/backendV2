import { Router } from "express";
import {
  createHazardCategory,
  getHazardCategories,
} from "../controllers/hazardCategory.controller.js";

const hazardCategoryRouter = Router();

hazardCategoryRouter.get("/", getHazardCategories);
hazardCategoryRouter.post("/", createHazardCategory);

export default hazardCategoryRouter;
