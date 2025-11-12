import { Router } from "express";
import {
  requireAdminAuth,
  requireAnyAdmin,
  requireSuperAdmin,
} from "../../middlewares/auth.admin.middleware.js";
import {
  createAdmin,
  getAdminProfileController,
} from "../../controllers/admin/user.controller.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { createAdminSchema } from "../../validators/admin/user.validator.js";

const adminUserRouter = Router();

// All routes below require admin authentication
adminUserRouter.use(requireAdminAuth);

adminUserRouter.get("/me", requireAnyAdmin, getAdminProfileController);

// Super admin only routes
adminUserRouter.post(
  "/create",
  requireSuperAdmin,
  validate(createAdminSchema),
  createAdmin
);

export default adminUserRouter;
