import { Router } from "express";
import {
  getHazardSourcesForAdmin,
  getHazardSourceByIdForAdmin,
  createHazardSourceForAdmin,
  updateHazardSourceForAdmin,
  deleteHazardSourceForAdmin,
  getHazardSourceLicensesForAdmin,
  getHazardSourceLicenseByIdForAdmin,
  createHazardSourceLicenseForAdmin,
  updateHazardSourceLicenseForAdmin,
  deleteHazardSourceLicenseForAdmin,
} from "../../controllers/admin/hazard_source.controller.js";
import {
  requireAdminAuth,
  requireAnyAdmin,
  requireAdminOrAbove,
} from "../../middlewares/auth.admin.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  getHazardSourcesForAdminQuerySchema,
  createHazardSourceForAdminBodySchema,
  updateHazardSourceForAdminBodySchema,
  createHazardSourceLicenseForAdminBodySchema,
  updateHazardSourceLicenseForAdminBodySchema,
} from "../../validators/admin/hazard_source.validator.js";

const adminHazardSourceRouter = Router();

// All routes below require admin authentication
adminHazardSourceRouter.use(requireAdminAuth);

// License routes - read operations (any admin role)
adminHazardSourceRouter.get(
  "/licenses",
  requireAnyAdmin,
  getHazardSourceLicensesForAdmin,
);

adminHazardSourceRouter.get(
  "/licenses/:licenseId",
  requireAnyAdmin,
  getHazardSourceLicenseByIdForAdmin,
);

// License routes - write operations (admin or above)
adminHazardSourceRouter.post(
  "/licenses",
  requireAdminOrAbove,
  validate(createHazardSourceLicenseForAdminBodySchema),
  createHazardSourceLicenseForAdmin,
);

adminHazardSourceRouter.put(
  "/licenses/:licenseId",
  requireAdminOrAbove,
  validate(updateHazardSourceLicenseForAdminBodySchema),
  updateHazardSourceLicenseForAdmin,
);

adminHazardSourceRouter.delete(
  "/licenses/:licenseId",
  requireAdminOrAbove,
  deleteHazardSourceLicenseForAdmin,
);

// Source routes - read operations (any admin role)
adminHazardSourceRouter.get(
  "/",
  requireAnyAdmin,
  validate(getHazardSourcesForAdminQuerySchema),
  getHazardSourcesForAdmin,
);

adminHazardSourceRouter.get(
  "/:sourceId",
  requireAnyAdmin,
  getHazardSourceByIdForAdmin,
);

// Write operations - admin or above
adminHazardSourceRouter.post(
  "/",
  requireAdminOrAbove,
  validate(createHazardSourceForAdminBodySchema),
  createHazardSourceForAdmin,
);

adminHazardSourceRouter.put(
  "/:sourceId",
  requireAdminOrAbove,
  validate(updateHazardSourceForAdminBodySchema),
  updateHazardSourceForAdmin,
);

adminHazardSourceRouter.delete(
  "/:sourceId",
  requireAdminOrAbove,
  deleteHazardSourceForAdmin,
);

export default adminHazardSourceRouter;
