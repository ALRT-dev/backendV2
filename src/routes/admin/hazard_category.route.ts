import { Router } from "express";
import { getCategoriesForAdmin } from "../../controllers/admin/hazard_category.controller.js";
import {
  requireAdminAuth,
  requireAnyAdmin,
} from "../../middlewares/auth.admin.middleware.js";

const adminHazardCategoryRouter = Router();

// All routes below require admin authentication
adminHazardCategoryRouter.use(requireAdminAuth);

adminHazardCategoryRouter.get("/", requireAnyAdmin, getCategoriesForAdmin);

export default adminHazardCategoryRouter;
