import { Router } from "express";
import {
  loginAsAdmin,
  refreshAdminToken,
  logoutAdmin,
  changeAdminPassword,
} from "../../controllers/admin/auth.controller.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  loginAsAdminBodySchema,
  adminRefreshTokenSchema,
  changeAdminPasswordSchema,
} from "../../validators/admin/auth.validator.js";
import {
  requireAdminAuth,
  requireAnyAdmin,
} from "../../middlewares/auth.admin.middleware.js";

const adminAuthRouter = Router();

adminAuthRouter.post("/login", validate(loginAsAdminBodySchema), loginAsAdmin);
adminAuthRouter.post(
  "/refresh-token",
  validate(adminRefreshTokenSchema),
  refreshAdminToken
);

// All routes below require admin authentication
adminAuthRouter.use(requireAdminAuth);

adminAuthRouter.post("/logout", requireAnyAdmin, logoutAdmin);
adminAuthRouter.post(
  "/change-password",
  requireAnyAdmin,
  validate(changeAdminPasswordSchema),
  changeAdminPassword
);

export default adminAuthRouter;
