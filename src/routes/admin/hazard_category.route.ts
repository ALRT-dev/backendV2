import { Router } from "express";
import { getCategoriesForAdmin } from "../../controllers/admin/hazard_category.controller.js";

const adminHazardCategoryRouter = Router();

adminHazardCategoryRouter.get("/", getCategoriesForAdmin);

export default adminHazardCategoryRouter;
