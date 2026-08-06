import { Router } from "express";
import {
  getBadgesController,
  getUserXpBreakdown,
  getXpLeaderboard,
  getXpSummaryController,
} from "../controllers/xpPoints.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const xpPointsRouter = Router();

xpPointsRouter.get("/summary", requireAuth, getXpSummaryController);
xpPointsRouter.get("/breakdown", requireAuth, getUserXpBreakdown);
xpPointsRouter.get("/leaderboard", requireAuth, getXpLeaderboard);
xpPointsRouter.get("/badges", requireAuth, getBadgesController);

export default xpPointsRouter;
