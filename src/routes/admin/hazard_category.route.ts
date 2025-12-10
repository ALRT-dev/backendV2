import { Router } from "express";
import {
  getCategoriesForAdmin,
  createHazardCategoryForAdmin,
  updateHazardCategoryForAdmin,
  deleteHazardCategoryForAdmin,
} from "../../controllers/admin/hazard_category.controller.js";
import {
  requireAdminAuth,
  requireAnyAdmin,
  requireAdminOrAbove,
} from "../../middlewares/auth.admin.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  createHazardCategoryForAdminBodySchema,
  updateHazardCategoryForAdminBodySchema,
} from "../../validators/admin/hazard_category.validator.js";

const adminHazardCategoryRouter = Router();

// All routes below require admin authentication
adminHazardCategoryRouter.use(requireAdminAuth);

// Read operations - any admin role
adminHazardCategoryRouter.get("/", requireAnyAdmin, getCategoriesForAdmin);

// Write operations - admin or above
adminHazardCategoryRouter.post(
  "/",
  requireAdminOrAbove,
  validate(createHazardCategoryForAdminBodySchema),
  createHazardCategoryForAdmin
);
adminHazardCategoryRouter.put(
  "/:categoryId",
  requireAdminOrAbove,
  validate(updateHazardCategoryForAdminBodySchema),
  updateHazardCategoryForAdmin
);
adminHazardCategoryRouter.delete(
  "/:categoryId",
  requireAdminOrAbove,
  deleteHazardCategoryForAdmin
);

export default adminHazardCategoryRouter;
