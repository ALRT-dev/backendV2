import { Router } from "express";
import {
  requireAdminAuth,
  requireAdminOrAbove,
  requireAnyAdmin,
  requireSuperAdmin,
} from "../../middlewares/auth.admin.middleware.js";
import {
  createAdmin,
  getAdminProfileController,
} from "../../controllers/admin/user.controller.js";
import {
  deleteAppUserController,
  getAppUserController,
  listAdminsController,
  listAppUsersController,
  restoreAppUserController,
  setAdminActiveController,
  updateAppUserController,
} from "../../controllers/admin/app_user.controller.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { createAdminSchema } from "../../validators/admin/user.validator.js";

const adminUserRouter = Router();

// All routes below require admin authentication
adminUserRouter.use(requireAdminAuth);

adminUserRouter.get("/me", requireAnyAdmin, getAdminProfileController);

// --- Admin account management --------------------------------------------
// Listing is read-only so any admin can see who has access; mutations stay
// restricted to super admins.
adminUserRouter.get("/admins", requireAnyAdmin, listAdminsController);

// Super admin only routes
adminUserRouter.post(
  "/create",
  requireSuperAdmin,
  validate(createAdminSchema),
  createAdmin
);

adminUserRouter.patch(
  "/admins/:adminId/active",
  requireSuperAdmin,
  setAdminActiveController
);

// --- App user management --------------------------------------------------
// Moderators may look users up; only admin-or-above can change or remove them.
adminUserRouter.get("/app-users", requireAnyAdmin, listAppUsersController);

adminUserRouter.get(
  "/app-users/:userId",
  requireAnyAdmin,
  getAppUserController
);

adminUserRouter.put(
  "/app-users/:userId",
  requireAdminOrAbove,
  updateAppUserController
);

adminUserRouter.delete(
  "/app-users/:userId",
  requireAdminOrAbove,
  deleteAppUserController
);

adminUserRouter.post(
  "/app-users/:userId/restore",
  requireAdminOrAbove,
  restoreAppUserController
);

export default adminUserRouter;
