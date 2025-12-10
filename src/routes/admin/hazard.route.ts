import { Router } from "express";
import {
  createHazardForAdmin,
  deleteHazardForAdmin,
  getHazardsForAdmin,
  getHazardSourcesForAdmin,
  syncHazardsFromExternalSourceForAdmin,
  updateHazardForAdmin,
} from "../../controllers/admin/hazard.controller.js";
import {
  requireAdminAuth,
  requireAnyAdmin,
  requireAdminOrAbove,
} from "../../middlewares/auth.admin.middleware.js";

const adminHazardRouter = Router();

// All routes below require admin authentication
adminHazardRouter.use(requireAdminAuth);

// Read operations - any admin role
adminHazardRouter.get("/", requireAnyAdmin, getHazardsForAdmin);
adminHazardRouter.get("/sources", requireAnyAdmin, getHazardSourcesForAdmin);

// Write operations - admin or above
adminHazardRouter.post("/", requireAdminOrAbove, createHazardForAdmin);
adminHazardRouter.put("/:hazardId", requireAdminOrAbove, updateHazardForAdmin);
adminHazardRouter.delete(
  "/:hazardId",
  requireAdminOrAbove,
  deleteHazardForAdmin
);
adminHazardRouter.post(
  "/sync-external",
  requireAdminOrAbove,
  syncHazardsFromExternalSourceForAdmin
);

export default adminHazardRouter;
