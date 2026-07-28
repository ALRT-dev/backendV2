import { Router } from "express";
import {
  requireAdminAuth,
  requireAnyAdmin,
} from "../../middlewares/auth.admin.middleware.js";
import { getDashboardStatsController } from "../../controllers/admin/stats.controller.js";

const adminStatsRouter = Router();

adminStatsRouter.use(requireAdminAuth);

// Read-only overview — available to every admin role including moderators.
adminStatsRouter.get("/dashboard", requireAnyAdmin, getDashboardStatsController);

export default adminStatsRouter;
