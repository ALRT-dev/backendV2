import { Router } from "express";
import {
  requireAdminAuth,
  requireAnyAdmin,
} from "../../middlewares/auth.admin.middleware.js";
import { getAdminStatsController } from "../../controllers/admin/stats.controller.js";

const adminStatsRouter = Router();

adminStatsRouter.use(requireAdminAuth);

/**
 * @route   GET /api/admin/stats
 * @desc    Platform counts for the admin dashboard. "Today" uses
 *          Australia/Brisbane day boundaries; user counts exclude accounts
 *          with a pending deletion request.
 */
adminStatsRouter.get("/", requireAnyAdmin, getAdminStatsController);

export default adminStatsRouter;
